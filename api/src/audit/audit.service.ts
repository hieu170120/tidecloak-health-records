import { Injectable } from '@nestjs/common';
import { createHash, createPrivateKey, createPublicKey, randomUUID, sign, verify, KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PoolClient } from 'pg';

@Injectable()
export class AuditService {
  private readonly key: KeyObject;
  readonly keyId: string;
  readonly publicKeyPem: string;
  constructor() {
    const path = process.env.AUDIT_SIGNING_KEY_FILE;
    if (!path) throw new Error('AUDIT_SIGNING_KEY_FILE is required');
    this.key = createPrivateKey(readFileSync(path));
    if (this.key.asymmetricKeyType !== 'ed25519') throw new Error('Audit signer must be Ed25519');
    const publicKey = createPublicKey(this.key);
    this.publicKeyPem = publicKey.export({format:'pem',type:'spki'}).toString();
    this.keyId = createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex');
  }
  async append(client: PoolClient, event: {actorId:string;patientId:string;resourceId:string;resourceType:string;action:string;outcome?:string}) {
    const head = (await client.query('SELECT * FROM health.audit_head()')).rows[0];
    if (head && (!head.canonical_event || head.signer_key_id !== this.keyId ||
        !verify(null, Buffer.from(head.canonical_event), this.publicKeyPem, head.signature) ||
        !createHash('sha256').update(head.canonical_event).digest().equals(head.event_hash))) {
      throw new Error('Unverifiable audit head; refusing data mutation');
    }
    const data = {...event, outcome:event.outcome ?? 'SUCCESS', eventId:randomUUID(),
      occurredAt:new Date().toISOString(),requestId:randomUUID(),previousHash:head?.event_hash.toString('hex') ?? null};
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(data).sort(([a],[b])=>a < b ? -1 : a > b ? 1 : 0)));
    const hash = createHash('sha256').update(canonical).digest();
    const signature = sign(null,Buffer.from(canonical),this.key);
    await client.query('SELECT health.append_audit_event($1,$2,$3,$4)',[canonical,hash,signature,this.keyId]);
  }
  async ownEvents(client: PoolClient, patientId:string) {
    const result = await client.query('SELECT * FROM health.patient_audit($1,100)',[patientId]);
    return {assurance:'LOCAL_SIGNATURES_ONLY_NOT_EXTERNALLY_ANCHORED',publicKeyPem:this.publicKeyPem,keyId:this.keyId,
      events:result.rows.map(row=>({sequence:row.chain_sequence,event:row.canonical_event ? JSON.parse(row.canonical_event) : null,
        hash:row.event_hash.toString('hex'),signature:row.signature.toString('base64'),signerKeyId:row.signer_key_id,
        signatureValid:row.signer_key_id===this.keyId && !!row.canonical_event && verify(null,Buffer.from(row.canonical_event),this.publicKeyPem,row.signature)}))};
  }
}

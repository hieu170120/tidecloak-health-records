import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PrincipalsService } from '../principals/principals.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { createHash } from 'node:crypto';

const FORMAT = ['TIDE_STRING','TIDE_BYTES'];
@Injectable()
export class CapsulesService {
  constructor(private readonly db:DatabaseService,private readonly principals:PrincipalsService,private readonly audit:AuditService) {}
  async read(user:AuthenticatedUser) {
    return this.db.transaction(async client=>{
      const p=await this.principals.resolve(client,user);
      const latest=(await client.query('SELECT * FROM health.emergency_capsules WHERE patient_id=$1 ORDER BY version DESC LIMIT 1',[p.principalId])).rows[0];
      if (!latest || latest.status!=='ACTIVE') return {capsule:null,latestVersion:latest?.version ?? 0};
      await this.audit.append(client,{actorId:p.principalId,patientId:p.principalId,resourceId:latest.id,resourceType:'EMERGENCY_CAPSULE',action:'EMERGENCY_CAPSULE_CIPHERTEXT_RETURNED'});
      return {latestVersion:latest.version,capsule:{id:latest.id,version:latest.version,ciphertext:latest.ciphertext.toString('base64'),
        ciphertextFormat:latest.ciphertext_format,ciphertextHash:latest.ciphertext_hash.toString('hex'),tags:['emergency_capsule'],
        keyReference:latest.key_reference,createdAt:latest.created_at}};
    });
  }
  async save(user:AuthenticatedUser,input:unknown,archive=false) {
    const body=this.validate(input,archive);
    const result=await this.db.transaction(async client=>{
      const p=await this.principals.resolve(client,user);
      const latest=(await client.query('SELECT id,version FROM health.emergency_capsules WHERE patient_id=$1 ORDER BY version DESC LIMIT 1',[p.principalId])).rows[0];
      if (body.expectedVersion!==(latest?.version ?? 0)) {
        await this.audit.append(client,{actorId:p.principalId,patientId:p.principalId,resourceId:p.principalId,resourceType:'EMERGENCY_CAPSULE',action:'EMERGENCY_CAPSULE_WRITE_REJECTED',outcome:'DENIED'});
        return {conflict:true};
      }
      await client.query("UPDATE health.emergency_capsules SET status='SUPERSEDED',superseded_at=now() WHERE patient_id=$1 AND status='ACTIVE'",[p.principalId]);
      if (archive) {
        await this.audit.append(client,{actorId:p.principalId,patientId:p.principalId,resourceId:latest?.id ?? p.principalId,resourceType:'EMERGENCY_CAPSULE',action:'EMERGENCY_CAPSULE_ARCHIVED'});
        return {archived:true,latestVersion:latest?.version ?? 0};
      }
      const ciphertext=Buffer.from(body.ciphertext!,'base64');
      const row=(await client.query(`INSERT INTO health.emergency_capsules(patient_id,version,ciphertext,ciphertext_hash,encryption_algorithm,key_reference,created_by,ciphertext_format)
        VALUES($1,$2,$3,$4,'TIDE_SDK_SELF','tide:self:emergency_capsule',$1,$5) RETURNING id,version`,
        [p.principalId,(latest?.version ?? 0)+1,ciphertext,createHash('sha256').update(ciphertext).digest(),body.ciphertextFormat])).rows[0];
      await this.audit.append(client,{actorId:p.principalId,patientId:p.principalId,resourceId:row.id,resourceType:'EMERGENCY_CAPSULE',
        action:latest ? 'EMERGENCY_CAPSULE_UPDATED':'EMERGENCY_CAPSULE_CREATED'});
      return {id:row.id,version:row.version};
    });
    if ('conflict' in result) throw new ConflictException('Capsule changed; reload before saving');
    return result;
  }
  private validate(input:unknown,archive:boolean):{expectedVersion:number;ciphertext?:string;ciphertextFormat?:string} {
    if (!input || typeof input!=='object' || Array.isArray(input)) throw new BadRequestException('JSON object required');
    const b=input as Record<string,unknown>;
    const allowed=archive ? ['expectedVersion']:['expectedVersion','ciphertext','ciphertextFormat'];
    if (Object.keys(b).some(k=>!allowed.includes(k))) throw new BadRequestException('Only encrypted envelope fields are accepted');
    if (!Number.isSafeInteger(b.expectedVersion) || (b.expectedVersion as number)<0) throw new BadRequestException('expectedVersion must be a nonnegative integer');
    if (!archive) {
      if (typeof b.ciphertext!=='string' || b.ciphertext.length>350000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.ciphertext)) throw new BadRequestException('Bounded canonical base64 ciphertext required');
      const bytes=Buffer.from(b.ciphertext,'base64');
      if (!bytes.length || bytes.length>256*1024 || bytes.toString('base64')!==b.ciphertext) throw new BadRequestException('Ciphertext must contain 1–262144 bytes');
      if (!FORMAT.includes(b.ciphertextFormat as string)) throw new BadRequestException('Unknown ciphertext format');
    }
    return b as {expectedVersion:number;ciphertext?:string;ciphertextFormat?:string};
  }
}

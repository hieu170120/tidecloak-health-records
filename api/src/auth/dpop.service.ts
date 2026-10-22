import { Injectable, UnauthorizedException } from '@nestjs/common';
import { calculateJwkThumbprint, decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DpopService {
  constructor(private readonly db:DatabaseService) {}
  async verify(token:string,proof:string|undefined,thumbprint:string,method:string,path:string) {
    try {
      if (!proof || proof.length>16000) throw Error('Proof missing');
      const header=decodeProtectedHeader(proof);
      if (header.typ!=='dpop+jwt' || typeof header.alg!=='string' || !['ES256','EdDSA'].includes(header.alg) || !header.jwk ||
          'd' in header.jwk || !['EC','OKP'].includes(header.jwk.kty ?? '')) throw Error('Invalid proof key');
      const jkt=await calculateJwkThumbprint(header.jwk,'sha256');
      if (jkt!==thumbprint) throw Error('Wrong proof key');
      const key=await importJWK(header.jwk,header.alg);
      const {payload}=await jwtVerify(proof,key,{algorithms:['ES256','EdDSA'],typ:'dpop+jwt'});
      const base=process.env.DPOP_PUBLIC_BASE_URL;
      if (!base) throw Error('DPoP public URL not configured');
      const expected=new URL(base.replace(/\/$/,'')+'/'+path.split('?')[0].replace(/^\//,''));
      const actual=new URL(String(payload.htu));
      if (actual.search || actual.hash) throw Error('Proof URL must omit query/fragment');
      expected.search='';expected.hash='';
      if (actual.href!==expected.href || payload.htm!==method.toUpperCase() ||
          payload.ath!==createHash('sha256').update(token).digest('base64url') ||
          !Number.isInteger(payload.iat) || Math.abs(Date.now()/1000-payload.iat!)>60 ||
          typeof payload.jti!=='string' || !payload.jti.length || payload.jti.length>200) throw Error('Invalid proof claims');
      const result=await this.db.query('INSERT INTO health.dpop_replays(key_thumbprint,proof_id_hash) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [jkt,createHash('sha256').update(payload.jti).digest('hex')]);
      if (result.rowCount!==1) throw Error('Proof replay');
    } catch { throw new UnauthorizedException('Invalid, missing or replayed DPoP proof'); }
  }
}

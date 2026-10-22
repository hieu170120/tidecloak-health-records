import { Injectable, ForbiddenException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PrincipalsService {
  constructor(private readonly audit:AuditService) {}
  async resolve(client:PoolClient,user:AuthenticatedUser) {
    const inserted = await client.query('INSERT INTO health.principals(tide_subject) VALUES($1) ON CONFLICT(tide_subject) DO NOTHING RETURNING id',[user.subject]);
    const principal = (await client.query('SELECT id,status FROM health.principals WHERE tide_subject=$1 FOR UPDATE',[user.subject])).rows[0];
    if (principal.status !== 'ACTIVE') throw new ForbiddenException('Principal is not active');
    if (inserted.rowCount) await this.audit.append(client,{actorId:principal.id,patientId:principal.id,resourceId:principal.id,
      resourceType:'PRINCIPAL',action:'IDENTITY_REGISTERED'});
    return {principalId:principal.id,subject:user.subject,status:principal.status,roles:user.roles};
  }
}

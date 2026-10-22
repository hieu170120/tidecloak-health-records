import { DpopService } from './dpop.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, JWTPayload, jwtVerify, JWTVerifyResult } from 'jose';
import { AuthenticatedUser, HealthRole } from './auth.types';

const HEALTH_ROLES: ReadonlySet<string> = new Set([
  'PATIENT',
  'DOCTOR',
  'EMERGENCY_DOCTOR',
  'AUDITOR',
]);

@Injectable()
export class TideCloakJwtService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly clientId: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly dpop:DpopService) {
    this.issuer = requiredEnvironment('TIDECLOAK_ISSUER_URL').replace(/\/$/, '');
    this.audience = requiredEnvironment('TIDECLOAK_AUDIENCE');
    this.clientId = requiredEnvironment('TIDECLOAK_CLIENT_ID');
    this.jwks = createRemoteJWKSet(
      new URL(process.env.TIDECLOAK_JWKS_URL ?? `${this.issuer}/protocol/openid-connect/certs`),
    );
  }

  async verify(token: string, request: {scheme:string;proof?:string;method:string;path:string}): Promise<AuthenticatedUser> {
    let verification: JWTVerifyResult;
    try {
      verification = await jwtVerify(token, this.jwks, {
        algorithms: ['RS256', 'ES256', 'EdDSA'],
        requiredClaims: ['sub','exp','iat'],
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const cnf=verification.payload.cnf as {jkt?:unknown} | undefined;
    if (cnf) {
      if (request.scheme!=='DPoP' || typeof cnf.jkt!=='string') throw new UnauthorizedException('A sender-constrained token requires DPoP');
      await this.dpop.verify(token,request.proof,cnf.jkt,request.method,request.path);
    } else if (request.scheme!=='Bearer') throw new UnauthorizedException('DPoP token binding is missing');
    return this.toAuthenticatedUser(verification.payload);
  }

  private toAuthenticatedUser(payload: JWTPayload): AuthenticatedUser {
    if (!payload.sub) {
      throw new UnauthorizedException('Access token has no subject');
    }

    const realmRoles = readRoles(payload.realm_access);
    const resourceRoles = readRoles(readResourceAccess(payload.resource_access, this.clientId));
    const roles = [...new Set([...realmRoles, ...resourceRoles])]
      .filter((role): role is HealthRole => HEALTH_ROLES.has(role));

    return {
      subject: payload.sub,
      vuid: typeof payload.vuid === 'string' ? payload.vuid : undefined,
      roles,
      tokenId: typeof payload.jti === 'string' ? payload.jti : undefined,
    };
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function readRoles(value: unknown): string[] {
  if (!isObject(value) || !Array.isArray(value.roles)) {
    return [];
  }
  return value.roles.filter((role): role is string => typeof role === 'string');
}

function readResourceAccess(value: unknown, clientId: string): unknown {
  if (!isObject(value)) {
    return undefined;
  }
  return value[clientId];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

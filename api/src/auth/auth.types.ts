export type HealthRole = 'PATIENT' | 'DOCTOR' | 'EMERGENCY_DOCTOR' | 'AUDITOR';

export interface AuthenticatedUser {
  subject: string;
  vuid?: string;
  roles: HealthRole[];
  tokenId?: string;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

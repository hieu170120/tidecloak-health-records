import { SetMetadata } from '@nestjs/common';
import { HealthRole } from './auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: HealthRole[]) => SetMetadata(ROLES_KEY, roles);

import { MeController } from './principals/me.controller';
import { PrincipalsService } from './principals/principals.service';
import { CapsulesService } from './capsules/capsules.service';
import { AuditService } from './audit/audit.service';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { TideCloakJwtGuard } from './auth/tidecloak-jwt.guard';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, MeController],
  providers: [
    HealthService, PrincipalsService, CapsulesService, AuditService,
    { provide: APP_GUARD, useClass: TideCloakJwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

import { DpopService } from './dpop.service';
import { Module } from '@nestjs/common';
import { TideCloakJwtService } from './tidecloak-jwt.service';

@Module({
  providers: [TideCloakJwtService, DpopService],
  exports: [TideCloakJwtService],
})
export class AuthModule {}

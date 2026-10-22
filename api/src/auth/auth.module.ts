import { Module } from '@nestjs/common';
import { TideCloakJwtService } from './tidecloak-jwt.service';

@Module({
  providers: [TideCloakJwtService],
  exports: [TideCloakJwtService],
})
export class AuthModule {}

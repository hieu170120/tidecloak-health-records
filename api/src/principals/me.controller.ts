import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { DatabaseService } from '../database/database.service';
import { PrincipalsService } from './principals.service';
import { CapsulesService } from '../capsules/capsules.service';
import { AuditService } from '../audit/audit.service';

@Controller('me')
export class MeController {
  constructor(private readonly db:DatabaseService,private readonly principals:PrincipalsService,
    private readonly capsules:CapsulesService,private readonly audit:AuditService) {}
  @Get()
  me(@CurrentUser() user:AuthenticatedUser) { return this.db.transaction(c=>this.principals.resolve(c,user)); }
  @Get('emergency-capsule') @Roles('PATIENT')
  read(@CurrentUser() user:AuthenticatedUser) { return this.capsules.read(user); }
  @Put('emergency-capsule') @Roles('PATIENT')
  save(@CurrentUser() user:AuthenticatedUser,@Body() body:unknown) { return this.capsules.save(user,body); }
  @Delete('emergency-capsule') @Roles('PATIENT')
  archive(@CurrentUser() user:AuthenticatedUser,@Body() body:unknown) { return this.capsules.save(user,body,true); }
  @Get('audit') @Roles('PATIENT')
  events(@CurrentUser() user:AuthenticatedUser) {
    return this.db.transaction(async c=>this.audit.ownEvents(c,(await this.principals.resolve(c,user)).principalId));
  }
}

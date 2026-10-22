import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';
import { TideCloakJwtService } from './tidecloak-jwt.service';

@Injectable()
export class TideCloakJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: TideCloakJwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const match=header?.match(/^(Bearer|DPoP) ([^\s]+)$/);
    if (!match) throw new UnauthorizedException('An access token is required');
    const proof=request.headers.dpop;
    if (Array.isArray(proof)) throw new UnauthorizedException('A single DPoP proof is required');
    request.user = await this.jwtService.verify(match[2], {
      scheme:match[1],proof,method:request.method,path:request.originalUrl,
    });
    return true;
  }
}

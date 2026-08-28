import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Token de acesso ausente');
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(authorization.slice(7));
      (request as AuthenticatedRequest).auth = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }
  }
}

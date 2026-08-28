import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './auth.types';
import { REQUIRED_MODULES_KEY } from './modules.decorator';

@Injectable()
export class ModulesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_MODULES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!required.every((module) => request.auth?.modules?.includes(module))) throw new ForbiddenException('Módulo não contratado');
    return true;
  }
}

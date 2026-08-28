import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ModulesGuard } from './modules.guard';

describe('ModulesGuard', () => {
  it('rejects access when a required SaaS module is absent', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['finance']) } as unknown as Reflector;
    const context = { getHandler: jest.fn(), getClass: jest.fn(), switchToHttp: () => ({ getRequest: () => ({ auth: { modules: ['core'] } }) }) };
    expect(() => new ModulesGuard(reflector).canActivate(context as never)).toThrow(ForbiddenException);
  });
});

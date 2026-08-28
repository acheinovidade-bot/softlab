import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function contextWith(permissions: string[]): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ auth: { permissions } }) }),
  } as never;
}

describe('PermissionsGuard', () => {
  it('allows endpoints without permission metadata', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(contextWith([]))).toBe(true);
  });

  it('requires every declared permission', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['products.read', 'products.cost.read']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(contextWith(['products.read', 'products.cost.read']))).toBe(true);
  });

  it('denies a partially authorized user', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['products.read', 'products.cost.read']) } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(contextWith(['products.read']))).toThrow(ForbiddenException);
  });
});

import type { Request } from 'express';

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  branchId: string;
  sessionId: string;
  permissions: string[];
  modules: string[];
}

export interface AuthenticatedRequest extends Request {
  auth: AccessTokenPayload;
}

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

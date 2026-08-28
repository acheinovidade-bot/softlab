import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('x-correlation-id');
  const correlationId = supplied?.slice(0, 128) || randomUUID();
  res.locals.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

import { ArgumentsHost, Catch, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@erp/contracts';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { uuidV7 } from './uuid-v7';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  constructor(private readonly prisma: PrismaService) {}
  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof ZodError ? HttpStatus.BAD_REQUEST : exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof ZodError ? 'Dados de entrada inválidos' : exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof raw === 'object' && raw && 'message' in raw
        ? String(raw.message)
        : typeof raw === 'string'
          ? raw
          : status === 500
            ? 'Erro interno do servidor'
            : 'Falha na requisição';
    const correlationId = (response.locals as Record<string, unknown>)['correlationId'];
    const body: ApiErrorResponse = {
      status,
      code: status === 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`,
      message,
      correlationId:
        typeof correlationId === 'string'
          ? correlationId
          : (request.header('x-correlation-id') ?? 'unknown'),
    };
    if (exception instanceof ZodError) body.details = exception.flatten();
    const auth = (request as Request & { auth?: { companyId?: string; branchId?: string; sub?: string } }).auth;
    try {
      const now = new Date();
      await this.prisma.applicationEventLog.create({ data: {
        id: uuidV7(), companyId: auth?.companyId ?? null, branchId: auth?.branchId ?? null,
        userId: auth?.sub ?? null, level: status >= 500 ? 'error' : 'warning',
        eventType: 'http.request.failed', message: body.message.slice(0, 1000),
        context: { method: request.method, path: request.path, status } as Prisma.InputJsonValue,
        errorStack: exception instanceof Error ? exception.stack ?? null : null,
        correlationId: body.correlationId, occurredAt: now, createdAt: now,
      } });
    } catch (loggingError) {
      this.logger.error('Falha ao persistir log de erro', loggingError instanceof Error ? loggingError.stack : undefined);
    }
    response.status(status).json(body);
  }
}

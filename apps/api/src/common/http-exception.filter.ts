import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@erp/contracts';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
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
    response.status(status).json(body);
  }
}

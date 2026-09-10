import { HttpException } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

describe('GlobalExceptionFilter', () => {
  it('persists the error event and returns its correlation id', async () => {
    const createLog = jest.fn<Promise<object>, [{ data: Record<string, unknown> }]>().mockResolvedValue({});
    const prisma = { applicationEventLog: { create: createLog } };
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const request = {
      method: 'POST', path: '/master/customers', header: jest.fn().mockReturnValue('corr-123'),
      auth: { companyId: '018f4f12-1111-7111-8111-000000000001', branchId: '018f4f12-1111-7111-8111-000000000002', sub: '018f4f12-1111-7111-8111-000000000003' },
    };
    const host = { switchToHttp: () => ({ getResponse: () => ({ locals: {}, status, json }), getRequest: () => request }) };
    const filter = new GlobalExceptionFilter(prisma as never);

    await filter.catch(new HttpException('Cliente inválido', 400), host as never);

    const logged = createLog.mock.calls[0]?.[0];
    expect(logged).toMatchObject({ data: {
      eventType: 'http.request.failed', level: 'warning', message: 'Cliente inválido', correlationId: 'corr-123',
    } });
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cliente inválido', correlationId: 'corr-123' }));
  });
});

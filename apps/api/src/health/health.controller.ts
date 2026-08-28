import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@erp/contracts';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';
import { Public } from '../auth/public.decorator';

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica a saúde da API e dependências' })
  @ApiOkResponse({ description: 'Todos os serviços estão disponíveis' })
  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.prisma.isHealthy(), this.redis.isHealthy()]);
    const result: HealthResponse = {
      status: database && redis ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database, redis },
    };
    if (result.status === 'degraded') throw new ServiceUnavailableException(result);
    return result;
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? '', {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (this.client.status === 'wait') await this.client.connect();
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (this.client.status === 'wait') await this.client.connect();
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSeconds);
    return count <= limit;
  }

  onModuleDestroy(): void {
    if (this.client.status !== 'end') this.client.disconnect();
  }
}

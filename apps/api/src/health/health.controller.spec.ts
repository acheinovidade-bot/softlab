import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok when both dependencies are healthy', async () => {
    const controller = new HealthController(
      { isHealthy: jest.fn().mockResolvedValue(true) } as never,
      { isHealthy: jest.fn().mockResolvedValue(true) } as never,
    );
    await expect(controller.check()).resolves.toMatchObject({ status: 'ok' });
  });

  it('fails when a dependency is unavailable', async () => {
    const controller = new HealthController(
      { isHealthy: jest.fn().mockResolvedValue(false) } as never,
      { isHealthy: jest.fn().mockResolvedValue(true) } as never,
    );
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

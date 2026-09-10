import { describe, expect, it } from 'vitest';
import { networkFailure, pendingSalesOperations, readSalesForceCache } from './offline-sales-force';

describe('offline sales force', () => {
  it('distinguishes a connection failure from a stock rejection', () => {
    expect(networkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(networkFailure(new Error('Estoque disponível insuficiente'))).toBe(false);
  });
  it('degrades safely when IndexedDB is unavailable', async () => {
    expect(await readSalesForceCache('company:branch:user', 'lookups')).toBeNull();
    expect(await pendingSalesOperations('company:branch:user')).toBe(0);
  });
});

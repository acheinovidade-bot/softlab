import { describe, expect, it } from 'vitest';
import { isNetworkFailure, pendingCheckoutCount, readPosLookups } from './offline-pos';
describe('offline POS', () => {
  it('recognizes network failures without classifying business errors as offline', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkFailure(new Error('Estoque insuficiente'))).toBe(false);
  });
  it('degrades safely when IndexedDB is unavailable', async () => {
    expect(await readPosLookups('tenant:branch')).toBeNull();
    expect(await pendingCheckoutCount('tenant:branch')).toBe(0);
  });
});

import { uuidV7 } from './uuid-v7';

describe('uuidV7', () => {
  it('creates a valid version 7 UUID with RFC variant', () => {
    const id = uuidV7(1_725_000_000_000);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('sorts chronologically by timestamp', () => {
    expect(uuidV7(2_000).localeCompare(uuidV7(1_000))).toBe(1);
  });
});

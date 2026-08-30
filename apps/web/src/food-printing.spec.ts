import { vi } from 'vitest';
import { printFoodSector, readSectorPrinters, saveSectorPrinters } from './food-printing';

describe('food printing manager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it('persists sector mappings and sends the job to the local Windows agent', async () => {
    saveSectorPrinters([{ sector: 'Cozinha', printer: 'TM-T20 Cozinha' }]);
    expect(readSectorPrinters()).toEqual([{ sector: 'Cozinha', printer: 'TM-T20 Cozinha' }]);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(
      printFoodSector({
        sector: 'Cozinha',
        tabNumber: 'M01-1',
        code: 'PAO-1',
        description: 'Pão de queijo',
        quantity: 2,
        notes: 'Bem assado',
      }),
    ).resolves.toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18181/print',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

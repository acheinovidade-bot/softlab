import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { DeliveryPanel } from './DeliveryPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('DeliveryPanel', () => {
  it('shows the kanban and opens driver selection before dispatch', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      deliveries: [
        {
          id: 'delivery-1',
          status: 'ready',
          orderNumber: 'PED-1042',
          customerName: 'Maria Silva',
          customerPhone: '85999990000',
          address: 'Rua Principal, 100 · Centro',
          driverId: null,
          driverName: null,
          fee: '8',
          distanceKm: '3.5',
          promisedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      drivers: [{ id: 'driver-1', name: 'João Entregador', phone: '85988880000' }],
      zones: [{ id: 'zone-1', name: 'Centro', calculationType: 'neighborhood', fee: '8' }],
      orders: [],
    } as never);

    render(<DeliveryPanel canOperate canManage={false} />);

    expect(screen.getByRole('heading', { name: 'Kanban de entregas' })).toBeInTheDocument();
    expect(await screen.findByText('PED-1042')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar entregador →' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /João Entregador/ })).toBeInTheDocument();
  });
});

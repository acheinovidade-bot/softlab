import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { WhatsappIntegrationPanel } from './WhatsappIntegrationPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));
describe('WhatsappIntegrationPanel', () => {
  it('shows the unofficial-provider warning and credential references', async () => {
    vi.mocked(apiRequest).mockImplementation(
      (path) =>
        Promise.resolve(
          path.endsWith('/messages') ? { items: [], total: 0, page: 1, pageSize: 100 } : null,
        ) as never,
    );
    render(<WhatsappIntegrationPanel canManage canSend />);
    expect(screen.getByText('Atenção operacional')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('WHATSAPP_GATEWAY_API_KEY_TENANT')).toBeInTheDocument();
    expect(screen.queryByLabelText(/token da meta/i)).not.toBeInTheDocument();
  });
});

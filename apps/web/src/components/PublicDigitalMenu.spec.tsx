import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { apiRequest } from '../api';
import { PublicDigitalMenu } from './PublicDigitalMenu';

vi.mock('../api', () => ({ apiRequest: vi.fn() }));

describe('PublicDigitalMenu', () => {
  it('adds a product and prepares the table order', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      restaurant: 'Bistrô Central',
      table: { code: 'M01', name: 'Mesa 1' },
      products: [
        {
          id: 'p1',
          code: 'CAF',
          name: 'Café especial',
          description: 'Grãos selecionados',
          price: '8.5',
          imageUrl: null,
        },
      ],
    } as never);
    render(<PublicDigitalMenu token="00000000-0000-4000-8000-000000000001" />);
    expect(await screen.findByRole('heading', { name: 'Bistrô Central' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Café especial' }));
    expect(screen.getByText('1 itens')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar pedido para a mesa' })).toBeInTheDocument();
  });
});

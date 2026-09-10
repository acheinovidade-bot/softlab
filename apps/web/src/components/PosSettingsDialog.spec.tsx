import { fireEvent, render, screen } from '@testing-library/react';
import { PosSettingsDialog } from './PosSettingsDialog';

describe('PosSettingsDialog', () => {
  beforeEach(() => localStorage.clear());

  it('keeps lot and expiry traceability disabled until the operator enables it', () => {
    render(<PosSettingsDialog onClose={() => undefined} />);
    const control = screen.getByRole('checkbox', { name: 'Controlar lote e validade no PDV' });
    expect(control).not.toBeChecked();
    fireEvent.click(control);
    fireEvent.click(screen.getByRole('button', { name: 'SALVAR' }));
    expect(JSON.parse(localStorage.getItem('softlab:pos-local-settings') ?? '{}')).toMatchObject({
      controlLotExpiry: true,
    });
  });

  it('changes the print margin with the controls inside the number field', () => {
    render(<PosSettingsDialog onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Impressão' }));
    const margin = screen.getByRole('spinbutton', { name: 'Margem esquerda' });
    expect(margin).toHaveValue(4);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar margem esquerda' }));
    expect(margin).toHaveValue(5);
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir margem esquerda' }));
    expect(margin).toHaveValue(4);
  });
});

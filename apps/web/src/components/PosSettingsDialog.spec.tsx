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
});

import { render, screen } from '@testing-library/react';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders all credentials required for tenant context', () => {
    render(<LoginPage onAuthenticated={() => Promise.resolve()} />);
    expect(screen.getByRole('heading', { name: 'Entrar no ERP' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Empresa')).toBeInTheDocument();
    expect(screen.getByLabelText('Filial')).toBeInTheDocument();
  });
});

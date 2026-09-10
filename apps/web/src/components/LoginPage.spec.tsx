import { render, screen } from '@testing-library/react';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders all credentials required for tenant context', () => {
    render(<LoginPage onAuthenticated={() => Promise.resolve()} />);
    expect(screen.getByRole('heading', { name: 'ACESSO AO SISTEMA' })).toBeInTheDocument();
    expect(screen.getByLabelText('USUÁRIO OU E-MAIL')).toBeInTheDocument();
    expect(screen.getByLabelText('SENHA')).toBeInTheDocument();
    expect(screen.getByLabelText('EMPRESA')).toBeInTheDocument();
    expect(screen.getByLabelText('FILIAL')).toBeInTheDocument();
  });
});

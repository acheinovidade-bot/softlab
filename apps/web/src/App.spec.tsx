import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('shows a loading indicator while restoring the secure session', () => {
    render(<App />);
    expect(screen.getByLabelText('Carregando')).toBeInTheDocument();
  });
});

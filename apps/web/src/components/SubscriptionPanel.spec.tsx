import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SubscriptionPanel } from './SubscriptionPanel';

vi.mock('../api', () => ({ apiRequest: vi.fn().mockResolvedValue({
  id: 'subscription', status: 'trial', trialEndsAt: '2026-09-09T00:00:00.000Z',
  currentPeriodStart: '2026-08-26T00:00:00.000Z', currentPeriodEnd: '2026-09-09T00:00:00.000Z', blockedAt: null,
  plan: { code: 'starter', name: 'Starter', price: '0', billingPeriod: 'monthly' },
  usage: { users: { used: 1, limit: 5 }, branches: { used: 1, limit: 2 } },
  modules: [{ code: 'core', name: 'Núcleo administrativo' }],
}) }));

describe('SubscriptionPanel', () => {
  it('shows plan consumption and enabled modules', async () => {
    render(<SubscriptionPanel />);
    expect(await screen.findByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('1 de 5')).toBeInTheDocument();
    expect(screen.getByText('Núcleo administrativo')).toBeInTheDocument();
  });
});

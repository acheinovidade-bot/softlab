import { cashMovementSchema, closeCashSchema, openCashSchema } from './cash.schemas';

const id = (suffix: string) => `018f4f12-2222-7222-8222-${suffix.padStart(12, '0')}`;
describe('cash schemas', () => {
  it('normalizes opening and movement amounts', () => {
    expect(
      openCashSchema.parse({ registerId: id('1'), openingAmount: '100.50' }).openingAmount,
    ).toBe(100.5);
    expect(
      cashMovementSchema.parse({ type: 'withdrawal', amount: '20', description: 'Troco retirado' })
        .type,
    ).toBe('withdrawal');
  });
  it('rejects duplicate closing methods', () => {
    const row = { paymentMethodId: id('2'), countedAmount: 10 };
    expect(() => closeCashSchema.parse({ counts: [row, row] })).toThrow(
      'Forma de pagamento repetida',
    );
  });
});

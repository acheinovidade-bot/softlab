import {
  cardOperatorSchema,
  cashPeriodQuerySchema,
  cashMovementSchema,
  closeCashSchema,
  openCashSchema,
  paymentMethodSchema,
} from './cash.schemas';

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
  it('normalizes card operators and payment finalizers', () => {
    expect(
      cardOperatorSchema.parse({
        code: ' rede ',
        name: 'Rede',
        taxId: '01.027.058/0001-91',
        debitRate: '1.49',
        creditRate: '2.89',
      }),
    ).toMatchObject({ code: 'REDE', taxId: '01027058000191', debitRate: 1.49 });
    expect(
      paymentMethodSchema.parse({
        code: 'credito',
        name: 'Cartão de crédito',
        type: 'credit_card',
        maxInstallments: '12',
      }),
    ).toMatchObject({ code: 'CREDITO', maxInstallments: 12, fiscalCode: '99' });
  });
  it('accepts bounded cash periods and rejects unsafe ranges', () => {
    expect(
      cashPeriodQuerySchema.parse({ from: '2026-08-01', to: '2026-08-29' }).from,
    ).toBeInstanceOf(Date);
    expect(() => cashPeriodQuerySchema.parse({ from: '2026-08-30', to: '2026-08-01' })).toThrow(
      'Período inválido',
    );
    expect(() => cashPeriodQuerySchema.parse({ from: '2026-01-01', to: '2026-08-29' })).toThrow(
      'Período máximo de 93 dias',
    );
  });
});

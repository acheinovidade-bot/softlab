import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales force stock reservation', () => {
  it('converts approved quotes inside a serializable reservation transaction', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/sales/sales.service.ts'), 'utf8');
    const conversion = source.slice(
      source.indexOf('async convertQuote'),
      source.indexOf('async listOrders'),
    );
    expect(conversion).toContain('await this.serializable');
    expect(conversion).toContain("status: 'separation'");
    expect(conversion).toContain('reservedQuantity: { increment: quantity }');
    expect(conversion).toContain('Estoque disponível insuficiente');
  });
});

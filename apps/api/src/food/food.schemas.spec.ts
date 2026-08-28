import { openTabSchema, publicMenuOrderSchema } from './food.schemas';
const id = '018f4f12-2222-7222-8222-000000000001';
describe('food schemas', () => {
  it('requires a table for table service and supports all native channels', () => {
    expect(() => openTabSchema.parse({ channel: 'table' })).toThrow('Informe a mesa');
    expect(openTabSchema.parse({ channel: 'table', tableId: id }).channel).toBe('table');
    expect(openTabSchema.parse({ channel: 'kiosk' }).tableId).toBeNull();
  });
  it('validates an order sent through the table QR Code', () => {
    expect(
      publicMenuOrderSchema.parse({ guestName: 'Ana', items: [{ productId: id, quantity: 2 }] })
        .items[0]?.quantity,
    ).toBe(2);
    expect(() => publicMenuOrderSchema.parse({ guestName: 'A', items: [] })).toThrow();
  });
});

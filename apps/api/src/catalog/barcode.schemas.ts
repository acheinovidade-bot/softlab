import { z } from 'zod';

function validGtin(value: string): boolean {
  const digits = [...value].map(Number); const check = digits.pop();
  let sum = 0; for (let index = digits.length - 1, position = 0; index >= 0; index -= 1, position += 1) sum += (digits[index] ?? 0) * (position % 2 === 0 ? 3 : 1);
  return check === (10 - (sum % 10)) % 10;
}
export const barcodeSchema = z.string().regex(/^(?:\d{8}|\d{12,14})$/).refine(validGtin, 'Código de barras inválido');

import { importListSchema, xmlMappingSchema, xmlPreviewSchema } from './xml-import.schemas';

describe('purchase XML schemas', () => {
  it('limits XML size and validates mapping identifiers', () => {
    expect(xmlPreviewSchema.parse({ xml: 'x'.repeat(50) }).xml).toHaveLength(50);
    expect(() => xmlPreviewSchema.parse({ xml: 'short' })).toThrow();
    expect(() => xmlPreviewSchema.parse({ xml: 'x'.repeat(2_000_001) })).toThrow();
    expect(() => xmlMappingSchema.parse({ productId: 'not-a-uuid' })).toThrow();
  });
  it('bounds list pagination', () => {
    expect(importListSchema.parse({}).pageSize).toBe(20);
    expect(() => importListSchema.parse({ pageSize: 101 })).toThrow();
  });
});

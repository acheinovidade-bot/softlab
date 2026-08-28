import { calculateSuggestionSchema, suggestionListSchema } from './purchase-suggestion.schemas';

describe('purchase suggestion schemas', () => {
  it('accepts standard and custom forecast windows', () => {
    expect(calculateSuggestionSchema.parse({ forecastDays: 7 }).forecastDays).toBe(7);
    expect(calculateSuggestionSchema.parse({ forecastDays: 75, historyDays: 180 })).toEqual({
      forecastDays: 75,
      historyDays: 180,
    });
  });

  it('rejects unsafe calculation and pagination ranges', () => {
    expect(() => calculateSuggestionSchema.parse({ forecastDays: 0 })).toThrow();
    expect(() => calculateSuggestionSchema.parse({ forecastDays: 181 })).toThrow();
    expect(() => calculateSuggestionSchema.parse({ forecastDays: 30, historyDays: 20 })).toThrow();
    expect(() => suggestionListSchema.parse({ pageSize: 101 })).toThrow();
  });
});

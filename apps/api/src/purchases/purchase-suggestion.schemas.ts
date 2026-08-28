import { z } from 'zod';

export const calculateSuggestionSchema = z.object({
  forecastDays: z.coerce.number().int().min(1).max(180),
  historyDays: z.coerce.number().int().min(30).max(730).default(90),
});

export const suggestionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

globalThis.fetch = vi.fn(() => new Promise(() => undefined)) as typeof fetch;

import type { HttpRequest } from '@azure/functions';

const DEFAULT_LOOKBACK_DAYS = 30;
const utcToday = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const parseDate = (value: string | null, fallback: Date): Date => {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Dates must use YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date.');
  return date;
};

export const queryWindow = (request: HttpRequest) => {
  const to = parseDate(request.query.get('to'), utcToday());
  const defaultFrom = new Date(to); defaultFrom.setUTCDate(defaultFrom.getUTCDate() - DEFAULT_LOOKBACK_DAYS);
  const from = parseDate(request.query.get('from'), defaultFrom);
  if (to < from) throw new Error('The to date must be on or after from.');
  if ((to.getTime() - from.getTime()) / 86_400_000 > 366) throw new Error('The requested date range cannot exceed 366 days.');
  const exclusiveTo = new Date(to); exclusiveTo.setUTCDate(exclusiveTo.getUTCDate() + 1);
  return { from, to, exclusiveTo };
};

export const queryLimit = (request: HttpRequest, fallback = 5000): number => {
  const requested = Number.parseInt(request.query.get('limit') || String(fallback), 10);
  return Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 20_000) : fallback;
};

export const DEFAULT_MARKET_LOOKBACK_DAYS = 30;

export const localIsoDate = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const rollingDateRange = (
  today = localIsoDate(),
  lookbackDays = DEFAULT_MARKET_LOOKBACK_DAYS,
) => {
  const to = new Date(`${today}T00:00:00Z`);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - lookbackDays);
  return { from: from.toISOString().slice(0, 10), to: today };
};

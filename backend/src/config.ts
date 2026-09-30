const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
};

const integer = (name: string, fallback: number, minimum: number, maximum: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
};

export const getSqlServer = () => required('AZURE_SQL_SERVER');
export const getSqlDatabase = () => required('AZURE_SQL_DATABASE');
export const getSqlManagedIdentityClientId = () => required('AZURE_SQL_MANAGED_IDENTITY_CLIENT_ID');

const normalizedUrl = (value: string | undefined): string => (value || '').trim().replace(/\/$/, '');
const emailList = (value: string | undefined): string[] => (value || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const getRuntimeConfig = () => ({
  allowedOrigin: process.env.MARKET_API_ALLOWED_ORIGIN?.trim() || '*',
  overlapDays: integer('DLD_SYNC_OVERLAP_DAYS', 3, 1, 14),
  maximumCsvBytes: integer('DLD_MAX_CSV_BYTES', 100_000_000, 1_000_000, 250_000_000),
  maximumRows: integer('DLD_MAX_ROWS', 250_000, 1_000, 1_000_000),
  requestTimeoutMs: integer('DLD_REQUEST_TIMEOUT_MS', 180_000, 10_000, 300_000),
  manualSyncCooldownMinutes: integer('DLD_MANUAL_SYNC_COOLDOWN_MINUTES', 30, 1, 1440),
  supabaseUrl: normalizedUrl(process.env.SUPABASE_URL),
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || '',
  reviewerEmails: emailList(process.env.MARKET_REVIEWER_EMAILS),
});

# Dubai Market Lens backend

This Azure Functions application refreshes the dashboard's DLD transactions, projects, and valuations into Azure SQL and serves read-only APIs to the React portal.

## Runtime design

- `scheduledMarketDataSync` runs every Monday and Thursday at **02:15 UTC / 06:15 Dubai** using `0 15 2 * * 1,4`.
- Each run makes exactly three DLD requests: one per dataset. There are no automatic source retries.
- Transactions use a three-day overlap from the latest observed transaction. Projects and valuations refresh a trailing 366-day snapshot.
- SQL application locks prevent overlapping writes. Each dataset commits independently and retains its last successful snapshot if another feed fails.
- The Function App authenticates to Azure SQL with its user-assigned managed identity. No database password is stored in application settings.
- A function-key-protected recovery endpoint enforces a per-dataset 30-minute cooldown.

## API

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Checks Azure SQL connectivity. |
| `GET` | `/api/market-data/status` | Public | Returns counts and latest sync metadata for all datasets. |
| `GET` | `/api/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=5000&cursor=...` | Public | Current transaction observations. |
| `GET` | `/api/projects` | Public | Current project registry fields used by the portal. |
| `GET` | `/api/valuations?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=5000&cursor=...` | Public | Current valuation observations. |
| `POST` | `/api/operations/market-data/sync` | Function key | Runs a guarded three-feed recovery sync. |
| `POST` | `/api/operations/transactions/review` | Supabase reviewer | Marks a transaction number as liked, disliked, or restored. |

Transaction and valuation queries default to the rolling 30-day period ending today. Pages are limited to 20,000 rows and callers may explicitly request up to a 366-day date range.

## Transaction reviewer authentication

The portal uses Supabase Auth for Google sign-in. Azure SQL remains the market-data source of truth; Supabase is only the identity provider.

1. Create or select a Supabase project and enable the Google provider under Authentication.
2. In Google Auth Platform, add the portal origin and the Supabase callback URL shown by the provider settings.
3. Add the portal production URL and local development URL to the Supabase redirect allow list.
4. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vite/Vercel environment.
5. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the Azure Function App.
6. Authorize reviewers by setting `app_metadata.role` to `reviewer` or `admin`. `MARKET_REVIEWER_EMAILS` is available as a comma-separated bootstrap allow-list.

Never expose a Supabase secret/service-role key in the portal or Function App settings for this flow. The API validates each bearer token with Supabase Auth and performs its own reviewer authorization. Dislikes are stored as review state plus an immutable audit event; source observations are never deleted.

## Database setup

Provision Azure first, temporarily allow the migration workstation's public IP on the SQL firewall, then run:

```powershell
npm run db:migrate
npm run db:seed
```

The migration creates `market_api` and `market_ingest_writer` database roles, then adds the Function App's managed identity to both roles. The seed imports the existing bundled snapshots without calling DLD. Remove the temporary workstation firewall rule immediately afterward.

## Verification

Run `npm test` and `npm run build`, deploy with `azd deploy api`, and verify health, CORS, every public dataset route, the protected manual sync, and the twice-weekly timer configuration. Parser tests use local fixtures and never call DLD.

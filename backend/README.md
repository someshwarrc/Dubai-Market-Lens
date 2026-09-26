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

Transaction and valuation pages are limited to 20,000 rows and a 366-day date range.

## Database setup

Provision Azure first, temporarily allow the migration workstation's public IP on the SQL firewall, then run:

```powershell
npm run db:migrate
npm run db:seed
```

The migration creates `market_api` and `market_ingest_writer` database roles, then adds the Function App's managed identity to both roles. The seed imports the existing bundled snapshots without calling DLD. Remove the temporary workstation firewall rule immediately afterward.

## Verification

Run `npm test` and `npm run build`, deploy with `azd deploy api`, and verify health, CORS, every public dataset route, the protected manual sync, and the twice-weekly timer configuration. Parser tests use local fixtures and never call DLD.

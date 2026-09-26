import { app } from '@azure/functions';
import { scheduledSyncHandler } from '../sync/syncTransactions.js';

app.timer('scheduledMarketDataSync', {
  schedule: '%DLD_SYNC_SCHEDULE%',
  runOnStartup: false,
  useMonitor: true,
  handler: scheduledSyncHandler,
});

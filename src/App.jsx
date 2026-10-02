import { MeasurementUnitProvider } from './hooks/useMeasurementUnit';
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  CssBaseline,
  LinearProgress,
  Paper,
  Snackbar,
  Skeleton,
  Stack,
  ThemeProvider,
  Typography,
} from '@mui/material';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DataUsageRoundedIcon from '@mui/icons-material/DataUsageRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import AppShell from './components/layout/AppShell';
import KpiStrip from './components/kpis/KpiStrip';
import SectionHeader from './components/common/SectionHeader';
import MonthlyPriceChart from './components/charts/MonthlyPriceChart';
import AreaOpportunityChart from './components/charts/AreaOpportunityChart';
import PropertyTypeChart from './components/charts/PropertyTypeChart';
import ActivityChart from './components/charts/ActivityChart';
import TransactionDataGrid from './components/tables/TransactionDataGrid';
import ValuationDataGrid from './components/tables/ValuationDataGrid';
import TransactionReviewAccess from './components/auth/TransactionReviewAccess';
import ValuationOpportunityDialog from './components/opportunities/ValuationOpportunityDialog';
import { useMarketData } from './hooks/useMarketData';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import { useTransactionFavorites } from './hooks/useTransactionFavorites';
import { createAppTheme } from './theme/createAppTheme';
import {
  buildAreaOpportunities,
  buildFilterOptions,
  buildMonthlyTrend,
  buildPropertyTypeComparison,
  calculateOpportunities,
  createDefaultFilters,
  filterTransactions,
  filterValuations,
  summarizeMarket,
} from './utils/marketAnalytics';
import { formatNumber } from './utils/formatters';

const TrendDiscovery = lazy(() => import('./components/trends/TrendDiscovery'));

const viewMeta = {
  opportunities: {
    title: 'Opportunity radar',
    description: 'Compare transaction price trends across areas, developers, projects, and property types, then inspect the evidence behind each result.',
  },
  overview: {
    title: 'Dubai market overview',
    description: 'Track transaction activity, valuation levels, and unit-price movement across the filtered market.',
  },
  transactions: {
    title: 'Transaction explorer',
    description: 'Inspect the underlying sales, mortgages, and gifts with complete transaction-specific filters.',
  },
  valuations: {
    title: 'Valuation explorer',
    description: 'Review the valuation evidence used to build local and Dubai-wide unit-price benchmarks.',
  },
};

function LoadingDashboard() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ height: 64, bgcolor: '#181d26' }} />
      <LinearProgress color="secondary" />
      <Box sx={{ maxWidth: 1480, mx: 'auto', px: { xs: 2, md: 4 }, py: 5 }}>
        <Stack spacing={3}>
          <Box>
            <Skeleton variant="text" width={320} height={48} />
            <Skeleton variant="text" width="min(680px, 90%)" />
          </Box>
          <Skeleton variant="rounded" height={150} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Skeleton variant="rounded" height={360} />
            <Skeleton variant="rounded" height={360} />
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading and indexing live market data in your browser…</Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

function PageIntro({ activeView, transactions, valuationCount }) {
  const meta = viewMeta[activeView];
  const dates = transactions.map((row) => row.date).filter(Boolean).sort();
  const dateLabel = dates.length ? `${dates[0]} – ${dates.at(-1)}` : 'No transaction dates';
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' } }}>
      <Box>
        <Typography component="h1" variant="h1">{meta.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 780 }}>{meta.description}</Typography>
      </Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip icon={<CalendarMonthRoundedIcon />} label={dateLabel} variant="outlined" />
        <Chip icon={<ApartmentRoundedIcon />} label={`${formatNumber(transactions.length)} transactions`} variant="outlined" />
        <Chip icon={<DataUsageRoundedIcon />} label={`${formatNumber(valuationCount)} valuations`} variant="outlined" />
      </Stack>
    </Stack>
  );
}

function OpportunityView({ transactions, areaLocations, transactionActions }) {
  return (
    <Stack spacing={4}>
      <Suspense fallback={<Skeleton variant="rounded" height={720} />}>
        <TrendDiscovery transactions={transactions} areaLocations={areaLocations} {...transactionActions} />
      </Suspense>
    </Stack>
  );
}

function OverviewView({
  summary,
  monthlyTrend,
  propertyComparison,
  areaOpportunities,
  opportunities,
  valuations,
  transactionActions,
}) {
  const [dialog, setDialog] = useState({ open: false, areaKey: null });
  return (
    <>
      <Stack spacing={4}>
        <KpiStrip summary={summary} onOpenOpportunities={() => setDialog({ open: true, areaKey: null })} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 3 }}>
          <ActivityChart data={monthlyTrend} />
          <MonthlyPriceChart data={monthlyTrend} />
          <PropertyTypeChart data={propertyComparison} />
          <AreaOpportunityChart data={areaOpportunities} onSelectArea={(areaKey) => setDialog({ open: true, areaKey })} />
        </Box>
      </Stack>
      <ValuationOpportunityDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, areaKey: null })}
        initialAreaKey={dialog.areaKey}
        opportunities={opportunities}
        valuations={valuations}
        {...transactionActions}
      />
    </>
  );
}

function AppContent() {
  const [mode, setMode] = useState(() => localStorage.getItem('market-lens-theme') || 'light');
  const [activeView, setActiveView] = useState('opportunities');
  const [filters, setFilters] = useState(createDefaultFilters);
  const filtersInitialized = useRef(false);
  const deferredFilters = useDeferredValue(filters);
  const { data, loading, error, reviewTransaction } = useMarketData();
  const auth = useSupabaseAuth();
  const favorites = useTransactionFavorites(auth.accessToken);
  const [pendingTransactionNumber, setPendingTransactionNumber] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [notice, setNotice] = useState(null);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    if (!data || filtersInitialized.current) return;
    filtersInitialized.current = true;
    setFilters(createDefaultFilters(data.transactions));
  }, [data]);

  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    localStorage.setItem('market-lens-theme', next);
    setMode(next);
  };

  const showError = useCallback((errorValue) => {
    setNotice({ severity: 'error', message: errorValue?.message || 'The request could not be completed.' });
  }, []);

  const handleReview = useCallback(async (row, decision) => {
    setPendingTransactionNumber(row.transactionNumber);
    try {
      const result = await reviewTransaction({
        transactionNumber: row.transactionNumber,
        decision,
        accessToken: auth.accessToken,
      });
      if (decision === 'disliked') {
        setNotice({
          severity: 'success',
          message: `Transaction ${row.transactionNumber} was hidden from all dashboards.`,
          undo: {
            transactionNumber: row.transactionNumber,
            decision: result.previousDecision || 'neutral',
            restoreRows: result.removedRows,
          },
        });
      } else {
        setNotice({ severity: 'success', message: `Transaction ${row.transactionNumber} was marked as trusted.` });
      }
    } catch (reviewError) {
      showError(reviewError);
    } finally {
      setPendingTransactionNumber('');
    }
  }, [auth.accessToken, reviewTransaction, showError]);

  const handleFavorite = useCallback(async (row, favorite) => {
    try {
      await favorites.setFavorite(row.transactionNumber, favorite);
      setNotice({
        severity: 'success',
        message: favorite
          ? `Transaction ${row.transactionNumber} was saved to your purchase evidence.`
          : `Transaction ${row.transactionNumber} was removed from your saved evidence.`,
      });
    } catch (favoriteError) {
      showError(favoriteError);
    }
  }, [favorites.setFavorite, showError]);

  const undoReview = useCallback(async () => {
    const undo = notice?.undo;
    if (!undo) return;
    setPendingTransactionNumber(undo.transactionNumber);
    try {
      await reviewTransaction({ ...undo, accessToken: auth.accessToken });
      setNotice({ severity: 'success', message: `Transaction ${undo.transactionNumber} was restored.` });
    } catch (reviewError) {
      showError(reviewError);
    } finally {
      setPendingTransactionNumber('');
    }
  }, [auth.accessToken, notice, reviewTransaction, showError]);

  const analytics = useMemo(() => {
    if (!data) return null;
    const transactions = filterTransactions(data.transactions, deferredFilters);
    const valuations = filterValuations(data.valuations, deferredFilters);
    const opportunityResult = calculateOpportunities(transactions, valuations);
    return {
      transactions,
      valuations,
      opportunities: opportunityResult.rows,
      summary: summarizeMarket(transactions, valuations, opportunityResult),
      monthlyTrend: buildMonthlyTrend(transactions, valuations),
      areaOpportunities: buildAreaOpportunities(opportunityResult.rows),
      propertyComparison: buildPropertyTypeComparison(transactions, valuations),
    };
  }, [data, deferredFilters]);

  const options = useMemo(() => data ? buildFilterOptions(data.transactions, data.valuations) : null, [data]);
  const canFavorite = Boolean(auth.user && auth.accessToken);
  const transactionActions = {
    canFavorite,
    canReview: favorites.canReview,
    favoriteTransactionNumbers: favorites.transactionNumbers,
    pendingFavoriteTransactionNumber: favorites.pendingTransactionNumber,
    pendingTransactionNumber,
    onFavorite: handleFavorite,
    onReview: handleReview,
  };
  const transactionRows = showFavoritesOnly
    ? analytics?.transactions.filter((row) => favorites.transactionNumbers.has(row.transactionNumber)) ?? []
    : analytics?.transactions ?? [];

  useEffect(() => {
    if (!canFavorite) setShowFavoritesOnly(false);
  }, [canFavorite]);

  if (loading) return <ThemeProvider theme={theme}><CssBaseline /><LoadingDashboard /></ThemeProvider>;

  if (error || !data || !analytics || !options) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
          <Paper variant="outlined" sx={{ p: 4, maxWidth: 620 }}>
            <Typography variant="h2">The market files could not be loaded</Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5 }}>
              Run the portal through the Vite development or preview server so the bundled CSV files are available. {error?.message}
            </Typography>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell
        mode={mode}
        onToggleMode={toggleMode}
        activeView={activeView}
        onViewChange={setActiveView}
        filters={filters}
        options={options}
        onFiltersChange={setFilters}
        onResetFilters={() => setFilters(createDefaultFilters(data.transactions))}
      >
        <Box sx={{ maxWidth: 1640, mx: 'auto', px: { xs: 2, md: 3.5, xl: 4 }, py: { xs: 3, md: 4 } }}>
          <Stack spacing={4}>
            {data.transactionSource?.fallbackReason && (
              <Alert severity="warning" variant="outlined">
                Live transaction updates are temporarily unavailable. {data.transactionSource.type === 'api-cache'
                  ? `Showing the API snapshot saved ${data.transactionSource.cachedAt || 'in this browser'}. `
                  : 'Showing the bundled rollout dataset. '}
                {data.transactionSource.fallbackReason}
              </Alert>
            )}
            <PageIntro activeView={activeView} transactions={analytics.transactions} valuationCount={analytics.valuations.length} />
            {activeView === 'opportunities' && (
              <OpportunityView
                transactions={analytics.transactions}
                areaLocations={data.areaLocations}
                transactionActions={transactionActions}
              />
            )}
            {activeView === 'overview' && (
              <OverviewView
                summary={analytics.summary}
                monthlyTrend={analytics.monthlyTrend}
                propertyComparison={analytics.propertyComparison}
                areaOpportunities={analytics.areaOpportunities}
                opportunities={analytics.opportunities}
                valuations={analytics.valuations}
                transactionActions={transactionActions}
              />
            )}
            {activeView === 'transactions' && (
              <Stack spacing={2}>
                <SectionHeader
                  title="Filtered transaction records"
                  description={`${formatNumber(transactionRows.length)} asset-level records${showFavoritesOnly ? ' in your saved evidence' : ''}. Repeated transaction numbers indicate multi-asset procedures.`}
                  action={(
                    <Button
                      variant={showFavoritesOnly ? 'contained' : 'outlined'}
                      startIcon={<StarRoundedIcon />}
                      disabled={!canFavorite}
                      onClick={() => setShowFavoritesOnly((current) => !current)}
                      sx={{ minHeight: 44 }}
                    >
                      Saved only ({formatNumber(favorites.transactionNumbers.size)})
                    </Button>
                  )}
                />
                <TransactionReviewAccess auth={auth} canReview={favorites.canReview} onError={showError} />
                <TransactionDataGrid
                  rows={transactionRows}
                  {...transactionActions}
                />
              </Stack>
            )}
            {activeView === 'valuations' && (
              <Stack spacing={2}>
                <SectionHeader title="Filtered valuation evidence" description={`${formatNumber(analytics.valuations.length)} records. Nominal values remain visible here but are excluded from benchmark calculations.`} />
                <ValuationDataGrid rows={analytics.valuations} />
              </Stack>
            )}
          </Stack>
        </Box>
      </AppShell>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={notice?.undo ? 10_000 : 6_000}
        onClose={(_, reason) => reason !== 'clickaway' && setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notice?.severity || 'info'}
          variant="filled"
          onClose={() => setNotice(null)}
          action={notice?.undo ? <Button color="inherit" onClick={undoReview}>Undo</Button> : undefined}
          sx={{ width: '100%' }}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default function App() {
  return <MeasurementUnitProvider><AppContent /></MeasurementUnitProvider>;
}

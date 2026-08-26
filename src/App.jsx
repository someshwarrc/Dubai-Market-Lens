import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  CssBaseline,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  ThemeProvider,
  Typography,
} from '@mui/material';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DataUsageRoundedIcon from '@mui/icons-material/DataUsageRounded';
import AppShell from './components/layout/AppShell';
import KpiStrip from './components/kpis/KpiStrip';
import SectionHeader from './components/common/SectionHeader';
import MonthlyPriceChart from './components/charts/MonthlyPriceChart';
import AreaOpportunityChart from './components/charts/AreaOpportunityChart';
import PropertyTypeChart from './components/charts/PropertyTypeChart';
import ActivityChart from './components/charts/ActivityChart';
import OpportunityDataGrid from './components/tables/OpportunityDataGrid';
import TransactionDataGrid from './components/tables/TransactionDataGrid';
import ValuationDataGrid from './components/tables/ValuationDataGrid';
import { useMarketData } from './hooks/useMarketData';
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
    description: 'Compare independent transaction price trends with valuation-backed opportunity signals, then inspect the evidence behind each result.',
  },
  overview: {
    title: 'Dubai market overview',
    description: 'Track transaction activity, valuation levels, and price-per-square-metre movement across the filtered market.',
  },
  transactions: {
    title: 'Transaction explorer',
    description: 'Inspect the underlying sales, mortgages, and gifts with complete transaction-specific filters.',
  },
  valuations: {
    title: 'Valuation explorer',
    description: 'Review the valuation evidence used to build local and Dubai-wide price-per-square-metre benchmarks.',
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
            <Typography variant="body2" color="text.secondary">Loading and indexing 144,000+ market records in your browser…</Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

function PageIntro({ activeView, transactionCount, valuationCount }) {
  const meta = viewMeta[activeView];
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' } }}>
      <Box>
        <Typography component="h1" variant="h1">{meta.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 780 }}>{meta.description}</Typography>
      </Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip icon={<CalendarMonthRoundedIcon />} label="Jan–Aug 2026" variant="outlined" />
        <Chip icon={<ApartmentRoundedIcon />} label={`${formatNumber(transactionCount)} transactions`} variant="outlined" />
        <Chip icon={<DataUsageRoundedIcon />} label={`${formatNumber(valuationCount)} valuations`} variant="outlined" />
      </Stack>
    </Stack>
  );
}

function OpportunityView({ summary, opportunities, areaOpportunities, monthlyTrend, transactions, areaLocations }) {
  const positiveRows = useMemo(() => opportunities.filter((row) => row.discountPct > 0), [opportunities]);
  return (
    <Stack spacing={6}>
      <Suspense fallback={<Skeleton variant="rounded" height={720} />}>
        <TrendDiscovery transactions={transactions} opportunities={opportunities} areaLocations={areaLocations} />
      </Suspense>

      <Stack component="section" spacing={4} sx={{ pt: 5, borderTop: 1, borderColor: 'divider' }}>
        <SectionHeader
          title="Valuation opportunity index"
          description="The original transaction-level index remains unchanged. It compares recorded sale AED/m² with valuation cohorts and exposes the benchmark basis, sample size, and confidence."
        />
        <KpiStrip summary={summary} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.12fr) minmax(420px, .88fr)' }, gap: 3, alignItems: 'start' }}>
          <AreaOpportunityChart data={areaOpportunities} />
          <MonthlyPriceChart data={monthlyTrend} />
        </Box>
        <Stack spacing={2}>
          <SectionHeader
            title="Ranked valuation opportunities"
            description={`${formatNumber(positiveRows.length)} single-asset sales have a matched valuation benchmark and a positive price gap. Signal strength combines the gap, cohort quality, and cohort size.`}
            action={<Chip label="Sorted by signal strength" color="success" variant="outlined" />}
          />
          {positiveRows.length ? (
            <OpportunityDataGrid rows={positiveRows} />
          ) : (
            <Alert severity="info">No positively discounted, valuation-matched sales meet the current filters. Broaden the market segment or date range.</Alert>
          )}
        </Stack>
        <Alert severity="warning" variant="outlined">
          Opportunity gaps are indicative comparisons, not professional appraisals. Multi-asset transaction bundles, nominal valuations below AED 1,000, and records without usable area are excluded from opportunity scoring.
        </Alert>
      </Stack>
    </Stack>
  );
}

function OverviewView({ summary, monthlyTrend, propertyComparison, areaOpportunities }) {
  return (
    <Stack spacing={4}>
      <KpiStrip summary={summary} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 3 }}>
        <ActivityChart data={monthlyTrend} />
        <MonthlyPriceChart data={monthlyTrend} />
        <PropertyTypeChart data={propertyComparison} />
        <AreaOpportunityChart data={areaOpportunities} />
      </Box>
    </Stack>
  );
}

function AppContent() {
  const [mode, setMode] = useState(() => localStorage.getItem('market-lens-theme') || 'light');
  const [activeView, setActiveView] = useState('opportunities');
  const [filters, setFilters] = useState(createDefaultFilters);
  const deferredFilters = useDeferredValue(filters);
  const { data, loading, error } = useMarketData();
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    localStorage.setItem('market-lens-theme', next);
    setMode(next);
  };

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
        onResetFilters={() => setFilters(createDefaultFilters())}
      >
        <Box sx={{ maxWidth: 1640, mx: 'auto', px: { xs: 2, md: 3.5, xl: 4 }, py: { xs: 3, md: 4 } }}>
          <Stack spacing={4}>
            <PageIntro activeView={activeView} transactionCount={analytics.transactions.length} valuationCount={analytics.valuations.length} />
            {activeView === 'opportunities' && (
              <OpportunityView
                summary={analytics.summary}
                opportunities={analytics.opportunities}
                areaOpportunities={analytics.areaOpportunities}
                monthlyTrend={analytics.monthlyTrend}
                transactions={analytics.transactions}
                areaLocations={data.areaLocations}
              />
            )}
            {activeView === 'overview' && (
              <OverviewView
                summary={analytics.summary}
                monthlyTrend={analytics.monthlyTrend}
                propertyComparison={analytics.propertyComparison}
                areaOpportunities={analytics.areaOpportunities}
              />
            )}
            {activeView === 'transactions' && (
              <Stack spacing={2}>
                <SectionHeader title="Filtered transaction records" description={`${formatNumber(analytics.transactions.length)} asset-level records. Repeated transaction numbers indicate multi-asset procedures.`} />
                <TransactionDataGrid rows={analytics.transactions} />
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
    </ThemeProvider>
  );
}

export default function App() {
  return <AppContent />;
}

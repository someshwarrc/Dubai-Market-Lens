import { useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SectionHeader from '../common/SectionHeader';
import TrendDataGrid from './TrendDataGrid';
import TrendHistoryChart from './TrendHistoryChart';
import TrendMap from './TrendMap';
import TrendTransactionsDialog from './TrendTransactionsDialog';
import {
  buildPriceTrends,
  buildTrendHistory,
  buildTrendMapPoints,
  selectTrendTransactions,
  TREND_DIMENSIONS,
} from '../../utils/marketAnalytics';
import { formatDate, formatNumber, formatPercent } from '../../utils/formatters';

const directionOptions = [
  { value: 'all', label: 'All signals' },
  { value: 'rising', label: 'Rising' },
  { value: 'falling', label: 'Falling' },
  { value: 'limited', label: 'Limited evidence' },
];

const matchesDirection = (row, direction) => {
  if (direction === 'all') return true;
  if (direction === 'limited') return row.direction === 'Limited';
  return row.direction.toLowerCase() === direction;
};

export default function TrendDiscovery({ transactions, opportunities, areaLocations }) {
  const [dimension, setDimension] = useState('developer');
  const [direction, setDirection] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [transactionGroup, setTransactionGroup] = useState(null);
  const [isPending, startTransition] = useTransition();
  const trendResult = useMemo(
    () => buildPriceTrends(transactions, opportunities, dimension),
    [transactions, opportunities, dimension],
  );
  const rows = useMemo(
    () => trendResult.rows.filter((row) => matchesDirection(row, direction)),
    [trendResult.rows, direction],
  );

  const effectiveSelectedId = rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id ?? null;
  const selected = rows.find((row) => row.id === effectiveSelectedId) ?? null;
  const selectedHistory = useMemo(
    () => buildTrendHistory(transactions, dimension, selected?.key),
    [transactions, dimension, selected?.key],
  );
  const marketHistory = useMemo(
    () => buildTrendHistory(transactions, dimension, ''),
    [transactions, dimension],
  );
  const mapData = useMemo(
    () => buildTrendMapPoints(transactions, areaLocations, dimension, selected?.key),
    [transactions, areaLocations, dimension, selected?.key],
  );
  const transactionRows = useMemo(
    () => transactionGroup
      ? selectTrendTransactions(transactions, transactionGroup.dimension, transactionGroup.key)
      : [],
    [transactions, transactionGroup],
  );
  const transactionMapData = useMemo(
    () => transactionGroup
      ? buildTrendMapPoints(
        transactions,
        areaLocations,
        transactionGroup.dimension,
        transactionGroup.key,
      )
      : { points: [], areaCount: 0, mappedAreaCount: 0 },
    [transactions, areaLocations, transactionGroup],
  );
  const developerCoverage = trendResult.eligibleSales
    ? (trendResult.linkedSales / trendResult.eligibleSales) * 100
    : 0;

  const onDimensionChange = (_, value) => {
    if (!value) return;
    startTransition(() => {
      setDimension(value);
      setSelectedId(null);
      setTransactionGroup(null);
    });
  };

  const onShowTransactions = (row) => {
    setTransactionGroup(row);
  };

  return (
    <Stack component="section" spacing={2.5} aria-labelledby="price-trend-heading">
      <SectionHeader
        title="Price trend opportunities"
        description="Compare recent and prior median sale AED/m² across areas, developers, projects, and property types. This signal is independent from the valuation-based Opportunity Index."
        action={trendResult.period && (
          <Typography variant="caption" color="text.secondary">
            {formatDate(trendResult.period.recentStart)}–{formatDate(trendResult.period.recentEnd)} vs {formatDate(trendResult.period.priorStart)}–{formatDate(trendResult.period.priorEnd)}
          </Typography>
        )}
      />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}>
          <Box sx={{ overflowX: 'auto', pb: 0.25 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={dimension}
              onChange={onDimensionChange}
              aria-label="Trend ranking dimension"
              sx={{ minWidth: 'max-content' }}
            >
              {Object.entries(TREND_DIMENSIONS).map(([value, config]) => (
                <ToggleButton key={value} value={value}>{config.heading}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="trend-direction-label">Direction</InputLabel>
              <Select
                labelId="trend-direction-label"
                value={direction}
                label="Direction"
                onChange={(event) => startTransition(() => setDirection(event.target.value))}
              >
                {directionOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              {formatNumber(rows.length)} groups · {formatNumber(trendResult.eligibleSales)} eligible sales
              {dimension === 'developer' ? ` · ${formatPercent(developerCoverage, 0)} developer-linked` : ''}
            </Typography>
          </Stack>
        </Stack>
        {isPending && <LinearProgress sx={{ mx: -2, mb: -2, mt: 2 }} />}
      </Paper>

      {!rows.length ? (
        <Alert severity="info">
          No groups have sales in either comparison period under the current filters. Broaden the date range or market segment.
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 3,
            alignItems: 'start',
            '@media (min-width: 1900px)': {
              gridTemplateColumns: 'minmax(0, 1.7fr) minmax(390px, .8fr)',
            },
          }}
        >
          <Stack spacing={2.5} sx={{ minWidth: 0 }}>
            <TrendDataGrid
              rows={rows}
              dimensionHeading={TREND_DIMENSIONS[dimension].heading}
              selectedId={effectiveSelectedId}
              onSelect={setSelectedId}
              onShowTransactions={onShowTransactions}
            />
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <Box sx={{ p: 2.5, borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider' }}>
                  <Typography variant="h3">How the Price Trend Score works</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    The signed score combines the magnitude of median AED/m² movement, month-to-month consistency, sales volume, and sample confidence. At least five single-asset sales are required in each 90-day period.
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <Typography variant="h3">Evidence boundaries</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Developer links use exact, unique project-name matches only. The map uses cached area centroids and never represents an exact building or unit location. The Opportunity Index remains a separate valuation-cohort signal.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
              minWidth: 0,
              '@media (min-width: 1900px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
            }}
          >
            <TrendHistoryChart
              selectedLabel={selected?.label}
              selectedHistory={selectedHistory}
              marketHistory={marketHistory}
            />
            <TrendMap mapData={mapData} selectedLabel={selected?.label} />
          </Box>
        </Box>
      )}

      <TrendTransactionsDialog
        open={Boolean(transactionGroup)}
        onClose={() => setTransactionGroup(null)}
        group={transactionGroup}
        dimensionHeading={transactionGroup ? TREND_DIMENSIONS[transactionGroup.dimension].heading : ''}
        transactions={transactionRows}
        mapData={transactionMapData}
      />
    </Stack>
  );
}

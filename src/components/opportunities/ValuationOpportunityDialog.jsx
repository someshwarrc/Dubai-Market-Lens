import { useEffect, useMemo, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import OpportunityDataGrid from '../tables/OpportunityDataGrid';
import ValuationDataGrid from '../tables/ValuationDataGrid';
import { buildAreaOpportunities, selectOpportunityValuations } from '../../utils/marketAnalytics';
import { formatAed, formatNumber, formatPercent } from '../../utils/formatters';

const isShortlisted = (row) => row.discountPct >= 15 && row.confidence !== 'Exploratory';

const SummaryMetric = ({ label, value, note, last = false }) => (
  <Box sx={{ minWidth: 0, pr: { sm: 2.5 }, borderRight: { sm: last ? 0 : 1 }, borderColor: 'divider' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography fontWeight={700} sx={{ mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
  </Box>
);

export default function ValuationOpportunityDialog({
  open,
  onClose,
  initialAreaKey,
  opportunities,
  valuations,
  canFavorite,
  canReview,
  favoriteTransactionNumbers,
  pendingFavoriteTransactionNumber,
  pendingTransactionNumber,
  onFavorite,
  onReview,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedAreaKey, setSelectedAreaKey] = useState('');
  const [tab, setTab] = useState(0);
  const shortlisted = useMemo(() => opportunities.filter(isShortlisted), [opportunities]);
  const areaSummaries = useMemo(
    () => buildAreaOpportunities(shortlisted, Number.MAX_SAFE_INTEGER),
    [shortlisted],
  );

  useEffect(() => {
    if (!open) return;
    const requestedExists = areaSummaries.some((row) => row.areaKey === initialAreaKey);
    setSelectedAreaKey(requestedExists ? initialAreaKey : areaSummaries[0]?.areaKey ?? '');
    setTab(0);
  }, [areaSummaries, initialAreaKey, open]);

  const selectedSummary = areaSummaries.find((row) => row.areaKey === selectedAreaKey) ?? null;
  const selectedOpportunities = useMemo(
    () => shortlisted.filter((row) => row.areaKey === selectedAreaKey),
    [selectedAreaKey, shortlisted],
  );
  const selectedValuations = useMemo(
    () => selectOpportunityValuations(valuations, selectedAreaKey, selectedOpportunities),
    [selectedAreaKey, selectedOpportunities, valuations],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xl"
      aria-labelledby="valuation-opportunities-title"
      aria-describedby="valuation-opportunities-description"
      slotProps={{ paper: { sx: { maxHeight: fullScreen ? '100%' : 'calc(100% - 48px)' } } }}
    >
      <DialogTitle id="valuation-opportunities-title" component="div" sx={{ pr: 8, pb: 1 }}>
        <Typography variant="h2">Valuation opportunities by area</Typography>
        <Typography id="valuation-opportunities-description" variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: '75ch' }}>
          Each shortlisted sale is at least 15% below a matched local median valuation benchmark. Review the recorded transaction, benchmark basis, cohort size, and underlying valuation evidence before treating it as a purchase lead.
        </Typography>
        <Tooltip title="Close" arrow>
          <IconButton
            aria-label="Close valuation opportunity details"
            onClick={onClose}
            sx={{ position: 'absolute', top: 12, right: 12, width: 44, height: 44 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
        {!areaSummaries.length ? (
          <Alert severity="info">No transactions meet the 15% local valuation-gap threshold under the current filters.</Alert>
        ) : (
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 320 } }}>
                <InputLabel id="valuation-opportunity-area-label">Area</InputLabel>
                <Select
                  labelId="valuation-opportunity-area-label"
                  label="Area"
                  value={selectedAreaKey}
                  onChange={(event) => {
                    setSelectedAreaKey(event.target.value);
                    setTab(0);
                  }}
                >
                  {areaSummaries.map((row) => (
                    <MenuItem key={row.areaKey} value={row.areaKey}>
                      {row.area} · {formatNumber(row.opportunities)} opportunities
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                {formatNumber(areaSummaries.length)} areas with qualifying opportunities under the current dashboard filters
              </Typography>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                gap: 2,
                py: 2,
                borderBlock: 1,
                borderColor: 'divider',
              }}
            >
              <SummaryMetric label="Shortlisted sales" value={formatNumber(selectedSummary?.opportunities ?? 0)} note="15%+ local valuation gap" />
              <SummaryMetric label="Median valuation gap" value={formatPercent(selectedSummary?.medianDiscount ?? 0)} note="shortlisted sales only" />
              <SummaryMetric label="Aggregate indicative gap" value={formatAed(selectedSummary?.saving ?? 0)} note="benchmark value less recorded price" />
              <SummaryMetric
                label="Local valuation records"
                value={formatNumber(selectedValuations.length)}
                note={`${formatNumber(selectedSummary?.highConfidence ?? 0)} high · ${formatNumber(selectedSummary?.mediumConfidence ?? 0)} medium evidence`}
                last
              />
            </Box>

            <Alert severity="info" variant="outlined">
              The valuation figures are comparison evidence, not formal appraisals. “Indicative gap” applies the matched median valuation price per area unit to the transaction size; it does not include condition, floor, view, payment plan, fees, or negotiation terms.
            </Alert>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Valuation opportunity evidence">
                <Tab label={`Shortlisted transactions (${formatNumber(selectedOpportunities.length)})`} />
                <Tab label={`Valuation evidence (${formatNumber(selectedValuations.length)})`} />
              </Tabs>
            </Box>

            {tab === 0 && (
              <Box>
                <Typography variant="h3">Transactions below their matched benchmark</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  Save promising records for your purchase plan. Authorized reviewers can also mark a transaction as trusted or hide dubious evidence globally.
                </Typography>
                <OpportunityDataGrid
                  rows={selectedOpportunities}
                  height={480}
                  canFavorite={canFavorite}
                  canReview={canReview}
                  favoriteTransactionNumbers={favoriteTransactionNumbers}
                  pendingFavoriteTransactionNumber={pendingFavoriteTransactionNumber}
                  pendingTransactionNumber={pendingTransactionNumber}
                  onFavorite={onFavorite}
                  onReview={onReview}
                />
              </Box>
            )}

            {tab === 1 && (
              <Box>
                <Typography variant="h3">Local valuation evidence</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  These qualifying valuation records belong to the area, property-type, and subtype cohorts referenced by the selected opportunity rows. Each transaction row states its exact benchmark basis and cohort size.
                </Typography>
                <ValuationDataGrid rows={selectedValuations} height={480} />
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

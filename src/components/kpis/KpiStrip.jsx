import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { formatAed, formatNumber, formatPercent } from '../../utils/formatters';

const Metric = ({ label, value, note, last }) => (
  <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, minWidth: 0, borderRight: { md: last ? 0 : 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography sx={{ mt: 0.5, fontSize: '1.35rem', lineHeight: 1.25, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{note}</Typography>
  </Box>
);

export default function KpiStrip({ summary }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.35fr repeat(4, 1fr)' } }}>
        <Box sx={{ p: 2.5, bgcolor: 'secondary.main', color: 'secondary.contrastText', minHeight: 126 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.85 }}>Valuation-backed shortlist</Typography>
            <Chip size="small" icon={<ArrowDownwardRoundedIcon />} label="15%+ gap" sx={{ bgcolor: 'rgba(255,255,255,.9)', color: '#181d26' }} />
          </Stack>
          <Typography sx={{ mt: 1, fontSize: '2rem', lineHeight: 1.1, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatNumber(summary.opportunityCount)} opportunities
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'inherit', opacity: 0.9 }}>
            {formatAed(summary.potentialSaving)} aggregate indicative gap
          </Typography>
        </Box>
        <Metric label="Median discount" value={formatPercent(summary.medianDiscount)} note="shortlisted deals" />
        <Metric label="Valuation coverage" value={formatPercent(summary.valuationCoverage, 0)} note="eligible sales matched" />
        <Metric label="Recorded deal value" value={formatAed(summary.totalValue)} note={`${formatNumber(summary.dealCount)} unique deals`} />
        <Metric label="Median valuation" value={`${formatAed(summary.medianValuationPsm, false)}/m²`} note={`${formatNumber(summary.valuationCount)} valuation records`} last />
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2.5, py: 1.25, bgcolor: 'background.default', borderTop: 1, borderColor: 'divider' }}>
        <VerifiedRoundedIcon color="success" sx={{ fontSize: 18 }} />
        <Typography variant="caption" color="text.secondary">
          Benchmarks use median valuation AED/m² and expose their cohort size. Signals are investigative—not formal appraisals.
        </Typography>
      </Stack>
    </Paper>
  );
}

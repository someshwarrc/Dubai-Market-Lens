import { Box, Paper, Typography, useTheme } from '@mui/material';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAed } from '../../utils/formatters';

const combineHistory = (selectedHistory, marketHistory) => {
  const months = new Map();
  marketHistory.forEach((row) => months.set(row.month, { month: row.month, label: row.label, marketPsm: row.medianPsm }));
  selectedHistory.forEach((row) => {
    const current = months.get(row.month) ?? { month: row.month, label: row.label };
    current.selectedPsm = row.medianPsm;
    months.set(row.month, current);
  });
  return [...months.values()].sort((left, right) => left.month.localeCompare(right.month));
};

export default function TrendHistoryChart({ selectedLabel, selectedHistory, marketHistory }) {
  const theme = useTheme();
  const data = combineHistory(selectedHistory, marketHistory);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Typography variant="h3">Monthly median AED/m²</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        {selectedLabel ? `${selectedLabel} compared with the filtered market.` : 'Select a ranked signal to inspect its history.'}
      </Typography>
      <Box sx={{ height: 270, minWidth: 0 }}>
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="label" stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} width={70} tickFormatter={(value) => formatAed(value)} />
              <Tooltip
                contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
                formatter={(value, name) => [formatAed(value, false), name]}
              />
              <Legend iconType="circle" />
              <Line type="monotone" dataKey="marketPsm" name="Filtered market" stroke={theme.palette.text.secondary} strokeDasharray="5 5" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="selectedPsm" name={selectedLabel || 'Selected signal'} stroke={theme.dashboard.coral} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
            <Typography color="text.secondary">No monthly evidence is available for this selection.</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

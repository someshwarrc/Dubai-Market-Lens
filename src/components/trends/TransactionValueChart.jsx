import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAed, formatNumber } from '../../utils/formatters';

const ValueTooltip = ({ active, label, payload }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 190 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={700} sx={{ mt: 0.25 }}>{formatAed(point.medianValue, false)}</Typography>
      <Typography variant="caption" color="text.secondary">
        Monthly median · {formatNumber(point.sales)} {point.sales === 1 ? 'sale' : 'sales'}
      </Typography>
    </Paper>
  );
};

export default function TransactionValueChart({ data }) {
  const theme = useTheme();

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Typography variant="h3">Recorded values over time</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
        Monthly median sale value. Hover or tap a point to see the value and number of sales.
      </Typography>
      <Box sx={{ height: 300, minWidth: 0 }}>
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={theme.palette.divider} vertical={false} />
              <XAxis
                dataKey="label"
                stroke={theme.palette.text.secondary}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                stroke={theme.palette.text.secondary}
                tickLine={false}
                axisLine={false}
                width={78}
                tickFormatter={(value) => formatAed(value)}
              />
              <ChartTooltip content={<ValueTooltip />} />
              <Line
                type="monotone"
                dataKey="medianValue"
                name="Monthly median value"
                stroke={theme.dashboard.coral}
                strokeWidth={3}
                dot={{ r: 3, fill: theme.dashboard.coral, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: theme.palette.background.paper }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No monthly value history is available.</Typography>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

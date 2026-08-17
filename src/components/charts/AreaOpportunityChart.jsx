import { useTheme } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartFrame from './ChartFrame';
import { formatAed, formatNumber, formatPercent } from '../../utils/formatters';

export default function AreaOpportunityChart({ data }) {
  const theme = useTheme();
  const chartHeight = Math.max(330, data.length * 42);

  return (
    <ChartFrame title="Opportunity concentration" description="Areas ranked by the number of transactions at least 15% below their matched valuation benchmark." height={chartHeight}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 16, bottom: 0 }}>
          <CartesianGrid stroke={theme.palette.divider} horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} />
          <YAxis dataKey="area" type="category" width={118} stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: theme.palette.action.hover }}
            contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
            formatter={(value) => [formatNumber(value), 'Shortlisted deals']}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload;
              return row ? `${label} · ${formatPercent(row.medianDiscount)} median gap · ${formatAed(row.saving)} potential` : label;
            }}
          />
          <Bar dataKey="opportunities" name="Opportunities" fill={theme.dashboard.coral} radius={[0, 5, 5, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}


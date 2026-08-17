import { useTheme } from '@mui/material';
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
import ChartFrame from './ChartFrame';
import { formatAed } from '../../utils/formatters';

export default function MonthlyPriceChart({ data }) {
  const theme = useTheme();

  return (
    <ChartFrame title="Price evidence over time" description="Median recorded sale price and valuation benchmark per square metre by month.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={theme.palette.divider} vertical={false} />
          <XAxis dataKey="label" stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} />
          <YAxis stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} width={74} tickFormatter={(value) => formatAed(value)} />
          <Tooltip
            contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
            formatter={(value, name) => [formatAed(value, false), name]}
          />
          <Legend iconType="circle" />
          <Line type="monotone" dataKey="valuationPsm" name="Valuation AED/m²" stroke={theme.dashboard.coral} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="transactionPsm" name="Sale AED/m²" stroke={theme.dashboard.blue} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}


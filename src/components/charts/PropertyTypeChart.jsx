import { useTheme } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartFrame from './ChartFrame';
import { formatAed } from '../../utils/formatters';

export default function PropertyTypeChart({ data }) {
  const theme = useTheme();

  return (
    <ChartFrame title="Price-per-m² by property type" description="Median transaction evidence compared with median valuation evidence for each property type.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={theme.palette.divider} vertical={false} />
          <XAxis dataKey="propertyType" stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} />
          <YAxis stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} width={74} tickFormatter={(value) => formatAed(value)} />
          <Tooltip
            contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
            formatter={(value, name) => [formatAed(value, false), name]}
          />
          <Legend iconType="circle" />
          <Bar dataKey="valuationPsm" name="Valuation AED/m²" fill={theme.dashboard.peach} radius={[5, 5, 0, 0]} />
          <Bar dataKey="transactionPsm" name="Sale AED/m²" fill={theme.dashboard.ink} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}


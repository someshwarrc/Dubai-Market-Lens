import { useMemo } from 'react';
import { useMeasurementUnit } from '../../hooks/useMeasurementUnit';
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
  const { areaLabel, priceLabel, priceFromSqm } = useMeasurementUnit();
  const displayData = useMemo(() => data.map((row) => ({
    ...row,
    valuationPsm: priceFromSqm(row.valuationPsm),
    transactionPsm: priceFromSqm(row.transactionPsm),
  })), [data, priceFromSqm]);
  const theme = useTheme();

  return (
    <ChartFrame title="Price evidence over time" description={`Median recorded sale price and valuation benchmark per ${areaLabel} by month.`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={theme.palette.divider} vertical={false} />
          <XAxis dataKey="label" stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} />
          <YAxis stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} width={74} tickFormatter={(value) => formatAed(value)} />
          <Tooltip
            contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
            formatter={(value, name) => [formatAed(value, false), name]}
          />
          <Legend iconType="circle" />
          <Line type="monotone" dataKey="valuationPsm" name={`Valuation ${priceLabel}`} stroke={theme.dashboard.coral} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="transactionPsm" name={`Sale ${priceLabel}`} stroke={theme.dashboard.blue} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}


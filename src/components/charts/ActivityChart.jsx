import { useTheme } from '@mui/material';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartFrame from './ChartFrame';
import { formatAed, formatNumber } from '../../utils/formatters';

export default function ActivityChart({ data }) {
  const theme = useTheme();

  return (
    <ChartFrame title="Recorded sales activity" description="Unique recorded sale procedures by month across the filtered segment.">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.dashboard.forest} stopOpacity={0.38} />
              <stop offset="100%" stopColor={theme.dashboard.forest} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={theme.palette.divider} vertical={false} />
          <XAxis dataKey="label" stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} />
          <YAxis stroke={theme.palette.text.secondary} tickLine={false} axisLine={false} width={58} tickFormatter={(value) => formatNumber(value, true)} />
          <Tooltip
            contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
            formatter={(value, name) => [name === 'Recorded value' ? formatAed(value, false) : formatNumber(value), name]}
          />
          <Area type="monotone" dataKey="deals" name="Unique deals" stroke={theme.dashboard.forest} strokeWidth={2.5} fill="url(#activityFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

import { useMemo } from 'react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import TransactionValueChart from './TransactionValueChart';
import TrendMap from './TrendMap';
import {
  buildTransactionValueHistory,
  summarizeTrendTransactions,
} from '../../utils/marketAnalytics';
import { formatAed, formatDate, formatNumber } from '../../utils/formatters';

const displayText = (value) => {
  if (!value || ['unknown', 'unspecified', 'n/a'].includes(String(value).toLowerCase())) return '—';
  return value;
};

const columns = [
  { field: 'date', headerName: 'Date', width: 110, renderCell: ({ value }) => formatDate(value) },
  { field: 'area', headerName: 'Area', minWidth: 150, flex: 0.85 },
  {
    field: 'project',
    headerName: 'Project',
    minWidth: 170,
    flex: 1,
    renderCell: ({ value }) => displayText(value),
  },
  {
    field: 'property',
    headerName: 'Property',
    minWidth: 150,
    flex: 0.9,
    valueGetter: (_, row) => `${row.propertyType} ${row.subType}`,
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, height: '100%' }}>
        <Typography noWrap fontWeight={500}>{displayText(row.propertyType)}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>{displayText(row.subType)}</Typography>
      </Box>
    ),
  },
  { field: 'rooms', headerName: 'Rooms', width: 92, renderCell: ({ value }) => displayText(value) },
  {
    field: 'actualArea',
    headerName: 'Size m²',
    width: 100,
    type: 'number',
    renderCell: ({ value }) => formatNumber(value),
  },
  {
    field: 'value',
    headerName: 'Recorded value',
    width: 160,
    type: 'number',
    renderCell: ({ value }) => formatAed(value, false),
  },
  {
    field: 'pricePerSqm',
    headerName: 'AED/m²',
    width: 140,
    type: 'number',
    renderCell: ({ value }) => formatAed(value, false),
  },
];

const SummaryMetric = ({ label, value, last = false }) => (
  <Box
    sx={{
      minWidth: 0,
      pr: { sm: 2.5 },
      borderRight: { sm: last ? 0 : 1 },
      borderColor: 'divider',
    }}
  >
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography fontWeight={700} sx={{ mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
  </Box>
);

export default function TrendTransactionsDialog({
  open,
  onClose,
  group,
  dimensionHeading,
  transactions,
  mapData,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const chartData = useMemo(() => buildTransactionValueHistory(transactions), [transactions]);
  const summary = useMemo(() => summarizeTrendTransactions(transactions), [transactions]);
  const rows = useMemo(
    () => transactions.map((row) => ({ ...row, pricePerSqm: row.value / row.actualArea })),
    [transactions],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xl"
      aria-labelledby="trend-transactions-title"
      aria-describedby="trend-transactions-description"
      slotProps={{ paper: { sx: { maxHeight: fullScreen ? '100%' : 'calc(100% - 48px)' } } }}
    >
      <DialogTitle id="trend-transactions-title" component="div" sx={{ pr: 8, pb: 1 }}>
        <Typography variant="h2">Transactions for {group?.label ?? 'selected signal'}</Typography>
        <Typography id="trend-transactions-description" variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Eligible single-asset sales matching this {dimensionHeading?.toLowerCase() ?? 'group'} under the current dashboard filters.
        </Typography>
        <Tooltip title="Close" arrow>
          <IconButton
            aria-label="Close transaction details"
            onClick={onClose}
            sx={{ position: 'absolute', top: 12, right: 12, width: 44, height: 44 }}
          >
            <CloseRounded />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={3}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
              gap: { xs: 2, sm: 2.5 },
              pb: 2.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <SummaryMetric label="Eligible sales" value={formatNumber(summary.count)} />
            <SummaryMetric label="Median recorded value" value={formatAed(summary.medianValue, false)} />
            <SummaryMetric label="Median sale price" value={`${formatAed(summary.medianPsm, false)}/m²`} />
            <SummaryMetric
              label="Date range"
              value={`${formatDate(summary.earliestDate)}–${formatDate(summary.latestDate)}`}
              last
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
              alignItems: 'stretch',
              minWidth: 0,
            }}
          >
            <TransactionValueChart data={chartData} />
            <TrendMap mapData={mapData} selectedLabel={group?.label} height={300} />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3">Sale transactions</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
              The table is intentionally limited to the details most useful for comparing recorded sales.
            </Typography>
            <Box sx={{ height: 460, minWidth: 0 }}>
              <DataGrid
                rows={rows}
                columns={columns}
                rowHeight={56}
                disableRowSelectionOnClick
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25, page: 0 } },
                  sorting: { sortModel: [{ field: 'date', sort: 'desc' }] },
                }}
                slots={{ toolbar: GridToolbar }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
                sx={{
                  '& .MuiDataGrid-toolbarContainer': { p: 1.25, borderBottom: 1, borderColor: 'divider' },
                }}
              />
            </Box>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

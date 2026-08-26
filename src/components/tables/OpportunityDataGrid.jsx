import { Chip, Stack, Typography } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import DataTableFrame from './DataTableFrame';
import { formatAed, formatDate, formatNumber, formatPercent } from '../../utils/formatters';

const confidenceColor = { High: 'success', Medium: 'warning', Exploratory: 'default' };

const columns = [
  {
    field: 'opportunityScore',
    headerName: 'Signal',
    width: 105,
    renderCell: ({ value }) => (
      <Stack sx={{ py: 0.75 }}>
        <Typography fontWeight={700} color={value >= 60 ? 'success.main' : value >= 30 ? 'warning.main' : 'text.primary'}>
          {Math.round(value)}
        </Typography>
        <Typography variant="caption" color="text.secondary">of 100</Typography>
      </Stack>
    ),
  },
  { field: 'date', headerName: 'Date', width: 108, renderCell: ({ value }) => formatDate(value) },
  { field: 'area', headerName: 'Area', minWidth: 150, flex: 1 },
  { field: 'project', headerName: 'Project', minWidth: 170, flex: 1.1 },
  { field: 'developer', headerName: 'Developer', minWidth: 190, flex: 1.1, renderCell: ({ value }) => value || '—' },
  { field: 'propertyType', headerName: 'Type', width: 105 },
  { field: 'subType', headerName: 'Subtype', width: 135 },
  { field: 'rooms', headerName: 'Rooms', width: 90 },
  { field: 'actualArea', headerName: 'Area m²', width: 95, type: 'number', renderCell: ({ value }) => formatNumber(value) },
  { field: 'value', headerName: 'Recorded price', width: 145, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
  { field: 'transactionPsm', headerName: 'Sale AED/m²', width: 135, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
  { field: 'benchmarkPsm', headerName: 'Valuation AED/m²', width: 155, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
  {
    field: 'discountPct',
    headerName: 'Valuation gap',
    width: 125,
    type: 'number',
    renderCell: ({ value }) => <Typography color={value >= 15 ? 'success.main' : value < 0 ? 'error.main' : 'text.primary'} fontWeight={650}>{formatPercent(value)}</Typography>,
  },
  { field: 'estimatedSaving', headerName: 'Indicative gap', width: 145, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
  {
    field: 'confidence',
    headerName: 'Evidence',
    width: 125,
    renderCell: ({ value }) => <Chip size="small" label={value} color={confidenceColor[value]} variant={value === 'Exploratory' ? 'outlined' : 'filled'} />,
  },
  { field: 'benchmarkBasis', headerName: 'Benchmark cohort', width: 200 },
  { field: 'benchmarkSample', headerName: 'Cohort size', width: 105, type: 'number' },
  { field: 'transactionNumber', headerName: 'Transaction no.', width: 145 },
];

export default function OpportunityDataGrid({ rows }) {
  return (
    <DataTableFrame height={640}>
      <DataGrid
        rows={rows}
        columns={columns}
        rowHeight={58}
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25, page: 0 } },
          sorting: { sortModel: [{ field: 'opportunityScore', sort: 'desc' }] },
        }}
        slots={{ toolbar: GridToolbar }}
        slotProps={{ toolbar: { showQuickFilter: true } }}
        sx={{ '& .MuiDataGrid-toolbarContainer': { p: 1.25, borderBottom: 1, borderColor: 'divider' } }}
      />
    </DataTableFrame>
  );
}

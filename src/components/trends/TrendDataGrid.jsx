import { useMemo } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import DataTableFrame from '../tables/DataTableFrame';
import { formatNumber, formatPercent } from '../../utils/formatters';

const directionColor = {
  Rising: 'success.main',
  Falling: 'secondary.main',
  Stable: 'text.secondary',
  Limited: 'text.disabled',
};

const stackedCellSx = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  height: '100%',
  minWidth: 0,
  py: 0.5,
  lineHeight: 1.25,
  boxSizing: 'border-box',
};

const formatSignedPercent = (value) => {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${formatPercent(value)}`;
};

const ScoreCell = ({ row }) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%', minWidth: 0, lineHeight: 1.25 }}>
    <Box sx={{ width: 8, height: 8, borderRadius: '50%', flex: '0 0 auto', bgcolor: directionColor[row.direction] }} />
    <Box sx={{ ...stackedCellSx, py: 0 }}>
      <Typography
        fontWeight={650}
        color={directionColor[row.direction]}
        sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}
      >
        {Number.isFinite(row.trendScore) ? Math.round(row.trendScore) : '—'}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35 }}>
        {row.direction}
      </Typography>
    </Box>
  </Stack>
);

export default function TrendDataGrid({ rows, dimensionHeading, selectedId, onSelect, onShowTransactions }) {
  const columns = useMemo(() => [
    {
      field: 'actions',
      headerName: '',
      description: 'Show transactions',
      width: 52,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      renderCell: ({ row }) => (
        <Tooltip title="Show transactions" arrow>
          <IconButton
            aria-label={`Show transactions for ${row.label}`}
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row.id);
              onShowTransactions(row);
            }}
            sx={{ width: 44, height: 44 }}
          >
            <VisibilityOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
    {
      field: 'label',
      headerName: dimensionHeading,
      minWidth: 160,
      flex: 1.2,
      renderCell: ({ row }) => (
        <Box sx={stackedCellSx}>
          <Typography fontWeight={row.id === selectedId ? 650 : 500} noWrap sx={{ lineHeight: 1.35 }}>
            {row.label}
          </Typography>
          {dimensionHeading !== 'Area' && row.primaryArea && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.35 }}>
              {row.primaryArea}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'trendScore',
      headerName: 'Price trend',
      description: 'Signed 0–100 signal combining median AED/m² change, monthly consistency, sales volume, and sample confidence.',
      width: 116,
      type: 'number',
      renderCell: ({ row }) => <ScoreCell row={row} />,
    },
    {
      field: 'recentMedianPsm',
      headerName: 'Recent AED/m²',
      description: 'Median recorded sale price per square metre in the latest 90-day period.',
      width: 126,
      type: 'number',
      renderCell: ({ value }) => formatNumber(value),
    },
    {
      field: 'priorMedianPsm',
      headerName: 'Prior AED/m²',
      description: 'Median recorded sale price per square metre in the preceding 90-day period.',
      width: 118,
      type: 'number',
      renderCell: ({ value }) => formatNumber(value),
    },
    {
      field: 'changePct',
      headerName: 'Change',
      width: 95,
      type: 'number',
      renderCell: ({ row }) => (
        <Typography
          fontWeight={650}
          color={row.direction === 'Rising' ? 'success.main' : row.direction === 'Falling' ? 'secondary.main' : 'text.secondary'}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatSignedPercent(row.changePct)}
        </Typography>
      ),
    },
    { field: 'recentSales', headerName: 'Sales (90d)', width: 96, type: 'number' },
    {
      field: 'confidence',
      headerName: 'Confidence',
      description: 'High, Medium, or Low reflects sample size and consistency. Limited means fewer than five sales in either period.',
      width: 104,
      renderCell: ({ value }) => (
        <Typography
          color={value === 'Limited' ? 'text.disabled' : 'text.primary'}
          fontWeight={500}
          sx={{ display: 'flex', alignItems: 'center', height: '100%' }}
        >
          {value}
        </Typography>
      ),
    },
    {
      field: 'opportunityIndex',
      headerName: 'Opportunity index',
      description: 'Median of the existing positive transaction-level Opportunity Index scores in this group. It remains independent from the Price Trend Score.',
      width: 125,
      type: 'number',
      renderCell: ({ row }) => (
        <Box sx={{ ...stackedCellSx, alignItems: 'flex-end', width: '100%' }}>
          <Typography fontWeight={650} sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.35 }}>
            {Number.isFinite(row.opportunityIndex) ? Math.round(row.opportunityIndex) : '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.35 }}>
            {row.opportunityMatches ? `${formatNumber(row.opportunityMatches)} matched` : 'No positive gaps'}
          </Typography>
        </Box>
      ),
    },
  ], [dimensionHeading, onSelect, onShowTransactions, selectedId]);

  return (
    <DataTableFrame height={590}>
      <DataGrid
        rows={rows}
        columns={columns}
        rowHeight={58}
        disableRowSelectionOnClick
        onRowClick={({ row }) => onSelect(row.id)}
        getRowClassName={({ row }) => row.id === selectedId ? 'trend-row-selected' : ''}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } },
          sorting: { sortModel: [{ field: 'trendScore', sort: 'desc' }] },
        }}
        slots={{ toolbar: GridToolbar }}
        slotProps={{ toolbar: { showQuickFilter: true } }}
        sx={{
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-toolbarContainer': { p: 1.25, borderBottom: 1, borderColor: 'divider' },
          '& .trend-row-selected': { bgcolor: 'rgba(252, 171, 121, 0.22)' },
          '& .trend-row-selected:hover': { bgcolor: 'rgba(252, 171, 121, 0.28)' },
        }}
      />
    </DataTableFrame>
  );
}

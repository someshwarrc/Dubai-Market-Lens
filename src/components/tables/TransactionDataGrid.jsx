import { useMeasurementColumns } from '../../hooks/useMeasurementUnit';
import { useMemo } from 'react';
import { Chip, IconButton, Stack, Tooltip } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import DataTableFrame from './DataTableFrame';
import { formatAed, formatDate, formatNumber } from '../../utils/formatters';

const dataColumns = [
  { field: 'date', headerName: 'Date', width: 108, renderCell: ({ value }) => formatDate(value) },
  { field: 'transactionNumber', headerName: 'Transaction no.', width: 145 },
  { field: 'group', headerName: 'Group', width: 105, renderCell: ({ value }) => <Chip size="small" variant="outlined" label={value} /> },
  { field: 'procedure', headerName: 'Procedure', minWidth: 200, flex: 1 },
  { field: 'area', headerName: 'Area', minWidth: 150, flex: 0.8 },
  { field: 'project', headerName: 'Project', minWidth: 170, flex: 0.9 },
  { field: 'developer', headerName: 'Developer', minWidth: 190, flex: 1, renderCell: ({ value }) => value || '—' },
  { field: 'propertyType', headerName: 'Type', width: 105 },
  { field: 'subType', headerName: 'Subtype', width: 140 },
  { field: 'rooms', headerName: 'Rooms', width: 95 },
  { field: 'planStatus', headerName: 'Status', width: 105 },
  { field: 'tenure', headerName: 'Tenure', width: 115 },
  { field: 'usage', headerName: 'Usage', width: 115 },
  { field: 'value', headerName: 'Recorded value', width: 150, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
  { field: 'actualArea', headerName: 'Area m²', width: 100, type: 'number', renderCell: ({ value }) => formatNumber(value) },
  { field: 'assetCount', headerName: 'Assets in transaction', width: 145, type: 'number' },
  { field: 'nearestMetro', headerName: 'Nearest metro', width: 210 },
  { field: 'nearestMall', headerName: 'Nearest mall', width: 150 },
  { field: 'nearestLandmark', headerName: 'Nearest landmark', width: 170 },
];

export default function TransactionDataGrid({ rows, canReview, pendingTransactionNumber, onReview }) {
  const columns = useMemo(() => [{
    field: 'reviewActions',
    headerName: 'Review',
    description: 'Mark the complete transaction number as trusted or dubious.',
    width: 104,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    renderCell: ({ row }) => {
      const pending = pendingTransactionNumber === row.transactionNumber;
      const unavailableTitle = canReview ? '' : 'Sign in with an authorized Google account to review transactions';
      return (
        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', height: '100%' }}>
          <Tooltip title={unavailableTitle || (row.reviewDecision === 'liked' ? 'Marked as trusted' : 'Mark as trusted')}>
            <span>
              <IconButton
                aria-label={`Like transaction ${row.transactionNumber}`}
                color={row.reviewDecision === 'liked' ? 'success' : 'default'}
                disabled={!canReview || pending}
                onClick={(event) => {
                  event.stopPropagation();
                  onReview(row, 'liked');
                }}
                sx={{ width: 44, height: 44 }}
              >
                <ThumbUpAltOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={unavailableTitle || 'Mark as dubious and hide from every dashboard'}>
            <span>
              <IconButton
                aria-label={`Dislike and hide transaction ${row.transactionNumber}`}
                color="error"
                disabled={!canReview || pending}
                onClick={(event) => {
                  event.stopPropagation();
                  onReview(row, 'disliked');
                }}
                sx={{ width: 44, height: 44 }}
              >
                <ThumbDownAltOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      );
    },
  }, ...dataColumns], [canReview, onReview, pendingTransactionNumber]);
  const displayColumns = useMeasurementColumns(columns);
  return (
    <DataTableFrame height="calc(100vh - 240px)">
      <DataGrid
        rows={rows}
        columns={displayColumns}
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } }, sorting: { sortModel: [{ field: 'date', sort: 'desc' }] } }}
        slots={{ toolbar: GridToolbar }}
        slotProps={{ toolbar: { showQuickFilter: true } }}
        sx={{ '& .MuiDataGrid-toolbarContainer': { p: 1.25, borderBottom: 1, borderColor: 'divider' } }}
      />
    </DataTableFrame>
  );
}

import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import DataTableFrame from './DataTableFrame';
import { formatAed, formatDate, formatNumber } from '../../utils/formatters';

const columns = [
  { field: 'date', headerName: 'Date', width: 108, renderCell: ({ value }) => formatDate(value) },
  { field: 'procedureNumber', headerName: 'Procedure no.', width: 135 },
  { field: 'procedureYear', headerName: 'Year', width: 80 },
  { field: 'area', headerName: 'Area', minWidth: 170, flex: 1 },
  { field: 'propertyType', headerName: 'Type', width: 120 },
  { field: 'subType', headerName: 'Subtype', minWidth: 190, flex: 0.8 },
  { field: 'actualWorth', headerName: 'Actual worth', width: 170, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
  { field: 'totalValue', headerName: 'Property total', width: 170, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
  { field: 'actualArea', headerName: 'Actual area m²', width: 130, type: 'number', renderCell: ({ value }) => formatNumber(value) },
  { field: 'procedureArea', headerName: 'Procedure area m²', width: 150, type: 'number', renderCell: ({ value }) => formatNumber(value) },
  { field: 'pricePerSqm', headerName: 'Valuation AED/m²', width: 170, type: 'number', renderCell: ({ value }) => formatAed(value, false) },
];

export default function ValuationDataGrid({ rows }) {
  return (
    <DataTableFrame height="calc(100vh - 240px)">
      <DataGrid
        rows={rows}
        columns={columns}
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

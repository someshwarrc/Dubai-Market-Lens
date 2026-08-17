import { Paper } from '@mui/material';

export default function DataTableFrame({ children, height = 610 }) {
  return (
    <Paper variant="outlined" sx={{ height, overflow: 'hidden' }}>
      {children}
    </Paper>
  );
}


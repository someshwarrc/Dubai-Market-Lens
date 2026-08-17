import { Box, Paper, Typography } from '@mui/material';

export default function ChartFrame({ title, description, children, height = 330 }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Typography variant="h3">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
        {description}
      </Typography>
      <Box sx={{ height, minWidth: 0 }}>{children}</Box>
    </Paper>
  );
}


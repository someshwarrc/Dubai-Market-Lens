import { Box, Stack, Typography } from '@mui/material';

export default function SectionHeader({ title, description, action }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="h2">{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>{description}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}

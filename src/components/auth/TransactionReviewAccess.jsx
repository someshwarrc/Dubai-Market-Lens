import { Alert, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';

export default function TransactionReviewAccess({ auth, onError }) {
  if (!auth.configured) {
    return (
      <Alert severity="info" variant="outlined">
        Transaction review controls are disabled until Supabase Google authentication is configured.
      </Alert>
    );
  }

  if (auth.loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Checking your review access…</Typography>
        </Stack>
      </Paper>
    );
  }

  if (!auth.user) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
          <div>
            <Typography fontWeight={650}>Transaction review</Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in with an authorized Google account to mark trustworthy or dubious transactions.
            </Typography>
          </div>
          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={() => auth.signInWithGoogle().catch(onError)}
            sx={{ minHeight: 44, flexShrink: 0 }}
          >
            Sign in with Google
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Chip color="success" variant="outlined" label="Review mode" />
          <Typography variant="body2" color="text.secondary" noWrap>{auth.user.email}</Typography>
        </Stack>
        <Button
          color="inherit"
          startIcon={<LogoutRoundedIcon />}
          onClick={() => auth.signOut().catch(onError)}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          Sign out
        </Button>
      </Stack>
    </Paper>
  );
}

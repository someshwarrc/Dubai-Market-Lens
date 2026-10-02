import { Alert, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';

export default function TransactionReviewAccess({ auth, canReview, onError }) {
  if (!auth.configured) {
    return (
      <Alert severity="info" variant="outlined">
        Saved evidence and transaction review controls are disabled until Supabase Google authentication is configured.
      </Alert>
    );
  }

  if (auth.loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Checking your saved evidence and review access…</Typography>
        </Stack>
      </Paper>
    );
  }

  if (!auth.user) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
          <div>
            <Typography fontWeight={650}>Save evidence and review transactions</Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in with Google to build a private purchase shortlist. Authorized reviewers can also mark transactions as trusted or dubious.
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
          <Chip color={canReview ? 'success' : 'warning'} variant="outlined" label={canReview ? 'Review mode' : 'Favorites enabled'} />
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

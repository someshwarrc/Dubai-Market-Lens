import { IconButton, Stack, Tooltip } from '@mui/material';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';

export default function TransactionActionButtons({
  row,
  canFavorite,
  canReview,
  favoriteTransactionNumbers,
  pendingFavoriteTransactionNumber,
  pendingTransactionNumber,
  onFavorite,
  onReview,
}) {
  const isFavorite = favoriteTransactionNumbers?.has(row.transactionNumber) ?? false;
  const favoritePending = pendingFavoriteTransactionNumber === row.transactionNumber;
  const reviewPending = pendingTransactionNumber === row.transactionNumber;
  const favoriteTitle = canFavorite
    ? (isFavorite ? 'Remove from saved evidence' : 'Save as purchase evidence')
    : 'Sign in with Google to save transaction evidence';
  const reviewUnavailableTitle = canReview ? '' : 'Only authorized reviewers can like or dislike transactions';

  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', height: '100%' }}>
      <Tooltip title={favoriteTitle}>
        <span>
          <IconButton
            aria-label={`${isFavorite ? 'Remove' : 'Save'} transaction ${row.transactionNumber} ${isFavorite ? 'from' : 'as'} purchase evidence`}
            color={isFavorite ? 'warning' : 'default'}
            disabled={!canFavorite || favoritePending}
            onClick={(event) => {
              event.stopPropagation();
              onFavorite(row, !isFavorite);
            }}
            sx={{ width: 44, height: 44 }}
          >
            {isFavorite ? <StarRoundedIcon fontSize="small" /> : <StarBorderRoundedIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={reviewUnavailableTitle || (row.reviewDecision === 'liked' ? 'Marked as trusted' : 'Mark as trusted')}>
        <span>
          <IconButton
            aria-label={`Like transaction ${row.transactionNumber}`}
            color={row.reviewDecision === 'liked' ? 'success' : 'default'}
            disabled={!canReview || reviewPending}
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
      <Tooltip title={reviewUnavailableTitle || 'Mark as dubious and hide from every dashboard'}>
        <span>
          <IconButton
            aria-label={`Dislike and hide transaction ${row.transactionNumber}`}
            color="error"
            disabled={!canReview || reviewPending}
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
}

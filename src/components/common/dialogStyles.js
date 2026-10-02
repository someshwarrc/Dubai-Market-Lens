export const wideDialogPaperSx = (fullScreen) => ({
  width: fullScreen ? '100%' : '90vw',
  maxWidth: fullScreen ? '100%' : '90vw',
  maxHeight: fullScreen ? '100%' : 'calc(100% - 48px)',
  m: fullScreen ? 0 : 3,
});

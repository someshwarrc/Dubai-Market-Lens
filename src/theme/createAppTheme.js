import { alpha, createTheme } from '@mui/material/styles';

const tokens = {
  ink: '#181d26',
  coral: '#aa2d00',
  forest: '#0a2e0e',
  peach: '#fcab79',
  mint: '#a8d8c4',
  yellow: '#f4d35e',
  blue: '#1b61c9',
};

export const createAppTheme = (mode) => {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: dark ? '#f7f8fa' : tokens.ink,
        contrastText: dark ? tokens.ink : '#ffffff',
      },
      secondary: { main: dark ? '#ffb58c' : tokens.coral },
      success: { main: dark ? '#67c886' : '#006400' },
      info: { main: dark ? '#79a8ff' : tokens.blue },
      warning: { main: dark ? '#f4d35e' : '#9a5b00' },
      error: { main: dark ? '#ff8d88' : '#b42318' },
      background: {
        default: dark ? '#111318' : '#f8fafc',
        paper: dark ? '#1d1f25' : '#ffffff',
      },
      text: {
        primary: dark ? '#f6f7f9' : tokens.ink,
        secondary: dark ? '#bfc4cc' : '#41454d',
      },
      divider: dark ? '#343740' : '#dddddd',
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: "'Inter Variable', Inter, system-ui, sans-serif",
      h1: { fontSize: '2rem', lineHeight: 1.2, fontWeight: 500, letterSpacing: 0 },
      h2: { fontSize: '1.5rem', lineHeight: 1.35, fontWeight: 500 },
      h3: { fontSize: '1.125rem', lineHeight: 1.4, fontWeight: 600 },
      body1: { fontSize: '0.875rem', lineHeight: 1.5 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.45 },
      button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
      caption: { fontSize: '0.75rem', lineHeight: 1.35, fontWeight: 500 },
      overline: { fontSize: '0.6875rem', lineHeight: 1.4, letterSpacing: '0.08em', fontWeight: 650 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: dark ? '#111318' : '#f8fafc' },
          '::selection': { backgroundColor: alpha(tokens.peach, dark ? 0.45 : 0.65) },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 40, borderRadius: 10, paddingInline: 16 },
        },
      },
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiCard: { defaultProps: { elevation: 0 } },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 6 } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 6, fontWeight: 550 } },
      },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.75rem' } } },
      MuiDataGrid: {
        styleOverrides: {
          root: { border: 0 },
          columnHeaders: {
            backgroundColor: dark ? '#252830' : '#f3f5f7',
            borderBottom: `1px solid ${dark ? '#343740' : '#dddddd'}`,
          },
          columnHeaderTitle: { fontWeight: 650 },
          row: {
            '&:hover': { backgroundColor: dark ? '#252830' : '#f8fafc' },
          },
          cell: { borderColor: dark ? '#2d3038' : '#eceef1' },
        },
      },
    },
    dashboard: { ...tokens, dark },
  });
};


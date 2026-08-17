import { useState } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FilterPanel from '../filters/FilterPanel';

const drawerWidth = 320;

export default function AppShell({
  children,
  mode,
  onToggleMode,
  activeView,
  onViewChange,
  filters,
  options,
  onFiltersChange,
  onResetFilters,
}) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filterPanel = (
    <FilterPanel filters={filters} options={options} onChange={onFiltersChange} onReset={onResetFilters} />
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, bgcolor: '#181d26', color: '#fff', boxShadow: 'none' }}>
        <Toolbar sx={{ minHeight: '64px !important', gap: 2 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: { lg: drawerWidth - 16 } }}>
            <Box sx={{ width: 22, height: 22, borderRadius: '5px', bgcolor: '#fcab79', display: 'grid', placeItems: 'center' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#181d26' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 650, lineHeight: 1.1 }}>Dubai Market Lens</Typography>
              <Typography sx={{ fontSize: 10.5, color: '#cbd0d8', lineHeight: 1.2 }}>Transactions × valuations</Typography>
            </Box>
          </Stack>

          <Tabs
            value={activeView}
            onChange={(_, value) => onViewChange(value)}
            variant="scrollable"
            scrollButtons={false}
            textColor="inherit"
            sx={{ flex: 1, minWidth: 0, '& .MuiTabs-indicator': { bgcolor: '#fcab79', height: 3 }, '& .MuiTab-root': { color: '#d7dae0', minHeight: 64 }, '& .Mui-selected': { color: '#fff' } }}
          >
            <Tab value="opportunities" label="Opportunity radar" />
            <Tab value="overview" label="Market overview" />
            <Tab value="transactions" label="Transactions" />
            <Tab value="valuations" label="Valuations" />
          </Tabs>

          {!desktop && (
            <Tooltip title="Open filters">
              <IconButton color="inherit" onClick={() => setMobileFiltersOpen(true)} aria-label="Open filters">
                <TuneRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={`Use ${mode === 'light' ? 'dark' : 'light'} theme`}>
            <IconButton color="inherit" onClick={onToggleMode} aria-label="Toggle color theme">
              {mode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {desktop && (
        <Drawer
          variant="permanent"
          sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, top: 64, height: 'calc(100% - 64px)', borderRightColor: 'divider', backgroundImage: 'none' } }}
        >
          {filterPanel}
        </Drawer>
      )}

      <Drawer
        anchor="right"
        open={!desktop && mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        sx={{ zIndex: theme.zIndex.drawer + 2, '& .MuiDrawer-paper': { width: { xs: 'min(92vw, 360px)' }, backgroundImage: 'none' } }}
      >
        <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 1 }}>
          <IconButton onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters"><CloseRoundedIcon /></IconButton>
        </Stack>
        {filterPanel}
      </Drawer>

      <Box component="main" sx={{ ml: { lg: `${drawerWidth}px` }, pt: '64px', minWidth: 0, minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
        {children}
      </Box>
    </Box>
  );
}

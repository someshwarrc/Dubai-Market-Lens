import { useState } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  NativeSelect,
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
import { useMeasurementUnit } from '../../hooks/useMeasurementUnit';

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
  const { unit, setUnit } = useMeasurementUnit();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filterPanel = (
    <FilterPanel filters={filters} options={options} onChange={onFiltersChange} onReset={onResetFilters} />
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, bgcolor: '#181d26', color: '#fff', boxShadow: 'none' }}>
        <Toolbar sx={{ minHeight: '64px !important', columnGap: { xs: 0.5, sm: 1, lg: 2 }, rowGap: 0, flexWrap: { xs: 'wrap', lg: 'nowrap' }, px: { xs: 1.5, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minHeight: 64, flex: { xs: 1, lg: '0 0 auto' }, minWidth: { xs: 0, lg: drawerWidth - 16 } }}>
            <Box sx={{ display: { xs: 'none', sm: 'grid' }, flexShrink: 0, width: 22, height: 22, borderRadius: '5px', bgcolor: '#fcab79', placeItems: 'center' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#181d26' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 650, fontSize: { xs: 13, sm: 16 }, lineHeight: 1.1 }}>Dubai Market Lens</Typography>
              <Typography sx={{ fontSize: 10.5, color: '#cbd0d8', lineHeight: 1.2 }}>Transactions × valuations</Typography>
            </Box>
          </Stack>

          <Tabs
            value={activeView}
            onChange={(_, value) => onViewChange(value)}
            variant="scrollable"
            scrollButtons={false}
            textColor="inherit"
            sx={{ flex: { xs: '1 0 100%', lg: 1 }, order: { xs: 5, lg: 0 }, minWidth: 0, minHeight: { xs: 48, lg: 64 }, '& .MuiTabs-indicator': { bgcolor: '#fcab79', height: 3 }, '& .MuiTab-root': { color: '#d7dae0', minHeight: { xs: 48, lg: 64 } }, '& .Mui-selected': { color: '#fff' } }}
          >
            <Tab value="opportunities" label="Opportunity radar" />
            <Tab value="overview" label="Market overview" />
            <Tab value="transactions" label="Transactions" />
            <Tab value="valuations" label="Valuations" />
          </Tabs>

          <NativeSelect
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            disableUnderline
            inputProps={{ 'aria-label': 'Price and area unit' }}
            sx={{
              flexShrink: 0, color: '#fff', fontSize: 13, border: '1px solid #9297a0', borderRadius: 1,
              '& select': { minHeight: 44, boxSizing: 'border-box', py: 1, pl: 1, pr: '28px !important' },
              '& select:focus': { borderRadius: 1, outline: '2px solid #fcab79', outlineOffset: 2 },
              '& option': { color: '#181d26', backgroundColor: '#fff' },
              '& .MuiNativeSelect-icon': { color: '#fff' },
            }}
          >
            <option value="sqft">AED/sq.ft</option>
            <option value="sqm">AED/sq.m</option>
          </NativeSelect>

          {!desktop && (
            <Tooltip title="Open filters">
              <IconButton color="inherit" onClick={() => setMobileFiltersOpen(true)} aria-label="Open filters" sx={{ width: 44, height: 44 }}>
                <TuneRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={`Use ${mode === 'light' ? 'dark' : 'light'} theme`}>
            <IconButton color="inherit" onClick={onToggleMode} aria-label="Toggle color theme" sx={{ width: 44, height: 44 }}>
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

      <Box component="main" sx={{ ml: { lg: `${drawerWidth}px` }, pt: { xs: '112px', lg: '64px' }, minWidth: 0, minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
        {children}
      </Box>
    </Box>
  );
}

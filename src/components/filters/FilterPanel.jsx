import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';

const MultiFilter = ({ label, options, value, onChange }) => (
  <Autocomplete
    multiple
    disableCloseOnSelect
    limitTags={1}
    options={options}
    value={options.filter((option) => value.includes(option.value))}
    onChange={(_, selected) => onChange(selected.map((option) => option.value))}
    isOptionEqualToValue={(option, selected) => option.value === selected.value}
    getOptionLabel={(option) => option.label}
    renderInput={(params) => <TextField {...params} label={label} size="small" />}
    slotProps={{
      paper: { sx: { minWidth: 280 } },
      popper: { placement: 'bottom-start' },
    }}
  />
);

const RangeFields = ({ filters, onFieldChange }) => (
  <Stack direction="row" spacing={1}>
    <TextField
      label="Minimum"
      type="number"
      size="small"
      value={filters.minValue}
      onChange={(event) => onFieldChange('minValue', event.target.value)}
      slotProps={{ htmlInput: { min: 0 } }}
    />
    <TextField
      label="Maximum"
      type="number"
      size="small"
      value={filters.maxValue}
      onChange={(event) => onFieldChange('maxValue', event.target.value)}
      slotProps={{ htmlInput: { min: 0 } }}
    />
  </Stack>
);

export default function FilterPanel({ filters, options, onChange, onReset }) {
  const onFieldChange = (field, value) => onChange({ ...filters, [field]: value });
  const activeCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'dateFrom' || key === 'dateTo') return count;
    if (Array.isArray(value)) return count + value.length;
    return count + (value !== '' ? 1 : 0);
  }, 0);

  const accordionSx = {
    '&::before': { display: 'none' },
    borderBottom: 1,
    borderColor: 'divider',
    borderRadius: '0 !important',
    backgroundImage: 'none',
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2 }}>
        <Box>
          <Typography variant="h3">Market filters</Typography>
          <Typography variant="caption" color="text.secondary">
            {activeCount} active selections
          </Typography>
        </Box>
        <Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={onReset}>
          Reset
        </Button>
      </Stack>
      <Divider />

      <Accordion defaultExpanded disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography fontWeight={650}>Market segment</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="From"
                type="date"
                size="small"
                value={filters.dateFrom}
                onChange={(event) => onFieldChange('dateFrom', event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="To"
                type="date"
                size="small"
                value={filters.dateTo}
                onChange={(event) => onFieldChange('dateTo', event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <MultiFilter label="Areas" options={options.areas} value={filters.areas} onChange={(value) => onFieldChange('areas', value)} />
            <MultiFilter label="Property types" options={options.propertyTypes} value={filters.propertyTypes} onChange={(value) => onFieldChange('propertyTypes', value)} />
            <MultiFilter label="Property subtypes" options={options.subTypes} value={filters.subTypes} onChange={(value) => onFieldChange('subTypes', value)} />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Min area (m²)"
                type="number"
                size="small"
                value={filters.minArea}
                onChange={(event) => onFieldChange('minArea', event.target.value)}
              />
              <TextField
                label="Max area (m²)"
                type="number"
                size="small"
                value={filters.maxArea}
                onChange={(event) => onFieldChange('maxArea', event.target.value)}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">Recorded value (AED)</Typography>
            <RangeFields filters={filters} onFieldChange={onFieldChange} />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography fontWeight={650}>Transaction details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <MultiFilter label="Transaction groups" options={options.groups} value={filters.groups} onChange={(value) => onFieldChange('groups', value)} />
            <MultiFilter label="Procedures" options={options.procedures} value={filters.procedures} onChange={(value) => onFieldChange('procedures', value)} />
            <MultiFilter label="Off-plan / ready" options={options.planStatuses} value={filters.planStatuses} onChange={(value) => onFieldChange('planStatuses', value)} />
            <MultiFilter label="Freehold status" options={options.tenures} value={filters.tenures} onChange={(value) => onFieldChange('tenures', value)} />
            <MultiFilter label="Usage" options={options.usages} value={filters.usages} onChange={(value) => onFieldChange('usages', value)} />
            <MultiFilter label="Rooms" options={options.rooms} value={filters.rooms} onChange={(value) => onFieldChange('rooms', value)} />
            <MultiFilter label="Projects" options={options.projects} value={filters.projects} onChange={(value) => onFieldChange('projects', value)} />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters sx={accordionSx}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Typography fontWeight={650}>Proximity</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <MultiFilter label="Nearest metro" options={options.metros} value={filters.metros} onChange={(value) => onFieldChange('metros', value)} />
            <MultiFilter label="Nearest mall" options={options.malls} value={filters.malls} onChange={(value) => onFieldChange('malls', value)} />
            <MultiFilter label="Nearest landmark" options={options.landmarks} value={filters.landmarks} onChange={(value) => onFieldChange('landmarks', value)} />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ p: 2.5 }}>
        <Typography variant="caption" color="text.secondary">
          Common filters apply to both datasets. Transaction-only filters do not remove valuation evidence from the comparison cohort.
        </Typography>
      </Box>
    </Box>
  );
}

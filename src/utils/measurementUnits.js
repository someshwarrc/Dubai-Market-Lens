// One international foot is exactly 0.3048 metres.
export const SQUARE_METRES_PER_SQUARE_FOOT = 0.09290304;
export const UNIT_STORAGE_KEY = 'market-lens-area-unit';

const finiteOrNull = (value, convert) => Number.isFinite(value) ? convert(value) : null;

export const measurementUnits = {
  sqft: {
    unit: 'sqft',
    areaLabel: 'sq.ft',
    priceLabel: 'AED/sq.ft',
    areaFromSqm: (value) => finiteOrNull(value, (area) => area / SQUARE_METRES_PER_SQUARE_FOOT),
    areaToSqm: (value) => finiteOrNull(value, (area) => area * SQUARE_METRES_PER_SQUARE_FOOT),
    priceFromSqm: (value) => finiteOrNull(value, (price) => price * SQUARE_METRES_PER_SQUARE_FOOT),
  },
  sqm: {
    unit: 'sqm',
    areaLabel: 'sq.m',
    priceLabel: 'AED/sq.m',
    areaFromSqm: (value) => finiteOrNull(value, (area) => area),
    areaToSqm: (value) => finiteOrNull(value, (area) => area),
    priceFromSqm: (value) => finiteOrNull(value, (price) => price),
  },
};

const areaFields = new Set(['actualArea', 'procedureArea']);
const priceFields = new Set(['transactionPsm', 'benchmarkPsm', 'pricePerSqm', 'recentMedianPsm', 'priorMedianPsm']);

export function unitText(text, areaLabel) {
  return text?.replaceAll('m²', areaLabel).replaceAll('square metre', areaLabel);
}

// Convert the grid's numeric value, so sorting, filtering and CSV exports use
// the same units as the rendered cells. Source rows stay in square metres.
export function measurementColumns(columns, units) {
  return columns.map((column) => {
    const convert = areaFields.has(column.field) ? units.areaFromSqm
      : priceFields.has(column.field) ? units.priceFromSqm : null;
    return {
      ...column,
      headerName: unitText(column.headerName, units.areaLabel),
      description: unitText(column.description, units.areaLabel),
      ...(convert ? { valueGetter: (value) => convert(value), width: Math.max(column.width ?? 0, 140) } : {}),
    };
  });
}

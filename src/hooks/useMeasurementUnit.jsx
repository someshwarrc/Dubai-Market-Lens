import { createContext, useContext, useMemo, useState } from 'react';
import { measurementColumns, measurementUnits, UNIT_STORAGE_KEY } from '../utils/measurementUnits';

const MeasurementUnitContext = createContext(null);

export function MeasurementUnitProvider({ children }) {
  const [unit, setUnit] = useState(() => {
    try {
      return localStorage.getItem(UNIT_STORAGE_KEY) === 'sqm' ? 'sqm' : 'sqft';
    } catch {
      return 'sqft';
    }
  });
  const value = useMemo(() => ({
    ...measurementUnits[unit],
    setUnit: (next) => {
      if (next !== 'sqft' && next !== 'sqm') return;
      setUnit(next);
      try {
        localStorage.setItem(UNIT_STORAGE_KEY, next);
      } catch {
        // The selector still works when browser storage is unavailable.
      }
    },
  }), [unit]);

  return <MeasurementUnitContext.Provider value={value}>{children}</MeasurementUnitContext.Provider>;
}

export function useMeasurementUnit() {
  const units = useContext(MeasurementUnitContext);
  if (!units) throw new Error('MeasurementUnitProvider is required');
  return units;
}

export function useMeasurementColumns(columns) {
  const units = useMeasurementUnit();
  return useMemo(() => measurementColumns(columns, units), [columns, units]);
}

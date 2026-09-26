import assert from 'node:assert/strict';
import test from 'node:test';
import { measurementColumns, measurementUnits } from './measurementUnits.js';

test('square-foot prices and areas preserve the total property value', () => {
  const units = measurementUnits.sqft;
  assert.ok(Math.abs(units.priceFromSqm(10_000) - 929.0304) < 1e-10);
  assert.ok(Math.abs(units.areaFromSqm(100) - 1076.3910416709723) < 1e-9);
  assert.ok(Math.abs(units.priceFromSqm(10_000) * units.areaFromSqm(100) - 1_000_000) < 1e-8);
  assert.ok(Math.abs(units.areaToSqm(units.areaFromSqm(100)) - 100) < 1e-12);
  assert.equal(measurementUnits.sqm.priceFromSqm(10_000), 10_000);
  assert.equal(measurementUnits.sqm.areaFromSqm(100), 100);
});

test('missing evidence stays missing and zero stays zero', () => {
  for (const units of Object.values(measurementUnits)) {
    for (const convert of [units.areaFromSqm, units.areaToSqm, units.priceFromSqm]) {
      for (const value of [null, undefined, NaN, Infinity]) assert.equal(convert(value), null);
      assert.equal(convert(0), 0);
    }
  }
});

test('grid numeric values and export headers use the selected unit without changing source columns', () => {
  const columns = [
    { field: 'actualArea', headerName: 'Area m²' },
    { field: 'recentMedianPsm', headerName: 'Recent AED/m²', description: 'Price per square metre.' },
    { field: 'changePct', headerName: 'Change' },
    { field: 'value', headerName: 'Recorded value' },
  ];
  const converted = measurementColumns(columns, measurementUnits.sqft);
  assert.equal(converted[0].headerName, 'Area sq.ft');
  assert.equal(converted[1].headerName, 'Recent AED/sq.ft');
  assert.equal(converted[1].description, 'Price per sq.ft.');
  assert.ok(Math.abs(converted[1].valueGetter(10_000) - 929.0304) < 1e-10);
  assert.equal(converted[2].valueGetter, undefined);
  assert.equal(converted[3].valueGetter, undefined);
  assert.equal(columns[0].headerName, 'Area m²');
  assert.equal(columns[1].valueGetter, undefined);
});

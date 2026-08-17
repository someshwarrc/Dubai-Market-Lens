const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const includesAny = (selected, value) => !selected.length || selected.includes(value);
const inRange = (value, minimum, maximum) =>
  (!minimum || value >= Number(minimum)) && (!maximum || value <= Number(maximum));

export const createDefaultFilters = () => ({
  dateFrom: '2026-01-01',
  dateTo: '2026-08-17',
  areas: [],
  propertyTypes: [],
  subTypes: [],
  groups: ['sales'],
  procedures: [],
  planStatuses: [],
  tenures: [],
  usages: [],
  rooms: [],
  projects: [],
  metros: [],
  malls: [],
  landmarks: [],
  minValue: '',
  maxValue: '',
  minArea: '',
  maxArea: '',
});

export const filterTransactions = (rows, filters) =>
  rows.filter((row) =>
    (!filters.dateFrom || row.date >= filters.dateFrom) &&
    (!filters.dateTo || row.date <= filters.dateTo) &&
    includesAny(filters.areas, row.areaKey) &&
    includesAny(filters.propertyTypes, row.propertyTypeKey) &&
    includesAny(filters.subTypes, row.subTypeKey) &&
    includesAny(filters.groups, row.group.toLowerCase()) &&
    includesAny(filters.procedures, row.procedure.toLowerCase()) &&
    includesAny(filters.planStatuses, row.planStatus.toLowerCase()) &&
    includesAny(filters.tenures, row.tenure.toLowerCase()) &&
    includesAny(filters.usages, row.usage.toLowerCase()) &&
    includesAny(filters.rooms, row.rooms.toLowerCase()) &&
    includesAny(filters.projects, row.project.toLowerCase()) &&
    includesAny(filters.metros, row.nearestMetro.toLowerCase()) &&
    includesAny(filters.malls, row.nearestMall.toLowerCase()) &&
    includesAny(filters.landmarks, row.nearestLandmark.toLowerCase()) &&
    inRange(row.value, filters.minValue, filters.maxValue) &&
    inRange(row.actualArea, filters.minArea, filters.maxArea),
  );

export const filterValuations = (rows, filters) =>
  rows.filter((row) =>
    (!filters.dateFrom || row.date >= filters.dateFrom) &&
    (!filters.dateTo || row.date <= filters.dateTo) &&
    includesAny(filters.areas, row.areaKey) &&
    includesAny(filters.propertyTypes, row.propertyTypeKey) &&
    includesAny(filters.subTypes, row.subTypeKey) &&
    inRange(row.actualWorth, filters.minValue, filters.maxValue) &&
    inRange(row.actualArea, filters.minArea, filters.maxArea),
  );

const addToGroup = (map, key, valuation) => {
  if (!key || key.includes('||')) return;
  const group = map.get(key) ?? { psm: [], values: [] };
  group.psm.push(valuation.pricePerSqm);
  group.values.push(valuation.actualWorth);
  map.set(key, group);
};

const finalizeGroups = (map) => {
  const result = new Map();
  map.forEach((group, key) => {
    result.set(key, {
      medianPsm: median(group.psm),
      medianValue: median(group.values),
      sampleSize: group.psm.length,
    });
  });
  return result;
};

export const buildValuationBenchmarks = (valuations) => {
  const exact = new Map();
  const areaType = new Map();
  const typeSubtype = new Map();
  const propertyType = new Map();

  valuations
    .filter((row) => row.actualWorth >= 1_000 && row.actualArea > 0 && row.pricePerSqm > 0)
    .forEach((row) => {
      addToGroup(exact, `${row.areaKey}|${row.propertyTypeKey}|${row.subTypeKey}`, row);
      addToGroup(areaType, `${row.areaKey}|${row.propertyTypeKey}`, row);
      addToGroup(typeSubtype, `${row.propertyTypeKey}|${row.subTypeKey}`, row);
      addToGroup(propertyType, row.propertyTypeKey, row);
    });

  return {
    exact: finalizeGroups(exact),
    areaType: finalizeGroups(areaType),
    typeSubtype: finalizeGroups(typeSubtype),
    propertyType: finalizeGroups(propertyType),
  };
};

const findBenchmark = (transaction, benchmarks) => {
  const candidates = [
    {
      result: benchmarks.exact.get(`${transaction.areaKey}|${transaction.propertyTypeKey}|${transaction.subTypeKey}`),
      minimum: 3,
      basis: 'Area + type + subtype',
      confidence: 'High',
    },
    {
      result: benchmarks.areaType.get(`${transaction.areaKey}|${transaction.propertyTypeKey}`),
      minimum: 3,
      basis: 'Area + property type',
      confidence: 'Medium',
    },
    {
      result: benchmarks.typeSubtype.get(`${transaction.propertyTypeKey}|${transaction.subTypeKey}`),
      minimum: 10,
      basis: 'Dubai-wide type + subtype',
      confidence: 'Exploratory',
    },
    {
      result: benchmarks.propertyType.get(transaction.propertyTypeKey),
      minimum: 20,
      basis: 'Dubai-wide property type',
      confidence: 'Exploratory',
    },
  ];

  const match = candidates.find(({ result, minimum }) => result?.sampleSize >= minimum);
  return match ? { ...match.result, basis: match.basis, confidence: match.confidence } : null;
};

export const calculateOpportunities = (transactions, valuations) => {
  const benchmarks = buildValuationBenchmarks(valuations);
  const eligible = transactions.filter(
    (row) => row.group.toLowerCase() === 'sales' && row.assetCount === 1 && row.actualArea > 0 && row.value >= 1_000,
  );

  const opportunities = [];
  eligible.forEach((transaction) => {
    const benchmark = findBenchmark(transaction, benchmarks);
    if (!benchmark?.medianPsm) return;
    const transactionPsm = transaction.value / transaction.actualArea;
    const discountPct = ((benchmark.medianPsm - transactionPsm) / benchmark.medianPsm) * 100;
    const estimatedValue = benchmark.medianPsm * transaction.actualArea;
    const confidenceWeight = benchmark.confidence === 'High' ? 1 : benchmark.confidence === 'Medium' ? 0.82 : 0.58;
    const cohortWeight = Math.min(1, Math.log10(benchmark.sampleSize + 1) / 1.7);
    const weightedGap = Math.max(0, discountPct) * confidenceWeight * cohortWeight;
    const opportunityScore = 100 * (1 - Math.exp(-weightedGap / 45));

    opportunities.push({
      ...transaction,
      transactionPsm,
      benchmarkPsm: benchmark.medianPsm,
      benchmarkValue: estimatedValue,
      discountPct,
      estimatedSaving: estimatedValue - transaction.value,
      benchmarkSample: benchmark.sampleSize,
      benchmarkBasis: benchmark.basis,
      confidence: benchmark.confidence,
      opportunityScore,
    });
  });

  return {
    eligibleCount: eligible.length,
    rows: opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore),
  };
};

export const summarizeMarket = (transactions, valuations, opportunityResult) => {
  const uniqueDeals = new Map();
  transactions.forEach((row) => {
    if (!uniqueDeals.has(row.transactionNumber)) uniqueDeals.set(row.transactionNumber, row.value);
  });
  const opportunityRows = opportunityResult.rows;
  const meaningfulDiscounts = opportunityRows.filter(
    (row) => row.discountPct >= 15 && row.confidence !== 'Exploratory',
  );

  return {
    totalValue: [...uniqueDeals.values()].reduce((sum, value) => sum + value, 0),
    dealCount: uniqueDeals.size,
    assetRecordCount: transactions.length,
    valuationCount: valuations.length,
    medianValuationPsm: median(valuations.filter((row) => row.pricePerSqm > 0 && row.actualWorth >= 1_000).map((row) => row.pricePerSqm)),
    opportunityCount: meaningfulDiscounts.length,
    medianDiscount: median(meaningfulDiscounts.map((row) => row.discountPct)),
    potentialSaving: meaningfulDiscounts.reduce((sum, row) => sum + Math.max(0, row.estimatedSaving), 0),
    valuationCoverage: opportunityResult.eligibleCount
      ? (opportunityRows.length / opportunityResult.eligibleCount) * 100
      : 0,
  };
};

export const buildMonthlyTrend = (transactions, valuations) => {
  const months = new Map();
  const ensure = (month) => {
    const current = months.get(month) ?? { month, value: 0, deals: new Set(), txPsm: [], valPsm: [], valuationCount: 0 };
    months.set(month, current);
    return current;
  };

  transactions.forEach((row) => {
    if (!row.month || row.group.toLowerCase() !== 'sales') return;
    const current = ensure(row.month);
    if (!current.deals.has(row.transactionNumber)) {
      current.deals.add(row.transactionNumber);
      current.value += row.value;
    }
    if (row.assetCount === 1 && row.actualArea > 0) current.txPsm.push(row.value / row.actualArea);
  });
  valuations.forEach((row) => {
    if (!row.month || row.pricePerSqm <= 0 || row.actualWorth < 1_000) return;
    const current = ensure(row.month);
    current.valPsm.push(row.pricePerSqm);
    current.valuationCount += 1;
  });

  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      month: row.month,
      label: new Date(`${row.month}-01T00:00:00Z`).toLocaleDateString('en-AE', { month: 'short' }),
      transactionValue: row.value,
      deals: row.deals.size,
      transactionPsm: median(row.txPsm),
      valuationPsm: median(row.valPsm),
      valuationCount: row.valuationCount,
    }));
};

export const buildAreaOpportunities = (opportunities) => {
  const areas = new Map();
  opportunities.filter((row) => row.discountPct > 0 && row.confidence !== 'Exploratory').forEach((row) => {
    const current = areas.get(row.areaKey) ?? { area: row.area, discounts: [], opportunities: 0, saving: 0 };
    current.discounts.push(row.discountPct);
    current.opportunities += row.discountPct >= 15 ? 1 : 0;
    current.saving += Math.max(0, row.estimatedSaving);
    areas.set(row.areaKey, current);
  });

  return [...areas.values()]
    .filter((row) => row.opportunities > 0)
    .map((row) => ({ ...row, medianDiscount: median(row.discounts) }))
    .sort((a, b) => b.opportunities - a.opportunities || b.medianDiscount - a.medianDiscount)
    .slice(0, 10);
};

export const buildPropertyTypeComparison = (transactions, valuations) => {
  const groups = new Map();
  const ensure = (key, label) => {
    const current = groups.get(key) ?? { propertyType: label, transactionPsm: [], valuationPsm: [], deals: new Set() };
    groups.set(key, current);
    return current;
  };

  transactions.forEach((row) => {
    if (row.group.toLowerCase() !== 'sales') return;
    const current = ensure(row.propertyTypeKey, row.propertyType);
    current.deals.add(row.transactionNumber);
    if (row.assetCount === 1 && row.actualArea > 0 && row.value >= 1_000) current.transactionPsm.push(row.value / row.actualArea);
  });
  valuations.forEach((row) => {
    if (row.pricePerSqm <= 0 || row.actualWorth < 1_000) return;
    ensure(row.propertyTypeKey, row.propertyType).valuationPsm.push(row.pricePerSqm);
  });

  return [...groups.values()].map((row) => ({
    propertyType: row.propertyType,
    transactionPsm: median(row.transactionPsm),
    valuationPsm: median(row.valuationPsm),
    deals: row.deals.size,
  }));
};

export const buildFilterOptions = (transactions, valuations) => {
  const option = (value, label = value) => ({ value: value.toLowerCase(), label });
  const unique = (items) => {
    const map = new Map();
    items.forEach((item) => item.value && !map.has(item.value) && map.set(item.value, item));
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  };

  return {
    areas: unique([...transactions.map((row) => ({ value: row.areaKey, label: row.area })), ...valuations.map((row) => ({ value: row.areaKey, label: row.area }))]),
    propertyTypes: unique([...transactions.map((row) => option(row.propertyTypeKey, row.propertyType)), ...valuations.map((row) => option(row.propertyTypeKey, row.propertyType))]),
    subTypes: unique([...transactions.map((row) => option(row.subTypeKey, row.subType)), ...valuations.map((row) => option(row.subTypeKey, row.subType))]),
    groups: unique(transactions.map((row) => option(row.group))),
    procedures: unique(transactions.map((row) => option(row.procedure))),
    planStatuses: unique(transactions.map((row) => option(row.planStatus))),
    tenures: unique(transactions.map((row) => option(row.tenure))),
    usages: unique(transactions.map((row) => option(row.usage))),
    rooms: unique(transactions.map((row) => option(row.rooms))),
    projects: unique(transactions.map((row) => option(row.project))),
    metros: unique(transactions.map((row) => option(row.nearestMetro))),
    malls: unique(transactions.map((row) => option(row.nearestMall))),
    landmarks: unique(transactions.map((row) => option(row.nearestLandmark))),
  };
};

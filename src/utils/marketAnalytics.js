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
  developers: [],
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
    includesAny(filters.developers, row.developerKey) &&
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
    developers: unique(transactions.filter((row) => row.developerKey).map((row) => ({ value: row.developerKey, label: row.developer }))),
    metros: unique(transactions.map((row) => option(row.nearestMetro))),
    malls: unique(transactions.map((row) => option(row.nearestMall))),
    landmarks: unique(transactions.map((row) => option(row.nearestLandmark))),
  };
};

export const TREND_DIMENSIONS = {
  area: { key: 'areaKey', label: 'area', heading: 'Area' },
  developer: { key: 'developerKey', label: 'developer', heading: 'Developer' },
  project: { key: 'projectKey', label: 'project', heading: 'Project' },
  propertyType: { key: 'propertyTypeKey', label: 'propertyType', heading: 'Property type' },
};

const DAY_MS = 24 * 60 * 60 * 1_000;

const asUtcDate = (value) => {
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(milliseconds) ? milliseconds : 0;
};

const toIsoDate = (milliseconds) => new Date(milliseconds).toISOString().slice(0, 10);

const eligibleTrendSale = (row) =>
  row.group.toLowerCase() === 'sales' &&
  row.assetCount === 1 &&
  row.actualArea > 0 &&
  row.value >= 1_000 &&
  asUtcDate(row.date) > 0;

const getDimensionValue = (row, dimension) => {
  const config = TREND_DIMENSIONS[dimension];
  if (!config) return null;
  const key = row[config.key];
  const label = row[config.label];
  if (!key || !label || key === 'unspecified' || key === 'unknown') return null;
  return { key, label };
};

const monthlyMedians = (rows) => {
  const months = new Map();
  rows.forEach((row) => {
    const values = months.get(row.month) ?? [];
    values.push(row.value / row.actualArea);
    months.set(row.month, values);
  });
  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => ({ month, medianPsm: median(values), sales: values.length }));
};

const trendConsistency = (history, direction) => {
  if (history.length < 3 || direction === 0) return 0.35;
  const movements = [];
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1].medianPsm;
    const current = history[index].medianPsm;
    if (previous <= 0 || current <= 0) continue;
    const movement = (current - previous) / previous;
    if (Math.abs(movement) < 0.005) movements.push(0);
    else movements.push(Math.sign(movement));
  }
  if (!movements.length) return 0.35;
  const aligned = movements.filter((movement) => movement === direction || movement === 0).length;
  return aligned / movements.length;
};

const confidenceForSamples = (recentCount, priorCount, consistency) => {
  const minimum = Math.min(recentCount, priorCount);
  if (minimum < 5) return 'Limited';
  if (minimum >= 20 && consistency >= 0.6) return 'High';
  if (minimum >= 10) return 'Medium';
  return 'Low';
};

const calculateTrendMetrics = (rows, anchorMilliseconds, windowDays = 90) => {
  const recentStart = anchorMilliseconds - (windowDays - 1) * DAY_MS;
  const priorEnd = recentStart - DAY_MS;
  const priorStart = priorEnd - (windowDays - 1) * DAY_MS;
  const periodRows = rows.filter((row) => {
    const date = asUtcDate(row.date);
    return date >= priorStart && date <= anchorMilliseconds;
  });
  const recentRows = periodRows.filter((row) => asUtcDate(row.date) >= recentStart);
  const priorRows = periodRows.filter((row) => asUtcDate(row.date) <= priorEnd);
  const recentMedianPsm = median(recentRows.map((row) => row.value / row.actualArea));
  const priorMedianPsm = median(priorRows.map((row) => row.value / row.actualArea));
  const changePct = priorMedianPsm > 0 ? ((recentMedianPsm - priorMedianPsm) / priorMedianPsm) * 100 : null;
  const direction = !Number.isFinite(changePct) || Math.abs(changePct) < 2 ? 0 : Math.sign(changePct);
  const history = monthlyMedians(periodRows);
  const consistency = trendConsistency(history, direction);
  const confidence = confidenceForSamples(recentRows.length, priorRows.length, consistency);
  const minimumSample = Math.min(recentRows.length, priorRows.length);

  let trendScore = null;
  if (confidence !== 'Limited' && Number.isFinite(changePct)) {
    if (direction === 0) {
      trendScore = 0;
    } else {
      const magnitude = Math.min(1, Math.abs(changePct) / 25);
      const volume = Math.min(1, Math.log10(minimumSample + 1) / Math.log10(51));
      const confidenceWeight = confidence === 'High' ? 1 : confidence === 'Medium' ? 0.86 : 0.72;
      const strength = 100 * (0.6 * magnitude + 0.25 * consistency + 0.15 * volume) * confidenceWeight;
      trendScore = direction * Math.min(100, strength);
    }
  }

  return {
    recentMedianPsm,
    priorMedianPsm,
    changePct,
    recentSales: recentRows.length,
    priorSales: priorRows.length,
    consistency: consistency * 100,
    confidence,
    direction: confidence === 'Limited' ? 'Limited' : direction > 0 ? 'Rising' : direction < 0 ? 'Falling' : 'Stable',
    trendScore,
    history,
    period: {
      priorStart: toIsoDate(priorStart),
      priorEnd: toIsoDate(priorEnd),
      recentStart: toIsoDate(recentStart),
      recentEnd: toIsoDate(anchorMilliseconds),
    },
  };
};

export const buildPriceTrends = (
  transactions,
  opportunities,
  dimension = 'area',
  windowDays = 90,
) => {
  const eligible = transactions.filter(eligibleTrendSale);
  const anchorMilliseconds = eligible.reduce(
    (latest, row) => Math.max(latest, asUtcDate(row.date)),
    0,
  );
  if (!anchorMilliseconds) {
    return { rows: [], eligibleSales: 0, linkedSales: 0, period: null };
  }

  const groups = new Map();
  eligible.forEach((row) => {
    const value = getDimensionValue(row, dimension);
    if (!value) return;
    const group = groups.get(value.key) ?? { key: value.key, label: value.label, rows: [] };
    group.rows.push(row);
    groups.set(value.key, group);
  });

  const opportunityScoresByGroup = new Map();
  opportunities.forEach((row) => {
    if (row.discountPct <= 0 || !Number.isFinite(row.opportunityScore)) return;
    const value = getDimensionValue(row, dimension);
    if (!value) return;
    const scores = opportunityScoresByGroup.get(value.key) ?? [];
    scores.push(row.opportunityScore);
    opportunityScoresByGroup.set(value.key, scores);
  });

  const rows = [...groups.values()]
    .map((group) => {
      const metrics = calculateTrendMetrics(group.rows, anchorMilliseconds, windowDays);
      const areaCounts = new Map();
      group.rows.forEach((row) => areaCounts.set(row.areaKey, (areaCounts.get(row.areaKey) ?? 0) + 1));
      const primaryAreaKey = [...areaCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '';
      const primaryArea = group.rows.find((row) => row.areaKey === primaryAreaKey)?.area ?? '';
      const opportunityScores = opportunityScoresByGroup.get(group.key) ?? [];
      return {
        id: `${dimension}-${group.key}`,
        dimension,
        key: group.key,
        label: group.label,
        primaryArea,
        primaryAreaKey,
        totalSales: group.rows.length,
        ...metrics,
        opportunityIndex: opportunityScores.length ? median(opportunityScores) : null,
        opportunityMatches: opportunityScores.length,
      };
    })
    .filter((row) => row.recentSales > 0 || row.priorSales > 0)
    .sort((left, right) => {
      if (left.confidence === 'Limited' && right.confidence !== 'Limited') return 1;
      if (right.confidence === 'Limited' && left.confidence !== 'Limited') return -1;
      return (right.trendScore ?? -Infinity) - (left.trendScore ?? -Infinity) || right.recentSales - left.recentSales;
    });

  return {
    rows,
    eligibleSales: eligible.length,
    linkedSales: dimension === 'developer' ? eligible.filter((row) => row.developerKey).length : eligible.length,
    period: rows[0]?.period ?? null,
  };
};

export const buildTrendHistory = (transactions, dimension, key) => {
  return monthlyMedians(
    transactions.filter(
      (row) => eligibleTrendSale(row) && (!key || getDimensionValue(row, dimension)?.key === key),
    ),
  ).map((row) => ({
    ...row,
    label: new Date(`${row.month}-01T00:00:00Z`).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }),
  }));
};

export const selectTrendTransactions = (transactions, dimension, key) =>
  transactions
    .filter(
      (row) => eligibleTrendSale(row) && getDimensionValue(row, dimension)?.key === key,
    )
    .sort((left, right) => right.date.localeCompare(left.date) || right.value - left.value);

export const buildTransactionValueHistory = (transactions) => {
  const months = new Map();
  transactions.forEach((row) => {
    const values = months.get(row.month) ?? [];
    values.push(row.value);
    months.set(row.month, values);
  });

  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => ({
      month,
      label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-AE', {
        month: 'short',
        year: '2-digit',
      }),
      medianValue: median(values),
      sales: values.length,
    }));
};

export const summarizeTrendTransactions = (transactions) => {
  const dates = transactions.map((row) => row.date).filter(Boolean).sort();
  return {
    count: transactions.length,
    medianValue: median(transactions.map((row) => row.value)),
    medianPsm: median(transactions.map((row) => row.value / row.actualArea)),
    earliestDate: dates[0] ?? '',
    latestDate: dates.at(-1) ?? '',
  };
};

export const buildTrendMapPoints = (
  transactions,
  areaLocations,
  dimension,
  key,
  windowDays = 90,
) => {
  const selectedRows = transactions.filter(
    (row) => eligibleTrendSale(row) && (!key || getDimensionValue(row, dimension)?.key === key),
  );
  const anchorMilliseconds = selectedRows.reduce(
    (latest, row) => Math.max(latest, asUtcDate(row.date)),
    0,
  );
  if (!anchorMilliseconds) return { points: [], areaCount: 0, mappedAreaCount: 0 };

  const locationByArea = new Map(areaLocations.map((location) => [location.areaKey, location]));
  const areas = new Map();
  selectedRows.forEach((row) => {
    const group = areas.get(row.areaKey) ?? { key: row.areaKey, label: row.area, rows: [] };
    group.rows.push(row);
    areas.set(row.areaKey, group);
  });

  const points = [...areas.values()].flatMap((group) => {
    const metrics = calculateTrendMetrics(group.rows, anchorMilliseconds, windowDays);
    let location = locationByArea.get(group.key);
    let locationBasis = 'Transaction area';
    if (!location) {
      const registeredAreaCounts = new Map();
      group.rows.forEach((row) => {
        if (row.projectRegisteredAreaKey) {
          registeredAreaCounts.set(
            row.projectRegisteredAreaKey,
            (registeredAreaCounts.get(row.projectRegisteredAreaKey) ?? 0) + 1,
          );
        }
      });
      const fallbackKey = [...registeredAreaCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
      location = fallbackKey ? locationByArea.get(fallbackKey) : null;
      locationBasis = 'Registered project area fallback';
    }
    if (!location?.latitude || !location?.longitude || !metrics.recentSales) return [];
    return [{
      id: group.key,
      area: group.label,
      latitude: location.latitude,
      longitude: location.longitude,
      locationConfidence: location.confidence,
      locationBasis,
      ...metrics,
    }];
  });

  return {
    points,
    areaCount: areas.size,
    mappedAreaCount: points.length,
  };
};

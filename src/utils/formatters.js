const compactNumber = new Intl.NumberFormat('en-AE', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const wholeNumber = new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 });

export const formatAed = (value, compact = true) => {
  if (!Number.isFinite(value)) return '—';
  return `AED ${compact ? compactNumber.format(value) : wholeNumber.format(value)}`;
};

export const formatNumber = (value, compact = false) => {
  if (!Number.isFinite(value)) return '—';
  return compact ? compactNumber.format(value) : wholeNumber.format(value);
};

export const formatPercent = (value, digits = 1) =>
  Number.isFinite(value) ? `${value.toFixed(digits)}%` : '—';

export const formatDate = (value) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export const titleCase = (value = '') =>
  value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bB\/r\b/gi, 'B/R')
    .replace(/\bNa\b/g, 'NA');


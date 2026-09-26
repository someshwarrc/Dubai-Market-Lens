export const DLD_EXPORT_URL = 'https://gateway.dubailand.gov.ae/open-data/transactions/export/csv';

export const DLD_COLUMNS = [
  'TRANSACTION_NUMBER',
  'INSTANCE_DATE',
  'GROUP_EN',
  'PROCEDURE_EN',
  'IS_OFFPLAN_EN',
  'IS_FREE_HOLD_EN',
  'USAGE_EN',
  'AREA_EN',
  'PROP_TYPE_EN',
  'PROP_SB_TYPE_EN',
  'TRANS_VALUE',
  'ACTUAL_AREA',
  'ROOMS_EN',
  'NEAREST_METRO_EN',
  'NEAREST_MALL_EN',
  'NEAREST_LANDMARK_EN',
  'PROJECT_EN',
] as const;

export type DldColumn = typeof DLD_COLUMNS[number];
export type DldCsvRecord = Record<DldColumn, string>;

const formatDldDate = (date: Date): string => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}/${day}/${date.getUTCFullYear()}`;
};

export const buildDldPayload = (from: Date, to: Date) => ({
  parameters: {
    P_FROM_DATE: formatDldDate(from),
    P_TO_DATE: formatDldDate(to),
    P_GROUP_ID: '',
    P_IS_OFFPLAN: '',
    P_IS_FREE_HOLD: '',
    P_AREA_ID: '',
    P_USAGE_ID: '',
    P_PROP_TYPE_ID: '',
    P_TAKE: '-1',
    P_SKIP: '',
    P_SORT: 'TRANSACTION_NUMBER_ASC',
  },
  command: 'transactions',
  labels: Object.fromEntries(DLD_COLUMNS.map((column) => [column, column])),
});

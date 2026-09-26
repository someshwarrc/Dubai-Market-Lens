interface TransactionCursor {
  instanceAt: string;
  id: string;
}

export const encodeCursor = (cursor: TransactionCursor): string => Buffer
  .from(JSON.stringify(cursor), 'utf8')
  .toString('base64url');

export const decodeCursor = (value: string | null): TransactionCursor | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<TransactionCursor>;
    if (typeof parsed.instanceAt !== 'string' || typeof parsed.id !== 'string') throw new Error('Invalid cursor');
    if (Number.isNaN(Date.parse(parsed.instanceAt)) || !/^\d+$/.test(parsed.id)) throw new Error('Invalid cursor');
    return { instanceAt: parsed.instanceAt, id: parsed.id };
  } catch {
    throw new Error('Invalid pagination cursor');
  }
};

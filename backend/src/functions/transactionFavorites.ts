import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { authenticateUser, AuthenticationError } from '../auth/supabaseAuth.js';
import { getSqlPool, sql } from '../database.js';
import { jsonResponse, optionsResponse } from '../http.js';

export const parseFavoriteRequest = (body: unknown): { transactionNumber: string; favorite: boolean } => {
  if (!body || typeof body !== 'object') throw new Error('A JSON request body is required.');
  const candidate = body as Record<string, unknown>;
  const transactionNumber = typeof candidate.transactionNumber === 'string' ? candidate.transactionNumber.trim() : '';
  if (!transactionNumber || transactionNumber.length > 64) {
    throw new Error('transactionNumber must be between 1 and 64 characters.');
  }
  if (typeof candidate.favorite !== 'boolean') throw new Error('favorite must be true or false.');
  return { transactionNumber, favorite: candidate.favorite };
};

const handler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  if (request.method === 'OPTIONS') return optionsResponse();

  try {
    const user = await authenticateUser(request);
    const pool = await getSqlPool();

    if (request.method === 'GET') {
      const result = await pool.request()
        .input('userId', sql.NVarChar(64), user.userId)
        .query(`SELECT transaction_number
          FROM market_ingest.transaction_user_favorites
          WHERE user_id = @userId
          ORDER BY created_at DESC`);
      return jsonResponse(200, {
        items: result.recordset.map((row) => row.transaction_number),
        canReview: user.canReview,
      });
    }

    const favorite = parseFavoriteRequest(await request.json());
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      if (favorite.favorite) {
        const existingTransaction = await new sql.Request(transaction)
          .input('transactionNumber', sql.NVarChar(64), favorite.transactionNumber)
          .query(`SELECT COUNT_BIG(*) AS asset_count
            FROM market_ingest.current_transactions
            WHERE transaction_number = @transactionNumber`);
        if (!Number(existingTransaction.recordset[0]?.asset_count ?? 0)) {
          await transaction.rollback();
          return jsonResponse(404, { error: 'The transaction was not found in the current dashboard dataset.' });
        }

        await new sql.Request(transaction)
          .input('userId', sql.NVarChar(64), user.userId)
          .input('userEmail', sql.NVarChar(320), user.email)
          .input('transactionNumber', sql.NVarChar(64), favorite.transactionNumber)
          .query(`UPDATE market_ingest.transaction_user_favorites
            SET user_email = @userEmail, updated_at = SYSUTCDATETIME()
            WHERE user_id = @userId AND transaction_number = @transactionNumber;

            IF @@ROWCOUNT = 0
              INSERT INTO market_ingest.transaction_user_favorites
                (user_id, user_email, transaction_number)
              VALUES
                (@userId, @userEmail, @transactionNumber);`);
      } else {
        await new sql.Request(transaction)
          .input('userId', sql.NVarChar(64), user.userId)
          .input('transactionNumber', sql.NVarChar(64), favorite.transactionNumber)
          .query(`DELETE FROM market_ingest.transaction_user_favorites
            WHERE user_id = @userId AND transaction_number = @transactionNumber`);
      }

      await transaction.commit();
      return jsonResponse(200, {
        transactionNumber: favorite.transactionNumber,
        favorite: favorite.favorite,
      });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthenticationError) return jsonResponse(error.status, { error: error.message });
    const message = error instanceof Error ? error.message : 'Unable to update saved evidence.';
    if (/request body|transactionNumber|favorite/i.test(message)) return jsonResponse(400, { error: message });
    context.error(error);
    return jsonResponse(500, { error: 'Unable to update saved evidence.' });
  }
};

app.http('transactionFavorites', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'operations/transactions/favorites',
  handler,
});

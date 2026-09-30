import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { authenticateReviewer, AuthenticationError } from '../auth/supabaseAuth.js';
import { getSqlPool, sql } from '../database.js';
import { jsonResponse, optionsResponse } from '../http.js';

export type TransactionReviewDecision = 'liked' | 'disliked' | 'neutral';

export const parseTransactionReview = (body: unknown): { transactionNumber: string; decision: TransactionReviewDecision } => {
  if (!body || typeof body !== 'object') throw new Error('A JSON request body is required.');
  const candidate = body as Record<string, unknown>;
  const transactionNumber = typeof candidate.transactionNumber === 'string' ? candidate.transactionNumber.trim() : '';
  const decision = candidate.decision;
  if (!transactionNumber || transactionNumber.length > 64) throw new Error('transactionNumber must be between 1 and 64 characters.');
  if (decision !== 'liked' && decision !== 'disliked' && decision !== 'neutral') {
    throw new Error('decision must be liked, disliked, or neutral.');
  }
  return { transactionNumber, decision };
};

const handler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  if (request.method === 'OPTIONS') return optionsResponse();

  try {
    const reviewer = await authenticateReviewer(request);
    const review = parseTransactionReview(await request.json());
    const pool = await getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const existingTransaction = await new sql.Request(transaction)
        .input('transactionNumber', sql.NVarChar(64), review.transactionNumber)
        .query(`SELECT COUNT_BIG(*) AS asset_count
          FROM market_ingest.transaction_observations
          WHERE transaction_number = @transactionNumber AND is_current = 1`);
      const affectedRows = Number(existingTransaction.recordset[0]?.asset_count ?? 0);
      if (!affectedRows) {
        await transaction.rollback();
        return jsonResponse(404, { error: 'The transaction was not found in the current dataset.' });
      }

      const previousResult = await new sql.Request(transaction)
        .input('transactionNumber', sql.NVarChar(64), review.transactionNumber)
        .query(`SELECT decision
          FROM market_ingest.transaction_review_state WITH (UPDLOCK, HOLDLOCK)
          WHERE transaction_number = @transactionNumber`);
      const previousDecision = previousResult.recordset[0]?.decision as TransactionReviewDecision | undefined;

      if (previousDecision !== review.decision) {
        const write = new sql.Request(transaction)
          .input('transactionNumber', sql.NVarChar(64), review.transactionNumber)
          .input('decision', sql.VarChar(10), review.decision)
          .input('previousDecision', sql.VarChar(10), previousDecision ?? null)
          .input('reviewedByUserId', sql.NVarChar(64), reviewer.userId)
          .input('reviewedByEmail', sql.NVarChar(320), reviewer.email);
        await write.query(`
          UPDATE market_ingest.transaction_review_state
          SET decision = @decision, reviewed_at = SYSUTCDATETIME(),
              reviewed_by_user_id = @reviewedByUserId, reviewed_by_email = @reviewedByEmail
          WHERE transaction_number = @transactionNumber;

          IF @@ROWCOUNT = 0
            INSERT INTO market_ingest.transaction_review_state
              (transaction_number, decision, reviewed_by_user_id, reviewed_by_email)
            VALUES
              (@transactionNumber, @decision, @reviewedByUserId, @reviewedByEmail);

          INSERT INTO market_ingest.transaction_review_events
            (transaction_number, previous_decision, decision, reviewed_by_user_id, reviewed_by_email)
          VALUES
            (@transactionNumber, @previousDecision, @decision, @reviewedByUserId, @reviewedByEmail);`);
      }

      await transaction.commit();
      return jsonResponse(200, {
        transactionNumber: review.transactionNumber,
        decision: review.decision,
        previousDecision: previousDecision ?? null,
        affectedRows,
        changed: previousDecision !== review.decision,
      });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthenticationError) return jsonResponse(error.status, { error: error.message });
    const message = error instanceof Error ? error.message : 'Unable to review the transaction.';
    if (/request body|transactionNumber|decision/i.test(message)) return jsonResponse(400, { error: message });
    context.error(error);
    return jsonResponse(500, { error: 'Unable to review the transaction.' });
  }
};

app.http('reviewTransaction', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'operations/transactions/review',
  handler,
});

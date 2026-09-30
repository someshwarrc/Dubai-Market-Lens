import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { sql, withSqlRetry } from '../database.js';
import { jsonResponse, optionsResponse } from '../http.js';
import { decodeCursor, encodeCursor } from '../pagination.js';
import { queryLimit, queryWindow } from './queryHelpers.js';

const handler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  if (request.method === 'OPTIONS') return optionsResponse();
  try {
    const { from, to, exclusiveTo } = queryWindow(request); const limit = queryLimit(request); const cursor = decodeCursor(request.query.get('cursor'));
    const result = await withSqlRetry((pool) => pool.request().input('from', sql.DateTime2(3), from).input('to', sql.DateTime2(3), exclusiveTo)
      .input('cursorAt', sql.DateTime2(3), cursor ? new Date(cursor.instanceAt) : null).input('cursorId', sql.BigInt, cursor?.id ?? null)
      .input('take', sql.Int, limit + 1).query(`
        SELECT TOP (@take) id, transaction_number, instance_at, group_name, procedure_name,
          offplan_status, freehold_status, usage_name, area_name, property_type, property_sub_type,
          transaction_value, actual_area, rooms, nearest_metro, nearest_mall, nearest_landmark,
          project_name, review_decision, COUNT(*) OVER (PARTITION BY transaction_number) AS asset_count
        FROM market_ingest.current_transactions
        WHERE instance_at >= @from AND instance_at < @to
          AND (@cursorAt IS NULL OR instance_at < @cursorAt OR (instance_at = @cursorAt AND id < @cursorId))
        ORDER BY instance_at DESC, id DESC`));
    const hasMore = result.recordset.length > limit; const rows = hasMore ? result.recordset.slice(0, limit) : result.recordset;
    const items = rows.map((row) => ({
      id: `tx-${row.id}`, transactionNumber: row.transaction_number, date: new Date(row.instance_at).toISOString().slice(0, 10),
      group: row.group_name || 'Unknown', procedure: row.procedure_name || 'Unknown', planStatus: row.offplan_status || 'Unknown',
      tenure: row.freehold_status || 'Unknown', usage: row.usage_name || 'Unknown', area: row.area_name || 'Unknown',
      propertyType: row.property_type || 'Unknown', subType: row.property_sub_type || 'Unspecified', value: Number(row.transaction_value),
      actualArea: Number(row.actual_area), rooms: row.rooms || 'Unspecified', nearestMetro: row.nearest_metro || 'Unspecified',
      nearestMall: row.nearest_mall || 'Unspecified', nearestLandmark: row.nearest_landmark || 'Unspecified',
      project: row.project_name || 'Unspecified', assetCount: Number(row.asset_count), reviewDecision: row.review_decision === 'liked' ? 'liked' : null,
    }));
    const last = rows.at(-1); const nextCursor = hasMore && last ? encodeCursor({ instanceAt: new Date(last.instance_at).toISOString(), id: String(last.id) }) : null;
    return jsonResponse(200, { items, nextCursor, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }, { 'cache-control': 'no-store' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read transactions.';
    const status = /cursor|date|range/i.test(message) ? 400 : 500; if (status === 500) context.error(error);
    return jsonResponse(status, { error: status === 500 ? 'Unable to read transactions.' : message });
  }
};

app.http('getTransactions', { methods: ['GET', 'OPTIONS'], authLevel: 'anonymous', route: 'transactions', handler });

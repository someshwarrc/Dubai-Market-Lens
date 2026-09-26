import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { getSqlPool, sql } from '../database.js';
import { jsonResponse, optionsResponse } from '../http.js';
import { decodeCursor, encodeCursor } from '../pagination.js';
import { queryLimit, queryWindow } from './queryHelpers.js';

const handler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  if (request.method === 'OPTIONS') return optionsResponse();
  try {
    const { from, to, exclusiveTo } = queryWindow(request); const limit = queryLimit(request); const cursor = decodeCursor(request.query.get('cursor'));
    const result = await (await getSqlPool()).request().input('from', sql.DateTime2(3), from).input('to', sql.DateTime2(3), exclusiveTo)
      .input('cursorAt', sql.DateTime2(3), cursor ? new Date(cursor.instanceAt) : null).input('cursorId', sql.BigInt, cursor?.id ?? null)
      .input('take', sql.Int, limit + 1).query(`SELECT TOP (@take) id, procedure_year, procedure_number, instance_at,
        area_name, property_type, property_sub_type, property_total_value, actual_worth, procedure_area, actual_area
        FROM market_ingest.current_valuations WHERE instance_at >= @from AND instance_at < @to
          AND (@cursorAt IS NULL OR instance_at < @cursorAt OR (instance_at = @cursorAt AND id < @cursorId))
        ORDER BY instance_at DESC, id DESC`);
    const hasMore = result.recordset.length > limit; const rows = hasMore ? result.recordset.slice(0, limit) : result.recordset;
    const items = rows.map((row) => ({ id: `val-${row.id}`, procedureYear: row.procedure_year, procedureNumber: row.procedure_number,
      date: new Date(row.instance_at).toISOString().slice(0, 10), area: row.area_name || 'Unknown', propertyType: row.property_type || 'Unknown',
      subType: row.property_sub_type || 'Unspecified', totalValue: Number(row.property_total_value), actualWorth: Number(row.actual_worth),
      procedureArea: Number(row.procedure_area), actualArea: Number(row.actual_area) }));
    const last = rows.at(-1); const nextCursor = hasMore && last ? encodeCursor({ instanceAt: new Date(last.instance_at).toISOString(), id: String(last.id) }) : null;
    return jsonResponse(200, { items, nextCursor, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }, { 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' });
  } catch (error) { const message = error instanceof Error ? error.message : ''; const status = /cursor|date|range/i.test(message) ? 400 : 500; if (status === 500) context.error(error); return jsonResponse(status, { error: status === 500 ? 'Unable to read valuations.' : message }); }
};
app.http('getValuations', { methods: ['GET', 'OPTIONS'], authLevel: 'anonymous', route: 'valuations', handler });

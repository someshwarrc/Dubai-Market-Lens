import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { getSqlPool } from '../database.js';
import { jsonResponse, optionsResponse } from '../http.js';

const handler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
  if (request.method === 'OPTIONS') return optionsResponse();
  try {
    const result = await (await getSqlPool()).request().query(`SELECT project_number, project_name, developer_name,
      project_status, percent_completed, registered_area FROM market_ingest.projects ORDER BY project_name`);
    return jsonResponse(200, { items: result.recordset.map((row) => ({
      projectNumber: row.project_number, project: row.project_name, developer: row.developer_name,
      projectStatus: row.project_status, percentCompleted: Number(row.percent_completed), registeredArea: row.registered_area,
    })) }, { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' });
  } catch (error) { context.error(error); return jsonResponse(500, { error: 'Unable to read projects.' }); }
};
app.http('getProjects', { methods: ['GET', 'OPTIONS'], authLevel: 'anonymous', route: 'projects', handler });

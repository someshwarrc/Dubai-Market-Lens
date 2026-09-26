import sql from 'mssql';
import type { ParsedDldRow } from '../dld/parser.js';
import type { ParsedDldProject, ParsedDldValuation } from '../dld/referenceData.js';

const stageTable = (runId: number, rows: ParsedDldRow[]): sql.Table => {
  const table = new sql.Table('market_ingest.transaction_stage');
  table.create = false;
  table.columns.add('run_id', sql.BigInt, { nullable: false });
  table.columns.add('transaction_number', sql.NVarChar(64), { nullable: false });
  table.columns.add('instance_at', sql.DateTime2(3), { nullable: false });
  table.columns.add('group_name', sql.NVarChar(100), { nullable: false });
  table.columns.add('procedure_name', sql.NVarChar(200), { nullable: false });
  table.columns.add('offplan_status', sql.NVarChar(64), { nullable: false });
  table.columns.add('freehold_status', sql.NVarChar(64), { nullable: false });
  table.columns.add('usage_name', sql.NVarChar(100), { nullable: false });
  table.columns.add('area_name', sql.NVarChar(200), { nullable: false });
  table.columns.add('property_type', sql.NVarChar(100), { nullable: false });
  table.columns.add('property_sub_type', sql.NVarChar(100), { nullable: false });
  table.columns.add('transaction_value', sql.Decimal(18, 2), { nullable: false });
  table.columns.add('actual_area', sql.Decimal(18, 4), { nullable: false });
  table.columns.add('rooms', sql.NVarChar(64), { nullable: false });
  table.columns.add('nearest_metro', sql.NVarChar(200), { nullable: false });
  table.columns.add('nearest_mall', sql.NVarChar(200), { nullable: false });
  table.columns.add('nearest_landmark', sql.NVarChar(200), { nullable: false });
  table.columns.add('project_name', sql.NVarChar(300), { nullable: false });
  table.columns.add('source_row_hash', sql.Char(64), { nullable: false });
  table.columns.add('duplicate_ordinal', sql.SmallInt, { nullable: false });
  rows.forEach((row) => table.rows.add(
    runId,
    row.transactionNumber,
    row.instanceAt,
    row.groupName,
    row.procedureName,
    row.offPlanStatus,
    row.freeholdStatus,
    row.usageName,
    row.areaName,
    row.propertyType,
    row.propertySubType,
    row.transactionValue,
    row.actualArea,
    row.rooms,
    row.nearestMetro,
    row.nearestMall,
    row.nearestLandmark,
    row.projectName,
    row.sourceRowHash,
    row.duplicateOrdinal,
  ));
  return table;
};

export const ingestRows = async (transaction: sql.Transaction, runId: number, rows: ParsedDldRow[]): Promise<void> => {
  if (!rows.length) return;
  await new sql.Request(transaction).bulk(stageTable(runId, rows));
  await new sql.Request(transaction)
    .input('runId', sql.BigInt, runId)
    .query(`
      UPDATE target
      SET is_current = 0
      FROM market_ingest.transaction_observations target
      INNER JOIN (
        SELECT DISTINCT transaction_number
        FROM market_ingest.transaction_stage
        WHERE run_id = @runId
      ) source ON source.transaction_number = target.transaction_number
      WHERE target.is_current = 1;

      UPDATE target
      SET instance_at = source.instance_at,
          group_name = source.group_name,
          procedure_name = source.procedure_name,
          offplan_status = source.offplan_status,
          freehold_status = source.freehold_status,
          usage_name = source.usage_name,
          area_name = source.area_name,
          property_type = source.property_type,
          property_sub_type = source.property_sub_type,
          transaction_value = source.transaction_value,
          actual_area = source.actual_area,
          rooms = source.rooms,
          nearest_metro = source.nearest_metro,
          nearest_mall = source.nearest_mall,
          nearest_landmark = source.nearest_landmark,
          project_name = source.project_name,
          is_current = 1,
          last_seen_run_id = @runId,
          last_seen_at = SYSUTCDATETIME()
      FROM market_ingest.transaction_observations target
      INNER JOIN market_ingest.transaction_stage source
        ON source.run_id = @runId
       AND source.transaction_number = target.transaction_number
       AND source.source_row_hash = target.source_row_hash
       AND source.duplicate_ordinal = target.duplicate_ordinal;

      INSERT INTO market_ingest.transaction_observations (
        transaction_number, instance_at, group_name, procedure_name, offplan_status,
        freehold_status, usage_name, area_name, property_type, property_sub_type,
        transaction_value, actual_area, rooms, nearest_metro, nearest_mall,
        nearest_landmark, project_name, source_row_hash, duplicate_ordinal,
        first_seen_run_id, last_seen_run_id
      )
      SELECT source.transaction_number, source.instance_at, source.group_name, source.procedure_name,
             source.offplan_status, source.freehold_status, source.usage_name, source.area_name,
             source.property_type, source.property_sub_type, source.transaction_value,
             source.actual_area, source.rooms, source.nearest_metro, source.nearest_mall,
             source.nearest_landmark, source.project_name, source.source_row_hash,
             source.duplicate_ordinal, @runId, @runId
      FROM market_ingest.transaction_stage source
      WHERE source.run_id = @runId
        AND NOT EXISTS (
          SELECT 1 FROM market_ingest.transaction_observations target
          WHERE target.transaction_number = source.transaction_number
            AND target.source_row_hash = source.source_row_hash
            AND target.duplicate_ordinal = source.duplicate_ordinal
        );

      DELETE FROM market_ingest.transaction_stage WHERE run_id = @runId;
    `);
};

export const ingestProjects = async (transaction: sql.Transaction, runId: number, rows: ParsedDldProject[]): Promise<void> => {
  const table = new sql.Table('market_ingest.project_stage');
  table.create = false;
  table.columns.add('run_id', sql.BigInt, { nullable: false });
  table.columns.add('project_number', sql.NVarChar(50), { nullable: false });
  table.columns.add('project_name', sql.NVarChar(300), { nullable: false });
  table.columns.add('developer_name', sql.NVarChar(300), { nullable: false });
  table.columns.add('project_status', sql.NVarChar(100), { nullable: false });
  table.columns.add('percent_completed', sql.Decimal(7, 3), { nullable: false });
  table.columns.add('registered_area', sql.NVarChar(200), { nullable: false });
  table.columns.add('source_row_hash', sql.Char(64), { nullable: false });
  rows.forEach((row) => table.rows.add(runId, row.projectNumber, row.projectName, row.developerName,
    row.projectStatus, row.percentCompleted, row.registeredArea, row.sourceRowHash));
  if (rows.length) await new sql.Request(transaction).bulk(table);
  await new sql.Request(transaction).input('runId', sql.BigInt, runId).query(`
    UPDATE target SET project_name = source.project_name, developer_name = source.developer_name,
      project_status = source.project_status, percent_completed = source.percent_completed,
      registered_area = source.registered_area, source_row_hash = source.source_row_hash,
      last_seen_run_id = @runId, last_seen_at = SYSUTCDATETIME()
    FROM market_ingest.projects target
    INNER JOIN market_ingest.project_stage source
      ON source.run_id = @runId AND source.project_number = target.project_number;

    INSERT INTO market_ingest.projects(project_number, project_name, developer_name, project_status,
      percent_completed, registered_area, source_row_hash, last_seen_run_id)
    SELECT source.project_number, source.project_name, source.developer_name, source.project_status,
      source.percent_completed, source.registered_area, source.source_row_hash, @runId
    FROM market_ingest.project_stage source
    WHERE source.run_id = @runId AND NOT EXISTS (
      SELECT 1 FROM market_ingest.projects target WHERE target.project_number = source.project_number
    );
    DELETE FROM market_ingest.project_stage WHERE run_id = @runId;
  `);
};

export const ingestValuations = async (transaction: sql.Transaction, runId: number, rows: ParsedDldValuation[]): Promise<void> => {
  const table = new sql.Table('market_ingest.valuation_stage');
  table.create = false;
  table.columns.add('run_id', sql.BigInt, { nullable: false });
  table.columns.add('procedure_year', sql.Int, { nullable: false });
  table.columns.add('procedure_number', sql.NVarChar(64), { nullable: false });
  table.columns.add('instance_at', sql.DateTime2(3), { nullable: false });
  table.columns.add('area_name', sql.NVarChar(200), { nullable: false });
  table.columns.add('property_type', sql.NVarChar(100), { nullable: false });
  table.columns.add('property_sub_type', sql.NVarChar(100), { nullable: false });
  table.columns.add('property_total_value', sql.Decimal(18, 2), { nullable: false });
  table.columns.add('actual_worth', sql.Decimal(18, 2), { nullable: false });
  table.columns.add('procedure_area', sql.Decimal(18, 4), { nullable: false });
  table.columns.add('actual_area', sql.Decimal(18, 4), { nullable: false });
  table.columns.add('source_row_hash', sql.Char(64), { nullable: false });
  table.columns.add('duplicate_ordinal', sql.SmallInt, { nullable: false });
  rows.forEach((row) => table.rows.add(runId, row.procedureYear, row.procedureNumber, row.instanceAt,
    row.areaName, row.propertyType, row.propertySubType, row.propertyTotalValue, row.actualWorth,
    row.procedureArea, row.actualArea, row.sourceRowHash, row.duplicateOrdinal));
  if (rows.length) await new sql.Request(transaction).bulk(table);
  await new sql.Request(transaction).input('runId', sql.BigInt, runId).query(`
    UPDATE market_ingest.valuations SET is_current = 0 WHERE is_current = 1;
    UPDATE target SET instance_at = source.instance_at, area_name = source.area_name,
      property_type = source.property_type, property_sub_type = source.property_sub_type,
      property_total_value = source.property_total_value, actual_worth = source.actual_worth,
      procedure_area = source.procedure_area, actual_area = source.actual_area,
      is_current = 1, last_seen_run_id = @runId, last_seen_at = SYSUTCDATETIME()
    FROM market_ingest.valuations target
    INNER JOIN market_ingest.valuation_stage source ON source.run_id = @runId
      AND source.procedure_year = target.procedure_year
      AND source.procedure_number = target.procedure_number
      AND source.source_row_hash = target.source_row_hash
      AND source.duplicate_ordinal = target.duplicate_ordinal;
    INSERT INTO market_ingest.valuations(procedure_year, procedure_number, instance_at, area_name,
      property_type, property_sub_type, property_total_value, actual_worth, procedure_area,
      actual_area, source_row_hash, duplicate_ordinal, first_seen_run_id, last_seen_run_id)
    SELECT source.procedure_year, source.procedure_number, source.instance_at, source.area_name,
      source.property_type, source.property_sub_type, source.property_total_value, source.actual_worth,
      source.procedure_area, source.actual_area, source.source_row_hash, source.duplicate_ordinal,
      @runId, @runId
    FROM market_ingest.valuation_stage source WHERE source.run_id = @runId AND NOT EXISTS (
      SELECT 1 FROM market_ingest.valuations target
      WHERE target.procedure_year = source.procedure_year
        AND target.procedure_number = source.procedure_number
        AND target.source_row_hash = source.source_row_hash
        AND target.duplicate_ordinal = source.duplicate_ordinal
    );
    DELETE FROM market_ingest.valuation_stage WHERE run_id = @runId;
  `);
};

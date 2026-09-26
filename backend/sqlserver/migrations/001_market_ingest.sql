IF SCHEMA_ID(N'market_ingest') IS NULL EXEC(N'CREATE SCHEMA market_ingest');
GO

CREATE TABLE market_ingest.sync_runs (
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_sync_runs PRIMARY KEY,
  dataset varchar(20) NOT NULL CONSTRAINT ck_sync_runs_dataset CHECK (dataset IN ('transactions', 'projects', 'valuations')),
  trigger_type varchar(20) NOT NULL CONSTRAINT ck_sync_runs_trigger CHECK (trigger_type IN ('seed', 'scheduled', 'manual')),
  status varchar(20) NOT NULL CONSTRAINT ck_sync_runs_status CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  requested_from date NOT NULL,
  requested_to date NOT NULL,
  started_at datetime2(3) NOT NULL CONSTRAINT df_sync_runs_started DEFAULT SYSUTCDATETIME(),
  completed_at datetime2(3) NULL,
  source_http_status int NULL,
  source_bytes bigint NULL,
  source_sha256 char(64) NULL,
  row_count int NULL,
  unique_record_count int NULL,
  observed_min_at datetime2(3) NULL,
  observed_max_at datetime2(3) NULL,
  error_code varchar(64) NULL,
  error_message nvarchar(1000) NULL,
  CONSTRAINT ck_sync_run_date_order CHECK (requested_to >= requested_from),
  CONSTRAINT ck_sync_run_completion CHECK (
    (status = 'running' AND completed_at IS NULL)
    OR (status <> 'running' AND completed_at IS NOT NULL)
  )
);
GO

CREATE INDEX ix_sync_runs_dataset_completed
  ON market_ingest.sync_runs(dataset, completed_at DESC)
  WHERE status = 'succeeded';
GO

CREATE TABLE market_ingest.transaction_observations (
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_transaction_observations PRIMARY KEY,
  transaction_number nvarchar(64) NOT NULL,
  instance_at datetime2(3) NOT NULL,
  group_name nvarchar(100) NOT NULL CONSTRAINT df_transactions_group DEFAULT N'',
  procedure_name nvarchar(200) NOT NULL CONSTRAINT df_transactions_procedure DEFAULT N'',
  offplan_status nvarchar(64) NOT NULL CONSTRAINT df_transactions_offplan DEFAULT N'',
  freehold_status nvarchar(64) NOT NULL CONSTRAINT df_transactions_freehold DEFAULT N'',
  usage_name nvarchar(100) NOT NULL CONSTRAINT df_transactions_usage DEFAULT N'',
  area_name nvarchar(200) NOT NULL CONSTRAINT df_transactions_area DEFAULT N'',
  property_type nvarchar(100) NOT NULL CONSTRAINT df_transactions_property_type DEFAULT N'',
  property_sub_type nvarchar(100) NOT NULL CONSTRAINT df_transactions_property_sub_type DEFAULT N'',
  transaction_value decimal(18,2) NOT NULL CONSTRAINT ck_transactions_value CHECK (transaction_value >= 0),
  actual_area decimal(18,4) NOT NULL CONSTRAINT ck_transactions_area CHECK (actual_area >= 0),
  rooms nvarchar(64) NOT NULL CONSTRAINT df_transactions_rooms DEFAULT N'',
  nearest_metro nvarchar(200) NOT NULL CONSTRAINT df_transactions_metro DEFAULT N'',
  nearest_mall nvarchar(200) NOT NULL CONSTRAINT df_transactions_mall DEFAULT N'',
  nearest_landmark nvarchar(200) NOT NULL CONSTRAINT df_transactions_landmark DEFAULT N'',
  project_name nvarchar(300) NOT NULL CONSTRAINT df_transactions_project DEFAULT N'',
  source_row_hash char(64) NOT NULL,
  duplicate_ordinal smallint NOT NULL CONSTRAINT ck_transactions_ordinal CHECK (duplicate_ordinal > 0),
  is_current bit NOT NULL CONSTRAINT df_transactions_current DEFAULT 1,
  first_seen_run_id bigint NOT NULL CONSTRAINT fk_transactions_first_run REFERENCES market_ingest.sync_runs(id),
  last_seen_run_id bigint NOT NULL CONSTRAINT fk_transactions_last_run REFERENCES market_ingest.sync_runs(id),
  first_seen_at datetime2(3) NOT NULL CONSTRAINT df_transactions_first_seen DEFAULT SYSUTCDATETIME(),
  last_seen_at datetime2(3) NOT NULL CONSTRAINT df_transactions_last_seen DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_transaction_observation UNIQUE(transaction_number, source_row_hash, duplicate_ordinal)
);
GO

CREATE INDEX ix_transactions_current_date
  ON market_ingest.transaction_observations(instance_at DESC, id DESC)
  WHERE is_current = 1;
GO

CREATE INDEX ix_transactions_area_current_date
  ON market_ingest.transaction_observations(area_name, instance_at DESC)
  WHERE is_current = 1;
GO

CREATE INDEX ix_transactions_project_current_date
  ON market_ingest.transaction_observations(project_name, instance_at DESC)
  WHERE is_current = 1 AND project_name <> N'';
GO

CREATE TABLE market_ingest.transaction_stage (
  run_id bigint NOT NULL,
  transaction_number nvarchar(64) NOT NULL,
  instance_at datetime2(3) NOT NULL,
  group_name nvarchar(100) NOT NULL,
  procedure_name nvarchar(200) NOT NULL,
  offplan_status nvarchar(64) NOT NULL,
  freehold_status nvarchar(64) NOT NULL,
  usage_name nvarchar(100) NOT NULL,
  area_name nvarchar(200) NOT NULL,
  property_type nvarchar(100) NOT NULL,
  property_sub_type nvarchar(100) NOT NULL,
  transaction_value decimal(18,2) NOT NULL,
  actual_area decimal(18,4) NOT NULL,
  rooms nvarchar(64) NOT NULL,
  nearest_metro nvarchar(200) NOT NULL,
  nearest_mall nvarchar(200) NOT NULL,
  nearest_landmark nvarchar(200) NOT NULL,
  project_name nvarchar(300) NOT NULL,
  source_row_hash char(64) NOT NULL,
  duplicate_ordinal smallint NOT NULL
);
GO

CREATE INDEX ix_transaction_stage_run ON market_ingest.transaction_stage(run_id);
GO

CREATE TABLE market_ingest.projects (
  project_number nvarchar(50) NOT NULL CONSTRAINT pk_projects PRIMARY KEY,
  project_name nvarchar(300) NOT NULL,
  developer_name nvarchar(300) NOT NULL,
  project_status nvarchar(100) NOT NULL,
  percent_completed decimal(7,3) NOT NULL,
  registered_area nvarchar(200) NOT NULL,
  source_row_hash char(64) NOT NULL,
  last_seen_run_id bigint NOT NULL CONSTRAINT fk_projects_last_run REFERENCES market_ingest.sync_runs(id),
  last_seen_at datetime2(3) NOT NULL CONSTRAINT df_projects_last_seen DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX ix_projects_name ON market_ingest.projects(project_name);
GO

CREATE TABLE market_ingest.project_stage (
  run_id bigint NOT NULL,
  project_number nvarchar(50) NOT NULL,
  project_name nvarchar(300) NOT NULL,
  developer_name nvarchar(300) NOT NULL,
  project_status nvarchar(100) NOT NULL,
  percent_completed decimal(7,3) NOT NULL,
  registered_area nvarchar(200) NOT NULL,
  source_row_hash char(64) NOT NULL
);
GO

CREATE INDEX ix_project_stage_run ON market_ingest.project_stage(run_id);
GO

CREATE TABLE market_ingest.valuations (
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_valuations PRIMARY KEY,
  procedure_year int NOT NULL,
  procedure_number nvarchar(64) NOT NULL,
  instance_at datetime2(3) NOT NULL,
  area_name nvarchar(200) NOT NULL,
  property_type nvarchar(100) NOT NULL,
  property_sub_type nvarchar(100) NOT NULL,
  property_total_value decimal(18,2) NOT NULL CONSTRAINT ck_valuations_total CHECK (property_total_value >= 0),
  actual_worth decimal(18,2) NOT NULL CONSTRAINT ck_valuations_worth CHECK (actual_worth >= 0),
  procedure_area decimal(18,4) NOT NULL CONSTRAINT ck_valuations_procedure_area CHECK (procedure_area >= 0),
  actual_area decimal(18,4) NOT NULL CONSTRAINT ck_valuations_actual_area CHECK (actual_area >= 0),
  source_row_hash char(64) NOT NULL,
  duplicate_ordinal smallint NOT NULL CONSTRAINT ck_valuations_ordinal CHECK (duplicate_ordinal > 0),
  is_current bit NOT NULL CONSTRAINT df_valuations_current DEFAULT 1,
  first_seen_run_id bigint NOT NULL CONSTRAINT fk_valuations_first_run REFERENCES market_ingest.sync_runs(id),
  last_seen_run_id bigint NOT NULL CONSTRAINT fk_valuations_last_run REFERENCES market_ingest.sync_runs(id),
  first_seen_at datetime2(3) NOT NULL CONSTRAINT df_valuations_first_seen DEFAULT SYSUTCDATETIME(),
  last_seen_at datetime2(3) NOT NULL CONSTRAINT df_valuations_last_seen DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_valuation_observation UNIQUE(procedure_year, procedure_number, source_row_hash, duplicate_ordinal)
);
GO

CREATE INDEX ix_valuations_current_date
  ON market_ingest.valuations(instance_at DESC, id DESC)
  WHERE is_current = 1;
GO

CREATE INDEX ix_valuations_market_segment
  ON market_ingest.valuations(area_name, property_type, property_sub_type, instance_at DESC)
  WHERE is_current = 1;
GO

CREATE TABLE market_ingest.valuation_stage (
  run_id bigint NOT NULL,
  procedure_year int NOT NULL,
  procedure_number nvarchar(64) NOT NULL,
  instance_at datetime2(3) NOT NULL,
  area_name nvarchar(200) NOT NULL,
  property_type nvarchar(100) NOT NULL,
  property_sub_type nvarchar(100) NOT NULL,
  property_total_value decimal(18,2) NOT NULL,
  actual_worth decimal(18,2) NOT NULL,
  procedure_area decimal(18,4) NOT NULL,
  actual_area decimal(18,4) NOT NULL,
  source_row_hash char(64) NOT NULL,
  duplicate_ordinal smallint NOT NULL
);
GO

CREATE INDEX ix_valuation_stage_run ON market_ingest.valuation_stage(run_id);
GO

CREATE VIEW market_ingest.current_transactions AS
SELECT * FROM market_ingest.transaction_observations WHERE is_current = 1;
GO

CREATE VIEW market_ingest.current_valuations AS
SELECT * FROM market_ingest.valuations WHERE is_current = 1;
GO

CREATE ROLE market_api;
CREATE ROLE market_ingest_writer;
GRANT SELECT ON OBJECT::market_ingest.current_transactions TO market_api;
GRANT SELECT ON OBJECT::market_ingest.current_valuations TO market_api;
GRANT SELECT ON OBJECT::market_ingest.projects TO market_api;
GRANT SELECT ON OBJECT::market_ingest.sync_runs TO market_api;
GRANT SELECT, INSERT, UPDATE ON OBJECT::market_ingest.sync_runs TO market_ingest_writer;
GRANT SELECT, INSERT, UPDATE ON OBJECT::market_ingest.transaction_observations TO market_ingest_writer;
GRANT SELECT, INSERT, DELETE ON OBJECT::market_ingest.transaction_stage TO market_ingest_writer;
GRANT SELECT, INSERT, UPDATE ON OBJECT::market_ingest.projects TO market_ingest_writer;
GRANT SELECT, INSERT, DELETE ON OBJECT::market_ingest.project_stage TO market_ingest_writer;
GRANT SELECT, INSERT, UPDATE ON OBJECT::market_ingest.valuations TO market_ingest_writer;
GRANT SELECT, INSERT, DELETE ON OBJECT::market_ingest.valuation_stage TO market_ingest_writer;
GO

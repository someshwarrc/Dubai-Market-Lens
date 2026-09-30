CREATE TABLE market_ingest.transaction_review_state (
  transaction_number nvarchar(64) NOT NULL CONSTRAINT pk_transaction_review_state PRIMARY KEY,
  decision varchar(10) NOT NULL,
  reviewed_at datetime2(3) NOT NULL CONSTRAINT df_transaction_review_state_reviewed_at DEFAULT SYSUTCDATETIME(),
  reviewed_by_user_id nvarchar(64) NOT NULL,
  reviewed_by_email nvarchar(320) NOT NULL,
  CONSTRAINT ck_transaction_review_state_decision CHECK (decision IN ('liked', 'disliked', 'neutral'))
);
GO

CREATE TABLE market_ingest.transaction_review_events (
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_transaction_review_events PRIMARY KEY,
  transaction_number nvarchar(64) NOT NULL,
  previous_decision varchar(10) NULL,
  decision varchar(10) NOT NULL,
  reviewed_at datetime2(3) NOT NULL CONSTRAINT df_transaction_review_events_reviewed_at DEFAULT SYSUTCDATETIME(),
  reviewed_by_user_id nvarchar(64) NOT NULL,
  reviewed_by_email nvarchar(320) NOT NULL,
  CONSTRAINT ck_transaction_review_events_previous_decision CHECK (previous_decision IS NULL OR previous_decision IN ('liked', 'disliked', 'neutral')),
  CONSTRAINT ck_transaction_review_events_decision CHECK (decision IN ('liked', 'disliked', 'neutral'))
);
GO

CREATE INDEX ix_transaction_review_events_transaction
  ON market_ingest.transaction_review_events(transaction_number, reviewed_at DESC);
GO

CREATE OR ALTER VIEW market_ingest.current_transactions AS
SELECT observation.*, review_state.decision AS review_decision
FROM market_ingest.transaction_observations observation
LEFT JOIN market_ingest.transaction_review_state review_state
  ON review_state.transaction_number = observation.transaction_number
WHERE observation.is_current = 1
  AND (review_state.decision IS NULL OR review_state.decision <> 'disliked');
GO

GRANT SELECT ON OBJECT::market_ingest.transaction_review_state TO market_api;
GRANT SELECT, INSERT, UPDATE ON OBJECT::market_ingest.transaction_review_state TO market_ingest_writer;
GRANT SELECT, INSERT ON OBJECT::market_ingest.transaction_review_events TO market_ingest_writer;
GO

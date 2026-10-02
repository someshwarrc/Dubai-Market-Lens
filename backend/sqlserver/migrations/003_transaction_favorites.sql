CREATE TABLE market_ingest.transaction_user_favorites (
  user_id nvarchar(64) NOT NULL,
  user_email nvarchar(320) NOT NULL,
  transaction_number nvarchar(64) NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT df_transaction_user_favorites_created_at DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT df_transaction_user_favorites_updated_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT pk_transaction_user_favorites PRIMARY KEY (user_id, transaction_number)
);
GO

CREATE INDEX ix_transaction_user_favorites_transaction
  ON market_ingest.transaction_user_favorites(transaction_number, user_id);
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::market_ingest.transaction_user_favorites TO market_ingest_writer;
GO

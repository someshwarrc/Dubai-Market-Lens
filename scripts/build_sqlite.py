import csv
import gzip
import shutil
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "source-data"
PUBLIC_DIR = ROOT / "files"
DATABASE_PATH = PUBLIC_DIR / "dubai-market.sqlite"
ARCHIVE_PATH = PUBLIC_DIR / "dubai-market.sqlite.gz"

DATASETS = {
    "transactions": SOURCE_DIR / "transactions-2026-08-17.csv",
    "valuations": SOURCE_DIR / "valuations-2026-08-17.csv",
}

SCHEMAS = {
    "transactions": [
        ("TRANSACTION_NUMBER", "TEXT"), ("INSTANCE_DATE", "TEXT"),
        ("GROUP_EN", "TEXT"), ("PROCEDURE_EN", "TEXT"),
        ("IS_OFFPLAN_EN", "TEXT"), ("IS_FREE_HOLD_EN", "TEXT"),
        ("USAGE_EN", "TEXT"), ("AREA_EN", "TEXT"),
        ("PROP_TYPE_EN", "TEXT"), ("PROP_SB_TYPE_EN", "TEXT"),
        ("TRANS_VALUE", "REAL"), ("PROCEDURE_AREA", "REAL"),
        ("ACTUAL_AREA", "REAL"), ("ROOMS_EN", "TEXT"),
        ("PARKING", "INTEGER"), ("NEAREST_METRO_EN", "TEXT"),
        ("NEAREST_MALL_EN", "TEXT"), ("NEAREST_LANDMARK_EN", "TEXT"),
        ("TOTAL_BUYER", "INTEGER"), ("TOTAL_SELLER", "INTEGER"),
        ("MASTER_PROJECT_EN", "TEXT"), ("PROJECT_EN", "TEXT"),
    ],
    "valuations": [
        ("PROPERTY_TOTAL_VALUE", "REAL"), ("AREA_EN", "TEXT"),
        ("ACTUAL_AREA", "REAL"), ("PROCEDURE_YEAR", "INTEGER"),
        ("PROCEDURE_NUMBER", "TEXT"), ("INSTANCE_DATE", "TEXT"),
        ("ACTUAL_WORTH", "REAL"), ("PROCEDURE_AREA", "REAL"),
        ("PROPERTY_TYPE_EN", "TEXT"), ("PROP_SUB_TYPE_EN", "TEXT"),
    ],
}


def coerce(value: str, sql_type: str):
    if sql_type == "TEXT":
        return value
    if value == "":
        return None
    try:
        return int(float(value)) if sql_type == "INTEGER" else float(value)
    except ValueError:
        return None


def import_dataset(connection: sqlite3.Connection, table: str, csv_path: Path):
    columns = SCHEMAS[table]
    column_sql = ", ".join(f'"{name}" {sql_type}' for name, sql_type in columns)
    connection.execute(f'CREATE TABLE "{table}" ({column_sql})')
    placeholders = ", ".join("?" for _ in columns)
    insert_sql = f'INSERT INTO "{table}" VALUES ({placeholders})'

    with csv_path.open("r", encoding="utf-8-sig", newline="") as stream:
        rows = csv.DictReader(stream)
        batch = []
        for row in rows:
            batch.append(tuple(coerce(row[name], sql_type) for name, sql_type in columns))
            if len(batch) == 2_000:
                connection.executemany(insert_sql, batch)
                batch.clear()
        if batch:
            connection.executemany(insert_sql, batch)


def main():
    missing = [str(path) for path in DATASETS.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing source datasets: {', '.join(missing)}")

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    DATABASE_PATH.unlink(missing_ok=True)
    ARCHIVE_PATH.unlink(missing_ok=True)

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute("PRAGMA journal_mode = OFF")
        connection.execute("PRAGMA synchronous = OFF")
        for table, csv_path in DATASETS.items():
            import_dataset(connection, table, csv_path)
        connection.execute("CREATE INDEX ix_transactions_market_segment ON transactions (AREA_EN, PROP_TYPE_EN, PROP_SB_TYPE_EN, INSTANCE_DATE)")
        connection.execute("CREATE INDEX ix_valuations_market_segment ON valuations (AREA_EN, PROPERTY_TYPE_EN, PROP_SUB_TYPE_EN, INSTANCE_DATE)")
        connection.commit()
        connection.execute("VACUUM")

        transaction_count = connection.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        valuation_count = connection.execute("SELECT COUNT(*) FROM valuations").fetchone()[0]
    connection.close()

    with DATABASE_PATH.open("rb") as source, ARCHIVE_PATH.open("wb") as target:
        with gzip.GzipFile(filename="dubai-market.sqlite", mode="wb", fileobj=target, mtime=0) as compressed:
            shutil.copyfileobj(source, compressed)
    DATABASE_PATH.unlink()
    print(
        f"Created {ARCHIVE_PATH.name} ({ARCHIVE_PATH.stat().st_size:,} bytes) "
        f"with {transaction_count:,} transactions and {valuation_count:,} valuations"
    )


if __name__ == "__main__":
    main()

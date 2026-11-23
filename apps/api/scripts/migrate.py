"""Apply the SQL files in apps/api/db/migrations that haven't run yet.

Usage (from the repo root; Render runs it before starting the API):
    python -m apps.api.scripts.migrate

Applied files are recorded in `schema_migrations`, so each runs once. A database
set up before this runner existed (tables already there, no record table) is
detected, and 0001_init is marked as applied instead of re-run; the later files
are safe to run again.
"""

import asyncio
import logging
import sys
from pathlib import Path

from apps.api.db.session import engine

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "db" / "migrations"
log = logging.getLogger("leadforge.migrate")


def migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


async def run() -> list[str]:
    applied_now: list[str] = []
    async with engine.connect() as conn:
        raw = await conn.get_raw_connection()
        db = raw.driver_connection  # the asyncpg connection: runs multi-statement SQL files as-is

        tracked = await db.fetchval("select to_regclass('public.schema_migrations') is not null")
        await db.execute(
            "create table if not exists schema_migrations ("
            " filename text primary key, applied_at timestamptz not null default now())"
        )
        if not tracked and await db.fetchval("select to_regclass('public.organizations') is not null"):
            # Existing database from before this runner: its schema came from 0001 by hand
            await db.execute(
                "insert into schema_migrations (filename) values ('0001_init.sql') on conflict do nothing"
            )
            log.info("Existing schema found; recorded 0001_init.sql as already applied")

        done = {r["filename"] for r in await db.fetch("select filename from schema_migrations")}
        for path in migration_files():
            if path.name in done:
                continue
            log.info("Applying %s", path.name)
            await db.execute(path.read_text(encoding="utf-8"))
            await db.execute("insert into schema_migrations (filename) values ($1)", path.name)
            applied_now.append(path.name)
    await engine.dispose()
    return applied_now


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        applied = asyncio.run(run())
    except Exception as exc:  # noqa: BLE001 - show a clear message, then fail the deploy
        log.error("Migration failed: %s", exc)
        sys.exit(1)
    log.info("Migrations up to date%s", f" (applied {', '.join(applied)})" if applied else "")


if __name__ == "__main__":
    main()

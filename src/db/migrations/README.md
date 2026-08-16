# Database migrations

BookieBall contains a long-lived multi-season SQLite archive. Schema changes must therefore be additive, transactional and recoverable.

## Rules

1. Never hard-delete historical competition/entry rows as part of a schema migration.
2. Create a database backup before applying a migration that changes persisted structure.
3. Migrations must be idempotent: running startup twice must not duplicate columns/tables/data.
4. Each migration gets a monotonically increasing version and a short name.
5. Apply migrations inside a transaction where SQLite allows it.
6. Backfill derived values separately from schema creation when the operation can be expensive.
7. Add a regression test whenever a migration changes competition resolution/history semantics.
8. Keep runtime compatibility with existing local databases created in earlier BookieBall versions.

## Target structure

As `src/db/database.ts` is split, migrations should move into numbered modules here and be registered by a small migration runner. The compatibility migration code in `database.ts` remains authoritative until each existing migration has been moved and regression-tested.

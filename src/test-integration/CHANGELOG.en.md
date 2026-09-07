# Changelog (src/test-integration)

Change history for the `src/test-integration` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 9 Step 1. Real-DB smoke tests (PostgreSQL/MySQL)**
  - `docker-compose.test.yml` (repo root): disposable PostgreSQL 17 and MySQL 9 containers, `tmpfs` data dirs (gone once the container is removed). Host ports are shifted to `55432`/`33307` to avoid clashing with this machine's existing services (a local PostgreSQL, another project's MySQL container); CI uses the standard `5432`/`3306` instead (see `.github/workflows/ci.yml`)
  - `connections.ts`: reads connection strings from env vars (`KOSAME_TEST_POSTGRES_URL`/`KOSAME_TEST_MYSQL_URL`), falling back to the local `docker-compose.test.yml` defaults when unset
  - `pipeline.pg.test.ts` / `pipeline.mysql.test.ts`: against each dialect's real driver (`pg`/`mysql2`), verify a full CRUD round-trip (`add` → `find` → `update` → `save` → `reload` → `delete`), hooks + `static schema` validation, associations (`hasMany`/`belongsTo` via `include`), `SoftDeletable` (`delete()` vs `hardDelete()`), and transactions (commit, rollback across a real async gap, nested transaction SAVEPOINTs)
    - The MySQL file specifically exercises the `$returningId()`-based INSERT row fetch that Phase 2 Step 3's changelog flagged as "only type-checked, never run against a real MySQL server"
  - **Scoping decision**: fully honoring the "no SQLite in-memory split — run the whole test suite against real DBs" decision would mean parameterizing all 64 existing bun:sqlite-based tests across three dialects — a much larger rewrite, so that was deferred. Instead, one smoke-test file per dialect covers the main paths where dialect-specific behavior actually matters (CRUD translation, hooks, associations, soft delete, transactions) against a real PostgreSQL/MySQL (agreed with the user). The net result is asymmetric coverage: broad on SQLite, main-path-only on PostgreSQL/MySQL
  - Excluded from the default `bun test` (the `test` script in `package.json`) via `--path-ignore-patterns`, so the regular test run needs no Docker. Run via the three-step `bun run test:integration:up` → `bun run test:integration` → `bun run test:integration:down` (see `package.json`'s scripts)

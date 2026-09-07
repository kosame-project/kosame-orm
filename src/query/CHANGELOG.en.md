# Changelog (src/query)

Change history for the `src/query` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 2 Step 3. CRUD translation (core translation logic)**
  - New directory holding table-level CRUD translation logic that depends on neither `Model` (`src/model`) nor `Context` (`src/context`)
  - `getPrimaryKey(table)` (`primary-key.ts`): identifies the single primary-key column by checking each column's `primary` flag via drizzle's `getTableColumns`. Composite primary keys (more than one `primary` column) throw, as an explicit not-yet-supported limitation
  - `insertRow` / `selectByPrimaryKey` / `updateByPrimaryKey` / `deleteByPrimaryKey` (`crud.ts`): primary-key-based SELECT/UPDATE/DELETE, plus the logic for fetching the full row back after an INSERT
    - Three paths for getting the row back after INSERT: (1) if the caller already supplied the primary key value, re-select by it after the INSERT executes (2) dialects with `.returning()` (PostgreSQL/SQLite) use it directly (3) MySQL (no `.returning()`, only `$returningId()`) fetches the generated primary key and then re-selects. The branch is chosen by feature-detecting whether the built query exposes a `.returning` function, not by branching on a dialect name
  - `DB` (`db.ts`): the non-exported Symbol pointing at the drizzle `db`/`tx` handle. Originally lived in `src/context/internal.ts`, but since `Model`'s CRUD instance methods (`save()`, etc.) also need to reach the same handle, it moved here so both `src/model` and `src/context` can import it without creating a cycle (`src/context/internal.ts` was removed)
- Unit tests (`crud.test.ts`): round-trip insert/select/update/delete against real SQLite using `bun:sqlite` + `drizzle-orm/bun-sqlite` (`better-sqlite3` crashes `bun test` on this machine, so it's not used in tests; it remains the library's own SQLite dependency)

**Not yet verified (Phase 9 will cover this)**: the MySQL `$returningId()` branch only type-checks — it hasn't been exercised against a real MySQL server. PostgreSQL/MySQL coverage against real databases is deferred to Phase 9 (test environment).

## Phase 2 Step 4. Additions for associations/hydration

### Added

- `getColumn(table, key)` (`columns.ts`): pulls a single column out of `getTableColumns` by its JS property key, throwing if it's not found
- `selectWhereIn(db, table, column, values)` (`crud.ts`): a batch `IN (...)` SELECT on one column, used by `src/associations` to fetch a relation's children/parent for a whole set of rows in one query. Returns `[]` without querying when `values` is empty

## Phase 4 Step 1. Transactions (basic API, nesting)

### Added

- `isSyncDatabase(db)` / `runTransaction(db, depth, fn)` (`transaction.ts`): the low-level, dialect-bridging logic behind `context.transaction()`
  - **Problem found**: `better-sqlite3`/`bun:sqlite` (the synchronous drivers drizzle marks with `db.resultKind === "sync"`) don't work correctly with drizzle's native `db.transaction(async (tx) => {...})` wrapper when given an async callback. Verified experimentally: `bun:sqlite` commits as soon as the callback hits its first `await`, so a later throw doesn't roll anything back; `better-sqlite3` (checked under Node.js) goes further and throws `"Transaction function cannot return a promise"`. MySQL (`mysql2`, tested against a real container), by contrast, rolls back correctly even across a real async gap. The root cause is that the native wrapper assumes a synchronous callback — a SQLite-only problem
  - **Fix**: when `db.resultKind === "sync"`, skip drizzle's `.transaction()` entirely and drive the transaction by hand on the same `db` handle with raw `BEGIN`/`COMMIT`/`ROLLBACK` (or, when nested, `SAVEPOINT`/`RELEASE SAVEPOINT`/`ROLLBACK TO SAVEPOINT`). This keeps `context.transaction(async (txContext) => {...})` working identically across all three dialects — SQLite doesn't need a different calling convention. The branch is decided by `resultKind`, a property drizzle itself exposes, not by a dialect name
  - Async drivers (anything where `resultKind` isn't `"sync"`: PostgreSQL, MySQL, libsql, D1) still delegate straight to drizzle's `db.transaction()`; nesting there is left to `tx.transaction()`, which drizzle already implements per-dialect (SAVEPOINTs, etc.)

## Phase 6. Additions for soft delete

### Changed

- `selectByPrimaryKey` / `selectWhereIn` (`crud.ts`) now take an optional extra condition, `extra?: SQL`, ANDed onto the existing condition (`and(existing, extra)`) when given. Needed so the soft-delete exclusion filter (`isNull(deletedAtColumn)`) could be added on top of the primary-key/foreign-key condition, without introducing a second, parallel query primitive

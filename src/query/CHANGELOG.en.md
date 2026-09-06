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

# Changelog

Change history for this project. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 1. Environment setup**
  - Created `package.json` (ESM-only via `type: module`, `private: true`)
  - Added core dependencies: `drizzle-orm@0.45.2` / `drizzle-zod@0.8.3` / `zod@4.5.4` (all latest v0-series stable releases; v1 rc is intentionally deferred per the "drizzle-orm breaking-change follow-up policy" decision in `docs/Requirements.md`)
  - Declared DB drivers as `peerDependencies` (optional): `pg` / `mysql2` / `better-sqlite3` / `@libsql/client`, also bundled under `devDependencies` for local development/testing
  - Added `typescript@7.0.2` (the Go-based native compiler) and `drizzle-kit@0.31.10` as dev tooling
  - Created `tsconfig.json` (ESM/NodeNext resolution, strict, `verbatimModuleSyntax`, etc.)
  - Added `src/index.ts` (placeholder) and `.gitignore`
  - Verified `bun install` and `tsc --noEmit` both succeed
- **Phase 2 Step 1. Model foundation** (see `src/model/CHANGELOG.en.md` for details)
  - Implemented the non-exported Symbol brand that blocks direct `new` on `Model`, constructor-injected `#context` storage, and the `static table` placeholder
  - Added `@types/bun` and `"types": ["bun"]` in `tsconfig.json` so `bun:test` types resolve under `tsc --noEmit` too
- **Phase 2 Step 2. Context (DbContext equivalent)** (see `src/context/CHANGELOG.en.md` for details)
  - Implemented the `createContext(db, schema)` factory: iterates `schema` to assemble `context.users`/`context.posts` entry points at construction time (no `Proxy`)
  - The drizzle `db`/`tx` handle is stored internally using the same non-exported Symbol technique as the Model foundation's `INTERNAL` brand
- **Phase 2 Step 3. CRUD translation** (see `src/query/CHANGELOG.en.md` / `src/model/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` for details)
  - Introduced `src/query`, a new directory holding the table-level CRUD translation logic between `Model` and drizzle (primary-key lookup, INSERT/SELECT/UPDATE/DELETE; PostgreSQL/SQLite use `.returning()`, MySQL uses `$returningId()` + a re-select to absorb the dialect difference)
  - Implemented `Model`'s instance methods `save()` / `update()` / `delete()` / `reload()`
  - Implemented `context.users.find()` / `context.users.add()` (using drizzle's inferred `InferInsertModel` type for `add()`'s argument)
  - Switched test-only SQLite usage to `bun:sqlite` (`drizzle-orm/bun-sqlite`) after `bun test` crashed on `better-sqlite3` on this machine
- **Phase 2 Step 4. Associations / hydration** (see `src/associations/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` / `src/query/CHANGELOG.en.md` for details)
  - Implemented `hasMany`/`belongsTo` in a new `src/associations` directory. Defined on a Model class via `static relations = {...}`
  - Relations are resolved with a single batched `IN (...)` query per relation plus app-side hydration (group-by on the parent key) — no JOINs
  - Added an `include` option to `find()` (`context.users.find(pk, { include: ["posts"] })`) to fetch associations
  - Nesting stops at one level (as decided). Real PostgreSQL/MySQL verification is deferred to Phase 9, same as Step 3
- **Phase 3 Step 1. Hooks (INSERT side: `beforeCreate`)** (see `src/model/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` for details)
  - Added `beforeCreate()` to `Model` (no-op by default, overridable). Called before `context.<collection>.add()`'s INSERT; throwing aborts the insert
  - Added `protected get raw()` to `Model` so hook overrides can reach the raw drizzle handle (a preview of Phase 7's `context.raw`)
  - Phase 3 is being split into three steps — INSERT/UPDATE/DELETE side — each shipped as its own PR; this entry covers Step 1
- **Phase 3 Step 2. Hooks (UPDATE side: `beforeUpdate`)** (see `src/model/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` for details)
  - Added `beforeUpdate(changes)` to `Model` (no-op by default, overridable), called before the actual UPDATE from both `update(changes)` and `save()`
  - `changes` can be mutated inside the hook (passed by reference) and is reflected onto the instance after the write; throwing aborts the UPDATE
- **Phase 3 Step 3. Hooks (DELETE side: `beforeDelete`)** (see `src/model/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` for details)
  - Added `beforeDelete()` to `Model` (no-op by default, overridable), called right before `delete()`'s DELETE; throwing aborts it
  - This completes all three Phase 3 (hooks) steps — INSERT, UPDATE, DELETE
- **Phase 4 Step 1. Transactions (basic API, nesting)** (see `src/query/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` for details)
  - Implemented `context.transaction(async (txContext) => {...})`, automatically using a SAVEPOINT when nested
  - While building this, found (and verified experimentally) that `better-sqlite3`/`bun:sqlite` (synchronous drivers) don't work correctly with an async callback passed to drizzle's native `db.transaction()` (MySQL, tested against a real container, works fine). Fixed by detecting the sync driver and driving the transaction by hand with raw `BEGIN`/`COMMIT`/`ROLLBACK`/`SAVEPOINT` statements instead, keeping the same async API across all three dialects
  - Also found that, since SQLite is single-connection, the "Model instances outside a transaction don't participate in it" decision doesn't hold the same way there (documented in the tests); PostgreSQL/MySQL are unaffected since they use connection pooling
- **Phase 4 Step 2. Transactions (`afterCommit`/`afterRollback`)** (see `src/context/CHANGELOG.en.md` for details)
  - Implemented `Context.afterCommit(callback)`/`afterRollback(callback)`, called in registration order after a successful commit or after a rollback, respectively
  - For nested transactions, an inner `afterCommit` fires as soon as its own SAVEPOINT releases (it does not wait for the outermost commit) — a deliberate, simple, local semantics for the initial scope
  - This completes both Phase 4 (transactions) steps
- **Phase 5. Inheritance / mixin mechanism** (see `src/model/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` for details)
  - Added the `Constructor<T>` type (`abstract new (...args) => T`). No custom mixin machinery was built — plain TypeScript/JS mixin functions already compose cleanly with `Model`'s brand `Symbol` and `#context` wiring, verified with tests
  - The actual mixins (`SoftDeletable`, etc.) are planned for Phase 6
- **Phase 6. Soft delete** (see `src/soft-delete/CHANGELOG.en.md` / `src/model/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` / `src/associations/CHANGELOG.en.md` for details)
  - New `src/soft-delete` directory. Implemented `deletedAtColumn()` per dialect, published as `kosame/pg` / `kosame/mysql` / `kosame/sqlite` subpath exports
  - Implemented the `SoftDeletable(Model)` mixin. `delete()` becomes an UPDATE to `deletedAt` (soft delete); the new `hardDelete()` is the original real DELETE
  - `context.<collection>.find()` and `hasMany`/`belongsTo` (association loading) now exclude soft-deleted rows by default, but only for Models with `SoftDeletable` applied (`find()` can include them via `{ withDeleted: true }`). Detection is by "was the mixin explicitly applied" (a non-exported Symbol marker), never by column naming
  - `createdAtColumn()`/`updatedAtColumn()` (decided back in Phase 2) are still not implemented — explicitly out of scope for Phase 6
- **Phase 7. Escape hatch** (see `src/context/CHANGELOG.en.md` for details)
  - Implemented `context.raw`: a public getter exposing the exact `db` passed to `createContext(db, schema)`. `Context`/`createContext` are now generic over the db type too, so it works with drizzle's own API directly, no `any` cast needed
  - `txContext.raw` inside `transaction()` automatically points at that transaction's `tx` handle — no extra wiring, it just falls out of the existing design
  - Query results via `context.raw` are never hydrated into Model instances; they stay as drizzle's plain result
- **Phase 8. Validation integration** (see `src/validation/CHANGELOG.en.md` / `src/model/CHANGELOG.en.md` / `src/context/CHANGELOG.en.md` / `src/associations/CHANGELOG.en.md` for details)
  - New `src/validation` directory. Implemented `validateSchema(modelClass, data, { partial? })` (a pure leaf module depending only on `zod`)
  - A Model class's `static schema` (`drizzle-zod`'s `createInsertSchema(table)`, etc. — written by the user, same pattern as `static table`) is reused for validation both on write (`add()` uses the full schema, `update()`/`save()` use `.partial()`) and at hydration time (`find()`/`reload()`/association loading)
  - A Model class without `static schema` is never validated (fully opt-in), so all existing tests are unaffected
  - No flag to toggle by environment — it always runs, and failure throws to stop the DB operation/hydration
- **Phase 9. Test environment** (see `src/test-integration/CHANGELOG.en.md` / `src/test-types/CHANGELOG.en.md` for details)
  - `docker-compose.test.yml` spins up disposable PostgreSQL/MySQL containers; added real-DB smoke tests per dialect (`src/test-integration`) covering CRUD, hooks, associations, soft delete, and transactions. Closes two previously "untested" gaps: MySQL's `$returningId()` path and async transaction rollback against a real (non-SQLite) driver
    - Fully honoring the "run the whole test suite against real DBs" decision would mean parameterizing all 64 existing tests across three dialects — far too large a rewrite, so a main-path smoke-test scope was agreed with the user instead
  - Added a GitHub Actions CI workflow (`.github/workflows/ci.yml`): triggers on `push` (all branches, no `pull_request`), runs typecheck, the regular test suite, and the real-DB smoke tests via PostgreSQL/MySQL service containers
  - Added a type-level assertion mechanism (`Equal<A, B>`/`expectType<Expected>(actual)`, self-written, zero dependencies) in `src/test-types`, plus tests verifying `context.users`/`context.raw` and other inferred types resolve as expected
  - This completes the Phase 1–9 implementation plan

[Unreleased]: https://github.com/kosame-project/kosame-orm

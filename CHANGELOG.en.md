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

[Unreleased]: https://github.com/kosame-project/kosame-orm

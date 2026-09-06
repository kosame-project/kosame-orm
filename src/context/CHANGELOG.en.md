# Changelog (src/context)

Change history for the `src/context` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 2 Step 2. Context (DbContext equivalent)**
  - Implemented the `Context` class and the `createContext(db, schema)` factory (`src/context/context.ts`)
    - The drizzle `db`/`tx` handle is stored under a non-exported `Symbol`-keyed property (`DB`, in `src/context/internal.ts`) — the same technique as the `Model` foundation's `INTERNAL` brand (Phase 2 Step 1): reachable from within the package (e.g. `ModelCollection`) but invisible from the public API
    - `schema` (a key -> Model class map, e.g. `{ users: User, posts: Post }`) is iterated via `Object.entries` and used to assemble `context.users`/`context.posts` with `Object.defineProperty` at construction time. No `Proxy` is used (see the "Proxy使用の是非" decision in `docs/Requirements.md`)
    - `createContext` returns `Context<TSchema> & ContextEntries<TSchema>` so the dynamically-assigned entry points are still typed
  - Added the `ModelCollection` class (`src/context/collection.ts`) as the concrete shape behind `context.users`/`context.posts`. For now it only holds the owning context and Model class references — CRUD methods (`find()`, `add()`, ...) are added in Phase 2 Step 3
  - Type definitions (`src/context/types.ts`): `ModelClass` (constructor shape), `ContextSchema` (key -> Model class map; named this way instead of `Schema` to avoid colliding with the per-Model `static schema` (zod) planned for Phase 8), `ContextEntries`
  - Unit tests (`context.test.ts`): verifies one `ModelCollection` is built per schema key, and that the resulting entry points are plain enumerable own properties rather than a `Proxy`
  - `src/index.ts` now exports `createContext` (value) and `Context`/`ContextSchema`/`ModelClass`/`ContextEntries` (types only). The `Context` class itself is not exported as a value — constructing it directly would bypass the intersection type `createContext` attaches, silently losing type safety on the entry points

**Resolved in Phase 2 Step 3**: the "narrow `db`'s type in Step 3" note above was settled not by giving `db` a type parameter, but by passing it through opaquely to `src/query`'s table-level CRUD functions instead (the `db: any` trust boundary is contained there; the public `createContext(db: unknown, schema)` signature is unchanged). See the entry below.

## Phase 2 Step 3. CRUD translation (`context.users.find()` / `add()`)

### Added

- Implemented `find(pkValue)` / `add(values)` on `ModelCollection` (`src/context/collection.ts`)
  - `find()`: SELECTs by primary key and hydrates a `Model` instance if found, `undefined` otherwise
  - `add()`: INSERTs via `src/query`'s `insertRow` (which uses `.returning()` or `$returningId()` + a re-select depending on the dialect to get the full row back) and hydrates a `Model` instance from it
  - `ModelCollection` is now also generic over the table type (`TTable`), so `add()`'s argument is typed as `InferInsertModel<TTable>` (see the "型推論の互換性" decision). `Model` itself stays non-generic (`class User extends Model {}`, unchanged) — the type inference only flows through the context-level API
  - `ModelClass` (`src/context/types.ts`) gained `readonly table: TTable` so `ModelCollection` can reach `static table` in a type-safe way
- The `DB` Symbol `Context` holds moved into `src/query` (new directory, see its Step 3 entry). `src/context/internal.ts` was removed, and `Context` now `implements ModelContext` (the interface from `src/model`)
- Extended `context.test.ts` to run against a real SQLite DB via `bun:sqlite` (`drizzle-orm/bun-sqlite`), covering `add()`/`find()` together with `Model`'s `save()`/`update()`/`delete()`/`reload()`

## Phase 2 Step 4. Wiring associations/hydration into `find()`'s `include`

### Added

- Implemented `ModelCollection.find(pkValue, { include })` (`src/context/collection.ts`). For each key in `include`, it looks up the Model class's `static relations` (`hasMany`/`belongsTo` descriptors from `src/associations`) and calls `loadRelation` (`src/associations`) to attach the relation onto the fetched instance
  - Passing an unknown relation key in `include` throws
  - `include` is `readonly string[]` (runtime-checked only) — there's no compile-time check that a relation key actually exists on the Model's type; documented as a known limitation for now
- `ModelClass` is now primarily owned by `src/associations`'s consumers, so its definition moved to `src/model` (see `src/model/CHANGELOG.en.md`). `src/context/types.ts` just re-exports it
- Unit tests (`include.test.ts`): verifies `hasMany`/`belongsTo` defined via `static relations` are correctly hydrated through `find()`'s `include`, that the relation property is left untouched when `include` isn't passed, and that an unknown relation name throws

**Known limitation**: `include` cannot nest (per the "1段階まで" decision in `docs/Requirements.md`). Since `context.users.find()` only ever returns a single row, batch hydration across multiple parent rows is only exercised directly at the `loadRelation` level (`src/associations/load.test.ts`) — there is no context-level, multi-row query method (`findMany`, etc.) yet.

## Phase 3 Step 1. Hooks (INSERT side: `beforeCreate`)

### Changed

- Changed the internal steps of `ModelCollection.add(values)` (`src/context/collection.ts`)
  - Before: called `insertRow(values)` right away, then hydrated and returned a fresh instance from the returned row
  - After: build a branded `Model` instance and assign `values` onto it first → call `instance.beforeCreate()` (which can mutate `this` or throw to abort) → use whatever the instance currently holds as the INSERT payload → merge `insertRow`'s result (including server-generated columns) back onto that same instance and return it
  - As a result, `add()`'s return value is the very instance `beforeCreate()` mutated, not a separately re-hydrated one
- Unit tests (`hooks.test.ts`): verifies a `beforeCreate()` override that normalizes a field actually affects what gets inserted, that throwing prevents the INSERT from running at all, and that the hook is a no-op by default when not overridden

## Phase 3 Step 2. Hooks (UPDATE side: `beforeUpdate`)

### Added

- Extended `hooks.test.ts`: for both `update()` and `save()`, verifies a `beforeUpdate()` override mutating `changes` affects both the actual UPDATE and the instance, that throwing prevents either from running the UPDATE, and that the hook is a no-op by default. The implementation itself (adding `beforeUpdate` and wiring the calls) is covered in `src/model/CHANGELOG.en.md`

## Phase 3 Step 3. Hooks (DELETE side: `beforeDelete`)

### Added

- Extended `hooks.test.ts`: verifies `beforeDelete()` runs before `delete()`'s DELETE, that throwing prevents the DELETE from running at all, and that the hook is a no-op by default. The implementation itself is covered in `src/model/CHANGELOG.en.md`
- This completes the context-side tests for all three Phase 3 (hooks) steps

## Phase 4 Step 1. Transactions (basic API, nesting)

### Added

- Implemented `Context.transaction<R>(callback)`
  - Added two new private fields: `#schema` (the original schema passed to the constructor) and `#txDepth` (nesting depth, default 0)
  - Calling it delegates to `src/query`'s `runTransaction(db, depth, fn)` (per-dialect BEGIN/SAVEPOINT branching, see `src/query/CHANGELOG.en.md`), and passes the callback a fresh `Context` (same schema, the `tx` handle, `#txDepth + 1`) as `txContext`
  - "Model instances are fixed to the context they were built with" (already decided in Phase 2) means instances obtained before calling `transaction()` automatically don't participate in it — nothing new needed here, it just falls out of the existing design
- Unit tests (`transaction.test.ts`): commit on success, rollback on a throw across a real async gap, an inner rollback that leaves the outer transaction's writes intact, and an outer rollback that also undoes an already-"committed" inner nested transaction
  - **SQLite-specific caveat found along the way**: since `better-sqlite3`/`bun:sqlite` are single-connection, a write issued through what should be the "outer, non-transactional" context while `context.transaction()` is open actually lands inside that same transaction on the same connection, and gets rolled back with it. Connection-pooled dialects like PostgreSQL/MySQL check out a separate connection for `db.transaction()`, so this isolation genuinely holds there. The "instances outside a transaction don't participate in it" decision is still true (an instance always refers to the context it was built with) — it just doesn't help when that context happens to share SQLite's one and only connection with an open transaction. Documented directly in the test

## Phase 4 Step 2. Transactions (`afterCommit`/`afterRollback`)

### Added

- Implemented `Context.afterCommit(callback)` / `afterRollback(callback)`
  - Both just push onto a `#afterCommitCallbacks`/`#afterRollbackCallbacks` array
  - `transaction()` runs the `afterCommit` list (in registration order, sequentially awaited) once `runTransaction` succeeds, or the `afterRollback` list if it throws
  - If a callback itself throws, the remaining callbacks in that list are skipped and the error rejects `transaction()`'s own promise (the commit/rollback itself already succeeded — only the post-processing callback failed, and that failure propagates to the caller)
  - For nested transactions, an inner `txContext.afterCommit()` fires as soon as that inner SAVEPOINT releases — it does not wait for the outermost transaction to actually commit. This is a deliberate, simple, local semantics for the initial scope; documented as a known limitation directly in the tests, since it means an inner `afterCommit` can already have fired even if the outer transaction later rolls back (separate from the fact that the SAVEPOINT's own data changes do get undone by the outer rollback — the DB-level rollback and the JS-level callback firing are two different things here)
- Unit tests (added to `transaction.test.ts`): callback ordering, `afterCommit` firing only on commit and `afterRollback` only on rollback, the nested-transaction firing timing described above, and a callback that itself throws surfacing through `transaction()`'s rejection

## Phase 5. Inheritance / mixin mechanism

### Added

- Unit tests (`mixin.test.ts`): a two-layer mixin chain (`class Post extends WithGreeting(WithTag(Model)) {}`) exercised through the full pipeline — `context.posts.add()`/`find()`/`update()`/`delete()`. Verifies each mixin's added properties/methods land on the instance, a `beforeCreate()` override (calling `super.beforeCreate()`) works, and `Model`'s own CRUD instance methods keep working
- The actual implementation (the `Constructor<T>` type) is covered in `src/model/CHANGELOG.en.md`; nothing changed on the `src/context` side itself — this just confirms the existing `Model`/`ModelCollection` code already works with mixins without modification

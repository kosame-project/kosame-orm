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

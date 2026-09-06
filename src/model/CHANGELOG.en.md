# Changelog (src/model)

Change history for the `src/model` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 2 Step 1. Model foundation**
  - Direct `new` construction of `Model` subclasses is disallowed via a non-exported `Symbol` brand (`INTERNAL`, in `src/model/internal.ts`)
    - `INTERNAL` is only imported from within the package (e.g. `src/context`) and is never re-exported from `src/index.ts` (the public API)
  - Implemented the `Model` base class (`src/model/model.ts`): the constructor throws when the brand doesn't match, and holds the context reference in a private `#context` field via constructor injection
  - Declared `static table` (typed as drizzle's `Table`) as a `declare static` placeholder that subclasses are expected to override
  - Added a unit test (`model.test.ts`) verifying that a brand mismatch throws

- **Phase 2 Step 3. CRUD translation (instance methods)**
  - Implemented `save()` / `update(changes)` / `delete()` / `reload()`. Each translates into the table-level CRUD functions from `src/query` (`updateByPrimaryKey` / `deleteByPrimaryKey` / `selectByPrimaryKey`)
    - `save()`: writes every non-primary-key column back via UPDATE, using whatever the instance's own properties currently hold (intended usage: mutate the instance's fields directly, then call `save()`)
    - `update(changes)`: UPDATEs only the given fields, and reflects the same values onto the instance immediately
    - `delete()`: DELETEs by primary key
    - `reload()`: re-SELECTs by primary key and overwrites every instance property with the returned row
  - All four require a primary key (throw if `src/query`'s `getPrimaryKey` can't find one)
  - `ModelConstructorArgs.context` changed from `unknown` to `ModelContext` (`readonly [DB]: unknown`, `DB` being the non-exported Symbol from `src/query`), so instance methods can reach the drizzle `db`/`tx` handle through the context reference
  - `src/index.ts` now also exports the `ModelContext` type

- **Phase 2 Step 4. Relocated `ModelClass` for associations**
  - Moved `ModelClass<T, TTable>` (the constructor shape plus `static table`'s type) here (`model.ts`) from `src/context/types.ts`, since `src/associations` needs "Model class + its table type" without going through `src/context` (which itself now depends on `src/associations`) — relocating avoids that dependency becoming a cycle
  - `src/context/types.ts` now just re-exports `ModelClass`; the public API (`src/index.ts`) is unaffected

- **Phase 3 Step 1. Hooks (INSERT side: `beforeCreate`)**
  - Added `protected get raw()`, exposing `this.#context[DB]` (the raw drizzle handle) to subclasses. A small preview of the `context.raw` escape hatch already decided for Phase 7, added just far enough to support hooks now
  - Added `beforeCreate(): Promise<void>`, a no-op by default, meant to be overridden in subclasses. This is how the "async validation before INSERT" decision gets implemented — as a plain overridable Model method, not a separate hook-registration DSL
    - Called by `context.<collection>.add()` (see the following commit under `src/context`). Throwing inside `beforeCreate()` stops the INSERT from running at all
    - By the time it's called, `this` already has the columns about to be inserted assigned to it, so overrides can normalize them (`this.email = ...`) or run an async uniqueness check via `this.raw`
  - `beforeCreate`/`beforeUpdate`/`beforeDelete` are all `public` methods (not `protected`) because external classes like `ModelCollection` need to call them; the "don't call these directly from application code" contract is documentation-only, not enforced by the type system

- **Phase 3 Step 2. Hooks (UPDATE side: `beforeUpdate`)**
  - Added `beforeUpdate(changes: Record<string, unknown>): Promise<void>`, a no-op by default, meant to be overridden
  - Called from both `update(changes)` and `save()`: `update()` passes through whatever the caller gave it, `save()` passes the "every non-primary-key column" object it builds itself. Both call it right before the actual UPDATE
  - `changes` is passed by reference, so an override mutating it changes what actually gets written; after the UPDATE, `Object.assign(this, changes)` reflects that back onto the instance (`save()` now does this too, to match `update()`'s existing behavior)
  - Throwing stops either `update()` or `save()` from running the UPDATE at all

- **Phase 3 Step 3. Hooks (DELETE side: `beforeDelete`)**
  - Added `beforeDelete(): Promise<void>`, a no-op by default, meant to be overridden
  - Called from `delete()`, right before the actual DELETE
  - Takes no arguments (same reasoning as `beforeCreate()` — the row's column values are already readable via `this`); checking for related records etc. is expected to go through `this.raw` with a hand-written query
  - Throwing stops `delete()` from running the DELETE
  - This completes all three Phase 3 (hooks) steps — INSERT, UPDATE, DELETE

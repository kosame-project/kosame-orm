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

**Not yet implemented (Phase 2 Step 3+)**: the drizzle-initialization simplifications (no `schema` option, camelCase-only columns, `logger` off by default) are the user's own drizzle setup code, not something `createContext` inspects — `db` stays untyped (`unknown`) here since nothing yet calls into it. Its type will be narrowed once CRUD translation (Step 3) actually needs to.

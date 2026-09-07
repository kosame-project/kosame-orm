# Changelog (src/associations)

Change history for the `src/associations` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 2 Step 4. Associations / hydration**
  - `hasMany(() => Child, { foreignKey, localKey? })` / `belongsTo(() => Parent, { foreignKey, targetKey? })` (`define.ts`): factory functions that just build a `RelationDescriptor`. The target Model class is taken as a thunk (`() => Child`) to support circular references (e.g. `User` and `Post` referencing each other)
    - `hasMany`'s `localKey` defaults to the parent table's primary key, and `belongsTo`'s `targetKey` defaults to the target table's primary key, both resolved via `src/query`'s `getPrimaryKey`
  - `loadRelation(context, parents, relationKey, descriptor)` (`load.ts`): the actual association translation logic
    - `hasMany`: collects (de-duplicated) parent key values from the array of parent instances, issues one batch `selectWhereIn` query against the child table, groups the results by foreign-key value, and sets each parent's `relationKey` property to an array of hydrated child `Model` instances
    - `belongsTo`: collects (de-duplicated, null/undefined filtered) foreign-key values from the array of owning instances, issues one batch `selectWhereIn` query against the target table, builds a map keyed by the target key, and sets each instance's `relationKey` property to a single hydrated `Model` instance (or `undefined` if not found)
    - No JOINs anywhere — purely IN-clause batch queries (see the "リレーションの変換先" decision)
  - Convention for defining relations on a Model class: `static relations = { posts: hasMany(...), author: belongsTo(...) }` (the same static-property pattern as `static table`). `Model` itself doesn't declare `relations` (it's optional, so no base declaration is needed)
  - Depends only on `src/model` (`Model`/`ModelClass`/`ModelContext`) and `src/query` (`DB`/`getColumn`/`getPrimaryKey`/`selectWhereIn`) — not on `src/context` (dependency direction is one-way: `query → model → associations → context`)
  - Unit tests (`load.test.ts`): against a real SQLite DB via `bun:sqlite`, verifies `hasMany`'s batched fetch + group-by across multiple parents, an empty array for a parent with no children, and `belongsTo`'s single-row resolution
- `src/index.ts` now exports `hasMany`/`belongsTo` (values) and `HasManyDescriptor`/`BelongsToDescriptor`/`RelationDescriptor` (types only)

**Known limitations (as decided)**: nesting stops at one level (no eager-loading a relation-of-a-relation together in one `include`). Composite primary/foreign keys aren't supported, per the same constraint already on `src/query`'s `getPrimaryKey`/`getColumn`.

## Phase 6. Additions for soft delete

### Changed

- `loadRelation` now passes a soft-delete exclusion condition (`isNull(deletedAtColumn)`) into `selectWhereIn` for both `hasMany` and `belongsTo`, whenever the relation's target Model class has `SoftDeletable` applied (same detection method as `find()` in `src/context`)
- There's no opt-out for relations equivalent to `find()`'s `withDeleted` — `include` itself has no place to pass per-relation options. Documented as a known limitation

## Phase 8. Additions for validation integration

### Changed

- Added `validateSchema(modelClass, row)` (`src/validation`) to `load.ts`'s internal `hydrate()` helper, so rows fetched for either a `hasMany` or `belongsTo` relation go through the same hydration-pipeline validation as `find()`/`add()` in `src/context`

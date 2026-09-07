# Changelog (src/validation)

Change history for the `src/validation` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 8. Validation integration**
  - Implemented `validateSchema(modelClass, data, { partial? })` (`validate.ts`). Validates `data` against `modelClass`'s `static schema` (a zod schema, expected to be built with `drizzle-zod`'s `createInsertSchema(table)`), throwing a `prettifyError`-formatted message on failure
    - No-op for a Model class with no `static schema` defined — validation is entirely opt-in
    - `{ partial: true }` uses `schema.partial()` (a zod method) instead. Partial updates (`update(changes)`/`save()`'s `changes`) need to validate only the keys actually given, not the full set an insert schema otherwise requires
  - A pure leaf module — depends on `zod` only, not on `src/model`, `src/query`, `src/context`, or `src/associations` (sits even below `src/query` in the dependency layering)
  - Building the actual `static schema` (`createInsertSchema(usersTable)`, etc.) is left to the user, following the same pattern as `static table` — the Model layer doesn't provide its own schema-generation DSL (consistent with the "users write drizzle's schema directly" decision)
  - The same `static schema` is reused for both the write side (sync checks) and the query-result side (at hydration time) — see the "クエリ結果側" decision. Actual call sites are covered in `src/model`'s (`save()`/`update()`/`reload()`), `src/context`'s (`ModelCollection.add()`/`#hydrate()`), and `src/associations`'s (`loadRelation`'s `hydrate()`) own changelogs
  - No flag to toggle when validation runs — it always runs, and failure throws to stop the DB operation/hydration (per the "実行タイミング"/"失敗時の挙動" decisions)

# Changelog (src/test-types)

Change history for the `src/test-types` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 9 Step 3. Type-inference testing method**
  - `Equal<A, B>` / `expectType<Expected>(actual)` (`type-utils.ts`): the type-level comparison utility drizzle-orm's own test suite uses. Self-written, zero dependencies (didn't reach for the `expect-type` library)
  - `bun test` itself only transpiles TS and never type-checks, so this mechanism only means anything paired with `tsc --noEmit` (an existing CI step) — verified by deliberately breaking one assertion and confirming `tsc --noEmit` reports it as a compile error before implementing the rest
  - `context.types.test.ts`: checks `context.users` resolves to `ModelCollection<User, typeof usersTable>` (not `any` or some overly-widened type), `context.users.add()`'s argument type matches `InferInsertModel<typeof usersTable>`, and `context.raw`'s type exactly matches the `db` instance's own type as passed to `createContext`

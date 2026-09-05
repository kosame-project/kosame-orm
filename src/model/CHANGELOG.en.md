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

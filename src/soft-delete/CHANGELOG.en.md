# Changelog (src/soft-delete)

Change history for the `src/soft-delete` directory. Follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

## [Unreleased]

### Added

- **Phase 6. Soft delete**
  - `deletedAtColumn(name = "deletedAt")` implemented per dialect (`columns.pg.ts`/`columns.mysql.ts`/`columns.sqlite.ts`): PostgreSQL uses `timestamp`, MySQL uses `datetime`, SQLite uses `integer(name, { mode: "timestamp" })`. One function can't cover all three dialects (the physical column types genuinely differ), so this mirrors how drizzle itself splits `pg-core`/`mysql-core`/`sqlite-core`
    - Added `./pg`/`./mysql`/`./sqlite` subpath exports to `package.json` so a dialect can be imported directly: `import { deletedAtColumn } from "kosame/pg"`
  - `SOFT_DELETE_COLUMN` (non-exported Symbol, `marker.ts`): a marker that lands as a `static` property once `SoftDeletable` is applied to a Model class. "Is this Model soft-deletable" is decided by this marker's presence, not by a naming convention on the column itself (see the "判定方式" decision)
  - `SoftDeletable(Base, columnKey = "deletedAt")` mixin (`soft-deletable.ts`)
    - Overrides `delete()`: runs `beforeDelete()`, then `writeUpdate({ [columnKey]: new Date() })` (the low-level write extracted from `Model`) instead of a real DELETE, so `beforeUpdate()` doesn't also fire
    - Added `hardDelete()`, which calls `super.delete()` (`Model`'s original DELETE), so a soft-deletable Model can still do a real delete (per the "both hard and soft delete stay available" decision)
    - The mixin function's returned class has to be declared `abstract`, and the exported function needs an explicit `TBase & Constructor<SoftDeletableInstance>` return type (a TS4094 workaround — see the commit log for details)
  - `getSoftDeleteColumn(modelClass, table)`: reads the `SOFT_DELETE_COLUMN` marker and resolves the matching `Column | undefined`. `src/context`/`src/associations` use this to decide whether to add the exclusion filter

**Not implemented (carried over from Phase 2)**: `createdAtColumn()`/`updatedAtColumn()` are not part of this phase. The docs suggest they'd follow the same implementation pattern, but they're outside Phase 6's scope (soft delete) and were left for later.

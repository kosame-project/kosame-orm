/**
 * Non-exported brand for the drizzle `db`/`tx` handle a {@link Context} wraps.
 *
 * Mirrors the pattern used in `src/model/internal.ts`: a symbol-keyed
 * property is invisible to the package's public API (never re-exported from
 * `src/index.ts`) but still readable across modules *within* this package,
 * so `ModelCollection` (Phase 2 Step 3) can reach the handle without a
 * public getter or a JS `#private` field, which cannot cross class
 * boundaries.
 */
export const DB: unique symbol = Symbol("kosame:db");

export type DbBrand = typeof DB;

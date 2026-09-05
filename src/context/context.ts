import { DB } from "./internal.js";
import { ModelCollection } from "./collection.js";
import type { ContextEntries, ContextSchema } from "./types.js";

/**
 * DbContext-equivalent. Holds the drizzle `db`/`tx` handle and one
 * `ModelCollection` per schema key, built once at construction time by
 * iterating `schema` — no `Proxy` (see decision in `docs/Requirements.md`,
 * "Proxy使用の是非").
 *
 * The `db`/`tx` handle itself is intentionally untyped (`unknown`) at this
 * step: Step 2 only needs to carry it through to Step 3, which is what
 * defines how CRUD translation actually calls into it.
 */
export class Context<TSchema extends ContextSchema = ContextSchema> {
  readonly [DB]: unknown;

  constructor(db: unknown, schema: TSchema) {
    this[DB] = db;

    for (const [key, modelClass] of Object.entries(schema)) {
      Object.defineProperty(this, key, {
        value: new ModelCollection(this, modelClass),
        enumerable: true,
      });
    }
  }
}

/**
 * `createContext(db, schema)` factory (see `docs/imp/implementation.md`,
 * Phase 2 "コンテキスト（DbContext相当）").
 *
 * Returns the intersection type `Context<TSchema> & ContextEntries<TSchema>`
 * so that `context.users`/`context.posts` are typed, even though they're
 * assigned dynamically in the constructor rather than declared as class
 * fields.
 */
export function createContext<TSchema extends ContextSchema>(
  db: unknown,
  schema: TSchema,
): Context<TSchema> & ContextEntries<TSchema> {
  return new Context(db, schema) as Context<TSchema> & ContextEntries<TSchema>;
}

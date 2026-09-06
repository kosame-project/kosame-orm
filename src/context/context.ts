import type { ModelContext } from "../model/index.js";
import { DB } from "../query/index.js";
import { ModelCollection } from "./collection.js";
import type { ContextEntries, ContextSchema } from "./types.js";

export class Context<TSchema extends ContextSchema = ContextSchema> implements ModelContext {
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

export function createContext<TSchema extends ContextSchema>(
  db: unknown,
  schema: TSchema,
): Context<TSchema> & ContextEntries<TSchema> {
  return new Context(db, schema) as Context<TSchema> & ContextEntries<TSchema>;
}

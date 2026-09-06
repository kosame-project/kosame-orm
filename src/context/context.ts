import type { ModelContext } from "../model/index.js";
import { DB, runTransaction } from "../query/index.js";
import { ModelCollection } from "./collection.js";
import type { ContextEntries, ContextSchema } from "./types.js";

export class Context<TSchema extends ContextSchema = ContextSchema> implements ModelContext {
  readonly [DB]: unknown;
  readonly #schema: TSchema;
  readonly #txDepth: number;

  constructor(db: unknown, schema: TSchema, txDepth = 0) {
    this[DB] = db;
    this.#schema = schema;
    this.#txDepth = txDepth;

    for (const [key, modelClass] of Object.entries(schema)) {
      Object.defineProperty(this, key, {
        value: new ModelCollection(this, modelClass),
        enumerable: true,
      });
    }
  }

  async transaction<R>(callback: (txContext: Context<TSchema> & ContextEntries<TSchema>) => Promise<R>): Promise<R> {
    return runTransaction(this[DB], this.#txDepth, async (tx) => {
      const txContext = new Context(tx, this.#schema, this.#txDepth + 1) as Context<TSchema> & ContextEntries<TSchema>;
      return callback(txContext);
    });
  }
}

export function createContext<TSchema extends ContextSchema>(
  db: unknown,
  schema: TSchema,
): Context<TSchema> & ContextEntries<TSchema> {
  return new Context(db, schema) as Context<TSchema> & ContextEntries<TSchema>;
}

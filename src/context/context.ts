import type { ModelContext } from "../model/index.js";
import { DB, runTransaction } from "../query/index.js";
import { ModelCollection } from "./collection.js";
import type { ContextEntries, ContextSchema } from "./types.js";

type TransactionCallback = () => void | Promise<void>;

export class Context<TDb = unknown, TSchema extends ContextSchema = ContextSchema> implements ModelContext {
  readonly [DB]: TDb;
  readonly #schema: TSchema;
  readonly #txDepth: number;
  readonly #afterCommitCallbacks: TransactionCallback[] = [];
  readonly #afterRollbackCallbacks: TransactionCallback[] = [];

  constructor(db: TDb, schema: TSchema, txDepth = 0) {
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

  get raw(): TDb {
    return this[DB];
  }

  afterCommit(callback: TransactionCallback): void {
    this.#afterCommitCallbacks.push(callback);
  }

  afterRollback(callback: TransactionCallback): void {
    this.#afterRollbackCallbacks.push(callback);
  }

  async transaction<R>(
    callback: (txContext: Context<TDb, TSchema> & ContextEntries<TSchema>) => Promise<R>,
  ): Promise<R> {
    let txContext: (Context<TDb, TSchema> & ContextEntries<TSchema>) | undefined;

    let result: R;
    try {
      result = await runTransaction(this[DB], this.#txDepth, async (tx) => {
        txContext = new Context(tx as TDb, this.#schema, this.#txDepth + 1) as Context<TDb, TSchema> &
          ContextEntries<TSchema>;
        return callback(txContext);
      });
    } catch (error) {
      if (txContext) {
        await runCallbacks(txContext.#afterRollbackCallbacks);
      }
      throw error;
    }

    await runCallbacks(txContext!.#afterCommitCallbacks);
    return result;
  }
}

async function runCallbacks(callbacks: readonly TransactionCallback[]): Promise<void> {
  for (const callback of callbacks) {
    await callback();
  }
}

export function createContext<TDb, TSchema extends ContextSchema>(
  db: TDb,
  schema: TSchema,
): Context<TDb, TSchema> & ContextEntries<TSchema> {
  return new Context(db, schema) as Context<TDb, TSchema> & ContextEntries<TSchema>;
}

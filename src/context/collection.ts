import type { InferInsertModel, Table } from "drizzle-orm";
import { INTERNAL } from "../model/internal.js";
import type { Model } from "../model/index.js";
import { DB, getPrimaryKey, insertRow, selectByPrimaryKey } from "../query/index.js";
import type { Context } from "./context.js";
import type { ModelClass } from "./types.js";

export class ModelCollection<T extends Model, TTable extends Table = Table> {
  readonly #context: Context;
  readonly #modelClass: ModelClass<T, TTable>;

  constructor(context: Context, modelClass: ModelClass<T, TTable>) {
    this.#context = context;
    this.#modelClass = modelClass;
  }

  #hydrate(row: Record<string, unknown>): T {
    const instance = new this.#modelClass({ brand: INTERNAL, context: this.#context });
    Object.assign(instance, row);
    return instance;
  }

  async find(pkValue: unknown): Promise<T | undefined> {
    const table = this.#modelClass.table;
    const primaryKey = getPrimaryKey(table);
    if (!primaryKey) {
      throw new Error("kosame: find() requires the table to have a primary key.");
    }
    const row = await selectByPrimaryKey(this.#context[DB], table, primaryKey, pkValue);
    return row ? this.#hydrate(row) : undefined;
  }

  async add(values: InferInsertModel<TTable>): Promise<T> {
    const row = await insertRow(this.#context[DB], this.#modelClass.table, values as Record<string, unknown>);
    return this.#hydrate(row);
  }
}

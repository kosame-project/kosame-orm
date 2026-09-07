import { isNull } from "drizzle-orm";
import type { InferInsertModel, Table } from "drizzle-orm";
import { loadRelation } from "../associations/index.js";
import type { RelationDescriptor } from "../associations/index.js";
import { INTERNAL } from "../model/internal.js";
import type { Model } from "../model/index.js";
import { DB, getPrimaryKey, insertRow, selectByPrimaryKey } from "../query/index.js";
import { getSoftDeleteColumn } from "../soft-delete/index.js";
import type { Context } from "./context.js";
import type { ModelClass } from "./types.js";

export interface FindOptions {
  readonly include?: readonly string[];
  readonly withDeleted?: boolean;
}

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

  #relations(): Record<string, RelationDescriptor> {
    return (this.#modelClass as unknown as { relations?: Record<string, RelationDescriptor> }).relations ?? {};
  }

  async find(pkValue: unknown, options?: FindOptions): Promise<T | undefined> {
    const table = this.#modelClass.table;
    const primaryKey = getPrimaryKey(table);
    if (!primaryKey) {
      throw new Error("kosame: find() requires the table to have a primary key.");
    }

    const softDeleteColumn = getSoftDeleteColumn(this.#modelClass, table);
    const excludeDeleted = softDeleteColumn && !options?.withDeleted ? isNull(softDeleteColumn) : undefined;

    const row = await selectByPrimaryKey(this.#context[DB], table, primaryKey, pkValue, excludeDeleted);
    if (!row) {
      return undefined;
    }
    const instance = this.#hydrate(row);

    if (options?.include) {
      const relations = this.#relations();
      for (const key of options.include) {
        const descriptor = relations[key];
        if (!descriptor) {
          throw new Error(`kosame: unknown relation "${key}" on this Model.`);
        }
        await loadRelation(this.#context, [instance], key, descriptor);
      }
    }

    return instance;
  }

  async add(values: InferInsertModel<TTable>): Promise<T> {
    const instance = new this.#modelClass({ brand: INTERNAL, context: this.#context });
    Object.assign(instance, values);

    await instance.beforeCreate();

    const currentValues = { ...(instance as unknown as Record<string, unknown>) };
    const row = await insertRow(this.#context[DB], this.#modelClass.table, currentValues);
    Object.assign(instance, row);

    return instance;
  }
}

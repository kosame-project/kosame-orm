import { getTableColumns } from "drizzle-orm";
import type { Table } from "drizzle-orm";
import { INTERNAL, type InternalBrand } from "./internal.js";
import { DB, getPrimaryKey, deleteByPrimaryKey, selectByPrimaryKey, updateByPrimaryKey } from "../query/index.js";
import type { PrimaryKey } from "../query/index.js";

export interface ModelContext {
  readonly [DB]: unknown;
}

export interface ModelConstructorArgs {
  brand: InternalBrand;
  context: ModelContext;
}

export interface ModelClass<T extends Model = Model, TTable extends Table = Table> {
  new (args: ModelConstructorArgs): T;
  readonly table: TTable;
}

export abstract class Model {
  declare static readonly table: Table;

  readonly #context: ModelContext;

  constructor(args: ModelConstructorArgs) {
    if (args.brand !== INTERNAL) {
      throw new Error(
        "Model subclasses cannot be constructed directly with `new`. Obtain instances via a context factory method instead (e.g. `context.users.find()`).",
      );
    }
    this.#context = args.context;
  }

  protected get context(): ModelContext {
    return this.#context;
  }

  protected get raw(): unknown {
    return this.#context[DB];
  }

  #table(): Table {
    return (this.constructor as typeof Model).table;
  }

  #requirePrimaryKey(caller: string): PrimaryKey {
    const primaryKey = getPrimaryKey(this.#table());
    if (!primaryKey) {
      throw new Error(`kosame: ${caller}() requires the table to have a primary key.`);
    }
    return primaryKey;
  }

  #primaryKeyValue(primaryKey: PrimaryKey): unknown {
    return (this as unknown as Record<string, unknown>)[primaryKey.key];
  }

  async beforeCreate(): Promise<void> {}

  async save(): Promise<void> {
    const table = this.#table();
    const primaryKey = this.#requirePrimaryKey("save");
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(getTableColumns(table))) {
      if (key !== primaryKey.key) {
        changes[key] = (this as unknown as Record<string, unknown>)[key];
      }
    }
    await updateByPrimaryKey(this.#context[DB], table, primaryKey, this.#primaryKeyValue(primaryKey), changes);
  }

  async update(changes: Record<string, unknown>): Promise<void> {
    const primaryKey = this.#requirePrimaryKey("update");
    await updateByPrimaryKey(
      this.#context[DB],
      this.#table(),
      primaryKey,
      this.#primaryKeyValue(primaryKey),
      changes,
    );
    Object.assign(this, changes);
  }

  async delete(): Promise<void> {
    const primaryKey = this.#requirePrimaryKey("delete");
    await deleteByPrimaryKey(this.#context[DB], this.#table(), primaryKey, this.#primaryKeyValue(primaryKey));
  }

  async reload(): Promise<void> {
    const primaryKey = this.#requirePrimaryKey("reload");
    const row = await selectByPrimaryKey(
      this.#context[DB],
      this.#table(),
      primaryKey,
      this.#primaryKeyValue(primaryKey),
    );
    if (!row) {
      throw new Error("kosame: reload() could not find this row anymore.");
    }
    Object.assign(this, row);
  }
}

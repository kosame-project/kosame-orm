import type { Table } from "drizzle-orm";
import type { Model, ModelConstructorArgs } from "../model/index.js";
import type { ModelCollection } from "./collection.js";

export interface ModelClass<T extends Model = Model, TTable extends Table = Table> {
  new (args: ModelConstructorArgs): T;
  readonly table: TTable;
}

export type ContextSchema = Record<string, ModelClass>;

export type ContextEntries<TSchema extends ContextSchema> = {
  [K in keyof TSchema]: TSchema[K] extends ModelClass<infer T, infer TTable>
    ? ModelCollection<T, TTable>
    : never;
};

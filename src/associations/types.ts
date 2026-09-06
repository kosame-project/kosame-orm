import type { Table } from "drizzle-orm";
import type { Model, ModelClass } from "../model/index.js";

export interface HasManyDescriptor<TChild extends Model = Model, TTable extends Table = Table> {
  readonly kind: "hasMany";
  readonly target: () => ModelClass<TChild, TTable>;
  readonly foreignKey: string;
  readonly localKey?: string;
}

export interface BelongsToDescriptor<TParent extends Model = Model, TTable extends Table = Table> {
  readonly kind: "belongsTo";
  readonly target: () => ModelClass<TParent, TTable>;
  readonly foreignKey: string;
  readonly targetKey?: string;
}

export type RelationDescriptor = HasManyDescriptor | BelongsToDescriptor;

import type { Table } from "drizzle-orm";
import type { Model, ModelClass } from "../model/index.js";
import type { BelongsToDescriptor, HasManyDescriptor } from "./types.js";

export function hasMany<TChild extends Model, TTable extends Table>(
  target: () => ModelClass<TChild, TTable>,
  options: { foreignKey: string; localKey?: string },
): HasManyDescriptor<TChild, TTable> {
  return { kind: "hasMany", target, ...options };
}

export function belongsTo<TParent extends Model, TTable extends Table>(
  target: () => ModelClass<TParent, TTable>,
  options: { foreignKey: string; targetKey?: string },
): BelongsToDescriptor<TParent, TTable> {
  return { kind: "belongsTo", target, ...options };
}

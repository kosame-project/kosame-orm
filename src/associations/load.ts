import { isNull } from "drizzle-orm";
import { INTERNAL } from "../model/internal.js";
import type { Model, ModelClass, ModelContext } from "../model/index.js";
import { DB, getColumn, getPrimaryKey, selectWhereIn } from "../query/index.js";
import { getSoftDeleteColumn } from "../soft-delete/index.js";
import type { RelationDescriptor } from "./types.js";

function hydrate<T extends Model>(modelClass: ModelClass<T>, context: ModelContext, row: Record<string, unknown>): T {
  const instance = new modelClass({ brand: INTERNAL, context });
  Object.assign(instance, row);
  return instance;
}

function get(instance: Model, key: string): unknown {
  return (instance as unknown as Record<string, unknown>)[key];
}

function set(instance: Model, key: string, value: unknown): void {
  (instance as unknown as Record<string, unknown>)[key] = value;
}

export async function loadRelation(
  context: ModelContext,
  parents: readonly Model[],
  relationKey: string,
  descriptor: RelationDescriptor,
): Promise<void> {
  const firstParent = parents[0];
  if (!firstParent) {
    return;
  }

  const parentTable = (firstParent.constructor as ModelClass).table;
  const targetClass = descriptor.target();
  const targetTable = targetClass.table;
  const db = context[DB];
  const softDeleteColumn = getSoftDeleteColumn(targetClass, targetTable);
  const excludeDeleted = softDeleteColumn ? isNull(softDeleteColumn) : undefined;

  if (descriptor.kind === "hasMany") {
    const localKeyName = descriptor.localKey ?? getPrimaryKey(parentTable)?.key;
    if (!localKeyName) {
      throw new Error(`kosame: hasMany("${relationKey}") could not determine the parent's key.`);
    }

    const foreignColumn = getColumn(targetTable, descriptor.foreignKey);
    const parentKeyValues = [...new Set(parents.map((parent) => get(parent, localKeyName)))];
    const rows = await selectWhereIn(db, targetTable, foreignColumn, parentKeyValues, excludeDeleted);

    const grouped = new Map<unknown, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = row[descriptor.foreignKey];
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }

    for (const parent of parents) {
      const childRows = grouped.get(get(parent, localKeyName)) ?? [];
      set(
        parent,
        relationKey,
        childRows.map((row) => hydrate(targetClass, context, row)),
      );
    }
    return;
  }

  const targetKeyName = descriptor.targetKey ?? getPrimaryKey(targetTable)?.key;
  if (!targetKeyName) {
    throw new Error(`kosame: belongsTo("${relationKey}") could not determine the target's key.`);
  }

  const targetColumn = getColumn(targetTable, targetKeyName);
  const foreignKeyValues = [...new Set(parents.map((parent) => get(parent, descriptor.foreignKey)))].filter(
    (value) => value !== null && value !== undefined,
  );
  const rows = await selectWhereIn(db, targetTable, targetColumn, foreignKeyValues, excludeDeleted);

  const byTargetKey = new Map<unknown, Record<string, unknown>>();
  for (const row of rows) {
    byTargetKey.set(row[targetKeyName], row);
  }

  for (const parent of parents) {
    const row = byTargetKey.get(get(parent, descriptor.foreignKey));
    set(parent, relationKey, row ? hydrate(targetClass, context, row) : undefined);
  }
}

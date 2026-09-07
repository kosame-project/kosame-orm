import type { Column, Table } from "drizzle-orm";
import { getColumn } from "../query/index.js";

export const SOFT_DELETE_COLUMN: unique symbol = Symbol("kosame:softDeleteColumn");

export interface SoftDeletableClass {
  readonly [SOFT_DELETE_COLUMN]?: string;
}

export function getSoftDeleteColumn(modelClass: SoftDeletableClass, table: Table): Column | undefined {
  const key = modelClass[SOFT_DELETE_COLUMN];
  return key === undefined ? undefined : getColumn(table, key);
}

import { getTableColumns } from "drizzle-orm";
import type { Column, Table } from "drizzle-orm";

export function getColumn(table: Table, key: string): Column {
  const column = getTableColumns(table)[key];
  if (!column) {
    throw new Error(`kosame: column "${key}" was not found on this table.`);
  }
  return column;
}

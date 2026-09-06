import { getTableColumns } from "drizzle-orm";
import type { Column, Table } from "drizzle-orm";

export interface PrimaryKey {
  readonly key: string;
  readonly column: Column;
}

export function getPrimaryKey(table: Table): PrimaryKey | undefined {
  const columns = getTableColumns(table);
  const entries = Object.entries(columns).filter(([, column]) => column.primary);

  const first = entries[0];
  if (!first) {
    return undefined;
  }
  if (entries.length > 1) {
    throw new Error(
      "kosame: composite primary keys are not supported yet (found more than one `primary` column).",
    );
  }

  const [key, column] = first;
  return { key, column };
}

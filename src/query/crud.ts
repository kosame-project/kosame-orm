import { and, eq, inArray } from "drizzle-orm";
import type { Column, SQL, Table } from "drizzle-orm";
import { getPrimaryKey, type PrimaryKey } from "./primary-key.js";

export async function insertRow(
  db: any,
  table: Table,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const primaryKey = getPrimaryKey(table);
  const insertQuery = db.insert(table).values(values);

  if (primaryKey && primaryKey.key in values) {
    await insertQuery;
    const row = await selectByPrimaryKey(db, table, primaryKey, values[primaryKey.key]);
    if (!row) {
      throw new Error(`kosame: could not find the row just inserted (primary key "${primaryKey.key}").`);
    }
    return row;
  }

  if (typeof insertQuery.returning === "function") {
    const [row] = await insertQuery.returning();
    if (!row) {
      throw new Error("kosame: insert did not return the inserted row.");
    }
    return row;
  }

  if (!primaryKey) {
    throw new Error(
      "kosame: this table has no primary key, so the inserted row cannot be re-fetched on this dialect.",
    );
  }

  const [generated] = await insertQuery.$returningId();
  const row = await selectByPrimaryKey(db, table, primaryKey, generated[primaryKey.key]);
  if (!row) {
    throw new Error(`kosame: could not find the row just inserted (primary key "${primaryKey.key}").`);
  }
  return row;
}

export async function selectByPrimaryKey(
  db: any,
  table: Table,
  primaryKey: PrimaryKey,
  pkValue: unknown,
  extra?: SQL,
): Promise<Record<string, unknown> | undefined> {
  const condition = extra ? and(eq(primaryKey.column, pkValue), extra) : eq(primaryKey.column, pkValue);
  const rows = await db.select().from(table).where(condition);
  return rows[0];
}

export async function updateByPrimaryKey(
  db: any,
  table: Table,
  primaryKey: PrimaryKey,
  pkValue: unknown,
  changes: Record<string, unknown>,
): Promise<void> {
  await db.update(table).set(changes).where(eq(primaryKey.column, pkValue));
}

export async function deleteByPrimaryKey(
  db: any,
  table: Table,
  primaryKey: PrimaryKey,
  pkValue: unknown,
): Promise<void> {
  await db.delete(table).where(eq(primaryKey.column, pkValue));
}

export async function selectWhereIn(
  db: any,
  table: Table,
  column: Column,
  values: readonly unknown[],
  extra?: SQL,
): Promise<Record<string, unknown>[]> {
  if (values.length === 0) {
    return [];
  }
  const condition = extra ? and(inArray(column, values), extra) : inArray(column, values);
  return db.select().from(table).where(condition);
}

import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { deleteByPrimaryKey, getPrimaryKey, insertRow, selectByPrimaryKey, updateByPrimaryKey } from "./index.js";

const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

function createDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  return drizzle(sqlite);
}

describe("getPrimaryKey", () => {
  test("finds the single primary key column", () => {
    const primaryKey = getPrimaryKey(users);
    expect(primaryKey?.key).toBe("id");
  });
});

describe("insertRow / selectByPrimaryKey / updateByPrimaryKey / deleteByPrimaryKey", () => {
  test("round-trips a row through insert, select, update and delete", async () => {
    const db = createDb();
    const primaryKey = getPrimaryKey(users)!;

    const inserted = await insertRow(db, users, { name: "alice" });
    expect(inserted).toEqual({ id: 1, name: "alice" });

    const found = await selectByPrimaryKey(db, users, primaryKey, inserted["id"]);
    expect(found).toEqual({ id: 1, name: "alice" });

    await updateByPrimaryKey(db, users, primaryKey, inserted["id"], { name: "bob" });
    const updated = await selectByPrimaryKey(db, users, primaryKey, inserted["id"]);
    expect(updated).toEqual({ id: 1, name: "bob" });

    await deleteByPrimaryKey(db, users, primaryKey, inserted["id"]);
    const afterDelete = await selectByPrimaryKey(db, users, primaryKey, inserted["id"]);
    expect(afterDelete).toBeUndefined();
  });

  test("insertRow re-selects the row when the primary key is client-supplied", async () => {
    const db = createDb();
    const inserted = await insertRow(db, users, { id: 42, name: "carol" });
    expect(inserted).toEqual({ id: 42, name: "carol" });
  });
});

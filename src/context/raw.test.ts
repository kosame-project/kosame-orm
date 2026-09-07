import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Model } from "../model/index.js";
import { createContext } from "./context.js";

const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

class User extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
}

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  const db = drizzle(sqlite);
  return { context: createContext(db, { users: User }), db };
}

describe("context.raw", () => {
  test("is the same drizzle db instance passed to createContext()", () => {
    const { context, db } = createTestContext();
    expect(context.raw).toBe(db);
  });

  test("query results via raw are plain drizzle rows, not hydrated Model instances", async () => {
    const { context } = createTestContext();
    await context.users.add({ name: "alice" });

    const rows = await context.raw.select().from(usersTable);

    expect(rows).toEqual([{ id: 1, name: "alice" }]);
    expect(rows[0]).not.toBeInstanceOf(User);
  });

  test("txContext.raw is usable for a raw query while inside transaction()", async () => {
    const { context } = createTestContext();

    await context.transaction(async (txContext) => {
      await txContext.raw.insert(usersTable).values({ name: "bob" });
    });

    const rows = await context.raw.select().from(usersTable);
    expect(rows.map((row) => row.name)).toEqual(["bob"]);
  });
});

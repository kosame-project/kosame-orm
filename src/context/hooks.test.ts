import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Model } from "../model/index.js";
import { createContext } from "./context.js";

const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

class NormalizingUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare email: string;

  override async beforeCreate(): Promise<void> {
    this.email = this.email.toLowerCase();
  }
}

class RejectingUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare email: string;

  override async beforeCreate(): Promise<void> {
    if (!this.email.includes("@")) {
      throw new Error("invalid email");
    }
  }
}

class PlainUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare email: string;
}

function createTestContext<T extends { new (...args: any): Model; table: typeof usersTable }>(modelClass: T) {
  const sqlite = new Database(":memory:");
  sqlite.exec(
    "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL)",
  );
  const db = drizzle(sqlite);
  return createContext(db, { users: modelClass });
}

describe("beforeCreate()", () => {
  test("can mutate the instance before it is inserted, and the write reflects the mutation", async () => {
    const context = createTestContext(NormalizingUser);

    const user = await context.users.add({ name: "Alice", email: "Alice@Example.com" });

    expect(user.email).toBe("alice@example.com");

    const reselected = await context.users.find(user.id);
    expect(reselected?.email).toBe("alice@example.com");
  });

  test("throwing aborts the insert entirely", async () => {
    const context = createTestContext(RejectingUser);

    await expect(context.users.add({ name: "Bob", email: "not-an-email" })).rejects.toThrow("invalid email");

    const all = await context.users.find(1);
    expect(all).toBeUndefined();
  });

  test("is a no-op by default", async () => {
    const context = createTestContext(PlainUser);
    const user = await context.users.add({ name: "carol", email: "Carol@Example.com" });
    expect(user.email).toBe("Carol@Example.com");
  });
});

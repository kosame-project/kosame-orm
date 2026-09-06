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

class NormalizingOnUpdateUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare email: string;

  override async beforeUpdate(changes: Record<string, unknown>): Promise<void> {
    if (typeof changes["email"] === "string") {
      changes["email"] = changes["email"].toLowerCase();
    }
  }
}

class RejectingOnUpdateUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare email: string;

  override async beforeUpdate(changes: Record<string, unknown>): Promise<void> {
    if (changes["email"] === "") {
      throw new Error("email cannot be blank");
    }
  }
}

const deleteAttempts: string[] = [];

class LoggingUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare email: string;

  override async beforeDelete(): Promise<void> {
    deleteAttempts.push(this.email);
  }
}

class RejectingOnDeleteUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare email: string;

  override async beforeDelete(): Promise<void> {
    throw new Error("deletion is disabled");
  }
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

describe("beforeUpdate()", () => {
  test("update(): can mutate `changes` before the UPDATE runs, and the instance reflects the mutation", async () => {
    const context = createTestContext(NormalizingOnUpdateUser);
    const user = await context.users.add({ name: "dave", email: "dave@example.com" });

    await user.update({ email: "Dave@Example.com" });

    expect(user.email).toBe("dave@example.com");
    const reselected = await context.users.find(user.id);
    expect(reselected?.email).toBe("dave@example.com");
  });

  test("save(): also runs beforeUpdate() over the full set of non-primary-key columns", async () => {
    const context = createTestContext(NormalizingOnUpdateUser);
    const user = await context.users.add({ name: "erin", email: "erin@example.com" });

    user.email = "Erin@Example.com";
    await user.save();

    expect(user.email).toBe("erin@example.com");
    const reselected = await context.users.find(user.id);
    expect(reselected?.email).toBe("erin@example.com");
  });

  test("throwing aborts update() entirely", async () => {
    const context = createTestContext(RejectingOnUpdateUser);
    const user = await context.users.add({ name: "frank", email: "frank@example.com" });

    await expect(user.update({ email: "" })).rejects.toThrow("email cannot be blank");

    const reselected = await context.users.find(user.id);
    expect(reselected?.email).toBe("frank@example.com");
  });

  test("throwing aborts save() entirely", async () => {
    const context = createTestContext(RejectingOnUpdateUser);
    const user = await context.users.add({ name: "grace", email: "grace@example.com" });

    user.email = "";
    await expect(user.save()).rejects.toThrow("email cannot be blank");

    const reselected = await context.users.find(user.id);
    expect(reselected?.email).toBe("grace@example.com");
  });

  test("is a no-op by default", async () => {
    const context = createTestContext(PlainUser);
    const user = await context.users.add({ name: "henry", email: "henry@example.com" });

    await user.update({ email: "Henry@Example.com" });

    expect(user.email).toBe("Henry@Example.com");
  });
});

describe("beforeDelete()", () => {
  test("runs before the row is removed", async () => {
    deleteAttempts.length = 0;
    const context = createTestContext(LoggingUser);
    const user = await context.users.add({ name: "iris", email: "iris@example.com" });

    await user.delete();

    expect(deleteAttempts).toEqual(["iris@example.com"]);
    expect(await context.users.find(user.id)).toBeUndefined();
  });

  test("throwing aborts delete() entirely", async () => {
    const context = createTestContext(RejectingOnDeleteUser);
    const user = await context.users.add({ name: "jack", email: "jack@example.com" });

    await expect(user.delete()).rejects.toThrow("deletion is disabled");

    expect(await context.users.find(user.id)).toBeInstanceOf(RejectingOnDeleteUser);
  });

  test("is a no-op by default", async () => {
    const context = createTestContext(PlainUser);
    const user = await context.users.add({ name: "kate", email: "kate@example.com" });

    await user.delete();

    expect(await context.users.find(user.id)).toBeUndefined();
  });
});

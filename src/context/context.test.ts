import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Model } from "../model/index.js";
import { ModelCollection } from "./collection.js";
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

class Post extends Model {
  static table = usersTable;
}

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  const db = drizzle(sqlite);
  return createContext(db, { users: User, posts: Post });
}


describe("createContext", () => {
  test("builds one ModelCollection per schema key", () => {
    const context = createTestContext();

    expect(context.users).toBeInstanceOf(ModelCollection);
    expect(context.posts).toBeInstanceOf(ModelCollection);
  });

  test("entry points are plain own properties assembled at construction time, not a Proxy", () => {
    const context = createTestContext();

    expect(Object.keys(context).sort()).toEqual(["posts", "users"]);
    expect(Object.prototype.hasOwnProperty.call(context, "users")).toBe(true);
  });
});

describe("ModelCollection.add / find", () => {
  test("add() inserts a row and returns a hydrated, persisted Model instance", async () => {
    const context = createTestContext();

    const user = await context.users.add({ name: "alice" });

    expect(user).toBeInstanceOf(User);
    expect(user.id).toBe(1);
    expect(user.name).toBe("alice");
  });

  test("find() returns a hydrated instance for an existing row, undefined otherwise", async () => {
    const context = createTestContext();
    const created = await context.users.add({ name: "bob" });

    const found = await context.users.find(created.id);
    expect(found).toBeInstanceOf(User);
    expect(found?.name).toBe("bob");

    const missing = await context.users.find(999);
    expect(missing).toBeUndefined();
  });
});

describe("Model instance methods", () => {
  test("update() writes only the given fields and reflects them locally", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "carol" });

    await user.update({ name: "carol2" });
    expect(user.name).toBe("carol2");

    const reselected = await context.users.find(user.id);
    expect(reselected?.name).toBe("carol2");
  });

  test("save() writes every non-primary-key column currently held in memory", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "dave" });

    user.name = "dave2";
    await user.save();

    const reselected = await context.users.find(user.id);
    expect(reselected?.name).toBe("dave2");
  });

  test("delete() removes the row", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "erin" });

    await user.delete();

    const reselected = await context.users.find(user.id);
    expect(reselected).toBeUndefined();
  });

  test("reload() overwrites in-memory values with what is currently in the DB", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "frank" });
    const other = await context.users.find(user.id);
    await other!.update({ name: "frank2" });

    expect(user.name).toBe("frank");
    await user.reload();
    expect(user.name).toBe("frank2");
  });
});

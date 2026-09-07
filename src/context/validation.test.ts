import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { hasMany } from "../associations/index.js";
import { Model } from "../model/index.js";
import { createContext } from "./context.js";

const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
});

const postsTable = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  views: integer("views").notNull(),
});

class User extends Model {
  static table = usersTable;
  static schema = createInsertSchema(usersTable);
  static relations = { posts: hasMany(() => Post, { foreignKey: "authorId" }) };
  declare id: number;
  declare name: string;
  declare age: number;
  declare posts?: Post[];
}

class Post extends Model {
  static table = postsTable;
  static schema = createInsertSchema(postsTable);
  declare id: number;
  declare authorId: number;
  declare title: string;
  declare views: number;
}

class PlainUser extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
  declare age: number;
}

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL)");
  sqlite.exec(
    "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL, title TEXT NOT NULL, views INTEGER NOT NULL)",
  );
  const db = drizzle(sqlite);
  return createContext(db, { users: User, posts: Post });
}

describe("schema validation on write", () => {
  test("add() rejects a value that fails the schema", async () => {
    const context = createTestContext();
    await expect(context.users.add({ name: "alice", age: "not-a-number" as unknown as number })).rejects.toThrow(
      "schema validation failed",
    );
  });

  test("add() accepts valid values", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "alice", age: 30 });
    expect(user.name).toBe("alice");
  });

  test("update() validates the (partial) changes against schema.partial()", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "bob", age: 20 });

    await expect(user.update({ age: "old" as unknown as number })).rejects.toThrow("schema validation failed");
    await expect(user.update({ name: "bobby" })).resolves.toBeUndefined();
  });

  test("save() validates the full non-primary-key column set", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "carol", age: 25 });

    (user as unknown as { age: unknown }).age = "young";
    await expect(user.save()).rejects.toThrow("schema validation failed");
  });

  test("a Model without static schema is never validated", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(
      "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL)",
    );
    const context = createContext(drizzle(sqlite), { users: PlainUser });

    const user = await context.users.add({ name: "dave", age: "not-a-number" as unknown as number });
    expect(user.name).toBe("dave");
  });
});

describe("schema validation on read (hydration)", () => {
  test("find() throws if a row already in the DB fails the schema (e.g. drift)", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "erin", age: 40 });

    context.raw.run(sql.raw(`UPDATE users SET age = 'oops' WHERE id = ${user.id}`));

    await expect(context.users.find(user.id)).rejects.toThrow("schema validation failed");
  });

  test("reload() throws if the row currently in the DB fails the schema", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "frank", age: 40 });

    context.raw.run(sql.raw(`UPDATE users SET age = 'oops' WHERE id = ${user.id}`));

    await expect(user.reload()).rejects.toThrow("schema validation failed");
  });

  test("association loading validates the target rows too", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "grace", age: 50 });
    const post = await context.posts.add({ authorId: user.id, title: "hello", views: 0 });

    context.raw.run(sql.raw(`UPDATE posts SET views = 'oops' WHERE id = ${post.id}`));

    await expect(context.users.find(user.id, { include: ["posts"] })).rejects.toThrow("schema validation failed");
  });
});

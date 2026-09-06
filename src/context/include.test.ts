import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { belongsTo, hasMany } from "../associations/index.js";
import { Model } from "../model/index.js";
import { createContext } from "./context.js";

const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

const postsTable = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
});

class User extends Model {
  static table = usersTable;
  static relations = {
    posts: hasMany(() => Post, { foreignKey: "authorId" }),
  };
  declare id: number;
  declare name: string;
  declare posts?: Post[];
}

class Post extends Model {
  static table = postsTable;
  static relations = {
    author: belongsTo(() => User, { foreignKey: "authorId" }),
  };
  declare id: number;
  declare authorId: number;
  declare title: string;
  declare author?: User;
}

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  sqlite.exec(
    "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL, title TEXT NOT NULL)",
  );
  const db = drizzle(sqlite);
  return createContext(db, { users: User, posts: Post });
}

describe("context.<collection>.find(pk, { include })", () => {
  test("eager-loads a hasMany relation defined via `static relations`", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "alice" });
    await context.posts.add({ authorId: user.id, title: "post-1" });
    await context.posts.add({ authorId: user.id, title: "post-2" });

    const found = await context.users.find(user.id, { include: ["posts"] });

    expect(found?.posts?.map((p) => p.title).sort()).toEqual(["post-1", "post-2"]);
    expect(found?.posts?.every((p) => p instanceof Post)).toBe(true);
  });

  test("eager-loads a belongsTo relation defined via `static relations`", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "bob" });
    const post = await context.posts.add({ authorId: user.id, title: "post-1" });

    const found = await context.posts.find(post.id, { include: ["author"] });

    expect(found?.author).toBeInstanceOf(User);
    expect(found?.author?.name).toBe("bob");
  });

  test("without include, the relation property is left untouched", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "carol" });
    await context.posts.add({ authorId: user.id, title: "post-1" });

    const found = await context.users.find(user.id);
    expect(found?.posts).toBeUndefined();
  });

  test("throws for an unknown relation name", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "dave" });

    await expect(context.users.find(user.id, { include: ["nope"] })).rejects.toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { belongsTo, hasMany } from "../associations/index.js";
import { Model } from "../model/index.js";
import { deletedAtColumn } from "../soft-delete/columns.sqlite.js";
import { SoftDeletable } from "../soft-delete/soft-deletable.js";
import { createContext } from "./context.js";

const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

const postsTable = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  deletedAt: deletedAtColumn(),
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

class Post extends SoftDeletable(Model) {
  static table = postsTable;
  static relations = {
    author: belongsTo(() => User, { foreignKey: "authorId" }),
  };
  declare id: number;
  declare authorId: number;
  declare title: string;
  declare deletedAt: Date | null;
  declare author?: User;
}

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  sqlite.exec(
    "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL, title TEXT NOT NULL, deletedAt INTEGER)",
  );
  const db = drizzle(sqlite);
  return createContext(db, { users: User, posts: Post });
}

describe("find() and soft delete", () => {
  test("find() excludes a soft-deleted row by default", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "alice" });
    const post = await context.posts.add({ authorId: user.id, title: "hello" });
    await post.delete();

    expect(await context.posts.find(post.id)).toBeUndefined();
  });

  test("find() with withDeleted: true still returns a soft-deleted row", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "bob" });
    const post = await context.posts.add({ authorId: user.id, title: "hello" });
    await post.delete();

    const found = await context.posts.find(post.id, { withDeleted: true });
    expect(found?.id).toBe(post.id);
    expect(found?.deletedAt).toBeInstanceOf(Date);
  });

  test("find() on a Model without SoftDeletable is unaffected", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "carol" });

    expect((await context.users.find(user.id))?.name).toBe("carol");
  });
});

describe("loadRelation() and soft delete", () => {
  test("hasMany excludes soft-deleted children by default", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "dave" });
    await context.posts.add({ authorId: user.id, title: "keep" });
    const post2 = await context.posts.add({ authorId: user.id, title: "drop" });
    await post2.delete();

    const found = await context.users.find(user.id, { include: ["posts"] });
    expect(found?.posts?.map((p) => p.title)).toEqual(["keep"]);
  });

  test("belongsTo excludes a soft-deleted target by default", async () => {
    const softUsersTable = sqliteTable("soft_users", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      name: text("name").notNull(),
      deletedAt: deletedAtColumn(),
    });
    const notesTable = sqliteTable("notes", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      authorId: integer("author_id").notNull(),
    });

    class SoftUser extends SoftDeletable(Model) {
      static table = softUsersTable;
      declare id: number;
      declare name: string;
      declare deletedAt: Date | null;
    }

    class Note extends Model {
      static table = notesTable;
      static relations = { author: belongsTo(() => SoftUser, { foreignKey: "authorId" }) };
      declare id: number;
      declare authorId: number;
      declare author?: SoftUser;
    }

    const sqlite = new Database(":memory:");
    sqlite.exec("CREATE TABLE soft_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, deletedAt INTEGER)");
    sqlite.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL)");
    const context = createContext(drizzle(sqlite), { users: SoftUser, notes: Note });

    const author = await context.users.add({ name: "frank" });
    const note = await context.notes.add({ authorId: author.id });

    const foundBefore = await context.notes.find(note.id, { include: ["author"] });
    expect(foundBefore?.author?.name).toBe("frank");

    await author.delete();
    const foundAfter = await context.notes.find(note.id, { include: ["author"] });
    expect(foundAfter?.author).toBeUndefined();
  });
});

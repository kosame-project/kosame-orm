import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Model } from "../model/index.js";
import { DB } from "../query/index.js";
import { belongsTo, hasMany } from "./define.js";
import { loadRelation } from "./load.js";

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
  declare id: number;
  declare name: string;
  declare posts?: Post[];
}

class Post extends Model {
  static table = postsTable;
  declare id: number;
  declare authorId: number;
  declare title: string;
  declare author?: User;
}

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  sqlite.exec(
    "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL, title TEXT NOT NULL)",
  );
  return drizzle(sqlite);
}

function fakeContext(db: unknown) {
  return { [DB]: db } as { readonly [DB]: unknown };
}

describe("loadRelation (hasMany)", () => {
  test("batches a single IN query across multiple parents and groups children by parent key", async () => {
    const db = createTestDb();
    const context = fakeContext(db);

    await db.insert(usersTable).values([
      { id: 1, name: "alice" },
      { id: 2, name: "bob" },
    ]);
    await db.insert(postsTable).values([
      { authorId: 1, title: "alice-1" },
      { authorId: 1, title: "alice-2" },
      { authorId: 2, title: "bob-1" },
    ]);

    const alice = Object.assign(Object.create(User.prototype), { id: 1, name: "alice" }) as User;
    const bob = Object.assign(Object.create(User.prototype), { id: 2, name: "bob" }) as User;

    await loadRelation(context, [alice, bob], "posts", hasMany(() => Post, { foreignKey: "authorId" }));

    expect(alice.posts?.map((p) => p.title).sort()).toEqual(["alice-1", "alice-2"]);
    expect(bob.posts?.map((p) => p.title)).toEqual(["bob-1"]);
    expect(alice.posts?.every((p) => p instanceof Post)).toBe(true);
  });

  test("parents with no matching children get an empty array", async () => {
    const db = createTestDb();
    const context = fakeContext(db);
    await db.insert(usersTable).values({ id: 1, name: "carol" });

    const carol = Object.assign(Object.create(User.prototype), { id: 1, name: "carol" }) as User;
    await loadRelation(context, [carol], "posts", hasMany(() => Post, { foreignKey: "authorId" }));

    expect(carol.posts).toEqual([]);
  });
});

describe("loadRelation (belongsTo)", () => {
  test("resolves the single parent row for each child", async () => {
    const db = createTestDb();
    const context = fakeContext(db);

    await db.insert(usersTable).values({ id: 1, name: "dave" });
    await db.insert(postsTable).values({ id: 10, authorId: 1, title: "dave-1" });

    const post = Object.assign(Object.create(Post.prototype), { id: 10, authorId: 1, title: "dave-1" }) as Post;

    await loadRelation(context, [post], "author", belongsTo(() => User, { foreignKey: "authorId" }));

    expect(post.author).toBeInstanceOf(User);
    expect(post.author?.name).toBe("dave");
  });
});

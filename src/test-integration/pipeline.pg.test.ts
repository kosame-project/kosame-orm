import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { belongsTo, hasMany } from "../associations/index.js";
import { createContext } from "../context/index.js";
import { Model } from "../model/index.js";
import { SoftDeletable } from "../soft-delete/index.js";
import { POSTGRES_URL } from "./connections.js";

const usersTable = pgTable("kosame_it_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
});

const postsTable = pgTable("kosame_it_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("authorId").notNull(),
  title: text("title").notNull(),
  deletedAt: timestamp("deletedAt"),
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

class Post extends SoftDeletable(Model) {
  static table = postsTable;
  static relations = { author: belongsTo(() => User, { foreignKey: "authorId" }) };
  declare id: number;
  declare authorId: number;
  declare title: string;
  declare deletedAt: Date | null;
  declare author?: User;
}

const pool = new Pool({ connectionString: POSTGRES_URL });
const db = drizzle(pool);

beforeAll(async () => {
  await pool.query("DROP TABLE IF EXISTS kosame_it_posts");
  await pool.query("DROP TABLE IF EXISTS kosame_it_users");
  await pool.query(
    `CREATE TABLE kosame_it_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL)`,
  );
  await pool.query(
    `CREATE TABLE kosame_it_posts (id SERIAL PRIMARY KEY, "authorId" INTEGER NOT NULL, title TEXT NOT NULL, "deletedAt" TIMESTAMP)`,
  );
});

afterAll(async () => {
  await pool.end();
});

function createTestContext() {
  return createContext(db, { users: User, posts: Post });
}

describe("PostgreSQL: CRUD + hooks + associations", () => {
  test("add() -> find() -> update() -> save() -> reload() -> delete()", async () => {
    const context = createTestContext();

    const user = await context.users.add({ name: "alice", age: 30 });
    expect(user.id).toBeGreaterThan(0);

    const found = await context.users.find(user.id);
    expect(found?.name).toBe("alice");

    await user.update({ age: 31 });
    expect((await context.users.find(user.id))?.age).toBe(31);

    user.name = "alice2";
    await user.save();
    expect((await context.users.find(user.id))?.name).toBe("alice2");

    await user.update({ name: "alice3" });
    await user.reload();
    expect(user.name).toBe("alice3");

    await user.delete();
    expect(await context.users.find(user.id)).toBeUndefined();
  });

  test("hooks: beforeCreate normalizes, static schema rejects invalid writes", async () => {
    const context = createTestContext();

    await expect(context.users.add({ name: "bob", age: "old" as unknown as number })).rejects.toThrow(
      "schema validation failed",
    );

    const user = await context.users.add({ name: "bob", age: 40 });
    expect(user.age).toBe(40);
  });

  test("associations: hasMany/belongsTo via include", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "carol", age: 25 });
    await context.posts.add({ authorId: user.id, title: "post-1" });
    await context.posts.add({ authorId: user.id, title: "post-2" });

    const foundUser = await context.users.find(user.id, { include: ["posts"] });
    expect(foundUser?.posts?.map((p) => p.title).sort()).toEqual(["post-1", "post-2"]);

    const post = foundUser!.posts![0]!;
    const foundPost = await context.posts.find(post.id, { include: ["author"] });
    expect(foundPost?.author?.name).toBe("carol");
  });

  test("soft delete: delete() excludes by default, hardDelete() truly removes", async () => {
    const context = createTestContext();
    const user = await context.users.add({ name: "dave", age: 50 });
    const post = await context.posts.add({ authorId: user.id, title: "soft-me" });

    await post.delete();
    expect(await context.posts.find(post.id)).toBeUndefined();
    expect((await context.posts.find(post.id, { withDeleted: true }))?.deletedAt).toBeInstanceOf(Date);

    const post2 = await context.posts.add({ authorId: user.id, title: "hard-me" });
    await post2.hardDelete();
    expect(await context.posts.find(post2.id, { withDeleted: true })).toBeUndefined();
  });

  test("transactions: commits, rolls back across a real async gap, and nests via SAVEPOINT", async () => {
    const context = createTestContext();

    const committed = await context.transaction(async (txContext) => {
      const user = await txContext.users.add({ name: "erin", age: 60 });
      return user.id;
    });
    expect(await context.users.find(committed)).toBeDefined();

    let rolledBackId: number | undefined;
    await expect(
      context.transaction(async (txContext) => {
        const user = await txContext.users.add({ name: "frank", age: 70 });
        rolledBackId = user.id;
        await new Promise((resolve) => setTimeout(resolve, 20));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await context.users.find(rolledBackId!)).toBeUndefined();

    await context.transaction(async (txContext) => {
      await txContext.users.add({ name: "outer-ok", age: 1 });
      await expect(
        txContext.transaction(async (innerTxContext) => {
          await innerTxContext.users.add({ name: "inner-bad", age: 2 });
          await new Promise((resolve) => setTimeout(resolve, 20));
          throw new Error("inner failure");
        }),
      ).rejects.toThrow("inner failure");
    });
    const names = (await db.select().from(usersTable)).map((row) => row.name);
    expect(names).toContain("outer-ok");
    expect(names).not.toContain("inner-bad");
  });
});

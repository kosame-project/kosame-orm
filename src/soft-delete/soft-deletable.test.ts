import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createContext } from "../context/index.js";
import { Model } from "../model/index.js";
import { deletedAtColumn } from "./columns.sqlite.js";
import { SoftDeletable } from "./soft-deletable.js";

const postsTable = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  deletedAt: deletedAtColumn(),
});

class Post extends SoftDeletable(Model) {
  static table = postsTable;
  declare id: number;
  declare title: string;
  declare deletedAt: Date | null;
}

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, deletedAt INTEGER)");
  const db = drizzle(sqlite);
  return createContext(db, { posts: Post });
}

describe("SoftDeletable", () => {
  test("delete() sets deletedAt on the instance instead of removing the row", async () => {
    const context = createTestContext();
    const post = await context.posts.add({ title: "hello" });
    expect(post.deletedAt).toBeNull();

    await post.delete();

    expect(post.deletedAt).toBeInstanceOf(Date);
  });

  test("hardDelete() actually removes the row", async () => {
    const context = createTestContext();
    const post = await context.posts.add({ title: "will be gone" });

    await post.hardDelete();

    const reselected = await context.posts.find(post.id);
    expect(reselected).toBeUndefined();
  });

  test("beforeDelete() still runs on a soft delete()", async () => {
    const calls: string[] = [];

    class LoggingPost extends SoftDeletable(Model) {
      static table = postsTable;
      declare id: number;
      declare title: string;
      declare deletedAt: Date | null;

      override async beforeDelete(): Promise<void> {
        calls.push("beforeDelete");
      }
    }

    const sqlite = new Database(":memory:");
    sqlite.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, deletedAt INTEGER)");
    const context = createContext(drizzle(sqlite), { posts: LoggingPost });

    const post = await context.posts.add({ title: "hello" });
    await post.delete();

    expect(calls).toEqual(["beforeDelete"]);
  });
});

import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Constructor } from "../model/index.js";
import { Model } from "../model/index.js";
import { createContext } from "./context.js";

const createdInstances: unknown[] = [];

function WithTag<TBase extends Constructor<Model>>(Base: TBase) {
  abstract class WithTagMixin extends Base {
    tag = "tagged";

    override async beforeCreate(): Promise<void> {
      await super.beforeCreate();
      createdInstances.push(this);
    }
  }
  return WithTagMixin;
}

function WithGreeting<TBase extends Constructor<Model>>(Base: TBase) {
  abstract class WithGreetingMixin extends Base {
    greet(): string {
      return "hello";
    }
  }
  return WithGreetingMixin;
}

const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

class Post extends WithGreeting(WithTag(Model)) {
  static table = usersTable;
  declare id: number;
  declare name: string;
}

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  const db = drizzle(sqlite);
  return createContext(db, { posts: Post });
}

describe("mixin-composed Model classes work through the full context pipeline", () => {
  test("members from every mixin are present on an instance obtained via add()", async () => {
    const context = createTestContext();
    createdInstances.length = 0;

    const post = await context.posts.add({ name: "hello world" });

    expect(post.tag).toBe("tagged");
    expect(post.greet()).toBe("hello");
    expect(createdInstances).toEqual([post]);
  });

  test("Model's CRUD instance methods keep working on a mixin-composed class", async () => {
    const context = createTestContext();
    const post = await context.posts.add({ name: "original" });

    await post.update({ name: "updated" });
    expect(post.name).toBe("updated");

    const reselected = await context.posts.find(post.id);
    expect(reselected?.name).toBe("updated");
    expect(reselected?.tag).toBe("tagged");

    await post.delete();
    expect(await context.posts.find(post.id)).toBeUndefined();
  });
});

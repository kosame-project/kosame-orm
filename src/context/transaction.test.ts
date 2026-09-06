import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Model } from "../model/index.js";
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

function createTestContext() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  const db = drizzle(sqlite);
  return createContext(db, { users: User });
}

describe("context.transaction()", () => {
  test("commits everything written through txContext on success", async () => {
    const context = createTestContext();

    const result = await context.transaction(async (txContext) => {
      await txContext.users.add({ name: "alice" });
      await txContext.users.add({ name: "bob" });
      return "done";
    });

    expect(result).toBe("done");
    const all = await context.users.find(1);
    expect(all?.name).toBe("alice");
    expect((await context.users.find(2))?.name).toBe("bob");
  });

  test("rolls back everything written through txContext when the callback throws, even across a real async gap", async () => {
    const context = createTestContext();

    await expect(
      context.transaction(async (txContext) => {
        await txContext.users.add({ name: "carol" });
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await context.users.find(1)).toBeUndefined();
  });

  test("SQLite caveat: a write through the outer (non-tx) context still lands inside an open transaction, since better-sqlite3/bun:sqlite are single-connection", async () => {
    const context = createTestContext();
    const outerUser = await context.users.add({ name: "dave" });

    await expect(
      context.transaction(async () => {
        await outerUser.update({ name: "dave-updated" });
        throw new Error("rollback");
      }),
    ).rejects.toThrow();

    const reselected = await context.users.find(outerUser.id);
    expect(reselected?.name).toBe("dave");
  });

  test("nested transaction(): an inner rollback does not undo the outer transaction's writes", async () => {
    const context = createTestContext();

    await context.transaction(async (txContext) => {
      await txContext.users.add({ name: "outer-ok" });

      await expect(
        txContext.transaction(async (innerTxContext) => {
          await innerTxContext.users.add({ name: "inner-bad" });
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error("inner failure");
        }),
      ).rejects.toThrow("inner failure");
    });

    const rows = await Promise.all([context.users.find(1), context.users.find(2)]);
    expect(rows.map((row) => row?.name)).toEqual(["outer-ok", undefined]);
  });

  test("nested transaction(): rolling back the outer transaction also undoes an inner commit", async () => {
    const context = createTestContext();

    await expect(
      context.transaction(async (txContext) => {
        await txContext.transaction(async (innerTxContext) => {
          await innerTxContext.users.add({ name: "inner-ok" });
        });
        throw new Error("outer failure");
      }),
    ).rejects.toThrow("outer failure");

    expect(await context.users.find(1)).toBeUndefined();
  });
});

describe("afterCommit() / afterRollback()", () => {
  test("afterCommit callbacks run in order, only after the transaction actually commits", async () => {
    const context = createTestContext();
    const calls: string[] = [];

    await context.transaction(async (txContext) => {
      txContext.afterCommit(() => {
        calls.push("first");
      });
      await txContext.users.add({ name: "alice" });
      txContext.afterCommit(() => {
        calls.push("second");
      });
    });

    expect(calls).toEqual(["first", "second"]);
  });

  test("afterCommit callbacks do not run when the transaction rolls back", async () => {
    const context = createTestContext();
    const calls: string[] = [];

    await expect(
      context.transaction(async (txContext) => {
        txContext.afterCommit(() => {
          calls.push("should-not-run");
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(calls).toEqual([]);
  });

  test("afterRollback callbacks run only when the transaction rolls back", async () => {
    const context = createTestContext();
    const calls: string[] = [];

    await expect(
      context.transaction(async (txContext) => {
        txContext.afterRollback(() => {
          calls.push("rolled-back");
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(calls).toEqual(["rolled-back"]);
  });

  test("afterRollback callbacks do not run when the transaction commits", async () => {
    const context = createTestContext();
    const calls: string[] = [];

    await context.transaction(async (txContext) => {
      txContext.afterRollback(() => {
        calls.push("should-not-run");
      });
      await txContext.users.add({ name: "bob" });
    });

    expect(calls).toEqual([]);
  });

  test("a nested transaction's afterCommit fires when its own savepoint releases, even if unregistered on the outer txContext", async () => {
    const context = createTestContext();
    const calls: string[] = [];

    await context.transaction(async (txContext) => {
      txContext.afterCommit(() => {
        calls.push("outer");
      });
      await txContext.transaction(async (innerTxContext) => {
        innerTxContext.afterCommit(() => {
          calls.push("inner");
        });
      });
    });

    expect(calls).toEqual(["inner", "outer"]);
  });

  test("throwing while committing surfaces the transaction() rejection instead of the awaited result", async () => {
    const context = createTestContext();

    await expect(
      context.transaction(async (txContext) => {
        txContext.afterCommit(() => {
          throw new Error("afterCommit failure");
        });
        await txContext.users.add({ name: "carol" });
      }),
    ).rejects.toThrow("afterCommit failure");

    expect((await context.users.find(1))?.name).toBe("carol");
  });
});

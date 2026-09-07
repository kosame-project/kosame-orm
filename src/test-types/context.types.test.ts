import { describe, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { InferInsertModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ModelCollection } from "../context/collection.js";
import { createContext } from "../context/index.js";
import { Model } from "../model/index.js";
import { expectType, type Equal } from "./type-utils.js";

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
  const db = drizzle(sqlite);
  return { context: createContext(db, { users: User }), db };
}

describe("type inference", () => {
  test("context.users is typed as ModelCollection<User, typeof usersTable>", () => {
    const { context } = createTestContext();

    expectType<ModelCollection<User, typeof usersTable>>(context.users);
    type IsModelCollection = Equal<typeof context.users, ModelCollection<User, typeof usersTable>>;
    expectType<true>(true as IsModelCollection);
  });

  test("context.users.add()'s parameter matches InferInsertModel<typeof usersTable>", () => {
    const { context } = createTestContext();

    type AddParam = Parameters<typeof context.users.add>[0];
    type IsInferInsertModel = Equal<AddParam, InferInsertModel<typeof usersTable>>;
    expectType<true>(true as IsInferInsertModel);
  });

  test("context.raw reflects the exact db type passed to createContext()", () => {
    const { context, db } = createTestContext();

    type IsSameDbType = Equal<typeof context.raw, typeof db>;
    expectType<true>(true as IsSameDbType);
  });
});

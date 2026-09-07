# kosame

A Drizzle-based ORM with a model-driven approach.

[日本語版はこちら](./README.ja.md)

## Features

- Class-based Models on top of Drizzle (`class User extends Model {}`)
- DbContext-style API (`context.users.find()`) plus instance methods (`user.save()`)
- Associations (`hasMany`/`belongsTo`) via batched `IN (...)` queries — no JOINs
- Hooks: `beforeCreate` / `beforeUpdate` / `beforeDelete`
- Transactions with nesting (`context.transaction()`), `afterCommit` / `afterRollback`
- Mixins (e.g. `SoftDeletable`)
- Schema validation via zod (`drizzle-zod`), on write and on every read
- Escape hatch to the raw Drizzle `db`/`tx` (`context.raw`)
- PostgreSQL, MySQL, SQLite (including Cloudflare D1)

## Install

Not published to npm yet — for now, clone and install locally:

```bash
git clone git@github.com:kosame-project/kosame-orm.git
cd kosame-orm
bun install
```

You'll also need the driver for your database — one of `pg`, `mysql2`, `better-sqlite3`, `@libsql/client` (all optional peer dependencies).

## DB connection

Create a drizzle `db` instance the normal way for your dialect — kosame doesn't wrap this step, see [drizzle's own docs](https://orm.drizzle.team/) for `pg`/`mysql2`/`better-sqlite3`/`libsql`/`d1`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

## Defining a Model

```ts
import { Model } from "kosame";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export class User extends Model {
  static table = usersTable;
  declare id: number;
  declare name: string;
}
```

Models can't be constructed directly with `new` — only through a context factory method (`context.users.add()`/`find()`). Column values are plain declared instance properties.

## Creating a context

```ts
import { createContext } from "kosame";
import { db } from "./db.js";
import { User } from "./models/user.js";
import { Post } from "./models/post.js";

export const context = createContext(db, { users: User, posts: Post });
```

`context.users` / `context.posts` are built once, at construction time, by iterating the schema — not lazily via a `Proxy`.

## CRUD

```ts
const user = await context.users.add({ name: "alice" });
const found = await context.users.find(user.id);

await user.update({ name: "alice2" });
user.name = "alice3";
await user.save();

await user.reload();
await user.delete();
```

## Relations

```ts
import { hasMany, belongsTo } from "kosame";

class User extends Model {
  static table = usersTable;
  static relations = { posts: hasMany(() => Post, { foreignKey: "authorId" }) };
}

class Post extends Model {
  static table = postsTable;
  static relations = { author: belongsTo(() => User, { foreignKey: "authorId" }) };
}

const user = await context.users.find(id, { include: ["posts"] });
user.posts; // Post[]
```

Each relation is resolved with one batched `IN (...)` query (no JOINs), and nesting stops at one level.

## More features

- **Hooks** — override `beforeCreate()` / `beforeUpdate(changes)` / `beforeDelete()` on a Model; throw to abort the write.
- **Transactions** — `context.transaction(async (txContext) => {...})`, nested via SAVEPOINT, `txContext.afterCommit()` / `afterRollback()`.
- **Mixins** — `class Post extends SoftDeletable(Model) {}`: `delete()` becomes a soft delete, `hardDelete()` is the real one.
- **Validation** — `static schema = createInsertSchema(usersTable)` (via `drizzle-zod`), checked on write and on every read.
- **Escape hatch** — `context.raw` is the underlying drizzle `db`/`tx`, for anything the Model API can't express.

Full API docs will get their own pages once this goes OSS. For now, the most detailed record per feature lives in each directory's `src/*/CHANGELOG.en.md` / `CHANGELOG.ja.md`.

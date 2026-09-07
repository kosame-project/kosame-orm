# kosame

Drizzleをベースにした、Model駆動のORM。

[English README](./README.md)

## 特徴

- Drizzleの上に構築されたクラスベースのModel（`class User extends Model {}`）
- DbContext的なAPI（`context.users.find()`）とインスタンスメソッド（`user.save()`）の両方を提供
- アソシエーション（`hasMany`/`belongsTo`）はJOINを使わず、バッチクエリ（`IN (...)`）で解決
- Hooks: `beforeCreate` / `beforeUpdate` / `beforeDelete`
- ネスト対応のトランザクション（`context.transaction()`）、`afterCommit` / `afterRollback`
- Mixin機構（`SoftDeletable`等）
- zod（`drizzle-zod`）によるスキーマ検証。書き込み時・読み込み時どちらも実行
- 生のDrizzle `db`/`tx`へ抜けられるエスケープハッチ（`context.raw`）
- PostgreSQL・MySQL・SQLite（Cloudflare D1含む）に対応

## インストール

まだnpmには公開していません。今のところはclonしてローカルで使ってください。

```bash
git clone git@github.com:kosame-project/kosame-orm.git
cd kosame-orm
bun install
```

加えて、使うDBに応じたドライバ（`pg` / `mysql2` / `better-sqlite3` / `@libsql/client`のいずれか。いずれもoptionalなpeerDependencies）が必要です。

## DB接続

drizzleの`db`インスタンスは、使うdialectに応じて通常通り作成してください。kosameはこのステップをラップしません。詳細は[drizzle公式ドキュメント](https://orm.drizzle.team/)（`pg`/`mysql2`/`better-sqlite3`/`libsql`/`d1`）を参照してください。

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

## Modelの定義

```ts
import { Model } from "kosame";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

interface User extends InferSelectModel<typeof usersTable> {}
export class User extends Model {
  static table = usersTable;
}
```

Modelは直接`new`できません。コンテキスト側のファクトリメソッド（`context.users.add()`/`find()`）経由でのみ生成されます。カラムの値は普通のインスタンスプロパティとして実行時に代入されます。

`interface User extends InferSelectModel<typeof usersTable> {}`は、TypeScriptの宣言マージ（同名の`interface`と`class`は自動的にマージされる）を使い、`usersTable`から推論した型をそのまま`User`に注入しています。カラムを1つずつ`declare id: number`のように書き写す必要はありません（増やしたときもテーブル側を直すだけで型に反映されます）。リレーションのプロパティ（`declare posts?: Post[]`のような、テーブルのカラムではないもの）はこのマージの対象外なので、引き続きModel側に個別に書きます。

## Contextの作成

```ts
import { createContext } from "kosame";
import { db } from "./db.js";
import { User } from "./models/user.js";
import { Post } from "./models/post.js";

export const context = createContext(db, { users: User, posts: Post });
```

`context.users` / `context.posts` は、構築時に一度だけschemaをiterateして組み立てられます（Proxyによる遅延生成ではありません）。

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

## リレーション

```ts
import { hasMany, belongsTo } from "kosame";
import type { InferSelectModel } from "drizzle-orm";

interface User extends InferSelectModel<typeof usersTable> {
  posts?: Post[]; // テーブルのカラムではないので手動で追加
}
class User extends Model {
  static table = usersTable;
  static relations = { posts: hasMany(() => Post, { foreignKey: "authorId" }) };
}

interface Post extends InferSelectModel<typeof postsTable> {
  author?: User;
}
class Post extends Model {
  static table = postsTable;
  static relations = { author: belongsTo(() => User, { foreignKey: "authorId" }) };
}

const user = await context.users.find(id, { include: ["posts"] });
user.posts; // Post[]
```

各リレーションは1本のバッチクエリ（`IN (...)`）で解決され（JOINは使いません）、ネストは1段階までです。

## その他の機能

- **Hooks** — Model上で`beforeCreate()` / `beforeUpdate(changes)` / `beforeDelete()`をoverride。例外を投げると書き込みを中止できます
- **トランザクション** — `context.transaction(async (txContext) => {...})`。SAVEPOINTでネスト対応、`txContext.afterCommit()` / `afterRollback()`
- **Mixin** — `class Post extends SoftDeletable(Model) {}`: `delete()`はソフトデリートに、`hardDelete()`は本来の実DELETEになります
- **バリデーション** — `static schema = createInsertSchema(usersTable)`（`drizzle-zod`経由）。書き込み時・読み込み時の両方で検証されます
- **エスケープハッチ** — `context.raw`でdrizzleの生の`db`/`tx`にアクセスできます。Model APIで表現しきれない処理に使ってください

詳しいAPIリファレンスは、OSS化のタイミングで別途ページとして整備する予定です。現時点で一番詳しい記録は、各機能ディレクトリの`src/*/CHANGELOG.ja.md` / `CHANGELOG.en.md`です。

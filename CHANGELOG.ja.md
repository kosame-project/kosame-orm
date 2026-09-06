# Changelog

このプロジェクトの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 1. 環境構築**
  - `package.json` を作成（`type: module` によるESM-only構成、`private: true`）
  - コア依存パッケージを導入: `drizzle-orm@0.45.2` / `drizzle-zod@0.8.3` / `zod@4.5.4`（いずれもv0系安定版。`docs/Requirements.md` 決定事項「drizzle-ormの破壊的変更への追従方針」に基づきv1 rcは見送り）
  - DBドライバを `peerDependencies`（optional）として定義: `pg` / `mysql2` / `better-sqlite3` / `@libsql/client`。開発・テスト用に `devDependencies` にも同梱
  - 開発ツールとして `typescript@7.0.2`（Go製ネイティブコンパイラ）・`drizzle-kit@0.31.10` を導入
  - `tsconfig.json` を作成（ESM/NodeNext解決、strict、`verbatimModuleSyntax` 等）
  - `src/index.ts`（プレースホルダ）、`.gitignore` を追加
  - `bun install` / `tsc --noEmit` が正常に通ることを確認
- **Phase 2 Step 1. Model基盤**（詳細は `src/model/CHANGELOG.ja.md` 参照）
  - 非公開Symbolブランドによる`Model`直接`new`禁止、コンストラクタ注入による`#context`保持、`static table`プレースホルダを実装
  - `@types/bun`を追加し、`bun:test`の型が`tsc --noEmit`でも解決できるように`tsconfig.json`に`"types": ["bun"]`を追加
- **Phase 2 Step 2. コンテキスト（DbContext相当）**（詳細は `src/context/CHANGELOG.ja.md` 参照）
  - `createContext(db, schema)`ファクトリを実装。schemaをiterateして`context.users`/`context.posts`等の入り口を起動時に組み立てる（Proxy不使用）
  - drizzleの`db`/`tx`ハンドルは、Model基盤の`INTERNAL`ブランドと同じ非公開Symbol方式で内部保持
- **Phase 2 Step 3. CRUD変換**（詳細は `src/query/CHANGELOG.ja.md` / `src/model/CHANGELOG.ja.md` / `src/context/CHANGELOG.ja.md` 参照）
  - `Model`とdrizzleの間を仲介するテーブルレベルCRUD変換ロジックを`src/query`として新規に切り出した（主キー特定、INSERT/SELECT/UPDATE/DELETE。PostgreSQL/SQLiteは`.returning()`、MySQLは`$returningId()`＋再SELECTでdialect差を吸収）
  - `Model`のインスタンスメソッド`save()`/`update()`/`delete()`/`reload()`を実装
  - `context.users.find()`/`context.users.add()`を実装（drizzleの推論型`InferInsertModel`を`add()`の引数型として採用）
  - `bun test`が本機の`better-sqlite3`でクラッシュするため、テストは`bun:sqlite`（`drizzle-orm/bun-sqlite`）に切り替えて実施

[Unreleased]: https://github.com/kosame-project/kosame-orm

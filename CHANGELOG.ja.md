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
- **Phase 2 Step 4. アソシエーション・hydration**（詳細は `src/associations/CHANGELOG.ja.md` / `src/context/CHANGELOG.ja.md` / `src/query/CHANGELOG.ja.md` 参照）
  - `hasMany`/`belongsTo`を新規ディレクトリ`src/associations`に実装。Modelクラスに`static relations = {...}`で定義する
  - リレーションはJOINを使わず、親/子キーをまとめた`IN`句のバッチクエリ1本＋アプリ側hydration（親キーでのgroupBy）で解決する方式に統一
  - `context.users.find(pk, { include: ["posts"] })`のように、`find()`に`include`オプションを追加してアソシエーションを取得できるようにした
  - ネストは1段階まで（決定事項通り）。PostgreSQL/MySQLでの実DB検証はStep 3と同様、Phase 9まで保留
- **Phase 3 Step 1. hooks（INSERT系: `beforeCreate`）**（詳細は `src/model/CHANGELOG.ja.md` / `src/context/CHANGELOG.ja.md` 参照）
  - `Model`に`beforeCreate()`（デフォルトno-op、override可能）を追加。`context.<collection>.add()`のINSERT前に呼び出され、例外を投げるとINSERT自体を中止する
  - `Model`に`protected get raw()`を追加し、フック内からdrizzleの生ハンドルへアクセスできるようにした（Phase 7の`context.raw`を先取り）
  - Phase 3はINSERT系/UPDATE系/DELETE系の3ステップに分割し、それぞれ別PRとして進める方針（このエントリはStep 1分）
- **Phase 3 Step 2. hooks（UPDATE系: `beforeUpdate`）**（詳細は `src/model/CHANGELOG.ja.md` / `src/context/CHANGELOG.ja.md` 参照）
  - `Model`に`beforeUpdate(changes)`（デフォルトno-op、override可能）を追加。`update(changes)`/`save()`どちらの経路でも実際のUPDATE前に呼ばれる
  - `changes`はフック内で書き換え可能（参照渡し）で、UPDATE後にインスタンスへも反映される。例外を投げるとUPDATE自体を中止する
- **Phase 3 Step 3. hooks（DELETE系: `beforeDelete`）**（詳細は `src/model/CHANGELOG.ja.md` / `src/context/CHANGELOG.ja.md` 参照）
  - `Model`に`beforeDelete()`（デフォルトno-op、override可能）を追加。`delete()`の直前に呼ばれ、例外を投げるとDELETE自体を中止する
  - これでPhase 3（hooks実装）のINSERT/UPDATE/DELETE全ステップが完了
- **Phase 4 Step 1. トランザクション（基本API・ネスト）**（詳細は `src/query/CHANGELOG.ja.md` / `src/context/CHANGELOG.ja.md` 参照）
  - `context.transaction(async (txContext) => {...})`を実装。ネスト時は自動的にSAVEPOINTを使う
  - 実装中に、`better-sqlite3`/`bun:sqlite`（同期ドライバ）はdrizzleネイティブの`db.transaction()`に非同期コールバックを渡すと正しく動作しないことを実際に検証で発見（MySQL実コンテナでは正常動作）。dialectを判定して同期ドライバのときだけ生SQLの`BEGIN`/`COMMIT`/`ROLLBACK`・`SAVEPOINT`を手動発行する方式で解決し、ユーザー向けAPIは3dialect共通のまま維持
  - SQLiteは単一コネクションのため、「トランザクション外のModelインスタンスは参加しない」という決定事項が期待通りには機能しないケースがあることも発見・テストに明記（PostgreSQL/MySQLはコネクションプールのため問題なし）
- **Phase 4 Step 2. トランザクション（`afterCommit`/`afterRollback`）**（詳細は `src/context/CHANGELOG.ja.md` 参照）
  - `Context`に`afterCommit(callback)`/`afterRollback(callback)`を実装。コミット成功後・ロールバック後にそれぞれ登録順で呼び出す
  - ネストしたトランザクションでは、内側の`afterCommit`は内側のSAVEPOINTがreleaseされた時点で発火する（外側の最終的なコミットは待たない）という初期スコープ向けのローカルなセマンティクスを採用
  - これでPhase 4（トランザクション）の2ステップが完了

[Unreleased]: https://github.com/kosame-project/kosame-orm

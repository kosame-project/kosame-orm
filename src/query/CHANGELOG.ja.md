# Changelog (src/query)

`src/query` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 2 Step 3. CRUD変換（コア翻訳ロジック）**
  - `Model`（`src/model`）にもコンテキスト（`src/context`）にも依存しない、テーブルレベルのCRUD変換ロジックを切り出した新規ディレクトリ
  - `getPrimaryKey(table)`（`primary-key.ts`）: drizzleの`getTableColumns`で各カラムの`primary`フラグを見て単一主キーを特定する。複合主キー（`primary`が複数true）は現時点では未対応として例外を投げる
  - `insertRow` / `selectByPrimaryKey` / `updateByPrimaryKey` / `deleteByPrimaryKey`（`crud.ts`）: 主キーによるSELECT/UPDATE/DELETE、およびINSERT後に完全な行を取得するロジック
    - INSERT後の行取得は3通り: (1) 呼び出し側が主キー値を指定していた場合はINSERT実行後にその値で再SELECT (2) `.returning()`が使えるdialect（PostgreSQL/SQLite）はそれで直接取得 (3) MySQL（`.returning()`がなく`$returningId()`のみ）は生成された主キー値を取得してから再SELECT。dialect名による分岐ではなく、クエリビルダーが`.returning`関数を持つかどうかのfeature detectionで判定している
  - `DB`（`db.ts`）: drizzleの`db`/`tx`ハンドルを指す非公開Symbol。元は`src/context/internal.ts`にあったが、`Model`のCRUDインスタンスメソッド（`save()`等）からも同じハンドルにアクセスする必要が出たため、`src/model`・`src/context`のどちらからも参照できる本ディレクトリに移設した（`src/context/internal.ts`は削除）
- 単体テスト（`crud.test.ts`）: `bun:sqlite` + `drizzle-orm/bun-sqlite`を使い、実際のSQLite上でinsert/select/update/deleteの往復を確認（`better-sqlite3`は本機のBunでテスト実行時にクラッシュするため、テストでは不使用。ライブラリ側の依存としては引き続き`better-sqlite3`を維持）

**未検証（Phase 9で解消予定）**: MySQLの`$returningId()`経由の分岐は型チェックのみ通過しており、実際のMySQLサーバーに対しては未検証。PostgreSQL/MySQLの実DBに対するテストはPhase 9（テスト環境構築）でカバーする。

## Phase 2 Step 4. アソシエーション・hydration向けの追加

### Added

- `getColumn(table, key)`（`columns.ts`）: `getTableColumns`からキー名（JSプロパティ名）でカラムを1つ取り出す。見つからなければ例外
- `selectWhereIn(db, table, column, values)`（`crud.ts`）: 指定カラムに対する`IN`句のバッチSELECT。アソシエーションの子/親をまとめて取得するために`src/associations`から利用する。`values`が空配列の場合はクエリを発行せず空配列を返す

## Phase 4 Step 1. トランザクション（基本API・ネスト）

### Added

- `isSyncDatabase(db)` / `runTransaction(db, depth, fn)`（`transaction.ts`）: dialectをまたいで`context.transaction()`を成立させる低レベルロジック
  - **発見した問題**: `better-sqlite3`/`bun:sqlite`（drizzleが`db.resultKind === "sync"`として区別する同期ドライバ）は、drizzleのネイティブな`db.transaction(async (tx) => {...})`ラッパーに非同期コールバックを渡すと正しく動かない。実際に検証したところ、`bun:sqlite`は`await`を挟んだ時点でコミット済みの状態になり例外を投げてもロールバックされず、`better-sqlite3`（Node.js経由で検証）に至っては`"Transaction function cannot return a promise"`という例外を投げて失敗する。一方MySQL（`mysql2`、実コンテナで検証）は非同期gapを挟んでも正しくロールバックされる。ネイティブラッパーが同期コールバックしか想定していないことが原因で、SQLite固有の問題
  - **対応方式**: `db.resultKind === "sync"`のときはdrizzleの`.transaction()`を使わず、同じ`db`ハンドルに対して生SQLの`BEGIN`/`COMMIT`/`ROLLBACK`（ネスト時は`SAVEPOINT`/`RELEASE SAVEPOINT`/`ROLLBACK TO SAVEPOINT`）を手動発行する。これにより、ユーザー向けのAPIは3dialect共通で`context.transaction(async (txContext) => {...})`のまま（SQLiteだけ別の呼び出し方を要求しない）で正しく動作する。dialect名ではなく`resultKind`というdrizzleが公開しているプロパティでの機械的な判定
  - 非同期ドライバ（`resultKind`が`"sync"`でない: PostgreSQL/MySQL/libsql/D1）はそのままdrizzleの`db.transaction()`に委譲する。ネストは`tx.transaction()`（drizzle自身がdialectごとにSAVEPOINT等で実装済み）に任せる

## Phase 6. ソフトデリート向けの追加

### Changed

- `selectByPrimaryKey` / `selectWhereIn`（`crud.ts`）に、任意の追加条件`extra?: SQL`を渡せるように変更。渡された場合は`and(既存条件, extra)`で結合する。ソフトデリート済み行の除外条件（`isNull(deletedAtColumn)`）を、主キー/外部キーの条件に「足す」形で使うために必要だった。第2の専用クエリ関数を新設するのではなく、既存の2関数を拡張する形にした

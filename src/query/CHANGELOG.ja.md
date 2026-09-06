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

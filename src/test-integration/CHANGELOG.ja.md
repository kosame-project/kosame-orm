# Changelog (src/test-integration)

`src/test-integration` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 9 Step 1. 実DBスモークテスト（PostgreSQL/MySQL）**
  - `docker-compose.test.yml`（リポジトリルート）: 使い捨てのPostgreSQL 17・MySQL 9コンテナ。データは`tmpfs`（コンテナ破棄で消える）。ホスト側ポートは本機の既存サービス（ローカルのPostgreSQL・別プロジェクトのMySQLコンテナ）と衝突しないよう`55432`/`33307`にずらしている（CI側は標準ポート`5432`/`3306`を使用。`.github/workflows/ci.yml`参照）
  - `connections.ts`: 接続文字列を環境変数（`KOSAME_TEST_POSTGRES_URL`/`KOSAME_TEST_MYSQL_URL`）から読み、未設定時はローカルの`docker-compose.test.yml`向けデフォルト値にフォールバック
  - `pipeline.pg.test.ts` / `pipeline.mysql.test.ts`: 各dialectの実ドライバ（`pg`/`mysql2`）に対して、CRUD一巡（`add`→`find`→`update`→`save`→`reload`→`delete`）・hooks/`static schema`検証・アソシエーション（`hasMany`/`belongsTo`経由の`include`）・`SoftDeletable`（`delete()`と`hardDelete()`の違い）・トランザクション（コミット、非同期gapを挟んだロールバック、ネストしたトランザクションのSAVEPOINT）を確認する
    - MySQL側は特に、Phase 2 Step 3で「型チェックのみ通過、実MySQLでは未検証」と明記していた`$returningId()`経由のINSERT行取得を実際に検証する
  - **スコープの決定**: 決定事項「SQLite in-memoryへの切り分けはせず、テスト全体を実DBで実行する」を字義通り満たすには、既存64個のbun:sqliteベースのテストを3dialectでパラメータ化して回す必要があるが、非常に大きな書き直しになるため見送った。代わりに、各dialect固有の挙動が絡む主要経路（CRUD変換・hooks・アソシエーション・ソフトデリート・トランザクション）を1ファイルずつのスモークテストとしてPostgreSQL/MySQL実DB上で検証する方針にした（ユーザーとの合意事項）。結果として、SQLiteは広くカバーし、PostgreSQL/MySQLは主要経路のみをカバーする、という非対称なテストカバレッジになっている
  - デフォルトの`bun test`（`package.json`の`test`スクリプト）からは`--path-ignore-patterns`で除外し、Dockerなしでも通常のテストが実行できるようにした。実行には`bun run test:integration:up` → `bun run test:integration` → `bun run test:integration:down`の3ステップ（`package.json`のscripts参照）

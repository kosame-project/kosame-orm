# Changelog (src/validation)

`src/validation` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 8. バリデーション統合**
  - `validateSchema(modelClass, data, { partial? })`（`validate.ts`）を実装。`modelClass`の`static schema`（zod、想定は`drizzle-zod`の`createInsertSchema(table)`）で`data`を検証し、失敗時は`prettifyError`で整形したメッセージ付きで例外を投げる
    - `static schema`が定義されていないModelクラスに対しては何もしない（no-op）。バリデーションは完全にオプトイン
    - `{ partial: true }`を渡すと`schema.partial()`（zodのメソッド）を使う。部分更新（`update(changes)`/`save()`の`changes`）は元のカラム全部を要求する完全なinsertスキーマではなく、渡されたキーだけを検証する必要があるため
  - `src/model`・`src/query`・`src/context`・`src/associations`のいずれにも依存しない、`zod`のみに依存する純粋なleafモジュール（`src/query`よりさらに下位のレイヤー）
  - `static schema`の生成自体（`createInsertSchema(usersTable)`等）はユーザー自身が`static table`と同じパターンで書く。Model層に別のスキーマ生成DSLは用意しない（決定事項「スキーマ定義はユーザーがdrizzleを直接書く」と一貫）
  - 書き込み側（同期チェック）・クエリ結果側（hydration時）の両方で同じ`static schema`を再利用する（決定事項「クエリ結果側」）。実際の呼び出し箇所は`src/model`（`save()`/`update()`/`reload()`）・`src/context`（`ModelCollection.add()`/`#hydrate()`）・`src/associations`（`loadRelation`の`hydrate()`）の各CHANGELOG参照
  - 実行タイミングを分岐させるフラグは用意していない。常時実行し、失敗時は例外を投げてDB操作/hydrationを停止する（決定事項「実行タイミング」「失敗時の挙動」）

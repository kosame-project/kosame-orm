# Changelog (src/associations)

`src/associations` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 2 Step 4. アソシエーション・hydration**
  - `hasMany(() => Child, { foreignKey, localKey? })` / `belongsTo(() => Parent, { foreignKey, targetKey? })`（`define.ts`）: アソシエーションの記述子（`RelationDescriptor`）を返すだけのファクトリ関数。ターゲットのModelクラスは循環参照（`User`⇔`Post`が相互にリレーションを持つ等）に対応するためthunk（`() => Child`）で受け取る
    - `hasMany`の`localKey`省略時は親テーブルの主キー、`belongsTo`の`targetKey`省略時はターゲットテーブルの主キーを`src/query`の`getPrimaryKey`で自動解決する
  - `loadRelation(context, parents, relationKey, descriptor)`（`load.ts`）: アソシエーション本体の翻訳ロジック
    - `hasMany`: 親インスタンス配列から親キー値を集め（重複除去）、子テーブルに対して`selectWhereIn`で1本のバッチクエリを発行。結果を外部キー値でgroupByし、各親インスタンスの`relationKey`プロパティに子`Model`インスタンスの配列をセットする
    - `belongsTo`: 親（子側）インスタンス配列から外部キー値を集め（null/undefined除外・重複除去）、ターゲットテーブルに対して`selectWhereIn`で1本のバッチクエリを発行。ターゲットキーでMapを作り、各インスタンスの`relationKey`プロパティに単一の`Model`インスタンス（見つからなければ`undefined`）をセットする
    - JOINは一切使わない。IN句のバッチクエリのみで完結する方式（決定事項「リレーションの変換先」）
  - Modelクラス側の定義方法は`static relations = { posts: hasMany(...), author: belongsTo(...) }`という規約（`static table`と同じ静的プロパティパターン）。`Model`基底クラス自体は`relations`を宣言しない（オプショナルなので不要）
  - `src/model`（`Model`/`ModelClass`/`ModelContext`）と`src/query`（`DB`/`getColumn`/`getPrimaryKey`/`selectWhereIn`）にのみ依存し、`src/context`には依存しない設計（依存の向きは `query → model → associations → context` で一方向）
  - 単体テスト（`load.test.ts`）: `bun:sqlite`実DB上で、複数の親インスタンスに対する`hasMany`のバッチ取得＋groupByによる振り分け、子なし親の空配列化、`belongsTo`での単一行解決を確認
- `src/index.ts`から`hasMany`/`belongsTo`（値）と`HasManyDescriptor`/`BelongsToDescriptor`/`RelationDescriptor`（型のみ）をエクスポート

**既知の制限（決定事項通り）**: ネストは1段階まで（`include`に渡したrelationの、さらに先のrelationを同時にeager loadする機能はない）。複合主キー・複合外部キーは`src/query`の`getPrimaryKey`/`getColumn`の制約により未対応。

## Phase 6. ソフトデリート向けの追加

### Changed

- `loadRelation`が、リレーションのターゲットModelクラスに`SoftDeletable`が適用されている場合、`hasMany`/`belongsTo`どちらの経路でも`selectWhereIn`にソフトデリート除外条件（`isNull(deletedAtColumn)`）を渡すように変更（`src/context`の`find()`と同じ判定方法）
- リレーション側には`find()`の`withDeleted`に相当するオプトアウト手段は用意していない（`include`自体に個別リレーションへのオプション渡し口がないため）。既知の制限として明記

## Phase 8. バリデーション統合向けの追加

### Changed

- `load.ts`内部の`hydrate()`ヘルパーに`validateSchema(modelClass, row)`（`src/validation`）を追加。`hasMany`/`belongsTo`どちらの経路でリレーション先の行を取得した場合も、`src/context`の`find()`/`add()`と同じhydrationパイプラインの検証が効くようにした

# Changelog (src/soft-delete)

`src/soft-delete` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 6. ソフトデリート**
  - `deletedAtColumn(name = "deletedAt")`をdialectごとに実装（`columns.pg.ts`/`columns.mysql.ts`/`columns.sqlite.ts`）: PostgreSQLは`timestamp`、MySQLは`datetime`、SQLiteは`integer(name, { mode: "timestamp" })`。1つの関数でdialect横断にはできない（物理カラム型自体が異なるため）ので、drizzle自身の`pg-core`/`mysql-core`/`sqlite-core`と同じ形でdialectごとに分けた
    - `package.json`に`./pg`/`./mysql`/`./sqlite`のsubpath exportsを追加し、`import { deletedAtColumn } from "kosame/pg"`のようにdialectを選んでimportできるようにした
  - `SOFT_DELETE_COLUMN`（非公開Symbol、`marker.ts`）: `SoftDeletable`ミックスインを適用したModelクラスの`static`プロパティとして立つマーカー。カラム名からの自動判定（convention方式）ではなく、このマーカーの有無で「ソフトデリート対応かどうか」を判定する（決定事項「判定方式」）
  - `SoftDeletable(Base, columnKey = "deletedAt")`（`soft-deletable.ts`）ミックスイン
    - `delete()`をoverrideし、`beforeDelete()`を呼んだ後、実DELETEの代わりに`writeUpdate({ [columnKey]: new Date() })`（`Model`から切り出した低レベル書き込み。`beforeUpdate()`は二重発火しない）を実行する
    - `hardDelete()`を追加。`super.delete()`（`Model`本来のDELETE）を呼ぶことで、ソフトデリート対応Modelでも実DELETEを使えるようにした（決定事項「ハード削除とソフトデリートを両方使えるようにする」）
    - mixin関数の返すクラスは`abstract class`宣言が必要、エクスポートする関数の戻り値型は明示的に`TBase & Constructor<SoftDeletableInstance>`とする必要がある（TS4094対策。詳細はコミットログ参照）
  - `getSoftDeleteColumn(modelClass, table)`: `SOFT_DELETE_COLUMN`マーカーを見て、該当するカラムオブジェクト（`Column | undefined`）を返す。クエリ側（`src/context`/`src/associations`）はこれを使って自動除外の要否を判定する

**未実装（Phase 2からの積み残し）**: `createdAtColumn()`/`updatedAtColumn()`は本Phaseでは実装していない。ドキュメント上は同じ実装パターンを踏襲できる見込みとされているが、Phase 6のスコープ（ソフトデリート）には含まれないため見送った。

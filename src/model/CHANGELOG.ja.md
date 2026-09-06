# Changelog (src/model)

`src/model` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 2 Step 1. Model基盤**
  - 非公開Symbol（`INTERNAL`、`src/model/internal.ts`）をブランドとして要求する方式で、`Model`サブクラスの直接`new`呼び出しを禁止
    - `INTERNAL`はパッケージ内部（`src/context`等）からのみimportされ、`src/index.ts`（公開API）からは再エクスポートしない
  - `Model`基底クラスを実装（`src/model/model.ts`）: コンストラクタでブランド不一致時に例外を投げる、コンテキスト参照を`#context`private fieldとしてコンストラクタ注入で保持
  - `static table`（drizzleの`Table`型）をサブクラスが上書きする前提のプレースホルダとして`declare static`で宣言
  - 単体テスト（`model.test.ts`）: ブランド不一致時に例外が投げられることを確認

- **Phase 2 Step 3. CRUD変換（インスタンスメソッド）**
  - `save()` / `update(changes)` / `delete()` / `reload()` を実装。実体は`src/query`のテーブルレベルCRUD関数（`updateByPrimaryKey`/`deleteByPrimaryKey`/`selectByPrimaryKey`）への変換
    - `save()`: 自身の主キー以外の全カラムの現在のインスタンスプロパティ値をUPDATEで書き戻す（インスタンスを直接ミューテートしてから`save()`する使い方を想定）
    - `update(changes)`: 指定したフィールドだけをUPDATEし、その場で同じ内容をインスタンスにも反映する
    - `delete()`: 主キーによるDELETE
    - `reload()`: 主キーで再SELECTし、返ってきた行の値でインスタンスの全プロパティを上書きする
  - いずれも主キーが必要（`src/query`の`getPrimaryKey`が見つからない場合は例外）
  - `ModelConstructorArgs.context`の型を`unknown`から`ModelContext`（`readonly [DB]: unknown`、`DB`は`src/query`の非公開Symbol）に変更。コンテキスト参照経由でdrizzleの`db`/`tx`ハンドルに到達できるようにした
  - `src/index.ts`から`ModelContext`型を追加エクスポート

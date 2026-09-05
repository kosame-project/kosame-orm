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

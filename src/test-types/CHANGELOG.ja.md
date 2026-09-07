# Changelog (src/test-types)

`src/test-types` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 9 Step 3. 型推論のテスト方法**
  - `Equal<A, B>` / `expectType<Expected>(actual)`（`type-utils.ts`）: drizzle-orm自身のテストスイートでも使われている型レベル比較ユーティリティ。自作・ゼロ依存（`expect-type`ライブラリは使わなかった）
  - `bun test`自体はTSをトランスパイルするだけで型チェックをしないため、この仕組みが意味を持つのは`tsc --noEmit`（既存のCIステップ）と組み合わせたときだけである点に注意。実際にアサーションを意図的に壊して`tsc --noEmit`がコンパイルエラーとして検出することを確認した上で実装した
  - `context.types.test.ts`: `context.users`が`ModelCollection<User, typeof usersTable>`（`any`や過度に広い型に落ちていないか）、`context.users.add()`の引数型が`InferInsertModel<typeof usersTable>`と一致するか、`context.raw`の型が`createContext`に渡した`db`インスタンス自身の型と完全一致するかを検証する

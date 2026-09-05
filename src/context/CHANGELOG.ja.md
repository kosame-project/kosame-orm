# Changelog (src/context)

`src/context` ディレクトリの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 2 Step 2. コンテキスト（DbContext相当）**
  - `Context`クラスと`createContext(db, schema)`ファクトリを実装（`src/context/context.ts`）
    - drizzleの`db`/`tx`ハンドルは非公開Symbol（`DB`、`src/context/internal.ts`）をキーにしたプロパティとして保持する。`Model`基盤（Phase 2 Step 1）の`INTERNAL`ブランドと同じ発想で、パッケージ内部（`ModelCollection`等）からは参照でき、公開APIからは不可視にする
    - `schema`（`{ users: User, posts: Post }`のようなキー→Modelクラスのマップ）を`Object.entries`でiterateし、コンストラクタ実行時に`context.users`/`context.posts`を`Object.defineProperty`で組み立てる。Proxyは不使用（決定事項「Proxy使用の是非」参照）
    - `createContext`の戻り値型は`Context<TSchema> & ContextEntries<TSchema>`とし、動的に生えるプロパティにも型を付ける
  - `context.users`/`context.posts`の実体として`ModelCollection`クラスを追加（`src/context/collection.ts`）。現時点ではコンテキスト参照とModelクラス参照を保持するだけで、CRUDメソッド（`find()`/`add()`等）はPhase 2 Step 3で追加する
  - 型定義（`src/context/types.ts`）: `ModelClass`（コンストラクタ形状）、`ContextSchema`（キー→Modelクラスのマップ。将来の`static schema`（zod、Phase 8）との名前衝突を避けるため`Schema`ではなくこの名前にした）、`ContextEntries`
  - 単体テスト（`context.test.ts`）: schemaのキーごとに`ModelCollection`が1つずつ生成されること、生成された入り口が`Proxy`ではなく通常の列挙可能な自プロパティであることを確認
  - `src/index.ts`から`createContext`（値）と`Context`/`ContextSchema`/`ModelClass`/`ContextEntries`（型のみ）をエクスポート。`Context`クラス自体は値としては公開しない（直接`new Context()`すると`createContext`が付ける交差型が付かずローカルの型安全性が崩れるため）

**未実装（Phase 2 Step 3以降）**: drizzle初期化時の設定簡素化（`schema`を渡さない・camelCase統一・`logger`デフォルトoff）はユーザー側のdrizzle初期化コードの話であり、`createContext`自体はdbの中身を検査しないため今回のスコープでは触れていない。実際にCRUD変換で`db`を使い始めるタイミング（Step 3）で、必要なら型を絞る。

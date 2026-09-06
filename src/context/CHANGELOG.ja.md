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

**Phase 2 Step 3で解消**: 上記の「dbの型はStep 3で絞る」という宿題は、`db`自体の型パラメータ化ではなく「`src/query`のテーブルレベルCRUD関数に不透明なまま渡す」形で決着した（`db: any`として扱う境界を`src/query`側に閉じ込め、公開APIの`createContext(db: unknown, schema)`はそのまま）。詳細は次のエントリを参照。

## Phase 2 Step 3. CRUD変換（`context.users.find()` / `add()`）

### Added

- `ModelCollection`（`src/context/collection.ts`）に`find(pkValue)` / `add(values)`を実装
  - `find()`: 主キーでSELECTし、見つかれば`Model`インスタンスにhydrateして返す。見つからなければ`undefined`
  - `add()`: `src/query`の`insertRow`でINSERT（dialect差に応じて`.returning()`または`$returningId()`＋再SELECTで完全な行を取得）し、`Model`インスタンスにhydrateして返す
  - `ModelCollection`はテーブル型（`TTable`）についてもジェネリックにし、`add()`の引数を`InferInsertModel<TTable>`で型付け（決定事項「型推論の互換性」）。`Model`クラス自体は非ジェネリック（`class User extends Model {}`のまま）という既存の型に反しない範囲で、コンテキスト経由のAPI側だけ型推論を効かせている
  - `ModelClass`（`src/context/types.ts`）に`readonly table: TTable`を追加し、`ModelCollection`から`static table`を型安全に参照できるようにした
- `Context`が保持する`DB`Symbolは`src/query`（新設、Step 3参照）に移設。`src/context/internal.ts`は削除し、`Context`クラスは新たに`ModelContext`（`src/model`側の型）を`implements`するようにした
- 単体テスト（`context.test.ts`）を`bun:sqlite`（`drizzle-orm/bun-sqlite`）を使った実DB経由のテストに拡張。`add()`/`find()`、および`Model`側の`save()`/`update()`/`delete()`/`reload()`との組み合わせ動作を確認

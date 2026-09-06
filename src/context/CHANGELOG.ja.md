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

## Phase 2 Step 4. アソシエーション・hydrationの統合（`find()`の`include`）

### Added

- `ModelCollection.find(pkValue, { include })`（`src/context/collection.ts`）を実装。`include`に渡したキーごとに、Modelクラスの`static relations`（`src/associations`の`hasMany`/`belongsTo`）を参照して`loadRelation`（`src/associations`）を呼び出し、取得したインスタンスに関連を差し込む
  - 未知のrelationキーを`include`に渡すと例外を投げる
  - `include`は`readonly string[]`（実行時チェックのみ）。relationキー名をModelクラスの型から推論してコンパイル時にチェックする仕組みは今回は入れていない（既知の制限として明記）
- `ModelClass`は`src/associations`が主体で使うようになったため、実体を`src/model`に移設（`src/model/CHANGELOG.ja.md`参照）。`src/context/types.ts`は再エクスポートのみ
- 単体テスト（`include.test.ts`）: `static relations`で定義した`hasMany`/`belongsTo`が`find()`の`include`経由で正しくhydrateされること、`include`を渡さない場合は該当プロパティに触れないこと、未知のrelation名で例外になることを確認

**既知の制限**: `include`はネスト不可（Requirements.mdの決定事項通り1段階まで）。`context.users.find()`は単一行なので、複数行に対するバッチhydration自体は`src/associations/load.test.ts`（`loadRelation`の直接テスト）でのみ検証しており、コンテキスト経由のAPIとしては複数行を返す汎用クエリメソッド（`findMany`等）自体がまだ存在しない。

## Phase 3 Step 1. hooks（INSERT系: `beforeCreate`）

### Changed

- `ModelCollection.add(values)`（`src/context/collection.ts`）の内部手順を変更
  - 変更前: `insertRow(values)`で即座にINSERTし、返ってきた行をhydrateしたインスタンスを返すだけだった
  - 変更後: まずブランド付きで`Model`インスタンスを構築し`values`を代入 → `instance.beforeCreate()`を呼ぶ（フックが`this`を書き換える・例外を投げて中断できる）→ その時点のインスタンスの状態をINSERTペイロードとして使う → `insertRow`の戻り値（サーバー側生成カラム含む）を同じインスタンスにマージして返す
  - これにより、`add()`の戻り値は「hydrateし直した別インスタンス」ではなく「`beforeCreate()`で書き換えられたのと同一のインスタンス」になる
- 単体テスト（`hooks.test.ts`）: `beforeCreate()`でのインスタンス書き換え（正規化）が実際のINSERT内容に反映されること、例外を投げるとINSERT自体が実行されないこと、overrideしなければデフォルトでno-opであることを確認

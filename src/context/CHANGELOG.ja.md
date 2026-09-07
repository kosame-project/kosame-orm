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

## Phase 3 Step 2. hooks（UPDATE系: `beforeUpdate`）

### Added

- 単体テスト（`hooks.test.ts`）を拡張: `update()`/`save()`双方で`beforeUpdate()`による`changes`の書き換えが実UPDATEとインスタンスの両方に反映されること、例外を投げるとどちらもUPDATEを実行しないこと、overrideしなければデフォルトno-opであることを確認。実装本体（`beforeUpdate`の追加・呼び出し配線）は`src/model/CHANGELOG.ja.md`参照

## Phase 3 Step 3. hooks（DELETE系: `beforeDelete`）

### Added

- 単体テスト（`hooks.test.ts`）を拡張: `delete()`実行前に`beforeDelete()`が呼ばれること、例外を投げるとDELETE自体が実行されないこと、overrideしなければデフォルトno-opであることを確認。実装本体は`src/model/CHANGELOG.ja.md`参照
- これでPhase 3（hooks実装）3ステップ分のコンテキスト側テストが揃った

## Phase 4 Step 1. トランザクション（基本API・ネスト）

### Added

- `Context`に`transaction<R>(callback)`を実装
  - `#schema`（コンストラクタ引数として渡された元のschema）と`#txDepth`（ネスト段数、デフォルト0）を新たにprivateフィールドとして保持
  - 呼び出すと`src/query`の`runTransaction(db, depth, fn)`（dialectごとのBEGIN/SAVEPOINT分岐、詳細は`src/query/CHANGELOG.ja.md`参照）に処理を委譲し、コールバックには`#txDepth + 1`を持つ新しい`Context`インスタンス（`tx`ハンドル＋同じschemaで再構築）を`txContext`として渡す
  - 「Modelインスタンスは生成時のコンテキストに固定」という既存決定（Phase 2）により、`transaction()`より前に取得済みのインスタンスは自動的にトランザクションに参加しない（新たな実装は不要、既存の設計の帰結）
- 単体テスト（`transaction.test.ts`）: 成功時のコミット、失敗時（非同期gapを挟んだ例外）のロールバック、ネストしたトランザクションの内側だけロールバックされるケース・外側のロールバックが内側のコミット済み内容も巻き戻すケースを確認
  - **SQLite固有の注意点として発見**: `better-sqlite3`/`bun:sqlite`は単一コネクションのため、`context.transaction()`実行中に「トランザクション外」のはずの`context`経由の書き込みを行うと、実際には同じコネクション上の同一トランザクションの一部として扱われ、そのトランザクションのロールバックに巻き込まれる。PostgreSQL/MySQLのようなコネクションプール型のdialectでは`db.transaction()`が別コネクションをチェックアウトするため本来隔離されるが、単一コネクションのSQLiteではこの隔離が成立しない。決定事項「トランザクション外で取得済みのModelインスタンスは参加しない」自体は変わらない（インスタンスは常に生成時のcontextを参照している）が、その参照先のcontextがたまたま今トランザクション中のコネクションと同じ場合はこの限りではない、という実装上の制約としてテストに明記した

## Phase 4 Step 2. トランザクション（`afterCommit`/`afterRollback`）

### Added

- `Context`に`afterCommit(callback)` / `afterRollback(callback)`を実装
  - それぞれ`#afterCommitCallbacks`/`#afterRollbackCallbacks`という配列にコールバックを登録するだけのメソッド
  - `transaction()`側で、`runTransaction`が成功したら`afterCommit`側を、例外を投げたら`afterRollback`側を、登録順に`await`しながら順次呼び出す（並列実行はしない）
  - コールバック自体が例外を投げた場合はそこで打ち切り、その例外が`transaction()`の戻り値のPromiseを reject する（コミット/ロールバック自体は成功しているが、後処理コールバックの失敗が呼び出し側に伝播する）
  - ネストしたトランザクションでは、内側の`txContext.afterCommit()`は内側のSAVEPOINTがreleaseされた時点で発火する（外側のコミットを待たない）。これは「初期スコープ向けに割り切ったローカルなセマンティクス」であり、内側がreleaseされた後に外側全体がロールバックされた場合でも内側の`afterCommit`はすでに発火済みになる、という既知の制限として単体テストのコメントに明記した（ネストしたSAVEPOINTのrelease自体が外側のロールバックで巻き戻る、というdrizzle/DB側の一般的な挙動とは別の話）
- 単体テスト（`transaction.test.ts`に追加）: コールバックの実行順序、コミット時のみ`afterCommit`が・ロールバック時のみ`afterRollback`が発火すること、ネストしたトランザクションでの発火タイミング、コールバック自体が例外を投げた場合に`transaction()`がその例外でrejectすることを確認

## Phase 5. 継承・Mixin機構

### Added

- 単体テスト（`mixin.test.ts`）: `class Post extends WithGreeting(WithTag(Model)) {}`のような2段のmixin合成を、実際に`context.posts.add()`/`find()`/`update()`/`delete()`のパイプライン全体を通して検証。各mixinが追加したプロパティ・メソッドがインスタンスに乗ること、`beforeCreate()`のoverride（`super.beforeCreate()`呼び出し込み）が動くこと、`Model`本体のCRUDインスタンスメソッドが壊れないことを確認
- 実装本体（`Constructor<T>`型）は`src/model/CHANGELOG.ja.md`参照。`src/context`側での追加コードはなし（既存の`Model`・`ModelCollection`がmixinを意識せず動くことの確認のみ）

## Phase 6. ソフトデリート

### Added

- `ModelCollection.find(pkValue, options)`が、対象Modelクラスに`SoftDeletable`が適用されている場合（`getSoftDeleteColumn`が`Column`を返す場合）、デフォルトで`deletedAt IS NULL`を主キー条件にANDして除外するように変更
- `FindOptions`に`withDeleted?: boolean`を追加。`true`を渡すとソフトデリート済みの行も対象に含める
- `SoftDeletable`が適用されていないModelクラスは`getSoftDeleteColumn`が`undefined`を返すため、挙動は一切変わらない
- 単体テスト（`soft-delete.test.ts`）: `find()`のデフォルト除外・`withDeleted: true`での取得、`SoftDeletable`未適用Modelへの無影響、`hasMany`/`belongsTo`（`src/associations`経由）でのソフトデリート済み行の除外を確認

## Phase 7. エスケープハッチ

### Added

- `Context`/`createContext`を`db`の型についてもジェネリックにした（`Context<TSchema>` → `Context<TDb, TSchema>`）。これまで`db: unknown`として型を消していたが、呼び出し元が渡した実際のdrizzle db型をそのまま保持するようにした
- `Context`に公開ゲッター`raw`を追加。内部で保持している`[DB]`（非公開Symbolキー）の値をそのまま返すだけ。`db`の型がジェネリックで通っているため、`context.raw.select()...`のように`any`キャストなしでdrizzleの元のAPIをそのまま使える
- `transaction()`のtxContextは元々`tx`ハンドルで構築されるため、`txContext.raw`は自動的にそのトランザクションの`tx`を指す（決定事項「トランザクション整合性」）。追加の配線は不要だった
- `context.raw`経由のクエリ結果はModelインスタンスへhydrateされない、drizzleのプレーンな結果のまま（決定事項「戻り値」）。`ModelCollection`等を経由しないため、これは自然に満たされる
- 単体テスト（`raw.test.ts`）: `context.raw`が`createContext`に渡した`db`インスタンスと同一であること、経由したクエリ結果がプレーンな行でModelインスタンスでないこと、`transaction()`内で`txContext.raw`が実際に使えること（`any`キャストなしで型が通ることも含めて）を確認

**注意（SQLite）**: Phase 4で判明した通り、`better-sqlite3`/`bun:sqlite`は単一コネクションのため`txContext.raw`と`context.raw`が同一オブジェクトを指す（`tx`ハンドルという別概念が実質存在しない）。PostgreSQL/MySQLでは別コネクション/セッションになる。

## Phase 8. バリデーション統合

### Added

- `ModelCollection`（`src/context/collection.ts`）に`src/validation`の`validateSchema`を組み込み
  - `#hydrate(row)`: インスタンスへの`Object.assign`前に`validateSchema(this.#modelClass, row)`（完全なスキーマ）を実行。`find()`の結果・`add()`後の再取得行の両方がこの経路を通る
  - `add(values)`: `beforeCreate()`実行後、`insertRow`呼び出し前に`validateSchema(this.#modelClass, currentValues)`を実行
- `static schema`が定義されていないModelクラス（既存のテストで使っているほとんどのクラス）は`validateSchema`が何もしないため、挙動に変化はない
- 単体テスト（`validation.test.ts`）: `add()`/`update()`/`save()`が不正な値を拒否すること、`static schema`未定義のModelは検証されないこと、`find()`/`reload()`/アソシエーション経由の取得（`include`）が「DBに直接書き込まれてスキーマから外れた行（スキーマドリフト）」を検出して例外を投げることを確認
  - ドリフトの再現には、SQLiteの型アフィニティが緩い性質を利用: `NOT NULL`制約には違反しないが期待する型とは異なる値（文字列を数値カラムに）を`context.raw`経由の生SQLで書き込み、hydration時のzod検証で検出させている

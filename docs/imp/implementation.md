---
name: implementation-plan
description: kosame（Drizzle互換Model型ORM）の実装計画。フェーズごとの計画・進捗管理
sources: [cowork]
---

# kosame 実装計画

作成日: 2026-09-03
ステータス: フェーズ構成を検討中。要件・設計上の決定事項は `claude/requirements-draft.md` を参照

## フェーズ構成

- **Phase 1. 環境構築**
- **Phase 2. パイプライン実装**
- **Phase 3. hooks実装**
- **Phase 4. トランザクション**
- **Phase 5. 継承・Mixin機構**
- **Phase 6. ソフトデリート**
- **Phase 7. エスケープハッチ**
- **Phase 8. バリデーション統合**
- **Phase 9. テスト環境構築**

## Phase 1. 環境構築

requirements-draft.mdの決定事項からピックアップした、環境構築時に必要になりそうなライブラリ・ツール一覧。

- **コア依存パッケージ**
  - `drizzle-orm`: 永続化エンジン本体（全体を貫く原則、決定事項セクション参照）。バージョンはv0系の安定版に留め、v1のbeta/rcは使わない（決定事項「drizzle-ormの破壊的変更への追従方針」参照）。参考: 2026-09-04時点でv0系の最新安定版は`0.45.2`（9章調査時点から変わらず）、v1系は`1.0.0-rc.5`まで進行中（調査時点はrc.3）。正式リリース前のため、この方針のまま安定版を使う判断で問題ない
  - `drizzle-kit`: マイグレーション（1章「drizzle-kitとの互換性」参照）。`drizzle-orm`と同様、v0系の安定版に揃える
  - `zod`: バリデーション統合方針（決定事項/2章参照）
  - `drizzle-zod`: drizzleのテーブル定義からzodスキーマを自動生成。書き込み側・クエリ結果バリデーション両方で使用（決定事項/2章参照）
- **DBドライバ**（4章で対応DB決定済み。対応DBごとに必要）
  - PostgreSQL: `node-postgres`（`pg`）に決定。標準的なNode.js＋TCP接続という対応ホスティング環境（決定事項セクション参照）と一番素直に噛み合い、drizzle公式でも実績が厚い。BunはNode.jsのコアAPI（`net`/`tls`等）との互換性を目標にしているため、node-postgresが依存するAPIはBun上でも動く。postgres-js側の「軽量・エッジ寄り」という強みは、Cloudflare Workers上でPostgresに直接繋ぐ想定がない（Workers用はD1＝SQLite側でカバーされる）ため活かしどころが薄く、見送り。`postgres-js`等の追加ドライバ対応は初期スコープには含めず、OSS化後に要望があればissue経由で個別に検討する
  - MySQL: `mysql2`（TCP）
  - SQLite: `better-sqlite3`（ローカル）、`drizzle-orm/d1`（Cloudflare D1。対応ランタイムのCloudflare Workers対応に必要）、`libsql`（HTTP系）に決定。libsqlは独自に対応範囲を広げるのではなく、drizzle-orm自身がlibsqlに対応している範囲までを組み込む方針とする
- **ランタイム/ツールチェイン**
  - Bun: 対応ランタイムの一つであり、テストランナー（`bun test`）も兼ねる（決定事項/5章参照）
  - TypeScript: 型チェック速度を意識する方針（5章）の前提として必要
  - Node.js: 対応ランタイムの一つ（パッケージとしてではなく実行環境として必要）
- **テスト・CI用のツール/インフラ**（npmパッケージではない）
  - Docker: テスト実行のたびに使い捨てるPostgreSQL/MySQLコンテナに使用（決定事項「テスト方針：実DBの用意の仕方」参照）
  - GitHub Actions: CI（`push`トリガー、service containersでPostgreSQL/MySQLを起動。決定事項「テスト方針：CI導入」参照）

Phase 1のDBドライバ関連の未確定点はこれで解消した。

## Phase 2. パイプライン実装

requirements-draft.mdの決定事項から、Model⇔drizzle間の翻訳パイプラインに関わる部分をピックアップして整理。トランザクション（Phase 4）、継承・Mixin（Phase 5）、ソフトデリート（Phase 6）、エスケープハッチ（Phase 7）、hooks・バリデーション統合（Phase 3・Phase 8）は別フェーズなので、Phase 2では拡張の余地を残すに留め、実装自体は含めない。

- **Model基盤**
  - クラスベースでModelを定義する（`class User extends Model {...}`）。関数/ファクトリベース・codegenは不採用（決定事項/3章参照）
  - Modelとdrizzleのテーブル定義の紐付けは`static table`（例: `class User extends Model { static table = usersTable }`）（決定事項参照）
  - コンストラクタは非公開Symbolのブランド（`brand: typeof INTERNAL`）を必須引数として要求し、`new User()`の直接呼び出しを防ぐ（決定事項/3章参照）
  - コンテキスト/トランザクション参照はコンストラクタ注入でprivateフィールド（`#context`）に保持するexplicit方式（AsyncLocalStorage等のambient方式は不採用）（決定事項/3章参照）
- **コンテキスト（DbContext相当）**
  - `createContext(db, schema)`的なファクトリを用意し、起動時にスキーマをiterateして`context.users`/`context.posts`等の入り口を組み立てる（Proxyは不使用）（決定事項/3章参照）
  - drizzle初期化時の設定簡素化（`schema`は渡さない、`casing`変換は使わずcamelCase統一、`logger`はデフォルトoff）を踏まえたコンテキストファクトリの設計（決定事項「drizzle初期化時の設定項目の削減」参照）
- **CRUD変換（コア翻訳ロジック）**
  - インスタンスメソッド`user.save()`/`update()`/`delete()`/`reload()`を、内部でdrizzleのINSERT/UPDATE/DELETE/SELECT呼び出しに変換する。呼んだ瞬間に即時反映（自動Change Trackingはしない）（決定事項/2章参照）
  - コンテキスト経由のCRUD（`context.users.find()`/`context.users.add()`等）もインスタンスメソッドと併用で持たせる（決定事項/2章参照）
- **アソシエーション・hydration**
  - アソシエーション（`hasMany`/`belongsTo`相当）はModel層側で定義し、drizzleへの呼び出しに変換する。drizzleの`relations()`はアソシエーションの一次情報にしない（決定事項参照）
  - リレーションの変換先は、親のキー配列を`IN`句にしたクエリをリレーションごとに1本発行する方式（JOINは使わない、バッチクエリ方式）（決定事項参照）
  - hydrationアルゴリズムは「親の主キーでgroupByし、子の配列にまとめる」に統一する（決定事項参照）
  - ネストは1段階まで（`User → Posts`まで。孫関連の同時eager loadingは将来課題）（決定事項参照）

**Phase 3・Phase 8との接続点（メモ）**: クエリ結果バリデーションは「drizzleのSELECT結果をModelインスタンスへhydrateする処理に常に組み込まれた処理」と決定事項にあるため、Phase 2のhydrationパイプラインには検証関数を差し込める形にしておく必要がある（検証関数自体の実装はPhase 8）。同様にhooks（`beforeCreate`等）もCRUD変換の前段に挟む前提（決定事項/2章参照）のため、Phase 2のCRUD変換にはフック呼び出しの差し込み口を残しておく（フックの実装自体はPhase 3）。

## Phase 3. hooks実装

CRUDインスタンスメソッド（`save()`/`update()`/`delete()`）に対応する、書き込み前（before系）の非同期バリデーションフックを実装する。

- **フック一覧**
  - `beforeCreate`: INSERT前（決定事項参照。ユニーク制約チェック等の非同期バリデーション用の例として明記済み）
  - `beforeUpdate`: UPDATE前（`beforeCreate`と対称。updateでも起こりうる非同期バリデーションのため）
  - `beforeDelete`: DELETE前（関連レコードの存在チェック等）
- **フックの仕組み**
  - contextにアクセスできる関数として定義し、drizzle呼び出しへの変換の前段に挟む（決定事項/2章参照）
  - 失敗時（例外を投げた場合）はDB操作自体を停止させる。結果オブジェクトを返して処理を継続させる方式は採らない（決定事項「フック失敗時の挙動」参照）
- **after系フックは採用しない**
  - `save()`は呼んだ瞬間に即時反映される設計（自動Change Trackingなし）のため、書き込み成功後の処理は`await user.save(); doSomething();`のように呼び出し側で明示的に書けば足りる。「明示性を優先する」原則とも一貫する
  - トランザクション内で後処理を確実に走らせたいケースは、Phase 4で決定済みの`afterCommit`/`afterRollback`コールバック（txContext側）でカバーされる
  - 唯一カバーされないのは「トランザクションを使わない単発の書き込みで、複数箇所から呼ばれても後処理を強制したい」ケースだが、初期スコープでは見送る（better-drizzleの`afterCreate`/`afterUpdate`/`afterQuery`は参考にしたが採用しない）

## Phase 4. トランザクション

requirements-draft.mdの決定事項「トランザクションとコンテキストの対応関係」がそのまま実装対象になる。

- **API形状**: drizzleの`db.transaction(async tx => {...})`と同じコールバック型。`context.transaction(async (txContext) => {...})`のように、コールバック内で専用のtxContext（トランザクション用の別コンテキストインスタンス）を受け取る（決定事項参照）
- **既存Modelインスタンスの扱い**: 「Modelインスタンスは生成時のコンテキストに固定」という既存決定の帰結として、トランザクション外で取得済みのModelインスタンスはトランザクション内で使ってもそのトランザクションには参加しない。トランザクション内で操作したいものは`txContext`側で改めて取得し直す必要がある（決定事項参照）
- **ネストしたトランザクション**: 対応する。drizzle自体がTCP系ドライバでSAVEPOINTベースのネストしたトランザクション（`tx.transaction(...)`）に対応しているため、それを踏襲する（決定事項参照）
- **afterCommit/afterRollbackコールバック**: 初期スコープに含める。txContext側にコールバックのリストを持たせ、commit/rollback後に呼び出す（決定事項参照。Phase 3で見送ったafter系フックの代替として、トランザクション内の後処理保証はここでカバーされる）
- **リトライ機構は非目標**: デッドロック等の一時的な失敗の検知・リトライはエラー種別がDB dialectごとに異なり、冪等性の考慮も必要になるため実装コストが高く、見送り（7章参照）。代替として、`context.transaction()`が単なる非同期関数呼び出しである点を活かし、失敗時の例外を呼び出し元でtry/catchして`context.transaction()`を呼び直す、というユーザー側の通常のロジックで対応する
- **HTTPドライバの制約**: `neon-http`・D1の一部モード等、インタラクティブなトランザクションが使えないドライバでの`context.transaction()`の挙動（エラーにするか等）は、決定事項の時点では「実装時に個別に詰める」とされておりまだ確定していない

**Phase 7との接続点（メモ）**: コンテキストがすでに自分の`db`/`tx`ハンドルを保持している設計のため、トランザクション中のコンテキスト（`txContext`）であれば`txContext.raw`は自動的にそのトランザクションの`tx`を指す（決定事項「エスケープハッチ」参照）。Phase 7実装時にこの整合性を踏まえる必要がある。

**未確定点**: HTTPドライバ（`neon-http`/D1の一部モード）で`context.transaction()`を呼んだ場合の挙動。

## Phase 5. 継承・Mixin機構

requirements-draft.mdの決定事項「継承・Mixin」がそのまま実装対象になる。

- **継承方針**: 複数階層にまたがる`is-a`継承（例: `class Employee extends Person`のような多段クラス階層）は積極的に使わせる設計はせず、機能単位で独立したmixin関数（クラスを受け取りクラスを返す関数。例: `class Post extends SoftDeletable(Timestamped(Model)) {}`）による合成寄りのアーキテクチャを採用する（決定事項参照）
- **なぜmixin方式が成立するか**: EF Coreのエンティティは実際にはpublicなgetter/setterのみを持つ薄いデータの入れ物で、賢い処理（クエリ・変更検知等）はDbContext側にある。このORMも同様に、CRUD変換・hydration・バリデーションのパイプラインはModel本体ではなくContext側にあるため、Modelクラス自体はもともと薄い（カラムの値＋`save()`/`update()`/`delete()`/`reload()`程度）。この形は「本当のhas-a合成」（別オブジェクトを保持して委譲する形）とは相性が悪く（`delete()`等の既存メソッドの挙動そのものに割り込む必要があるため）、mixin関数によるクラス合成と相性が良い（決定事項参照）
- **mixin関数の実装要件**: ソフトデリート・名前付きスコープのような横断的機能を、独立したmixin関数として実装し、必要なものだけ組み合わせて使ってもらう形にする。ブランドSymbol・`#context`まわりの配線（Phase 2「Model基盤」で決定済み）は各mixin関数内で一度だけ面倒を見ればよく、利用者は気にしなくて済む設計にする（決定事項参照）
- **DBスキーマレベルの継承（TPH/TPT/TPC等）は対象外**: EF Coreの`OnModelCreating(modelBuilder)`のようなテーブルマッピング戦略の設定は、「スキーマ定義はユーザーがdrizzleの`pgTable`を直接書く、Model層に別DSLは持たせない」という既存原則の対象であり、Model層に専用のbuilder関数は用意しない。テーブル分割・discriminator列等はユーザーが`pgTable`側で表現し、Model側は`static table`の紐付けで対応する（決定事項/7章の非目標参照）

**Phase 2・Phase 6との接続点（メモ）**: mixin関数はPhase 2で作るブランドSymbol・`#context`の配線を壊さずに合成できる必要がある。Phase 6（ソフトデリート）の`SoftDeletable`ミックスインが、このPhase 5の機構の上に構築される最初の実例になる。

## Phase 6. ソフトデリート

requirements-draft.mdの決定事項「ソフトデリート」がそのまま実装対象になる。

- **対応方式**: `deletedAtColumn()`（仮称、nullableなタイムスタンプカラム用ヘルパー）をユーザーが自分の`pgTable`に追加し、`SoftDeletable`ミックスイン（`class Post extends SoftDeletable(Model) {}`）を明示的に適用したModelだけソフトデリート対応にする。ハード削除（実際の`DELETE`）とソフトデリート（`deletedAt`への`UPDATE`）を両方使えるようにする（決定事項参照）
  - `deletedAtColumn()`は、Phase 2で作る`createdAtColumn()`/`updatedAtColumn()`と同じ実装パターン（drizzleのカラムレベル機構を薄くラップ）を踏襲できる見込み
  - `SoftDeletable`ミックスインはPhase 5で作るmixin機構の上に構築する最初の実例
  - `SoftDeletable`を適用しなければ`.delete()`は従来通りハード削除のまま
- **クエリの自動除外（グローバルクエリフィルタ）**: `SoftDeletable`を適用したModelに限り、通常の`find()`等のクエリ経路もそのMixinが上書きし、デフォルトでソフトデリート済みの行を自動的に除外する。削除済みの行も見たい場合は`withDeleted()`（仮称）のような形で明示的に含める（決定事項参照）
- **判定方式**: カラム名（例: `deletedAt`という名前）だけを見て自動判定するconvention方式は取らず、Mixinを明示適用したかどうかで判定する。暗黙の魔法を持ち込まない（決定事項参照）

## Phase 7. エスケープハッチ

requirements-draft.mdの決定事項「エスケープハッチ」がそのまま実装対象になる。

- **対応方式**: `context.raw`（仮称）として、コンテキストが内部で保持しているdrizzleの`db`/`tx`ハンドルをそのまま公開する（決定事項参照）
- **トランザクション整合性**: コンテキストがすでに自分の`db`/`tx`ハンドルを保持している設計（Phase 2のコンストラクタ注入）なので、それをそのまま公開するだけで済み、追加の配線は不要。トランザクション中のコンテキスト（Phase 4の`txContext`）であれば、`txContext.raw`は自動的にそのトランザクションの`tx`を指す（決定事項参照）
- **戻り値**: `context.raw`経由のクエリ結果はModelインスタンスへhydrateせず、drizzleのプレーンな結果のまま返す。任意の集計・複数テーブルをまたぐ結果をModelクラスに対応付ける汎用的な仕組みは実装コストが見合わないため非目標とする。「エスケープハッチを使う＝Model層の外に出る」と割り切る（決定事項/7章の非目標参照）

## Phase 8. バリデーション統合

requirements-draft.mdの決定事項「バリデーション統合方針」「クエリ結果のバリデーション」がそのまま実装対象になる。

- **書き込み側（同期チェック）**: zodを利用する。drizzle-zodでdrizzleのテーブル定義からzodスキーマを自動生成し、Model定義側に`static schema`的な形で持たせる（決定事項参照）
- **書き込み側（非同期チェック）**: DB問い合わせが必要な非同期バリデーション（ユニーク制約チェック等）は、Phase 3で作る`beforeCreate`等のフック側（contextにアクセスできる関数）で対応する（決定事項参照）
- **クエリ結果側**: 書き込み側と同じzod（drizzle-zodで生成したスキーマを再利用）で検証する。Model定義（クラス登録）のタイミングで検証関数を1回だけ組み立てておき、Phase 2のhydrationパイプライン（drizzleのSELECT結果をModelインスタンスへhydrateする処理）に常に組み込まれた処理として挟む（決定事項参照）
- **実行タイミング**: 本番/開発/テストで分岐する専用フラグは用意せず、常時実行する。「本番で発生したスキーマドリフトが即座に例外として表面化する」というfail-fastな挙動を受け入れる（決定事項参照。切り替え機構自体が7章の非目標）
- **失敗時の挙動**: フック失敗時と同様、例外を投げてDB操作（クエリ結果側の場合はhydrate処理）を停止させる（決定事項参照）

## Phase 9. テスト環境構築

requirements-draft.mdの決定事項「テスト方針」一式がそのまま実装対象になる。テスト環境と、Phase 2〜8の決定事項から拾えるテスト項目を分けて整理する。

- **テスト環境**
  - **テストランナー**: `bun test`を使う（決定事項参照。Bunさえ入っていれば追加依存なしで動き、Jest互換APIでcoverage/watch/snapshotも一通り揃っている）
  - **実DBの用意の仕方**: 永続的な開発用DBではなく、テスト実行のたびに使い捨てのコンテナ（Docker等）で起動して破棄する（決定事項参照）
  - **実DBでカバーする範囲**: SQLite in-memoryへの切り分けはせず、テスト全体を実DB（使い捨てコンテナ）で実行する。PostgreSQL/MySQL/SQLite間のdialect差（型の扱い、SAVEPOINTの有無等）を全テストで拾う（決定事項参照）
  - **CI**: GitHub Actions、`push`イベント（全ブランチ、`pull_request`との併用はしない）で実行する。service containersでPostgreSQL/MySQLを起動（SQLiteはコンテナ不要）（決定事項参照）
- **テスト項目**（Phase 2〜8の決定事項から拾えるもの）
  - Model基盤: 非公開Symbolブランドにより`new User()`の直接呼び出しが例外になること（決定事項/Phase 2参照）
  - CRUD変換: `save()`/`update()`/`delete()`/`reload()`がdrizzleのINSERT/UPDATE/DELETE/SELECTに正しく変換され、即時反映されること（決定事項/Phase 2参照）
  - アソシエーション・hydration: 親キーのIN句バッチクエリが発行されること、親主キーでのgroupByによるhydrationが正しいこと、ネストが1段階までに制限されていること（決定事項/Phase 2参照）
  - hooks: `beforeCreate`/`beforeUpdate`/`beforeDelete`が該当のCRUD呼び出し前に実行されること、失敗時に例外が投げられDB操作が実行されないこと（決定事項/Phase 3参照）
  - トランザクション: `context.transaction()`のネスト対応（SAVEPOINT）、`afterCommit`/`afterRollback`コールバックの実行、トランザクション外で取得したModelインスタンスがトランザクションに参加しないこと（決定事項/Phase 4参照）
  - 継承・Mixin: mixin関数の合成（例: `SoftDeletable(Timestamped(Model))`）がブランドSymbol・`#context`の配線を壊さないこと（決定事項/Phase 5参照）
  - ソフトデリート: `SoftDeletable`適用Modelで`find()`がデフォルトでソフトデリート済み行を除外すること、`withDeleted()`で明示的に含められること、未適用Modelでは`.delete()`がハード削除のままであること（決定事項/Phase 6参照）
  - エスケープハッチ: `context.raw`がModelインスタンスへhydrateしないプレーンな結果を返すこと、トランザクション中は`txContext.raw`が自動的にそのトランザクションの`tx`を指すこと（決定事項/Phase 7参照）
  - バリデーション統合: 書き込み時の同期スキーマ・非同期フックの両方が機能すること、クエリ結果側の検証がhydrate前に常時実行され失敗時に例外を投げること（決定事項/Phase 8参照）
  - dialect横断: PostgreSQL/MySQL/SQLite（D1含む）それぞれで上記項目が一貫して動作すること（決定事項/4章「対応DB」参照）
  - 型推論: `InferSelectModel`/`InferInsertModel`等の推論結果が期待した型と完全一致すること（本フェーズで決定。詳細は次項）
- **型推論のテスト方法**（本フェーズで決定。requirements-draft.mdには記載なし）
  - `bun test`自体はTSをトランスパイルするだけで型チェックはしないため、`bun test`とは別にCIへ`tsc --noEmit`のステップを追加する
  - 単に`tsc --noEmit`が通るかだけでは、推論結果が意図せず`any`等に崩れていても使用側のコードがたまたま型エラーにならず見逃すことがあるため、`Equal<A, B>`のような型比較ユーティリティ型と、それを使う`expectType<Expected>(actual)`のようなno-op関数による型レベルアサーションを併用する（drizzle-orm自身のテストスイートでも使われているパターン）。自作（数行、ゼロ依存）と`expect-type`ライブラリのどちらでも「実装コストを抑える」原則には反しない

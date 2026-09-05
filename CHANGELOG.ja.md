# Changelog

このプロジェクトの変更履歴。[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) の形式に準拠する。

## [Unreleased]

### Added

- **Phase 1. 環境構築**
  - `package.json` を作成（`type: module` によるESM-only構成、`private: true`）
  - コア依存パッケージを導入: `drizzle-orm@0.45.2` / `drizzle-zod@0.8.3` / `zod@4.5.4`（いずれもv0系安定版。`docs/Requirements.md` 決定事項「drizzle-ormの破壊的変更への追従方針」に基づきv1 rcは見送り）
  - DBドライバを `peerDependencies`（optional）として定義: `pg` / `mysql2` / `better-sqlite3` / `@libsql/client`。開発・テスト用に `devDependencies` にも同梱
  - 開発ツールとして `typescript@7.0.2`（Go製ネイティブコンパイラ）・`drizzle-kit@0.31.10` を導入
  - `tsconfig.json` を作成（ESM/NodeNext解決、strict、`verbatimModuleSyntax` 等）
  - `src/index.ts`（プレースホルダ）、`.gitignore` を追加
  - `bun install` / `tsc --noEmit` が正常に通ることを確認

[Unreleased]: https://github.com/kosame-project/kosame-orm

# conduit-api

RealWorld(Conduit)のバックエンド。契約は `spec/`(conduit-spec から取り込んだ `openapi.yml` と `hurl/`)。

## 構成

- `src/app.ts`: Hono アプリの組み立て。ルートは `src/routes/<resource>.ts` に置き、ここで登録する
- `src/services/`: 業務ロジック(ルートから呼ぶ。DB アクセスはここに閉じる)
- `src/db/`: SQLite(better-sqlite3)。マイグレーションは `src/db/migrations/NNNN_name.sql` を連番で追加する(起動時に自動適用)
- `test/`: vitest の単体・結合テスト(`app.request()` でルートを直接叩く。DB は `:memory:`)
- `spec/hurl/`: 適合テスト。改変しない。`spec/enabled.txt` に列挙したファイルが `pnpm verify` で回る

## ルール

- エラーレスポンスの形式、slug、pagination、JWT は conduit-spec の `decisions.md` に従う(読み取り専用で渡されている conduit-spec のパスを参照)
- チケットで対応した hurl ファイルは `spec/enabled.txt` に追加する。追加したファイルが通ることが完了条件
- `pnpm verify`(typecheck / lint / vitest / hurl)が緑であること。個別に回すなら `pnpm test:api auth.hurl`
- 依存の追加は最小限に。ORM は入れず、SQL は `src/services/` に直接書く
- `spec/` を手で編集しない。更新は `pnpm sync-spec`(SPEC_DIR に conduit-spec のパス)

## コマンド

```
pnpm install
pnpm dev                      # http://localhost:3000
pnpm test                     # vitest
pnpm test:api [file.hurl ...] # サーバを一時 DB で起動して hurl
pnpm verify
```

## 環境変数

- `JWT_SECRET`: JWT の署名鍵(decisions.md TBD-4)。`NODE_ENV=production` では必須で、未設定だと起動時にエラーになる。開発・テストでは未設定なら起動ごとにランダム生成される
- `PORT`: listen ポート(既定 3000)
- `DATABASE_PATH`: SQLite のファイルパス(既定 `./data/conduit.db`)

# DoujinShelf

同人誌を個人で管理するためのDBシステムです。  
作品の基本情報に加えて、タグ・作者・サークル・イベント・自由項目をまとめて整理できます。  
「あとで探せる・見返せる」ことを重視した、軽量な個人用カタログを目指しています。

## 必要なアプリ
- Docker Desktop（Windows/macOS）

## Quick Start（初めての方向け）
1. Docker Desktop をインストールして起動する  
2. このリポジトリを取得する  
3. ルートで以下を実行する
   ```bash
   docker compose up --build
   ```
4. 起動ログに表示されるローカルのUIアドレスをブラウザで開く  
   ※ うまく表示されない場合は、Docker Desktop が起動しているか確認してください。

停止する場合:
```bash
docker compose down
```

## 使い方（画面の概要）
- 登録: 「登録」タブで作品を入力して保存  
- 一覧: 「作品一覧」タブでカード表示・検索・サイズ切替  
- 作者/サークル/イベント/タグ一覧: 各一覧からクリックで作品一覧へ絞り込み  
- 編集/削除: 作品カードの「編集」「削除」ボタン

## 技術スタック
- Frontend: React + Vite
- Backend: FastAPI
- DB: PostgreSQL
- コンテナ: Docker / Docker Compose

## バックアップ（例）
```bash
docker compose exec db pg_dump -U doujin doujinshelf > backup.sql
```


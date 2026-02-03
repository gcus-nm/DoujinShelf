# DoujinShelf

同人誌を管理するための個人向けDBシステムです。

## 主な機能
- 作品登録/編集/削除
- 画像アップロード（表紙1枚）
- タグ、作者、サークル、イベントの管理
- 自由項目（キー/値）
- 作品/作者/サークル/イベント/タグの一覧と検索

## 必要なアプリ
- Docker Desktop（Windows/macOS）

## 起動方法
```bash
docker compose up --build
```

## アクセス
- Web UI: http://localhost:5173
- API: http://localhost:8080

## データベース
PostgreSQL を使用しています。

## バックアップ（例）
```bash
docker compose exec db pg_dump -U doujin doujinshelf > backup.sql
```

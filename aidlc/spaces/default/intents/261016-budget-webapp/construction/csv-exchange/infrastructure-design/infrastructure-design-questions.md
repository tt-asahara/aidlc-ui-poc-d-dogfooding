# Infrastructure Design（csv-exchange）— 質問

この Unit の基盤設計で、新たに利用者の判断が必要な点はありません。

- デプロイはしない（team.md Deployment）。ファイルの読み取りと生成はブラウザ内だけで行い、クラウドの資源・サーバー・秘密情報は使わない。
- マージ前の検証はローカルの一括検証コマンド `npm run verify` で行う（Delivery Planning で承認済み）。U6 で増えるのは検証設定（ESLint の csv-exchange 用ブロック、Vitest の csv-exchange 用プロジェクトと下限）だけで、NFR Design で決定済み。追加の依存はない。
- U6 は種類 library のため、基盤の仕様書・監視の設計書は作らない（ステージの種類別の対象外）。

質問は0件のため、回答欄はありません。

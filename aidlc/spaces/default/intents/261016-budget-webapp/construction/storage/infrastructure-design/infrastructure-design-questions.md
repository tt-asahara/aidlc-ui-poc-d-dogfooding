# Infrastructure Design（storage）— 質問

この Unit の基盤設計で、新たに利用者の判断が必要な点はありません。

- デプロイはしない（team.md Deployment：ローカルでビルド・起動できる状態がゴール）。保存先は利用者のブラウザ内の IndexedDB だけで、クラウドの資源、サーバー、外部のデータベース、秘密情報は使わない。
- マージ前の検証はローカルの一括検証コマンド `npm run verify` で行う（team.md Testing Posture、Delivery Planning で承認済み）。U3 で増えるのは開発時の依存 fake-indexeddb と、検証設定（ESLint の storage 用ブロック、Vitest の storage 用プロジェクトと下限）だけで、NFR Design で決定済み。
- U3 は種類 library のため、基盤の仕様書・監視の設計書は作らない（ステージの種類別の対象外）。

質問は0件のため、回答欄はありません。

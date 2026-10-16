# Infrastructure Design（ui-kit）— 質問

この Unit の基盤設計で、新たに利用者の判断が必要な点はありません。

- デプロイはしない（team.md Deployment：ローカルでビルド・起動できる状態がゴール）。クラウドの資源、サーバー、データベース、秘密情報は使わない。
- CI 構築の工程は計画に含まれず、マージ前の検証はローカルの一括検証コマンド `npm run verify` で行う（team.md Testing Posture、Delivery Planning で承認済み）。
- U2 は種類 library で、単独では動かない部品のため、基盤の仕様書・監視の設計書は作らない（ステージの種類別の対象外）。

質問は0件のため、回答欄はありません。

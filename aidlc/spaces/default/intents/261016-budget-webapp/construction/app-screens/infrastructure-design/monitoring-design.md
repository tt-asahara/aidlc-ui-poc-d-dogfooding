# 監視の設計（app-screens）

- 出典: `inception/requirements-analysis/requirements.md`（NFR3、NFR4）、`construction/app-screens/nfr-design/performance-design.md`（計測の方法）、`construction/app-screens/infrastructure-design/infrastructure-specification.md`（配布の形）

## 1. 対象外の理由

- U7 は利用者のブラウザで動く静的なアプリで、サーバーや稼働するサービスを持たない（team.md Deployment）。
- 常時の監視、ログの収集、アラートは作らない。外部へ何かを送る仕組みはない（NFR1）。
- 利用中の状態は画面の表示と、保存の失敗の知らせ（BR8.3）で利用者に伝える。運用の監視の仕組みは対象外。

## 2. 開発時の計測（代わりに持つもの）

- 操作の時間は `src/app/perf.ts` で、開発ビルドのときだけ記録する（performance-design 3章）。記録は開発者のコンソールにだけ出し、外部へは送らない。
- 本番ビルドの合否の計測は、Build and Test で Chrome の開発者ツールを使って行う。計測の結果は記録に残す（監視の仕組みではなく、一回限りの確認）。
- 本番ビルドには計測の記録の印（`perf:`）が残らないことを確かめる（infrastructure-specification 4章）。

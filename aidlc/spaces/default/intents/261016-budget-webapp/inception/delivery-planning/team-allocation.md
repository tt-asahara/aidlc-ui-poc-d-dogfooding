# 担当の割り当て

- Bolt（ボルト）とは、作業の一部を1回で設計から実装・テストまで通し、動くものを仕上げる単位である。モブ（mob）とは、1つの作業を複数の担当が同時に進める体制のことである。
- 今回の計画（classic）ではチーム編成の工程（Team Formation）を行っていない。そのため、すべての Bolt を AI の開発担当（aidlc-developer-agent）が、このセッションの中で実行する。人の担当者は各工程の承認を行う。
- 1チーム・1セッションのため、複数チームの調整表（Program Board）は作らない。

| Bolt | Unit | 実行する担当 | 設計工程で関わる担当 | 承認者 |
|------|------|--------------|----------------------|--------|
| B1 | U1 data-contract | aidlc-developer-agent | アーキテクト（Functional Design ほか） | 利用者（このセッションの依頼者） |
| B2 | U3 storage | aidlc-developer-agent | アーキテクト、プラットフォーム担当（Infrastructure Design） | 利用者 |
| B3 | U4 bookkeeping-core | aidlc-developer-agent | アーキテクト | 利用者 |
| B4 | U5 monthly-summary | aidlc-developer-agent | アーキテクト | 利用者 |
| B5 | U6 csv-exchange | aidlc-developer-agent | アーキテクト | 利用者 |
| B6 | U2 ui-kit | aidlc-developer-agent | アーキテクト | 利用者 |
| B7 | U7 app-screens | aidlc-developer-agent | アーキテクト | 利用者 |

- 各工程のレビューは、工程ごとに決められたレビュー担当（アーキテクチャレビュー担当など）が行う。
- 品質担当（aidlc-quality-agent）は Build and Test で全体の検証を行う。
- Bolt を同時に進めないため、担当の負荷の調整は不要である。

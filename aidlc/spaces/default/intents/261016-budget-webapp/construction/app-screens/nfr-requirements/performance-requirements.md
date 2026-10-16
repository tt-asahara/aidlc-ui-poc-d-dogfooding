# 性能の要件（app-screens）

- 出典: `inception/requirements-analysis/requirements.md`（NFR3）、`construction/monthly-summary/nfr-requirements/tech-stack-decisions.md`（U5 の割り当て 250ms と 20ms）、`construction/csv-exchange/nfr-requirements/tech-stack-decisions.md`（U6 の割り当て 1,000ms と 500ms）、`construction/bookkeeping-core/code-generation/code-summary.md`（U4 の実測）、`construction/app-screens/nfr-requirements/tech-stack-decisions.md`（NFR3.1、NFR3.2）

## 1. 要件（NFR3 の再掲と確かめ方）

| 操作 | 件数 | 合格条件 | 測る場所 |
|------|------|----------|----------|
| 月次集計の表示の切り替え（前月・翌月を押してから表が更新されるまで） | 収支 5,000 件・カテゴリ 30 件・予算 360 件 | 500ms 以内 | 実ブラウザ（Chrome 最新版、開発用 PC）。Build and Test |
| CSV 5,000 行の読み込みからプレビュー表示まで | 5,000 行（1MB 以内） | 2 秒以内 | 実ブラウザ。Build and Test |
| 収支の登録から一覧の更新まで（参考値） | 収支 5,000 件 | 記録のみ（合格条件なし） | 実ブラウザ |

## 2. 割り当て（既存の Unit の実測と目安から）

| 部分 | 割り当て（目安） | 根拠 |
|------|------------------|------|
| 月次集計の取得（U4 の読み取り3回） | 250ms 以内 | U5 の実測 3.2ms（fake-indexeddb）。実ブラウザの IndexedDB は遅いため余裕を大きく取る |
| 集計の計算 | 20ms 以内 | U5 の実測 0.2ms |
| 表示の描画（U7） | 残り（500ms の合計） | 実ブラウザで合計を測り、描画を含めて確かめる |
| CSV の読み込みと解析（U6） | 1,000ms 以内 | U6 の実測 34.7ms（fake-indexeddb 上の目安） |
| 件数が多すぎるファイルの判定（U6） | 500ms 以内 | U6 の実測 18.2ms |
| 描画を含む読み込みからプレビューまで | 2 秒以内 | 実ブラウザで合計を測る |

## 3. 測り方

- Chrome の開発者ツールのパフォーマンス記録、または画面の計測の関数で、操作の開始から表示の更新までを測る。
- 同じ操作を5回行い、中央値で判定する（U4〜U6 と同じ判定方法）。
- 測定の前に、架空データ（収支 5,000 件など）を保存領域に入れ、ページを一度読み直してから測る。
- 測定値と環境（Chrome のバージョン、OS、CPU）を Build and Test の記録に残す。

## 4. 限界

- fake-indexeddb での測定は、実ブラウザの IndexedDB の代用にならない。実ブラウザの測定が正である。
- 性能は開発用 PC の条件に依存する。合格条件は要件（NFR3）のとおりで、緩めない。不安定なら原因を調べて記録する。

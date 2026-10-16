# 横断の追跡（全体の最終確認）

- 出典: `inception/requirements-analysis/requirements.md`（FR、NFR）、`inception/user-stories/stories.md`（受け入れ条件 95 件）、`construction/*/code-generation/traceability.json`（全 7 Unit）

## 1. 判定

- 受け入れ条件（AC）: 95 件中 95 件が、いずれかの Unit の追跡表で OK（未対応 0）。
- 非機能要件（NFR1〜NFR9）: 9 件すべてが、いずれかの Unit で OK。
- 判定: 追跡は完了（pass）。ただし、ブラウザでの確認が必要な項目（性能、B1〜B5、キーボード、通信 0 件、ダウンロード、他ブラウザ）は、追跡の OK ではなく Build and Test の Target Verification Matrix で Unverified として扱う。

## 2. 確認の方法

- 各 Unit の `code-generation/traceability.json` の `coverage` で `status` が `OK` のものを集め、受け入れ条件の全 ID（stories.md の 95 件）と突き合わせた。未対応は 0 件（`comm` の結果が空）。
- NFR は、各 Unit の OK の ID を先頭の番号で集め、NFR1〜NFR9 が全て含まれることを確かめた。

## 3. 担当の Unit（主な対応）

| 範囲 | 主な担当 Unit |
|------|---------------|
| US1.1（入力の検証） | U1（data-contract）、U7（app-screens） |
| US1.2（再読み込み後の保持） | U3（storage）、U7（表示） |
| US1.3（外部へ送らない） | U2〜U7 の検査、U7 の配布の検査 |
| US2.x（収支） | U4（bookkeeping-core）、U7 |
| US3.x（カテゴリ） | U4、U7 |
| US4.x（予算） | U4、U7 |
| US5.x（月次集計） | U5（monthly-summary）、U7 |
| US6.x、US7.x（CSV） | U6（csv-exchange）、U7 |
| US8.x（状態表示） | U2（StatusPanel）、U3、U7 |
| US9.x（キーボードとフォーカス） | U2（Dialog、Tabs）、U7 |
| NFR1（外部送信なし） | U3〜U7 の静的検査、U7 の配布検査（実行時は Unverified） |
| NFR3（性能） | U5、U6 の実測、U7 の実ブラウザ測定（Unverified） |

## 4. 未解消（この stage の判断が必要）

- 実ブラウザでの確認（BT-09〜BT-17）。
- 登録フォームの無効化（BR8.1、BR8.2）は、コードレビュー後に修正済み。実ブラウザでは未確認（登録後のフォーカスを含む）。

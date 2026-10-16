# 機能仕様（monthly-summary）

- 出典: `entities.md`、`rules.md`、`inception/contract-design/contract-summary.md`（C3、C4）、`inception/user-stories/stories.md`（US5.1〜US5.4）、`inception/requirements-analysis/requirements.md`（FR5、NFR5）、`inception/domain-design/decisions.md`（ADR-003）

## 1. 担当するストーリーと受け入れ条件

| ストーリー | 受け入れ条件 | 規則 |
|------------|--------------|------|
| US5.1 月の収入・支出・差額を見る | AC5.1.1、AC5.1.2、AC5.1.3（計算の側）、AC5.1.4（取得の側） | BR1.1、BR1.2、BR4.1 |
| US5.2 カテゴリ別に予算と実績を比べる | AC5.2.1、AC5.2.2、AC5.2.3 | BR2.1〜BR2.4、BR1.3 |
| US5.3 収入のカテゴリ別内訳を見る | AC5.3.1 | BR3.1、BR3.2 |
| US5.4 収支のない月を開いても迷わない | AC5.4.1、AC5.4.2 | BR1.4、BR2.2 |

3桁区切り、マイナス記号と「赤字」、「超過」「—（予算なし）」「引き継ぎ」の文字、前月・翌月の移動と初期表示の今月、空の月の文言と導線は U7 が表示する（U5 は数と真偽だけを返す）。

## 2. 手順（ワークフロー）

### W1 集計を取得する（getMonthlySummary）

1. U4 の listTransactions(month)、listCategories()、getEffectiveBudgets(month) を呼ぶ。どれかが失敗したら最初の失敗を返す（BR4.1）。
2. 対象月の収支のカテゴリがすべて一覧にあることを確かめる。なければ category-missing（BR4.2）。
3. computeMonthlySummary に渡し、結果を返す。

### W2 計算する（computeMonthlySummary）

```text
computeMonthlySummary({ month, transactions, categories, budgets }):
  txs = transactions.filter(t => t.date の先頭7文字 == month)           （BR1.1）
  sumByCategory = カテゴリごとの amount の合計（種別が一致するものだけ）
  expenseRows = categories の支出それぞれ:                              （BR2.1、BR3.2）
    actual = sumByCategory[id] ?? 0
    eb = budgets の同じ categoryId（なければ { amount: null, source: none }）（BR2.4）
    remaining = eb.amount == null ? null : eb.amount − actual           （BR2.2）
    over = eb.amount != null && actual > eb.amount                       （BR2.3）
  incomeRows = categories の収入それぞれ: actual = sumByCategory[id] ?? 0 （BR3.1）
  incomeTotal = Σ incomeRows.actual、expenseTotal = Σ expenseRows.actual （BR1.2、BR1.3）
  balance = incomeTotal − expenseTotal
  hasTransactions = txs.length > 0                                       （BR1.4）
```

テキストでの説明: 対象月の収支だけをカテゴリごとに足し、支出カテゴリには予算・残り・超過を、収入カテゴリには実績だけを付ける。合計は行の和として求めるので、カテゴリ別の合計と必ず一致する。

### 例（ストーリーの受け入れ条件）

| 入力 | 結果 | 受け入れ条件 |
|------|------|--------------|
| 給与 250,000、食費 1,200、交通費 3,000 | 収入 250,000、支出 4,200、差額 245,800 | AC5.1.1 |
| 2026-09-30 と 2026-10-01 の収支、month 2026-10 | 10月1日の分だけ | AC5.1.2 |
| 収入 1,000、支出 3,000 | 差額 −2,000 | AC5.1.3 |
| 食費 予算 1,000・実績 1,200 | 残り −200、超過 | AC5.2.1 |
| 交通費 予算なし・実績 3,000 | 予算 null、残り null、超過でない | AC5.2.2 |
| 給与 250,000、副収入 20,000 | 収入の行に両方 | AC5.3.1 |
| 収支なし、食費 予算 30,000 | 合計 0、hasTransactions false、食費 残り 30,000 | AC5.4.1、AC5.4.2 |
| 食費 予算 0・実績 500 | 残り −500、超過 | AC4.3.2 |
| 食費 予算 1,000・実績 1,000 | 残り 0、超過でない | — |

## 3. 失敗

| 失敗 | 結果 |
|------|------|
| U4 の読み取りの失敗・月の検証の失敗・版上げ | U4 の OperationError をそのまま（storage・validation・newer-version） |
| 収支のカテゴリが一覧にない | rule（category-missing） |
| 想定外の例外 | storage（データを読み込めませんでした） |

## 4. テストの観点（コード生成への引き継ぎ）

- テストの順序: U5 は「その他のレイヤー」なので、実装の後にテストを書く（team.md の Ordering）。
- computeMonthlySummary は入力の配列だけでテストする（2章の例の表、0件、カテゴリの並び、他の月の収支を混ぜても数えない、整数のまま）。
- getMonthlySummary は U4 の openBook に U3 の差し替えを渡した Book でテストする（正常、listTransactions・listCategories・getEffectiveBudgets それぞれの失敗、delayMs の間は未完了（読み込み中）、failReads（読み込みの失敗）、カテゴリが一覧にない収支（差し替えた Book で再現））。
- 性能: 要件 NFR3 の件数（収支 5,000 件、カテゴリ 30 件、予算 360 件）で、computeMonthlySummary は十分速いこと（目安は NFR Requirements で決める）。

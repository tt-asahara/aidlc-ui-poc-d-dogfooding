# 安全性と信頼性の設計（monthly-summary）

- 出典: `construction/monthly-summary/nfr-requirements/security-requirements.md`（NFR1.1、NFR5.1、NFR5.2、NFR8.1〜NFR8.3）、`construction/monthly-summary/nfr-requirements/tech-stack-decisions.md`（NFR3.1、NFR3.2、NFR6.1〜NFR6.3、NFR9.1）、`construction/monthly-summary/functional-design/`（rules.md BR1.1〜BR4.2、functional-spec.md W1・W2）、`inception/contract-design/contract-summary.md`（C3、C4）、`inception/domain-design/decisions.md`（ADR-003）、`nfr-design-questions.md`（質問0件）、Functional Design のレビュー（Minor 4件）と NFR Requirements のレビュー（Minor 4件）
- U5 は種類 library。保存・通信をしない計算の部品で、正しい合計を返すことがこの設計の中心である。

## 1. 合計の定義（NFR5.1、FD レビュー Minor）

- incomeTotal は incomeRows の actual の和、expenseTotal は expenseRows の actual の和とする（BR1.3 に一本化。BR1.2 の「収支の金額の合計」は、この和と同じ意味として読む）。
- 行の actual は、対象月の収支のうち、そのカテゴリの id と種別がどちらも一致するものの amount の和。カテゴリや種別が一致しない収支はどの行にも入らず、合計にも入らない。computeMonthlySummary に食い違う入力を直接渡したときもこの定義で計算する（テストで確かめる）。
- 金額は整数の足し算・引き算だけで扱い、最大の合計（5,000 件 × 99,999,999 円）が安全な整数であることをテストで確かめる（NFR5.2）。

## 2. 読み取りと食い違い（NFR8.1、NFR8.2、FD・NFR-R レビュー Minor）

```text
getMonthlySummary(book, month):
  categories   = await book.listCategories()          // 失敗はそのまま返す
  budgets      = await book.getEffectiveBudgets(month)
  transactions = await book.listTransactions(month)   // 月の検証は U4
  if transactions のうち、同じ id かつ同じ種別のカテゴリが categories にないものが1件でもある
    → { kind: rule, violation: { code: category-missing } }
  → ok(computeMonthlySummary({ month, transactions, categories, budgets }))
  想定外の例外 → { kind: storage, message: "データを読み込めませんでした" }
```

- 3回の読み取りは上の順に1つずつ行う（並列にしない）。U4 には3つをまとめて同じ時点で読む操作がないため、読み取りの間に別のタブが書き込むことはありうる。その場合の扱い:
  - 収支のカテゴリが一覧にない・種別が違う → category-missing（一部が抜けた集計を見せない）。種別の不一致も category-missing にまとめる。どちらも画面の対応は「画面を更新してください」で同じになり、U4 の規則上、使われているカテゴリの種別は変わらないため、種別の不一致は実際には削除と作り直しでしか起きないから。
  - 予算だけが食い違う（予算の読み取りの後に別のタブで予算を変えた） → そのまま集計する。表示は次の再読み込みで正しくなり、合計と行の和の一致（FR5.4）は崩れない。
- U7 は、自分の書き込みの後に必ず集計を取り直す（U7 への引き継ぎ）。

## 3. 外部に出さないこと（NFR1.1）

eslint.config.js に `src/monthly-summary/**/*.ts`（`*.test.ts` と `test-fixtures.ts` を除く）向けのブロックを加え、禁止の一覧をこのブロックに書き切る。

| 規則 | 禁止するもの |
|------|--------------|
| no-restricted-globals | fetch、XMLHttpRequest、WebSocket、EventSource、indexedDB、localStorage、sessionStorage、eval |
| no-restricted-properties | navigator.sendBeacon、window・globalThis・self の fetch・XMLHttpRequest・WebSocket・EventSource・indexedDB・localStorage・sessionStorage、document.cookie |
| no-new-func、no-eval | new Function、eval の呼び出し |
| no-restricted-imports | `fake-indexeddb` とその下位、`../storage` とその下位、`../bookkeeping-core/*`・`../data-contract/*` のうち index 以外、`../csv-exchange`・`../ui-kit` |

計算の部品（`src/monthly-summary/compute.ts`）だけには、さらに Date、Math.random、setTimeout、setInterval を禁止する（純粋な関数であることを Lint で守る）。

## 4. 表示の安全（上流 NFR8 との関係、NFR-R レビュー Minor）

- U5 の security-requirements.md の NFR8.1〜NFR8.3 は「誤った集計を見せない・例外を投げない・架空データ」で、上流の NFR8（利用者の入力を表示するときのエスケープ、CSV の数式対策）とは別の内容である。
- U5 はカテゴリ名などの文字列をそのまま返すだけで、HTML を組み立てない。表示時のエスケープは U7 が担当する（U7 への引き継ぎ）。

## 5. テストの設計（NFR3.1、NFR3.2、NFR6.1〜NFR6.3、NFR9.1）

### 5.1 構成

- vitest.config.ts に monthly-summary 用のプロジェクト（名前 `monthly-summary`、環境 node、`src/monthly-summary/**/*.test.ts`）を加え、`src/monthly-summary/**` に行カバレッジ 80% のしきい値を設ける。
- computeMonthlySummary は配列だけでテストする。getMonthlySummary は U4 の openBook に U3 の差し替えを渡した Book と、メソッドを差し替えた Book（食い違い・例外の再現）でテストする。性能は fake-indexeddb の本物の保存で測る。偽のタイマーは使わない。
- 実装の後にテストを書く（U5 は「その他のレイヤー」）。追加の依存はない。

### 5.2 必須のテスト観点

| 観点 | この Unit のテスト |
|------|------------------|
| 入力エラー | 不正な月（U4 の validation をそのまま返す） |
| 空データ | 収支のない月（合計 0、hasTransactions false、予算の残り = 予算）、予算なしのカテゴリ |
| 読み込み中 | 差し替えの delayMs の間は結果が未完了 |
| 保存失敗（読み込みの失敗） | failReads で storage、3つの読み取りそれぞれの失敗 |
| 食い違い | 一覧にないカテゴリ・種別の違う収支で category-missing、computeMonthlySummary 単独では合計に入らない |
| 境界 | 実績 = 予算は超過でない、0 円予算で実績ありは超過、最大の金額 5,000 件の合計が安全な整数 |

### 5.3 性能の確かめ方

測定は node 上の fake-indexeddb で行い、要件 NFR3（Chrome で表示の切り替え 500ms 以内）の代わりの目安とする。250ms は U5 の取得と計算の暫定の割り当てで、本物の IndexedDB と Chrome での合計 500ms は U7 の Build and Test で確かめる（U7 への引き継ぎ）。

| 測るもの | 前提 | 判定 | 合格条件 |
|----------|------|------|----------|
| getMonthlySummary | 収支 5,000 件（12か月に均等）、カテゴリ 30 件、予算 360 件 | 空回し1回の後に5回の中央値 | 250ms 以内 |
| computeMonthlySummary | 同じ件数の配列 | 同上 | 20ms 以内 |

- 性能のテストは `npm run verify` に含める（他の Unit と同じ）。しきい値と測定回数は performance.test.ts の先頭の定数1か所にまとめ、測定値と実行環境を出力に記録する。U4 の実測（一覧＋予算 2.6ms）から見て、しきい値には数十倍の余裕がある。不安定なら Build and Test で記録して原因を調べ、しきい値は緩めない。

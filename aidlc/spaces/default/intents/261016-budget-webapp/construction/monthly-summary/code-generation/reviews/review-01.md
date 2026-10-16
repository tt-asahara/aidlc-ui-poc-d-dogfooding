## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T14:02:08Z
**Iteration:** 1

### 概要

この Unit は ADVISORY の1回だけのレビューです。`npm run verify` は Prettier、ESLint、tsc、Vitest（52 ファイル・640 件）がすべて成功し、src/monthly-summary の行カバレッジは 100%（分岐 92.85%）でした。実装を BR1.1〜BR4.2、security-design 第1〜5章、契約 C4 と突き合わせました。Critical と Major は見つかっていません。人間が把握しておくとよい Minor を2件だけ挙げます。

### 検証内容

- 合計: `incomeTotal` と `expenseTotal` は行の `actual` の和です（BR1.3）。`sumActualByCategory` は id と種別が両方一致する収支だけを足すので、食い違う収支は行にも合計にも入りません。テストもこれを確認しています。
- 月の絞り込みは `date.slice(0, 7) === month` です（BR1.1）。AC5.1.2 のテストが 9/30 と 10/1 の境目を確認しています。
- 予算:
  - `over` は `budget !== null && actual > budget` なので、等しいときは超過になりません。0 円予算の超過も判定され、テストがあります。
  - `remaining` は予算が null のとき null です。
  - 予算は `categoryId` で引き、見つからなければ `{kind: "none"}` になります。
  - 行の順序は `categories` の並びのままです。
- `getMonthlySummary` は categories → budgets → transactions の順に1つずつ読みます。失敗した `Result` は `return categories` のようにそのまま返すので、OperationError は変わりません。
  - 同期 throw と reject はどちらも `try/await` の中で `catch` され、storage「データを読み込めませんでした」になります。
  - id か種別が合わない収支は rule の `category-missing` を返します。
  - 読む順序と、失敗後に次を読まないことはテストで確認されています。
- compute.ts は純粋です。`Date`、`Math.random`、タイマーを使わず、U4 からは `import type` だけです。
- Lint ブロックの順序:
  - compute.ts 用ブロックは monthly-summary 全体のブロックの後ろにあります。
  - フラット設定は同じルール名を後ろのブロックで丸ごと置き換えます。そのため、後ろのブロックに共通の禁止を全部書き切っているのは正しい判断です。
  - `@typescript-eslint/no-restricted-imports` の `allowTypeImports` で、値の import だけが違反になります。
  - lint-config.test.ts は実際に ESLint を実行し、違反数とルール ID を厳密に比較しています。実装が何でも通るテストではありません。
  - 既存ブロック（data-contract、ui-kit、storage、bookkeeping-core、csv-exchange）に変更はなく、弱められていません。
- 契約 C4: `types.ts` の型は contract-summary の C4 と一致しています。
- code-summary.md の報告:
  - 既知の不安定な U1・U3 の lint-config テスト2件は、初回実行での一過性の失敗として書かれています。今回の verify では全件合格で、記述と食い違いはありません。
  - 性能の数値は計測方法とともに書かれており、水増しは見当たりません。
  - オーケストレーターのモデル変更は事実として記録されているだけで、誤報ではありません。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | src/monthly-summary/compute.ts > computeMonthlySummary の hasTransactions | `hasTransactions` は対象月の収支を、食い違うもの（id か種別が不一致）も含めて数えます（`monthTransactions.length > 0`）。合計と行から除外した収支だけが残ると、`hasTransactions` は true なのに合計は 0 になります。BR1.4 は「収支が1件もなければ false で合計は 0」としか定めておらず、この組み合わせは仕様にありません。getMonthlySummary は先に category-missing で失敗するため、公開窓口経由では起きません。compute を単独で使う場合だけ現れます。 | 現状のままでも構いません。ただし compute 単独の挙動として、食い違う収支を `hasTransactions` に含めるか除外するかを rules.md か compute.ts のコメントに一行で書き、必要ならテストを1件足してください。 | New |
| R-02 | Minor | src/monthly-summary/getMonthlySummary.ts と compute.ts > カテゴリ id の種別表 | カテゴリ id が重複した場合の扱いが食い違います。getMonthlySummary の `hasUnknownCategory` は後勝ち（`Map.set` で上書き）、compute の `sumActualByCategory` と予算の表は先勝ちです。U4 が id の一意性を保つため実害はありませんが、前提がコードにもテストにも書かれていません。 | id が一意であることを U4 の前提として一行コメントに残してください。あるいは両方を先勝ちにそろえてください。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| npm run verify | PASS（Prettier、ESLint、tsc、Vitest 52 ファイル・640 件。monthly-summary 行 100%、全体 99.24%） | コード品質、型、テスト、カバレッジの下限（行 80%）をすべて満たしています。 |

### Summary

実装は BR1.1〜BR4.2、security-design、契約 C4 と一致しており、lint の置き換え順序と純粋さの強制も実行テストで裏付けられています。Critical と Major はありません。残るのは compute 単独の `hasTransactions` の意味づけと、カテゴリ id 重複時の扱いの2件の Minor だけです。

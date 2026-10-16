# コード生成の計画（app-screens）

## Summary

- Builds: 画面の一式（React ＋ Vite）。起動（S0-a、S0-b、再試行、アプリ枠）、5つのタブ（収支、月次集計、予算、カテゴリ、CSV）、確認と取り込みのダイアログ（D1、D2、D3）、ビルドの設定、本番ビルドの配布検査（scripts/check-dist.mjs）
- Touches: src/app/ 配下（index.html、vite.config.ts、src/app/vite-env.d.ts を含む）、tsconfig.json（include に vite.config.ts）、package.json（dev、build、preview、Vite の依存）、vitest.config.ts（app 用プロジェクト）、eslint.config.js（src/app と scripts のブロック）、scripts/check-dist.mjs と scripts/check-dist-allowlist.txt、README.md。契約 C1〜C6 は変えない
- Tests: Vitest（jsdom、Testing Library、axe-core）の画面テスト。各画面の入力エラー、空データ、読み込み中、保存失敗、キーボード操作、ダイアログのフォーカス、外部への通信のない検査、axe の違反0件を含む。実装の後にテストを書く

## 前提

- 出典: `construction/app-screens/functional-design/`（entities.md、rules.md BR1.1〜BR10.1、functional-spec.md、Q1 = A）、`construction/app-screens/nfr-requirements/`（security-requirements.md、tech-stack-decisions.md、performance-requirements.md）、`construction/app-screens/nfr-design/`（security-design.md 第1〜8章、performance-design.md 第1〜3章、logical-components.md）、`construction/app-screens/infrastructure-design/`（infrastructure-specification.md、cicd-pipeline.md、monitoring-design.md）、`inception/refined-mockups/mockups.md`、`inception/refined-mockups/interaction-spec.md`、`inception/contract-design/contract-summary.md`（C1〜C6）
- 既存の Unit（U1〜U6）のフォルダは変更しない。共通の設定（package.json、tsconfig.json、vitest.config.ts、eslint.config.js）は、既存の対象と結果を変えずに広げる。
- U7 は画面の層なので、テストは「各部品を実装した後に、その部品のテストを書いて実行する」（Testing Contract の ordering）。
- Vite の版は、vitest 5.0.5 が要求する範囲から選び、正確な版で固定する。追加の後に `npm ls vite` で重複のないことを確かめる（infrastructure-specification 3章）。プラグインは追加しない。JSX は tsconfig の `react-jsx` と Vite の標準の変換で扱う。
- 画面の状態は React の状態だけで持つ。外部の状態管理ライブラリは使わない。
- 画面は U4・U5・U6 の公開窓口（index）だけを使い、U3 の保存は直接使わない。U1・U2 の公開窓口も使ってよい。内部ファイルの import は禁止（security-design 2章）。
- 実ブラウザでの確認（性能、B1〜B5、他ブラウザ、ダウンロード）は Build and Test で行う。この段階の自動テストは jsdom で行い、性能は測らない。
- 先行工程のレビューで受け入れた指摘のうち、この計画で扱うもの:
  - FD（BR7.1）: 読み込みの ImportFileError のうち message を持つもの（malformed、read-failed）は U6 の message をそのまま表示し、message を持たないものだけ画面の文言を使う（Step 8）
  - FD（BR3.4、BR3.5）: D2 の確定の失敗は D2 を閉じてその行の下に理由を出す。not-found と category-type-mismatch は同じ文言（Step 7）
  - FD（BR2.4）: 編集で月が変わっても共有の対象月は移さない（Step 4）
  - FD（BR1.4）: 読み取りに要求の連番を付け、最新の要求だけを反映する。タブの切り替えで編集中の入力を破棄する（Step 3）
  - NFR-D（import の規則）: 画面は公開窓口（index）だけを import する。許可は `../data-contract`、`../ui-kit`、`../bookkeeping-core`、`../monthly-summary`、`../csv-exchange` の index。`../storage` と内部ファイルと fake-indexeddb は禁止（Step 1）
  - NFR-D（外部参照）: 外部への通信、HTML の挿入、eval の禁止（Step 1）
  - NFR-D（計測）: perf.ts は DEV の分岐の中だけに記録する（Step 2）。合否の計測は Build and Test
  - Infra（dist の検査）: scripts/check-dist.mjs と許可リスト（Step 9）。verify には含めない
  - Infra（scripts の lint）: scripts/**/*.mjs に Node.js の globals を許す（Step 1）
  - U2 からの引き継ぎ（B1〜B5）: Build and Test で確認する（code-summary.md に記録）

## Testing Contract

```json
{
  "version": 1,
  "methodology": "custom",
  "source": "team",
  "ordering": "共通データ契約と CSV 変換のレイヤーはテストを先に書いて失敗を確認してから実装し、UI とその他のレイヤーは各レイヤーを実装した後にそのレイヤーのテストを書いて実行します。",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "テストはすべての Bolt における第一級の成果物として扱います。\n\n- **Methodology**: custom\n- **Methodology evidence**: ヒアリング Q3 で混合方式（C）が選ばれました。共通データ契約と CSV 変換は契約を先に固めるためテストを先に書き、画面などの UI は試行錯誤を妨げないよう実装後にテストを書きます。テストを書く時期がレイヤーによって異なるため `custom` とします。\n- **Ordering**: 共通データ契約と CSV 変換のレイヤーはテストを先に書いて失敗を確認してから実装し、UI とその他のレイヤーは各レイヤーを実装した後にそのレイヤーのテストを書いて実行します。\n- カバレッジ下限: 行カバレッジ 80% 以上を満たします。Build and Test はこの下限を検証し、通すために下限を下げることはしません。\n- マージ前検証: lint・型チェック・テスト・カバレッジ（行 80% 下限）を一括で実行するローカルの単一コマンドを、マージ前に必ず実行して成功させ、その結果を記録します。外部の CI サービスは使いません。\n- テスト戦略（量と種類）はアクティブな Test Strategy に従い、上記の下限はそれに追加されるもので、置き換えるものではありません。\n- 必須のテスト観点: 入力エラー、空データ、読み込み中、保存失敗、キーボード操作を、該当する Unit のテストケースとして必ず含めます。\n- テストデータは架空（合成）データのみを使います。\n- テストランナーなどの具体的なツールは、要件・設計段階で決めます。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "custom",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Custom ordering - 共通データ契約と CSV 変換のレイヤーはテストを先に書いて失敗を確認してから実装し、UI とその他のレイヤーは各レイヤーを実装した後にそのレイヤーのテストを書いて実行します。",
      "Implementation and tests - preserve that exact ordering; do not convert it to layer-local TDD.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:a4f8da6d3750cb6bba897769b111a1370b8bff9bc7e34b7710792ac5205c307d",
  "contract_sha256": "sha256:1c07c75b6d0de248631c364db9d51e8021cb0d4ab233dc1c8c5cd03c951c8995"
}
```

## 手順

各手順の「対応」は、その手順が実現するストーリー・受け入れ条件・規則・非機能要件を示す。

### Step 1: 配布の設定と取り決め（U1〜U6 の対象と結果は変えない）

- [x] Vite を vitest 5.0.5 の要求する範囲から選び、正確な版で追加する（`npm install --save-dev --save-exact vite@<版>`）。`npm ls vite` で重複のないことを確かめる。記録は code-summary.md
- [x] `vite.config.ts`（ルートは index.html、出力は dist/、`server.host` と `preview.host` を `127.0.0.1`、外部の参照を入れない）と `index.html`（文字コード UTF-8、言語 ja、起動点 `src/app/main.tsx`）
- [x] `src/app/vite-env.d.ts`（`/// <reference types="vite/client" />` の1行だけ）
- [x] `tsconfig.json` の include に `vite.config.ts` を加える（既存の設定は変えない）
- [x] `package.json` に `dev`、`build`（tsc --noEmit のあとに vite build）、`preview` を加える。`verify` は変えない
- [x] `vitest.config.ts` に app 用プロジェクト（名前 `app`、環境 jsdom、include `src/app/**/*.test.{ts,tsx}`、setupFiles は U2 の `src/ui-kit/test-setup.ts`）と、しきい値 `"src/app/**": { lines: 80 }`
- [x] `eslint.config.js` に2つのブロックを足す。(a) `src/app/**/*.{ts,tsx}`（テストを除く）: 通信・保存先の直接参照の禁止（fetch、XMLHttpRequest、WebSocket、EventSource、navigator.sendBeacon、indexedDB、localStorage、sessionStorage、document.cookie、eval、new Function）、HTML 挿入の禁止（dangerouslySetInnerHTML、innerHTML、outerHTML、insertAdjacentHTML）、import の規則（許可は各 Unit の index と `../ui-kit` の index だけ。`../storage` と内部ファイルと fake-indexeddb は禁止）。(b) `scripts/**/*.mjs`: Node.js の globals（process、console）を許す
- [x] `npx vitest run --project app --passWithNoTests` が動くことを確かめる（結果を code-summary.md に記録）
- [x] 既存のテスト（U1〜U6、640件）が引き続き合格することを確かめる
- 対応: NFR1.1、NFR9.1、NFR6.1、infrastructure-specification 3章、security-design 2章

### Step 2: 文言・計測・状態の型（implement）

- [x] `src/app/messages.ts`（画面だけの文言: 操作の文言、案内、S0-a・S0-b・再試行の文言、「｛行｝行目：」の形式、ファイル全体の理由の固定の文言）
- [x] `src/app/perf.ts`（`if (import.meta.env.DEV) { ... }` の中だけに記録。本番では空）
- [x] `src/app/types.ts`（AppBoot、ScreenId、AsyncView、FormState、Notice、DialogState、ImportView、ExportView。entities.md のとおり）
- [x] テスト（`messages.test.ts`、`perf.test.ts`）: 文言の固定、perf が DEV でだけ記録すること
- 対応: BR1.1、BR7.1、BR8.1、security-design 1章、performance-design 3章

### Step 3: 読み取りの窓口・起動・枠（reads、App、TabNav、MonthNavigator）

- [x] `src/app/reads.ts`（読み取りの要求に連番を付け、最新の要求の結果だけを返す。タブ切り替え時の破棄）
- [x] `src/app/main.tsx` と `src/app/App.tsx`（openBook を1回呼ぶ。unavailable は S0-a、newer-version は S0-b、load-failed は再試行、ready はアプリ枠。任意の操作の newer-version で S0-b に切り替える）
- [x] `src/app/TabNav.tsx`（U2 の Tabs を使う。矢印キーと Home・End）、`src/app/MonthNavigator.tsx`（前月・翌月。2000-01〜2099-12 の外に出ない）、`src/app/appState.ts`（対象月は共有、初期値は今月）
- [x] テスト（`App.test.tsx`、`reads.test.ts`、`TabNav.test.tsx`、`MonthNavigator.test.tsx`）: 起動の4つの状態、S0-a と S0-b の表示でタブを出さないこと、再試行、最新の要求だけの反映（古い結果は捨てる）、月の共有、「本文へ移動」のリンク、矢印キーでのタブ移動、axe の違反0件
- 対応: BR1.2、BR1.4、BR1.6、BR8.4、BR9.1、BR10.1、US1.2、US8.4

### Step 4: 収支画面（TransactionsScreen、TransactionForm、TransactionList、ConfirmDialog）

- [x] `src/app/screens/TransactionForm.tsx`（日付の初期値は今日、種別は支出、カテゴリは種別で絞る。addTransaction と updateTransaction。エラーは U2 の FieldError。保存中は無効。成功で「✓ 登録しました」、カテゴリ・金額・メモを空にし、金額へフォーカス）
- [x] `src/app/screens/TransactionList.tsx`（listTransactions の順のまま。0件は案内と登録への導線。編集、削除。編集で月が変わったら知らせを出し、共有の対象月は変えない）
- [x] `src/app/screens/TransactionsScreen.tsx`（上の2つと D1 を組み合わせる）と、D1 の確認（U2 の Dialog。フォーカスは「キャンセル」、Esc で戻す）
- [x] テスト（`TransactionForm.test.tsx`、`TransactionList.test.tsx`、`TransactionsScreen.test.tsx`）: 登録の成功、入力エラー（最初の項目へフォーカス）、category-missing の文言と入力の保持、保存失敗で入力が残り一覧に加わらないこと、二重送信の防止、空の月、編集、削除の確認とキャンセル、フォーカスの戻り、`<script>` を含むメモが文字として表示されること、キーボードだけでの操作、axe の違反0件
- 対応: US2.1〜US2.5、US9.1〜US9.3、BR2.1〜BR2.5、BR8.3、BR9.2、BR9.3

### Step 5: 月次集計画面（SummaryScreen）

- [x] `src/app/screens/SummaryScreen.tsx`（getMonthlySummary。3つの合計、支出の行（予算の出所、残り、超過の文字記号「▲ 超過」）、収入の行（予算の列なし）、収支がない月の案内、読み込み中と失敗では合計を「—」）
- [x] 数字は 3 桁区切り、差額のマイナスは「−」と「（赤字）」（BR5.1、NFR5.1）
- [x] テスト（`SummaryScreen.test.tsx`）: 2章の例の表（食費の超過、交通費の予算なし、引き継ぎの表示、収入の行、0件の案内）、読み込み中（delayMs）、読み込みの失敗（failReads）で「まだありません」が出ないこと、月の移動で対象が変わること、3桁区切りとマイナスの表示、axe の違反0件
- 対応: US5.1〜US5.4、BR5.1〜BR5.4、BR8.1、BR8.2

### Step 6: 予算画面（BudgetScreen）

- [x] `src/app/screens/BudgetScreen.tsx`（getEffectiveBudgets。行ごとに入力欄と出所（設定済み、引き継ぎ(2026年8月)、予算なし）。setBudget は U4 の検証に任せ、失敗は行の下に出して入力欄へフォーカス。空欄は「設定を外すには［設定を外す］を使ってください」。clearBudget は設定済みの行だけに表示し、成功は「✓ 食費の設定を外しました（…）」）
- [x] テスト（`BudgetScreen.test.tsx`）: 通常の表示、保存の成功、入力エラー（-1、12.5、abc）、空欄の案内、設定を外すの表示の条件、budget-not-set の文言、引き継ぎの表示、0円の保存、保存失敗の入力の保持、読み込み中と失敗、axe の違反0件
- 対応: US4.1〜US4.3、BR4.1〜BR4.3、BR9.3

### Step 7: カテゴリ画面（CategoriesScreen、D2）

- [x] `src/app/screens/CategoriesScreen.tsx`（listCategories の支出と収入の一覧、getCategoryUsage の使用件数。追加（addCategory）、名前変更（renameCategory、Esc で取り消し）、削除の判定（使用中は理由を行の下に、種別の最後の1件は理由を表示、いずれでもなければ D2）。D2 は予算があれば「このカテゴリの予算（N件）も削除されます」（Q1 = A）。確定の失敗は D2 を閉じて行の下に理由。成功は「✓ 娯楽を削除しました」と消した予算の件数）
- [x] category-missing、not-found、category-type-mismatch は同じ文言「選んだカテゴリが見つかりません。画面を更新してください」と [ 画面を更新 ]（BR3.5）
- [x] テスト（`CategoriesScreen.test.tsx`）: 一覧の表示（初期の7件と3件）、追加の重複・空白・21文字、名前変更とキャンセル、使用中の削除の理由、最後の1件の理由、D2 の予算の件数の表示（予算がないときは注意を足さない）、D2 の確定の失敗（行の下に理由）、stale カテゴリの文言、フォーカス、axe の違反0件
- 対応: US3.1〜US3.4、BR3.1〜BR3.5、BR9.2

### Step 8: CSV 画面（CsvScreen、CsvExportPanel、CsvImportPanel、ImportPreviewDialog）

- [x] `src/app/screens/CsvExportPanel.tsx`（exportTransactions。全期間か月。Blob の一時的な URL を保存に使い、1000ms 後に解放。成功の文言。0件は「書き出す収支がないため見出し行のみ出力しました」）
- [x] `src/app/screens/CsvImportPanel.tsx`（parseImportFile。解析中の「ファイルを確認中…」。ImportFileError は message を持つもの（malformed、read-failed）は U6 の message をそのまま表示、message を持たないもの（header-mismatch、empty、too-large、too-many-rows）は画面の固定の文言。empty は「データがありません」で失敗と区別）
- [x] `src/app/screens/ImportPreviewDialog.tsx`（D3。取り込める行と取り込めない行を全件表示（BR7.2）、既存と同じ内容の注記（取り込み対象から外さない）。確定は commitImport。成功は D3 を閉じて「✓ N件を取り込みました」、保存失敗は D3 の中に「取り込めませんでした。1件も追加していません」、import-category-missing は行番号つきの文言で D3 を閉じる、validation は D3 を閉じず行を示す。キャンセルと Esc は保存に触れない。取り込める行が0件なら確定を無効）
- [x] `src/app/screens/CsvScreen.tsx`（上の3つを組み合わせる。フォーカスは成功の後「ファイルを選ぶ」へ戻す）
- [x] テスト（`CsvScreen.test.tsx`、`CsvImportPanel.test.tsx`、`ImportPreviewDialog.test.tsx`、`CsvExportPanel.test.tsx`）: 書き出しの成功と件数、0件の見出し行、Blob の解放（URL の作成と解放の対応）、ファイルの各理由（大きさ、行数、空、見出しの不一致、形の誤り、読めない）の表示、プレビューの行番号、`<script>` を含む raw が文字として表示されること、既存と同じ内容の注記、確定の全件追加、保存失敗で1件も増えないこと、import-category-missing の文言、キャンセルと Esc、フォーカス、axe の違反0件
- 対応: US6.1〜US6.3、US7.1〜US7.4、BR6.1〜BR6.3、BR7.1〜BR7.5、BR9.2、NFR8.2

### Step 9: 横断の検査と配布の検査（scripts）

- [x] `src/app/no-external.test.ts`（`src/app/` の非テストファイルに外部の URL、通信の参照、eval がないこと。U2 と同じ方式）
- [x] `src/app/lint-config.test.ts`（ESLint の Node API。ESLint は beforeAll で1回だけ作る。禁止の一覧が違反になること、公開窓口の import は許可、内部ファイルと `../storage` の import は違反、テストには適用しない）
- [x] `scripts/check-dist.mjs`（Node.js の標準機能だけ。`dist/` の HTML・JS・CSS の外部参照を検査。入力は dist、出力は違反の一覧、違反があれば終了コード 1）と `scripts/check-dist-allowlist.txt`（最初のビルドで見つかった名前空間の識別子とエラー案内 URL だけを、理由の注釈つきで記録）
- [x] `scripts/check-dist.mjs` の単体の確認（違反の検出と許可リストの動作を、架空の HTML と JS の断片で確かめる。テストは `scripts/check-dist.test.mjs`、verify の対象は src だけなので Build and Test で実行する）
- 対応: NFR1.1、NFR2.2、infrastructure-specification 4章、cicd-pipeline 1章

### Step 10: 一括検証と文書

- [x] `npm run verify` を実行し、整形・Lint・型チェック・テスト（U1〜U7）・全体と各 Unit のフォルダの行カバレッジ 80% 以上がすべて通ることを確かめる
- [x] `README.md` に app のフォルダ、起動の方法（dev、build、preview）、テストと配布の検査の方法を追記する
- 対応: NFR6.1、NFR9.1、team.md Testing Posture

## ストーリーとの対応

| ストーリー | 手順 |
|------------|------|
| US1.1 どの画面でも同じ規則で入力が検証される | Step 4、Step 6、Step 7、Step 8 |
| US1.2 入力したデータが次に開いたときも残っている（表示） | Step 3 |
| US1.3 外部へ送られない | Step 1、Step 9 |
| US2.x 収支 | Step 4 |
| US3.x カテゴリ | Step 7 |
| US4.x 予算 | Step 6 |
| US5.x 月次集計 | Step 5 |
| US6.x、US7.x CSV | Step 8 |
| US8.x 状態表示 | Step 3、Step 4、Step 5、Step 8 |
| US9.x キーボードとフォーカス | Step 3、Step 4、Step 7、Step 8 |

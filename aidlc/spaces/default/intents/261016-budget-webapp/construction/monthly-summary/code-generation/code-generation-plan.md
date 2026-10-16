# コード生成の計画（monthly-summary）

## Summary

- Builds: 月次集計（computeMonthlySummary の純粋な計算と、U4 から3回読んで計算に渡す getMonthlySummary）。合計3値、支出カテゴリ別の予算・実績・残り・超過、収入カテゴリ別の実績
- Touches: src/monthly-summary/ 配下、vitest.config.ts・eslint.config.js（追加の依存なし）、README.md（契約 C4 は変えない）
- Tests: Vitest のテスト約40件（受け入れ条件の例の表、境界、空の月、食い違い、読み込みの失敗と読み込み中、最大の金額、性能の目安、Lint の確認）を実装の後に作成

## 前提

- 出典: `construction/monthly-summary/functional-design/`（entities.md、rules.md BR1.1〜BR4.2、functional-spec.md W1・W2）、`construction/monthly-summary/nfr-requirements/`（security-requirements.md、tech-stack-decisions.md）、`construction/monthly-summary/nfr-design/`（security-design.md、logical-components.md）、`construction/monthly-summary/infrastructure-design/cicd-pipeline.md`、`inception/contract-design/contract-summary.md`（C3、C4）、U1 の `src/data-contract/` と U4 の `src/bookkeeping-core/`（公開窓口だけを import する）
- U1〜U4・U6 で作ったプロジェクト共通の設定を、それらの対象と結果を変えずに広げる。既存の src/ 配下の Unit のフォルダは変更しない。
- テストの順序: U5 は「その他のレイヤー」なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract の ordering）。
- 先行工程のレビューで受け入れた指摘のうち、この計画で扱うもの:
  - FD Minor・NFR Design（合計の定義）→ 合計は行の actual の和に一本化する。食い違う入力を computeMonthlySummary に直接渡したときは、合わない収支をどの行にも合計にも入れない（Step 2 でテスト）
  - FD Minor・NFR Design Minor（読み取りの順）→ categories → budgets → transactions の順に1つずつ読む。FD の BR4.1 の並び（transactions → categories → budgets）を意図して入れ替えた理由: カテゴリを先に読むと、収支の側の「一覧にないカテゴリ」を確実に食い違いとして見つけられる（収支を先に読むと、その後に読んだ一覧が新しくなり、削除済みのカテゴリの収支が一覧と合わなくなる場合と区別しにくい）。どの読み取りが失敗しても、その OperationError をそのまま返す（Step 3 でテスト）
  - FD Minor・NFR Design Minor（種別の不一致）→ category-missing にまとめる。U7 は U5 の失敗について category-missing だけを扱えばよい（code-summary.md の引き継ぎに書く）
  - NFR Design Minor・Infra Minor（Lint のブロック）→ eslint.config.js に共通の禁止の定数を作り、monthly-summary 全体のブロックと、その後ろに置く compute.ts 用のブロック（同じ一覧に Date・Math.random・setTimeout・setInterval を足した完全な一覧、U4 からは `import type` だけを許す）の2つで展開する。compute.ts での Date の使用が違反になることもテストする（Step 1・Step 4）
  - NFR-R Minor（上流 NFR8 との関係）→ U5 は文字列をそのまま返し、表示時のエスケープは U7 が行う（code-summary.md の引き継ぎに書く）
  - NFR-R Minor・Infra Minor（性能の判定と記録）→ しきい値と測定回数は performance.test.ts の先頭の定数1か所にまとめ、測定値と実行環境（Node.js のバージョン、OS、CPU）をテストの出力に書き、code-summary.md に写す。本物の IndexedDB と Chrome での 500ms は U7 の Build and Test に引き継ぐ
  - 既知の不安定なテスト（U1・U3 の lint-config）→ この Unit では触らない。U5 の lint-config テストは U4 と同じく ESLint を beforeAll で1回だけ作る

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

### Step 1: 共通設定の拡張と型（既存の Unit の対象と結果は変えない）

- [x] `vitest.config.ts` に monthly-summary 用のプロジェクト（名前 `monthly-summary`、環境 node、`src/monthly-summary/**/*.test.ts`）を加え、しきい値に `"src/monthly-summary/**": { lines: 80 }` を加える
- [x] `eslint.config.js` に、共通の禁止の定数を使って `src/monthly-summary/**/*.ts`（`*.test.ts` と `test-fixtures.ts` を除く）向けのブロックを加え、その後ろに `src/monthly-summary/compute.ts` 向けのブロックを加える（security-design 第3章の一覧＋Date・Math.random・setTimeout・setInterval の禁止、U4 からは `import type` だけを許す）。既存のブロックは変えない
- [x] `src/monthly-summary/types.ts`（C4 の型：ExpenseRow、IncomeRow、MonthlySummary）
- [x] `npx vitest run --project monthly-summary --passWithNoTests` が動くことを確かめる（結果は code-summary.md に記録する）
- [x] 既存のテスト（597件）が引き続き合格することを確かめる
- 対応: NFR1.1、NFR6.1、security-design 第3章・第5.1節

### Step 2: 計算（compute）を実装し、テストを書く

- [x] `src/monthly-summary/compute.ts`（computeMonthlySummary。対象月の絞り込み、id と種別が一致する収支だけの行ごとの合計、予算・残り・超過、収入の行、合計は行の和、差額、hasTransactions。カテゴリの並びを保つ）
- [x] `src/monthly-summary/test-fixtures.ts`（架空のカテゴリ・収支・EffectiveBudget の作り方、U4 の openBook に U3 の createMemoryStorage を渡した Book の作り方、メソッドを差し替えた Book、固定の now・newId）
- [x] `src/monthly-summary/compute.test.ts`（functional-spec.md 2章の例の表の全行、他の月の収支を混ぜても数えない、0件の月、予算なしのカテゴリ、実績 = 予算は超過でない、0円予算で実績ありは超過、カテゴリの並び、合計と行の和の一致、食い違う入力では合わない収支を合計に入れない、最大の金額 99,999,999 円 × 5,000 件の合計が安全な整数）を書いて実行する
- 対応: US5.1〜US5.4（AC5.1.1〜AC5.1.3、AC5.2.1〜AC5.2.3、AC5.3.1、AC5.4.1、AC5.4.2）、BR1.1〜BR3.2、NFR5.1、NFR5.2

### Step 3: 取得（getMonthlySummary）と公開窓口を実装し、テストを書く

- [x] `src/monthly-summary/getMonthlySummary.ts`（categories → budgets → transactions の順に1つずつ読み、失敗はそのまま返す、id か種別が一致しない収支があれば category-missing、想定外の例外は storage「データを読み込めませんでした」）
- [x] `src/monthly-summary/index.ts`（computeMonthlySummary、getMonthlySummary と C4 の型を公開）
- [x] `src/monthly-summary/getMonthlySummary.test.ts`（U3 の差し替えでの正常、不正な月で U4 の validation、failReads で storage、3つの読み取りそれぞれの失敗がそのまま返る、delayMs の間は未完了（読み込み中）、一覧にないカテゴリ・種別の違う収支で category-missing、例外で storage、予算の引き継ぎが U4 の結果のまま行に出る（AC5.1.4 の前月・翌月の取得））と `src/monthly-summary/index.test.ts`（公開窓口から2つの関数が取れる）を書いて実行する
- 対応: BR4.1、BR4.2、NFR8.1、NFR8.2、AC5.1.4

### Step 4: 性能の目安と Lint の確認

- [x] `src/monthly-summary/performance.test.ts`（しきい値と測定回数を先頭の定数にまとめる。fake-indexeddb の本物の保存に収支 5,000 件（12か月に均等）・カテゴリ 30 件・予算 360 件を入れ、getMonthlySummary を空回し1回の後5回の中央値 250ms 以内、computeMonthlySummary を同じ件数の配列で同 20ms 以内。測定値と実行環境を出力に記録）
- [x] `src/monthly-summary/lint-config.test.ts`（ESLint の Node API。ESLint は beforeAll で1回だけ作る。禁止の一覧が違反になる、compute.ts での Date・Math.random・setTimeout の使用が違反になる、compute.ts での U4 の値の import が違反で `import type` は許可、getMonthlySummary.ts での Date は許可、内部ファイルと `../storage` の import が違反、テストのファイルには適用しない）
- [x] 上のテストを実行し、`src/monthly-summary/**` の行カバレッジ 80% 以上を確かめる
- 対応: NFR1.1、NFR3.1、NFR3.2、NFR6.1、NFR6.3

### Step 5: 一括検証と文書

- [x] `npm run verify` を実行し、整形・Lint・型チェック・テスト（既存と U5）・全体と各 Unit のフォルダの行カバレッジ 80% 以上がすべて通ることを確かめる
- [x] `README.md` に monthly-summary のフォルダとテストの方法を追記する
- 対応: NFR6.1、NFR9.1、team.md Testing Posture

## ストーリーとの対応

| ストーリー | 手順 |
|------------|------|
| US5.1 月の収入・支出・差額を見る | Step 2、Step 3 |
| US5.2 カテゴリ別に予算と実績を比べる | Step 2 |
| US5.3 収入のカテゴリ別内訳を見る | Step 2 |
| US5.4 収支のない月を開いても迷わない | Step 2 |

# コード生成の計画（data-contract）

## Summary

- Builds: 共通データ契約（値の検証・正規化、カテゴリ名・予算額の検証、CSV の符号化・復号と数式対策、スキーマ版）と、プロジェクト共通の開発環境（npm run verify）
- Touches: package.json・tsconfig.json・eslint.config.js・vitest.config.ts などの設定一式、src/data-contract/ 配下、contract-summary.md の C1
- Tests: Vitest の単体テスト 約45件（値・カテゴリ名・予算額・CSV 符号化・CSV 復号・数式対策の往復・文言・時間測定・Lint 設定）をテスト先行で作成

## 前提

- 出典: `construction/data-contract/functional-design/`（entities.md、rules.md BR1.1〜BR6.1、functional-spec.md）、`construction/data-contract/nfr-requirements/`（security-requirements.md、tech-stack-decisions.md）、`construction/data-contract/nfr-design/security-design.md`、`inception/contract-design/contract-summary.md`（C1）、`inception/units-generation/unit-of-work.md`（U1）
- 新規プロジェクト（Greenfield）。アプリのコードはワークスペースの直下（`src/`）に置く。
- 道具: TypeScript（strict）、Vitest ＋ @vitest/coverage-v8、ESLint（フラット設定）＋ typescript-eslint、Prettier、Node.js 24・npm（tech-stack-decisions.md）。すべて無償の公開パッケージで、正確なバージョンで固定する。
- テストの順序: この Unit（共通データ契約と CSV 変換）は「テストを先に書いて失敗を確かめてから実装する」（Testing Contract の ordering）。
- テストデータはすべて架空（例: 「架空のランチ」）。
- 先行工程のレビューで受け入れた指摘のうち、この計画で扱うもの:
  - 契約 C1 に CSV 行の検証の入り口がない → `validateCsvRecord` を C1 に追加する（Step 9）
  - `out-of-range-date` の契約への反映 → C1 の `ValidationCode` に追加する（Step 9）
  - 数式対策の対象外（タブ・CR）の前提を検出する値 → 往復テストに「先頭がタブのメモ」を含め、検証で前後空白が除去されることを確かめる（Step 7）
  - Lint の禁止とテストの両立 → 禁止はテストファイル（`*.test.ts`）以外の `src/data-contract/` に適用する（Step 10）

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

### Step 1: プロジェクトの骨組みと設定

- [x] `package.json` を作る（`"private": true`、`"type": "module"`、`"engines": { "node": ">=24 <25" }`、scripts: `format:check`（prettier --check）、`lint`（eslint --max-warnings=0）、`typecheck`（tsc --noEmit）、`test`（vitest run --coverage）、`verify`（前の4つを順に実行し、1つでも失敗したら失敗）
- [x] `.nvmrc`（`24`）、`.npmrc`（`engine-strict=true`、`save-exact=true`）を作る
- [x] `tsconfig.json`（`strict`、`noUncheckedIndexedAccess`、`target` ES2022、`module`/`moduleResolution` は bundler、`lib` に DOM と ES2022、`noEmit`）を作る
- [x] `.prettierrc.json` と `.prettierignore`（`aidlc/`、`.claude/`、`poc-evidence/`、`node_modules/`、`coverage/`、`dist/` を除外）を作る
- [x] `.gitignore` の AI-DLC の区画の外に `node_modules/`、`coverage/`、`dist/` を追記する
- 対応: NFR9.1、NFR6.1、C1、C6

### Step 2: テストの実行環境の準備（最初のテストより前）

- [x] 開発用の依存を正確なバージョンで入れる: `npm install --save-dev typescript vitest @vitest/coverage-v8 eslint @eslint/js typescript-eslint globals prettier`
- [x] `vitest.config.ts` を作る（環境 node、対象 `src/**/*.test.ts`、カバレッジは v8、対象 `src/**/*.ts`（テストを除く）、行カバレッジのしきい値 80）
- [x] この Unit のテストだけを実行するコマンド `npx vitest run src/data-contract` が動くことを、`--passWithNoTests` を付けて確かめる（unit-test-instructions.md に記録）
- 対応: NFR6.1、NFR9.1

### Step 3: 値の検証のテストを先に書く（失敗を確かめる）

- [x] `src/data-contract/values.test.ts` に、BR1.1（日付）、BR1.2（対象月）、BR1.3（金額の正規化と範囲）、BR1.4（メモ）、BR1.5（種別）、BR1.6（必須）、BR1.7（全項目・順序）と、`validateTransactionInput` のテストを書く（functional-spec.md 第6章の境界値を使う。想定外の型も含める）
- [x] `npx vitest run src/data-contract` を実行し、実装がないため失敗することを確かめて記録する
- 対応: US1.1（AC1.1.1、AC1.1.2、AC1.1.4）、BR1.1〜BR1.7、NFR5.1、NFR8.2

### Step 4: 値の検証を実装する（テストを通す）

- [x] `src/data-contract/types.ts`（Result、EntryType、IsoDate、YearMonth、Transaction、TransactionInput、Category、Budget、ValidationError、ValidationCode（`out-of-range-date` を含む）、FieldName）
- [x] `src/data-contract/messages.ts`（規則ごとの固定文言の定数表）
- [x] `src/data-contract/text.ts`（書記素の数え方、前後空白の除去、全角数字・全角カンマの正規化）
- [x] `src/data-contract/values.ts`（日付・対象月・金額・メモ・種別の判定、`validateTransactionInput`、`isValidYearMonth`、`toYearMonth`）
- [x] Step 3 のテストがすべて通ることを確かめる
- 対応: US1.1、BR1.1〜BR1.7、BR6.1、NFR5.1、NFR8.2、NFR8.3

### Step 5: カテゴリ名・予算額のテストを先に書く（失敗を確かめる）

- [x] `src/data-contract/category.test.ts`（BR2.1、BR2.2: 空白のみ、21 文字、「 食費 」・「ＦＯＯＤ」と「food」の重複、種別違いは重複でない、名前変更で自分を除く）
- [x] `src/data-contract/budget.test.ts`（BR3.1: 0、99,999,999、-1、12.5、「abc」、全角）
- [x] 実行して失敗を確かめ、記録する
- 対応: US1.1（AC1.1.3、AC1.1.5）、BR2.1、BR2.2、BR3.1

### Step 6: カテゴリ名・予算額を実装する（テストを通す）

- [x] `src/data-contract/category.ts`（`validateCategoryName`、`normalizeCategoryNameForCompare`）
- [x] `src/data-contract/budget.ts`（`validateBudgetAmount`）
- [x] Step 5 のテストが通ることを確かめる
- 対応: US1.1、BR2.1、BR2.2、BR3.1

### Step 7: CSV の符号化・復号のテストを先に書く（失敗を確かめる）

- [x] `src/data-contract/csv.test.ts`: 見出し（BR4.1）、書き出しの形式（BOM・CRLF・引用、BR4.2）、読み込み（BOM 有無・CRLF/LF・引用内の改行とカンマと重ねたダブルクォート・行番号はレコードの開始行・閉じない引用・完全に空の行、BR4.3）、空の判定（0 バイト・見出しのみ、BR4.4）、`validateCsvRecord`（列の検証・種別「収入」「支出」・カテゴリ名の必須、BR4.7・BR1.6）
- [x] `src/data-contract/formula.test.ts`: BR4.5・BR4.6 と、往復の性質テスト（空文字、`'`、`''`、`'abc`、`'=1`、`''=1`、`=`、`=SUM(A1)`、`+1`、`-1`、`@x`、カンマ・ダブルクォート・LF・CRLF を含む値、200 文字、絵文字・結合文字）。先頭がタブのメモは検証で除去されて保存値がタブで始まらないことも確かめる
- [x] `src/data-contract/csv.perf.test.ts`: 5,000 レコード（1MB 以内）と、1行 1MB の引用付きの値を含む CSV の復号時間（合格 1,000ms 以内、300ms 超は警告を出し、測定値を出力する）
- [x] 実行して失敗を確かめ、記録する
- 対応: US6.2（AC6.2.1〜AC6.2.3）、BR4.1〜BR4.7、NFR3.1、NFR8.1、NFR8.4

### Step 8: CSV の符号化・復号を実装する（テストを通す）

- [x] `src/data-contract/formula.ts`（`escapeFormula`、`unescapeFormula`）
- [x] `src/data-contract/csv.ts`（`CSV_HEADER`、`encodeCsv`、`decodeCsv`（1回走査の状態機械）、`validateCsvRecord`）
- [x] Step 7 のテストが通ることを確かめる
- 対応: US6.2、BR4.1〜BR4.7、NFR3.1、NFR8.1、NFR8.4

### Step 9: 公開窓口と契約の更新

- [x] `src/data-contract/schema.ts`（`SCHEMA_VERSION = 1`）
- [x] `src/data-contract/index.ts`（契約 C1 の型と関数だけを公開する）
- [x] `src/data-contract/index.test.ts`（公開窓口から C1 の全関数・定数が取れること、`SCHEMA_VERSION` が 1 であること）
- [x] `inception/contract-design/contract-summary.md` の C1 を更新する: `ValidationCode` に `out-of-range-date` を追加、`validateCsvRecord(record: CsvRecord): Result<{ date; type; categoryName; amount; memo }, ValidationError[]>` を追加（Contract Design の変更ルール Q4 に従い、文書とテストを同じ変更で更新する）
- 対応: BR5.1、契約 C1、Contract Design のレビューで受け入れた指摘

### Step 10: Lint・整形の設定

- [x] `eslint.config.js`（@eslint/js と typescript-eslint の推奨設定、型情報を使う規則、`src/data-contract/**/*.ts` のうちテストファイル（`*.test.ts`）以外に、security-design.md 第2章の参照禁止（通信・保存・時計・乱数・タイマー・グローバル経由・`node:` 組み込み）を設定）
- [x] `src/data-contract/lint-config.test.ts`: ESLint の API で、禁止した参照（例: `fetch` と `Date`）を含む仮のコードを `src/data-contract/` のファイルとして検査し、違反になることを確かめる（このテストはファイルを書かず、文字列を検査する）
- [x] `npm run format:check` と `npm run lint` が通るよう整える
- 対応: NFR1.1、C6

### Step 11: 一括検証

- [x] `npm run verify` を実行し、整形・Lint・型チェック・テスト・行カバレッジ 80% 以上がすべて通ることを確かめる
- [x] カバレッジの値を code-summary.md に記録する
- 対応: NFR6.1、team.md Testing Posture（マージ前検証）

### Step 12: 文書と対応表

- [x] `README.md` を作る（目的、架空データ専用であること、前提（Node.js 24）、`npm ci`、`npm run verify`、Unit ごとのフォルダ構成）
- [x] 対応表（traceability.json）と code-summary.md、source-manifest.json は計画の外で作る（Step 5 の成果物）
- 対応: NFR9.1、C2

## ストーリーとの対応

| ストーリー | 手順 |
|------------|------|
| US1.1 どの画面でも同じ規則で入力が検証される | Step 3〜6 |
| US6.2 書き出した CSV を表計算ソフトで開いても安全 | Step 7〜8 |
| （関わり）US2.2、US6.1、US7.1、US9.3 の検証規則と文言 | Step 3〜9 |

# コード生成の計画（csv-exchange）

## Summary

- Builds: CSV の書き出し（exportTransactions）、読み込みとプレビュー（parseImportFile）、取り込みの確定（commitImport）。U1 の符号化・検証と U4 の Book をつなぎ、ファイルはブラウザ内だけで扱う
- Touches: src/csv-exchange/ 配下、vitest.config.ts・eslint.config.js（追加の依存なし）、README.md（契約 C5 は変えない）
- Tests: Vitest のテスト約60件（ファイル全体の6つの理由と境界値、行の検証とカテゴリの照合、既存と同じ内容、往復、確定と失敗、例外の変換、性能の目安、Lint の確認）を、部品ごとに先に書いて失敗を確かめてから実装する

## 前提

- 出典: `construction/csv-exchange/functional-design/`（entities.md、rules.md BR1.1〜BR5.2、functional-spec.md W1〜W3、Q1 = A）、`construction/csv-exchange/nfr-requirements/`（security-requirements.md、tech-stack-decisions.md）、`construction/csv-exchange/nfr-design/`（security-design.md、logical-components.md、Q1 = A、Q2 = A）、`construction/csv-exchange/infrastructure-design/cicd-pipeline.md`、`inception/contract-design/contract-summary.md`（C1、C3、C5）、U1 の `src/data-contract/` と U4 の `src/bookkeeping-core/`（公開窓口だけを import する）
- U1〜U4 で作ったプロジェクト共通の設定を、U1〜U4 の対象と結果を変えずに広げる。src/data-contract/・src/ui-kit/・src/storage/・src/bookkeeping-core/ は変更しない。
- テストの順序: U6 は「CSV 変換のレイヤー」なので、各部品のテストを先に書いて実行し、失敗することを確かめてから実装し、再び実行して合格を確かめる（Testing Contract の ordering）。
- 行の検証とカテゴリの照合は、security-design.md 第1章に従う。Functional Design の BR3.3 の最後の文と W2 の手順（検証に失敗した行でも照合する）は、NFR Design の Q1 = A で置き換え済みで、従わない。理由の文言は U1 の ValidationError.message をそのまま使う（Q2 = A）。
- 先行工程のレビューで受け入れた指摘のうち、この計画で扱うもの:
  - FD Minor（ImportFileError の付随値）→ C5 の型どおり（security-design 第2章の表）
  - FD Minor（BR4.2 の「変わった」）→ 名前の変更では取り込みは成功し、プレビューの名前だけが古くなる。消えた場合だけ import-category-missing（Step 6 でテスト）
  - FD Minor・NFR-R Minor（テストの設定）→ Step 1 で vitest.config.ts に csv-exchange 用プロジェクト（node）としきい値を足す
  - NFR-R Minor・NFR Design Minor（Lint の一覧と import の制限）→ Step 1 で U4 と同じ形の禁止の一覧に加え、no-restricted-imports で `fake-indexeddb`、`../storage` とその下位、`../bookkeeping-core/*`・`../data-contract/*` の内部ファイル（index 以外）を禁止する。Lint の禁止が効くことは、U4 と同じく ESLint の Node API でテストする（Infra Minor）
  - NFR-R Minor・NFR Design Minor（例外の変換）→ parseImportFile では、ファイルの読み取り（arrayBuffer・デコード）の例外は read-failed、Book の呼び出しの例外は storage。exportTransactions・commitImport の例外は storage。例外を包む処理は index.ts の共通の関数1つに置く（Step 6）
  - NFR Design Minor（依存図）→ export・commit も messages.ts の文言を使う
  - NFR-R Minor・NFR Design Minor（too-many-rows の最悪の時間）→ `,,,,` の行を 1MB に近づくまで並べた CSV で、空回し1回の後に3回の中央値が 500ms 以内（Step 7）
  - NFR-R Minor・Infra Minor（性能の判定と記録）→ しきい値と測定回数は performance.test.ts の先頭の定数1か所にまとめ、測定値と実行環境（Node.js のバージョン、OS、CPU）を出力に記録する。読み込みからプレビューまで 2 秒の合計の確認は U7 の Build and Test に引き継ぐ（code-summary.md に記録）
  - U4 からの引き継ぎ（importTransactions には U1 の検証を通った行だけを渡す）→ commitImport は validRows だけを渡す

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

各手順の「対応」は、その手順が実現するストーリー・受け入れ条件・規則・非機能要件を示す。テストを先に書く手順では、実装の前の実行で失敗すること（読み込みの失敗を含む）を確かめ、その結果を手順の記録に残す。

### Step 1: 共通設定の拡張と型の骨組み（U1〜U4 の対象と結果は変えない）

- [x] `vitest.config.ts` に csv-exchange 用のプロジェクト（名前 `csv-exchange`、環境 node、`src/csv-exchange/**/*.test.ts`）を加え、しきい値に `"src/csv-exchange/**": { lines: 80 }` を加える
- [x] `eslint.config.js` に `src/csv-exchange/**/*.ts`（`*.test.ts` と `test-fixtures.ts` を除く）向けのブロックを加え、禁止の一覧をこのブロックに書き切る: no-restricted-globals（fetch、XMLHttpRequest、WebSocket、EventSource、indexedDB、localStorage、sessionStorage、eval）、no-restricted-properties（navigator.sendBeacon、window・globalThis・self の fetch・XMLHttpRequest・WebSocket・EventSource・indexedDB・localStorage・sessionStorage、document.cookie）、no-new-func、no-eval、no-restricted-imports（`fake-indexeddb` とその下位、`../storage` とその下位、`../bookkeeping-core/*`・`../data-contract/*` のうち index 以外）
- [x] `src/csv-exchange/types.ts`（C5 の型：ExportResult、ImportFileError、PreviewRow、InvalidRow、ImportPreview）と `src/csv-exchange/messages.ts`（U6 の固定の文言）を作る
- [x] `npx vitest run --project csv-exchange --passWithNoTests` が動くことを確かめる（unit-test-instructions.md に記録）
- [x] 既存の U1〜U4 のテスト（531件）が引き続き合格することを確かめる
- 対応: NFR1.1、NFR6.1、NFR8.3、security-design 第5章・第6.1節

### Step 2: テストの準備

- [x] `src/csv-exchange/test-fixtures.ts`（架空の収支・カテゴリ、U4 の openBook に U3 の createMemoryStorage を渡した Book の作り方、固定の now・newId、CSV の文字列から File を作る関数、arrayBuffer が reject する File、例外を投げる Book の差し替え）
- 対応: NFR8.4、NFR6.3

### Step 3: ファイルの読み取り（fileReader）— テストを先に書く

- [x] `src/csv-exchange/fileReader.test.ts`（1,048,576 バイトは読む・1 バイト超えは too-large で中身を読まない、BOM の有無、UTF-8 として正しくないバイト列は read-failed（UTF-8 の文言）、arrayBuffer の失敗は read-failed（読み込めない文言））を書いて実行し、失敗を確かめる
- [x] `src/csv-exchange/fileReader.ts` を実装し、テストの合格を確かめる
- 対応: BR2.1、BR2.2、NFR4.2、AC7.1.3、AC7.3.3

### Step 4: カテゴリの照合（categoryMatcher）— テストを先に書く

- [x] `src/csv-exchange/categoryMatcher.test.ts`（同じ種別での照合、全角・大文字小文字・前後の空白の違いを吸収、別の種別にだけある・どこにもないの区別、照合結果はアプリ側の現在の名前と id）を書いて実行し、失敗を確かめる
- [x] `src/csv-exchange/categoryMatcher.ts`（U1 の normalizeCategoryNameForCompare をキーにした照合表）を実装し、テストの合格を確かめる
- 対応: BR3.3、FD Q1 = A、AC7.1.2

### Step 5: 書き出し（export）— テストを先に書く

- [x] `src/csv-exchange/export.test.ts`（全期間・月指定のファイル名（today を固定）、日付の古い順、BOM と CRLF、見出しの文字列、0件で headerOnly、数式対策（=SUM(A1)、+1、-1、@x、'=1）、カンマ・ダブルクォート・改行を含むメモ、Book の失敗をそのまま返す、カテゴリを引けない収支で category-missing）を書いて実行し、失敗を確かめる
- [x] `src/csv-exchange/export.ts` を実装し、テストの合格を確かめる
- 対応: US6.1〜US6.3、BR1.1〜BR1.5、AC6.1.1〜AC6.3.1

### Step 6: プレビューと確定（preview、commit、index）— テストを先に書く

- [x] `src/csv-exchange/preview.test.ts`（empty・header-mismatch・malformed、5,000 件は進む・5,001 件は too-many-rows、引用の中の改行を含むレコードは1件、列の数の違い、値の検証の失敗は U1 の文言だけでカテゴリの理由を出さない（Q1 = A）、AC7.1.1 の3件と1件、AC7.1.2 の2行、照合の揺れの吸収、既存と同じ内容の注記と除外しないこと、すべて不正で validRows 0件、raw はファイル上の値（`<script>` を含む値もそのまま）、行番号の昇順、delayMs の間は未完了（読み込み中））を書いて実行し、失敗を確かめる
- [x] `src/csv-exchange/commit.test.ts`（全件追加、0件は U4 を呼ばない、保存失敗（failWrites）で1件も増えない、プレビュー後にカテゴリを消すと import-category-missing（行番号つき）で1件も増えない、名前の変更だけなら取り込みは成功、書き出したファイルを空のアプリに取り込むと同じ内容（AC7.2.4）、数式対策の往復（AC6.2.2・AC6.2.3））を書いて実行し、失敗を確かめる
- [x] `src/csv-exchange/index.test.ts`（公開窓口から3つの関数が取れる、例外の変換：parseImportFile のファイル読み取りの例外は read-failed、Book の呼び出しの例外は storage、exportTransactions・commitImport の例外は storage）を書いて実行し、失敗を確かめる
- [x] `src/csv-exchange/preview.ts`、`src/csv-exchange/commit.ts`、`src/csv-exchange/index.ts`（例外を包む共通の関数を含む）を実装し、テストの合格を確かめる
- 対応: US7.1〜US7.4、BR2.3、BR2.4、BR3.1〜BR3.8、BR4.1〜BR4.3、BR5.2、NFR4.1、NFR4.3、NFR8.2、AC7.1.1〜AC7.4.2

### Step 7: 性能の目安と Lint の確認

- [x] `src/csv-exchange/performance.test.ts`（しきい値と測定回数を先頭の定数にまとめる。parseImportFile 5,000 行・既存 5,000 件・カテゴリ 30 件で空回し1回の後5回の中央値 1,000ms 以内、exportTransactions 5,000 件で同 1,000ms 以内、`,,,,` の行を 1MB に近づくまで並べた CSV で too-many-rows を返すまで空回し1回の後3回の中央値 500ms 以内。測定値と実行環境を出力に記録）
- [x] `src/csv-exchange/lint-config.test.ts`（ESLint の Node API で、禁止の一覧が違反になること、U1・U4 の公開窓口の import は許可、内部ファイルと `../storage` の import は違反、テストのファイルには適用しない。ESLint の初回の読み込みは beforeAll で済ませる）
- [x] 上のテストを実行し、`src/csv-exchange/**` の行カバレッジ 80% 以上を確かめる
- 対応: NFR1.1、NFR3.1、NFR3.2、NFR6.1、NFR6.3

### Step 8: 一括検証と文書

- [x] `npm run verify` を実行し、整形・Lint・型チェック・テスト（U1〜U4、U6）・全体と `src/ui-kit/**`・`src/storage/**`・`src/bookkeeping-core/**`・`src/csv-exchange/**` の行カバレッジ 80% 以上がすべて通ることを確かめる
- [x] `README.md` に csv-exchange のフォルダとテストの方法を追記する
- 対応: NFR6.1、NFR9.1、team.md Testing Posture

## ストーリーとの対応

| ストーリー | 手順 |
|------------|------|
| US6.1 収支を CSV に書き出す | Step 5 |
| US6.2 書き出した CSV を表計算ソフトで開いても安全 | Step 5、Step 6 |
| US6.3 書き出す収支がないときにそれが分かる | Step 5 |
| US7.1 読み込む前に中身を確かめる | Step 3、Step 4、Step 6 |
| US7.2 確かめた行だけを取り込む | Step 6 |
| US7.3 読み込めないファイルの理由が分かる | Step 3、Step 6 |
| US7.4 既にある収支と同じ行に気づく | Step 6 |

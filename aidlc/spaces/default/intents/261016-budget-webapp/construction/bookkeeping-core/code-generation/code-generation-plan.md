# コード生成の計画（bookkeeping-core）

## Summary

- Builds: 家計簿の中核（openBook と Book）。収支・カテゴリ・予算の持ち主3つと、書き込みを U3 の1回の処理にまとめる調整役。初期カテゴリ、予算の引き継ぎの計算、CSV 取り込みの確定、失敗の区別（newer-version を含む）
- Touches: src/bookkeeping-core/ 配下、vitest.config.ts・eslint.config.js（追加の依存なし）、contract-summary.md の C3、README.md
- Tests: Vitest の単体テスト（持ち主ごと・純粋な計算）と Book の結合テスト（U3 の差し替えと fake-indexeddb）、約70件（入力エラー、空データ、読み込み中、保存失敗、規則違反、別のタブ、版上げ、性能の目安）を実装の後に作成

## 前提

- 出典: `construction/bookkeeping-core/functional-design/`（entities.md、rules.md BR1.1〜BR6.4、functional-spec.md W1〜W4、Q1 = A）、`construction/bookkeeping-core/nfr-requirements/`（security-requirements.md、tech-stack-decisions.md）、`construction/bookkeeping-core/nfr-design/`（security-design.md、logical-components.md、Q1 = A）、`construction/bookkeeping-core/infrastructure-design/cicd-pipeline.md`、`inception/contract-design/contract-summary.md`（C1〜C3、C5）、U1 の `src/data-contract/` と U3 の `src/storage/`（公開窓口だけを import する）
- U1〜U3 で作ったプロジェクト共通の設定を、U1〜U3 の対象と結果を変えずに広げる。src/data-contract/・src/ui-kit/・src/storage/ は変更しない。
- テストの順序: U4 は「その他のレイヤー」なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract の ordering）。
- 先行工程のレビューで受け入れた指摘のうち、この計画で扱うもの:
  - FD Minor（削除確認で予算の有無が分からない）→ getCategoryUsage を `{ transactions, budgets }` を返す形に広げる（NFR Design Q1 = A、Step 5）。budgets は「保存されている予算の行数（設定した月の数）」であることを C3 に明記し、getCategoryUsage の budgets と deleteCategory の deletedBudgets が同じ状態で一致することをテストする（NFR Design レビュー Minor、Step 7）
  - FD Minor・NFR Design Minor（件数の数え方）→ 初期カテゴリの0件判定は `getAll("categories")` の全件の長さ、最後の1件の判定は同じ種別に絞った長さ、収支の件数は `count("transactions", "byCategory", id)`、予算の件数は `getAllByIndex("budgets", "byCategory", id)` の長さ（Step 3〜5）
  - FD Minor（月・種別の文言の出どころ）→ `src/bookkeeping-core/messages.ts` に U1 と同じ文言を固定で持ち、U1 の文言と一致することをテストで確かめる（Step 2・Step 7）
  - FD Minor・NFR Design Minor（取り込みの検証エラーの行）→ OperationError の validation に任意の `line?: number` を加える。U6 が検証済みの行だけを渡す前提を C3 に明記する（Step 5・Step 8）
  - NFR-R Major・NFR Design Minor（性能の前提と判定）→ NFR3 と同じ件数（収支 5,000、カテゴリ 30（支出 24・収入 6）、予算 360）で、1回の空回しの後に5回測った中央値で判定する。対象は listTransactions＋getEffectiveBudgets（200ms）と getCategoryUsage（200ms）。取り込み 5,000 行は1回で 3,000ms（Step 7）
  - NFR-R Minor（取り込みの境界値）→ 5,000 行の成功と、最後の行のカテゴリがないときに1件も増えないこと（Step 7）
  - NFR-R Minor（安全でない環境の id）→ `crypto.randomUUID` がなければ `crypto.getRandomValues` で UUID v4 を作る（Step 2）
  - NFR Design Minor（別のタブのテストの作り方）→ 1つのテストの中で fake-indexeddb の IDBFactory と dbName を1組だけ作り、2つの openBook の storage 引数に、同じ組で openStorage を呼ぶ関数を渡す（Step 7）
  - NFR Design Minor（C3 の変更後の型）→ Step 8 の型をそのまま C3 に書き写す
  - Infra Major・Minor（設定の追加が前提）→ Step 1 で vitest.config.ts と eslint.config.js に追加し、Lint の禁止が効くことと対象のパターン（`src/bookkeeping-core/**/*.ts`、`*.test.ts` と `test-fixtures.ts` を除く）をテストで確かめる。時間の判定は余裕のある固定のしきい値と中央値で行い、不安定なら Build and Test で記録して原因を調べる（しきい値は下げない）
  - U3 からの引き継ぎ（newer-version の伝え方）→ OperationError に newer-version を加える（FD Q1 = A、Step 5）。U3 の差し替えには実行中の版上げを起こす指定がないため、版上げのテストは本物（fake-indexeddb）で別のタブから版を上げて行う（Step 7）
  - U3 のレビュー Minor（偽のタイマー）→ 偽のタイマーは使わない

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

### Step 1: 共通設定の拡張（U1〜U3 の対象と結果は変えない）

- [x] `vitest.config.ts` に bookkeeping-core 用のプロジェクト（名前 `bookkeeping-core`、環境 node、`src/bookkeeping-core/**/*.test.ts`）を加え、しきい値に `"src/bookkeeping-core/**": { lines: 80 }` を加える
- [x] `eslint.config.js` に `src/bookkeeping-core/**/*.ts`（`*.test.ts` と `test-fixtures.ts` を除く）向けのブロックを加え、禁止の一覧をこのブロックに書き切る: no-restricted-globals（fetch、XMLHttpRequest、WebSocket、EventSource、indexedDB、localStorage、sessionStorage、eval）、no-restricted-properties（navigator.sendBeacon、window・globalThis・self の fetch・XMLHttpRequest・WebSocket・EventSource・indexedDB・localStorage・sessionStorage、document.cookie）、no-new-func、no-eval、no-restricted-imports（`fake-indexeddb` とその下位のパス）。crypto と Date は禁止しない
- [x] `npx vitest run --project bookkeeping-core --passWithNoTests` が動くことを確かめる（unit-test-instructions.md に記録）
- [x] 既存の U1〜U3 のテスト（417件）が引き続き合格することを確かめる
- 対応: NFR1.1、NFR6.1、NFR8.1、security-design 第7章・第8.1節

### Step 2: 型・文言・id・失敗の置き換えを実装し、テストを書く

- [x] `src/bookkeeping-core/types.ts`（C3 の型。Step 8 の変更後の型）
- [x] `src/bookkeeping-core/messages.ts`（月・種別の検証エラーの文言。security-design 第4章）
- [x] `src/bookkeeping-core/ids.ts`（既定の newId：randomUUID、なければ getRandomValues で UUID v4。既定の now）
- [x] `src/bookkeeping-core/errors.ts`（U3 の失敗と aborted の reason を OperationError に置き換える。想定外の例外は storage）
- [x] `src/bookkeeping-core/ids.test.ts`、`errors.test.ts`、`messages.test.ts`（UUID の形、randomUUID がない場合の代わり、置き換えの表の各行、U1 の文言との一致）を書いて実行する
- 対応: BR6.1、BR6.2、NFR4.3、NFR8.3、security-design 第2・4・6章

### Step 3: カテゴリの持ち主（categoryCatalog）を実装し、テストを書く

- [x] `src/bookkeeping-core/categoryCatalog.ts`（初期カテゴリ10件の定義、0件判定、追加の sortOrder、名前変更、削除の判定の順序（存在 → 使用中 → 同じ種別の最後の1件）、一覧の並び）
- [x] `src/bookkeeping-core/categoryCatalog.test.ts`（初期カテゴリの名前・種別・並び、追加の末尾、全角・大文字小文字の重複、空白・21文字、名前変更で自分自身を除く、削除の3つの拒否と順序、一覧の並び）を書いて実行する
- 対応: US3.1〜US3.4、BR1.2、BR3.1〜BR3.4

### Step 4: 収支と予算の持ち主（ledger、budgetPlanner）を実装し、テストを書く

- [x] `src/bookkeeping-core/ledger.ts`（作成・更新の値の組み立て（id・createdAt・updatedAt）、カテゴリの存在・種別の判定、一覧の並び（新しい順・古い順））
- [x] `src/bookkeeping-core/budgetPlanner.ts`（予算の設定の値、解除の判定、`resolveEffectiveBudgets(categories, budgets, month)`：整数だけ、支出カテゴリだけ、カテゴリの並び順）
- [x] `src/bookkeeping-core/ledger.test.ts`、`budgetPlanner.test.ts`（並びの同じ日付・同じ登録日時、更新で id・createdAt が残る、functional-spec.md 2章の例の表、0円と未設定、後の月の設定は前の月に効かない、AC4.1.3・AC4.2.4）を書いて実行する
- 対応: US4.1〜US4.3、BR2.1〜BR2.5、BR4.1〜BR4.4、NFR5.1

### Step 5: 調整役（openBook と Book）を実装する

- [x] `src/bookkeeping-core/book.ts`:
  - `openBook(options?)`（storage の既定は U3 の openStorage、開く失敗の置き換え、初期カテゴリの作成、途中の失敗で close して load-failed・newer-version）
  - runRead・runWrite（U3 の read・write を1回だけ呼ぶ。work の中では TxContext の操作だけを待ち、now・newId は同期で呼ぶ）
  - 読み取り5種（listTransactions、listAllTransactions、listCategories、getCategoryUsage（収支と予算の件数）、getEffectiveBudgets）。月の検証
  - 書き込み9種（functional-spec.md W3 の表のとおりの保存領域と確認）。importTransactions は全行の再検証（失敗した最初の行を line で返す）→ カテゴリの存在・種別（lines は昇順）→ 全件追加
- [x] `src/bookkeeping-core/index.ts`（openBook、resolveEffectiveBudgets と C3 の型を公開）
- 対応: US3.1〜US4.3、BR1.1〜BR1.3、BR2.1〜BR2.6、BR3.1〜BR3.4、BR4.1〜BR4.3、BR5.1、BR6.1〜BR6.4、NFR4.1〜NFR4.4

### Step 6: 公開窓口の確認

- [x] `src/bookkeeping-core/index.test.ts`（公開窓口から openBook・resolveEffectiveBudgets が取れ、内部の部品は公開しない）を書いて実行する
- 対応: C3

### Step 7: Book の結合テストを書く

- [x] `src/bookkeeping-core/test-fixtures.ts`（架空の収支・カテゴリ・予算、固定の now と newId、差し替えと fake-indexeddb の Book の作り方）
- [x] `src/bookkeeping-core/book.test.ts`（U3 の差し替えで）: 初回10件と2回目、開く失敗の置き換え（failOpen の各種類）、初期カテゴリの作成の失敗、各書き込み操作の正常と規則違反と検証エラー（失敗の後に保存領域が変わらない）、保存失敗（failWrites・failReads）、読み込み中（delayMs）、空の月、日付を別の月に変えた収支の移動、getCategoryUsage の budgets と deleteCategory の deletedBudgets の一致、取り込みの全件追加・検証エラーの行・カテゴリのない行・0行
- [x] `src/bookkeeping-core/book.idb.test.ts`（fake-indexeddb で）: 1組の IDBFactory と dbName を共有する2つの Book で、片方がカテゴリを消した後のもう片方の収支の追加が category-missing（AC3.4.4）、2つの Book が同時に開いても初期カテゴリは10件（AC3.1.2）、別のタブから版を上げた後の操作が newer-version、全書き込み操作が本物の保存でも成功する
- [x] `src/bookkeeping-core/performance.test.ts`（fake-indexeddb、NFR3 の前提件数）: listTransactions＋getEffectiveBudgets の中央値 200ms 以内、getCategoryUsage の中央値 200ms 以内、取り込み 5,000 行 3,000ms 以内、5,000 行目のカテゴリがないと import-category-missing（lines = [5001]）で1件も増えない。測定値を出力に記録する
- [x] `src/bookkeeping-core/lint-config.test.ts`（禁止の一覧が効く、crypto・Date は許可、テストのファイルには適用しない）
- [x] 上のテストを実行し、`src/bookkeeping-core/**` の行カバレッジ 80% 以上を確かめる
- 対応: US3.1〜US4.3（AC3.1.1〜AC4.3.2）、NFR3.1、NFR4.1〜NFR4.4、NFR6.1〜NFR6.3、NFR8.2、team.md の必須のテスト観点（入力エラー、空データ、読み込み中、保存失敗）

### Step 8: 契約の更新

- [x] `inception/contract-design/contract-summary.md` の C3 を更新する（契約の変更ルールに従い文書とコードを同じ変更で更新する）:
  - `export function openBook(options?: { storage?: () => Promise<Result<StorageHandle, StorageOpenError>>; now?: () => Date; newId?: () => string }): Promise<BookOpenResult>;`
  - `export type OperationError = | { kind: "validation"; errors: ValidationError[]; line?: number } | { kind: "rule"; violation: RuleViolation } | { kind: "storage"; message: string } | { kind: "newer-version" };`（line は取り込みの再検証で最初に失敗した行。newer-version は別のタブでの版上げで、画面は開くときの newer-version と同じ表示に切り替える）
  - `getCategoryUsage(): Promise<Result<Record<string, { transactions: number; budgets: number }>, OperationError>>;`（budgets は保存されている予算の行数＝設定した月の数）
  - listCategories の並び（支出の後に収入、各 sortOrder の昇順）、importTransactions は U6 が検証済みの行（C5 の validRows）だけを渡す前提
- 対応: C3

### Step 9: 一括検証と文書

- [x] `npm run verify` を実行し、整形・Lint・型チェック・テスト（U1〜U4）・全体と `src/ui-kit/**`・`src/storage/**`・`src/bookkeeping-core/**` の行カバレッジ 80% 以上がすべて通ることを確かめる
- [x] `README.md` に bookkeeping-core のフォルダとテストの方法（差し替えと fake-indexeddb の使い分け）を追記する
- 対応: NFR6.1、NFR9.1、team.md Testing Posture

## ストーリーとの対応

| ストーリー | 手順 |
|------------|------|
| US3.1 最初から使えるカテゴリが用意されている | Step 3、Step 5、Step 7 |
| US3.2 自分用のカテゴリを追加する | Step 3、Step 5、Step 7 |
| US3.3 カテゴリの名前を変える | Step 3、Step 5、Step 7 |
| US3.4 使わないカテゴリを消す | Step 3、Step 5、Step 7 |
| US4.1 カテゴリ別に月の予算を決める | Step 4、Step 5、Step 7 |
| US4.2 予算を設定していない月にも前の予算が使われる | Step 4、Step 7 |
| US4.3 予算の設定を外す | Step 4、Step 5、Step 7 |
| （関わり）US2.1〜US2.5、US6.1、US7.2、US8.2・US8.3 | Step 4、Step 5、Step 7 |

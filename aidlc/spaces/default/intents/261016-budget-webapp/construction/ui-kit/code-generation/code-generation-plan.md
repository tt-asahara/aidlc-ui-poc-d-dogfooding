# コード生成の計画（ui-kit）

## Summary

- Builds: 画面部品11種（Button、TextField、Select、RadioGroup、FieldError、DataTable、Dialog、StatusPanel、InlineMessage、FileInput、Tabs）とデザイントークン、React 用のテスト環境
- Touches: src/ui-kit/ 配下、tsconfig.json・vitest.config.ts・eslint.config.js・package.json（React と UI テストの依存の追加）、contract-summary.md の C6
- Tests: Vitest ＋ Testing Library の部品テスト 約50件（キーボード操作、フォーカス、読み上げ属性、axe-core の自動検査、コントラスト計算、外部 URL なし）を実装の後に作成

## 前提

- 出典: `construction/ui-kit/functional-design/`（entities.md、rules.md BR1.1〜BR8.3、functional-spec.md）、`construction/ui-kit/nfr-requirements/`（security-requirements.md、tech-stack-decisions.md）、`construction/ui-kit/nfr-design/`（security-design.md、logical-components.md）、`construction/ui-kit/infrastructure-design/cicd-pipeline.md`、`inception/contract-design/contract-summary.md`（C6）、`inception/refined-mockups/`（interaction-spec.md、design-system-mapping.md、accessibility-checklist.md）
- U1 で作ったプロジェクト共通の設定（package.json、tsconfig.json、vitest.config.ts、eslint.config.js、Prettier）を、U1 の対象と結果を変えずに広げる。
- テストの順序: U2 は画面の層なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract の ordering）。
- 先行工程のレビューで受け入れた指摘のうち、この計画で扱うもの:
  - FD の C6 との名前の食い違い → 契約 C6 の名前（`children`、`initialFocusRef`、`returnFocusRef`、`field`、`onClick`、`onChange`、`onEnter`、`legend`、`name`、Select の `error` など）を正とし、設計の差分は「DOM 参照の公開」と「onClose の理由の引数」の追加だけにする（Step 9）
  - Dialog の Esc: `cancel` では既定動作を止め、さらに `close` イベントで open が真のまま閉じられた場合も `onClose("escape")` を呼んで表示と状態を合わせる（Step 6）
  - カバレッジの単位: U2 単独でも行 80% を満たすよう、`src/ui-kit/**` にディレクトリ単位のしきい値（行 80%）を加える。テスト準備ファイルはカバレッジの対象から外す（Step 2）
  - HTML の挿入: `dangerouslySetInnerHTML` に加え、`innerHTML`・`outerHTML`・`insertAdjacentHTML` も Lint で禁止する（Step 2）
  - タイマー: InlineMessage と StatusPanel が画面から外れたときにタイマーを取り消すことをテストで確かめる（Step 8）
  - 実ブラウザ確認（B1〜B5）は U7 の Build and Test で行う（この Unit では jsdom の補いでの確認に留まることを code-summary.md に残す）

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

### Step 1: 依存の追加

- [x] 実行時の依存を正確なバージョンで入れる: `npm install react react-dom`
- [x] 開発用の依存を正確なバージョンで入れる: `npm install --save-dev @types/react @types/react-dom @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom axe-core eslint-plugin-react-hooks`
- 対応: NFR9.1、tech-stack-decisions.md

### Step 2: 共通設定の拡張（U1 の対象と結果は変えない）

- [x] `tsconfig.json` に `"jsx": "react-jsx"` を加える
- [x] `vitest.config.ts` を、U1 用（node、`src/data-contract/**/*.test.ts`）と U2 用（jsdom、`src/ui-kit/**/*.test.{ts,tsx}`、準備ファイル `src/ui-kit/test-setup.ts`）の2つのプロジェクトに分ける。カバレッジの対象を `src/**/*.{ts,tsx}` に広げ、テストファイルと `src/**/test-setup.ts`・`src/**/test-fixtures.ts` を除く。全体の行 80% に加え、`src/ui-kit/**` に行 80% のしきい値を設ける
- [x] `eslint.config.js` に `.tsx` を型情報つきで加え、react-hooks の規則を適用する。`src/ui-kit/**/*.{ts,tsx}`（テストを除く）に、通信・保存の参照禁止（fetch、XMLHttpRequest、WebSocket、EventSource、navigator.sendBeacon、indexedDB、localStorage、sessionStorage）と、`dangerouslySetInnerHTML`・`innerHTML`・`outerHTML`・`insertAdjacentHTML` の禁止を加える
- [x] `npx vitest run src/ui-kit --passWithNoTests` が動くことを確かめる（unit-test-instructions.md に記録）
- [x] 既存の U1 のテスト（212件）が引き続き合格することを確かめる
- 対応: NFR1.1、NFR6.1、NFR8.1、security-design 第2章・第4章

### Step 3: デザイントークンと CSS

- [x] `src/ui-kit/tokens.ts`（色・文字・余白・寸法・画面幅・動きの値の定数）と `src/ui-kit/tokens.css`（同じ値の CSS 変数）、`src/ui-kit/ui-kit.css`（部品の見た目。フォーカスリング 2px＋2px、最小 44px、768px 未満の表のカード表示、`prefers-reduced-motion` で動きを止める）
- 対応: BR1.1、BR1.2、BR2.3、BR4.2、NFR2.4

### Step 4: ボタンと入力欄を実装し、テストを書く

- [x] `src/ui-kit/Button.tsx`（variant、busy・busyLabel、disabled、type、DOM 参照の公開）
- [x] `src/ui-kit/fields.tsx`（TextField、Select、RadioGroup、FieldError。ラベル、必須の「*」と aria-required、error の aria-invalid と aria-describedby、DOM 参照の公開、TextField の onEnter）
- [x] `src/ui-kit/Button.test.tsx`、`src/ui-kit/fields.test.tsx`（Enter・Space で押せる、busy 中は onClick が呼ばれず文言が変わる、ラベルの関連づけ、エラーの関連づけ、ラジオの矢印操作、axe 違反0件）を書いて実行する
- 対応: BR2.1〜BR2.4、BR3.1〜BR3.3、NFR2.1、NFR2.2

### Step 5: 表を実装し、テストを書く

- [x] `src/ui-kit/DataTable.tsx`（caption、列見出し scope=col、右寄せ・tabular-nums、busy の aria-busy、狭い幅のカード表示用の属性）
- [x] `src/ui-kit/DataTable.test.tsx`（見出しと caption、右寄せの列、0件の表示、`<script>` を含む文字列が文字として表示される、axe 違反0件）を書いて実行する
- 対応: BR4.1、BR4.2、NFR8.1

### Step 6: ダイアログを実装し、テストを書く

- [x] `src/ui-kit/Dialog.tsx`（標準 dialog の `showModal`・`close`、開く前のフォーカス要素の記憶、initialFocusRef への初期フォーカス、Tab・Shift+Tab の循環、`cancel` で既定動作を止めて `onClose("escape")`、`close` イベントで open が真のまま閉じられたときも `onClose("escape")` を呼ぶ、閉じたら returnFocusRef または記憶した要素へ戻す、背景クリックでは閉じない、role・aria-modal・aria-labelledby・aria-describedby）
- [x] `src/ui-kit/test-setup.ts`（jest-dom の照合、jsdom に `HTMLDialogElement.prototype.showModal`・`close` の最小限の補い。open 属性の付け外しと背後への inert）
- [x] `src/ui-kit/Dialog.test.tsx`（初期フォーカス、最後の要素で Tab → 最初、最初で Shift+Tab → 最後、Esc（cancel イベント）で onClose("escape")、close イベントでの同期、閉じた後に戻し先へフォーカス（AC9.2.2・AC9.2.3）、戻し先が消えていても例外にならない、背景クリックで閉じない、axe 違反0件）を書いて実行する
- 対応: US9.2（AC9.2.1〜AC9.2.3）、BR5.1〜BR5.6、NFR2.2、NFR7.1

### Step 7: タブとファイル選択を実装し、テストを書く

- [x] `src/ui-kit/Tabs.tsx`（tablist・tab・tabpanel、選択中だけ tabindex=0、左右の矢印・Home・End と回り込み、下線と太字）
- [x] `src/ui-kit/FileInput.tsx`（見えるラベル、accept、選んだ最初のファイルを渡し入力を空に戻す、DOM 参照の公開）
- [x] `src/ui-kit/Tabs.test.tsx`、`src/ui-kit/FileInput.test.tsx`（矢印・Home・End、aria-selected、tabpanel の関連づけ、ファイルの受け渡しと再選択、axe 違反0件）を書いて実行する
- 対応: BR8.1〜BR8.3、BR7.1、NFR2.2

### Step 8: 状態表示と知らせを実装し、テストを書く

- [x] `src/ui-kit/StatusPanel.tsx`（種類ごとの文言と role、slowAfterMs（既定 5,000ms）経過後の追記、kind が変われば追記を消す、外れたらタイマーを取り消す）
- [x] `src/ui-kit/InlineMessage.tsx`（success は aria-live=polite で 5,000ms 後に消え onHidden を呼ぶ、error は role=alert で消えない、外れたらタイマーを取り消す）
- [x] `src/ui-kit/StatusPanel.test.tsx`、`src/ui-kit/InlineMessage.test.tsx`（偽のタイマーで時間を進める、各種類の文言と role、追記、自動非表示、画面から外れた後にタイマーが残らない、axe 違反0件）を書いて実行する
- 対応: BR6.1〜BR6.4、NFR2.3、AC8.1.2 の部品側

### Step 9: 公開窓口・横断のテスト・契約の更新

- [x] `src/ui-kit/index.ts`（C6 の部品と型、tokens を公開）
- [x] `src/ui-kit/index.test.ts`（公開窓口から全部品が取れる）
- [x] `src/ui-kit/no-external.test.ts`（`src/ui-kit/` の CSS・ts・tsx に `url(http`、`url(//`、`@import`、`http://`、`https://` がない）
- [x] `src/ui-kit/tokens.test.ts`（WCAG の相対輝度の式で、文字 4.5:1 以上、枠・フォーカス 3:1 以上を計算して確かめる）
- [x] `inception/contract-design/contract-summary.md` の C6 を更新する: Button・TextField・Select・RadioGroup・FileInput に DOM 参照（ref）を公開、Dialog の `onClose` に理由（`"escape" | "cancel"`）の引数、Tabs に disabled がないことを明記（契約の変更ルール Q4 に従い文書とテストを同じ変更で更新する）
- 対応: C6、NFR1.1、NFR2.4

### Step 10: 一括検証

- [x] `npm run verify` を実行し、整形・Lint・型チェック・テスト（U1 と U2）・全体と `src/ui-kit/**` の行カバレッジ 80% 以上がすべて通ることを確かめる
- 対応: NFR6.1、team.md Testing Posture

### Step 11: 文書

- [x] `README.md` に ui-kit のフォルダと、UI のテスト環境（jsdom、実ブラウザ確認は U7 で行うこと）を追記する
- 対応: NFR9.1

## ストーリーとの対応

| ストーリー | 手順 |
|------------|------|
| US9.2 ダイアログでフォーカスが迷子にならない | Step 6 |
| （関わり）US8.1、US9.1、US9.3、US2.1、US2.2 の部品側の振る舞い | Step 4〜8 |

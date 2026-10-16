# コード生成の計画（storage）

## Summary

- Builds: IndexedDB を包む保存の部品（openStorage）と、同じ窓口のテスト用の差し替え（createMemoryStorage）。put・delete を溜めて work の成功後にまとめて保存する方式（NFR Design Q1 = A）
- Touches: src/storage/ 配下、vitest.config.ts・eslint.config.js・package.json（開発時の依存 fake-indexeddb の追加）、contract-summary.md の C2、README.md
- Tests: Vitest の契約テスト（本物と差し替えに同じものを流す）と本物だけのテスト、約45件（開く・版・読み書き・すべて取り消し・自動確定・利用不可・空データ・読み込み中・保存失敗・性能の目安）を実装の後に作成

## 前提

- 出典: `construction/storage/functional-design/`（entities.md、rules.md BR1.1〜BR5.2、functional-spec.md W1〜W3）、`construction/storage/nfr-requirements/`（security-requirements.md、tech-stack-decisions.md）、`construction/storage/nfr-design/`（security-design.md、logical-components.md、nfr-design-questions.md Q1 = A）、`construction/storage/infrastructure-design/cicd-pipeline.md`、`inception/contract-design/contract-summary.md`（C2）、U1 の `src/data-contract/`（型と SCHEMA_VERSION）
- U1・U2 で作ったプロジェクト共通の設定を、U1・U2 の対象と結果を変えずに広げる。
- テストの順序: U3 は「その他のレイヤー」なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract の ordering）。
- 先行工程のレビューで受け入れた指摘のうち、この計画で扱うもの:
  - FD Major（work が IndexedDB 以外を待つと自動確定）→ まとめて保存の方式で解消（Step 3・Step 4）
  - NFR Design Major（まとめて保存の途中で put が例外を投げたときに abort しない）→ 要求中の例外では、処理がまだ有効なら abort してから write-failed を返す。abort は「確定済みなら何もしない」安全な呼び出しに統一し、work が `{ ok: false }` を返す経路にも使う（Step 4）
  - NFR Design Major（newer-version の found・supported と VersionError）→ C2・BR1.4 のとおり `{ kind: "newer-version"; found; supported }` を返す。開く要求の VersionError を newer-version に対応させ、found は版を指定せずに開き直して `db.version` を読み、すぐ閉じて得る（読めなければ found は不明として supported + 1 ではなく、開き直しの失敗を open-failed にする）（Step 4）
  - NFR Design Minor（差し替えが自動確定を再現しない）→ 差し替えでも、work の実行中に別の周回（タイマー）に進んだら処理を「確定済み」とみなし、その後の TxContext の操作とまとめて保存を write-failed にする。本物と同じ結果になるため、自動確定のテストを契約テストの共通部分に入れる（Step 5）
  - NFR Design Minor（重ね方の順序・複製・早めの失敗）→ キーの比較は IndexedDB の比較と同じ意味の関数（文字列と文字列の配列）を使い、索引の問い合わせは「索引の値、次に主キー」の順に並べる。put は受け取った時点で構造化複製して溜める。指定外の保存領域・work の終了後の操作・複製できない値は、溜めずにその場で失敗にする（Step 3）
  - NFR Design Minor・Infra Minor（ESLint のフラット設定は合成されない）→ storage 用のブロックに禁止の一覧をすべて書き切る。new Function は組み込みの no-new-func で禁止する（Step 2）
  - FD Minor: 妨げで 5 秒たった後に遅れて開けた接続はすぐ閉じる／差し替えの書き込みは1つずつ順に処理する（本物の IndexedDB の読み書きの処理の順序と合わせる）／初期化日時の時計と dbName の既定を引数で差し込む／閉じて開き直した後に同じデータが読める往復テスト（Step 4・Step 5・Step 7）
  - Infra Minor（性能の判定の不安定さ）→ 合格条件はレビューの実測（書き込み約 106ms、読み出し約 3ms）の10倍以上の余裕をとり、測定値をテストの出力に記録する。不安定なら Build and Test で記録して原因を調べ、条件は緩めない（Step 7）
  - Infra Minor（本物のブラウザでの確認の引き継ぎ）→ AC1.2.1（再読み込み後の保持）と保存失敗の表示を、U7 の Build and Test の確認項目として code-summary.md に記録する（Step 9）
  - FD Major（newer-version が C3 の OperationError に伝わらない）→ U3 の範囲外。U4 の Functional Design で決める（code-summary.md に残す）

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

- [x] 開発用の依存を正確なバージョンで入れる: `npm install --save-dev --save-exact fake-indexeddb`（無償の公開パッケージ。package-lock.json に記録）
- 対応: NFR9.1、tech-stack-decisions.md

### Step 2: 共通設定の拡張（U1・U2 の対象と結果は変えない）

- [x] `vitest.config.ts` に storage 用のプロジェクト（名前 `storage`、環境 node、`src/storage/**/*.test.ts`）を加え、しきい値に `"src/storage/**": { lines: 80 }` を加える
- [x] `eslint.config.js` に `src/storage/**/*.ts`（テストを除く）向けのブロックを加え、禁止の一覧をこのブロックに書き切る: no-restricted-globals（fetch、XMLHttpRequest、WebSocket、EventSource、localStorage、sessionStorage、eval）、no-restricted-properties（navigator.sendBeacon、window・globalThis・self の fetch・XMLHttpRequest・WebSocket・EventSource・localStorage・sessionStorage、document.cookie）、no-new-func。indexedDB はこのディレクトリでだけ許可する
- [x] `npx vitest run --project storage --passWithNoTests` が動くことを確かめる（unit-test-instructions.md に記録）
- [x] 既存の U1・U2 のテスト（325件）が引き続き合格することを確かめる
- 対応: NFR1.1、NFR6.1、NFR8.1、security-design 第3章・第4.1節

### Step 3: 保存領域の定義と溜め場所を実装し、テストを書く

- [x] `src/storage/schema.ts`（保存領域 transactions・categories・budgets・meta、キー（budgets は [categoryId, month]）、索引 byMonth（date の先頭7文字を month として持つ）・byCategory、版ごとの移行の関数。初版は作成だけ）
- [x] `src/storage/keys.ts`（IndexedDB と同じ意味のキーの比較: 文字列どうし、文字列の配列どうしを要素ごとに比べる。索引の値の取り出し）
- [x] `src/storage/pending.ts`（保存領域ごとの「書く予定の値」と「消す予定のキー」、同じキーは最後の操作だけ残す、put は受け取った時点で構造化複製、読み取りへの重ね方（get・getAll・getAllByIndex・count、索引の値→主キーの順）、指定外の保存領域・終了後の操作は溜めずに失敗）
- [x] `src/storage/pending.test.ts`、`src/storage/keys.test.ts`（重ね方の各行、同じキーの上書き・削除、配列キーの順序、複製で溜め場所が変わらない、範囲外・終了後の失敗、空の溜め場所）を書いて実行する
- 対応: BR1.2、BR2.3、BR2.4、security-design 第1.3節

### Step 4: 本物の保存（openStorage）を実装する

- [x] `src/storage/errors.ts`（例外の種類の判定: QuotaExceededError → 容量超過、SecurityError・InvalidStateError（開く要求）→ unavailable、VersionError → newer-version、それ以外 → open-failed・read-failed・write-failed）
- [x] `src/storage/idbStorage.ts`:
  - `openStorage(options?: { dbName?: string; indexedDB?: IDBFactory; now?: () => Date; blockedTimeoutMs?: number })`（既定 `budget-webapp`、`globalThis.indexedDB`、実際の時計、5000）
  - 開く（W1）: IndexedDB がない・開く要求が例外・拒否 → unavailable、版の更新で保存領域と meta（initializedAt は now()）を作る、妨げで blockedTimeoutMs を過ぎたら open-failed とし、遅れて成功した接続はすぐ閉じる、VersionError → 版を指定せずに開き直して found を読み newer-version（found、supported = SCHEMA_VERSION）、versionchange で接続を閉じ状態を closed-by-upgrade にする
  - read（W2）: 読み取り専用の処理、状態による失敗、work の例外は read-failed、work の終了後の TxContext の使用は失敗
  - write（W3）: 溜め場所を使い、work が ok ならまとめて要求、要求中の例外は安全な abort の後に write-failed、完了で ok、保存の失敗は write-failed（容量超過は理由を区別）、`{ ok: false }` は安全な abort の後に aborted（reason は work の値）
  - close（状態 closed）
- 対応: US1.2（AC1.2.1〜AC1.2.3）、BR1.1〜BR1.5、BR2.1〜BR2.4、BR3.1、BR3.2、BR4.1、NFR4.1〜NFR4.4、NFR7.1

### Step 5: テスト用の差し替え（createMemoryStorage）を実装する

- [x] `src/storage/memoryStorage.ts`（同じ窓口。溜め場所の部品を共用し、work が成功したら写しに当ててから入れ替える。書き込みは1つずつ順に処理する。work の実行中に別の周回に進んだら確定済みとみなし、その後の操作とまとめて保存を write-failed にする。failOpen・failReads・failWrites・delayMs）
- 対応: BR5.1、BR5.2、NFR4.2

### Step 6: 公開窓口

- [x] `src/storage/index.ts`（openStorage、createMemoryStorage、型 StorageHandle・TxContext・StoreName・RecordOf・KeyOf・MetaRecord・StorageError・StorageOpenError を公開）
- 対応: C2

### Step 7: 本物と差し替えのテストを書く

- [x] `src/storage/contract.ts`（契約テストの本体。本物と差し替えの作り方を受け取る）と `src/storage/contract.test.ts`（本物は fake-indexeddb の新しい IDBFactory とテストごとに別の dbName、差し替えは新しく作る。同じテストを流す）。観点: 正常（書いて読み直す、索引、count、month を返さない）、空データ、すべて取り消し（例外・`{ ok: false }`・2件目の put の失敗で1件目も残らない）、自動確定（setTimeout の後の読み取り・成功の返却・put だけ、すべて write-failed で何も書かれない。microtask の待ちは正常）、閉じた後・範囲外・終了後の使用、書き込みの順序
- [x] `src/storage/idbStorage.test.ts`（本物だけ: 初回の作成と2回目、initializedAt の固定、閉じて開き直した後に同じデータが読める往復、新しい版の newer-version（found・supported）とデータが変わらない、versionchange の後の newer-version、妨げの時間切れと遅れて成功した接続の close、利用不可の判定表（IndexedDB がない・例外・拒否）、容量超過の区別）
- [x] `src/storage/memoryStorage.test.ts`（差し替えだけ: failOpen・failReads・failWrites、delayMs の間は未完了（読み込み中））
- [x] `src/storage/performance.test.ts`（5,000 件の書き込み 2,000ms 以内、1か月分の読み出し 300ms 以内（12か月に均等）・1,000ms 以内（1か月に集中）。測定値を出力に記録）
- [x] 上のテストを実行し、`src/storage/**` の行カバレッジ 80% 以上を確かめる
- 対応: US1.2、AC1.2.1〜AC1.2.3、BR5.2、NFR3.1、NFR4.1〜NFR4.4、NFR6.1、NFR6.2、NFR7.1、NFR8.2、team.md の必須のテスト観点（空データ、読み込み中、保存失敗）

### Step 8: 契約の更新

- [x] `inception/contract-design/contract-summary.md` の C2 を更新する: StorageError に `{ kind: "newer-version" }`、`write<T, E>` と `aborted.reason: E`、`RecordOf`・`KeyOf`・`MetaRecord` の公開、`openStorage` の任意の引数（dbName、indexedDB、now、blockedTimeoutMs）、write の説明に「put・delete は work の成功後にまとめて保存する。work の中で別の周回に進む待ちの後は write-failed（何も書かれない）」を加える（契約の変更ルールに従い文書とコードを同じ変更で更新する）
- 対応: C2

### Step 9: 一括検証と文書

- [x] `npm run verify` を実行し、整形・Lint・型チェック・テスト（U1・U2・U3）・全体と `src/ui-kit/**`・`src/storage/**` の行カバレッジ 80% 以上がすべて通ることを確かめる
- [x] `README.md` に storage のフォルダと、テストで fake-indexeddb を使うこと（本物のブラウザでの確認は U7 の Build and Test で行うこと）を追記する
- [x] code-summary.md に、U7 の Build and Test への引き継ぎ（本物のブラウザで AC1.2.1 の再読み込み後の保持と保存失敗の表示を確かめる）と、U4 の Functional Design への引き継ぎ（newer-version を C3 の OperationError で伝えるか）を書く
- 対応: NFR6.1、NFR9.1、team.md Testing Posture

## ストーリーとの対応

| ストーリー | 手順 |
|------------|------|
| US1.2 入力したデータが次に開いたときも残っている | Step 3〜7 |
| （関わり）US8.2〜US8.4 の失敗の種類の区別 | Step 4・Step 7 |

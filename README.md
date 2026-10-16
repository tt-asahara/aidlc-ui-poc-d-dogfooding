# 家計簿 Web アプリ（budget-webapp）

ローカルで動かして確かめる家計簿の Web アプリです。収入・支出の記録、カテゴリと月ごとの予算、月次の集計、CSV の書き出し・読み込みを扱います。

## 架空データ専用

- このアプリ、テスト、サンプル、CSV の入出力例に使うデータは、すべて架空（合成）のデータです。
- 実在の個人・口座・取引に由来するデータを入れないでください。
- 実在の銀行口座・金融サービスとの連携や、外部のサーバー・サービスへのデータ送信は行いません。

## 前提

- Node.js 24（`.nvmrc` に記載。`npm` の `engine-strict` により、範囲外の版では `npm ci` が失敗します）
- npm（Node.js 24 に同梱のもの）

## はじめかた

```bash
npm ci
npm run verify
```

`npm ci` は `package-lock.json` に固定された版の開発用の道具を取得します。

## マージ前の検証

`npm run verify` は次を順に実行し、1つでも失敗すれば失敗します。マージ前に必ず実行して成功させます。

| 順  | コマンド               | 内容                                                           |
| --- | ---------------------- | -------------------------------------------------------------- |
| 1   | `npm run format:check` | Prettier による整形のチェック                                  |
| 2   | `npm run lint`         | ESLint（警告もエラーとして扱う）                               |
| 3   | `npm run typecheck`    | TypeScript の型チェック（`strict`）                            |
| 4   | `npm run test`         | Vitest のテストとカバレッジ（行カバレッジ 80% 未満で失敗する） |

1つの Unit のテストだけを実行するときは、そのフォルダを指定します（例: `npx vitest run src/data-contract`）。

## フォルダ構成

アプリは1つのパッケージで、Unit ごとに `src/` の下にフォルダを分けます。各 Unit は公開窓口 `src/<unit-name>/index.ts` だけを公開し、ほかの Unit は公開窓口以外を import しません。

| フォルダ                | Unit                                              | 状態     |
| ----------------------- | ------------------------------------------------- | -------- |
| `src/data-contract/`    | U1 共通データ契約（値の検証・CSV の符号化と復号） | 実装済み |
| `src/storage/`          | U3 保存（ブラウザ内の IndexedDB への読み書き）    | 実装済み |
| `src/bookkeeping-core/` | U4 家計簿の中核                                   | 実装済み |
| `src/monthly-summary/`  | U5 月次集計                                       | 実装済み |
| `src/csv-exchange/`     | U6 CSV 入出力                                     | 実装済み |
| `src/ui-kit/`           | U2 画面部品（React の部品とデザイントークン）     | 実装済み |
| `src/app/`              | U7 画面（5つのタブ、起動、ダイアログ、CSV 画面）  | 実装済み |

設定（`tsconfig.json`、`eslint.config.js`、`vitest.config.ts`、`.prettierrc.json`）はプロジェクト共通で、後から加わる Unit にも同じ設定が適用されます。

## 画面部品（`src/ui-kit/`）

- React 19 の部品 11 種（Button、TextField、Select、RadioGroup、FieldError、DataTable、Dialog、StatusPanel、InlineMessage、FileInput、Tabs）と、デザイントークン（`tokens.ts`・`tokens.css`）、部品の見た目（`ui-kit.css`）を持ちます。
- 公開窓口は `src/ui-kit/index.ts` です。見た目は画面の側で `tokens.css` → `ui-kit.css` の順に読み込みます。外部のフォント・アイコン・CSS・画像は読み込みません。
- `src/ui-kit/` の部品（テストを除く）では、通信・保存の API（`fetch`、`localStorage` など）と、HTML の挿入（`dangerouslySetInnerHTML`、`innerHTML` など）を ESLint で禁止しています。

## 保存（`src/storage/`）

- ブラウザ組み込みの IndexedDB に、収支・カテゴリ・予算と保存の版（メタ情報）を保存します。データは利用者のブラウザの中だけにあり、外部へは送りません。
- 公開窓口は `src/storage/index.ts` です。本物の `openStorage` と、同じ窓口を持つテスト用の差し替え `createMemoryStorage` を公開します。家計簿の中核（U4）はこの窓口だけを使い、IndexedDB を直接使いません。
- 書き込みは「すべて成功かすべて取り消し」です。`write` に渡す処理（work）の中の `put`・`delete` はその場では保存せず、work が成功を返した後にまとめて保存します。work の中で TxContext の操作以外（タイマーなど）を待つと、その書き込みは失敗になり、何も保存されません。
- `src/storage/` のコード（テストを除く）では、通信（`fetch` など）・ほかの保存先（`localStorage`、`sessionStorage`、Cookie）・文字列の評価（`eval`、`new Function`）を ESLint で禁止しています。`indexedDB` はこのフォルダでだけ使えます。
- テストでは、IndexedDB の代わりに開発用の依存 [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) をテストごとに新しく用意して使います。本物と差し替えの両方に同じ契約テスト（`src/storage/contract.ts`）を流します。
- fake-indexeddb で通ることは本物のブラウザで通ることの証明ではないため、本物のブラウザでの確認（再読み込みの後もデータが残ること、保存失敗の表示）は U7 の Build and Test で行います。
- 保存のテストだけを実行するときは `npx vitest run --project storage` を使います。

## 家計簿の中核（`src/bookkeeping-core/`）

- 家計簿を開く `openBook` と、開いた家計簿の窓口 `Book`（読み取り5種・書き込み9種）を持ちます。収支・カテゴリ・予算の持ち主（`ledger.ts`・`categoryCatalog.ts`・`budgetPlanner.ts`）は保存に触れない純粋な関数で、調整役の `book.ts` だけが保存（U3）を使います。
- 公開窓口は `src/bookkeeping-core/index.ts` です。`openBook`・その月に使う予算の計算 `resolveEffectiveBudgets` と、契約 C3 の型を公開します。月次集計（U5）・CSV 入出力（U6）・画面（U7）はこの窓口だけを使います。
- 書き込みはすべて U3 の `write` の1回の処理で行い、カテゴリの存在・種別・使用件数・最後の1件の確認は、その処理の中で保存領域から読み直して行います（別のタブでの変更があっても規則が破られません）。失敗しても保存領域は変わりません。
- `Book` の操作は例外を投げず、失敗を `validation`（入力の誤り）・`rule`（規則違反）・`storage`（保存の失敗）・`newer-version`（別のタブでの版上げ）に分けて返します。
- 初回だけ、架空の初期カテゴリ10件（支出7件・収入3件）を作ります。
- `src/bookkeeping-core/` のコード（テストと `test-fixtures.ts` を除く）では、通信（`fetch` など）・保存先の直接の参照（`indexedDB`、`localStorage`、`sessionStorage`、Cookie）・文字列の評価（`eval`、`new Function`）と、`fake-indexeddb` の import を ESLint で禁止しています。id と日時のために `crypto` と `Date` は使えます。
- テストは2種類の保存を使い分けます。
  - 主なテスト（各操作の正常・規則違反・検証エラー、保存失敗、読み込み中）は、U3 の差し替え `createMemoryStorage` を使います。失敗の注入（`failWrites`・`failReads`）と待ち（`delayMs`）で保存失敗と読み込み中を再現します。
  - 別のタブでの操作・実行中の版上げ・性能の目安は、U3 の `openStorage` に fake-indexeddb を差し込んで確かめます（`book.idb.test.ts`、`performance.test.ts`）。別のタブは、1つのテストの中で同じ IDBFactory とデータベース名を2つの `openBook` に渡して再現します。
  - 偽のタイマーは使いません（U3 の差し替えが実際のタイマーで本物の自動確定を再現しているため）。
- 家計簿の中核のテストだけを実行するときは `npx vitest run --project bookkeeping-core` を、性能の測定値を見るときは `npx vitest run --project bookkeeping-core src/bookkeeping-core/performance.test.ts --reporter=verbose` を使います。

## 月次集計（`src/monthly-summary/`）

- 対象月の収入・支出・差額と、支出カテゴリ別の予算・実績・残り・超過、収入カテゴリ別の実績を計算します。データは持たず、保存もしません。表示のたびに計算します。
- 公開窓口は `src/monthly-summary/index.ts` です（契約 C4 の型と2つの関数）。画面（U7）はこの窓口だけを使います。U5 は U1・U4 の公開窓口だけを import し、U3 を直接使いません。
- `computeMonthlySummary` は配列だけを入力にする同期の純粋な関数で、例外を投げません。合計は行の実績の和として求めるため、カテゴリ別の合計と必ず一致します。カテゴリの id と種別が一致しない収支は、どの行にも合計にも入れません。
- `getMonthlySummary` は U4 の `Book` から カテゴリ → 予算 → 収支 の順に1つずつ読んで計算に渡し、例外を投げません。どれかの読み取りが失敗したら、その失敗（`validation`・`storage`・`newer-version`）をそのまま返します。収支のカテゴリが一覧にない（または種別が違う）ときは `rule` の `category-missing` を返し、一部が抜けた集計は返しません。想定外の例外は `storage`「データを読み込めませんでした」にします。
- カテゴリ名などの文字列はそのまま返します。表示時のエスケープと、3桁区切り・「赤字」「超過」などの文字は U7 が行います。
- `src/monthly-summary/` のコード（テストと `test-fixtures.ts` を除く）では、通信（`fetch` など）・保存先の直接の参照（`indexedDB`、`localStorage`、`sessionStorage`、Cookie）・文字列の評価（`eval`、`new Function`）と、`fake-indexeddb`・`../storage`・`../csv-exchange`・`../ui-kit`・U1 と U4 の内部ファイルの import を ESLint で禁止しています。さらに計算の部品 `compute.ts` では、`Date`・`Math.random`・`setTimeout`・`setInterval` を禁止し、U4 からは `import type` だけを許しています。
- テストでは、計算は配列だけ、取得は U4 の `openBook` に U3 の差し替え `createMemoryStorage` を渡した `Book`（と、メソッドを差し替えた `Book`）で確かめます。性能の目安だけ fake-indexeddb の保存を使います。偽のタイマーは使いません。
- 月次集計のテストだけを実行するときは `npx vitest run --project monthly-summary` を、性能の測定値を見るときは `npx vitest run --project monthly-summary src/monthly-summary/performance.test.ts --reporter=verbose` を使います。性能の値は U5 の層の目安で、本物の IndexedDB と Chrome での表示の切り替え 500ms の合計は U7 の Build and Test で確かめます。

## CSV 入出力（`src/csv-exchange/`）

- 収支の CSV への書き出し `exportTransactions`、ファイルの読み込みとプレビュー `parseImportFile`、取り込みの確定 `commitImport` の3つを持ちます。CSV の符号化・復号・1行の検証は U1、収支・カテゴリの取得と一括追加は U4 が行い、U6 はその間をつなぎます。
- 公開窓口は `src/csv-exchange/index.ts` です（契約 C5 の型と3つの関数）。画面（U7）はこの窓口だけを使います。U6 は U1・U4 の公開窓口だけを import し、U3 を直接使いません。
- ファイルはブラウザ内だけで扱います。読み込みは `File` の読み取り、書き出しは `Blob` を返すだけで、ダウンロードの操作は U7 が行います。
- 読み込みは、大きさ（1MB 超えは中身を読まずに断る）→ 文字コード（UTF-8 として厳密に読む）→ CSV の形 → 件数（5,000 件超えは断る）の順にファイル全体を確かめ、通ったら1行ずつ列の数・値・カテゴリを確かめます。値の検証に失敗した行の理由は U1 の文言だけで、カテゴリの照合はしません。
- 3つの操作は例外を投げません。想定外の例外は、読み込みのファイルの読み取りでは `read-failed`、それ以外は `storage` の失敗として返します。
- `src/csv-exchange/` のコード（テストと `test-fixtures.ts` を除く）では、通信（`fetch` など）・保存先の直接の参照（`indexedDB`、`localStorage`、`sessionStorage`、Cookie）・文字列の評価（`eval`、`new Function`）と、`fake-indexeddb`・`../storage`・U1 と U4 の内部ファイルの import を ESLint で禁止しています。
- テストでは、Book を U4 の `openBook` に U3 の差し替え `createMemoryStorage` を渡して作り、`File`・`Blob`・`TextDecoder` は Node.js 24 の組み込みを使います。偽のタイマーは使いません。
- CSV 入出力のテストだけを実行するときは `npx vitest run --project csv-exchange` を、性能の測定値を見るときは `npx vitest run --project csv-exchange src/csv-exchange/performance.test.ts --reporter=verbose` を使います。性能の値は U6 の層の目安で、読み込みからプレビューの表示まで 2 秒の合計は U7 の Build and Test で確かめます。

## 画面（`src/app/`）

- 画面は React 19 と Vite で作ります。入口は `index.html` と `src/app/main.tsx` です。画面の状態は React の状態だけで持ち、保存はしません（保存されるのは U3 の収支・カテゴリ・予算だけです）。
- 起動のときに一度だけ保存を開き（U4 の `openBook`）、結果で次の表示を切り替えます。保存の場所が使えない環境では理由と再読み込みだけを出し、タブは出しません。保存データが新しい版のときも同じく止めて案内します。
- 5つのタブ（収支、月次集計、予算、カテゴリ、CSV）は、矢印キー・Home・End で移動できます。収支・月次集計・予算は、対象月を1つ共有します。
- 画面は U4・U5・U6 と U2 の公開窓口（`index.ts`）だけを使い、U3 の保存や内部のファイルを直接 import しません（ESLint で禁止しています）。
- 外部への通信（`fetch` など）・HTML の挿入（`innerHTML` など）・文字列の評価は禁止しています。利用者の入力や CSV の値は、文字として表示します。
- 起動は次のとおりです。待ち受けは `127.0.0.1` に固定し、外部には公開しません。

```bash
npm run dev       # 開発用のサーバー（ローカル）
npm run build     # 型チェックのあと、dist/ に配布用のファイルを作る
npm run preview   # dist/ をローカルで配信して確かめる
```

- 配布の検査は、`npm run build` の後に次のコマンドで行います。`dist/` の HTML・JavaScript・CSS に外部への参照がないこと、計測の印（`perf:`）が残っていないことを確かめます。違反があれば失敗します。`npm run verify` には含めません（ビルドを含まないため）。

```bash
npm run build
node scripts/check-dist.mjs dist
```

- 許可リストは `scripts/check-dist-allowlist.txt` にあり、名前空間の識別子とエラー案内の URL だけを、理由の注釈つきで記録します。
- 画面のテストだけを実行するときは `npx vitest run --project app` を使います。
- 実ブラウザでの確認（性能の合否、B1〜B5、キーボードだけでの操作、他のブラウザでの手動確認）は Build and Test で行います。jsdom の上のテストは、それらの代わりにはなりません。

## テストの環境

`vitest.config.ts` は Unit ごとにテストの環境を分けています。

| プロジェクト       | 対象                                | 環境  | 準備ファイル               |
| ------------------ | ----------------------------------- | ----- | -------------------------- |
| `data-contract`    | `src/data-contract/**/*.test.ts`    | node  | なし                       |
| `ui-kit`           | `src/ui-kit/**/*.test.{ts,tsx}`     | jsdom | `src/ui-kit/test-setup.ts` |
| `storage`          | `src/storage/**/*.test.ts`          | node  | なし                       |
| `bookkeeping-core` | `src/bookkeeping-core/**/*.test.ts` | node  | なし                       |
| `csv-exchange`     | `src/csv-exchange/**/*.test.ts`     | node  | なし                       |
| `monthly-summary`  | `src/monthly-summary/**/*.test.ts`  | node  | なし                       |
| `app`              | `src/app/**/*.test.{ts,tsx}`        | jsdom | `src/ui-kit/test-setup.ts` |

- 画面部品のテストは jsdom（ブラウザを取得しない模擬の DOM）の上で、Testing Library によるキーボード操作・フォーカス・読み上げ用の属性の確認と、axe-core による自動のアクセシビリティ検査を行います。
- jsdom は標準の `dialog` 要素のモーダル表示（`showModal`・`close`）を持たないため、`test-setup.ts` で最小限に補っています。補いのある環境で通ることは実ブラウザで通ることの証明ではないため、実ブラウザでの確認（ダイアログのフォーカス・Esc・背後の操作不可・コントラスト）は U7 の Build and Test で行います。
- 行カバレッジの下限 80% は、全体と `src/ui-kit/**`・`src/storage/**`・`src/bookkeeping-core/**`・`src/csv-exchange/**`・`src/monthly-summary/**`・`src/app/**` のそれぞれに適用されます。
- 画面部品のテストだけを実行するときは `npx vitest run src/ui-kit` を使います。

`aidlc/` には AI-DLC の作業記録（要件・設計・計画など）があります。

# 安全性と信頼性の設計（bookkeeping-core）

- 出典: `construction/bookkeeping-core/nfr-requirements/security-requirements.md`（NFR1.1、NFR4.1〜NFR4.4、NFR5.1、NFR8.1〜NFR8.3）、`construction/bookkeeping-core/nfr-requirements/tech-stack-decisions.md`（NFR3.1、NFR6.1〜NFR6.3、NFR9.1）、`construction/bookkeeping-core/functional-design/`（rules.md BR1.1〜BR6.4、functional-spec.md W1〜W4）、`inception/contract-design/contract-summary.md`（C2、C3）、`inception/requirements-analysis/requirements.md`（NFR3、FR7.6）、`nfr-design-questions.md`（Q1 = A）、Functional Design のレビュー（Minor 4件）と NFR Requirements のレビュー（Major 1・Minor 4）
- U4 は種類 library。認証・暗号化・通信はない。この設計の中心は、すべての書き込みを U3 の1回の処理に閉じ込め、部品をまたぐ規則をその中で確かめることである。

## 1. 書き込みの組み立て（NFR4.1、NFR4.2、NFR4.4）

- 書き込み操作はすべて共通の関数 `runWrite(stores, work)` を通す。runWrite は U3 の `write` を1回だけ呼び、結果を OperationError に置き換える（2章）。
- work の中では TxContext の操作だけを `await` する。日時（`now()`）と id（`newId()`）は同期で作り、work の中で他の非同期処理を待たない。
- 規則の判定に使う値（カテゴリの存在・種別・件数）は、work の中で保存領域から読み直す。呼び出し元から渡された一覧や件数は使わない。
- 件数の数え方: 収支の件数は `tx.count("transactions", "byCategory", id)`、カテゴリの件数は `tx.getAll("categories")` の長さ、予算の件数は `tx.getAllByIndex("budgets", "byCategory", id)` の長さ（FD レビュー Minor：U3 の count は transactions の byCategory 専用）。

```text
runWrite(stores, work):
  r = await storage.write(stores, work)       // work は { ok:false, error: OperationError } で規則違反を返す
  if r.ok → ok(r.value)
  switch r.error.kind:
    aborted       → r.error.reason            // validation または rule
    newer-version → { kind: newer-version }
    read-failed / write-failed → { kind: storage, message }
  例外（想定外）→ { kind: storage, message: "保存できませんでした" }
```

## 2. 失敗の区別（NFR4.3、BR6.1、BR6.2）

| 失敗の出どころ | OperationError | U7 の扱い |
|----------------|----------------|-----------|
| U1 の検証・U4 の月と種別の検証 | validation | 項目ごとの直し方を表示し、入力を残す |
| work の中の規則違反 | rule | 違反の種類ごとの文言（functional-spec.md 4章） |
| U3 の read-failed・write-failed、想定外の例外 | storage | 保存失敗・再試行、入力を残す |
| U3 の newer-version | newer-version | 開くときと同じ「新しい版」の画面に切り替え、以後の操作を止める |

- 読み取りも同じ置き換えをする（`runRead`）。
- openBook は、BR1.1〜BR1.3 のとおり BookOpenResult に置き換える。

## 3. 削除確認のための使用件数（Q1 = A、AC3.4.2）

- `getCategoryUsage()` の戻り値を `Record<string, { transactions: number; budgets: number }>` に広げる（C3 の変更）。1回の読み取り処理で、全カテゴリについて収支の件数と予算の件数を数える。
- U7 は、支出カテゴリの削除確認で budgets が 1 以上のときだけ「このカテゴリの予算（｛件数｝件）も削除されます」と表示する。transactions が 1 以上なら、削除の操作の前に「｛件数｝件の収支で使われています」と表示する（AC3.4.1）。
- 削除そのものは BR3.4 のとおり処理の中で数え直す（確認の後に別のタブで変わっても規則は守られる）。

## 4. U4 が作る検証エラーの文言（NFR8.3、FD レビュー Minor）

U1 の公開窓口は文言の定数を出していないため、U4 は次の固定の文言を `src/bookkeeping-core/messages.ts` に持つ。文言は U1 の同じ項目の文言と同じにする（U1 の messages.ts と一致することをテストで確かめる。U1 の公開窓口は変えない）。

| field・code | 文言 |
|-------------|------|
| month・invalid-month | 対象月：YYYY-MM の形で 2000-01〜2099-12 を指定してください |
| type・invalid-type | 種別：income（収入）か expense（支出）を指定してください |

## 5. 取り込みの前提（BR5.1、FD レビュー Minor）

- U6 は、U1 の検証を通った行（C5 の validRows）だけを importTransactions に渡す。U4 の再検証は、その前提が崩れたときの安全装置である。
- 再検証に失敗した行があれば、何も追加せず validation を返す。どの行かを伝えるため、ValidationError はそのままに、OperationError の validation に任意の `line?: number`（最初に失敗した行の番号）を加える（C3 の変更）。

## 6. id の生成（NFR Requirements レビュー Minor）

- 既定の newId は `crypto.randomUUID()`。安全でない環境（LAN の IP アドレスから開いたときなど）で関数がない場合は、`crypto.getRandomValues()` で同じ形（UUID v4）の文字列を作る。どちらもない環境は IndexedDB も実質使えないため考えない（openBook の時点で U3 が unavailable を返す）。
- テストでは newId と now を差し込み、結果を固定する。

## 7. 外部に出さないこと（NFR1.1、NFR8.1、NFR8.2）

eslint.config.js に `src/bookkeeping-core/**/*.ts`（テストを除く）向けのブロックを加え、禁止の一覧をこのブロックに書き切る（フラット設定では別のブロックの指定は合成されない）。

| 規則 | 禁止するもの |
|------|--------------|
| no-restricted-globals | fetch、XMLHttpRequest、WebSocket、EventSource、indexedDB、localStorage、sessionStorage、eval |
| no-restricted-properties | navigator.sendBeacon、window・globalThis・self の fetch・XMLHttpRequest・WebSocket・EventSource・indexedDB・localStorage・sessionStorage、document.cookie |
| no-new-func、no-eval | new Function、eval の呼び出し |
| no-restricted-imports | `fake-indexeddb`（テスト以外での使用） |

- crypto と Date は使う（id と日時の既定）。U1 の禁止はそのまま。
- テストデータは架空の名前・金額だけを使う。

## 8. テストの設計（NFR3.1、NFR6.1〜NFR6.3、NFR9.1）

### 8.1 構成

- vitest.config.ts に bookkeeping-core 用のプロジェクト（名前 `bookkeeping-core`、環境 node、`src/bookkeeping-core/**/*.test.ts`）を加え、`src/bookkeeping-core/**` に行カバレッジ 80% のしきい値を設ける。
- 主なテストは U3 の createMemoryStorage で行う。別のタブでの操作（2つの Book）と実行中の版上げは、openStorage（fake-indexeddb の新しい IDBFactory、テストごとに別の dbName）で行う。偽のタイマーは使わない。
- 実装を書いた後にテストを書く（U4 は「その他のレイヤー」）。追加の依存はない。

### 8.2 必須のテスト観点

| 観点 | この Unit のテスト |
|------|------------------|
| 入力エラー | 各書き込み操作の検証エラー（収支の各項目、カテゴリ名の空白・21文字・重複、予算額 -1・12.5・abc、不正な月・種別） |
| 空データ | 収支のない月の一覧、予算のないカテゴリ（none）、初回のカテゴリ10件 |
| 読み込み中 | 差し替えの delayMs の間は結果が未完了 |
| 保存失敗 | failWrites・failReads で storage、失敗の後に保存領域が変わらない |
| 規則違反 | 各 RuleViolation（functional-spec.md 4章の表） |
| 別のタブ | カテゴリを消した後の収支の追加が category-missing（AC3.4.4）、版上げの後の操作が newer-version |

### 8.3 性能の確かめ方（NFR3.1、NFR Requirements レビュー Major・Minor）

前提は NFR3 に合わせる: 架空の収支 5,000 件（12か月に均等）、カテゴリ 30 件（支出 24、収入 6）、予算 360 件（支出 24 件 × 15 か月）。fake-indexeddb 上の値は、U4 の層の大きな遅れを見つけるための目安とし、本物のブラウザでの 500ms の確認は U7 の Build and Test で行う。

| 測るもの | 判定 | 合格条件 |
|----------|------|----------|
| listTransactions（1か月分）＋ getEffectiveBudgets | 1回の空回しの後に5回測り、中央値 | 200ms 以内 |
| importTransactions 5,000 行（FR7.6 の上限） | 1回測る | 3,000ms 以内 |
| importTransactions 5,000 行で最後の行のカテゴリがない | 結果 | import-category-missing（lines = [5001]）で、収支は1件も増えない |

- 測定値はテストの出力に記録する。合格条件は実測の数倍の余裕をとる。不安定なら Build and Test で記録して原因を調べ、条件は緩めない。

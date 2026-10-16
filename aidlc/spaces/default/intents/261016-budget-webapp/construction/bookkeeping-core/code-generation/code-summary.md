# コード生成のまとめ（bookkeeping-core）

## 作成・変更したファイル

| 区分 | ファイル |
|------|----------|
| 実装（新規） | src/bookkeeping-core/ の types.ts、messages.ts、ids.ts、errors.ts、categoryCatalog.ts、ledger.ts、budgetPlanner.ts、book.ts、index.ts |
| テスト（新規） | src/bookkeeping-core/ の ids.test.ts、errors.test.ts、messages.test.ts、categoryCatalog.test.ts、ledger.test.ts、budgetPlanner.test.ts、index.test.ts、book.test.ts、book.idb.test.ts、performance.test.ts、lint-config.test.ts、test-fixtures.ts（テスト専用） |
| 共通設定（変更） | vitest.config.ts（bookkeeping-core 用プロジェクト、環境 node、`src/bookkeeping-core/**` に行 80%）、eslint.config.js（bookkeeping-core 用のブロックに禁止の一覧を書き切り。テストと test-fixtures.ts は対象外）、README.md |
| 設計文書（契約の更新） | inception/contract-design/contract-summary.md の C3 |

- src/data-contract/・src/ui-kit/・src/storage/ は変更していない。追加の依存はない。

## テストとカバレッジ

- `npm run verify`: 成功（終了コード 0）。開発担当の最終実行と、オーケストレーター側の再実行の両方で、39 ファイル・531 件（U1〜U3 417 件、U4 114 件）がすべて合格した。
- 行カバレッジ: 全体 99.14%、src/ui-kit/** 100%、src/storage/** 98.18%、src/bookkeeping-core/** 100%（文 99.67%、分岐 97.84%）。しきい値は下げていない。
- テストの順序: U4 は「その他のレイヤー」なので、各部品を実装した後にテストを書いた（Testing Contract）。
- 必須のテスト観点: 入力エラー（各書き込みの検証エラー、不正な月・種別）、空データ（収支のない月、予算なし、初回のカテゴリ）、読み込み中（delayMs）、保存失敗（failWrites・failReads と、失敗の後に保存領域が変わらないこと）。キーボード操作は画面のない U4 には該当しない。
- 性能の目安（fake-indexeddb 上、NFR3 の件数：収支 5,000・カテゴリ 30・予算 360。`npx vitest run --project bookkeeping-core src/bookkeeping-core/performance.test.ts --reporter=verbose`）:

| 測ったもの | 判定 | 測定値 | 合格条件 |
|------------|------|--------|----------|
| listTransactions＋getEffectiveBudgets | 空回し1回の後、5回の中央値 | 2.6ms | 200ms 以内 |
| getCategoryUsage | 同上 | 約 28ms | 200ms 以内 |
| 取り込み 5,000 行 | 1回 | 約 131ms | 3,000ms 以内 |
| 5,000 行目のカテゴリがない取り込み | 結果 | import-category-missing（lines = [5001]）、1件も増えない | — |

## 主な実装上の判断

- 保存（U3）を使うのは book.ts だけ。3つの持ち主（ledger・categoryCatalog・budgetPlanner）は純粋な関数で、互いに依存しない（ADR-002）。U1・U3 は公開窓口の index.ts だけから import する。
- 書き込みはすべて runWrite を通り、U3 の write を1回だけ呼ぶ。work の中で待つのは TxContext の操作だけで、now()・newId() は同期で呼ぶ。
- 件数の数え方は計画どおり（収支は count、予算は getAllByIndex の長さ、カテゴリは getAll の長さを種別で絞る）。
- Book の操作はすべて包んで例外を投げない。想定外の例外は、書き込みでは「保存できませんでした」、読み取りでは「データを読み込めませんでした」の storage にする。
- 取り込みは 0 行なら保存に触れず `{ added: 0 }`。1回の取り込みの日時は1つにそろえる。
- 保存失敗のテストでは、開いた後に失敗の注入を切り替えられる差し替え（test-fixtures.ts の switchableStorage）を使う。失敗の値は U3 の差し替えそのものが返す。

## 計画との違い

| 違い | 理由 |
|------|------|
| test-fixtures.ts を Step 3 で先に作成 | 部品のテストで共通のデータを使うため（チェックは Step 7） |
| 読み取りの想定外の例外の文言「データを読み込めませんでした」 | 設計には書き込みの文言しかなかったため、FR8.2 の文言に合わせた |
| 文字列でない id・categoryId は not-found・category-missing・budget-not-set を返す | 保存の失敗ではなく規則違反として扱うのが利用者に正しいため |
| C3 に resolveEffectiveBudgets の宣言、CategoryUsage・OpenBookOptions の型名を追記 | 公開窓口に出している名前を契約にそろえるため |
| messages.test.ts だけが U1 の内部ファイル messages.ts を import | U1 の文言と一致することを確かめるため（security-design 第4章の指定。アプリのコードは公開窓口だけ） |
| lint-config.test.ts で ESLint の初回の読み込みを beforeAll（待ち時間 60 秒）で済ませる | 初回の読み込みが 8.2 秒かかり、既定の 5 秒の待ち時間を超えたため。判定の内容は変えていない |

## 引き継ぎ

- **U5〜U7 へ**: 更新した C3 に従う（OperationError の newer-version と validation の line、getCategoryUsage の `{ transactions, budgets }`、listCategories の並び）。U7 は newer-version で「新しい版」の画面に切り替え、削除確認では budgets が 1 以上のときだけ予算の削除を知らせる（budgets は設定した月の数）。
- **U6 へ**: importTransactions には U1 の検証を通った行だけを渡す。
- **Build and Test へ**: 本物のブラウザで、画面の切り替え 500ms（NFR3）と別のタブでの操作の表示を確かめる。

## 残る課題

- 不安定なテスト: 作業前の初回実行で、U1〜U3 の 417 件中 2 件が一度だけ失敗した（再現なし）。U4 での調査から、ESLint を使う lint-config テストの初回の読み込みが既定の 5 秒の待ち時間を超えることが原因と推測される。U4 では対処したが、U1〜U3 の lint-config テストは同じ書き方のまま（変更禁止の範囲のため）。U2・U3 で見えた揺れと同じものの可能性が高く、Build and Test で原因を確かめる。

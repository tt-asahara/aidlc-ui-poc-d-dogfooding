# ストーリーと Unit の対応表

- 出典: `inception/user-stories/stories.md`（US1.1〜US9.3、33件）、`unit-of-work.md`
- 「担当 Unit」は、そのストーリーの受け入れ条件を完了させる Unit。「関わる Unit」は、担当 Unit が使う下位の Unit で、そのストーリーの一部（規則・保存・部品）を受け持つ。

## 1. 対応表

| ストーリー | 内容 | 担当 Unit | Directory | 関わる Unit |
|------------|------|-----------|-----------|-------------|
| US1.1 | どの画面でも同じ規則で入力が検証される | U1 | u1-data-contract | — |
| US1.2 | 入力したデータが次に開いたときも残っている | U3 | u3-storage | U1 |
| US1.3 | 自分のデータが外部へ送られない | U7 | u7-app-screens | U2、U3、U6 |
| US2.1 | 収支を1件登録する | U7 | u7-app-screens | U4、U2 |
| US2.2 | 入力を誤ったときに直し方が分かる | U7 | u7-app-screens | U1、U2 |
| US2.3 | 月ごとの収支一覧を見る | U7 | u7-app-screens | U4 |
| US2.4 | 登録した収支を直す | U7 | u7-app-screens | U4 |
| US2.5 | 不要な収支を消す | U7 | u7-app-screens | U4、U2 |
| US3.1 | 最初から使えるカテゴリが用意されている | U4 | u4-bookkeeping-core | U3 |
| US3.2 | 自分用のカテゴリを追加する | U4 | u4-bookkeeping-core | U1、U7 |
| US3.3 | カテゴリの名前を変える | U4 | u4-bookkeeping-core | U1、U7 |
| US3.4 | 使わないカテゴリを消す | U4 | u4-bookkeeping-core | U3、U7 |
| US4.1 | カテゴリ別に月の予算を決める | U4 | u4-bookkeeping-core | U1、U7 |
| US4.2 | 予算を設定していない月にも前の予算が使われる | U4 | u4-bookkeeping-core | — |
| US4.3 | 予算の設定を外す | U4 | u4-bookkeeping-core | U7 |
| US5.1 | 月の収入・支出・差額を見る | U5 | u5-monthly-summary | U4、U7 |
| US5.2 | カテゴリ別に予算と実績を比べる | U5 | u5-monthly-summary | U4、U7 |
| US5.3 | 収入のカテゴリ別内訳を見る | U5 | u5-monthly-summary | U7 |
| US5.4 | 収支のない月を開いても迷わない | U5 | u5-monthly-summary | U7 |
| US6.1 | 収支を CSV に書き出す | U6 | u6-csv-exchange | U1、U7 |
| US6.2 | 書き出した CSV を表計算ソフトで開いても安全 | U1 | u1-data-contract | U6 |
| US6.3 | 書き出す収支がないときにそれが分かる | U6 | u6-csv-exchange | U7 |
| US7.1 | 読み込む前に中身を確かめる | U6 | u6-csv-exchange | U1、U7 |
| US7.2 | 確かめた行だけを取り込む | U6 | u6-csv-exchange | U4、U3、U7 |
| US7.3 | 読み込めないファイルの理由が分かる | U6 | u6-csv-exchange | U7 |
| US7.4 | 既にある収支と同じ行に気づく | U6 | u6-csv-exchange | U4、U7 |
| US8.1 | 読み込み中であることが分かる | U7 | u7-app-screens | U2 |
| US8.2 | 読み込みに失敗したら再試行できる | U7 | u7-app-screens | U3、U2 |
| US8.3 | 保存に失敗しても入力が失われない | U7 | u7-app-screens | U4、U3 |
| US8.4 | データを保存できない環境ではそれが分かる | U7 | u7-app-screens | U3 |
| US9.1 | すべての操作をキーボードだけで行う | U7 | u7-app-screens | U2 |
| US9.2 | ダイアログでフォーカスが迷子にならない | U2 | u2-ui-kit | U7 |
| US9.3 | 入力エラーの項目へすぐ移れる | U7 | u7-app-screens | U2、U1 |

## 2. 複数の Unit にまたがる関心

| 関心 | 担当の考え方 | 関わる Unit |
|------|--------------|-------------|
| 外部送信なし（NFR1、US1.3） | 各 Unit はネットワークを使わない。アプリ全体の確認（外部要求0件）は U7 の画面操作テストとビルド成果物の検査で行う | U2、U3、U6、U7 |
| 状態表示（FR8、US8.1〜US8.4） | 失敗の種類は U3 が区別し、U4 が操作結果として返し、U2 の StatusPanel・InlineMessage で U7 が表示する | U2、U3、U4、U7 |
| キーボード操作（FR9、US9.1〜US9.3） | 部品単位の振る舞いは U2、画面全体の流れは U7 | U2、U7 |
| 検証の文言（FR1.4、US1.1、US2.2） | 規則と文言は U1、表示は U7、CSV の不正行の理由は U6 | U1、U6、U7 |
| 別タブでの同時操作（AC3.4.4、D2 の再確認） | 書き込み処理の中での再確認は U4、表示は U7 | U3、U4、U7 |

## 3. Unit 内での実装の順序

| Unit | Unit 内の順序 |
|------|---------------|
| U1 | 値オブジェクトの検証（日付・月・金額・メモ・名前）→ エンティティの検証 → CSV の符号化・復号 → スキーマ版。各段階でテストを先に書く（team.md Testing Posture） |
| U2 | デザイントークン → 基本部品（Button、TextField、RadioGroup、Select、FieldError、InlineMessage）→ DataTable、StatusPanel、FileInput → Tabs、Dialog |
| U3 | データベースの開始と版の確認 → 保存領域と読み書き → 1回の書き込み処理 → 失敗の種類の区別 → テスト用の差し替え |
| U4 | CategoryCatalog（初期カテゴリを含む）→ Ledger → BudgetPlanner（引き継ぎ）→ BookkeepingService（部品間の規則） |
| U5 | 合計3値 → 支出カテゴリ別の行（予算の出所つき）→ 収入カテゴリ別 → 収支がない月 |
| U6 | 書き出し → 読み込みの上限確認と見出しの確認 → 行の検証とプレビュー作成 → 確定時の一括追加の依頼 |
| U7 | アプリ枠と起動時の状態 → 収支画面 → カテゴリ画面 → 予算画面 → 月次集計画面 → CSV 画面 |

## 4. 割り当ての確認

- 33件のストーリーすべてに担当 Unit が1つずつある（未割り当て0件）。
- すべての Unit に担当ストーリーがある: U1（2件）、U2（1件）、U3（1件）、U4（7件）、U5（4件）、U6（6件）、U7（12件）。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1

### 概要

7 Unit・12 本の依存はすべて C1〜C6 のいずれかに対応しており、循環はありません。Q1（起動状態は U4 の openBook が返す）により U7→U3 を増やさない設計は整合しています。失敗の種類は FR8.1〜FR8.5、FR3.4/AC3.4.4（category-missing）、FR7.4（aborted→storage で全件取り消し）、FR7.5/FR7.6（empty、header-mismatch、too-large、too-many-rows）、AC7.1.4（validRows が 0 件のプレビュー）まで概ね網羅されています。一方で、AC3.4.2 に必要な読み取り窓口の欠落と、Q1 の「U7 は U3 を見ない」方針が画面テストで破れる点は、承認前に判断が必要です。Major は 2 件（READY の上限内）、残りは Minor です。

### 検証内容

- 依存 12 件（U3→U1、U4→U1、U4→U3、U5→U1、U5→U4、U6→U1、U6→U4、U7→U1、U7→U2、U7→U4、U7→U5、U7→U6）を、contract-summary の対応表と C1〜C6 の型・関数に照合しました。すべて存在します。
- コンポーネントのエンティティ属性（Transaction・Category・Budget・StorageMeta）と C1・C2 の型を照合しました。属性名と型は一致しています。`sortOrder` は components.md の追記と一致します。
- 失敗の種類を FR8、FR3.4、AC3.4.4、FR7.4〜FR7.6、AC7.1.4 に照合しました。詳細は下記の Findings に記載しています。
- TypeScript の断片の内部整合を確認しました。C3 の import 漏れ、C3 の共通ルールとの不一致を Minor として報告します。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C3 Book（読み取りメソッド一覧）と deleteCategory | AC3.4.2 は、使われていない支出カテゴリに予算がある場合に、削除前の確認ダイアログへ「予算も削除される」旨を出すことを求めています。しかし Book の読み取りは getEffectiveBudgets(month) だけです。これは引き継ぎ値を含む月単位の値で、そのカテゴリに設定済みの予算が（どの月にも）あるかは分かりません。deleteCategory が deletedBudgets を返すのは削除の後です。画面は確認の時点で必要な情報を取得できません。 | 削除前にそのカテゴリの設定済み予算の件数を返す読み取り窓口（例：Book に getBudgetCount(categoryId) を追加）を C3 に定めます。または、確認文言を予算の有無によらない固定文にするなら、その判断を契約に明記して AC3.4.2 の文言と整合させます。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C3 openBook の options.storage と「Q1 = A」の注記（C3 末尾） | AC-FR8-1 と AC-FR8-3 は、保存失敗・読み込み失敗に差し替えた保存領域で画面（U7）を検証することを求めています。差し替えは openBook の options.storage に createMemoryStorage（U3 の関数）を渡して行うため、U7 のテストが U3 を import することになります。これは「U7 は U3 に依存せず、StorageHandle・StorageOpenError は直接使わない」という Q1 の決定と、依存一覧（U7→U3 なし）に矛盾します。 | U7 のテストが保存を差し替える経路を契約で決めます。例：U4 の公開窓口から createMemoryStorage を再公開する、または U4 が openBook 用のテスト用ファクトリを公開する。もしくは「テストに限り U7 から U3 を import してよい」と明記し、公開窓口の規則（第4章）との関係を書きます。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C3 のコードブロック先頭の import 文 | openBook の引数で StorageHandle と StorageOpenError を使っていますが、import 文にありません（data-contract からのみ import し、storage からの import がない）。型としてそのままではコンパイルできません。 | import type { StorageHandle, StorageOpenError } from "../storage"; を C3 の断片に追加します。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > 第2章「失敗の返し方」と C3 OperationError | 「想定外の例外は storage・unexpected の失敗に変換する」とありますが、OperationError には kind: storage しかなく、unexpected の種類がありません。バグ起因の失敗と保存失敗が同じ kind になり、画面が「再試行で直る失敗」と「直らない失敗」を区別できません。 | OperationError に { kind: "unexpected"; message: string } を加えるか、「想定外の例外も kind: storage に含める」と文言を改めて、どちらかに一本化します。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C3 openBook / BookOpenResult | 初期カテゴリを作る書き込み（write）が失敗した場合（StorageError の write-failed）が、BookOpenResult のどの status になるか書かれていません。load-failed に写すのが自然ですが、契約上は未決で、実装が分かれ得ます。 | 「初期カテゴリの作成の失敗は load-failed とする」など、写し方を C3 に 1 行で明記します。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C1 CsvLine.line と decodeCsv | line は「見出しを 1 行目とした元ファイルの行番号」ですが、引用符内に改行を含む値があるとき、物理行の番号か、レコードの通し番号かが決まっていません。AC7.1.1・AC-FR7-1 の「3 行目」の表示が実装で食い違い得ます。 | 複数行にまたがるレコードの line を「レコードの先頭の物理行」と定めるなど、規則を C1 に追記します。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C3 RuleViolation（import-category-missing、category-type-mismatch）と importTransactions | CSV 確定時にカテゴリの種別が変わっていた場合は category-type-mismatch になり、import-category-missing と違って対象の行番号がありません。また、確定時の再検証で validation エラーが出ても ValidationError に行番号がなく、どの行かをプレビューに示せません。AC7.1.4 のとおり validRows が 0 件のときの commitImport の挙動も未記載です。 | 種別の不一致にも lines を持たせ、行単位の検証失敗の返し方を決めます。validRows が 0 件のときは added: 0 を返すか、呼ばないかを明記します。 | New |
| R-08 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C4 getMonthlySummary | getMonthlySummary は Book の 3 つの読み取り（収支・カテゴリ・予算）を別々の読み取り処理で呼びます。別タブの書き込みが間に入ると、支出合計とカテゴリ別実績の合計が一致しない（FR5.4）瞬間が理屈の上では生じます。 | 単一タブ前提（A1）で許容するなら、その旨を契約に注記します。許容しないなら、Book に月次集計用の読み取りをまとめた窓口を設けます。 | New |
| R-09 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/contract-design/contract-summary.md > C6 ButtonProps と DialogProps（returnFocusRef） | DialogProps は returnFocusRef に RefObject を受けますが、ButtonProps に ref の受け渡し（forwardRef、または ref を props として受ける規約）がありません。AC-FR9-2「閉じたら削除ボタンにフォーカスが戻る」を契約どおりに実装できるか不明です。React の名前空間の import も断片にありません。 | Button・TextField・Select が DOM 要素の ref を公開することを C6 に明記します。断片に import type React from "react" を加えます。 | New |

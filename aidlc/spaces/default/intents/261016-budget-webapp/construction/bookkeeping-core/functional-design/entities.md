# 家計簿の中核の形（bookkeeping-core）

- 出典: `inception/contract-design/contract-summary.md`（C1、C2、C3）、`inception/domain-design/components.md`（Ledger、CategoryCatalog、BudgetPlanner、BookkeepingService）、`inception/domain-design/decisions.md`（ADR-002、ADR-003、ADR-007）、`inception/units-generation/unit-of-work.md`（U4）、`inception/requirements-analysis/requirements.md`（FR2〜FR4、FR7、FR8）、`inception/user-stories/stories.md`（US3.1〜US4.3）、`construction/storage/code-generation/code-summary.md`（U3 からの引き継ぎ）、`functional-design-questions.md`（Q1 = A）
- 収支・カテゴリ・予算の形そのものは U1（C1）が定め、U4 はその持ち主として作成・更新・削除を行う。保存は U3（C2）の窓口だけを使う。

```yaml
entities:
  - name: Transaction
    description: 収支1件（形は C1。持ち主は Ledger）。id と日時は U4 が付ける
    attributes:
      - { name: id, logical_type: string, required: true, unique: true, constraints: [作成時に newId() で付ける。更新しても変えない] }
      - { name: date, logical_type: IsoDate, required: true }
      - { name: type, logical_type: EntryType, required: true, constraints: [参照するカテゴリの type と一致] }
      - { name: categoryId, logical_type: string, required: true, constraints: [存在するカテゴリを参照] }
      - { name: amount, logical_type: integer, required: true, min: 1, max: 99999999 }
      - { name: memo, logical_type: string, required: true, constraints: [0〜200 文字、前後の空白は除去済み] }
      - { name: createdAt, logical_type: IsoDateTime, required: true, constraints: [作成時の now()。更新しても変えない] }
      - { name: updatedAt, logical_type: IsoDateTime, required: true, constraints: [作成・更新時の now()] }
    relationships:
      - { type: many-to-one, target: Category, via: categoryId }
    rules: [BR2.1, BR2.2, BR2.3, BR2.4, BR2.5]

  - name: Category
    description: カテゴリ1件（形は C1。持ち主は CategoryCatalog）
    attributes:
      - { name: id, logical_type: string, required: true, unique: true }
      - { name: type, logical_type: EntryType, required: true, constraints: [作成後は変えない] }
      - { name: name, logical_type: string, required: true, constraints: [U1 の validateCategoryName を通った値。同じ種別の中で比較キーが重複しない] }
      - { name: sortOrder, logical_type: integer, required: true, min: 0, constraints: [同じ種別の中の並び。追加時は最大値 + 1。名前を変えても変えない] }
      - { name: createdAt, logical_type: IsoDateTime, required: true }
    relationships:
      - { type: one-to-many, target: Transaction, via: categoryId }
      - { type: one-to-many, target: Budget, via: categoryId }
    rules: [BR1.2, BR3.1, BR3.2, BR3.3, BR3.4]

  - name: InitialCategorySet
    description: 初回に作る架空の初期カテゴリ（FR3.1）。sortOrder は並び順に 0 から振る
    instances:
      - { type: expense, names: [食費, 日用品, 住居費, 水道光熱費, 交通費, 娯楽, その他支出] }
      - { type: income, names: [給与, 副収入, その他収入] }
    rules: [BR1.2]

  - name: Budget
    description: 支出カテゴリの月ごとの予算設定（形は C1。持ち主は BudgetPlanner）。キーは [categoryId, month]
    attributes:
      - { name: categoryId, logical_type: string, required: true, constraints: [存在する支出カテゴリを参照] }
      - { name: month, logical_type: YearMonth, required: true }
      - { name: amount, logical_type: integer, required: true, min: 0, max: 99999999, constraints: [0 円と未設定は区別する] }
      - { name: updatedAt, logical_type: IsoDateTime, required: true }
    relationships:
      - { type: many-to-one, target: Category, via: categoryId }
    rules: [BR4.1, BR4.2, BR4.4]

  - name: EffectiveBudget
    description: ある月に使う予算と出所（C3）。保存せず、表示のたびに計算する
    attributes:
      - { name: categoryId, logical_type: string, required: true }
      - { name: month, logical_type: YearMonth, required: true }
      - { name: amount, logical_type: "integer または null", required: true, constraints: [source が none のときだけ null] }
      - { name: source, logical_type: "BudgetSource（set / carried(from) / none）", required: true }
    rules: [BR4.3]

  - name: Book
    description: 開いた家計簿の窓口（C3）。BookkeepingService の公開面。読み取り5種と書き込み9種を持つ
    attributes:
      - { name: storage, logical_type: StorageHandle, required: true, constraints: [U3 の窓口。外へは出さない] }
      - { name: now, logical_type: "() => Date", required: true, constraints: [既定は実際の時計。テストで差し込む。保存する日時は toISOString() の値（UTC、末尾 Z）] }
      - { name: newId, logical_type: "() => string", required: true, constraints: [既定は crypto.randomUUID。テストで差し込む] }
    rules: [BR6.1, BR6.2, BR6.3, BR6.4]

  - name: BookOpenResult
    description: openBook の結果（C3）
    attributes:
      - { name: status, logical_type: enum, required: true, allowed_values: [ready, unavailable, newer-version, load-failed] }
    rules: [BR1.1, BR1.2, BR1.3]

  - name: OperationError
    description: 操作の失敗（C3）。Q1 = A により newer-version を加える
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [validation, rule, storage, newer-version] }
    rules: [BR6.1, BR6.2]

  - name: RuleViolation
    description: 部品をまたぐ規則の違反（C3）
    attributes:
      - { name: code, logical_type: enum, required: true, allowed_values: [category-missing, category-type-mismatch, category-in-use, last-category-of-type, not-found, budget-not-set, import-category-missing] }
    rules: [BR2.1, BR2.2, BR2.3, BR3.3, BR3.4, BR4.1, BR4.2, BR5.1]

  - name: ImportRow
    description: CSV 取り込みの確定対象の1行（C3。U6 が作る）
    attributes:
      - { name: line, logical_type: integer, required: true, min: 2, constraints: [CSV のレコード開始行の番号] }
      - { name: input, logical_type: TransactionInput, required: true }
    rules: [BR5.1]
```

## 契約 C3 との差分

- `OperationError` に `{ kind: "newer-version" }` を加える（Q1 = A）。U7 は、操作の結果がこの種類なら、開くときの newer-version と同じ画面に切り替えて以後の操作を止める。
- `openBook` の任意の引数に `now?: () => Date` と `newId?: () => string` を加える（テストで日時と id を固定するため）。
- どちらもコード生成で contract-summary.md の C3 を同じ変更で更新する。利用者の U5〜U7 はまだないため影響はない。

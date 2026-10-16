# 保存の形（storage）

- 出典: `inception/contract-design/contract-summary.md`（C2）、`inception/domain-design/components.md`（Storage、StorageMeta）、`inception/domain-design/decisions.md`（ADR-004）、`construction/data-contract/`（C1 の Transaction・Category・Budget、SCHEMA_VERSION）、`inception/requirements-analysis/requirements.md`（FR1.6、FR8、NFR4）、`functional-design-questions.md`（Q1）
- U3 は IndexedDB を包む部品。保存する収支・カテゴリ・予算の形は U1（C1）が定め、持ち主は U4 である。U3 自身が持つデータは保存メタ情報（StorageMeta）だけ。

```yaml
entities:
  - name: StorageMeta
    description: 保存領域の版と初期化の記録（持ち主は U3）
    attributes:
      - { name: key, logical_type: string, required: true, unique: true, allowed_values: [schema] }
      - { name: schemaVersion, logical_type: integer, required: true, min: 1, constraints: [U1 の SCHEMA_VERSION と同じ値を書く] }
      - { name: initializedAt, logical_type: IsoDateTime, required: true }
    relationships: []

  - name: ObjectStore
    description: IndexedDB の保存領域（ストア）と索引の定義
    attributes:
      - { name: name, logical_type: enum, required: true, allowed_values: [transactions, categories, budgets, meta] }
      - { name: keyPath, logical_type: "string または list", required: true }
      - { name: indexes, logical_type: "list of {name, keyPath}", required: false }
    instances:
      - { name: transactions, keyPath: id, indexes: [{ name: byMonth, keyPath: month }, { name: byCategory, keyPath: categoryId }] }
      - { name: categories, keyPath: id, indexes: [] }
      - { name: budgets, keyPath: [categoryId, month], indexes: [{ name: byCategory, keyPath: categoryId }] }
      - { name: meta, keyPath: key, indexes: [] }
    rules: [BR1.2, BR1.3]

  - name: StoredTransaction
    description: transactions ストアに保存する形。C1 の Transaction に、索引用の month（date の先頭7文字）を加える。読み出し時は month を除いて Transaction として返す
    attributes:
      - { name: "（Transaction の全属性）", logical_type: Transaction, required: true }
      - { name: month, logical_type: YearMonth, required: true, constraints: [date の先頭7文字と一致] }
    rules: [BR1.3]

  - name: StorageHandle
    description: 開いた保存領域の窓口（契約 C2）
    attributes:
      - { name: state, logical_type: enum, required: true, allowed_values: [open, closed-by-upgrade, closed] }
    rules: [BR2.1, BR2.2, BR2.3, BR3.1, BR4.1]

  - name: StorageOpenError
    description: 開くときの失敗（契約 C2）
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [unavailable, newer-version, open-failed] }
      - { name: found, logical_type: integer, required: "newer-version のとき" }
      - { name: supported, logical_type: integer, required: "newer-version のとき" }
      - { name: message, logical_type: string, required: "open-failed のとき" }
    rules: [BR1.1, BR1.4, BR1.5]

  - name: StorageError
    description: 開いた後の読み書きの失敗（契約 C2 に newer-version を追加）
    attributes:
      - { name: kind, logical_type: enum, required: true, allowed_values: [read-failed, write-failed, newer-version] }
      - { name: message, logical_type: string, required: "read-failed・write-failed のとき" }
    rules: [BR2.3, BR3.1, BR4.1]

  - name: MemoryStorageOptions
    description: テスト用の差し替え（createMemoryStorage）の設定
    attributes:
      - { name: failOpen, logical_type: StorageOpenError, required: false }
      - { name: failReads, logical_type: boolean, default: false }
      - { name: failWrites, logical_type: boolean, default: false }
      - { name: delayMs, logical_type: integer, default: 0, min: 0 }
    rules: [BR5.1, BR5.2]
```

## 概要

- U3 が持つデータは StorageMeta（版と初期化日時）だけ。
- 保存領域は4つ（収支・カテゴリ・予算・メタ）と索引3つ。収支には索引用の対象月を加えて保存し、読み出しでは取り除く。
- 契約 C2 との差分: StorageError に `newer-version` を加える（Q1：別のタブで版が上がったら以後の読み書きを失敗させる）。契約の変更ルール（Q4）では列挙の値の追加は破壊的変更として扱うため、コード生成で contract-summary.md の C2 を同じ変更で更新する。この時点で C2 を使う U4 のコードはまだない。

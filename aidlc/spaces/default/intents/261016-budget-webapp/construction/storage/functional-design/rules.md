# 保存の規則（storage）

- 出典: `inception/contract-design/contract-summary.md`（C2）、`inception/requirements-analysis/requirements.md`（FR1.6、FR8.1〜FR8.4、NFR1、NFR4）、`inception/user-stories/stories.md`（US1.2 AC1.2.1〜AC1.2.3）、`inception/domain-design/decisions.md`（ADR-004）、`construction/data-contract/functional-design/rules.md`（BR5.1 SCHEMA_VERSION）、`functional-design-questions.md`（Q1）

```yaml
rules:
  - id: BR1.1
    statement: IndexedDB が使えない環境では、開くときに unavailable を返す
    category: policy
    applies_to: [openStorage]
    trigger: openStorage の呼び出し時
    logic: IF 実行環境に indexedDB がない、または開く要求自体が例外を出す、またはブラウザが利用を拒否した（プライベートモードの制限など）THEN unavailable を返す（例外を投げない）
    violation: StorageOpenError unavailable
    source: FR8.4, AC8.4.1

  - id: BR1.2
    statement: 初めて開くとき（データベースがない）は、4つの保存領域と3つの索引を作り、メタ情報に現在の版と初期化日時を書く
    category: policy
    applies_to: [openStorage, ObjectStore, StorageMeta]
    trigger: データベースの作成時（版の更新イベント）
    logic: 版 0 から SCHEMA_VERSION へ上げる処理の中で、transactions・categories・budgets・meta を作り、索引 byMonth・byCategory（transactions）、byCategory（budgets）を作る。meta に {key: schema, schemaVersion, initializedAt} を書く
    violation: 作成に失敗したら open-failed を返す
    source: FR1.6, BR5.1（U1）

  - id: BR1.3
    statement: 収支は索引用の対象月（date の先頭7文字）を加えて保存し、読み出すときは取り除く
    category: policy
    applies_to: [StoredTransaction]
    trigger: transactions への put と読み出し
    logic: put の前に month を付け、get・getAll・getAllByIndex の結果から month を除いて C1 の Transaction の形で返す
    violation: なし
    source: C2（transactions.byMonth 索引）

  - id: BR1.4
    statement: 保存データの版がアプリの版より新しいときは、データに触れず newer-version を返す
    category: policy
    applies_to: [openStorage]
    trigger: openStorage の呼び出し時
    logic: IF データベースの版 > SCHEMA_VERSION（ブラウザが版の不一致として開く要求を失敗させる）THEN 既存のデータベースを変更せずに newer-version（found=データベースの版、supported=SCHEMA_VERSION）を返す
    violation: StorageOpenError newer-version
    source: FR1.6, AC1.2.3

  - id: BR1.5
    statement: 版が古いデータは、版ごとに定めた移行の手順で現在の版へ上げる。初版（1）では移行はない
    category: policy
    applies_to: [openStorage]
    trigger: データベースの版 < SCHEMA_VERSION のとき
    logic: 版 n から n+1 への移行関数を順に適用する。初版では移行関数は空。移行中の失敗は open-failed とし、ブラウザの仕組みで移行全体が取り消される
    violation: StorageOpenError open-failed
    source: FR1.6, ADR-004

  - id: BR2.1
    statement: 読み取り（read）は指定した保存領域だけを読み取り専用で開き、work の結果を返す
    category: policy
    applies_to: [StorageHandle.read]
    trigger: read の呼び出し時
    logic: 読み取り専用の処理を開き、TxContext を work に渡す。work が終わったら結果を ok で返す
    violation: 読み取りの失敗・例外は read-failed（例外を投げない）
    source: C2

  - id: BR2.2
    statement: 書き込み（write）は指定した保存領域を1回の書き込み処理として開き、すべて成功かすべて取り消しにする
    category: policy
    applies_to: [StorageHandle.write]
    trigger: write の呼び出し時
    logic: >
      読み書きの処理を開き、TxContext を work に渡す。work が { ok: true } を返し、処理が完了したら ok を返す。
      work が { ok: false } を返したら処理を取り消し、{ kind: aborted, reason } を返す。
      work が例外を投げた、または保存に失敗した（容量超過などを含む）場合は処理を取り消し、write-failed を返す
    violation: aborted または write-failed（それ以前に保存済みのデータは残る）
    source: C2, NFR4, AC1.2.2

  - id: BR2.3
    statement: 書き込み処理の中で work に渡す TxContext は、その処理の中だけで使える。処理が終わった後の呼び出しは失敗にする
    category: constraint
    applies_to: [TxContext]
    trigger: TxContext の各操作の呼び出し時
    logic: 処理の完了・取り消しの後に呼ばれたら、その操作を失敗させる（read なら read-failed、write なら write-failed として呼び出し元へ返す）
    violation: read-failed または write-failed
    source: C2

  - id: BR2.4
    statement: work の中で、指定していない保存領域を操作しようとしたら失敗にする
    category: constraint
    applies_to: [TxContext]
    trigger: TxContext の操作時
    logic: stores に含まれない保存領域の名前が来たら、その処理を失敗させる（開発時の誤りを早く見つける）
    violation: read-failed または write-failed
    source: C2

  - id: BR3.1
    statement: 別のタブがデータベースの版を上げようとしたら、すぐに接続を閉じ、以後の読み書きを newer-version で失敗させる
    category: policy
    applies_to: [StorageHandle]
    trigger: ブラウザから版の変更の知らせ（versionchange）を受けたとき
    logic: 接続を閉じ、state を closed-by-upgrade にする。以後の read・write は処理を開かずに { kind: newer-version } を返す
    violation: StorageError newer-version
    source: Q1, FR8.2

  - id: BR3.2
    statement: 版の更新を別のタブが妨げているとき（古い接続が閉じない）は、開く要求が終わるのを待ち、待つ間は呼び出し元を待たせる
    category: policy
    applies_to: [openStorage]
    trigger: ブラウザから blocked の知らせを受けたとき
    logic: 何もしない（古いタブは BR3.1 で接続を閉じるため、やがて進む）。5 秒たっても進まない場合は open-failed（ほかのタブを閉じてください）を返す
    violation: StorageOpenError open-failed
    source: Q1

  - id: BR4.1
    statement: close を呼んだ後の読み書きは失敗にする
    category: constraint
    applies_to: [StorageHandle]
    trigger: close の後の read・write
    logic: state を closed にし、以後の read は read-failed、write は write-failed（「保存領域は閉じられています」）を返す
    violation: read-failed または write-failed
    source: C2

  - id: BR4.2
    statement: U3 はネットワークに一切アクセスしない
    category: constraint
    applies_to: [全体]
    trigger: 常時
    logic: IndexedDB 以外の外部の資源を使わない（Lint で通信の参照を禁止する）
    violation: Lint のエラー
    source: NFR1

  - id: BR5.1
    statement: テスト用の差し替え（createMemoryStorage）は、本物と同じ窓口と同じ規則（すべて成功かすべて取り消し、失敗の種類）を守る
    category: policy
    applies_to: [MemoryStorageOptions, createMemoryStorage]
    trigger: テストでの利用時
    logic: メモリ上に4つの保存領域と索引を持つ。write は work の前の状態を写しておき、失敗・取り消しのときに写しへ戻す。failOpen なら開くときにその失敗を返し、failReads・failWrites なら read・write を read-failed・write-failed にする。delayMs なら各操作の前に待つ
    violation: 指定した失敗を返す
    source: C2, ADR-004, AC8.3.1, AC8.2.1

  - id: BR5.2
    statement: テスト用の差し替えは、本物の IndexedDB と同じテスト群（契約テスト）で振る舞いを確かめる
    category: policy
    applies_to: [createMemoryStorage, openStorage]
    trigger: テストの実行時
    logic: 同じ契約テストを、本物（テスト用の IndexedDB 実装の上）と差し替えの両方に対して実行する
    violation: テストの失敗
    source: ADR-004
```

## 規則の概要

| ID | 内容 |
|----|------|
| BR1.1 | IndexedDB が使えなければ unavailable |
| BR1.2 | 初回は4つの保存領域・3つの索引・メタ情報を作る |
| BR1.3 | 収支は索引用の対象月を付けて保存し、読み出しで取り除く |
| BR1.4 | 新しい版のデータには触れず newer-version |
| BR1.5 | 古い版は版ごとの移行で上げる（初版は移行なし） |
| BR2.1〜BR2.4 | 読み取り、すべて成功かすべて取り消しの書き込み、処理の外・範囲外の操作は失敗 |
| BR3.1・BR3.2 | 別タブの版上げで接続を閉じる、妨げられたら5秒で open-failed |
| BR4.1・BR4.2 | 閉じた後は失敗、ネットワークなし |
| BR5.1・BR5.2 | テスト用の差し替えは同じ規則を守り、同じ契約テストで確かめる |

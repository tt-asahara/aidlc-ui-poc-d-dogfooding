## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1

### 概要

U3 storage の Functional Design（functional-spec.md、entities.md、rules.md、traceability.json）を、C2・C3、ADR-004、US1.2 と突き合わせて確認した（ADVISORY の1回のみ）。規則の ID、受け入れ条件の対応、保存領域・索引の定義は互いに整合している。traceability.json では AC1.2.1〜AC1.2.3 の対象 BR がすべて実在し、全規則が対象または reverse に入っている。CRITICAL はない。

人間が承認前に比べるべき点は次の2つ。
- IndexedDB のトランザクションの自動確定の扱いが仕様に出ていない。ここは AC1.2.2 の「すべて成功かすべて取り消し」の根拠にあたる。
- 版上げの失敗（newer-version）が、C3 を通って U7 まで届く経路がない。

そのほかは Minor で、コード生成時に補えば足りる。

### 検証内容

- traceability.json を解析した。AC1.2.1〜AC1.2.3 の対象 BR（BR1.2、BR1.3、BR1.4、BR1.5、BR2.1、BR2.2）はすべて rules.md に存在する。BR1.1、BR2.3、BR2.4、BR3.1、BR3.2、BR4.1、BR4.2、BR5.1、BR5.2 は reverse に入っている。
- rules.md と entities.md の yaml ブロックの BR ID は、functional-spec.md の参照と一致している。
- C2 との差分は functional-spec.md の第7節に明記されている。
  - StorageError への `newer-version` の追加。
  - `write<T, E>` と `aborted.reason: E`。
  - RecordOf・KeyOf・MetaRecord の公開。
- IndexedDB の意味論（自動確定、versionchange・blocked、容量超過）に照らした feasibility の指摘は下表にまとめた。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/functional-design/rules.md > BR2.2・BR2.3 と functional-spec.md > W3 | IndexedDB のトランザクションは、work が IndexedDB 以外の Promise（タイマー、fetch 風の非同期、遅延した microtask の連鎖など）を await した時点で自動確定する。確定済みなら work が `{ ok: false }` を返しても取り消せず、AC1.2.2 の「何も書かれない」が破れる。また確定後の put は TransactionInactiveError になる。仕様は work の返却値で取り消すとだけ書いており、work が await してよいのは TxContext の操作だけだという制約、work 完了後に確定済みだった場合の扱い、メモリ版（BR5.1）での同じ制約の再現が決まっていない。 | BR2.2 に「work は TxContext の操作以外を await しない」という使用上の制約を明記する。取り消しできなかった場合（確定済みだった場合）は write-failed を返し、U4 の work がこの制約を守ることを契約テストに入れる。メモリ版でも同じ制約を再現するか、制約違反を検出する。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/functional-design/functional-spec.md > 第1節（US8.2〜8.4 の失敗の種類）、第7節 と contract-summary.md > C3 OperationError・BookOpenResult | StorageError に追加した `newer-version` は、開いた後（別タブの版上げ）の read・write で返る。しかし C3 の `OperationError` の `storage` は message だけで、`BookOpenResult.newer-version` は openBook の時点でしか返らない。そのため U4 が `newer-version` を `storage` に潰すと、U7 は「新しい版で保存されたデータのため開けません」を出せず、「保存できませんでした」になる。仕様は「失敗の種類をこの Unit が区別して返す」と書くが、U4・U7 まで区別が届く経路がない。 | 次のどちらかを決めて書く。(a) C3 の OperationError に `{ kind: "storage"; ... }` とは別の `newer-version` の種類を足し、U4・U7 の分岐も同じ変更で更新する。(b) U4 が `newer-version` を `storage` に変換して U7 は区別しない、と受け入れ、第1節の記述を弱める。方針は Unit のチェックポイントで確認する。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/functional-design/rules.md > BR3.2 と functional-spec.md > W1 手順4 | `open` の要求は取り消せない。5 秒で open-failed を返した後に、妨げていたタブが閉じて要求が成功すると、StorageHandle を誰も持たない接続が開いたままになり、版上げも実行される。再試行（U7 の「再試行」）で別の要求が重なると、自分自身の古い接続が次の版上げを妨げる。 | タイムアウト後に要求が成功した場合は、その接続をすぐ閉じる処理を仕様に加える。あわせて、タイムアウト後に成功した場合の版上げの扱いも書く。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/functional-design/rules.md > BR1.4 | `indexedDB.open(name, SCHEMA_VERSION)` が版の不一致で失敗しても、ブラウザは found（データベースの実際の版）を返さない。仕様は `found=データベースの版` と書くが、取得の手順がない。版を指定せずに開き直して読む必要があり、その接続も確実に閉じる必要がある。 | found を得る手順（版を指定しない open で `db.version` を読み、すぐ閉じる）を BR1.4 に書く。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/functional-design/rules.md > BR5.1 | メモリ版の write は「写しに戻す」方式だが、並行する write の直列化が書かれていない。本物の IndexedDB は重なる範囲の readwrite を直列に処理する。メモリ版が直列化しないと、片方の取り消しがもう片方の書き込みを巻き戻し、本物とメモリ版の振る舞いが分かれる。契約テスト（BR5.2）に並行書き込みの観点もない。 | メモリ版の write を、重なる保存領域では直列に実行すると定める。契約テストに並行する2つの write の観点を加える。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/functional-design/entities.md > StorageMeta.initializedAt、functional-spec.md > W1、contract-summary.md > C2 openStorage | `initializedAt` の時刻の取得元（時計）と、`dbName` の既定値が未定義。時計が差し込めないとテストで値を固定できない。契約の未解決事項（C2 の索引名・読み書き範囲）のうち索引名は確定したが、`write` に渡す保存領域の組み合わせは U3 では決めていない。 | 時計の差し込み方（既定は現在時刻）と `dbName` の既定値を決めて entities.md に書く。`write` の保存領域の組み合わせは U4 側で決めると明記する。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/functional-design/functional-spec.md > 第6節 テストの観点 | AC1.2.1 は「再読み込み後も同じ収支と予算」だが、テストの観点は「書いて読み直す」で、ハンドルを閉じて開き直す観点がない。また、`categories` と `budgets` の保存・読み出しの往復は明示されていない。 | 書いてから close し、開き直して同じ値が読める観点を第6節に加える。budgets の複合キーの往復と byCategory 索引も入れる。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の解析（`bun -e`） | PASS | JSON として解析でき、OK 対象の BR は rules.md にすべて存在する。 |
| 規則の被覆確認 | PASS | rules.md の全 BR が coverage の対象か reverse に入っている。 |
| yaml ブロックの解析 | PASS | rules.md と entities.md の yaml ブロックは解析できる。 |

### 総括

規則と受け入れ条件の対応は完結しており、開発者はこの仕様から実装に着手できる。ただし AC1.2.2 の核になる自動確定の扱い（BR2.2）と、版上げの失敗が C3 を通って U7 まで届く経路は、承認前に決めるのがよい。そのほかの Minor はコード生成時に補える。

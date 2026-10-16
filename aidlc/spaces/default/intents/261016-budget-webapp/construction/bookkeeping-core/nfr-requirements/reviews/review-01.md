## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T11:49:43Z
**Iteration:** 1

### 概要

助言型（ADVISORY）の1回だけのレビューです。traceability.json を確認し、上流の NFR1〜NFR9 の9件がすべて網羅されていることを確かめました。OK の対象 ID（NFR1.1、NFR3.1、NFR4.1〜4.4、NFR5.1、NFR6.1〜6.3、NFR8.1〜8.3、NFR9.1）は security-requirements.md と tech-stack-decisions.md に存在します。N/A は NFR2（画面なし）と NFR7（ブラウザ差は U3・U7）の2件で、理由は妥当です。

質問0件の判断は概ね妥当です。新規の依存はなく、テスト方式は U3 の決定を引き継いでいます。順序は team.md の Ordering に従っています。性能の取り分は NFR3 から導出できます。

U3 の `StorageHandle`・`TxContext`・`WriteError` と整合しており、NFR4.3（失敗の種類の区別）と NFR4.4（TxContext 以外を待たない）は U3 の契約と矛盾しません。`src/storage/memoryStorage.ts` は別の周回に進んだ時点で処理を確定済みとみなす作りです。そのため NFR6.3 の「読み込み中」を `delayMs` で再現するテストは成立します。実時間のタイマーを使い、偽のタイマーを使わない方針とも整合しています。

主な懸念は、NFR3.1 の測定条件が上流の NFR3 と違うことと、一括取り込みの性能目標がないことです。どちらも Unit の完了を止めるものではなく、人間が確認したうえで承認できる内容です。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-requirements/tech-stack-decisions.md > 2. 非機能の目標 NFR3.1 | NFR3.1 の測定条件が上流の NFR3 より軽い。NFR3 は、収支5,000件・カテゴリ30件・予算360件を前提に、最新版 Chrome で500ms以内としている。NFR3.1 は、カテゴリ7件・予算84件（12か月分）を fake-indexeddb（Node 上の代替）で測り、200ms以内としている。予算は約4分の1で、getEffectiveBudgets の読み取りと走査の量が違う。「測定値を記録」とあるだけで、しきい値の判定方法（計測回数、中央値か最大値か、ウォームアップの有無）も決まっていない。しきい値が計測のばらつきで不安定になるおそれがあり、本物のブラウザの性能も保証されない。 | 前提の件数を NFR3 に合わせる（カテゴリ30件、予算360件。支出カテゴリ分への配分を明記する）。判定方法（複数回計測した中央値など）を書く。fake-indexeddb での値は目安にすぎず、実ブラウザでの確認は U7 側の統合測定に委ねることを明記する。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-requirements/tech-stack-decisions.md > 2. 非機能の目標 | importTransactions の上限規模（FR7.6 の5,000行）を1回の書き込み処理で追加するときの性能・メモリの目標とテストがない。NFR4（全部成功か全部失敗か）を満たすため、5,000件を1つの処理に入れる設計になっている。NFR3 の「CSV 5,000行の読み込みからプレビューまで2秒」は U6 の取り分だが、確定の書き込みに目安がなく、境界値（5,000行）の保存の成功とロールバックを確かめるテストも NFR6.3 に含まれていない。 | 5,000行の importTransactions について、fake-indexeddb での所要時間の目安と、境界値のテスト（成功と、途中の失敗で何も残らないこと）を NFR6.3 または NFR3.1 に加える。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-requirements/tech-stack-decisions.md > 1. 選定 id の生成 | `crypto.randomUUID()` が使えるのは、localhost などの安全なコンテキストと Node.js 24 だけである。開発サーバーを LAN の IP アドレスなどから開くと、未定義で TypeError になる。BR6.2 は例外を `storage` として返す方針なので、記録の追加が理由の分からない storage エラーになる。この場合の扱いが書かれていない。 | 安全なコンテキストでないときの扱いを決める。例として、フォールバックの id 生成を用意するか、openBook の時点で検出して `unavailable` として返す。または、対象は localhost のみとして許容することを明記する。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-requirements/security-requirements.md > 3. Functional Design のレビューの扱い（AC3.4.2） | 削除確認で予算の有無を知らせる件は、共通の契約 C3 に読み取りを足す可能性がある。これを NFR Design に先送りしているが、契約の変更は U5・U7 にも影響する。決定が遅れるほど、下流 Unit の手戻りが大きくなる。 | NFR Design の冒頭で最優先に決める。契約変更になる場合は、contract-summary.md への反映と下流 Unit への通知の手順を決める。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/nfr-requirements/tech-stack-decisions.md > 1. 選定 テスト環境、2. NFR6.1 | NFR6.1 の「ディレクトリ単位のしきい値」と「node 環境」を実現するには、vitest.config.ts に bookkeeping-core 用のプロジェクトとカバレッジのしきい値（`src/bookkeeping-core/**`）の追加が必要である。現状の vitest.config.ts にはない。また、eslint.config.js にも NFR1.1 用のブロックが必要である。成果物にはこの設定の変更が成果として書かれていない。 | コード生成の計画で、vitest.config.ts（プロジェクトとしきい値）と eslint.config.js（禁止の一覧。U1 が禁止している `crypto`・`Date` は禁止しない）の更新を明示的なタスクにする。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の確認（読み取りと突き合わせ） | upstream_ids は NFR1〜NFR9 の9件。OK の対象はすべて成果物に存在し、N/A の理由もある | 網羅は完全。構造上の問題はない |

### Summary

構造は健全で、上流の NFR をすべて網羅しており、質問0件の判断も妥当です。最大の懸念は NFR3.1 の測定条件です。上流のデータ規模（カテゴリ30件、予算360件）より軽く、判定方法も未定義です。これと一括取り込みの目安は、承認前に検討する価値があります。ただし Major は1件のみで、verdict は READY です。

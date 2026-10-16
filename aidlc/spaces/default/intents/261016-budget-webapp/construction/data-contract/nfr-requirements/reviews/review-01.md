## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T09:27:33Z
**Iteration:** 1

### 概要

U1（kind: spec）は状態・通信を持たない純粋関数の集まりで、安全性の要件（NFR1.1、NFR8.1〜8.5）は脅威と対策の表に対応している。traceability.json は有効な JSON で、NFR1〜NFR9 の 9 件すべてを列挙している。OK の 6 件（NFR1、NFR3、NFR5、NFR6、NFR8、NFR9）の target はいずれも成果物内に存在する。N/A の 3 件（NFR2、NFR4、NFR7）には理由があり、他 Unit への引き継ぎ先も示されている。Critical と Major に当たる欠陥は見つからなかった。以下は承認前に確認しておくとよい Minor の指摘である。

### 検証内容

- traceability.json を解析し、upstream_ids と coverage の ID が一致することを確認した。
- NFR1.1、NFR3.1、NFR5.1、NFR6.1、NFR6.2、NFR8.1〜8.5、NFR9.1 が security-requirements.md と tech-stack-decisions.md に定義されていることを確認した。
- 各目標の測定可能性を確認した。数値の目標は NFR3.1（300ms）、NFR5.1、NFR6.1（行カバレッジ 80%）、NFR1.1（外部要求 0 件）である。
- NFR8.4 は「有限の時間」としか書かれておらず、時間の上限を持たない（指摘 2）。
- 要件の NFR1、NFR3、NFR5、NFR6、NFR8、NFR9 と C2〜C4 を参照して、出典の対応を確認した。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-requirements/security-requirements.md > 2. 要件 NFR1.1 | NFR1.1 は「時計・乱数・ファイル・保存領域に触れない」と述べている。しかし強制手段の ESLint は fetch・XMLHttpRequest・WebSocket・sendBeacon・indexedDB・localStorage の参照しか禁じていない。Date.now、new Date()、Math.random、crypto、Node の fs・net・http の import、EventSource、Worker、globalThis 経由の別名参照は止められない。主張と検証手段が食い違っている。 | 禁止対象に Date、Math.random、crypto、Node 組み込みモジュールの import、EventSource・Worker・globalThis 経由の参照を加える。または、ESLint が強制する範囲に主張を絞る。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-requirements/security-requirements.md > 2. 要件 NFR8.4 | 「有限の時間で終わる」は測定できる目標ではない。確かめ方にも、1 行 1MB のテストの時間上限がない。大きな入力で二乗時間になる実装でも、テストは通ってしまう。 | NFR3.1 と同じ形で、1 行 1MB・閉じていない引用の入力に対する時間の上限（例：500ms 以内）を決める。または、計算量が線形であることを検証する条件を書く。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-requirements/security-requirements.md > 3. 脅威と対策（CSV インジェクション） | 数式対策は FR6.3 に従い `=` `+` `-` `@` の 4 文字だけを対象にしている。表計算ソフトによっては、先頭のタブ（0x09）や CR（0x0D）も数式の起動に使える。また NFR8.1 は「数式として解釈されない」と一般的に書いているが、実際の保証範囲は 4 文字だけである。 | 4 文字に限った判断であることを NFR8.1 に明記する。または、タブと CR を対象に加えるかどうかを人間が判断し、記録する。加える場合は FR6.3 と BR4.5 も合わせて直す。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-requirements/tech-stack-decisions.md > 1. 選定（実行環境）・NFR9.1 | NFR9.1 は「`npm ci` と `npm run verify` だけで検証できる」と述べている。しかし Node.js 24 を要求する旨を固定する仕組み（`engines`、`.nvmrc`、`.node-version` など）が選定にない。Node のバージョンが違う環境では、Intl.Segmenter と normalize の挙動差や Vitest の動作差が再現性を損なう。 | package.json の `engines` か `.nvmrc` で Node のバージョンを固定する。それを NFR9.1 の確かめ方に加える。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/data-contract/nfr-requirements/tech-stack-decisions.md > 3. 非機能の目標 NFR3.1 | 300ms の目標は、確かめ方で「余裕を持たせて判定し、結果を記録する」とされている。判定に使う実際のしきい値と、CI を使わない環境でのばらつきの扱いが決まっていない。このままでは、テストが不安定になるか、緩すぎて意味を失うおそれがある。 | テストで強制するしきい値を数値で決める（例：1 秒以内で強制し、300ms は記録だけにする）。測定は複数回の中央値とする、などの方法も併せて決める。 | New |

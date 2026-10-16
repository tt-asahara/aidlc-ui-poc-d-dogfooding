## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T10:49:59Z
**Iteration:** 1

### 概要

助言（ADVISORY）の1回だけのレビューです。判定行は人間の判断材料であり、承認を止めるものではありません。

traceability.json は構文が正しく、上流の NFR1〜NFR9 の 9 件をすべて含みます。OK の対象（NFR1.1、NFR3.1、NFR4.1〜4.4、NFR6.1・6.2、NFR7.1、NFR8.1・8.2、NFR9.1）は security-requirements.md と tech-stack-decisions.md に実在します。NFR2 と NFR5 の N/A は理由が妥当です。構造上の欠落はありません。

主な懸念は NFR4.2 です。IndexedDB の自動確定には2つの面があります。work が IndexedDB 以外の非同期処理を待つと、処理が確定します。確定後は、それ以前の書き込みを取り消せません。NFR4.2 は「確定後は write-failed を返す」とだけ定めていて、保存済みになった分を取り消せない点が NFR4.1（すべて成功かすべて取り消し）と矛盾したままです。テストの書き方も、記載のままでは成立しない場合があります。この点を決めずにコード生成へ進むと、契約テストを書く段階でやり直しになります。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-requirements/security-requirements.md > 1. 要件 > NFR4.2、NFR4.1 | 自動確定が起きた後の保存内容が決まっていません。work が IndexedDB 以外の非同期処理を待つと処理は自動で確定し、それ以前の put は残ります。その後の操作で write-failed を返したり、work が { ok: false } を返して取り消しを試みて失敗したりしても、データは書き込まれたままです。利用者には保存失敗と伝えますが、実際は一部だけ保存済みで、NFR4.1 の全体取り消しとは両立しません。また「確定後の取り消しの試み」は、work の呼び出しが終わった後に応答するのか、取り消しの時点で応答するのかが書かれていません。 | 確定後の扱いを1つ決めて書く。たとえば「work の中での IndexedDB 以外の待ちは契約違反であり、検出できる範囲で write-failed とする。一部だけ保存済みになる可能性は許容し、利用者に再試行を促す」、または、待ちの検出時に保存領域の元の状態へ戻す補償処理を設ける。NFR4.1 に「NFR4.2 の違反時を除く」と明記して矛盾を解く。 | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-requirements/security-requirements.md > 1. 要件 > NFR4.2 確かめ方 | 確かめ方が成立しない場合があります。(1) 「関係のない待ち」を Promise.resolve などの microtask の待ちにすると、実ブラウザでも fake-indexeddb でも処理は確定しません。確定するのは setTimeout など別の周回に進む待ちです。(2) 待ちの後に IndexedDB の操作が続かず ok を返すと、処理は普通に完了して ok になるので、write-failed になるテストにはなりません。(3) 「テスト用の差し替えも同じ振る舞いにする」とありますが、createMemoryStorage は写しへ戻す方式（BR5.1）で自動確定がなく、同じ振る舞いをどう再現するかが書かれていません。 | テストの条件を具体的に書く。「work が setTimeout 等の別の周回で待った後に TxContext を操作すると write-failed。待ちの後に操作しない場合は検出対象外」。差し替えは、非 IndexedDB の待ちを検出する仕組みを実装するか、この条件を契約テストの対象外にして理由を残す。microtask の待ちは確定しないことも明記する。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-requirements/tech-stack-decisions.md > 2. 非機能の目標 > NFR3.1 | 5,000 件の書き込みと1か月分の読み出しの合計を 2 秒としていますが、読み出しだけの上限がありません。上流の NFR3 は月次集計の切り替えを 500ms 以内としており、読み出しの割り当てが示されないため、「保存の層が足を引っ張らない」ことを確かめられません。fake-indexeddb 上の時間は実ブラウザとは別物で、カバレッジ計測（v8）下の壁時計の判定は不安定になる恐れがあります。5,000 件の月への分布も書かれていません。 | 読み出し単独の上限（例：1か月分の読み出しは 100ms 以内）と、月の分布（例：1か月に 5,000 件、または12か月に分散）を決める。実ブラウザの値ではなく、層の回帰を検出する目安であると記す。カバレッジ付きで不安定なら、閾値に余裕を持たせるか、測定値の記録のみとして合否判定は別にする。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-requirements/security-requirements.md > 1. 要件 > NFR1.1 | ESLint の既存設定（eslint.config.js）には src/storage 向けの規則がありません。U1 の例は navigator を丸ごと禁止し、U2 は indexedDB を禁止しています。U3 では indexedDB を許可し、navigator.sendBeacon と、window や globalThis 経由の fetch を禁止するプロパティの規則が要ります。document.cookie の禁止方法（no-restricted-properties か no-restricted-syntax か）も書かれていません。vitest.config.ts にも storage 用のプロジェクト（node 環境）とディレクトリ単位のカバレッジ下限（NFR6.1）がまだありません。 | NFR1.1 または tech-stack-decisions.md に、追加する設定（eslint.config.js の storage 用ブロックの禁止の種類、vitest.config.ts への storage プロジェクトと src/storage/** の下限）を、コード生成の入力として書く。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-requirements/security-requirements.md > 1. 要件 > NFR7.1 | 確かめ方は indexedDB を取り除いた環境だけです。BR1.1 は「開く要求が例外を出す」「ブラウザが利用を拒否した」場合も unavailable としますが、そのテストが要件にありません。fake-indexeddb ではプライベートモードの拒否を再現できないため、差し替えの注入（開く要求が例外を投げる）での確認が要ります。 | NFR7.1 の確かめ方に「開く要求が例外を投げる／拒否される場合に unavailable」を加え、再現手段（テスト用の indexedDB の差し替え）を書く。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-requirements/tech-stack-decisions.md > 2. 非機能の目標 > NFR6.1 | team.md の必須のテスト観点（空データ、読み込み中、保存失敗）が、この Unit で何のテストに当たるか書かれていません。「異常・境界の例を2つ以上」だけでは、これらを満たしたかを後で確かめられません。 | NFR6.1 に、空データ（空の保存領域の読み出し）、読み込み中（delayMs）、保存失敗（failWrites・容量超過）が必須のテスト観点であることを一行で書く。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| bun -e（traceability.json の解析） | PASS: coverage 9 件、upstream_ids 9 件 | 構文が正しく、NFR1〜NFR9 をすべて網羅している |
| OK の対象の存在確認（目視） | PASS | NFR1.1、NFR3.1、NFR4.1〜4.4、NFR6.1・6.2、NFR7.1、NFR8.1・8.2、NFR9.1 が実在する |
| package.json の確認 | fake-indexeddb は未追加 | 追加は NFR9.1 でコード生成時の作業として予定されている。バージョンの固定は実装時に確認が要る |

### 重大度の補足

- NFR4.2 に関する2件（Major）は、どちらも「自動確定の後に何が保存されているか」と、その検査の書き方に関するもので、コード生成の前に決めておく価値があります。
- 判定行は NOT-READY ですが、助言のレビューなので承認は止まりません。人間が上記を見て「変更を依頼」するか、受け入れるかを決めてください。

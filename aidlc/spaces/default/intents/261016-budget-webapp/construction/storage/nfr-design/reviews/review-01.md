## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T10:58:28Z
**Iteration:** 1

### 概要

助言（ADVISORY）の1回の確認です。Q1 = A（まとめて保存）の方式そのものは、IndexedDB の仕様と fake-indexeddb の実測の両方で成り立つことを確かめました。確かめた結果は次のとおりです（fake-indexeddb を作業用フォルダに入れて実測）。
- 読み取りの後に microtask の待ちを挟んで put しても成功する。要求を1つも出さずに microtask だけ待っても確定しない。
- setTimeout の後の put は同期的に例外（InvalidStateError）になる。
- 確定済みの処理への abort() も例外（InvalidStateError）になる。
- 5,000 件の1回の書き込みは約 106ms、1か月分（417件）の byMonth 読み出しは約 3ms で、2,000ms・300ms の合格条件には大きな余裕がある。
- 配列キー（[categoryId, month]）の順序は `IDBFactory.cmp` で正しく比較できる。

NFR Requirements のレビュー指摘（Major 2 件、Minor 4 件）は、設計の中で反映されています。traceability.json は NFR1.1〜NFR9.1 の12件すべてを網羅し、参照先の節も存在します。mermaid は構文として妥当です。

ただし、設計の中心である「すべて成功かすべて取り消し」を守る疑似コードに穴が1つあり、これは実測で再現しました。そのほか、C2 の型との食い違いが1つあります。この2点は承認の前に重みを見てください。どちらも修正は小さく、Critical ではないため、判定は READY としています。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-design/security-design.md > 1.2 流れ（6 と疑似コードの catch） | まとめて保存の途中で put が同期的に例外を投げる場合（データの形が不正な DataError、複製できない値の DataCloneError、テストで想定している put の容量超過の差し替え）に、疑似コードは `catch { return writeFailed() }` とだけ書き、tx.abort() を呼ばない。fake-indexeddb で実測したところ、先に要求した put は確定して残り（件数 1）、「何も書かれない」にならず、NFR4.1 と AC1.2.2 に反する。説明の 6 は「確定済みなので何も書いていない」場合しか考えていない。また、確定済みの処理への tx.abort() も例外になるため、別の周回の待ちの後に work が `{ ok: false }` を返す経路（1.2 の 4）では、abort の例外で aborted が返らず write が拒否されるおそれがある | 要求中に例外が出たら、処理がまだ有効な場合は abort してから write-failed を返す、と疑似コードと説明の 6 に書く。abort の呼び出しは例外を握って無視する形（確定済みなら何もしない）に統一し、work が `{ ok: false }` を返す経路にも同じ扱いを適用する。4.2 の「保存失敗」に、2件目の put で例外が出ても1件目が残らないテストを加える | New |
| R-02 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-design/security-design.md > 2 開く・閉じる・版（3つ目の項目）、2.1 の判定表 | 「newer-version に読み取った版（db.version）を添える必要はない（C2 の型どおり、種類だけを返す）」と書いているが、contract-summary.md の C2 は `{ kind: "newer-version"; found: number; supported: number }`、entities.md の StorageOpenError と BR1.4 も found・supported を必須としている。さらに、本物の IndexedDB は現在の版より小さい版で開くと、成功ではなく VersionError で open の要求を失敗させる（BR1.4 もそう書く）。2.1 の判定表と errors.ts の役割（容量超過・拒否・その他）には VersionError から newer-version への対応がなく、「それ以外の開く失敗は open-failed」に落ちる。found の値をどう得るか（版を指定せずに開き直す等）も決まっていない。開発者は C2・BR1.4 と NFR Design のどちらに従うか推測することになる | 開く失敗の判定表に VersionError から newer-version の行を加える。found の取得方法を決めて書き、C2 の型（found・supported あり）と合わせる。種類だけを返すと決めるなら、C2・entities.md・BR1.4 を同じ変更で更新する、と C2 更新の一覧（logical-components.md 4章）に加える | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-design/security-design.md > 1.5 テスト用の差し替え | NFR Requirements の NFR4.2 は「テスト用の差し替えも同じ振る舞いにする」だが、設計は差し替えでは別の周回の待ちが write-failed にならないとし、その行を本物だけのテストに外している。U4 以降が差し替えで書くテストでは、work の中の不要な待ちという書き方の誤りを見つけられない。NFR4.2 の充足が traceability.json で OK となっているのと食い違う | 差し替えでも、write の開始時に setTimeout などで「確定済み」の印を立て、その後の操作を write-failed にして、本物と同じ結果にできるか検討する。しない場合は、NFR4.2 を差し替えには適用しないと明記し、traceability.json の根拠にその例外を書く | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-design/security-design.md > 1.3 読み取りへの変更の重ね方 | 「キーの順に並べる」だけで比較の方法がない。budgets のキーは配列 [categoryId, month] で、文字列の `<` や sort の既定では正しく並ばない。getAllByIndex の順序（索引の値、次に主キー）も書かれていない。差し替えと本物で順序が食い違うと契約テストでしか見つからない。また、put の値を溜めるときに複製するか（本物は要求の時点で複製する）、put の DataError・DataCloneError・指定外の保存領域・処理の終了後の操作を溜める時点で検出するか、apply 時まで遅らせるかが書かれておらず、BR2.3・BR2.4 を溜め方式でどう守るかが不明 | pending のキー比較は `IDBFactory.cmp` か同じ意味の比較関数を使うと決め、索引の問い合わせの順序（索引の値、主キーの順）を書く。put は受け取った時点で構造化複製して溜めること、保存領域の範囲外・work の終了後の操作は溜めずに失敗にする旨を、pending の責務に書く | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/storage/nfr-design/security-design.md > 3 外部に出さないこと、4.1 構成 | eslint.config.js のフラット設定では、同じ規則を別の設定ブロックで書くと規則のオプションは合成されず置き換わる。現在の src/storage 向けの設定は src/data-contract 向けの禁止（indexedDB を含む）とは別ブロックになるため、そこに書かない項目は禁止されなくなる。設計の一覧は fetch・XMLHttpRequest・WebSocket・EventSource・localStorage・sessionStorage・eval だけで、NFR1.1 が挙げる他の項目は properties 側にある。vitest.config.ts も、ディレクトリ単位の下限が全体の下限と別に必要で、コード生成時に漏れやすい | storage 向けのブロックに禁止の一覧をすべて書き切ること（他のブロックから継承されない）と、NFR1.1 の項目すべてを網羅することを、コード生成への注意として加える。no-restricted-syntax の `new Function` は built-in の no-new-func で代えてもよい | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の解析（bun -e 相当の確認） | 有効な JSON。upstream_ids 12件、coverage 12件が一致し、すべて OK | NFR1.1・NFR3.1・NFR4.1〜NFR4.4・NFR6.1・NFR6.2・NFR7.1・NFR8.1・NFR8.2・NFR9.1 が網羅され、参照先の節も存在する |
| fake-indexeddb の実測（作業用フォルダ） | 読み取り後の microtask 待ちは成功。setTimeout 後の put と確定後の abort は InvalidStateError。同期の DataError・DataCloneError の後に abort しないと先の put は確定して残る。5,000 件の書き込み 約106ms、byMonth の読み出し 約3ms。IDBFactory.cmp は配列キーを正しく比較 | まとめて保存の前提は成り立つ。1件目の Major は実測で再現した。性能の合格条件は大きな余裕がある |
| mermaid の確認（目視） | flowchart LR は構文として妥当 | 問題なし |

### Summary

Q1 = A の方式は正しく、自動確定の扱いと性能の目安は実測でも裏付けられました。承認の前に、まとめて保存の途中で同期の例外が出たときに abort が抜けていて部分書き込みが残る点と、newer-version の found・VersionError の扱いが C2 と食い違っている点の2つを重く見てください。

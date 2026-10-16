## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T12:36:30Z
**Iteration:** 1

### 概要

U6 csv-exchange の NFR Requirements（ADVISORY の1回のみの確認）。追加の依存がなく、U1 の decodeCsv / validateCsvRecord と U4 の Book の窓口をそのまま使う library なので、質問0件の判断は妥当と判断する。上流の NFR1〜NFR9 は traceability.json で9件すべてが OK（5件）または理由つきの N/A（4件）で結び付いており、OK の対象 ID（NFR1.1、NFR3.1・3.2、NFR4.1〜4.3、NFR6.1〜6.3、NFR8.1〜8.4、NFR9.1）はすべて2つの成果物に実在する。1MB・5,000 件の境界、TextDecoder の fatal 指定（Node 24 は full-icu で対応）、U1 の decodeCsv が入力長に比例する1回走査であること（csv.ts の parseRows）は設計と整合する。人間が承認前に重みを付けるべき点は、Functional Design の Major の扱いが NFR 段階では「方針の記録」にとどまり、rules.md の BR3.3 と食い違ったままであること（Major 1件）と、軽微な4件。Critical はない。

### 検証内容

- traceability.json を解析し、upstream_ids 9件がすべて coverage にあること、OK の target が security-requirements.md と tech-stack-decisions.md の ID として存在することを確認した。
- U1 の csv.ts を確認した。validateCsvRecord は全項目が通ったときだけ値を返し、失敗時は ValidationError の配列だけを返す。FD レビューの Major の前提と一致し、「U1 の窓口を変えず、検証を完全に通った行だけを照合する」方式は U1 の現在の窓口で実現できる。
- vitest.config.ts と eslint.config.js を確認した。csv-exchange 用のプロジェクト・しきい値・ESLint ブロックはまだない（NFR6.1 と NFR1.1 が足す対象として挙げている）。U3・U4 と同じく、フラット設定では同じ規則が別ブロックで合成されないため、禁止の一覧を1ブロックに書き切る必要がある。
- NFR3 の U6 の取り分（NFR3.1・3.2 とも 1,000ms）は、U1 の decodeCsv 300ms の目標と矛盾せず、5,000 行を約 400KB とする見積りも 1MB 上限の内側にある。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-requirements/security-requirements.md > 3. Functional Design のレビューの扱い（Major: U1 の検証に一部失敗した行の照合） | FD の Major への対処（検証を完全に通った行だけをカテゴリと照合する）は妥当で、U1 の窓口で実現できる。しかし NFR 段階では方針を「NFR Design に書く」と先送りしただけで、振る舞いを定める rules.md の BR3.3 の最終文（検証失敗の項目がある行でも照合して理由をまとめて返す）と functional-spec.md の W2 の手順は書き換わっていない。このままでは Code Generation の入力の間で U6 の振る舞いが食い違い、AC7.1.2 の理由の併記の範囲（金額が不正かつカテゴリも不明な行で、理由を1つにするか2つにするか）も確定しない。 | Unit の承認で、(a) 検証を完全に通った行だけを照合し、検証失敗の行は U1 の理由だけを返す、という方式を明示して確認を受ける。承認後の NFR Design で BR3.3 と W2 の手順を書き直す作業を、期日と担当（次ステージ）つきで記録し、書き直されるまで BR3.3 の最終文を無効と明記する。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-requirements/security-requirements.md > NFR4.2 と 2. 脅威と対策（巨大なファイルによる画面の固まり） | NFR4.2 は「上限を超えるファイルは中身を解析せずに断る」とするが、1MB 超えだけがこれに当たる。5,000 件超えは BR2.4 のとおり decodeCsv が全体を走査して件数を数えた後に判定するため、1MB 以内で件数が極端に多いファイル（短い行が数十万件）では全件の CsvLine を作った後に断ることになる。走査は線形で重大な問題にはなりにくいが、最悪の場合の時間は目標にも測定にも入っていない。 | NFR4.2 の文言を「1MB 超えは読む前に断る。5,000 件超えは復号後に断る」に直す。あわせて、1MB に近い最小行の CSV で too-many-rows を返すまでの時間の上限（例: 500ms）を NFR3 の測定に1件足す。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-requirements/tech-stack-decisions.md > NFR3.1 | U6 の 1,000ms は要件 NFR3（実ブラウザ・実 IndexedDB で読み込みからプレビューまで 2 秒）の割り当てで、測定は U3 のメモリの差し替えの上で行う。このため実 IndexedDB の読み出し時間と U7 の描画は含まれず、割り当ての合計が 2 秒に収まる保証がどこの Unit にもない。「開発用 PC」の条件も未記載。 | 測定値の記録に実行環境（CPU・Node のバージョン）を含める。2 秒の合計の確認を U7 の Build and Test の性能テスト（実 IndexedDB・Chrome）が担うことを NFR3 の備考に1行足す。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-requirements/security-requirements.md > NFR1.1 | 「eval、new Function を禁止」は no-restricted-globals の一覧だけでは new Function を止められず（no-new-func と no-eval が別に必要）、window・globalThis・self 経由の fetch・indexedDB 等（既存の U2・U3・U4 のブロックにある）も一覧に書かれていない。さらに U6 が依存してよい範囲（U1 と U4 の公開の窓口のみ。U3 の直接の import は不可）を Lint で守る手段がない。 | NFR1.1 に、U3・U4 と同じ形の禁止の一覧（グローバル名、window・globalThis・self 経由、navigator.sendBeacon、document.cookie、no-eval、no-new-func）を1ブロックに書き切ること、および非テストファイルでの U3 の import を no-restricted-imports で禁止することを明記する。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/csv-exchange/nfr-requirements/security-requirements.md > NFR4.3 | NFR4.3 は「例外を投げない」を、ファイル全体の理由の区別のテストで確かめるとするが、BR5.2 の想定外の例外の変換（読み込みでは read-failed、書き出し・確定では storage）を確かめる観点が NFR6.3 にもない。File の arrayBuffer が失敗する場合や Book の呼び出しが例外を投げる場合が未検証になる。 | NFR4.3 または NFR6.3 に、arrayBuffer が reject する File と、例外を投げる Book の差し替えで、それぞれ read-failed と storage が返るテストを含めると明記する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json の解析（bun -e 相当の照合） | PASS: upstream NFR1〜NFR9 の9件すべてが coverage にあり、OK 5件・N/A 4件（理由つき）。OK の target ID はすべて成果物に存在する | 要件の抜け・参照切れなし |
| U1 csv.ts の突き合わせ（decodeCsv、validateCsvRecord） | 整合: 1回走査の線形処理、検証は全項目成功時のみ値を返す | 5,000 件・1MB の目標は達成可能。FD Major の方式（a）は現在の窓口で実現できる。件数の判定が全走査の後になる点は Minor の根拠 |
| vitest.config.ts・eslint.config.js の突き合わせ | csv-exchange 用のプロジェクト・しきい値・Lint ブロックは未作成（NFR6.1・NFR1.1 が足す対象） | Code Generation の計画で作る作業として妥当 |

### Summary

質問0件の判断と NFR の網羅は妥当で、数値の目標（1,000ms、1MB、5,000 件、行 80%）は測定可能かつ U1・U4 の実際の挙動から達成可能と見る。人間が承認時に最も重みを付けるべきは、FD の Major への対処を「検証を完全に通った行だけを照合する」方式で確定し、食い違ったままの BR3.3 の書き直しを次ステージで確実に行うことで、残りは文言と測定の補強にとどまる。

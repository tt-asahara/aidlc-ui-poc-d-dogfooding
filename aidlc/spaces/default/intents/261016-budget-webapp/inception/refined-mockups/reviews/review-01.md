## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-10-16T08:32:12Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261016-budget-webapp/inception/refined-mockups/design-system-mapping.md > 2. 部品と HTML 要素の対応（TransactionForm の `input[type=date]`）と mockups.md > S1-3 | 日付欄をネイティブの `input[type=date]` とする一方、S1-3 は「2026-13-01」と打ち込めてエラー文「存在する日付を YYYY-MM-DD で入力してください」が出る前提になっている。ネイティブの日付入力では存在しない日付は入力できず、US2.2 の AC2.2.2・US9.3 の AC9.3.2（日付が不正のときのフォーカス移動）をどの操作で再現するのか、実装者が推測することになる。キーボードでの日付入力の操作もネイティブ型と文字入力型で異なる。 | 日付欄を「ネイティブの日付入力」か「YYYY-MM-DD の文字入力（＋任意で日付選択）」のどちらにするか決め、S1-3 の表示、エラー文、AC2.2.2・AC9.3.2 のテスト方法、キーボード操作の説明を選んだ方に合わせて直す。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/refined-mockups/mockups.md > S1-1（メモの省略表示と「行の展開ボタン」） | 長いメモを「行の展開ボタン」で全文表示するとあるが、interaction-spec.md の TransactionList に展開ボタンの状態・`aria-expanded`・キーボード操作・フォーカスがなく、accessibility-checklist.md のシナリオ K1〜K10 にも含まれない。モバイルのカード表示での扱いも書かれていない。 | TransactionList に展開状態と操作（ARIA・フォーカス・モバイル時）を追加するか、メモを折り返して全文表示する方針に変えて展開ボタンをなくす。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/refined-mockups/mockups.md > D3 取り込みプレビューダイアログ / interaction-spec.md > ImportPreviewDialog | 取り込める行・取り込めない行は最大 5,000 行になり得るが、「ダイアログ内でスクロール」としか書かれていない。全行を表で描画してよいのか、件数上限・ページ分け・先頭 N 件のみの表示にするのかが決まっておらず、NFR3（プレビュー 2 秒以内）と読み上げの負担に影響する。 | 大量行のときの表示方針（全件表示、先頭 N 件と総数の表示、ページ分けのいずれか）を一つ決めて D3 に書く。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/refined-mockups/mockups.md > S2-1 と S3-1 の表示例 | 同じ 2026年10月なのに、S2-1 は食費の予算が 1,000 円、S3-1 は食費が「25000 設定済み」で、例が食い違っている（S2-1 は残り −200 の超過を見せるための値）。後で受け入れテストやテストデータの元にされると混乱する。 | どちらかの例の金額をそろえるか、「表示例は互いに独立」と注記する。 | New |
| R-05 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/refined-mockups/mockups.md > S0-a、interaction-spec.md > TabNav の States（disabled） | S0-a・S0-b ではタブを表示しないと書かれているのに、TabNav には「S0-a、S0-b の表示中はすべてのタブが disabled」という状態がある。どちらが正かが不明。 | TabNav の disabled 状態を削除する（非表示で統一）か、S0-a・S0-b にタブを無効表示で出すかを決めて、両方をそろえる。 | New |
| R-06 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/refined-mockups/interaction-spec.md > 流れ B、mockups.md > S1-2、S3-1、S4 | 編集モードや名前変更・予算入力の途中で、月の移動やタブの切り替えをしたとき（入力が破棄されるのか保持されるのか）が書かれていない。また、編集して別の月に移したあと、共有の「対象月」を移動先の月に変えるのか今の月のままかも不明。 | 未保存の入力があるまま月・タブを移動したときの扱い（破棄する、保持する、確認を出す）と、別の月へ移動した後の対象月を決めて、interaction-spec.md の共通の振る舞いに追記する。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/inception/refined-mockups/mockups.md > S5 CSV タブ（月を指定 [2026-10 ▼]） | 月指定の選択肢が何の月（データがある月だけか、任意の月か）かが決まっておらず、書き出し自体が失敗したときの表示も書かれていない（保存失敗・読み込み失敗は定義済み）。 | 月の選択肢の出どころと、書き出し失敗時のメッセージ（再試行の案内つき）を CsvExportPanel の状態に追加する。 | New |

### Summary

全33ストーリーが画面または状態に対応づけられ、入力エラー・空・読み込み中・保存失敗・キーボード操作・ダイアログのフォーカス管理もよく具体化されており、ほとんどの点で実装者が迷わず着手できる水準です。承認前に確認してほしいのは、日付欄の部品選択とエラー表示の食い違い（Major 1件）で、実装前に決めればやり直しは小さく済みます。そのほかは Minor で、承認後の詳細設計で拾えます。

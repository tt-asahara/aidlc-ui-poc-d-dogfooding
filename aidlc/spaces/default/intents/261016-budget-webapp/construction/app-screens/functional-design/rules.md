# 画面の規則（app-screens）

- 出典: `inception/refined-mockups/mockups.md`（S0〜S5、D1〜D3）、`inception/refined-mockups/interaction-spec.md`（共通の振る舞い、流れ A〜D、部品の仕様）、`inception/user-stories/stories.md`（US1.1〜US9.3、95件の受け入れ条件）、`inception/contract-design/contract-summary.md`（C1〜C6）、`construction/*/code-generation/code-summary.md`（各 Unit からの引き継ぎ）、`functional-design-questions.md`（Q1 = A）
- U7 は業務規則を持たない。すべての計算・検証・保存は U1〜U6 が行い、U7 は結果を表示し、利用者の操作を各 Unit の操作へ渡す。
- 規則の ID は US の番号に対応させる（BR1.x は US1、BR2.x は US2 …）。

```yaml
rules:
  - id: BR1.1
    statement: 入力の検証の文言は U1・U4 が返した ValidationError.message をそのまま表示する
    category: policy
    applies_to: [TransactionForm, CategoryForm, BudgetRow, CsvPanel]
    trigger: 操作の結果が validation の場合
    logic: 項目ごとに、その項目の入力欄の直下へ「⚠ 」＋文言を表示し、入力欄に aria-invalid="true" と aria-describedby を付ける。表示は U2 の FieldError に項目名とメッセージを渡して行い（formatFieldError が「項目名：」の重複を防ぐ）、画面側では項目名を足さない
    violation: なし
    source: US1.1、FR1.4、FR2.2、interaction-spec 1章

  - id: BR1.2
    statement: 起動時は openBook の status で画面を切り替え、ready のときだけアプリ枠とタブを表示する
    category: policy
    applies_to: [App, BootScreen]
    trigger: 起動時と再読み込み
    logic: unavailable → S0-a（タブと入力を出さない）。newer-version → S0-b。load-failed → 「データを読み込めませんでした」と [ 再試行 ]（openBook を呼び直す）。ready → 収支タブを表示する
    violation: なし
    source: US1.2、US8.4、FR8.4、mockups 0章

  - id: BR1.3
    statement: U7 は通信をせず、保存は U4 の Book の操作だけを使う。IndexedDB を直接扱わない
    category: invariant
    applies_to: [App]
    trigger: すべての操作
    logic: fetch 等の通信と、保存先の直接の参照を使わない（Lint で確かめる）。画面は Book の結果を表示するだけ
    violation: なし
    source: US1.3、NFR1

  - id: BR1.4
    statement: 収支・月次集計・予算のタブは対象月を1つ共有する。初期値は今月（ブラウザのローカル日付）
    category: policy
    applies_to: [App, MonthNavigator]
    trigger: 月の移動、タブの切り替え
    logic: あるタブで月を変えると、他の月を扱うタブにも同じ月が選ばれる。前月・翌月への移動は月の文字列（YYYY-MM）の増減で行い、2000-01〜2099-12 の外には出ない（U4 の検証に従う）。読み取りには要求ごとの連番を付け、最新の要求の結果だけを表示に反映する（遅れて返った古い月の結果は捨てる）。タブを切り替えたとき、編集中のフォームの値と追加欄の入力は破棄する（保存していない入力は残らない）
    violation: なし
    source: US5.1 AC5.1.4、mockups 1章

  - id: BR1.5
    statement: 書き込みが成功したら、その画面の表示を U4 から取り直す。表示は保存に成功したデータだけを反映する
    category: invariant
    applies_to: [App]
    trigger: 登録・編集・削除・カテゴリ・予算・取り込みの成功後
    logic: 成功の知らせを出したあと、関係する読み取りを呼び直して表示を更新する。失敗のときは表示を変えない（失敗した変更を成功したように見せない）
    violation: なし
    source: FR8.3、mockups 1章

  - id: BR1.6
    statement: どの操作でも newer-version が返ったら、S0-b に切り替えて以後の操作を止める
    category: policy
    applies_to: [App]
    trigger: 任意の Book の操作が { kind: newer-version } を返したとき
    logic: S0-b を表示し、タブと入力を出さない。「データは変更していません」と表示する。再読み込みで開き直す
    violation: なし
    source: US1.2 AC1.2.3、U4 の Q1（FD）

  - id: BR2.1
    statement: 収支の登録は U4 の addTransaction で行い、成功したら一覧に追加して、フォームは日付と種別を残す
    category: policy
    applies_to: [TransactionForm, TransactionList]
    trigger: 登録の操作（ボタンまたは入力欄の Enter）
    logic: 日付の初期値は今日、種別は支出。成功で「✓ 登録しました」（aria-live="polite"、5秒で消える）、カテゴリ・金額・メモを空にし、フォーカスは金額欄。カテゴリの選択肢は選んだ種別のカテゴリだけ
    violation: なし
    source: US2.1、FR2.1、interaction-spec 流れ A

  - id: BR2.2
    statement: 保存中は保存の操作を受け付けない
    category: invariant
    applies_to: [TransactionForm, CategoryForm, BudgetRow, CsvPanel]
    trigger: 保存の操作の開始から完了まで
    logic: 保存系のボタンを無効にして文言を「保存中…」にする。Enter による再送も受け付けない（同じ操作を2回呼ばない）
    violation: なし
    source: US2.1 AC2.1.4、FR2.6、interaction-spec 1章

  - id: BR2.3
    statement: 対象月の一覧は U4 の listTransactions の順のまま表示し、収支がない月には案内と登録への導線を出す
    category: policy
    applies_to: [TransactionList]
    trigger: 一覧の表示時
    logic: 並びは U4 の結果（日付の新しい順、同じ日付は登録の新しい順、id の順）をそのまま使う。0 件なら「この月の収支はまだありません」と [ 登録する ] を出す。読み込み中と読み込み失敗では「まだありません」を出さない
    violation: なし
    source: US2.3 AC2.3.1〜AC2.3.4、FR2.3、FR5.5

  - id: BR2.4
    statement: 編集は同じフォームを編集モードにして U4 の updateTransaction で保存する
    category: policy
    applies_to: [TransactionForm, TransactionList]
    trigger: 一覧の「編集」、変更の保存
    logic: 成功で通常モードに戻し、押した「編集」へフォーカスを戻す。保存後に対象の収支が別の月へ移ったら「2026年11月に移動しました」を一覧の上に出し、フォーカスは一覧の見出しへ移す。共有の対象月は移さない（元の月のまま。移動先は知らせの文で示す）。失敗は入力を残して S1-7 相当の知らせを出す
    violation: なし
    source: US2.4 AC2.4.1〜AC2.4.3、interaction-spec 流れ B

  - id: BR2.5
    statement: 削除は D1 の確認を経て U4 の deleteTransaction で行い、キャンセルでは何も変えない
    category: policy
    applies_to: [ConfirmDialog, TransactionList]
    trigger: 一覧の「削除」
    logic: D1 を開く（日付・種別・カテゴリ・金額・メモを示す）。フォーカスは「キャンセル」。「削除する」で削除し「✓ 削除しました」、フォーカスは次の行の「削除」（なければ見出し）。キャンセルと Esc では何も変えず、押した「削除」へ戻す
    violation: なし
    source: US2.5 AC2.5.1〜AC2.5.3、FR2.5、US9.2

  - id: BR3.1
    statement: カテゴリの一覧は U4 の listCategories の順で、支出と収入を分けて表示し、各カテゴリの使用件数を getCategoryUsage から出す
    category: policy
    applies_to: [CategoryManager]
    trigger: カテゴリタブの表示時
    logic: 支出カテゴリは 7 件（初期）以上を全件表示。使用件数は収支の件数（transactions）を表示する。画面を開いた後の値は、操作の結果で取り直す（BR1.5）
    violation: なし
    source: US3.1 AC3.1.1、AC3.1.2

  - id: BR3.2
    statement: カテゴリの追加は U4 の addCategory で行い、検証の文言は U4 のものを表示する
    category: validation
    applies_to: [CategoryManager]
    trigger: 追加の操作
    logic: 種別（支出・収入）と名前の入力。失敗（空白・21文字以上・重複）は追加欄の下に文言を出し、入力を残す。成功で一覧に加え「✓ 〜を追加しました」
    violation: なし
    source: US3.2 AC3.2.1〜AC3.2.3

  - id: BR3.3
    statement: カテゴリの名前変更は U4 の renameCategory で行う。変更は一覧と集計の表示に自動で反映される
    category: policy
    applies_to: [CategoryManager]
    trigger: 「名前を変更」→保存
    logic: 行の名前を入力欄に変える（[保存] [キャンセル]）。Esc で取り消し、ボタンへフォーカスを戻す。重複などの失敗は入力欄の下に文言を出す
    violation: なし
    source: US3.3 AC3.3.1、AC3.3.2

  - id: BR3.4
    statement: カテゴリの削除は、使用中なら削除せず理由を示し、未使用なら D2 で確認してから U4 の deleteCategory で行う
    category: policy
    applies_to: [CategoryManager, ConfirmDialog]
    trigger: 「削除」の操作
    logic: getCategoryUsage で使用件数を見る。収支が1件以上 → 削除しないで「2件の収支で使われているため削除できません」を行の下に出す（押せるボタンのまま）。種別の最後の1件 → 「各種別に1件は必要です」。どちらでもなければ D2 を開く。D2 は予算があれば「このカテゴリの予算（N件）も削除されます」（Q1 = A）、なければ何も足さない。確定時は U4 が最新の状態で確かめ、確定の失敗は D2 を閉じてその行の下に理由を出す（category-in-use は「2件の収支で使われているため削除できません」、last-category-of-type は「各種別に1件は必要です」、not-found と category-type-mismatch は BR3.5 の文言）。成功は「✓ 娯楽を削除しました」と、消した予算の件数（1 以上のとき）を添える
    violation: なし
    source: US3.4 AC3.4.1〜AC3.4.3、FR3.4、FR3.5、Q1 = A（NFR Design）

  - id: BR3.5
    statement: 別のタブで削除された後の操作は、「選んだカテゴリが見つかりません」を表示し、画面の更新を促す
    category: policy
    applies_to: [TransactionForm, CategoryManager]
    trigger: U4 が category-missing を返したとき
    logic: 「選んだカテゴリが見つかりません。画面を更新してください」と [ 画面を更新 ] を出す。入力値は残す。[ 画面を更新 ] は対象の表示を取り直す。同じ文言を、U4 の not-found（別のタブで消えた収支・カテゴリ）と category-type-mismatch（カテゴリの種別が違う）にも使う。画面の文言はこの1つにまとめ、いずれも入力は残す
    violation: なし
    source: US3.4 AC3.4.4、US8.3

  - id: BR4.1
    statement: 予算タブは、対象月の支出カテゴリ全件について、U4 の getEffectiveBudgets の値と出所を表示する
    category: policy
    applies_to: [BudgetEditor]
    trigger: 予算タブの表示時と月の変更
    logic: 行は支出カテゴリの全件（U4 の順）。入力欄には設定済みの値、引き継ぎの値（通常の文字）、空（予算なし）を出し、出所の文字（「設定済み」「引き継ぎ(2026年8月)」「予算なし」）を添える
    violation: なし
    source: US4.1、US4.2、FR4.3

  - id: BR4.2
    statement: 予算の保存は U4 の setBudget で行う。空欄の保存は受け付けず、設定の解除を案内する
    category: validation
    applies_to: [BudgetEditor]
    trigger: 「保存」または Enter
    logic: 入力を U4 の検証に渡す（整数のみ、0〜99,999,999）。失敗は行の下に文言を出し、その入力欄へフォーカスを移す（US9.3）。空欄は「設定を外すには［設定を外す］を使ってください」と案内する。成功は「✓ 食費の予算を保存しました」
    violation: なし
    source: US4.1 AC4.1.1、AC4.1.2、US9.3

  - id: BR4.3
    statement: 設定の解除は、設定済みの月だけに表示し、U4 の clearBudget で行う。結果は文字で示す
    category: policy
    applies_to: [BudgetEditor]
    trigger: 「設定を外す」
    logic: 確認なしで実行する。成功で「✓ 食費の設定を外しました（2026年8月の予算を引き継ぎます）」（引き継ぎ先がなければ「予算なしに戻ります」）。budget-not-set は「この月には設定がありません」。取り消しはなく、同じ額を入れて保存し直す（interaction-spec 流れ C）
    violation: なし
    source: US4.3 AC4.3.1、AC4.3.2、FR4.2

  - id: BR5.1
    statement: 月次集計は U5 の getMonthlySummary の結果を表示する。金額は3桁区切りで、差額のマイナスは「−」と「（赤字）」で示す
    category: policy
    applies_to: [MonthlySummaryView, SummaryCards]
    trigger: 集計タブの表示時と月の変更
    logic: 収入合計・支出合計・差額の3つ。差額が負のときは「−」記号と「（赤字）」の文字を付け、色だけに頼らない（AC9.1.4）。読み込み中と失敗のときは合計欄を「—」にし、0円とは表示しない
    violation: なし
    source: US5.1 AC5.1.1〜AC5.1.3、AC9.1.4

  - id: BR5.2
    statement: 支出カテゴリの行は、予算・実績・残り・状態を表示する。予算なしは「—（予算なし）」、超過は「▲ 超過」を文字で示す
    category: policy
    applies_to: [CategoryBudgetTable]
    trigger: 集計の表示時
    logic: 行は U5 の expenseRows の順。budget が null なら予算と残りを「—（予算なし）」、over が true なら状態を「▲ 超過」。引き継ぎの予算は「(引き継ぎ)」を添える。支出の合計行は expenseTotal
    violation: なし
    source: US5.2 AC5.2.1〜AC5.2.3、FR5.3

  - id: BR5.3
    statement: 収入のカテゴリ別の表は実績だけを表示し、予算の列は持たない
    category: policy
    applies_to: [MonthlySummaryView]
    trigger: 集計の表示時
    logic: 行は U5 の incomeRows の順。列は「カテゴリ」と「実績(円)」のみ
    violation: なし
    source: US5.3 AC5.3.1

  - id: BR5.4
    statement: 収支がない月は、合計を 0 円で表示し、案内と収支タブへの導線を出す
    category: policy
    applies_to: [MonthlySummaryView]
    trigger: hasTransactions が false のとき
    logic: 「この月の収支はまだありません。 [ 収支タブで登録する ]」。予算があるカテゴリは予算と残り（残り＝予算）を表示し、実績は 0 円。読み込み中・読み込み失敗のときは案内を出さない
    violation: なし
    source: US5.4 AC5.4.1、AC5.4.2、FR5.5、FR8.5

  - id: BR6.1
    statement: 書き出しは対象（全期間か月）を選び、U6 の exportTransactions の結果をファイルとして保存させる
    category: policy
    applies_to: [CsvExportPanel]
    trigger: 「CSV を書き出す」
    logic: Blob の一時的な URL を作って保存させ、すぐに解放する（ネットワークは使わない）。成功で「✓ budget-transactions-20261016.csv を書き出しました（3件）」
    violation: なし
    source: US6.1 AC6.1.1〜AC6.1.4、FR6.2

  - id: BR6.2
    statement: 書き出した内容は U6 の結果のまま保存する。画面では数式対策や改行を加工しない
    category: invariant
    applies_to: [CsvExportPanel]
    trigger: 書き出しの保存
    logic: Blob をそのまま保存する。文字列への変換・置換をしない
    violation: なし
    source: US6.2 AC6.2.1〜AC6.2.3

  - id: BR6.3
    statement: 書き出す収支が0件のときは、見出し行だけのファイルを保存し、その旨を表示する
    category: policy
    applies_to: [CsvExportPanel]
    trigger: exportTransactions の headerOnly が true
    logic: 「書き出す収支がないため見出し行のみ出力しました」
    violation: なし
    source: US6.3 AC6.3.1、FR6.4

  - id: BR7.1
    statement: ファイルを選んだら U6 の parseImportFile で確認し、理由が出たら D3 を開かずにその欄へ表示する
    category: policy
    applies_to: [CsvImportPanel, ImportPreviewDialog]
    trigger: 「ファイルを選ぶ」でファイルを選んだとき
    logic: 解析中は「ファイルを確認中…」。ImportFileError は次のとおり表示する。message を持つもの（malformed、read-failed の2種）は U6 の message をそのまま表示し、malformed は「｛行｝行目：」を前に付ける。message を持たないもの（header-mismatch「見出し行の形式が違います」、empty「データがありません」（失敗とは区別する）、too-large「1MB を超えるファイルは読み込めません」、too-many-rows「5,000 行を超えるファイルは読み込めません」）は画面で固定の文言を出す。parseImportFile の OperationError（storage、newer-version）は BR8.2 の読み込み失敗と同じ表示（newer-version は BR1.6）。成功で ImportPreview があれば D3 を開く
    violation: なし
    source: US7.1、US7.3、FR7.5、FR7.6

  - id: BR7.2
    statement: 取り込める行・取り込めない行を表示し、取り込めない行には行番号と理由を付ける。表示する値はエスケープする
    category: policy
    applies_to: [ImportPreviewDialog]
    trigger: D3 の表示時
    logic: 取り込めない行は「｛行｝行目：」＋理由（U6 の文言そのまま）。取り込める行は行番号・日付・種別・カテゴリ・金額・メモを表示する。CSV 由来の値は文字列としてだけ描画する（HTML を組み立てない）。取り込める行が0件なら確定を無効にして「取り込める行がありません」
    violation: なし
    source: US7.1 AC7.1.1〜AC7.1.4、NFR8

  - id: BR7.3
    statement: 既存と同じ内容の行は注記するだけで、取り込み対象からは外さない
    category: policy
    applies_to: [ImportPreviewDialog]
    trigger: sameAsExisting が true の行
    logic: 行に「既存と同じ内容」を表示する。件数の要約には含める
    violation: なし
    source: US7.4 AC7.4.1、AC7.4.2

  - id: BR7.4
    statement: 確定は U6 の commitImport で行い、成功・失敗・カテゴリの削除を区別して示す
    category: policy
    applies_to: [ImportPreviewDialog, CsvImportPanel]
    trigger: 「N件を取り込む」
    logic: 取り込み中は「取り込み中…」と無効化。成功は D3 を閉じ「✓ N件を取り込みました」、フォーカスは「ファイルを選ぶ」。保存失敗は D3 の中に「取り込めませんでした。1件も追加していません」と出し、再試行できる。import-category-missing は「｛行｝行目のカテゴリが見つかりません。ファイルを選び直してください」と出し、D3 を閉じる。commitImport の validation（line 付き）は D3 を閉じず、「｛line｝行目の内容を確認してください」を D3 の中に出して、ファイルを選び直せるようにする（1件も追加しない）
    violation: なし
    source: US7.2 AC7.2.1〜AC7.2.4、U6 の BR4.2

  - id: BR7.5
    statement: キャンセルと Esc では何も追加せず、D3 を閉じて「ファイルを選ぶ」へフォーカスを戻す
    category: policy
    applies_to: [ImportPreviewDialog]
    trigger: キャンセル、Esc
    logic: 保存には触れない。取り込み中はキャンセルを無効にする
    violation: なし
    source: US7.2 AC7.2.2、US9.2 AC9.2.3

  - id: BR8.1
    statement: 読み込み中は、その画面の表示欄に読み込み中の表示を出し、保存系の操作を無効にする。5秒を超えたら時間がかかっている旨を追記する
    category: policy
    applies_to: [StatusPanel, App]
    trigger: 読み取りの開始から完了まで
    logic: StatusPanel の loading（読み上げ「収支を読み込み中」）。5 秒を超えたら「時間がかかっています。しばらく待つか、再読み込みしてください」を追記する（U2 の StatusPanel の slowAfterMs）
    violation: なし
    source: US8.1、FR8.1、FR8.5

  - id: BR8.2
    statement: 読み込みに失敗したら、「データを読み込めませんでした」と [ 再試行 ] を出し、「まだありません」は出さない
    category: policy
    applies_to: [StatusPanel, TransactionList, MonthlySummaryView, BudgetEditor, CategoryManager]
    trigger: 読み取りの失敗（read-failed 相当の storage）
    logic: StatusPanel の error。[ 再試行 ] は同じ読み取りを呼び直す。登録フォームは無効のままにする
    violation: なし
    source: US8.2 AC8.2.1、AC8.2.2、FR8.2

  - id: BR8.3
    statement: 保存に失敗したら、「保存できませんでした。入力内容はそのまま残っています。」を操作の近くに出し、入力を残し、一覧には追加しない
    category: policy
    applies_to: [TransactionForm, CategoryManager, BudgetEditor, ImportPreviewDialog]
    trigger: 書き込みの storage 失敗
    logic: InlineMessage の error（role="alert"、自動では消えない）。入力値は保持する。もう一度の操作で再試行できる
    violation: なし
    source: US8.3 AC8.3.1〜AC8.3.3、FR8.3

  - id: BR8.4
    statement: 保存の場所が使えない（unavailable）ときは、タブと入力を出さず、理由と再読み込みだけを出す
    category: policy
    applies_to: [BootScreen]
    trigger: openBook が unavailable のとき
    logic: 「この環境ではデータを保存できません」（role="alert"）と「通常のウィンドウで開き直してください」と [ 再読み込み ]
    violation: なし
    source: US8.4 AC8.4.1、FR8.4

  - id: BR9.1
    statement: すべての操作はキーボードだけで行える。タブは矢印キーで移動し、本文へは「本文へ移動」のリンクで入れる
    category: invariant
    applies_to: [App, TabNav]
    trigger: すべての画面
    logic: TabNav は U2 の仕様（矢印・Home・End、選択中だけ Tab の到達先）。最初の Tab で「本文へ移動」が現れる。すべての操作はボタン・入力欄として Tab で到達できる
    violation: なし
    source: US9.1、NFR2

  - id: BR9.2
    statement: ダイアログを開くと、フォーカスはダイアログの中に留まり、閉じると開いた操作へ戻る
    category: invariant
    applies_to: [ConfirmDialog, ImportPreviewDialog]
    trigger: D1、D2、D3 の開閉
    logic: U2 の Dialog が Tab の循環と Esc を担う。U7 は開く前に押したボタンを returnFocusRef に渡す。背景のクリックでは閉じない。ダイアログの中から別のダイアログは開かない
    violation: なし
    source: US9.2 AC9.2.1〜AC9.2.3、interaction-spec 1章

  - id: BR9.3
    statement: 入力エラーがあれば、送信時に最初のエラーの項目へフォーカスを移す
    category: policy
    applies_to: [TransactionForm, CategoryManager, BudgetEditor, CsvImportPanel]
    trigger: 送信で validation が返ったとき
    logic: エラーの最初の項目（画面の順）の入力欄へフォーカス。予算の行では、その行の入力欄へ移す
    violation: なし
    source: US9.3 AC9.3.1、AC9.3.2、FR9.4

  - id: BR10.1
    statement: 表示する値は、画面の見た目を変えても意味を変えない。架空データであることを常に示す
    category: policy
    applies_to: [App]
    trigger: すべての画面
    logic: ヘッダーに「※架空データ専用」を常に表示する。金額は 3 桁区切り（例 1,200）。数字の表示は U5・U6 の整数の値をそのまま使う
    violation: なし
    source: C2、project.md、FR5.2
```

## 規則の要約

| 範囲 | 規則 |
|------|------|
| 全体 | BR1.1〜BR1.6、BR10.1 |
| 収支 | BR2.1〜BR2.5 |
| カテゴリ | BR3.1〜BR3.5 |
| 予算 | BR4.1〜BR4.3 |
| 集計 | BR5.1〜BR5.4 |
| CSV | BR6.1〜BR6.3、BR7.1〜BR7.5 |
| 状態表示 | BR8.1〜BR8.4 |
| キーボードとフォーカス | BR9.1〜BR9.3 |

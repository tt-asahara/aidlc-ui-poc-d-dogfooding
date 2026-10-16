# 振る舞いの規則（ui-kit）

- 出典: `inception/refined-mockups/interaction-spec.md`（共通の振る舞い、部品ごとの仕様）、`accessibility-checklist.md`（WCAG 項目 1〜20）、`design-system-mapping.md`、`inception/contract-design/contract-summary.md`（C6）、`inception/requirements-analysis/requirements.md`（FR9、NFR1、NFR2、NFR8）、`inception/user-stories/stories.md`（US9.2）、`functional-design-questions.md`（Q1 = 標準の dialog 要素）

```yaml
rules:
  - id: BR1.1
    statement: 見た目はすべてデザイントークン（CSS 変数）で決め、外部のフォント・アイコン・CSS・画像を読み込まない
    category: constraint
    applies_to: [DesignTokens, 全部品]
    trigger: 部品の表示時
    logic: 色・文字・余白は CSS 変数だけを参照する。アイコンは Unicode の記号を文字として使い、意味は必ず文字でも示す（記号は aria-hidden）
    violation: Lint・テストで外部 URL の参照を検出したら失敗とする
    source: NFR1, ADR-006

  - id: BR1.2
    statement: 動きは 150ms 以下とし、利用者が動きを減らす設定にしているときは止める
    category: policy
    applies_to: [全部品]
    trigger: 状態変化の表示時
    logic: IF prefers-reduced-motion THEN 動きの時間を 0 にする
    violation: なし
    source: NFR2, accessibility-checklist 20

  - id: BR2.1
    statement: ボタンは処理中に押せなくなり、文言を「〜中…」に変える
    category: policy
    applies_to: [ButtonProps]
    trigger: busy が真のとき
    logic: busy が真なら disabled と同じく操作を受け付けず、busyLabel を表示し、aria-busy を真にする。終われば元の文言に戻す
    violation: なし（二重送信の防止。FR2.6）
    source: FR2.6, interaction-spec 共通の振る舞い

  - id: BR2.2
    statement: ボタンは Enter と Space で押せ、フォーカスリング（2px 実線＋2px 余白）が常に見える
    category: policy
    applies_to: [ButtonProps]
    trigger: キーボード操作時
    logic: 標準の button 要素を使う。outline を消さない
    violation: なし
    source: FR9.1, FR9.2, accessibility-checklist 7・12

  - id: BR2.3
    statement: 操作できる部品は高さ・幅とも 44px 以上とする
    category: constraint
    applies_to: [ButtonProps, FieldProps, FileInputProps, TabsProps]
    trigger: 表示時
    logic: 最小寸法を targetMin で指定する
    violation: なし
    source: design-system-mapping 第1章

  - id: BR2.4
    statement: 入力欄・ボタン・ファイル選択は、DOM 要素への参照を呼び出し側に渡せる
    category: policy
    applies_to: [ButtonProps, FieldProps, FileInputProps]
    trigger: 呼び出し側が参照を求めたとき
    logic: 参照を受け取り、内部の実際の DOM 要素に結び付ける（フォーカスの戻し先・最初のエラー項目へのフォーカス移動に使う）
    violation: なし
    source: FR9.3, FR9.4, Contract Design レビュー R-09

  - id: BR3.1
    statement: 入力欄には必ず見えるラベルを付け、必須の項目は「*」と aria-required で示す
    category: validation
    applies_to: [FieldProps]
    trigger: 表示時
    logic: label 要素を入力欄の上に置き、for/id で結び付ける。必須なら見出しに「*」、入力欄に aria-required="true"
    violation: label が空なら開発時に分かるよう型で必須にする
    source: FR2.2, accessibility-checklist 15

  - id: BR3.2
    statement: エラーは入力欄の直下に「⚠ 項目名：直し方」として表示し、入力欄と関連づける
    category: policy
    applies_to: [FieldProps, FieldErrorProps]
    trigger: error が空でないとき
    logic: FieldError を表示し、入力欄に aria-invalid="true" と aria-describedby（FieldError の id）を付ける。枠を 2px にして色以外でも示す
    violation: なし
    source: FR2.2, FR9.4, NFR2, accessibility-checklist 3・14

  - id: BR3.3
    statement: ラジオボタンの群は fieldset と legend で囲み、矢印キーで選択を移す
    category: policy
    applies_to: [FieldProps（RadioGroup）]
    trigger: キーボード操作時
    logic: 標準の radio 入力を同じ name で並べ、選択中の1つだけが Tab で到達できる（ブラウザの標準の振る舞い）
    violation: なし
    source: FR9.1, accessibility-checklist 2

  - id: BR4.1
    statement: 表は caption と列見出し（scope=col）を持つ。金額の列は右寄せで桁をそろえる
    category: policy
    applies_to: [DataTableProps]
    trigger: 表示時
    logic: align=end の列は右寄せ・tabular-nums
    violation: なし
    source: accessibility-checklist 2, design-system-mapping 第3章

  - id: BR4.2
    statement: 幅 768px 未満では、表の各行を見出し付きのカードとして縦に積む
    category: policy
    applies_to: [DataTableProps]
    trigger: 画面幅が narrow のとき
    logic: 各セルに列見出しを添えて縦に並べる（読み上げでは表のまま）
    violation: なし
    source: mockups 第2章, accessibility-checklist 6

  - id: BR5.1
    statement: ダイアログは標準の dialog 要素のモーダル表示で開き、背後を操作できなくする
    category: policy
    applies_to: [DialogProps]
    trigger: open が偽から真になったとき
    logic: 開いた時点でフォーカスがあった要素を記憶し、モーダル表示で開く（背後はブラウザが操作不可にする）。aria-modal は真、題名で aria-labelledby、本文で aria-describedby
    violation: なし
    source: FR9.3, AC9.2.1, Q1

  - id: BR5.2
    statement: 開いたときのフォーカスは initialFocus の要素、なければダイアログ内の最初の操作要素に置く
    category: policy
    applies_to: [DialogProps]
    trigger: 開いた直後
    logic: initialFocus があればそこへ、なければ最初のフォーカス可能な要素へ移す
    violation: なし
    source: FR9.3, interaction-spec ConfirmDialog・ImportPreviewDialog

  - id: BR5.3
    statement: ダイアログが開いている間、Tab と Shift+Tab はダイアログの中で循環し、背後の要素に移らない
    category: policy
    applies_to: [DialogProps]
    trigger: Tab・Shift+Tab の押下時
    logic: 最後の要素で Tab なら最初へ、最初の要素で Shift+Tab なら最後へ移す
    violation: なし
    source: FR9.3, AC9.2.1, accessibility-checklist 8

  - id: BR5.4
    statement: Esc でダイアログを閉じ、閉じる理由（escape）を呼び出し側に伝える
    category: policy
    applies_to: [DialogProps]
    trigger: Esc の押下時
    logic: ブラウザの cancel の動作を受けて onClose("escape") を呼ぶ。閉じるかどうかは呼び出し側の open で決まる（呼び出し側が処理中などで閉じたくない場合に止められる）
    violation: なし
    source: FR9.3, AC9.2.2, AC9.2.3

  - id: BR5.5
    statement: ダイアログが閉じたら、returnFocus の要素、なければ開く前にフォーカスがあった要素へフォーカスを戻す
    category: policy
    applies_to: [DialogProps]
    trigger: open が真から偽になったとき
    logic: 戻し先の要素がまだ画面にあればそこへ移す。なくなっていれば何もしない（呼び出し側が別の戻し先を returnFocus で渡す）
    violation: なし
    source: FR9.3, AC9.2.2, AC9.2.3

  - id: BR5.6
    statement: ダイアログの背景をクリックしても閉じない
    category: policy
    applies_to: [DialogProps]
    trigger: 背景のクリック時
    logic: 何もしない（破壊的な操作の確認と取り込みのため、明示の操作でのみ閉じる）
    violation: なし
    source: mockups D1, interaction-spec ConfirmDialog

  - id: BR6.1
    statement: 状態表示は種類ごとに文言と読み上げの役割を変える。読み込み中と空は status、失敗・利用不可・新しい版は alert とする
    category: policy
    applies_to: [StatusPanelProps]
    trigger: 表示時
    logic: >
      loading → 「⏳ {subject}を読み込み中…」（role=status）。error → 「⚠ データを読み込めませんでした」（role=alert）と action。
      empty → 「{subject}はまだありません。」と action（role=status）。unavailable → 「⚠ この環境ではデータを保存できません」（role=alert）。
      newer-version → 「⚠ 新しい版で保存されたデータのため開けません」（role=alert）。記号は aria-hidden
    violation: なし
    source: FR8.1, FR8.2, FR8.4, FR8.5, AC1.2.3, AC8.1.2

  - id: BR6.2
    statement: 読み込み中が slowAfterMs を超えたら「時間がかかっています。しばらく待つか、再読み込みしてください」を追記する
    category: policy
    applies_to: [StatusPanelProps]
    trigger: kind が loading のまま slowAfterMs が経過したとき
    logic: 経過したら追記を表示する。kind が変われば追記を消し、時間を数え直す
    violation: なし
    source: FR8.5, mockups S1-5

  - id: BR6.3
    statement: 成功の知らせは aria-live=polite で読み上げ、autoHideMs（既定 5000ms）後に消える。フォーカスは移さない
    category: policy
    applies_to: [InlineMessageProps]
    trigger: tone が success で表示されたとき
    logic: 表示後 autoHideMs で非表示にし onHidden を呼ぶ。同じ文言が再び来たら時間を数え直す
    violation: なし
    source: refined-mockups Q6, accessibility-checklist 19

  - id: BR6.4
    statement: 失敗の知らせは role=alert で読み上げ、自動では消えない
    category: policy
    applies_to: [InlineMessageProps]
    trigger: tone が error で表示されたとき
    logic: 呼び出し側が消すまで表示し続ける
    violation: なし
    source: FR8.3, interaction-spec 共通の振る舞い

  - id: BR7.1
    statement: ファイル選択は標準の file 入力に見えるラベルを付け、Enter・Space で選択画面を開ける。選んだファイルを渡した後は入力を空に戻す
    category: policy
    applies_to: [FileInputProps]
    trigger: ファイルの選択時
    logic: change で選ばれた最初のファイルを onSelect に渡し、入力の値を空に戻す（同じファイルをもう一度選べるようにする）。ファイルが選ばれなかった場合は何もしない
    violation: なし
    source: FR7.1, mockups S5, AC9.1.1

  - id: BR8.1
    statement: タブは tablist・tab・tabpanel の役割を持ち、選択中のタブだけが Tab キーで到達できる
    category: policy
    applies_to: [TabsProps]
    trigger: 表示時
    logic: 選択中のタブは tabindex=0 と aria-selected=true、ほかは tabindex=-1。tabpanel は aria-labelledby で対応するタブと結ぶ
    violation: なし
    source: FR9.1, interaction-spec TabNav, accessibility-checklist 18

  - id: BR8.2
    statement: 左右の矢印でタブを移ると同時に選択し、Home・End で先頭・末尾へ移る。端では反対の端へ回り込む
    category: policy
    applies_to: [TabsProps]
    trigger: タブにフォーカスがある状態での矢印・Home・End の押下
    logic: 移動先のタブにフォーカスを移し onSelect を呼ぶ
    violation: なし
    source: FR9.1, interaction-spec TabNav

  - id: BR8.3
    statement: 選択中のタブは下線と太字で示し、色だけに頼らない
    category: policy
    applies_to: [TabsProps]
    trigger: 表示時
    logic: 選択中のタブに下線（3px）と太字
    violation: なし
    source: NFR2, accessibility-checklist 3
```

## 規則の概要

| ID | 対象 | 内容 |
|----|------|------|
| BR1.1・BR1.2 | 全部品 | 外部資源なし、動きの抑制 |
| BR2.1〜BR2.4 | ボタンなど | 処理中、キーボード、44px、DOM 参照の公開 |
| BR3.1〜BR3.3 | 入力欄 | ラベル・必須、エラーの関連づけ、ラジオの群 |
| BR4.1・BR4.2 | 表 | 見出し・右寄せ、狭い幅でのカード表示 |
| BR5.1〜BR5.6 | ダイアログ | 標準 dialog のモーダル、初期フォーカス、Tab の循環、Esc、戻し、背景クリック無効 |
| BR6.1〜BR6.4 | 状態表示・知らせ | 種類ごとの文言と役割、遅いときの追記、成功は 5 秒で消える、失敗は残る |
| BR7.1 | ファイル選択 | ラベル、キーボード、同じファイルの再選択 |
| BR8.1〜BR8.3 | タブ | 役割、矢印・Home・End、選択の示し方 |

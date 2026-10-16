# Unit 定義（Unit of Work）

- 出典: `inception/domain-design/components.md`（10部品）、`inception/domain-design/decisions.md`（ADR-001〜ADR-007）、`inception/requirements-analysis/requirements.md`、`inception/user-stories/stories.md`、`units-generation-questions.md`（Q1〜Q3、分割計画の承認）
- 分け方: 部品の結びつきの強さでまとめた 7 Unit（Q1 = A）。すべて1つのパッケージ内の Unit 別フォルダに置き、Unit 間はフォルダの公開窓口（`index.ts`）だけを通して参照する。ビルド成果物は1つの Web アプリ（Q2 = A）。
- 依存関係は `unit-of-work-dependency.md`、ストーリーの割り当ては `unit-of-work-story-map.md` にある。どの Unit から作るかは Delivery Planning で決める。

## 1. Unit の一覧

| Unit ID | Directory | Unit 名 | 種類（kind） | 含む部品 | 規模 |
|---------|-----------|---------|--------------|----------|------|
| U1 | u1-data-contract | data-contract | spec | DataContract | M |
| U2 | u2-ui-kit | ui-kit | library | UiKit | M |
| U3 | u3-storage | storage | library | Storage | M |
| U4 | u4-bookkeeping-core | bookkeeping-core | library | Ledger、CategoryCatalog、BudgetPlanner、BookkeepingService | L |
| U5 | u5-monthly-summary | monthly-summary | library | MonthlySummary | S |
| U6 | u6-csv-exchange | csv-exchange | library | CsvExchange | M |
| U7 | u7-app-screens | app-screens | ui | AppScreens | L |

- 規模は相対的な目安（S < M < L < XL）。
- 種類の意味: `spec` はほかの Unit がそのまま使う型と規則の約束、`library` は単独では動かない再利用コード、`ui` は利用者が操作する画面（Q3 = A）。
- ソースコードの置き場所（予定）: `src/<unit-name>/`（例: `src/data-contract/`）。テストは各 Unit のフォルダ内に置く。Construction の設計書は `construction/u{n}-{名前}/` に置く。

## 2. Unit ごとの定義

### U1 data-contract（共通データ契約）

- **説明**: 全 Unit が共有する、収支・カテゴリ・予算・CSV 行の形と、値の検証規則、CSV の符号化・復号、保存スキーマの版番号。
- **境界**: 状態を持たない純粋な関数と型だけ。保存・画面・ブラウザの機能には触れない。どの Unit にも依存しない。
- **責任と成果物**:
  - 値の検証と正規化（日付 YYYY-MM-DD の実在する暦日、対象月 YYYY-MM、金額 1〜99,999,999 の整数、予算額 0〜99,999,999 の整数、メモ 0〜200 文字、カテゴリ名 1〜20 文字と重複の比較規則）
  - 項目名と理由を含む検証エラーの形と日本語の文言（画面と CSV で共通）
  - CSV の行の符号化・復号（見出し、RFC 4180 の引用、BOM、CRLF/LF、数式対策の往復）
  - 保存スキーマの版番号
- **配置**: 埋め込み（他の Unit から import される）
- **実装上の注意**: team.md の Testing Posture により、この Unit はテストを先に書く。ADR-001・ADR-005・ADR-007 に従う。ブラウザ API に依存しないため、Node 系の実行環境でも単体テストできる形にする。

### U2 ui-kit（画面部品）

- **説明**: 業務の知識を持たない見た目の部品とデザイントークン。
- **境界**: 標準の HTML 要素と自前の CSS だけで作り、外部ライブラリ・フォント・CDN を使わない。どの Unit にも依存しない。
- **責任と成果物**: Button、TextField、RadioGroup、Select、DataTable、Dialog、StatusPanel、InlineMessage、FieldError、FileInput、Tabs と、色・文字・余白・画面幅のトークン（refined-mockups の design-system-mapping.md）。部品単位のキーボード操作、フォーカスの閉じ込めと戻し、状態の読み上げ。
- **配置**: 埋め込み（U7 から import される）
- **実装上の注意**: ADR-006。日付欄は文字入力（ADR-005）。アクセシビリティの自動検査を部品単位で行える形にする。

### U3 storage（保存）

- **説明**: IndexedDB を包み、1回の書き込み処理（すべて成功かすべて取り消し）と失敗の種類の区別を提供する。
- **境界**: IndexedDB を直接扱うのはこの Unit だけ。業務規則は持たない。依存は U1（スキーマ版と保存する形）のみ。
- **責任と成果物**: データベースの開始、版の確認（新しい版なら触れない）と移行、保存領域（収支・カテゴリ・予算・メタ情報）、1回の書き込み処理、失敗の種類（利用不可・新しい版・書き込み失敗・読み込み失敗）。テスト用に、失敗・遅延を起こせる差し替えを提供する。
- **配置**: 埋め込み
- **実装上の注意**: ADR-004。ネットワークに一切アクセスしない。

### U4 bookkeeping-core（家計簿の中核）

- **説明**: データの持ち主（収支 Ledger、カテゴリ CategoryCatalog、予算 BudgetPlanner）と、部品をまたぐ書き込みの調整役（BookkeepingService）。
- **境界**: 書き込みはすべて BookkeepingService を入り口にし、Storage の1回の書き込み処理の中で部品間の規則を確かめる。持ち主同士は互いに依存しない。依存は U1・U3。
- **責任と成果物**:
  - 収支の追加・更新・削除、対象月の一覧（定められた並び順）、期間の取得、カテゴリ別の使用件数
  - 初期カテゴリの作成、カテゴリの追加・名前変更・削除、存在・種別の確認
  - 予算の設定・解除、引き継ぎを含む「その月に使う予算」と出所の算出、カテゴリ単位の予算削除
  - 書き込み操作の結果（成功・検証エラー・規則違反・保存失敗）の区別
- **配置**: 埋め込み
- **実装上の注意**: ADR-002・ADR-007。4部品を1 Unit にまとめたのは、ADR-002 の調整役と3つの持ち主が同じ書き込み処理の中で協調し、別 Unit に分けると Unit 間の約束が増えるため（Q1）。Domain Design のレビューで受け入れた指摘（初期カテゴリの作成を誰の書き込み処理で行うか、二重作成の防止）は、この Unit の Functional Design で決める。

### U5 monthly-summary（月次集計）

- **説明**: 対象月の合計3値とカテゴリ別の予算・実績・残り・超過を、表示のたびに計算する。
- **境界**: データを持たず保存もしない（ADR-003）。依存は U1・U4（収支・カテゴリ・その月に使う予算の読み取り）。
- **責任と成果物**: 収入合計・支出合計・差額、支出カテゴリ別の行（予算の出所つき）、収入カテゴリ別の実績、収支がない月の判定。
- **配置**: 埋め込み
- **実装上の注意**: 計算の核は、U4 から受け取った値だけを入力とする純粋な関数にし、単独でテストできる形にする。整数計算のみ（NFR5）。

### U6 csv-exchange（CSV 入出力）

- **説明**: CSV の書き出し（全期間・月指定）と、読み込みの上限確認・解析・検証・プレビュー作成・確定の依頼。
- **境界**: ファイルの読み取りと生成はブラウザ内で行い、ネットワークを使わない。依存は U1（符号化・検証）・U4（収支の取得、カテゴリ名の照合、一括追加）。
- **責任と成果物**: 書き出し（ファイル名の規則、0件のときの見出し行のみ）、読み込み（1MB・5,000 行の上限、見出し不一致・空ファイルの区別、行番号つきの不正行、既存と同じ内容の注記）、確定時の一括追加の依頼。
- **配置**: 埋め込み
- **実装上の注意**: Domain Design のレビューで受け入れた指摘（プレビュー後・確定前に別タブでカテゴリが削除された場合の結果と通知）は、この Unit の Functional Design で決める。

### U7 app-screens（画面）

- **説明**: アプリ枠（タブ、共有の対象月、起動時の状態表示）と5画面（収支・月次集計・予算・カテゴリ・CSV）。
- **境界**: 業務規則を持たず、書き込みはすべて U4 の BookkeepingService を通す。依存は U1・U2・U4・U5・U6。
- **責任と成果物**: refined-mockups の mockups.md と interaction-spec.md の画面・状態・操作の流れ。アプリの起動点（`main.tsx` 相当）と、Vite でのビルド・起動。
- **配置**: 単独で動く（ビルド成果物の入り口）
- **実装上の注意**: Domain Design のレビューで受け入れた指摘（起動時の保存領域の状態を画面へ渡す経路）は、この Unit と U3 の約束として Contract Design で決める。外部送信なし（NFR1）の確認は、この Unit の画面操作テストで行う。

## 3. 配布の形

- 1つのパッケージ（TypeScript ＋ React ＋ Vite）としてローカルでビルド・起動する。デプロイはしない（team.md Deployment）。
- マージ前の一括検証コマンド（lint・型チェック・テスト・行カバレッジ 80%）は、パッケージ全体に対して1つ（team.md Testing Posture、Q2）。

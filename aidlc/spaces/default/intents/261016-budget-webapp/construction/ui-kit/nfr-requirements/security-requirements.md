# 安全性とアクセシビリティの要件（ui-kit）

- 出典: `inception/requirements-analysis/requirements.md`（NFR1、NFR2、NFR7、NFR8）、`construction/ui-kit/functional-design/rules.md`（BR1.1〜BR8.3）、`inception/refined-mockups/accessibility-checklist.md`、`inception/contract-design/contract-summary.md`（C6）、`aidlc/spaces/default/memory/project.md`
- U2 は業務データ・保存・通信を持たない見た目の部品。認証・認可は対象外（単一利用者、requirements.md A1）。

## 1. 要件

| ID | 要件 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR1.1 | U2 の部品は外部のフォント・アイコン・CSS・画像・スクリプトを読み込まず、ネットワーク要求を一切出さない | ESLint で `src/ui-kit/` の非テストファイルに通信・保存の参照（fetch、XMLHttpRequest、WebSocket、EventSource、navigator.sendBeacon、indexedDB、localStorage、sessionStorage）を禁止する。CSS とコード中の `http://`・`https://`・`//` で始まる URL を検出するテスト | NFR1、BR1.1 |
| NFR2.1 | 部品ごとに自動のアクセシビリティ検査（axe-core、WCAG 2.1 A・AA の規則）で違反0件 | 各部品の代表的な状態（通常・エラー・処理中・開いたダイアログ）を描画して検査するテスト | NFR2 |
| NFR2.2 | キーボードだけで部品を操作でき、フォーカスが見え、ダイアログで迷子にならない（BR2.2、BR3.3、BR5.1〜BR5.5、BR8.1〜BR8.2） | user-event によるキーボード操作のテスト（Tab・Shift+Tab・Enter・Space・Esc・矢印・Home・End） | NFR2、FR9、AC9.2.1〜AC9.2.3 |
| NFR2.3 | 状態は色だけで示さない。選択中のタブ・エラー・知らせは文字や記号でも示す（BR3.2、BR6.1、BR8.3） | 描画結果に文字・記号が含まれることのテスト | NFR2、AC9.1.4 |
| NFR2.4 | 文字のコントラスト比 4.5:1 以上、部品の枠とフォーカスリング 3:1 以上 | デザイントークンの色の組み合わせのコントラスト比を計算するテスト（jsdom では描画色を計算できないため、トークンの値で判定する） | NFR2、design-system-mapping |
| NFR8.1 | 部品は渡された文字列を文字として表示し、HTML として挿入しない（React の通常の描画のみ。`dangerouslySetInnerHTML` を使わない） | ESLint で `react/no-danger` 相当を禁止し、`<script>` を含む文字列が文字として表示されるテスト | NFR8 |
| NFR7.1 | 標準の dialog 要素のモーダル表示は、対応ブラウザ（最新の Chrome、Edge、Firefox、Safari）の標準機能だけで動く | 対応ブラウザでの確認は U7 の画面確認で行う。部品のテストでは jsdom に最小限の補いを入れて振る舞いを確かめる | NFR7 |

## 2. 脅威と対策

| 脅威 | 対策 | 関連 |
|------|------|------|
| 利用者の入力や CSV 由来の文字列による画面への HTML・スクリプトの挿入 | 文字としてだけ表示（NFR8.1） | NFR8 |
| 外部資源の読み込みによる意図しない通信 | 外部資源なし・通信の参照禁止（NFR1.1） | NFR1 |
| フォーカスの閉じ込めの失敗による誤操作（背後の削除ボタンを押してしまう） | 標準 dialog のモーダル表示と Tab の循環（NFR2.2） | FR9.3 |

## 3. コンプライアンス

- 個人情報・決済情報を扱わない（架空データのみ）。アクセシビリティは WCAG 2.1 AA の主要項目を目標とする（NFR2）。

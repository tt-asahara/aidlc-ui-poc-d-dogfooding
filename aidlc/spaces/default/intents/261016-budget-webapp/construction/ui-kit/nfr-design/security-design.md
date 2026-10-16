# 安全性とアクセシビリティの設計（ui-kit）

- 出典: `construction/ui-kit/nfr-requirements/security-requirements.md`（NFR1.1、NFR2.1〜NFR2.4、NFR7.1、NFR8.1）、`tech-stack-decisions.md`（NFR3.1、NFR6.1、NFR6.2、NFR9.1）、`construction/ui-kit/functional-design/rules.md`（BR1.1〜BR8.3）、`inception/contract-design/contract-summary.md`（C6）、プロジェクト共通の設定（package.json、vitest.config.ts、eslint.config.js、tsconfig.json）
- U2 は種類 library のため、性能・拡張性・信頼性・監視の設計書は作らない。目標を満たす手段はこの文書の第5章にまとめる。

## 1. 認証・認可・暗号化

- 対象外（U2 は利用者・保存・通信を持たない）。

## 2. 共通の設定の拡張（NFR Requirements レビュー Major 1 への対応）

U1 で作った共通の設定は `.ts` と node 環境だけを対象にしている。U2 の部品（`.tsx`）を同じ検証コマンドで確かめられるよう、次のとおり広げる。U1 の設定・テストの結果は変えない。

| 設定 | 変更 |
|------|------|
| tsconfig.json | `"jsx": "react-jsx"` を加える。`include` は `src` のまま（`.tsx` も対象になる） |
| vitest.config.ts | テストの対象を `src/**/*.test.{ts,tsx}` に、カバレッジの対象を `src/**/*.{ts,tsx}`（テストを除く）に広げる。環境の既定は node のまま、`src/ui-kit/**` のテストは jsdom で動かす（Vitest のプロジェクト設定で U2 用の環境と準備ファイルを分ける）。行 80% のしきい値は変えない |
| テストの準備ファイル | `src/ui-kit/test-setup.ts`: jest-dom の照合を有効にし、jsdom に標準 dialog の補い（第3章）を入れる。U2 のテストだけが読み込む |
| eslint.config.js | 型情報を使う規則の対象に `**/*.tsx` を加える。`src/ui-kit/**/*.{ts,tsx}`（テストを除く）に、通信・保存の参照禁止（第4章）と `dangerouslySetInnerHTML` の禁止を加える。react-hooks の規則を `.tsx` に適用する |

## 3. 標準 dialog とその確認（NFR2.2、NFR7.1、Major 2 への対応）

### 3.1 実行時の設計

```text
open: false → true
  ├─ 開く前のフォーカス要素を記憶
  ├─ dialog.showModal()         … 背後の操作不可・Esc の cancel はブラウザが担う
  ├─ 初期フォーカスへ移動（BR5.2）
  └─ keydown(Tab) を dialog で受け、端で循環（BR5.3）
cancel イベント（Esc）
  ├─ event.preventDefault()    … ブラウザに勝手に閉じさせない（open と表示の食い違いを防ぐ）
  └─ onClose("escape")         … 閉じるかは呼び出し側の open で決める（BR5.4）
open: true → false
  ├─ dialog.close()
  └─ 戻し先へフォーカス（BR5.5、要素が消えていれば何もしない）
```

- FD レビューの Major（cancel の既定動作を止める記述がない）への対応として、cancel では必ず既定動作を止め、表示の開閉は `open` の値だけで決める。
- 背景のクリックでは閉じない（BR5.6）。dialog 自身へのクリックを閉じる処理につなげない。

### 3.2 テストでの補い（jsdom）

- jsdom が対応していない `showModal`・`close` だけを、テストの準備ファイルで最小限に補う（`open` 属性の付け外しと、背後の要素に `inert` を付けることでモーダルを模す）。Esc は、テストの中で dialog に `cancel` イベントを送って再現する。
- 補いは実行時のコードに入れない。補いのある環境で通ることは、実ブラウザで通ることの証明にはならないため、次の 3.3 で実ブラウザの確認を行う。

### 3.3 実ブラウザでの確認（U7 の Build and Test で実施）

| # | 確認項目 | 方法 |
|---|----------|------|
| B1 | 削除確認を開くとフォーカスが「キャンセル」にあり、Tab・Shift+Tab がダイアログの外に出ない | 対応ブラウザでアプリを起動し、キーボードだけで操作する |
| B2 | Esc でダイアログが閉じ、押した「削除」ボタンにフォーカスが戻る | 同上 |
| B3 | 取り込みプレビューを Esc で閉じると「ファイルを選ぶ」にフォーカスが戻る | 同上 |
| B4 | ダイアログ表示中に背後のボタンをクリックできない | 同上 |
| B5 | 文字と背景のコントラスト（ブラウザの開発者ツールのアクセシビリティ表示で 4.5:1 以上） | 同上 |

- 実施するブラウザ: 手元の端末で使える最新のブラウザ（少なくとも1種類）。対応ブラウザ4種すべての確認は、端末にあるものに限る（追加のブラウザの取得はしない）。結果は Build and Test の記録に残す。

## 4. 外部資源と表示の安全（NFR1.1、NFR8.1）

| 手段 | 内容 |
|------|------|
| 通信・保存の参照禁止 | `src/ui-kit/` の非テストファイルで `fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`、`navigator.sendBeacon`、`indexedDB`、`localStorage`、`sessionStorage` を ESLint で禁止する（U1 の禁止一覧とは別に、U2 用の一覧を設ける。時計とタイマーは知らせの自動非表示・遅延の追記で使うため禁止しない） |
| 外部 URL の検出 | テストで `src/ui-kit/` の CSS・`.ts`・`.tsx` を読み、`url(http`、`url(//`、`@import`、`http://`、`https://` を含まないことを確かめる（`//` 単独は行コメントと区別できないため対象にしない。NFR Requirements レビュー Minor への対応） |
| HTML の挿入禁止 | ESLint の `no-restricted-syntax` で JSX の `dangerouslySetInnerHTML` 属性を禁止する。`<script>alert(1)</script>` を渡した部品が文字として表示するテスト |

## 5. 目標を満たす手段

| ID | 手段 |
|----|------|
| NFR2.1 | 各部品の代表的な状態を描画し、axe-core（`wcag2a`、`wcag2aa`、`wcag21a`、`wcag21aa` のタグ）で検査して違反0件を確かめるテスト。jsdom では色を計算できないため `color-contrast` 規則は対象外とし、NFR2.4 と第3.3章 B5 で補う |
| NFR2.2 | user-event でキーボード操作を再現するテスト（Tab・Shift+Tab・Enter・Space・Esc・矢印・Home・End） |
| NFR2.3 | 選択中のタブ・エラー・知らせの描画結果に文字・記号が含まれることのテスト |
| NFR2.4 | `tokens.ts`（トークンの値を TypeScript の定数として持ち、CSS 変数はそこから同じ値で書く）の色の組み合わせについて、WCAG の相対輝度の式でコントラスト比を計算するテスト（文字 4.5:1、枠とフォーカス 3:1） |
| NFR6.1 | 共通の行 80% しきい値。部品ごとに正常系と2つ以上の異常・境界の例 |
| NFR6.2 | U2 は画面の層なので、部品を実装した後にテストを書く（Testing Contract の ordering） |
| NFR7.1 | 第3章（標準 dialog の利用と実ブラウザでの確認項目 B1〜B5） |
| NFR9.1 | 追加する依存（react、react-dom、@types/react、@types/react-dom、@testing-library/react、@testing-library/user-event、@testing-library/jest-dom、jsdom、axe-core、eslint-plugin-react-hooks）を正確なバージョンで入れ、ロックファイルをコミット対象にする |
| BR1.2・BR2.3・BR4.2 | CSS の規則（`prefers-reduced-motion`、`min-height`・`min-width: 44px`、768px 未満のメディアクエリ）として実装し、CSS ファイルに該当の記述があることをテストで確かめる。見た目の実測は第3.3章の実ブラウザ確認で行う |

## 6. 残る危険

| 危険 | 扱い |
|------|------|
| jsdom の補いと実ブラウザの dialog の振る舞いの差 | 第3.3章の実ブラウザ確認（B1〜B4）で補う |
| axe-core の自動検査が全項目を見ない（約3割） | キーボード操作のテストと実ブラウザ確認で補う（accessibility-checklist.md の分担） |

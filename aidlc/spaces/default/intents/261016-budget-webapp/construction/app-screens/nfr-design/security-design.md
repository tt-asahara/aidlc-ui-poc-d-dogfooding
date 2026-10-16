# 安全性と信頼性の設計（app-screens）

- 出典: `construction/app-screens/nfr-requirements/security-requirements.md`（NFR1.1、NFR2.1、NFR2.2、NFR4.1、NFR5.1、NFR8.1、NFR8.2、NFR9.1）、`construction/app-screens/nfr-requirements/tech-stack-decisions.md`、`construction/app-screens/functional-design/rules.md`（BR1.1〜BR10.1）、`construction/ui-kit/nfr-design/security-design.md`（U2 の部品の禁止と実ブラウザの確認 B1〜B5）、`construction/csv-exchange/nfr-design/security-design.md`（U6 の表示の扱い）
- U7 は表示と操作の部品。保存・計算・通信は持たない。安全性の中心は、利用者の値を画面に安全に出すこと（エスケープ）と、外部へ通信しないこと。

## 1. 表示の安全（NFR8.1）

- 利用者の入力（メモ、カテゴリ名）と CSV 由来の値（raw を含む）は、U2 の部品に文字列として渡し、React の通常の文字列描画だけで表示する。HTML として組み立てない。
- 禁止（ESLint、`src/app/` の非テストファイル）: dangerouslySetInnerHTML、innerHTML、outerHTML、insertAdjacentHTML（U2 と同じ規則）。
- CSV の値を URL・属性・スクリプトの文脈に入れない（表示の文字列だけ）。
- 「※架空データ専用」の表示（BR10.1）は固定の文字列で、利用者の値を含めない。

## 2. 通信と保存先（NFR1.1）

- 禁止（ESLint、`src/app/`）: fetch、XMLHttpRequest、WebSocket、EventSource、navigator.sendBeacon、indexedDB、localStorage、sessionStorage、document.cookie、eval、new Function。`window`・`globalThis`・`self` 経由の同じ参照も禁止（U2・U4 と同じ一覧）。
- import の規則（ESLint の `src/app/` のブロックの no-restricted-imports）: 許可するのは次の公開窓口だけ。`../data-contract`、`../ui-kit`、`../bookkeeping-core`、`../monthly-summary`、`../csv-exchange` の index（`index` で終わる import）。禁止するのは、それ以外の各 Unit の内部ファイル（例: `../bookkeeping-core/book`、`../data-contract/csv`）と、U3 の `../storage` とその下位のすべて、`fake-indexeddb`。画面が保存の本体（U3）を直接使うことはない（openBook の中で U4 が使う）。
- ビルド成果物に外部の URL（http://、https://、//）が含まれないことを、テストで確かめる（U2 の no-external の方式）。ただし、利用者の文字列としての表示の中の URL は対象外。
- フォントと画像は、アプリに同梱したものだけを使う。

## 3. ファイルのダウンロード（NFR9.1）

- 書き出しは U6 の Blob を `URL.createObjectURL` で一時的な URL にし、保存に使う（BR6.1）。
- 解放は保存の開始の後、`setTimeout` で 1000ms 遅らせて行う（click の直後に同期で解放すると、ブラウザによってはダウンロードが始まらないため）。画面を離れても残らないよう、コンポーネントの後片付けでも解放する。
- Chrome 以外（Edge、Firefox、Safari）のダウンロードの成功は、手動確認の項目に含める（Build and Test）。

## 4. 操作の安全（NFR4.1、BR2.2、BR8.3）

- 保存中の二重送信は、保存系のボタンの無効化と、送信中のフラグで防ぐ（Enter を含む）。
- 保存の失敗では入力を残し、一覧には追加しない（表示は保存に成功したデータだけ）。
- newer-version を受けたら S0-b に切り替え、以後の操作を止める（BR1.6）。

## 5. キーボードとフォーカス（NFR2.1、BR9.1〜BR9.3）

- 操作はすべて Tab で到達できるボタン・入力欄とし、クリックだけの要素を作らない。
- ダイアログ（D1〜D3）は U2 の Dialog を使い、フォーカスの循環、Esc、戻し先（returnFocusRef）を U2 の規則のまま使う。
- 入力エラーでは、送信時に最初のエラーの入力欄へフォーカスを移す（BR9.3）。

## 6. テストと実ブラウザの確認

- 自動テスト（jsdom）: 上の禁止の検査（ESLint と、外部 URL の検査）、表示の文字列（`<script>` を含む値）、ダイアログのフォーカス、キーボードだけの主な操作、保存中の二重送信、newer-version での切り替え、Blob の解放。
- 実ブラウザ（Build and Test）: U2 から引き継いだ B1〜B5（フォーカス、Esc、背後の操作不可、コントラスト）、ネットワーク要求の記録が0件（開発者ツール）、キーボードだけでの主な操作、再読み込み後の保持（AC1.2.1）、保存失敗の表示（AC8.3.1）。

## 7. 外部に出さないこと（まとめ）

| 項目 | 対応 |
|------|------|
| 通信 | 禁止の一覧（上の2章）と、外部 URL の検査 |
| 保存先の直接参照 | no-restricted-imports（U3 の直接 import の禁止）と no-restricted-globals |
| HTML の挿入 | dangerouslySetInnerHTML 等の禁止（U2 と同じ） |
| 評価 | eval、new Function の禁止 |

## 8. 表示・検査・テストの規則（NFR2.2、NFR5.1、NFR6.1、NFR6.2、NFR8.2）

- **アクセシビリティの自動検査（NFR2.2）**: 画面ごとに主な状態（通常、入力エラー、読み込み中、読み込み失敗、保存失敗、ダイアログを開いた状態）で axe-core を実行し、違反0件を確かめる（U2 と同じ規則。color-contrast は実ブラウザで補う）。
- **金額の表示（NFR5.1）**: 画面は金額を整数のまま受け取り、表示の関数で 3 桁区切りにする（例: 1200 → 1,200）。画面の中で金額を小数で計算しない。差額のマイナスは「−」と「（赤字）」の文字で示す（BR5.1）。
- **テストの対象（NFR6.1）**: `src/app/**` の行カバレッジ 80% 以上を、vitest.config.ts の app 用プロジェクトの coverage 設定でディレクトリ単位に確かめる。しきい値は下げない。
- **テストの順序（NFR6.2）**: 画面の部品と操作は、実装の後にそのテストを書いて実行する（「その他のレイヤー」）。
- **CSV の内容（NFR8.2）**: 書き出しは U6 の Blob をそのまま保存する。画面は内容を読み直さず、加工もしない。書き出したファイルの内容が U6 の結果と同一であることを、テストで確かめる。

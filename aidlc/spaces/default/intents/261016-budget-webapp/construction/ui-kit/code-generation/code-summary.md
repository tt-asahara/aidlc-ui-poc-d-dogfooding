# コード生成のまとめ（ui-kit）

## 作成・変更したファイル

| 区分 | ファイル |
|------|----------|
| 部品（新規） | src/ui-kit/ の Button.tsx、fields.tsx（TextField・Select・RadioGroup・FieldError）、DataTable.tsx、Dialog.tsx、Tabs.tsx、FileInput.tsx、StatusPanel.tsx、InlineMessage.tsx、index.ts |
| トークンと見た目（新規） | src/ui-kit/ の tokens.ts、tokens.css、ui-kit.css |
| テスト（新規） | src/ui-kit/ の Button.test.tsx、fields.test.tsx、DataTable.test.tsx、Dialog.test.tsx、Tabs.test.tsx、FileInput.test.tsx、StatusPanel.test.tsx、InlineMessage.test.tsx、index.test.ts、no-external.test.ts、tokens.test.ts、lint-config.test.ts、test-setup.ts（テスト専用）、test-fixtures.ts（テスト専用） |
| 共通設定（変更） | package.json、package-lock.json、tsconfig.json（jsx: react-jsx）、vitest.config.ts（U1 は node・U2 は jsdom の2プロジェクト、.tsx をカバレッジ対象に、src/ui-kit/** に行 80%）、eslint.config.js（.tsx の型情報つき検査、react-hooks、U2 用の通信・保存の参照禁止と HTML 挿入の禁止）、README.md |
| 設計文書（契約の更新） | inception/contract-design/contract-summary.md の C6 |

- src/data-contract/ は変更していない。

## テストとカバレッジ

- `npm run verify`: 成功（終了コード 0）。開発担当の最終実行と、オーケストレーター側の再実行（2026-10-16T10:47Z 頃）の両方で、20 ファイル・325 件（U1 212 件、U2 113 件）がすべて合格した。
- 行カバレッジ: 全体 100%（371/371）、src/ui-kit/** 100%。文 99.42%、分岐 95.23%。しきい値（全体と src/ui-kit/** の行 80%）は下げていない。
- テストの順序: U2 は画面の層なので、各部品を実装した後にテストを書いた（Testing Contract）。
- 追加した依存（正確なバージョンで固定）: react 19.3.1、react-dom 19.3.1、@types/react 19.3.0、@types/react-dom 19.3.0、@testing-library/react 16.3.3、@testing-library/user-event 14.6.8、@testing-library/jest-dom 7.0.1、jsdom 30.1.3、axe-core 4.14.0、eslint-plugin-react-hooks 7.1.1、@types/node 24.19.2（@testing-library/dom 10.4.2 は peer 依存としてロックファイルのみ）。

## 主な実装上の判断

- DOM 参照は React 19 の `ref` を通常の prop として受け取る（forwardRef なし）。RadioGroup の ref は選択中、未選択なら先頭のラジオに結び付く。
- Button の処理中は `aria-disabled` でクリックを無視し、フォーカスを失わせない（submit でも送信しない）。
- Dialog の開閉は `open` の値だけで決める。`cancel`（Esc）は既定動作を止めて `onClose("escape")`。`open` が真のまま `close` イベントで閉じられた場合は、モーダルに戻したうえで `onClose("escape")` を呼び、表示と状態を合わせる（NFR Design レビューの Major への対応）。戻し先が消えていれば何もしない。
- FieldError は「項目名：直し方」にそろえ、項目名で始まる文言（U1 の文言）には項目名を重ねない。
- TextField の onEnter は日本語変換の確定（isComposing）では呼ばない。
- StatusPanel の遅延の追記は loading の間だけ描画される子部品が持ち、kind が変わるとタイマーも取り消される。InlineMessage は画面から外れるとタイマーを取り消す（テストで確認）。

## 計画との違い

| 違い | 理由 |
|------|------|
| @types/node の追加 | ファイルを読むテスト（no-external、tokens）の型チェックに必要 |
| lint-config.test.ts、test-fixtures.ts の追加 | Lint の禁止が効くことの確認（U1 と同じ形）、axe 検査の共通化 |
| test-setup.ts を Step 4 で先に作成 | Step 4 のテストが jest-dom と後片付けを必要としたため |
| テスト件数 113 件（計画は約50件） | it.each の展開と Lint のテストの追加 |
| C6 に InlineMessage の任意項目 `onHidden` を追加、Dialog の ref の型を `RefObject<HTMLElement \| null>` に | 計画の Step 8・entities.md にあるため／React 19 の useRef(null) をそのまま渡すため |
| eslint.config.js の最初の書き換えをシェル（python3）で実施 | 開発担当の手順の誤り（指示ではファイル用の道具を使う決まり）。結果は確認済みで、以降はファイル用の道具のみ |
| 自分が変更したファイルに `npx prettier --write` を適用 | 整形チェックを通すため |

## 残る課題

- 標準 dialog の確認は jsdom の補いの上に留まる。実ブラウザでの確認 B1〜B5（フォーカス・Esc・背後の操作不可・コントラスト）は U7 の Build and Test で行う。
- `src/ui-kit/**` のしきい値が 80% 未満で実際に失敗するかは試していない。
- 枠の色 `--color-border` は白背景で 3.04:1、`--color-surface` の上では 2.81:1 で 3:1 を下回る。入力欄は surface の上に置かない前提（U7 の画面で守る）。
- プレビュー用の幅広ダイアログ（720px）は C6 に幅の項目がないため未対応。U7 で必要なら C6 に任意の項目を追加する。
- U1 の性能テスト（csv.perf.test.ts）が、別の vitest の実行と同時に流したときに1回失敗した（負荷による揺れと見られる）。単独と verify では合格。Build and Test で再発しないか注意する。

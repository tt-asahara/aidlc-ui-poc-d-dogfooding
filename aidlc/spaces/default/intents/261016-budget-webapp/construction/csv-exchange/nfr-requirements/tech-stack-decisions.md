# 技術の選定（csv-exchange）

- 出典: `construction/data-contract/nfr-requirements/tech-stack-decisions.md`（共通の道具、CSV の自前の符号化・復号）、`construction/csv-exchange/functional-design/`、`inception/requirements-analysis/requirements.md`（NFR3、NFR6、NFR9）、`nfr-requirements-questions.md`（質問0件）
- 共通の道具（TypeScript strict、Vitest、ESLint、Prettier、Node.js 24、npm、正確なバージョンでの固定）と fake-indexeddb は決定済み。U6 で追加する依存はない。

## 1. 選定

| 分類 | 選定 | 理由 | 採らなかった案 |
|------|------|------|----------------|
| CSV の符号化・復号・検証 | U1 の encodeCsv・decodeCsv・validateCsvRecord | 画面入力と同じ検証、数式対策の往復を U1 で確かめ済み（FR1.4） | CSV のライブラリ（U1 の規則と二重になる） |
| 文字コード | TextDecoder("utf-8", { fatal: true }) | UTF-8 として正しくないファイルを読み込みの失敗として区別できる | file.text()（不正なバイトを置き換え文字にして黙って通す） |
| ファイルと Blob | ブラウザ組み込みの File・Blob | 依存なし。Node.js 24 にも同じものがある | — |
| テスト環境 | node（U1・U3・U4 と同じ）。Book は U4 の openBook に U3 の差し替えを渡して作る | jsdom の File に arrayBuffer がない場合があるため node を使う | jsdom |

## 2. 非機能の目標（このUnit分）

| ID | 目標 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR3.1 | 架空の収支 5,000 行（約 400KB）の CSV と、既存の収支 5,000 件・カテゴリ 30 件がある状態で、parseImportFile が U3 の差し替えの上で 1,000ms 以内（読み込みからプレビューの表示まで 2 秒のうち U6 の取り分の目安。U7 の表示に残りを残す） | 空回し1回の後に5回測った中央値（測定値を記録） | NFR3 |
| NFR3.2 | 5,000 件の書き出し（exportTransactions）が 1,000ms 以内 | 同上 | NFR3 |
| NFR6.1 | `src/csv-exchange/**` の行カバレッジ 80% 以上（vitest.config.ts に csv-exchange 用のプロジェクト（node）とディレクトリ単位のしきい値を足す）。各操作で正常系と2つ以上の異常・境界の例 | 検証コマンドのカバレッジ結果 | NFR6、construction.md、FD レビュー Minor |
| NFR6.2 | U6 は「CSV 変換のレイヤー」なので、テストを先に書いて失敗を確かめてから実装する | コード生成の計画の手順の順序 | team.md |
| NFR6.3 | 必須のテスト観点のうち、入力エラー（不正な行・ファイル）、空データ（0件の書き出し、空・見出しのみのファイル、取り込める行0件）、読み込み中（差し替えの delayMs の間はプレビューが未完了）、保存失敗（確定の failWrites）を含める。キーボード操作は画面のない U6 には該当しない（ファイル選択の操作は U7） | テストの一覧 | team.md Testing Posture |
| NFR9.1 | 追加の依存なし。`npm ci` と `npm run verify` だけで検証できる | クリーンな状態での実行 | NFR9 |

## 3. 対象外の分類

| 分類 | 理由 |
|------|------|
| 拡張性・監視・可用性 | 単一利用者のブラウザ内の部品で、稼働するサービスではない（種類 library） |

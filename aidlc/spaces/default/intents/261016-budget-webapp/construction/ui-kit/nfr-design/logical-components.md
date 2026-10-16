# 論理部品の一覧（ui-kit）

- 出典: `construction/ui-kit/functional-design/entities.md`・`rules.md`、`security-design.md`、`inception/contract-design/contract-summary.md`（C6）
- U2 は1つのライブラリとして U7 に組み込まれる。サービスの境界や障害の範囲は持たないため、ここでは「どの部品が、どの非機能の対策を受け持つか」と「共有するもの」を示す。

## 1. 部品と受け持つ対策

| 論理部品 | ファイル（予定） | 受け持つ対策 | 関連 |
|----------|------------------|--------------|------|
| tokens | `src/ui-kit/tokens.ts`、`src/ui-kit/tokens.css` | 色・文字・余白・寸法・画面幅・動きの値。コントラストの計算の元 | BR1.1、BR1.2、BR2.3、NFR2.4 |
| Button | `src/ui-kit/Button.tsx` | 処理中の無効化、DOM 参照の公開、フォーカスリング | BR2.1〜BR2.4 |
| TextField・Select・RadioGroup・FieldError | `src/ui-kit/fields.tsx` | ラベル、必須、エラーの関連づけ、DOM 参照の公開 | BR3.1〜BR3.3、BR2.4 |
| DataTable | `src/ui-kit/DataTable.tsx` | caption・列見出し・右寄せ・狭い幅のカード | BR4.1、BR4.2 |
| Dialog | `src/ui-kit/Dialog.tsx` | 標準 dialog のモーダル、初期フォーカス、Tab の循環、cancel の扱い、戻し | BR5.1〜BR5.6、NFR2.2、NFR7.1 |
| StatusPanel | `src/ui-kit/StatusPanel.tsx` | 種類ごとの文言と役割、遅いときの追記 | BR6.1、BR6.2 |
| InlineMessage | `src/ui-kit/InlineMessage.tsx` | 成功の自動非表示と読み上げ、失敗の保持 | BR6.3、BR6.4 |
| FileInput | `src/ui-kit/FileInput.tsx` | ラベル、キーボード、同じファイルの再選択 | BR7.1 |
| Tabs | `src/ui-kit/Tabs.tsx` | 役割、矢印・Home・End、選択の示し方 | BR8.1〜BR8.3 |
| 公開窓口 | `src/ui-kit/index.ts` | 契約 C6 の部品と型だけを公開 | C6 |
| テスト準備 | `src/ui-kit/test-setup.ts`（テスト専用） | jest-dom、dialog の補い | security-design 3.2 |

## 2. 共有するもの

| 共有物 | 共有先 | 注意 |
|--------|--------|------|
| 共通の設定（tsconfig、vitest、eslint、prettier） | 全 Unit | U2 のための拡張（security-design 第2章）は、U1 の対象と結果を変えない形で加える |
| デザイントークン | U7 | U7 は tokens.css を読み込み、独自の色・寸法を書かない |

## 3. 失敗の範囲

- U2 の部品の不具合は、それを使う画面の表示・操作に限られる。保存や業務データには影響しない（U2 はデータに触れない）。
- 時計（`setTimeout`）を使うのは InlineMessage（自動非表示）と StatusPanel（遅延の追記）だけで、部品が画面から外れたときに必ず取り消す。

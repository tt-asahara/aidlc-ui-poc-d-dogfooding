// デザイントークン（design-system-mapping.md 第1章）。
// 値の正本はこのファイル。tokens.css の CSS 変数は同じ値で書き、tokens.test.ts で一致とコントラスト比を確かめる。
// 外部のフォント・アイコン・画像は使わない（BR1.1）。

/**
 * 色（16 進表記。Prettier が CSS の色を小文字に整えるため、tokens.css と同じく小文字で書く）。
 * コントラスト比は tokens.test.ts で WCAG の式により計算して確かめる（NFR2.4）。
 */
export const color = {
  bg: "#ffffff",
  surface: "#f5f6f8",
  text: "#1f2328",
  textMuted: "#57606a",
  border: "#8c959f",
  primary: "#0b5cad",
  focus: "#0b5cad",
  danger: "#b3261e",
  success: "#1a7f37",
  warningBg: "#fff4e5",
} as const;

/** 文字。端末に入っているシステムフォントだけを使い、読み込みはしない。 */
export const font = {
  family: 'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif',
  sizeBase: "1rem",
  sizeSmall: "0.875rem",
  sizeH1: "1.5rem",
  sizeH2: "1.25rem",
  variantNumeric: "tabular-nums",
} as const;

/** 余白の段階（--space-1〜--space-6）。 */
export const space = ["4px", "8px", "16px", "24px", "32px", "48px"] as const;

/** 寸法。 */
export const size = {
  /** ボタン・入力欄などの最小の高さと幅（BR2.3）。 */
  targetMin: "44px",
  radius: "4px",
  dialogWidthConfirm: "480px",
  dialogWidthPreview: "720px",
  /** フォーカスリングの太さと余白（BR2.2）。 */
  focusRingWidth: "2px",
  focusRingOffset: "2px",
} as const;

/** 画面幅の区切り（px）。narrow は 768px 未満、medium は 768〜1023px、wide は 1024px 以上。 */
export const breakpoints = {
  medium: 768,
  wide: 1024,
} as const;

/** 動き（BR1.2）。prefers-reduced-motion のときは 0 にする（ui-kit.css）。 */
export const motion = {
  duration: "150ms",
} as const;

/** CSS 変数名と値の対応。tokens.css の内容と一致することを tokens.test.ts で確かめる。 */
export const cssVariables: Readonly<Record<string, string>> = {
  "--color-bg": color.bg,
  "--color-surface": color.surface,
  "--color-text": color.text,
  "--color-text-muted": color.textMuted,
  "--color-border": color.border,
  "--color-primary": color.primary,
  "--color-focus": color.focus,
  "--color-danger": color.danger,
  "--color-success": color.success,
  "--color-warning-bg": color.warningBg,
  "--font-family": font.family,
  "--font-size-base": font.sizeBase,
  "--font-size-small": font.sizeSmall,
  "--font-size-h1": font.sizeH1,
  "--font-size-h2": font.sizeH2,
  "--font-variant-numeric": font.variantNumeric,
  "--space-1": space[0],
  "--space-2": space[1],
  "--space-3": space[2],
  "--space-4": space[3],
  "--space-5": space[4],
  "--space-6": space[5],
  "--target-min": size.targetMin,
  "--radius": size.radius,
  "--dialog-width": size.dialogWidthConfirm,
  "--dialog-width-wide": size.dialogWidthPreview,
  "--focus-ring-width": size.focusRingWidth,
  "--focus-ring-offset": size.focusRingOffset,
  "--motion-duration": motion.duration,
};

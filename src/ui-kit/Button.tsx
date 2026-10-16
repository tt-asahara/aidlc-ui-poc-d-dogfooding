// ボタン（C6 ButtonProps、BR2.1〜BR2.4）。標準の button 要素を使い、Enter・Space で押せる。
import type { MouseEvent, ReactNode, Ref } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps {
  variant?: ButtonVariant;
  /** 処理中。押しても onClick を呼ばず、busyLabel を表示し aria-busy を真にする（BR2.1）。 */
  busy?: boolean;
  /** 処理中の文言。既定は「処理中…」。 */
  busyLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  children: ReactNode;
  "aria-label"?: string;
  /** DOM 要素への参照。フォーカスの戻し先などに使う（BR2.4）。 */
  ref?: Ref<HTMLButtonElement>;
}

export const DEFAULT_BUSY_LABEL = "処理中…";

export function Button({
  variant = "secondary",
  busy = false,
  busyLabel = DEFAULT_BUSY_LABEL,
  disabled = false,
  onClick,
  type = "button",
  children,
  "aria-label": ariaLabel,
  ref,
}: ButtonProps) {
  // 処理中は disabled 属性を付けない。付けるとフォーカスが外れてしまうため、aria-disabled と
  // クリックの無視で「押せない」状態にする（二重送信の防止。FR2.6）。
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      // submit ボタンでもフォームを送信させない。
      event.preventDefault();
      return;
    }
    onClick?.();
  };

  return (
    <button
      ref={ref}
      type={type}
      className={`uk-button uk-button--${variant}`}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      // 処理中は見えている文言（busyLabel）をそのまま名前にする。
      aria-label={busy ? undefined : ariaLabel}
      onClick={handleClick}
    >
      {busy ? busyLabel : children}
    </button>
  );
}

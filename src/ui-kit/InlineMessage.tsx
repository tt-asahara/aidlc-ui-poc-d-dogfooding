// 知らせ（C6 InlineMessageProps、BR6.3・BR6.4、W3）。操作した部品の近くに表示し、フォーカスは移さない。
// - success: 「✓ 〜」を aria-live=polite で読み上げ、autoHideMs（既定 5,000ms）後に消えて onHidden を呼ぶ。
// - error: 「⚠ 〜」を role=alert で読み上げ、自動では消えない（呼び出し側が消すまで残る）。
// 文言（文字列の children）が変われば描き直して時間を数え直す。同じ文言をもう一度知らせるときは、
// 呼び出し側が key を変えて描き直す。画面から外れたときはタイマーを取り消す。
import { useEffect, useRef, useState, type ReactNode } from "react";

export type InlineMessageTone = "success" | "error";

export interface InlineMessageProps {
  tone: InlineMessageTone;
  children: ReactNode;
  /** success が消えるまでの時間（ms）。既定 5,000ms。error には使わない（BR6.4）。 */
  autoHideMs?: number;
  /** success が自動で消えたときに呼ぶ。 */
  onHidden?: () => void;
}

export const DEFAULT_AUTO_HIDE_MS = 5000;

function InlineMessageBody({
  tone,
  children,
  autoHideMs = DEFAULT_AUTO_HIDE_MS,
  onHidden,
}: InlineMessageProps) {
  const [isHidden, setIsHidden] = useState(false);
  // 呼び出し側が描画のたびに新しい関数を渡しても、時間を数え直さないよう最新の関数だけを持つ。
  const onHiddenRef = useRef(onHidden);
  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    if (tone !== "success") return;
    const timer = setTimeout(
      () => {
        setIsHidden(true);
        onHiddenRef.current?.();
      },
      Math.max(0, autoHideMs),
    );
    return () => clearTimeout(timer);
  }, [tone, autoHideMs]);

  if (tone === "error") {
    return (
      <p className="uk-inline-message uk-inline-message--error" role="alert">
        <span className="uk-symbol" aria-hidden="true">
          ⚠
        </span>
        {children}
      </p>
    );
  }
  if (isHidden) return null;
  return (
    <p className="uk-inline-message uk-inline-message--success" role="status" aria-live="polite">
      <span className="uk-symbol" aria-hidden="true">
        ✓
      </span>
      {children}
    </p>
  );
}

export function InlineMessage(props: InlineMessageProps) {
  // 文言が文字列なら、文言が変わったときに描き直して時間を数え直す（BR6.3）。
  const textKey =
    typeof props.children === "string" || typeof props.children === "number"
      ? `${props.tone}:${props.children}`
      : props.tone;
  return <InlineMessageBody key={textKey} {...props} />;
}

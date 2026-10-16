// 状態表示（C6 StatusPanelProps、BR6.1・BR6.2、W4）。読み込み中・読み込み失敗・空データ・保存できない環境・
// 新しい版のデータを区別し、種類ごとに文言と読み上げの役割（status / alert）を変える。フォーカスは移さない。
import { useEffect, useState } from "react";
import { Button } from "./Button";

export type StatusKind = "loading" | "error" | "empty" | "unavailable" | "newer-version";

export interface StatusAction {
  label: string;
  onClick: () => void;
}

export interface StatusPanelProps {
  kind: StatusKind;
  /** 対象の名前（例: 「収支」「集計」）。 */
  subject: string;
  /** 再試行・次の操作への導線。 */
  action?: StatusAction;
  /** 読み込み中がこの時間（ms）を超えたら追記する。既定 5,000ms。 */
  slowAfterMs?: number;
}

export const DEFAULT_SLOW_AFTER_MS = 5000;

/** 読み込みが遅いときの追記（BR6.2）。 */
export const SLOW_LOADING_TEXT = "時間がかかっています。しばらく待つか、再読み込みしてください";

interface StatusView {
  symbol?: string;
  text: string;
  role: "status" | "alert";
}

/** 種類ごとの文言と役割（BR6.1）。記号は aria-hidden で表示する。 */
export function statusView(kind: StatusKind, subject: string): StatusView {
  switch (kind) {
    case "loading":
      return { symbol: "⏳", text: `${subject}を読み込み中…`, role: "status" };
    case "error":
      return { symbol: "⚠", text: "データを読み込めませんでした", role: "alert" };
    case "empty":
      return { text: `${subject}はまだありません。`, role: "status" };
    case "unavailable":
      return { symbol: "⚠", text: "この環境ではデータを保存できません", role: "alert" };
    case "newer-version":
      return { symbol: "⚠", text: "新しい版で保存されたデータのため開けません", role: "alert" };
  }
}

/**
 * 読み込み中の遅延の追記。loading の間だけ描画されるため、kind が変われば消え、
 * 再び loading になれば時間を数え直す。画面から外れたときはタイマーを取り消す。
 */
function SlowNote({ delayMs }: { delayMs: number }) {
  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return isSlow ? <p className="uk-status-panel__slow">{SLOW_LOADING_TEXT}</p> : null;
}

export function StatusPanel({
  kind,
  subject,
  action,
  slowAfterMs = DEFAULT_SLOW_AFTER_MS,
}: StatusPanelProps) {
  const view = statusView(kind, subject);
  const delayMs = Math.max(0, slowAfterMs);
  return (
    <div
      className={`uk-status-panel${view.role === "alert" ? " uk-status-panel--alert" : ""}`}
      role={view.role}
    >
      <p className="uk-status-panel__text">
        {view.symbol && (
          <span className="uk-symbol" aria-hidden="true">
            {view.symbol}
          </span>
        )}
        {view.text}
      </p>
      {kind === "loading" && <SlowNote key={delayMs} delayMs={delayMs} />}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}

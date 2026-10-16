// 状態表示（BR8.1〜BR8.3）。読み取りの欄の状態（読み込み中・失敗・表示）と、操作の知らせを、U2 の StatusPanel と InlineMessage で示す。
import type { ReactNode } from "react";
import { InlineMessage, StatusPanel } from "../ui-kit";
import { APP_MESSAGES } from "./messages";
import type { AsyncView, Notice } from "./types";

export interface ReadViewProps<T> {
  view: AsyncView<T>;
  /** 対象の名前（例: 「収支」「集計」）。StatusPanel の文言になる。 */
  subject: string;
  onRetry: () => void;
  /** 読み取れた値の描画。busy は読み直しの間（前の値を残して示す）。 */
  children: (data: T, busy: boolean) => ReactNode;
}

/**
 * 読み取りの欄。失敗では「データを読み込めませんでした」と [ 再試行 ] だけを出し、「まだありません」は出さない（BR8.2）。
 * 値がまだない読み込み中は StatusPanel の loading（5秒の追記は StatusPanel が担う。BR8.1）。
 */
export function ReadView<T>({ view, subject, onRetry, children }: ReadViewProps<T>) {
  if (view.state === "failed") {
    return (
      <StatusPanel
        kind="error"
        subject={subject}
        action={{ label: APP_MESSAGES.retry, onClick: onRetry }}
      />
    );
  }
  if (view.data === null) {
    return <StatusPanel kind="loading" subject={subject} />;
  }
  return <>{children(view.data, view.state === "loading")}</>;
}

/** 成功の知らせが消えるまでの時間（ms。interaction-spec 1章、Q6）。 */
export const SUCCESS_NOTICE_MS = 5000;

let lastNoticeId = 0;

/** 操作の知らせを作る。id は付け直すたびに増え、同じ文言の再表示でも描き直せる（BR6.3）。 */
export function createNotice(kind: Notice["kind"], text: string): Notice {
  lastNoticeId += 1;
  return {
    id: lastNoticeId,
    kind,
    text,
    autoHideMs: kind === "success" ? SUCCESS_NOTICE_MS : null,
  };
}

export interface NoticeViewProps {
  notice: Notice | null;
  /** 成功の知らせが自動で消えたとき（ 5 秒後）。 */
  onHidden?: () => void;
}

/** 操作の知らせ。成功は aria-live で読み上げて 5 秒で消え、失敗は role=alert で残る（BR6.3、BR6.4 相当）。 */
export function NoticeView({ notice, onHidden }: NoticeViewProps) {
  if (notice === null) return null;
  return (
    <InlineMessage
      key={notice.id}
      tone={notice.kind}
      autoHideMs={notice.autoHideMs ?? undefined}
      onHidden={onHidden}
    >
      {notice.text}
    </InlineMessage>
  );
}

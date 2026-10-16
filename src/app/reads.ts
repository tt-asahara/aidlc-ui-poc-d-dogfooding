// 読み取りの窓口（BR1.4、BR8.1、BR8.2）。読み取りに要求の鍵（対象月・再読み込みの回数）を付け、
// 最新の要求の結果だけを表示に反映する。遅れて返った古い結果は捨てる。タブを離れると結果も捨てる（画面の再マウント）。
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import type { OperationError } from "../bookkeeping-core";
import type { Result } from "../data-contract";
import { APP_MESSAGES } from "./messages";
import type { AsyncView } from "./types";

/** 読み取りの例外（想定外）を、固定の文言の失敗に置き換える（握りつぶさない。BR8.2）。 */
export const READ_FAILED_ERROR: OperationError = {
  kind: "storage",
  message: APP_MESSAGES.readFailed,
};

interface Settled<T> {
  key: string;
  outcome: Result<T, OperationError>;
}

export interface LatestRead<T> {
  view: AsyncView<T>;
  reload: () => void;
}

/**
 * 読み取りを行い、最新の要求の結果だけを返す。
 * - requestKey（対象月など）が変わったら読み直す。前の要求の結果は cleanup で無効にする（BR1.4）。
 * - reload を呼ぶと同じ要求を読み直す（失敗の再試行、書き込みの後の表示の更新。BR1.5）。
 * - 読み直しの間は前の結果を data に残す（画面を空にしない。欄の表示は busy で示す）。
 * - newer-version は onNewerVersion で S0-b への切り替えに渡す（BR1.6）。
 */
export function useLatestRead<T>(
  read: () => Promise<Result<T, OperationError>>,
  requestKey: string,
  onNewerVersion: () => void,
): LatestRead<T> {
  const [reloadCount, setReloadCount] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const key = `${requestKey}#${reloadCount}`;

  const runRead = useEffectEvent(read);
  const notifyNewerVersion = useEffectEvent(onNewerVersion);

  useEffect(() => {
    let isLatest = true;
    // 同期の例外も reject に置き換え、失敗として表示する（黙って捨てない）。
    Promise.resolve()
      .then(() => runRead())
      .then(
        (outcome) => {
          if (!isLatest) return;
          setSettled({ key, outcome });
          if (!outcome.ok && outcome.error.kind === "newer-version") notifyNewerVersion();
        },
        () => {
          if (!isLatest) return;
          setSettled({ key, outcome: { ok: false, error: READ_FAILED_ERROR } });
        },
      );
    return () => {
      isLatest = false;
    };
  }, [key]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  if (settled !== null && settled.key === key) {
    const outcome = settled.outcome;
    const view: AsyncView<T> = outcome.ok
      ? { state: "loaded", data: outcome.value }
      : { state: "failed", error: outcome.error };
    return { view, reload };
  }
  const previous = settled !== null && settled.outcome.ok ? settled.outcome.value : null;
  return { view: { state: "loading", data: previous }, reload };
}

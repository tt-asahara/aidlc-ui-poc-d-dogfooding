// アプリの枠（BR1.2、BR1.6、BR8.4、BR10.1）。起動時に一度だけ openBook を呼び、結果で S0-a・S0-b・再試行・アプリ枠を切り替える。
// 対象月とタブの状態はここで持ち、画面へ ShellContext で渡す（保存はしない）。
import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { openBook, type BookOpenResult } from "../bookkeeping-core";
import type { YearMonth } from "../data-contract";
import { StatusPanel } from "../ui-kit";
import { currentYearMonth, ShellContext, type ShellValue } from "./appState";
import { APP_MESSAGES } from "./messages";
import { TabNav } from "./TabNav";
import type { AppBoot, ScreenId } from "./types";

export interface AppProps {
  /** 起動の処理（既定は U4 の openBook）。テストでは保存を差し替えた openBook を渡す。 */
  open?: () => Promise<BookOpenResult>;
  /** 選ばれたタブの中身。本番では画面の一覧（renderScreen）を渡す。 */
  renderScreen: (screen: ScreenId) => ReactNode;
  /** 今の時刻（対象月の初期値）。既定は実際の時計。 */
  now?: () => Date;
}

/** openBook の結果を起動時の状態に写す（BR1.2）。 */
export function toAppBoot(result: BookOpenResult): AppBoot {
  switch (result.status) {
    case "ready":
      return { status: "ready", book: result.book };
    case "unavailable":
      return { status: "unavailable", book: null };
    case "newer-version":
      return { status: "newer-version", book: null };
    case "load-failed":
      return { status: "load-failed", book: null, message: result.message };
  }
}

/** ページを読み直す（S0-a、S0-b の [ 再読み込み ]）。 */
function reloadPage(): void {
  window.location.reload();
}

export function App({ open = openBook, renderScreen, now = () => new Date() }: AppProps) {
  const [boot, setBoot] = useState<AppBoot>({ status: "booting", book: null });
  const [attempt, setAttempt] = useState(0);
  const [month, setMonth] = useState<YearMonth>(() => currentYearMonth(now()));
  const [screen, setScreen] = useState<ScreenId>("transactions");

  const runOpen = useEffectEvent(open);

  // openBook は起動時に1回。再試行（attempt の変更）のときだけ呼び直す（BR1.2）。
  // 同期の例外も reject と同じく load-failed に置き換える（黙って捨てない）。
  useEffect(() => {
    let isCurrent = true;
    Promise.resolve()
      .then(() => runOpen())
      .then(
        (result) => {
          if (isCurrent) setBoot(toAppBoot(result));
        },
        () => {
          if (isCurrent) {
            setBoot({ status: "load-failed", book: null, message: APP_MESSAGES.readFailed });
          }
        },
      );
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  const retryOpen = () => {
    setBoot({ status: "booting", book: null });
    setAttempt((count) => count + 1);
  };

  // どの操作でも newer-version が返ったら S0-b へ切り替え、以後の操作を止める（BR1.6）。
  const handleNewerVersion = () => {
    setBoot({ status: "newer-version", book: null });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="app-header__title">{APP_MESSAGES.appTitle}</p>
        <p className="app-header__notice">{APP_MESSAGES.fictionalNotice}</p>
      </header>
      <a className="app-skip-link" href="#main-content">
        {APP_MESSAGES.skipLink}
      </a>
      <main id="main-content" className="app-main" tabIndex={-1}>
        {renderBoot()}
      </main>
    </div>
  );

  function renderBoot(): ReactNode {
    switch (boot.status) {
      case "booting":
        return <StatusPanel kind="loading" subject={APP_MESSAGES.boot.subject} />;
      case "unavailable":
        return (
          <div>
            <StatusPanel
              kind="unavailable"
              subject={APP_MESSAGES.boot.subject}
              action={{ label: APP_MESSAGES.reload, onClick: reloadPage }}
            />
            <p className="app-hint">{APP_MESSAGES.boot.unavailableHint}</p>
          </div>
        );
      case "newer-version":
        return (
          <div>
            <StatusPanel
              kind="newer-version"
              subject={APP_MESSAGES.boot.subject}
              action={{ label: APP_MESSAGES.reload, onClick: reloadPage }}
            />
            <p className="app-hint">{APP_MESSAGES.boot.newerVersionHint}</p>
          </div>
        );
      case "load-failed":
        return (
          <div>
            <StatusPanel
              kind="error"
              subject={APP_MESSAGES.boot.subject}
              action={{ label: APP_MESSAGES.retry, onClick: retryOpen }}
            />
            {boot.message !== APP_MESSAGES.readFailed && <p className="app-hint">{boot.message}</p>}
          </div>
        );
      case "ready": {
        const shell: ShellValue = {
          book: boot.book,
          month,
          setMonth,
          navigate: setScreen,
          onNewerVersion: handleNewerVersion,
        };
        return (
          <ShellContext.Provider value={shell}>
            <TabNav selected={screen} onSelect={setScreen} renderPanel={renderScreen} />
          </ShellContext.Provider>
        );
      }
    }
  }
}

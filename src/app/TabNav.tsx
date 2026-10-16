// 5つの画面のタブ（BR9.1、U2 の Tabs を使う）。矢印キー・Home・End で移動し、移動と同時に選択する（BR8.2 の U2 の規則）。
import type { ReactNode } from "react";
import { Tabs } from "../ui-kit";
import { APP_MESSAGES } from "./messages";
import { SCREEN_IDS, type ScreenId } from "./types";

export interface TabNavProps {
  selected: ScreenId;
  onSelect: (screen: ScreenId) => void;
  /** 選ばれたタブの中身（画面）。 */
  renderPanel: (screen: ScreenId) => ReactNode;
}

/** タブの識別子を画面の識別子に直す（一覧にない値は null）。 */
export function toScreenId(id: string): ScreenId | null {
  return SCREEN_IDS.find((screen) => screen === id) ?? null;
}

export function TabNav({ selected, onSelect, renderPanel }: TabNavProps) {
  const tabs = SCREEN_IDS.map((id) => ({ id, label: APP_MESSAGES.tabTitles[id] }));
  return (
    <Tabs
      tabs={tabs}
      selectedId={selected}
      label={APP_MESSAGES.tabsLabel}
      onSelect={(id) => {
        const screen = toScreenId(id);
        if (screen !== null) onSelect(screen);
      }}
      renderPanel={(id) => {
        const screen = toScreenId(id);
        return screen === null ? null : renderPanel(screen);
      }}
    />
  );
}

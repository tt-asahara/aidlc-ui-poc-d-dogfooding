// タブ（C6 TabsProps、BR8.1〜BR8.3、W2）。選択中のタブだけが Tab キーで到達でき（tabindex=0）、
// 左右の矢印で移ると同時に選択し、Home・End で先頭・末尾へ移る。端では反対の端へ回り込む。
// disabled の状態は持たない（起動時の特殊画面ではタブ自体を表示しない方針。refined-mockups レビュー R-05）。
import { useId, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** タブ列の名前（例: 「画面の切り替え」）。 */
  label: string;
  renderPanel: (id: string) => ReactNode;
}

/** 押したキーに応じた移動先のタブの位置。対象外のキーなら undefined。 */
function nextIndex(key: string, current: number, count: number): number | undefined {
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return undefined;
  }
}

export function Tabs({ tabs, selectedId, onSelect, label, renderPanel }: TabsProps) {
  const baseId = useId();
  const tabDomId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;
  // selectedId が一覧にないときも、タブ列に Tab で入れるよう先頭のタブを到達先にする。
  const activeId = tabs.some((tab) => tab.id === selectedId) ? selectedId : tabs[0]?.id;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = nextIndex(event.key, index, tabs.length);
    if (target === undefined) return;
    const tab = tabs[target];
    if (tab === undefined) return;
    event.preventDefault();
    // 移動先のタブにフォーカスを移し、同時に選択する（BR8.2）。
    const tablist = event.currentTarget.parentElement;
    tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
    onSelect(tab.id);
  };

  return (
    <div className="uk-tabs">
      <div className="uk-tabs__list" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={tabDomId(tab.id)}
              className="uk-tab"
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeId !== undefined && (
        <div
          className="uk-tabs__panel"
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabDomId(activeId)}
        >
          {renderPanel(selectedId)}
        </div>
      )}
    </div>
  );
}

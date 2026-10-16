// 対象月の表示と前月・翌月への移動（BR1.4）。2000-01〜2099-12 の外へは動けない（端のボタンは無効）。
import type { YearMonth } from "../data-contract";
import { Button } from "../ui-kit";
import { canShiftYearMonth, shiftYearMonth } from "./appState";
import { formatMonthLabel } from "./format";
import { APP_MESSAGES } from "./messages";

export interface MonthNavigatorProps {
  month: YearMonth;
  onChange: (month: YearMonth) => void;
  disabled?: boolean;
}

export function MonthNavigator({ month, onChange, disabled = false }: MonthNavigatorProps) {
  const previous = shiftYearMonth(month, -1);
  const next = shiftYearMonth(month, 1);
  return (
    <div className="app-month-nav">
      <Button
        disabled={disabled || !canShiftYearMonth(month, -1)}
        aria-label={`${APP_MESSAGES.previousMonthLabel}（${formatMonthLabel(previous)}）`}
        onClick={() => onChange(previous)}
      >
        {APP_MESSAGES.previousMonthButton}
      </Button>
      <span className="app-month-nav__label" aria-live="polite">
        {formatMonthLabel(month)}
      </span>
      <Button
        disabled={disabled || !canShiftYearMonth(month, 1)}
        aria-label={`${APP_MESSAGES.nextMonthLabel}（${formatMonthLabel(next)}）`}
        onClick={() => onChange(next)}
      >
        {APP_MESSAGES.nextMonthButton}
      </Button>
    </div>
  );
}

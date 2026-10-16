// 画面の共有の状態（BR1.4）。対象月は収支・月次集計・予算で1つを共有する。React の状態だけで持ち、保存はしない。
import { createContext, useContext } from "react";
import type { Book } from "../bookkeeping-core";
import type { YearMonth } from "../data-contract";
import type { ScreenId } from "./types";

/** 対象月の範囲（U1 の検証に従う。2000-01〜2099-12）。 */
const FIRST_MONTH_INDEX = 2000 * 12;
const LAST_MONTH_INDEX = 2099 * 12 + 11;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** ブラウザのローカル日付の今月（初期値は今月。BR1.4）。 */
export function currentYearMonth(now: Date): YearMonth {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/** ブラウザのローカル日付の今日（登録フォームの日付の初期値。BR2.1）。 */
export function localIsoDate(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * 対象月を delta か月ずらす。2000-01〜2099-12 の外には出ない（BR1.4）。
 * 範囲の外へ動かすときは範囲の端の月を返すので、呼び出し側は戻り値が元と同じかで押せるかを決める。
 */
export function shiftYearMonth(month: YearMonth, delta: number): YearMonth {
  const [yearPart, monthPart] = month.split("-");
  const index = Number(yearPart) * 12 + (Number(monthPart) - 1) + delta;
  const clamped = Math.min(LAST_MONTH_INDEX, Math.max(FIRST_MONTH_INDEX, index));
  const year = Math.floor(clamped / 12);
  const monthNumber = (clamped % 12) + 1;
  return `${year}-${pad2(monthNumber)}`;
}

/** その方向へ動けるか（端では押せない）。 */
export function canShiftYearMonth(month: YearMonth, delta: number): boolean {
  return shiftYearMonth(month, delta) !== month;
}

/** 画面の部品が使う、アプリ全体の共有の値。 */
export interface ShellValue {
  book: Book;
  month: YearMonth;
  setMonth: (month: YearMonth) => void;
  /** タブの移動（例: 月次集計の「収支タブで登録する」）。 */
  navigate: (screen: ScreenId) => void;
  /** 任意の操作が newer-version を返したら S0-b に切り替える（BR1.6）。 */
  onNewerVersion: () => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

/** 画面の部品から共有の値を取り出す。枠の外で使うのは誤りなので例外にする。 */
export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (value === null) {
    throw new Error("画面の部品は ShellContext の中で使ってください");
  }
  return value;
}

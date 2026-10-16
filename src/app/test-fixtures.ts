// U7 のテストで共通に使う道具（テスト専用。カバレッジの対象外）。
// - Book は U4 の openBook に U3 の差し替え（createMemoryStorage）を渡して作る。偽のタイマーは使わない。
// - 日時と id は固定（架空データ）。実在の名前・口座・取引は使わない（NFR8.4）。
import { createElement, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { openBook, type Book, type BookOpenResult } from "../bookkeeping-core";
import type { Category, YearMonth } from "../data-contract";
import { createMemoryStorage, type MemoryStorageOptions } from "../storage";
import { ShellContext, type ShellValue } from "./appState";
import type { ScreenId } from "./types";

/** 固定の時刻（架空の日付。ローカルの 2026-10-16 10:00）。 */
export function fixedNow(): Date {
  return new Date(2026, 9, 16, 10, 0, 0);
}

/** 決まった順の id（id-0001、id-0002、…）。 */
export function sequentialIds(prefix = "id-"): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}${String(counter).padStart(4, "0")}`;
  };
}

/** 保存の差し替えを使って Book を開く（既定は失敗を起こさない保存）。 */
export function openTestBook(storageOptions: MemoryStorageOptions = {}): Promise<BookOpenResult> {
  return openBook({
    storage: () => createMemoryStorage(storageOptions),
    now: () => new Date("2026-10-16T01:02:03.000Z"),
    newId: sequentialIds(),
  });
}

/** 準備できた Book を取り出す（準備に失敗したらテストの前提が崩れるので例外にする）。 */
export async function readyBook(storageOptions: MemoryStorageOptions = {}): Promise<Book> {
  const result = await openTestBook(storageOptions);
  if (result.status !== "ready") {
    throw new Error(`テストの Book を開けませんでした: ${result.status}`);
  }
  return result.book;
}

/** 支出・収入の一覧を名前で引けるように取り出す（テストの前提の確認）。 */
export async function loadCategories(book: Book): Promise<Category[]> {
  const result = await book.listCategories();
  if (!result.ok) throw new Error("テストのカテゴリを読めませんでした");
  return result.value;
}

/** 名前でカテゴリを1件引く（初期カテゴリは「食費」などの架空の名前）。 */
export function categoryIdNamed(categories: readonly Category[], name: string): string {
  const found = categories.find((category) => category.name === name);
  if (found === undefined) throw new Error(`テストのカテゴリがありません: ${name}`);
  return found.id;
}

export interface ShellOverrides {
  month?: YearMonth;
  setMonth?: (month: YearMonth) => void;
  navigate?: (screen: ScreenId) => void;
  onNewerVersion?: () => void;
}

/** 共有の値（ShellContext）の中で画面の部品を描画する。 */
export function renderInShell(ui: ReactNode, book: Book, overrides: ShellOverrides = {}) {
  const value: ShellValue = {
    book,
    month: overrides.month ?? "2026-10",
    setMonth: overrides.setMonth ?? vi.fn(),
    navigate: overrides.navigate ?? vi.fn(),
    onNewerVersion: overrides.onNewerVersion ?? vi.fn(),
  };
  return render(createElement(ShellContext.Provider, { value }, ui));
}

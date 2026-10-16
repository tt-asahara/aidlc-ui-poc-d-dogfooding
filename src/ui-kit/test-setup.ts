// U2 ui-kit のテストだけが読み込む準備ファイル（vitest.config.ts の ui-kit プロジェクトの setupFiles）。
// - jest-dom の照合（toHaveAttribute、toHaveFocus など）を有効にする。
// - 各テストの後に描画を片付ける（Vitest の globals を使わないため、自動では片付かない）。
// - jsdom が持たない標準 dialog の showModal・close を最小限に補う（security-design.md 3.2）。
//   補いは実行時のコードには入れない。補いのある環境で通ることは実ブラウザでの証明ではないため、
//   実ブラウザでの確認（B1〜B5）は U7 の Build and Test で行う。
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// axe-core は一部の規則で canvas を使おうとする。jsdom の canvas は未実装で警告を出すため、
// 「canvas を使えない環境」として null を返す（axe はその場合の代わりの判定をする）。
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

/** 補いが背後の要素に付けた inert の印（元から inert だった要素は外さないため）。 */
const POLYFILL_INERT_MARK = "data-polyfill-inert";

/** モーダルの背後（dialog の祖先の兄弟要素）を inert にして、操作できない状態を模す。 */
function makeBackgroundInert(dialog: HTMLDialogElement): void {
  for (
    let node: Element = dialog;
    node.parentElement !== null && node !== document.body;
    node = node.parentElement
  ) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      sibling.setAttribute(POLYFILL_INERT_MARK, "");
    }
  }
}

/** 補いが付けた inert をすべて外す（dialog が先に DOM から外されていても戻せるよう、文書全体から探す）。 */
function releaseBackground(): void {
  for (const element of Array.from(document.querySelectorAll(`[${POLYFILL_INERT_MARK}]`))) {
    element.removeAttribute("inert");
    element.removeAttribute(POLYFILL_INERT_MARK);
  }
}

const dialogPrototype = HTMLDialogElement.prototype as Partial<HTMLDialogElement> &
  HTMLDialogElement;

if (!Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "open")) {
  Object.defineProperty(HTMLDialogElement.prototype, "open", {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute("open");
    },
    set(this: HTMLDialogElement, value: boolean) {
      this.toggleAttribute("open", value);
    },
  });
}

if (typeof dialogPrototype.showModal !== "function") {
  dialogPrototype.showModal = function showModal(this: HTMLDialogElement) {
    if (this.hasAttribute("open")) return;
    this.setAttribute("open", "");
    makeBackgroundInert(this);
  };
}

if (typeof dialogPrototype.close !== "function") {
  dialogPrototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    releaseBackground();
    // 実ブラウザでは close イベントは後のタスクで届くが、補いでは同期で送る（部品はどちらでも正しく動く必要がある）。
    this.dispatchEvent(new Event("close"));
  };
}

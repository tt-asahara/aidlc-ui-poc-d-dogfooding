// 配布の検査の単体の確認（架空の HTML・CSS・JavaScript の断片で、違反の検出と許可リストの動作を確かめる）。
// 実行: node --test scripts/check-dist.test.mjs（Node.js の標準の test ランナー。ネットワークは使わない）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { findViolations, parseAllowlist } from "./check-dist.mjs";

const EMPTY_ALLOWLIST = [];

test("HTML: 外部の script・link は違反、ローカルの資源は違反にしない", () => {
  const external = '<script src="https://cdn.example.invalid/lib.js"></script>';
  const local = '<script type="module" src="/assets/app-1a2b.js"></script>';
  assert.equal(findViolations("index.html", external, EMPTY_ALLOWLIST).length, 1);
  assert.equal(findViolations("index.html", local, EMPTY_ALLOWLIST).length, 0);
});

test("HTML: プロトコル相対の参照も違反にする", () => {
  const html = '<link rel="stylesheet" href="//cdn.example.invalid/style.css">';
  assert.equal(findViolations("index.html", html, EMPTY_ALLOWLIST).length, 1);
});

test("CSS: 外部の url() と @import は違反、data: の画像は違反にしない", () => {
  const css = [
    '@import url("https://fonts.example.invalid/font.css");',
    ".a { background: url(https://img.example.invalid/x.png); }",
    ".b { background: url(data:image/png;base64,AAAA); }",
  ].join("\n");
  const found = findViolations("assets/app.css", css, EMPTY_ALLOWLIST);
  assert.equal(found.length, 2);
  assert.ok(found.every((violation) => violation.reason.startsWith("外部への参照（CSS")));
});

test("JavaScript: fetch・import・new URL の外部の引数は違反、ローカルの引数は違反にしない", () => {
  const external = 'fetch("https://api.example.invalid/data");';
  const local = 'fetch("/api/data");';
  assert.equal(findViolations("assets/app.js", external, EMPTY_ALLOWLIST).length, 2);
  assert.equal(findViolations("assets/app.js", local, EMPTY_ALLOWLIST).length, 0);
});

test("JavaScript: 文字列の中の外部の URL は、許可リストに無ければ違反", () => {
  const js = 'const s = "http://www.w3.org/2000/svg";';
  assert.equal(findViolations("assets/app.js", js, EMPTY_ALLOWLIST).length, 1);
  assert.equal(findViolations("assets/app.js", js, ["http://www.w3.org/2000/svg"]).length, 0);
});

test("許可リストは接頭辞でも一致する（エラー案内の URL）", () => {
  const js = 'throw new Error("https://react.dev/errors/418?args[]=1");';
  assert.equal(findViolations("assets/app.js", js, EMPTY_ALLOWLIST).length, 1);
  assert.equal(findViolations("assets/app.js", js, ["https://react.dev/errors/"]).length, 0);
});

test("計測の印（perf:）が残っていれば違反にする（performance-design 3章）", () => {
  const js = 'console.log("perf:month-switch", 12);';
  const found = findViolations("assets/app.js", js, EMPTY_ALLOWLIST);
  assert.equal(found.length, 1);
  assert.equal(found[0].reason, "計測の印が残っている");
});

test("違反の行番号を示す", () => {
  const html = ["<!doctype html>", '<script src="https://cdn.example.invalid/a.js"></script>'].join(
    "\n",
  );
  const [violation] = findViolations("index.html", html, EMPTY_ALLOWLIST);
  assert.equal(violation.line, 2);
});

test("許可リストは注釈と空行を除いた識別子だけにする", () => {
  const text = [
    "# 見出しの注釈",
    "",
    "http://www.w3.org/2000/svg  # SVG の名前空間",
    "https://react.dev/errors/",
  ].join("\n");
  assert.deepEqual(parseAllowlist(text), [
    "http://www.w3.org/2000/svg",
    "https://react.dev/errors/",
  ]);
});

test("許可リストが空なら、名前空間の識別子も違反になる（許可の記録は最初のビルドの後）", () => {
  const js = 'document.createElementNS("http://www.w3.org/2000/svg", "svg");';
  assert.equal(findViolations("assets/app.js", js, parseAllowlist("# 空の許可リスト\n")).length, 1);
});

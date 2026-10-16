// プロジェクト共通の ESLint 設定（フラット設定）。後続の Unit も src/<unit-name>/ に置けば同じ規則が適用される。
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const NO_EXTERNAL =
  "U1 data-contract は純粋な関数だけを持ち、通信・保存・時計・乱数・タイマーに触れない（NFR1.1）。";

// security-design.md 第2章の参照禁止の一覧。
const DATA_CONTRACT_RESTRICTED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "navigator",
  "indexedDB",
  "localStorage",
  "sessionStorage",
  "Worker",
  "crypto",
  "Date",
  "setTimeout",
  "setInterval",
  "globalThis",
  "window",
  "self",
].map((name) => ({ name, message: NO_EXTERNAL }));

const UI_KIT_NO_EXTERNAL =
  "U2 ui-kit は通信・保存を行わない（NFR1.1）。データの読み書きは U3〜U7 の役割。";
const UI_KIT_NO_HTML =
  "U2 ui-kit は渡された文字列を文字としてだけ表示し、HTML として挿入しない（NFR8.1）。";

// security-design.md 第4章の通信・保存の参照禁止の一覧（時計とタイマーは知らせの表示で使うため禁止しない）。
const UI_KIT_NETWORK_AND_STORAGE = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "indexedDB",
  "localStorage",
  "sessionStorage",
];
const UI_KIT_RESTRICTED_GLOBALS = UI_KIT_NETWORK_AND_STORAGE.map((name) => ({
  name,
  message: UI_KIT_NO_EXTERNAL,
}));
// window.fetch のようにグローバルの持ち主を経由した参照と、navigator.sendBeacon も禁止する。
const UI_KIT_RESTRICTED_PROPERTIES = [
  { object: "navigator", property: "sendBeacon", message: UI_KIT_NO_EXTERNAL },
  ...["window", "globalThis", "self"].flatMap((object) =>
    UI_KIT_NETWORK_AND_STORAGE.map((property) => ({
      object,
      property,
      message: UI_KIT_NO_EXTERNAL,
    })),
  ),
];
// HTML の挿入につながる書き方を禁止する（React の通常の文字列描画だけを使う）。
const UI_KIT_RESTRICTED_SYNTAX = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: UI_KIT_NO_HTML },
  { selector: "Property[key.name='dangerouslySetInnerHTML']", message: UI_KIT_NO_HTML },
  {
    selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]",
    message: UI_KIT_NO_HTML,
  },
  { selector: "MemberExpression[property.name='insertAdjacentHTML']", message: UI_KIT_NO_HTML },
  // el["innerHTML"] のような文字列での参照も同じく禁止する。
  {
    selector: "MemberExpression[property.value=/^(innerHTML|outerHTML|insertAdjacentHTML)$/]",
    message: UI_KIT_NO_HTML,
  },
];

const STORAGE_NO_EXTERNAL =
  "U3 storage は IndexedDB だけを使い、通信・ほかの保存先・文字列の評価を行わない（NFR1.1、NFR8.1）。";

// security-design.md 第3章の禁止の一覧。フラット設定では同じ規則の指定が別ブロックで合成されないため、
// storage 用のブロックに禁止の一覧をすべて書き切る。indexedDB はこのディレクトリでだけ許可する。
const STORAGE_NETWORK_AND_STORAGE = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
];
const STORAGE_RESTRICTED_GLOBALS = [...STORAGE_NETWORK_AND_STORAGE, "eval"].map((name) => ({
  name,
  message: STORAGE_NO_EXTERNAL,
}));
const STORAGE_RESTRICTED_PROPERTIES = [
  { object: "navigator", property: "sendBeacon", message: STORAGE_NO_EXTERNAL },
  { object: "document", property: "cookie", message: STORAGE_NO_EXTERNAL },
  ...["window", "globalThis", "self"].flatMap((object) =>
    [...STORAGE_NETWORK_AND_STORAGE, "eval"].map((property) => ({
      object,
      property,
      message: STORAGE_NO_EXTERNAL,
    })),
  ),
];

const BOOKKEEPING_NO_EXTERNAL =
  "U4 bookkeeping-core は保存を U3 の窓口だけで行い、通信・ほかの保存先・文字列の評価を行わない（NFR1.1、NFR8.1）。";
const BOOKKEEPING_NO_FAKE_IDB =
  "fake-indexeddb はテスト専用の依存。U4 のテスト以外のコードでは使わない（security-design.md 第7章）。";

// security-design.md 第7章の禁止の一覧。フラット設定では同じ規則の指定が別ブロックで合成されないため、
// bookkeeping-core 用のブロックに禁止の一覧をすべて書き切る。crypto（id）と Date（日時）は使うため禁止しない。
const BOOKKEEPING_NETWORK_AND_STORAGE = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "indexedDB",
  "localStorage",
  "sessionStorage",
];
const BOOKKEEPING_RESTRICTED_GLOBALS = [...BOOKKEEPING_NETWORK_AND_STORAGE, "eval"].map((name) => ({
  name,
  message: BOOKKEEPING_NO_EXTERNAL,
}));
const BOOKKEEPING_RESTRICTED_PROPERTIES = [
  { object: "navigator", property: "sendBeacon", message: BOOKKEEPING_NO_EXTERNAL },
  { object: "document", property: "cookie", message: BOOKKEEPING_NO_EXTERNAL },
  ...["window", "globalThis", "self"].flatMap((object) =>
    BOOKKEEPING_NETWORK_AND_STORAGE.map((property) => ({
      object,
      property,
      message: BOOKKEEPING_NO_EXTERNAL,
    })),
  ),
];

const CSV_NO_EXTERNAL =
  "U6 csv-exchange はファイルの読み取りと Blob の生成だけを行い、通信・保存先の直接の参照・文字列の評価を行わない（NFR1.1、NFR8.1）。";
const CSV_NO_FAKE_IDB =
  "fake-indexeddb はテスト専用の依存。U6 のテスト以外のコードでは使わない（security-design.md 第5章）。";
const CSV_NO_STORAGE =
  "U6 は U3 storage を直接使わない。保存は U4 bookkeeping-core の公開窓口（../bookkeeping-core）を通す（security-design.md 第5章）。";
const CSV_PUBLIC_ENTRY_ONLY =
  "U6 が使うのは U1・U4 の公開窓口（../data-contract、../bookkeeping-core）だけ。内部のファイルは import しない。";

// security-design.md 第5章の禁止の一覧。フラット設定では同じ規則の指定が別ブロックで合成されないため、
// csv-exchange 用のブロックに禁止の一覧をすべて書き切る。
const CSV_NETWORK_AND_STORAGE = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "indexedDB",
  "localStorage",
  "sessionStorage",
];
const CSV_RESTRICTED_GLOBALS = [...CSV_NETWORK_AND_STORAGE, "eval"].map((name) => ({
  name,
  message: CSV_NO_EXTERNAL,
}));
const CSV_RESTRICTED_PROPERTIES = [
  { object: "navigator", property: "sendBeacon", message: CSV_NO_EXTERNAL },
  { object: "document", property: "cookie", message: CSV_NO_EXTERNAL },
  ...["window", "globalThis", "self"].flatMap((object) =>
    CSV_NETWORK_AND_STORAGE.map((property) => ({
      object,
      property,
      message: CSV_NO_EXTERNAL,
    })),
  ),
];
const CSV_RESTRICTED_IMPORTS = {
  paths: [
    { name: "fake-indexeddb", message: CSV_NO_FAKE_IDB },
    { name: "../storage", message: CSV_NO_STORAGE },
  ],
  patterns: [
    { group: ["fake-indexeddb/*"], message: CSV_NO_FAKE_IDB },
    { group: ["../storage/*"], message: CSV_NO_STORAGE },
    {
      group: [
        "../bookkeeping-core/*",
        "!../bookkeeping-core/index",
        "../data-contract/*",
        "!../data-contract/index",
      ],
      message: CSV_PUBLIC_ENTRY_ONLY,
    },
  ],
};

const SUMMARY_NO_EXTERNAL =
  "U5 monthly-summary は U4 の公開窓口から読むだけで、通信・保存先の直接の参照・文字列の評価を行わない（NFR1.1、NFR8.1）。";
const SUMMARY_NO_FAKE_IDB =
  "fake-indexeddb はテスト専用の依存。U5 のテスト以外のコードでは使わない（security-design.md 第3章）。";
const SUMMARY_NO_STORAGE =
  "U5 は U3 storage を直接使わない。読み取りは U4 bookkeeping-core の公開窓口（../bookkeeping-core）を通す（security-design.md 第3章）。";
const SUMMARY_NO_SIBLINGS =
  "U5 は U6 csv-exchange・U2 ui-kit に依存しない（security-design.md 第3章）。";
const SUMMARY_PUBLIC_ENTRY_ONLY =
  "U5 が使うのは U1・U4 の公開窓口（../data-contract、../bookkeeping-core）だけ。内部のファイルは import しない。";
const SUMMARY_COMPUTE_PURE =
  "computeMonthlySummary は入力だけから結果を作る純粋な関数。時計・乱数・タイマーに触れない（security-design.md 第3章）。";
const SUMMARY_COMPUTE_TYPE_ONLY =
  "compute.ts は U4 から型（import type）だけを使う。値の import は禁止（security-design.md 第3章）。";

// security-design.md 第3章の禁止の一覧。フラット設定では同じ規則の指定が別ブロックで合成されないため、
// monthly-summary 全体のブロックと compute.ts 用のブロックの両方に、この共通の定数から完全な一覧を展開する。
const SUMMARY_NETWORK_AND_STORAGE = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "indexedDB",
  "localStorage",
  "sessionStorage",
];
const SUMMARY_COMPUTE_EXTRA_GLOBALS = ["Date", "setTimeout", "setInterval"];
const SUMMARY_RESTRICTED_GLOBALS = [...SUMMARY_NETWORK_AND_STORAGE, "eval"].map((name) => ({
  name,
  message: SUMMARY_NO_EXTERNAL,
}));
const SUMMARY_RESTRICTED_PROPERTIES = [
  { object: "navigator", property: "sendBeacon", message: SUMMARY_NO_EXTERNAL },
  { object: "document", property: "cookie", message: SUMMARY_NO_EXTERNAL },
  ...["window", "globalThis", "self"].flatMap((object) =>
    SUMMARY_NETWORK_AND_STORAGE.map((property) => ({
      object,
      property,
      message: SUMMARY_NO_EXTERNAL,
    })),
  ),
];
const SUMMARY_IMPORT_PATHS = [
  { name: "fake-indexeddb", message: SUMMARY_NO_FAKE_IDB },
  { name: "../storage", message: SUMMARY_NO_STORAGE },
  { name: "../csv-exchange", message: SUMMARY_NO_SIBLINGS },
  { name: "../ui-kit", message: SUMMARY_NO_SIBLINGS },
];
const SUMMARY_IMPORT_PATTERNS = [
  { group: ["fake-indexeddb/*"], message: SUMMARY_NO_FAKE_IDB },
  { group: ["../storage/*"], message: SUMMARY_NO_STORAGE },
  { group: ["../csv-exchange/*", "../ui-kit/*"], message: SUMMARY_NO_SIBLINGS },
  {
    group: [
      "../bookkeeping-core/*",
      "!../bookkeeping-core/index",
      "../data-contract/*",
      "!../data-contract/index",
    ],
    message: SUMMARY_PUBLIC_ENTRY_ONLY,
  },
];

// ---- U7 app（src/app）。security-design.md 第2章・第1章の禁止の一覧。----
const APP_NO_EXTERNAL =
  "U7 app は通信・保存先の直接の参照・文字列の評価を行わない。保存は U4 の窓口だけを使う（NFR1.1、NFR8.1）。";
const APP_NO_HTML =
  "U7 app は利用者の値を HTML として挿入しない。React の文字列描画だけを使う（NFR8.1）。";
const APP_NO_STORAGE =
  "U7 は U3 storage を直接使わない。保存は U4 bookkeeping-core の公開窓口を通す（security-design.md 2章）。";
const APP_PUBLIC_ENTRY_ONLY =
  "U7 が import してよいのは各 Unit の公開窓口（index）と ../ui-kit の index だけ。内部のファイルは import しない（security-design.md 2章）。";
const APP_NO_FAKE_IDB =
  "fake-indexeddb はテスト専用の依存。src/app の実行されるコードでは使わない（security-design.md 2章）。";

// src/app 直下（../）と src/app/screens 直下（../../）の2つの深さから import するため、両方の書き方を書き切る。
const APP_IMPORT_DEPTHS = ["..", "../.."];
const APP_PUBLIC_UNITS = [
  "data-contract",
  "bookkeeping-core",
  "monthly-summary",
  "csv-exchange",
  "ui-kit",
];

const APP_NETWORK_AND_STORAGE = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "indexedDB",
  "localStorage",
  "sessionStorage",
];
const APP_RESTRICTED_GLOBALS = [...APP_NETWORK_AND_STORAGE, "eval"].map((name) => ({
  name,
  message: APP_NO_EXTERNAL,
}));
const APP_RESTRICTED_PROPERTIES = [
  { object: "navigator", property: "sendBeacon", message: APP_NO_EXTERNAL },
  { object: "document", property: "cookie", message: APP_NO_EXTERNAL },
  ...["window", "globalThis", "self"].flatMap((object) =>
    [...APP_NETWORK_AND_STORAGE, "eval"].map((property) => ({
      object,
      property,
      message: APP_NO_EXTERNAL,
    })),
  ),
];
const APP_RESTRICTED_SYNTAX = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: APP_NO_HTML },
  { selector: "Property[key.name='dangerouslySetInnerHTML']", message: APP_NO_HTML },
  { selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]", message: APP_NO_HTML },
  { selector: "MemberExpression[property.name='insertAdjacentHTML']", message: APP_NO_HTML },
  {
    selector: "MemberExpression[property.value=/^(innerHTML|outerHTML|insertAdjacentHTML)$/]",
    message: APP_NO_HTML,
  },
];
const APP_IMPORT_PATHS = [
  { name: "fake-indexeddb", message: APP_NO_FAKE_IDB },
  ...APP_IMPORT_DEPTHS.map((depth) => ({ name: `${depth}/storage`, message: APP_NO_STORAGE })),
];
const APP_IMPORT_PATTERNS = [
  { group: ["fake-indexeddb/*"], message: APP_NO_FAKE_IDB },
  ...APP_IMPORT_DEPTHS.map((depth) => ({ group: [`${depth}/storage/*`], message: APP_NO_STORAGE })),
  // 各 Unit の内部のファイル（index 以外）は禁止する。
  ...APP_IMPORT_DEPTHS.flatMap((depth) =>
    APP_PUBLIC_UNITS.map((unit) => ({
      group: [`${depth}/${unit}/*`, `!${depth}/${unit}/index`],
      message: APP_PUBLIC_ENTRY_ONLY,
    })),
  ),
];

export default defineConfig(
  globalIgnores(["aidlc/", ".claude/", "poc-evidence/", "coverage/", "dist/", "node_modules/"]),
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // React のフックの規則（U2 以降の画面部品）。
    files: ["**/*.tsx", "src/ui-kit/**/*.ts"],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ["*.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/data-contract/**/*.ts"],
    ignores: ["src/data-contract/**/*.test.ts"],
    rules: {
      "no-restricted-globals": ["error", ...DATA_CONTRACT_RESTRICTED_GLOBALS],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: NO_EXTERNAL },
      ],
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["node:*"], message: NO_EXTERNAL }] },
      ],
    },
  },
  {
    files: ["src/ui-kit/**/*.{ts,tsx}"],
    ignores: ["src/ui-kit/**/*.test.{ts,tsx}", "src/ui-kit/test-setup.ts"],
    rules: {
      "no-restricted-globals": ["error", ...UI_KIT_RESTRICTED_GLOBALS],
      "no-restricted-properties": ["error", ...UI_KIT_RESTRICTED_PROPERTIES],
      "no-restricted-syntax": ["error", ...UI_KIT_RESTRICTED_SYNTAX],
    },
  },
  {
    files: ["src/storage/**/*.ts"],
    ignores: ["src/storage/**/*.test.ts"],
    rules: {
      "no-restricted-globals": ["error", ...STORAGE_RESTRICTED_GLOBALS],
      "no-restricted-properties": ["error", ...STORAGE_RESTRICTED_PROPERTIES],
      // new Function(...) と Function(...) による文字列の評価を禁止する（NFR8.1）。
      "no-new-func": "error",
      "no-eval": "error",
    },
  },
  {
    files: ["src/bookkeeping-core/**/*.ts"],
    ignores: ["src/bookkeeping-core/**/*.test.ts", "src/bookkeeping-core/test-fixtures.ts"],
    rules: {
      "no-restricted-globals": ["error", ...BOOKKEEPING_RESTRICTED_GLOBALS],
      "no-restricted-properties": ["error", ...BOOKKEEPING_RESTRICTED_PROPERTIES],
      // new Function(...) と Function(...) による文字列の評価を禁止する（NFR8.1）。
      "no-new-func": "error",
      "no-eval": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "fake-indexeddb", message: BOOKKEEPING_NO_FAKE_IDB }],
          patterns: [{ group: ["fake-indexeddb/*"], message: BOOKKEEPING_NO_FAKE_IDB }],
        },
      ],
    },
  },
  {
    files: ["src/csv-exchange/**/*.ts"],
    ignores: ["src/csv-exchange/**/*.test.ts", "src/csv-exchange/test-fixtures.ts"],
    rules: {
      "no-restricted-globals": ["error", ...CSV_RESTRICTED_GLOBALS],
      "no-restricted-properties": ["error", ...CSV_RESTRICTED_PROPERTIES],
      // new Function(...) と Function(...) による文字列の評価を禁止する（NFR8.1）。
      "no-new-func": "error",
      "no-eval": "error",
      "no-restricted-imports": ["error", CSV_RESTRICTED_IMPORTS],
    },
  },
  {
    files: ["src/monthly-summary/**/*.ts"],
    ignores: ["src/monthly-summary/**/*.test.ts", "src/monthly-summary/test-fixtures.ts"],
    rules: {
      "no-restricted-globals": ["error", ...SUMMARY_RESTRICTED_GLOBALS],
      "no-restricted-properties": ["error", ...SUMMARY_RESTRICTED_PROPERTIES],
      // new Function(...) と Function(...) による文字列の評価を禁止する（NFR8.1）。
      "no-new-func": "error",
      "no-eval": "error",
      "no-restricted-imports": [
        "error",
        { paths: SUMMARY_IMPORT_PATHS, patterns: SUMMARY_IMPORT_PATTERNS },
      ],
    },
  },
  {
    // 計算の部品だけ、上の一覧に Date・Math.random・setTimeout・setInterval を足した完全な一覧を書き切る。
    // U4 からは import type だけを許す（値の import は禁止）ため、import の規則は TypeScript 版に置き換える。
    files: ["src/monthly-summary/compute.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...SUMMARY_RESTRICTED_GLOBALS,
        ...SUMMARY_COMPUTE_EXTRA_GLOBALS.map((name) => ({ name, message: SUMMARY_COMPUTE_PURE })),
      ],
      "no-restricted-properties": [
        "error",
        ...SUMMARY_RESTRICTED_PROPERTIES,
        { object: "Math", property: "random", message: SUMMARY_COMPUTE_PURE },
      ],
      "no-new-func": "error",
      "no-eval": "error",
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            ...SUMMARY_IMPORT_PATHS,
            {
              name: "../bookkeeping-core",
              allowTypeImports: true,
              message: SUMMARY_COMPUTE_TYPE_ONLY,
            },
            {
              name: "../bookkeeping-core/index",
              allowTypeImports: true,
              message: SUMMARY_COMPUTE_TYPE_ONLY,
            },
          ],
          patterns: SUMMARY_IMPORT_PATTERNS,
        },
      ],
    },
  },
  {
    // U7 app（テストを除く）。画面は U4・U5・U6 の公開窓口と ui-kit の窓口だけを使う。
    files: ["src/app/**/*.{ts,tsx}"],
    // テストと、テスト専用の道具（test-fixtures.ts。U3 の差し替えを使う）は対象外。
    ignores: ["src/app/**/*.test.{ts,tsx}", "src/app/test-fixtures.ts"],
    rules: {
      "no-restricted-globals": ["error", ...APP_RESTRICTED_GLOBALS],
      "no-restricted-properties": ["error", ...APP_RESTRICTED_PROPERTIES],
      "no-restricted-syntax": ["error", ...APP_RESTRICTED_SYNTAX],
      // new Function(...) と Function(...) による文字列の評価を禁止する（NFR8.1）。
      "no-new-func": "error",
      "no-eval": "error",
      "no-restricted-imports": [
        "error",
        { paths: APP_IMPORT_PATHS, patterns: APP_IMPORT_PATTERNS },
      ],
    },
  },
  {
    // 配布の検査の script（scripts/*.mjs）は Node.js で動くため、Node.js の globals（process、console）を許す。
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
);

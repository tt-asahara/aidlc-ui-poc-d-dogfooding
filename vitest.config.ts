import { defineConfig } from "vitest/config";

// プロジェクト共通のテスト設定。Unit ごとにテストの環境が違うため、プロジェクトに分けて実行する。
// - data-contract（U1）: node 環境。純粋な関数だけのため。
// - ui-kit（U2）: jsdom 環境。画面部品の描画と操作を確かめるため（準備ファイルで jest-dom と dialog の補いを入れる）。
// - storage（U3）: node 環境。IndexedDB は fake-indexeddb をテストの中で差し込む。
// 後続の Unit は、自分のフォルダをいずれかのプロジェクトの include に加えるか、新しいプロジェクトを足す。
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "data-contract",
          environment: "node",
          include: ["src/data-contract/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui-kit",
          environment: "jsdom",
          include: ["src/ui-kit/**/*.test.{ts,tsx}"],
          setupFiles: ["src/ui-kit/test-setup.ts"],
        },
      },
      {
        // U3 storage: node 環境。IndexedDB の代わりに fake-indexeddb をテストごとに新しく用意する（グローバルには入れない）。
        extends: true,
        test: {
          name: "storage",
          environment: "node",
          include: ["src/storage/**/*.test.ts"],
        },
      },
      {
        // U4 bookkeeping-core: node 環境。主に U3 の差し替え（createMemoryStorage）を使い、
        // 別のタブ・版上げ・性能のテストだけ fake-indexeddb をテストの中で差し込む。偽のタイマーは使わない。
        extends: true,
        test: {
          name: "bookkeeping-core",
          environment: "node",
          include: ["src/bookkeeping-core/**/*.test.ts"],
        },
      },
      {
        // U6 csv-exchange: node 環境。File・Blob・TextDecoder は Node.js 24 の組み込みを使い、
        // Book は U4 の openBook に U3 の差し替え（createMemoryStorage）を渡して作る。偽のタイマーは使わない。
        extends: true,
        test: {
          name: "csv-exchange",
          environment: "node",
          include: ["src/csv-exchange/**/*.test.ts"],
        },
      },
      {
        // U7 app: jsdom 環境。画面の操作・表示を確かめる（準備ファイルは U2 と同じ）。保存は U3 の差し替えで行う。偽のタイマーは使わない。
        extends: true,
        test: {
          name: "app",
          environment: "jsdom",
          include: ["src/app/**/*.test.{ts,tsx}"],
          setupFiles: ["src/ui-kit/test-setup.ts"],
        },
      },
      {
        // U5 monthly-summary: node 環境。計算は配列だけ、取得は U4 の openBook に U3 の差し替えを渡した Book でテストする。
        // 性能の目安だけ fake-indexeddb をテストの中で差し込む。偽のタイマーは使わない。
        extends: true,
        test: {
          name: "monthly-summary",
          environment: "node",
          include: ["src/monthly-summary/**/*.test.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/test-setup.ts",
        "src/**/test-fixtures.ts",
        // 型だけの宣言（実行されるコードがない）。
        "src/**/vite-env.d.ts",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        // team.md Testing Posture・NFR6.1 の下限。通すために下げてはならない。
        lines: 80,
        // U2 単独でも行 80% を満たすことを確かめる（全体の値に U1 の高いカバレッジが混ざって隠れないように）。
        "src/ui-kit/**": { lines: 80 },
        // U3 単独でも行 80% を満たすことを確かめる（NFR6.1）。
        "src/storage/**": { lines: 80 },
        // U4 単独でも行 80% を満たすことを確かめる（NFR6.1）。
        "src/bookkeeping-core/**": { lines: 80 },
        // U6 単独でも行 80% を満たすことを確かめる（NFR6.1）。
        "src/csv-exchange/**": { lines: 80 },
        // U5 単独でも行 80% を満たすことを確かめる（NFR6.1）。
        "src/monthly-summary/**": { lines: 80 },
        // U7 単独でも行 80% を満たすことを確かめる（NFR6.1）。
        "src/app/**": { lines: 80 },
      },
    },
  },
});

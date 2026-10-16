import { defineConfig } from "vite";

// 画面（U7）のビルドと開発サーバーの設定（infrastructure-specification 3章）。
// - ルートは index.html、出力は dist/（静的な HTML・JavaScript・CSS だけ。サーバーは要らない）。
// - 待ち受けは 127.0.0.1 に固定し、外部には公開しない。
// - 外部の参照（CDN、外部フォント）は入れない。React 用のプラグインは使わない（JSX は tsconfig の react-jsx）。
export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
});

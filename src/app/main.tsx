// 起動点（index.html が読み込む）。アプリの枠を描画する。保存の準備（openBook）は枠の中で一度だけ行う（BR1.2）。
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { renderScreen } from "./screens/renderScreen";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("起動点の要素 #root が index.html にありません");
}

createRoot(container).render(<App renderScreen={renderScreen} />);

// 開発用の計測（performance-design 3章）。記録は import.meta.env.DEV の分岐の中だけに行う。
// 本番ビルドでは分岐が消え、計測の文字列（perf:）は成果物に残らない（dist の検査で確かめる）。
// 合否の計測は Build and Test で実ブラウザから外側に測る。ここは開発中の目安だけに使う。

export interface PerfSample {
  name: string;
  durationMs: number;
}

const devSamples: PerfSample[] = [];

/** 操作の時間を記録する（開発の目安。本番では何もしない）。 */
export function recordPerf(name: string, durationMs: number): void {
  if (import.meta.env.DEV) {
    devSamples.push({ name: `perf:${name}`, durationMs });
  }
}

/** 記録の写し（テストと開発中の確認用）。 */
export function perfSamples(): readonly PerfSample[] {
  return [...devSamples];
}

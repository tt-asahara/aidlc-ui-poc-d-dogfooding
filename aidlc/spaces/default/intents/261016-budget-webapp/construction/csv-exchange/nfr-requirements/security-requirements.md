# 安全性と信頼性の要件（csv-exchange）

- 出典: `inception/requirements-analysis/requirements.md`（NFR1、NFR4、NFR8、FR6.2、FR6.3、FR7.4〜FR7.6、FR8.2、FR8.3）、`construction/csv-exchange/functional-design/rules.md`（BR1.1〜BR5.2）、`inception/contract-design/contract-summary.md`（C1、C3、C5）、`aidlc/spaces/default/memory/project.md`、Functional Design のレビュー（Major 1・Minor 4）
- U6 は利用者が選んだファイルを読み、書き出すファイルを作る。どちらもブラウザ内だけで行い、外部へ送らない。CSV の値は信用できない入力として扱う。

## 1. 要件

| ID | 要件 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR1.1 | U6 はネットワークに一切アクセスせず、保存先（IndexedDB・localStorage・sessionStorage・Cookie）を直接使わない。ファイルは File の読み取りと Blob の生成だけで扱う | ESLint で `src/csv-exchange/` の非テストファイルに fetch、XMLHttpRequest、WebSocket、EventSource、navigator.sendBeacon、indexedDB、localStorage、sessionStorage、document.cookie、eval、new Function を禁止する | NFR1、FR6.2、BR5.1 |
| NFR4.1 | 取り込みの確定は U4 の1回の書き込み処理で行い、途中の失敗・プレビュー後のカテゴリの削除のどちらでも1件も追加されない | 保存失敗の注入と、プレビュー後にカテゴリを消してからの確定のテスト | NFR4、FR7.4、AC7.2.3、BR4.1、BR4.2 |
| NFR4.2 | 上限（1MB、5,000 件）を超えるファイルは中身を解析せずに断る。1MB 超えは中身を読む前に断る | 境界値（1,048,576 バイトと 1 バイト超え、5,000 件と 5,001 件）のテスト | FR7.6、BR2.1、BR2.4 |
| NFR4.3 | U6 の操作は例外を投げず、ファイル全体の理由（大きすぎ・多すぎ・空・見出しの不一致・形の誤り・読めない）を区別して返す | 各理由のテスト | FR7.5、FR8.2、BR5.2 |
| NFR8.1 | 書き出す値は U1 の数式対策を通し、読み込んだ値は U1 の検証を通した値だけを取り込む。U6 は値を評価・実行しない | 数式対策の往復のテスト、コードの確認（eval・new Function の禁止は NFR1.1 の Lint） | NFR8、FR6.3 |
| NFR8.2 | 取り込めない行の raw はファイル上の値のまま返し、表示時のエスケープは U7 が行う（U6 は HTML を組み立てない） | `<script>` を含む値の行が raw にそのまま入るテスト | NFR8、BR3.5 |
| NFR8.3 | U6 が作る理由の文言は固定の日本語で、入力値を埋め込まない | 文言の定数を確かめるテスト | C1（文言の方針）、BR3.1、BR3.3 |
| NFR8.4 | テストデータはすべて架空 | テストデータの目視確認 | project.md |

## 2. 脅威と対策

| 脅威 | 対策 | 関連 |
|------|------|------|
| 表計算ソフトでの数式の実行（CSV インジェクション） | U1 の数式対策で書き出す（NFR8.1） | FR6.3 |
| 巨大なファイルによる画面の固まり | 中身を読む前の大きさの確認と件数の上限（NFR4.2） | FR7.6 |
| CSV の値を使った表示の乗っ取り | U6 は値を文字列のまま渡し、U7 がエスケープして表示（NFR8.2） | NFR8 |
| 半端な取り込み | U4 の1回の書き込み処理（NFR4.1） | NFR4 |
| 外部への意図しない送信 | 通信と保存先の直接の参照の禁止（NFR1.1） | NFR1 |

## 3. Functional Design のレビューの扱い

| 指摘 | この段階での扱い |
|------|------------------|
| Major: U1 の検証に一部失敗した行の照合 | U1 の窓口を変えず、U1 の検証をすべて通った行だけをカテゴリと照合する（NFR Design に書き、Unit の承認で確認を受ける） |
| ImportFileError の付随値 | NFR Design で型をそのまま書く |
| AC7.1.1 の文言の解釈 | Unit の承認で確認を受ける |
| BR4.2 の「変わった」 | 名前の変更では取り込みは成功し、プレビューの名前だけが古くなる、と NFR Design で明記する |
| csv-exchange 用のテストの設定 | tech-stack-decisions.md の NFR6.1 とコード生成の計画で扱う |

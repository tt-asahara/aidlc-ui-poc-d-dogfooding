# 単体テストの手順（storage）

## テストの道具と設定

- テストランナー: Vitest（`vitest.config.ts` の storage 用プロジェクト、環境 node）
- IndexedDB の代わり: fake-indexeddb（テストごとに新しい IDBFactory を作り、dbName もテストごとに別にする。テスト間でデータを共有しない）
- カバレッジ: @vitest/coverage-v8（全体と `src/storage/**` それぞれ行 80% 以上）
- 前提: Node.js 24、`npm ci` 済み

## この Unit のテストの実行

この Unit のテストだけを実行する:

```bash
npx vitest run --project storage
```

最初のテストを書く前の準備確認:

```bash
npx vitest run --project storage --passWithNoTests
```

この Unit のカバレッジを確かめる:

```bash
npx vitest run --project storage --coverage --coverage.include='src/storage/**/*.ts' --coverage.exclude='src/storage/**/*.test.ts'
```

## 目標

- `src/storage/**` の行カバレッジ 80% 以上（NFR6.1）
- 部品（keys、pending、idbStorage、memoryStorage）ごとに 5〜8 件程度と、本物と差し替えに同じものを流す契約テスト、性能の目安のテスト。全体で約45件
- 各部品で正常系1件以上、異常・境界2件以上（construction.md Testing Standards）
- 必須のテスト観点: 空データ（空の保存領域の読み取り）、読み込み中（差し替えの delayMs）、保存失敗（work の例外・`{ ok: false }`・failWrites・容量超過・2件目の put の失敗）。入力エラーは U1 の検証の役割（U3 は検証済みの値だけを受け取る）で、U3 では複製できない値の put の失敗として確かめる。キーボード操作は画面のない U3 には該当しない

## テストを書く順序

U3 は「その他のレイヤー」なので、各部品を実装した後にその部品のテストを書いて実行する（Testing Contract）。

## 差し替え・偽物

- IndexedDB: fake-indexeddb。利用不可・開く要求の例外・拒否・容量超過は、fake-indexeddb の IDBFactory を包んだテスト用の差し込みで起こす（`openStorage` の `indexedDB` 引数）。
- 時計: `openStorage` の `now` 引数で初期化日時を固定する。妨げの時間切れは `blockedTimeoutMs` を短くして確かめる。
- 自動確定: work の中で `await new Promise((r) => setTimeout(r, 0))` を入れて別の周回に進める。`await Promise.resolve()` では確定しないこと（正常に動くこと）も確かめる。
- fake-indexeddb で通ることは本物のブラウザでの証明ではないため、AC1.2.1（再読み込み後の保持）と保存失敗の表示は U7 の Build and Test で本物のブラウザで確かめる。

## テストデータ

- 収支・カテゴリ・予算はすべて架空（例: 「架空の食費」「架空のランチ」、金額は整数の円）。実在の固有名詞・口座情報を使わない。
- 性能の目安には、決まった規則で作った架空の収支 5,000 件を使う（乱数を使わず再現できるようにする）。

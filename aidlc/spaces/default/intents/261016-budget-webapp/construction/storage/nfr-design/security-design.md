# 安全性と信頼性の設計（storage）

- 出典: `construction/storage/nfr-requirements/security-requirements.md`（NFR1.1、NFR4.1〜NFR4.4、NFR7.1、NFR8.1、NFR8.2）、`construction/storage/nfr-requirements/tech-stack-decisions.md`（NFR3.1、NFR6.1、NFR6.2、NFR9.1）、`construction/storage/functional-design/functional-spec.md`（W1〜W3）、`construction/storage/functional-design/rules.md`（BR1.1〜BR5.2）、`inception/contract-design/contract-summary.md`（C2）、`nfr-design-questions.md`（Q1 = A）、NFR Requirements のレビュー（Major 2・Minor 4）
- U3 は種類 library。認証・暗号化・通信はない。この設計の中心は「書き込みのすべて成功かすべて取り消し」を仕組みで守ることである。

## 1. 書き込みの方式：まとめて保存（Q1 = A、NFR4.1・NFR4.2）

### 1.1 なぜこの方式にするか

IndexedDB の処理は、処理の中の要求がすべて終わり、次の要求が出ないまま別の周回（タイマー、通信の待ちなど）に進むと、自動で確定する。microtask の待ち（`await Promise.resolve()` など）では確定しない。work がその場で put していると、自動確定の後に失敗しても、それまでの put は残る。そこで put・delete はその場で保存せず、work が成功を返した後にまとめて保存する。

### 1.2 流れ

1. write は、指定した保存領域で1回の読み書きの処理を開き、変更の溜め場所（保存領域ごとの「書く予定の値」と「消す予定のキー」）を用意する。
2. work に TxContext を渡す。
   - put・delete は溜め場所に記録するだけで、すぐに解決する（IndexedDB への要求は出さない）。
   - get・getAll・getAllByIndex・count は IndexedDB から読み、溜め場所の変更を重ねた結果を返す（2.3 節）。
3. work が `{ ok: true }` を返したら、溜めた変更を、待ちを挟まずに続けて IndexedDB へ要求する。その後、処理の完了を待って ok を返す。
4. work が `{ ok: false }` を返したら、処理を取り消して aborted（理由は work の値）を返す。溜めた変更は捨てる。
5. work が例外を投げたら、処理を取り消して write-failed を返す。
6. 3 の要求の時点で処理がすでに確定していた（自動確定）場合、要求は例外になる。まだ何も書いていないので保存領域は元のままで、write-failed を返す。
7. 3 の要求の後で保存に失敗した（容量超過など）場合、処理全体が取り消され、write-failed を返す（容量超過の場合は理由を区別する。NFR4.4）。

```text
write(stores, work):
  tx = db.transaction(stores, "readwrite"); pending = new Pending()
  result = await work(ctxOver(tx, pending))   // put/delete は pending へ
  if (!result.ok) { tx.abort(); return aborted(result.error) }
  try { pending.applyTo(tx) }                 // 待ちを挟まず続けて要求する
  catch { return writeFailed() }              // 自動確定済み = 何も書かれていない
  return await completion(tx)                 // 完了で ok、失敗で write-failed
```

### 1.3 読み取りへの変更の重ね方

| 操作 | 結果 |
|------|------|
| get(store, key) | 消す予定のキーなら undefined。書く予定の値があればその値。どちらでもなければ IndexedDB の値 |
| getAll(store) | IndexedDB の値から、消す予定・書く予定のキーを除き、書く予定の値を加える。キーの順に並べる |
| getAllByIndex(store, index, value) | getAll と同じ重ね方をして、索引の値（byMonth は date の先頭7文字、byCategory は categoryId）が一致するものだけ返す |
| count(store, index, value) | getAllByIndex の件数 |

- 同じキーに何度 put・delete しても、最後の操作だけが残る。
- 重ねた結果は、溜め場所の値の写し（構造化複製と同じ意味の深い写し）を返す。work が返った値を書き換えても溜め場所は変わらない。

### 1.4 自動確定を検出できる範囲

| work の書き方 | 結果 |
|---------------|------|
| TxContext の操作と microtask の待ちだけ | 正しく動く |
| 別の周回に進む待ち（setTimeout など）の後に、読み取りをする | 読み取りの要求が例外になり、write-failed。何も書かれない |
| 別の周回に進む待ちの後に、読み取りをせず成功を返す | まとめて保存の要求が例外になり、write-failed。何も書かれない |
| 別の周回に進む待ちの後に、put・delete だけをする | 溜めるだけなので気づかないが、最後の保存で write-failed。何も書かれない |

どの書き方でも「一部だけ保存される」ことはない。ただし、別の周回の待ちの前に読んだ値に基づいて、後から書くことはできない（write-failed になる）。この決まりを C2 の説明に書く。

### 1.5 テスト用の差し替え（createMemoryStorage）

同じ溜め場所と重ね方の部品（2章の Pending）を使う。work が成功したら、溜めた変更を保存領域の写しに当ててから入れ替える。差し替えには自動確定がないため、1.4 節の「別の周回の待ち」の行は差し替えでは write-failed にならない。この行は本物の実装だけのテストとし、契約テストの共通部分から外す（理由をテストに書く）。

## 2. 開く・閉じる・版（NFR4.3、NFR7.1）

- 版の確認と、版の変更の知らせでの切断は functional-spec.md の W1・状態遷移のとおり。
- 版の変更の知らせを受けた時点で動いている write は、そのまま完了するか取り消されるかのどちらかで、一部だけ保存されることはない（1章）。
- 妨げ（blocked）で5秒たって open-failed を返した後に、開く要求が遅れて成功した場合は、その接続をすぐ閉じる（FD レビュー Minor）。
- 開いたデータベースの版が新しい場合は、読み取った版（`db.version`）を newer-version に添える必要はない（C2 の型どおり、種類だけを返す）。

### 2.1 IndexedDB の差し込み

`openStorage` の任意の引数に `indexedDB?: IDBFactory` を加える（既定は `globalThis.indexedDB`）。これにより次を確かめられる（NFR7.1、レビュー Minor）。

| 状況 | 差し込むもの | 結果 |
|------|--------------|------|
| IndexedDB がない | `undefined`（かつ globalThis にもない） | unavailable |
| 開く要求が例外を投げる | open で例外を投げる差し替え | unavailable |
| ブラウザが利用を拒否した（開く要求の error が SecurityError・InvalidStateError） | open の要求が error になる差し替え | unavailable |
| それ以外の開く失敗 | open の要求が他の error になる差し替え | open-failed |
| 通常 | fake-indexeddb の IDBFactory（テストごとに新しく作る） | 開ける |

任意の引数は他に `dbName?`（既定 `budget-webapp`）、`now?: () => Date`（初期化日時の固定）、`blockedTimeoutMs?`（既定 5000、テストで短くする）。C2 の `openStorage` の型をこの形に更新する（コード生成で同時に）。

## 3. 外部に出さないこと（NFR1.1、NFR8.1、NFR8.2）

eslint.config.js に `src/storage/**/*.ts`（テストを除く）向けの設定を加える。

| 規則 | 禁止するもの |
|------|--------------|
| no-restricted-globals | fetch、XMLHttpRequest、WebSocket、EventSource、localStorage、sessionStorage、eval |
| no-restricted-properties | navigator.sendBeacon、window.fetch、globalThis.fetch、window.localStorage、globalThis.localStorage、document.cookie |
| no-restricted-syntax | `new Function(...)` の呼び出し |

- indexedDB はこのディレクトリでだけ許可する（U2・U1 の禁止はそのまま）。
- U3 は値を文字列として組み立てたり評価したりしない。構造化複製で保存するだけ（NFR8.1）。
- テストデータは架空の名前・金額だけを使う（NFR8.2）。

## 4. テストの設計（NFR3.1、NFR6.1、NFR6.2、NFR9.1）

### 4.1 構成

- vitest.config.ts に storage 用のプロジェクト（環境 node、対象 `src/storage/**/*.test.ts`）を加え、`src/storage/**` の行カバレッジ下限 80% をディレクトリ単位で設ける。
- 契約テストは1つの関数にまとめ、「本物（fake-indexeddb の新しい IDBFactory と、テストごとに別の dbName）」と「差し替え」の2つに同じものを流す（BR5.2）。
- 実装を書いた後にテストを書く（team.md の Ordering。U3 は「その他のレイヤー」）。
- 追加の依存は fake-indexeddb（開発時、正確なバージョン、package-lock.json に記録）。

### 4.2 必須のテスト観点（team.md、レビュー Minor）

| 観点 | この Unit のテスト |
|------|------------------|
| 正常 | 初回に開くと保存領域・索引・メタ情報ができる。書いて読み直すと同じ値。索引で引ける。2回目は作り直さない |
| 空データ | 空の保存領域の getAll は空の配列、count は 0、get は undefined |
| 読み込み中 | 差し替えの delayMs で、結果が返る前に未完了であること |
| 保存失敗 | work の例外・`{ ok: false }`・failWrites・容量超過（put が QuotaExceededError になる差し替え）で、何も書かれないこと |
| 自動確定 | 1.4 節の表の各行（本物だけ） |
| 版 | 新しい版のデータベースで newer-version、版の変更の知らせの後の read・write が newer-version、データは変わらない |
| 利用不可 | 2.1 節の表の各行 |
| 閉じた後・範囲外 | close の後の read-failed・write-failed、work が終わった後の TxContext の使用・指定外の保存領域の操作が失敗 |

### 4.3 性能の確かめ方（NFR3.1、レビュー Minor）

fake-indexeddb 上の時間は実ブラウザの値ではなく、保存の層の大きな遅れを見つけるための目安とする。

| 測るもの | データ | 合格条件 |
|----------|--------|----------|
| 5,000 件を1回の write で保存 | 12か月に均等に分けた架空の収支 | 2,000ms 以内 |
| 1か月分の読み出し（byMonth） | 上と同じ（1か月 約417件） | 300ms 以内 |
| 1か月分の読み出し（byMonth、偏り） | 5,000 件すべて同じ月 | 1,000ms 以内 |

- 測定値はテストの出力に記録する。U1 で同時実行のテストの下で時間の判定が一度だけ不安定になったため、合格条件は実測の数倍の余裕をとる。それでも不安定な場合は Build and Test で記録し、条件を緩めずに原因を調べる。

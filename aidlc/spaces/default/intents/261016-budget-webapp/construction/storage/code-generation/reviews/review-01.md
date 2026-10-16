## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T11:29:27Z
**Iteration:** 1

### 概要

助言のみの単一パスとして、src/storage/ の実装（idbStorage.ts、memoryStorage.ts、pending.ts、keys.ts、errors.ts、schema.ts、types.ts）、契約テスト、設定ファイル、contract-summary.md の C2 を確認した。`npm run verify` は成功した（format・lint・typecheck・28 ファイル 417 件のテスト、行カバレッジ全体 98.91%、src/storage/** 98.18%）。

重点項目の確認結果は次のとおり。

- **まとめて保存の正しさ**: `applyOperations` は同期のループで、要求の間に await はない。ok を返すのは `complete` を受けた場合だけである。要求中の例外は `safeAbort` の後に write-failed、work の例外と `{ ok: false }` も取り消してから返す。自動確定は `watch.finished` の判定と、確定後の要求が投げる例外の両方で write-failed になり、何も書かれないまま ok を返す道は見つからなかった。
- **newer-version の確認**: 版を指定せず開き直し、`onupgradeneeded` では `safeAbort` するため、データベースを新しく作らない。読めなければ open-failed にする。テストで found と、データが変わらないことを確かめている。
- **差し替えの自動確定**: `setTimeout(0)` は `runWrite` の開始時に仕掛ける。`delayMs` の待ちはキューに入る前なので影響しない。同期の長い処理はタイマーを走らせないため、正当な処理が誤って write-failed になることはない。microtask だけの待ちは契約テストで正常に保存される。
- **C2 との一致**: types.ts の名前と型は contract-summary.md の C2 と一致した。追加分（`StorageError` の newer-version、`WriteError<E>`、`openStorage` の任意引数）は C2 の更新記録にある。
- **U1・U2 の設定**: vitest.config.ts と eslint.config.js の既存ブロックは弱められていない。しきい値の追加と storage 用ブロックの追加だけである。
- **code-summary の計画との違い**: ファイルとテストの追加、ESLint の `no-eval` 追加はいずれも妥当である。
- **テストの質**: 常に通るテストは見つからなかった。2件目の put の失敗、容量超過、自動確定の3パターン、newer-version はいずれも書き込み後の状態まで確かめている。

以下はいずれも人が承認前に知っておくとよい事項で、ブロックするものではない。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | src/storage/types.ts > MemoryStorageOptions、src/storage/memoryStorage.ts > MemoryStorageHandle | 本物は別のタブが版を上げると以後の読み書きを `newer-version`（StorageError）にするが、差し替えには同じ状態を起こす指定がなく、`failOpen` で開く時の newer-version を返せるだけである。code-summary.md の引き継ぎも、U4 が StorageError の newer-version を扱うと書いている。U4 は差し替えでこの分岐をテストできず、BR5.1（本物と同じ窓口と規則）との差が残る。 | U4 の Functional Design で扱いが決まった時点で、差し替えに実行中の newer-version を起こす指定（例 `failNewerVersion`）を足すか、U4 のテストでその分岐を別の手段で確かめることを引き継ぎに明記する。 | New |
| R-02 | Minor | src/storage/idbStorage.ts > toStored、src/storage/keys.ts > indexValueOf | 収支の `date` が文字列でない、または短い不正な値を put すると、本物は `String(date)` の先頭7文字を month として保存し byMonth で引ける。差し替えは `date` が文字列でなければ索引の値が undefined になり、引けない。型の上は C1 の Transaction だけが渡る前提なので通常は起きないが、本物と差し替えが同じ結果になる契約テストの範囲外である。 | 型を外れた収支を put したときの振る舞いを、決まりとして書く（保存側は検証しない、と C2 または security-design に明記する）か、両実装で同じ扱い（例 month を作れなければ put を失敗にする）にそろえる。 | New |
| R-03 | Minor | src/storage/memoryStorage.ts > startAutoCommitWatch | 自動確定の再現は実際のタイマー（`setTimeout(0)`）に依存する。U4〜U7 のテストが `vi.useFakeTimers` を使うと、work の実行中にタイマーが進められたときだけ自動確定とみなされ、現実の挙動と食い違う。進めるタイミングによっては、正当な処理が誤って write-failed になり得る。この組み合わせを確かめるテストはない。 | 差し替えの利用者向けの注意（偽のタイマーと併用するときは work の実行中に時刻を進めない）を README または unit-test-instructions.md に1行書く。あわせて、偽のタイマー下での振る舞いを確かめるテストを1件足すかどうかを検討する。 | New |
| R-04 | Minor | src/storage/idbStorage.ts > waitForOpen（onblocked と onupgradeneeded） | 妨げの待ちが時間切れで open-failed を返した後に、妨げが解けると保存領域の版の更新（移行）が走り、その後で接続を閉じる。利用者には失敗と伝えたのに、保存領域は新しい版に上がる。更新は冪等で、データも失われないため実害は小さい。 | 時間切れ後は `onupgradeneeded` で `safeAbort` するか、この挙動を承知のうえで許容する旨を security-design または code-summary に記す。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| npm run verify | PASS（format・lint・typecheck・417 テストすべて合格、行カバレッジ 98.91%、storage 98.18%） | 行 80% の下限と U1・U2 のテストはそのまま通っており、弱められていない。 |

### Summary

まとめて保存は、要求の間に await がなく、complete を受けるまで ok を返さず、失敗時は安全に取り消す。この設計は IndexedDB の意味に沿っており、部分書き込みや空の成功を返す道は見つからなかった。指摘は差し替えとの差と注意書きに関する Minor 4 件だけで、READY とする。本物のブラウザでの確認は、引き継ぎのとおり U7 の Build and Test に委ねられている。

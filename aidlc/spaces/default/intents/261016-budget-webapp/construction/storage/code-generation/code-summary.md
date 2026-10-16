# コード生成のまとめ（storage）

## 作成・変更したファイル

| 区分 | ファイル |
|------|----------|
| 実装（新規） | src/storage/ の types.ts（C2 の公開型）、schema.ts、keys.ts、pending.ts、errors.ts、idbStorage.ts、memoryStorage.ts、index.ts |
| テスト（新規） | src/storage/ の contract.ts（契約テストの本体）、contract.test.ts、idbStorage.test.ts、memoryStorage.test.ts、pending.test.ts、keys.test.ts、schema.test.ts、performance.test.ts、lint-config.test.ts、test-fixtures.ts（テスト専用） |
| 共通設定（変更） | package.json・package-lock.json（開発時の依存 fake-indexeddb 6.2.5 を正確なバージョンで追加）、vitest.config.ts（storage 用プロジェクト、環境 node、`src/storage/**` に行 80%）、eslint.config.js（storage 用のブロックに禁止の一覧を書き切り、no-new-func・no-eval を追加。indexedDB はこのディレクトリでだけ許可）、README.md |
| 設計文書（契約の更新） | inception/contract-design/contract-summary.md の C2 |

- src/data-contract/ と src/ui-kit/ は変更していない。設定ファイルはファイル用の道具だけで編集した（前の Unit の手順違反は再発していない）。

## テストとカバレッジ

- `npm run verify`: 成功（終了コード 0）。開発担当の最終実行と、オーケストレーター側の再実行の両方で、28 ファイル・417 件（U1 212 件、U2 113 件、U3 92 件）がすべて合格した。
- U3 の内訳: 契約テスト 17 件 × 本物と差し替え（34 件）、本物だけ 20 件、差し替えだけ 7 件、pending 13 件、keys 7 件、schema 3 件、lint 5 件、性能 2 件、その他 1 件。
- 行カバレッジ: 全体 98.91%、src/ui-kit/** 100%、src/storage/** 98.18%（文 97.09%、分岐 90.78%）。しきい値は下げていない。
- テストの順序: U3 は「その他のレイヤー」なので、各部品を実装した後にテストを書いた（Testing Contract）。
- 必須のテスト観点: 空データ（開いた直後の空の保存領域）、読み込み中（差し替えの delayMs）、保存失敗（work の例外・`{ ok: false }`・failWrites・容量超過・2件目の put の失敗）。入力エラーは複製できない値の put の失敗として確かめた。キーボード操作は画面のない U3 には該当しない。
- 性能の目安（fake-indexeddb 上、合格条件は設計どおり）:

| 測ったもの | 測定値 | 合格条件 |
|------------|--------|----------|
| 5,000 件の書き込み（12か月に均等） | 128.3ms | 2,000ms 以内 |
| 1か月分の読み出し（約417件） | 3.7ms | 300ms 以内 |
| 1か月分の読み出し（5,000 件が同じ月） | 25.1ms | 1,000ms 以内 |

## 主な実装上の判断

- まとめて保存（NFR Design Q1 = A）: work の間の put・delete は溜めるだけで、work が `{ ok: true }` を返したら待ちを挟まずに続けて要求する。要求中の例外は安全な取り消し（safeAbort）の後に write-failed、`{ ok: false }` は安全な取り消しの後に aborted（reason は work の値）、work の間に自動確定していたら何も要求せずに write-failed。
- 例外を握りつぶすのは safeAbort の1か所だけ（確定済みの処理への取り消しを、説明のコメント付きで無視する）。
- newer-version（NFR Design レビュー Major）: 開く要求の VersionError では、版を指定せずに開き直して `db.version` を読み、すぐ閉じて found を返す。開き直しの中で版の更新が起きたら取り消し、データベースを新しく作らない。開き直しが失敗した場合・版が新しくなかった場合は found を推測せず open-failed。
- 差し替えの自動確定（NFR Design レビュー Minor）: work の開始時に `setTimeout(0)` を仕掛け、それが走った時点で確定済みとみなす。自動確定のテストを契約テストの共通部分に入れ、本物と差し替えで同じ結果になることを確かめた。読み書きは1本の列で1つずつ順に処理する。delayMs の待ちは処理の開始前に入れるため、自動確定とはみなさない。
- 容量超過は write-failed の message（「保存領域の容量が足りないため保存できませんでした」）で区別し、種類の値は増やさない（C2 に明記）。
- キーの比較は IndexedDB と同じ意味（文字列は符号単位の順、配列は文字列より大きく要素ごとに比べる）。索引の問い合わせは索引の値、次に主キーの順。

## 計画との違い

| 違い | 理由 |
|------|------|
| types.ts、test-fixtures.ts の追加 | 公開型を1か所にまとめるため／架空データと fake-indexeddb の用意の共通化（カバレッジの対象外になる名前） |
| schema.test.ts、lint-config.test.ts の追加 | 古い版からの移行と移行のない版の失敗の確認／禁止の一覧が実際に効き、indexedDB が許可されることの確認（U1・U2 と同じ形） |
| ESLint に no-eval を追加 | eval の呼び出しも禁止するため（no-restricted-globals の eval に加えて） |
| テスト件数 92 件（計画は約45件） | 契約テストを本物と差し替えの両方に流すことと、it.each の展開 |

## 引き継ぎ

- **U7 の Build and Test へ**: 本物のブラウザで AC1.2.1（再読み込みの後も同じ収支と予算が残る）と、保存失敗の表示を確かめる。fake-indexeddb で通ることは本物のブラウザでの証明ではない。
- **U4 の Functional Design へ**: StorageError の newer-version（別のタブで版が上がって接続を閉じた）を、C3 の OperationError で U5〜U7 へ伝えるかを決める（FD レビューの Major、U3 の範囲外）。

## 残る課題

- 時間に依存するテストの揺れ: 開発担当が Step 2 で U1・U2 のテストを初めて流したとき（キャッシュなし、11 秒）、325 件中 1 件が一度だけ失敗した。どのテストかは記録がなく、その後の4回と verify では再現していない。U2 のときにも U1 の性能テストが同時実行の負荷で一度失敗しており、Build and Test で記録して原因を調べる。しきい値は変えていない。
- 性能の測定値は、この実行環境では合格したテストの出力が隠されるため `npm run verify` の出力に出ない。`npx vitest run --project storage src/storage/performance.test.ts --reporter=verbose` で確認できる。
- 容量超過の取り消しを、fake-indexeddb の内部メソッドを呼んで再現している。fake-indexeddb の更新で壊れる可能性がある。

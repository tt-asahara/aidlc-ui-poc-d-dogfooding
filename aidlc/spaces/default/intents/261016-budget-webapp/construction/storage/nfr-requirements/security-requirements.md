# 安全性と信頼性の要件（storage）

- 出典: `inception/requirements-analysis/requirements.md`（NFR1、NFR3、NFR4、NFR7、FR8）、`construction/storage/functional-design/rules.md`（BR1.1〜BR5.2）、`inception/domain-design/decisions.md`（ADR-004）、`inception/contract-design/contract-summary.md`（C2）、`aidlc/spaces/default/memory/project.md`
- U3 は IndexedDB を包む部品で、利用者のブラウザ内にだけデータを保存する。認証・認可は対象外（単一利用者、requirements.md A1）。暗号化はしない（ADR-004：端末の保護は利用者の端末設定に依存）。

## 1. 要件

| ID | 要件 | 確かめ方 | 出典 |
|----|------|----------|------|
| NFR1.1 | U3 はネットワークに一切アクセスしない。IndexedDB 以外の保存先（localStorage、sessionStorage、Cookie）も使わない | ESLint で `src/storage/` の非テストファイルに fetch、XMLHttpRequest、WebSocket、EventSource、navigator.sendBeacon、localStorage、sessionStorage、document.cookie を禁止する | NFR1、BR4.2 |
| NFR4.1 | 1回の書き込み処理は、すべて成功するかすべて取り消される。work の失敗・例外・保存の失敗のいずれでも、それ以前に保存済みのデータは変わらない | 本物とテスト用の差し替えの両方で、途中失敗の後に保存領域の中身が元のままであることの契約テスト | NFR4、AC1.2.2、BR2.2 |
| NFR4.2 | work は TxContext の操作だけを待つ（IndexedDB 以外の非同期処理を待つと処理が自動で確定し、取り消せなくなるため）。確定済みの処理への操作や、確定後の取り消しの試みは write-failed とし、利用者には保存失敗として伝える | 契約の説明に制約を明記し、work の中で関係のない待ちを入れた場合に write-failed になる（成功と偽らない）ことのテスト。テスト用の差し替えも同じ振る舞いにする | NFR4、FD レビュー Major |
| NFR4.3 | アプリより新しい版のデータは書き換えない。別のタブで版が上がったら接続を閉じ、以後の読み書きを newer-version で失敗させる | 版を上げたデータベースを用意して開くテスト、版の変更の知らせを送るテスト | FR1.6、AC1.2.3、BR1.4、BR3.1 |
| NFR4.4 | 保存の失敗（容量超過を含む）は種類を区別して返し、例外を投げず、握りつぶさない | 失敗を起こす差し替えでのテスト | FR8.2、FR8.3、construction.md Error Handling |
| NFR7.1 | IndexedDB が使えない環境（プライベートモードの制限など）では unavailable を返す | indexedDB を外した環境でのテスト | NFR7、FR8.4、BR1.1 |
| NFR8.1 | 保存する値は U1 の検証を通った値だけとし（検証は U4 が行う）、U3 は値を解釈・実行しない（構造化複製で保存するだけ） | U3 が値を文字列として組み立てたり評価したりしないことのコード確認 | NFR8 |
| NFR8.2 | テストデータはすべて架空 | テストデータの目視確認 | C2、project.md |

## 2. 脅威と対策

| 脅威 | 対策 | 関連 |
|------|------|------|
| 書き込みの途中失敗による半端なデータ | 1回の書き込み処理での全体取り消し（NFR4.1、NFR4.2） | NFR4 |
| 古い版のアプリが新しい版のデータを壊す | 版の確認と、別タブの版上げでの接続の切断（NFR4.3） | FR1.6 |
| 外部への意図しない送信 | 通信と他の保存先の参照禁止（NFR1.1） | NFR1 |

## 3. コンプライアンス

- 扱うデータは架空データのみで、端末の外へ出さない。個人情報保護・決済の規制の対象外。

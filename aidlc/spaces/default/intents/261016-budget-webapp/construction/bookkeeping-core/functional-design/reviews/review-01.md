## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-16T11:47:17Z
**Iteration:** 1

### 概要

助言（ADVISORY）の1回だけのレビューです。U3 の実 API（`src/storage/types.ts`、`memoryStorage.ts`）と U1 の検証関数の実シグネチャ、C3 の契約と照合しました。

- 各書き込み操作が指定する保存領域の組み合わせと、書き込み処理の中で使う操作（`getAll`、`get`、`getAllByIndex`、`count`、`put`、`delete`）は、U3 の API で実現できます。
- 書き込みの溜め書きと「同じ処理の中の読み取りには重なって見える」仕様、自動確定の規則（同期の `now()`・`newId()` のみ）、aborted の扱い（`reason` をそのまま返す）、budgets のキー `[categoryId, month]` は設計と一致しています。
- U1 の `validateTransactionInput`、`validateCategoryName(name, type, existing, excludeId?)`、`validateBudgetAmount`、`isValidYearMonth` の呼び方は、設計の記述と合っています。
- traceability.json は構文として解釈でき、US3.1〜US4.3 の AC 20 件がすべて OK の対象 BR を持っています。逆引きに載る BR 以外の BR（BR1.2、BR2.1、BR2.6、BR3.x、BR4.x）はいずれかの AC の対象になっています。
- U3 から引き継いだ項目（`newer-version` の伝え方 = Q1 の A、ならびに偽タイマーを使わない件）は反映されています。

Critical と Major はありません。以下は実装前に人間が把握しておくとよい Minor です。

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/functional-design/functional-spec.md > 1章 US3.4（AC3.4.2）と rules.md > BR3.4 | AC3.4.2 は、予算があるカテゴリの削除確認に「予算も削除される」旨を出すと定めています。しかし Book の読み取りには、保存済みの予算の有無や件数を返す操作がありません。getEffectiveBudgets は引き継ぎ（carried）も返すため、保存済みの設定と区別できません。削除後に返る deletedBudgets は確認の後でしか分かりません。U7 は確認文言を条件分岐できず、固定の注意書きにするしかなくなります。 | 次のどちらかを決めて記録します。(a) 支出カテゴリの削除確認には常に「そのカテゴリの予算もすべて消えます」と出す。(b) 件数を返す読み取りを C3 に任意の追加として足す。決めた内容を U7 の引き継ぎ（4章）に書きます。 | New |
| R-02 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/functional-design/rules.md > BR1.2 logic | 「categories の件数を数え」と書かれていますが、U3 の `TxContext.count` は transactions の byCategory 索引にしか使えません。categories の件数は `getAll("categories")` の長さで求めることになります。書き方のままでは、実装者が count を呼ぼうとして型エラーになります。 | BR1.2 の logic に「`tx.getAll("categories")` の長さが 0 のとき」と、使う操作を明記します。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/functional-design/rules.md > BR2.4、BR3.2（invalid-type）、BR4.1 の month 検証 | month と type の検証エラー（field month・code invalid-month、field type・code invalid-type）は U4 自身が作ることになっています。U1 の公開窓口は `fieldError` を出しておらず、`isValidYearMonth` は真偽値しか返しません。ValidationError の `message` の文言をどこが決めるか、設計に書かれていません。 | U4 が使う文言（定数として持つ）を決めて書くか、U1 に追加を提案します。月と種別のエラーの message の出どころを BR に1行足します。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/261016-budget-webapp/construction/bookkeeping-core/functional-design/rules.md > BR5.1 | 検証に失敗した行があるとき、「最初に失敗した行のエラー」だけを validation として返します。ValidationError には行番号の項目がなく、どの行かは呼び出し側に伝わりません。U6 が事前に検証済みの行だけを渡す前提（C5）なので実害は小さいものの、前提が崩れたときの診断ができません。 | 前提（U6 が検証済みの validRows だけを渡す）を BR5.1 に明記します。行番号を返したい場合は、import-category-missing と同様に任意の項目を足すかを決めます。 | New |

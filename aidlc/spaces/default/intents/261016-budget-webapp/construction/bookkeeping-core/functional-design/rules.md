# 家計簿の中核の規則（bookkeeping-core）

- 出典: `inception/requirements-analysis/requirements.md`（FR2.1〜FR2.5、FR3.1〜FR3.5、FR4.1〜FR4.4、FR7.3、FR8.2、FR8.3）、`inception/user-stories/stories.md`（US3.1〜US3.4、US4.1〜US4.3、AC2.3.1・AC2.3.2、AC2.4.3、AC7.2.1〜AC7.2.4、AC8.3.1・AC8.3.2）、`inception/contract-design/contract-summary.md`（C1、C2、C3）、`inception/domain-design/decisions.md`（ADR-002、ADR-003、ADR-007）、`construction/storage/code-generation/code-summary.md`（引き継ぎ）、`functional-design-questions.md`（Q1 = A）

```yaml
rules:
  - id: BR1.1
    statement: openBook は保存領域を開き、開けない理由を BookOpenResult の status に置き換える
    category: policy
    applies_to: [openBook, BookOpenResult]
    trigger: openBook の呼び出し時
    logic: storage（既定は U3 の openStorage）を呼ぶ。unavailable → unavailable、newer-version → newer-version、open-failed → load-failed（message はそのまま）。例外を投げない
    violation: BookOpenResult の unavailable・newer-version・load-failed
    source: FR1.6, FR8.2, FR8.4, C3

  - id: BR1.2
    statement: カテゴリが0件のときだけ、初期カテゴリ10件を1回の書き込み処理で作る。2回目以降や、別のタブが先に作った場合は作らない
    category: policy
    applies_to: [openBook, InitialCategorySet, Category]
    trigger: 保存領域を開けた直後
    logic: >
      categories を対象にした1回の書き込み処理の中で categories の件数を数え、0 件のときだけ InitialCategorySet を
      支出7件・収入3件の順に、種別ごとに sortOrder 0 から put する。IndexedDB の読み書きの処理は同じ保存領域について
      1つずつ順に実行されるため、2つのタブが同時に開いても、後の処理は先に作られたカテゴリを数えて何もしない
    violation: 書き込みの失敗は load-failed（カテゴリを作れないと記録を始められないため）
    source: FR3.1, AC3.1.1, AC3.1.2, Domain Design レビュー（初期カテゴリの二重作成の防止）

  - id: BR1.3
    statement: openBook の途中で保存の読み書きが失敗したら、開いた接続を閉じて load-failed を返す
    category: policy
    applies_to: [openBook]
    trigger: BR1.2 の処理の失敗
    logic: StorageHandle.close() を呼んでから load-failed（理由の概要）を返す。newer-version の失敗なら newer-version を返す
    violation: load-failed または newer-version
    source: FR8.2

  - id: BR2.1
    statement: 収支の追加は、U1 の検証を通し、同じ書き込み処理の中でカテゴリの存在と種別の一致を確かめてから保存する
    category: validation
    applies_to: [Book.addTransaction, Transaction]
    trigger: addTransaction の呼び出し時
    logic: >
      validateTransactionInput が失敗したら保存せず validation を返す。成功したら transactions・categories の書き込み処理の中で
      categoryId のカテゴリを読む。ない → category-missing、type が違う → category-type-mismatch。どちらでもなければ
      id = newId()、createdAt = updatedAt = now() を付けて put し、保存した Transaction を返す
    violation: validation、rule（category-missing・category-type-mismatch）、storage
    source: FR2.1, FR2.2, FR3.4, AC3.4.4, C3

  - id: BR2.2
    statement: 収支の更新は、id・createdAt を残し、追加と同じ検証と確認をしてから置き換える
    category: validation
    applies_to: [Book.updateTransaction, Transaction]
    trigger: updateTransaction の呼び出し時
    logic: >
      検証は BR2.1 と同じ。書き込み処理の中で id の収支を読み、ない → not-found。カテゴリの確認は BR2.1 と同じ。
      id と createdAt は元の値のまま、updatedAt = now() で put する。日付を別の月に変えた収支は、新しい月の一覧に移る（月は日付から求める）
    violation: validation、rule（not-found・category-missing・category-type-mismatch）、storage
    source: FR2.4, AC2.4.1, AC2.4.2, AC2.4.3

  - id: BR2.3
    statement: 収支の削除は、書き込み処理の中で存在を確かめてから消す
    category: policy
    applies_to: [Book.deleteTransaction]
    trigger: deleteTransaction の呼び出し時
    logic: id の収支を読み、ない → not-found。あれば delete する。確認の表示は U7 が行う
    violation: rule（not-found）、storage
    source: FR2.5, AC2.5.2

  - id: BR2.4
    statement: 対象月の一覧は、日付の新しい順、同じ日付は登録日時の新しい順、さらに同じなら id の昇順で返す
    category: calculation
    applies_to: [Book.listTransactions]
    trigger: listTransactions の呼び出し時
    logic: >
      month が isValidYearMonth を満たさなければ validation（field month、code invalid-month）。満たせば transactions の索引 byMonth で読み、
      date 降順 → createdAt 降順 → id 昇順（文字列の符号単位の順）に並べる。0 件なら空の配列（空データの表示は U7）
    violation: validation、storage
    source: FR2.3, AC2.3.1, AC2.3.2, AC2.3.4

  - id: BR2.5
    statement: 書き出し用の取得は、全期間または対象月の収支を、日付の古い順、同じ日付は登録日時の古い順、さらに id の昇順で返す
    category: calculation
    applies_to: [Book.listAllTransactions]
    trigger: listAllTransactions の呼び出し時
    logic: range が all なら transactions を全件、{ month } なら byMonth で読む（month の検証は BR2.4 と同じ）。date 昇順 → createdAt 昇順 → id 昇順
    violation: validation、storage
    source: FR6.1, C3

  - id: BR2.6
    statement: カテゴリ別の使用件数は、全カテゴリについて参照している収支の件数を返す（参照がなければ 0）
    category: calculation
    applies_to: [Book.getCategoryUsage]
    trigger: getCategoryUsage の呼び出し時
    logic: categories を全件読み、各 id について transactions の索引 byCategory の件数を数え、{ [categoryId]: 件数 } を返す
    violation: storage
    source: FR3.4, AC3.4.1

  - id: BR3.1
    statement: カテゴリの一覧は、支出の後に収入、それぞれ sortOrder の昇順（同じなら createdAt、id の昇順）で返す
    category: calculation
    applies_to: [Book.listCategories]
    trigger: listCategories の呼び出し時
    logic: categories を全件読み、type（expense → income）→ sortOrder → createdAt → id の順に並べる
    violation: storage
    source: FR3.1, AC3.1.1, C3

  - id: BR3.2
    statement: カテゴリの追加は、同じ書き込み処理の中で既存のカテゴリと名前の重複を確かめ、同じ種別の末尾に加える
    category: validation
    applies_to: [Book.addCategory, Category]
    trigger: addCategory の呼び出し時
    logic: >
      type が income・expense のどちらでもなければ validation（field type、code invalid-type）。categories の書き込み処理の中で全件を読み、
      validateCategoryName(name, type, 全件) が失敗したら validation。成功したら id = newId()、sortOrder = 同じ種別の最大値 + 1（なければ 0）、
      createdAt = now() で put し、保存した Category を返す
    violation: validation（blank・too-long・duplicate-name・invalid-type）、storage
    source: FR3.2, FR1.2, AC3.2.1, AC3.2.2, AC3.2.3

  - id: BR3.3
    statement: カテゴリの名前変更は、種別と並び順を変えず、自分以外の同じ種別と重複しないことを確かめて保存する
    category: validation
    applies_to: [Book.renameCategory, Category]
    trigger: renameCategory の呼び出し時
    logic: >
      書き込み処理の中で id のカテゴリを読み、ない → not-found。validateCategoryName(name, その種別, 全件, id) が失敗したら validation。
      成功したら name だけを置き換えて put する。収支・予算は categoryId で参照しているため書き換えない（表示は自動で新しい名前になる）
    violation: validation、rule（not-found）、storage
    source: FR3.3, FR1.2, AC3.3.1, AC3.3.2

  - id: BR3.4
    statement: カテゴリの削除は、収支から使われておらず、同じ種別の最後の1件でないときだけ行い、支出カテゴリならその予算もすべて消す
    category: policy
    applies_to: [Book.deleteCategory, Category, Budget]
    trigger: deleteCategory の呼び出し時
    logic: >
      transactions・categories・budgets の書き込み処理の中で、次の順に確かめる。(1) id のカテゴリがない → not-found。
      (2) 索引 byCategory の収支の件数が 1 以上 → category-in-use（count = その件数。画面で開いた時点ではなく処理の中で数え直す）。
      (3) 同じ種別のカテゴリが自分だけ → last-category-of-type（type）。どれでもなければ、budgets の索引 byCategory で引いた予算をすべて消し、
      カテゴリを消して { deletedBudgets: 消した件数 } を返す。収入カテゴリには予算がないため deletedBudgets は 0
    violation: rule（not-found・category-in-use・last-category-of-type）、storage
    source: FR3.4, FR3.5, AC3.4.1, AC3.4.2, AC3.4.3

  - id: BR4.1
    statement: 予算の設定は、金額を U1 で検証し、同じ書き込み処理の中で支出カテゴリであることを確かめて、その月の値を置き換える
    category: validation
    applies_to: [Book.setBudget, Budget]
    trigger: setBudget の呼び出し時
    logic: >
      month の検証は BR2.4 と同じ。validateBudgetAmount(amount) が失敗したら validation。両方とも失敗なら month → amount の順でまとめて返す。
      budgets・categories の書き込み処理の中で categoryId のカテゴリを読み、ない → category-missing、収入 → category-type-mismatch。
      どちらでもなければ { categoryId, month, amount, updatedAt: now() } を put する（同じキーの値は置き換わる）
    violation: validation、rule（category-missing・category-type-mismatch）、storage
    source: FR4.1, FR1.3, AC4.1.1, AC4.1.2

  - id: BR4.2
    statement: 予算の設定の解除は、その月に設定がある場合だけその1件を消す
    category: policy
    applies_to: [Book.clearBudget, Budget]
    trigger: clearBudget の呼び出し時
    logic: month の検証は BR2.4 と同じ。書き込み処理の中で [categoryId, month] の予算を読み、ない → budget-not-set。あれば delete する。カテゴリ自体の確認は行わない（予算がなければ budget-not-set になる）
    violation: validation、rule（budget-not-set）、storage
    source: FR4.2, AC4.3.1

  - id: BR4.3
    statement: その月に使う予算は、その月の設定があればその値（set）、なければその月より前で最も近い設定済みの月の値（carried）、どちらもなければ予算なし（none）
    category: calculation
    applies_to: [Book.getEffectiveBudgets, EffectiveBudget]
    trigger: getEffectiveBudgets の呼び出し時
    logic: >
      month の検証は BR2.4 と同じ。categories と budgets を1回の読み取り処理で読み、支出カテゴリそれぞれについて、
      month 以下の設定のうち最も新しい月を探す。それが month なら { amount, source: set }、month より前なら { amount, source: { kind: carried, from: その月 } }、
      なければ { amount: null, source: none }。後の月の設定は前の月に使わない。0 円の設定も設定として扱う。結果はカテゴリの並び（BR3.1）の順。
      計算は保存に触れない純粋な関数（resolveEffectiveBudgets(categories, budgets, month)）にする
    violation: validation、storage
    source: FR4.3, AC4.2.1, AC4.2.2, AC4.2.3, AC4.3.1, AC4.3.2

  - id: BR4.4
    statement: ある月の予算を変えても、それより前の月の予算は変わらず、その月の値を引き継いでいた後の月は新しい値を引き継ぐ
    category: invariant
    applies_to: [Budget, EffectiveBudget]
    trigger: setBudget・clearBudget の後
    logic: 予算は設定した月の1件だけを保存し、引き継ぎは保存せずに BR4.3 で毎回計算するため、この性質は保存の形から必ず成り立つ
    violation: なし
    source: FR4.4, AC4.1.3, AC4.2.4

  - id: BR5.1
    statement: CSV の取り込みの確定は、全行を検証し、すべてのカテゴリが存在して種別が一致するときだけ全件を1回の書き込み処理で追加する
    category: policy
    applies_to: [Book.importTransactions, ImportRow, Transaction]
    trigger: importTransactions の呼び出し時
    logic: >
      各行の input を validateTransactionInput で検証し、失敗した行があれば何も追加せず validation（最初に失敗した行のエラー）を返す。
      transactions・categories の書き込み処理の中でカテゴリを全件読み、categoryId のカテゴリがない、または種別が違う行の line をすべて集め、
      1行でもあれば何も追加せず import-category-missing（lines は昇順）を返す。なければ各行に id = newId()、createdAt = updatedAt = now() を付けて
      行の順に put し、{ added: 件数 } を返す。0 行なら何もせず { added: 0 }。重複の判定は U6 の役割で、ここでは行わない
    violation: validation、rule（import-category-missing）、storage
    source: FR7.3, AC7.2.1, AC7.2.3, AC7.2.4

  - id: BR6.1
    statement: 保存の失敗は OperationError に置き換え、失敗の種類を区別する
    category: policy
    applies_to: [Book, OperationError]
    trigger: すべての読み取り・書き込み
    logic: >
      U3 の read-failed・write-failed → { kind: storage, message }。newer-version → { kind: newer-version }（Q1 = A）。
      work が規則違反・検証エラーで { ok: false } を返した場合の aborted → その reason（rule・validation）をそのまま返す
    violation: OperationError
    source: FR8.3, AC8.3.1, AC8.3.2, Q1

  - id: BR6.2
    statement: Book の操作は例外を投げず、失敗した書き込みでは何も変わらない
    category: invariant
    applies_to: [Book]
    trigger: すべての操作
    logic: 想定外の例外は捕まえて { kind: storage, message } にする。書き込みはすべて U3 の write の1回の処理で行うため、失敗すれば保存領域は元のまま
    violation: なし
    source: FR8.3, NFR4, 契約の共通の決まり

  - id: BR6.3
    statement: 部品をまたぐ規則（カテゴリの存在・種別・使用件数・最後の1件）は、画面の表示時点の値ではなく、書き込み処理の中で読み直して確かめる
    category: invariant
    applies_to: [BookkeepingService]
    trigger: すべての書き込み
    logic: 呼び出し元から渡された件数や一覧を信用せず、書き込み処理の中で保存領域から読んで判定する。別のタブでの変更があっても規則が破られない
    violation: 各 RuleViolation
    source: AC3.4.4, ADR-002

  - id: BR6.4
    statement: 書き込み処理の中（work）では、U3 の TxContext の操作だけを待つ。日時と id は同期の関数で作る
    category: policy
    applies_to: [BookkeepingService]
    trigger: すべての書き込み
    logic: now() と newId() は同期で呼び、work の中で時間の待ちや他の非同期処理を待たない（U3 では、別の周回に進む待ちの後は write-failed になる）
    violation: write-failed（storage）
    source: C2（U3 の write の説明）
```

## 規則の要約

| 範囲 | 規則 |
|------|------|
| 開く | BR1.1〜BR1.3 |
| 収支 | BR2.1〜BR2.6 |
| カテゴリ | BR3.1〜BR3.4 |
| 予算 | BR4.1〜BR4.4 |
| 取り込み | BR5.1 |
| 失敗と書き込み処理 | BR6.1〜BR6.4 |

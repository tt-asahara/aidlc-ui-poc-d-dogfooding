# NFR Requirements（bookkeeping-core）— 質問

この Unit の非機能要件で、新たに利用者の判断が必要な点はありません。

- 依存は U1・U3 だけで、新しいパッケージは追加しない。id はブラウザ組み込みの `crypto.randomUUID()` で作る（ローカルの開発サーバー localhost は安全な環境として扱われ、使える）。
- テストの方法は U3 で決めた方式（Q1 = A：fake-indexeddb）を引き継ぐ。ほとんどのテストは U3 のテスト用の差し替え（createMemoryStorage）で行い、別のタブでの版上げ（newer-version）と別のタブでの同時操作だけは、本物の保存（fake-indexeddb）で確かめる。
- 性能の目標は要件 NFR3（集計の切り替え 500ms 以内、架空の収支 5,000 件）から、この Unit の取り分を目安として定める。
- テストの順序は team.md の Ordering のとおり（U4 は「その他のレイヤー」なので実装の後にテスト）。

質問は0件のため、回答欄はありません。

# NFR Requirements（storage）— 質問

保存（U3）の本物の実装は IndexedDB を使います。テストを Node.js 上で行うには IndexedDB の代わりが必要なため、その選び方を1問にしました。

## Q1. 本物の保存の実装をテストする方法

AC1.2.2（書き込みの途中失敗で何も書かれない）や版の扱い（AC1.2.3）は、IndexedDB の振る舞いそのものを確かめる必要があります。

A. テストでは、IndexedDB の仕様どおりに動く代替の実装（fake-indexeddb、無償の公開パッケージ）を使い、本物の実装（openStorage）とテスト用の差し替え（createMemoryStorage）の両方に同じ契約テストを流す（おすすめ：ブラウザなしで速く、IndexedDB の取り消し・自動確定・版の更新も再現できるため）
B. 本物の実装は実ブラウザ（Playwright、Chromium の取得 約150MB）でだけテストし、Node.js 上ではテスト用の差し替えだけをテストする
X. Other (please specify)

[Answer]: A

# Walking Course Mapper (お散歩コース描画アプリ)

Google Maps上で自由にお散歩やランニングのコースを描画し、距離や所要時間の計算、さらにAIによる健康アドバイスを受けられるWebアプリケーションです。

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 📖 概要
毎日のウォーキングやランニングのルートを計画・管理するためのツールです。地図上をクリックしてルートを作成するだけで、総距離と徒歩での所要時間をリアルタイムに算出します。
また、作成したコースの距離に基づいてGoogle Gemini (AI) が消費カロリーの目安を計算し、モチベーションを高める一言アドバイスを提供します。作成したコースはブラウザに保存され、いつでも呼び出すことができます。

## ✨ 主な機能

* **コース描画機能**: 地図上をクリックして直感的にルートを作成（Google Maps Drawing API）。
* **AIコーチング**: コース作成完了時に、Google Geminiが距離に応じた消費カロリー目安と、ランニング・ウォーキング向けのアドバイスを自動生成して表示。
* **自動計算**:
    * **距離**: ルートの総距離（km）を自動算出。
    * **時間**: 平均的な徒歩速度（時速5km）に基づいた所要時間を表示。
* **場所検索**:
    * キーワード入力による場所検索。
    * **音声検索機能**（Web Speech API）によるハンズフリーな地点検索。
* **コース管理**:
    * 作成したコースに名前と説明をつけて保存（LocalStorage使用）。
    * 保存済みコースのリスト表示・再描画・削除。
    * 保存済みコースのキーワード検索および音声検索。
* **レスポンシブデザイン**: PCおよびタブレット・スマートフォンでの表示に対応。

## 🛠 使用技術

* HTML5 / CSS3 (CSS Variables)
* JavaScript (Vanilla JS)
* **Google Maps JavaScript API**
    * Maps API
    * Drawing Library
    * Geometry Library
    * Places Library
* **Google Gemini API** (Generative AI)
* **Web Speech API** (音声認識)
* LocalStorage (データ永続化)

## 🚀 インストールと実行方法

このアプリは静的なWebアプリケーションです。動作させるにはGoogle Maps PlatformおよびGenerative AIのAPIキーが必要です。

1.  **リポジトリをクローン**
    ```bash
    git clone [https://github.com/あなたのユーザー名/walking-course-mapper.git](https://github.com/あなたのユーザー名/walking-course-mapper.git)
    cd walking-course-mapper
    ```

2.  **APIキーの設定**
    `index.html` を開き、以下の `YOUR_API_KEY` の部分をご自身のAPIキーに書き換えてください。
    ※このキーはGoogle MapsとGeminiの両方で使用されます。

    ```javascript
    // ▼ここにAPIキーを入力してください！MapsとGemini両方で使います。▼
    const GOOGLE_API_KEY = "YOUR_API_KEY";
    ```
    
    **必要なAPI権限:**
    Google Cloud Consoleにて、使用するAPIキーに対し以下のAPIを有効化してください。
    * Maps JavaScript API
    * Places API
    * Generative Language API (Geminiを使用するため)

3.  **アプリの実行**
    ローカルサーバー（Live Server等）で `index.html` を開くか、ブラウザで直接ファイルを開いてください。

## ⚠️ 注意事項

* **APIの課金・制限について**:
    * Google Maps APIおよびGemini APIを使用するため、Google Cloud Platformでのプロジェクト設定が必要です。
    * 個人の開発範囲であれば無料枠で収まることが多いですが、各サービスの料金体系をご確認ください。
* **音声認識**: Web Speech APIを使用しているため、Google Chromeなどの対応ブラウザでご利用ください。

---
Created by Gakuto Inoue


# DAICHU Game Packing Support

DAICHU ゲーム・リサイクル部門の梱包作業を支援する iPad 向け PWA。

CROSS MALL から出力した注文詳細CSVを読み込み、**ピッキング**（棚から商品を集める）と
**梱包**（1件ずつ箱詰め）の2フェーズに分けて作業をガイドする。

- 本番URL: https://acidkengo-hub.github.io/daichu_game_packing_support/
- リポジトリ: https://github.com/acidkengo-hub/daichu_game_packing_support
- 現場向け操作マニュアル: `DAICHU_梱包サポートツール_マニュアル_v1.0.pdf`

---

## 1. クイックスタート

### 環境構築

```bash
git clone https://github.com/acidkengo-hub/daichu_game_packing_support.git
cd daichu_game_packing_support/frontend
npm ci
```

### 開発サーバー起動

```bash
npm run dev
# → http://localhost:5173/daichu_game_packing_support/
```

### ビルド確認（コミット前に必ず実行）

```bash
npm run build
```

`tsc -b && vite build` が走る。**型エラーがあればここで落ちる。**
App.tsx は 1300 行超あり JSX 構造を壊しやすいので、編集後は必ず実行する。

### デプロイ

`main` ブランチに push すると GitHub Actions が自動でビルド＆デプロイする
（`.github/workflows/deploy.yml`）。手動操作は不要。

### デバッグ

ブラウザの DevTools コンソールに以下のログが出る。

| ログ | 意味 |
|---|---|
| `[parsers] パース完了: 宅急便 N件..., ネコポス N件...` | CSV解析の結果 |
| `[shipmentStore] 差分検出: 新規N件` | 午後便の差分抽出結果 |
| `[shipmentStore] 日付が変わったためデータをリセット` | 前日データの自動破棄 |
| `[setDefinitions] localStorage読み込みエラー` | 保存データの破損 |

localStorage を初期化したいときは DevTools → Application → Local Storage から
`game-packing-*` のキーを削除する。

---

## 2. ディレクトリ構成

```
daichu_game_packing_support/
├── .github/workflows/deploy.yml   GitHub Pages への自動デプロイ
└── frontend/
    ├── index.html                 PWA メタタグ（ホーム画面追加対応）
    ├── vite.config.ts             base パス設定（リポジトリ名と一致必須）
    ├── public/
    │   ├── manifest.json          PWA マニフェスト
    │   └── icon-*.png             ホーム画面アイコン
    └── src/
        ├── main.tsx               エントリポイント
        ├── index.css              Tailwind CSS v4 の読み込み
        ├── App.tsx                全画面のUI・状態管理（最大のファイル）
        ├── parsers.ts             CSV解析・セット分解・ピッキング集計
        ├── platformDetector.ts    プラットフォーム判定・型番サブタイプ判定
        ├── setDefinitions.ts      セット商品定義（139件）とCRUD
        ├── shipmentStore.ts       午前便/午後便セッション・差分検出・永続化
        ├── shopColors.ts          モール別カラー・チラシ対象判定
        ├── imageMapping.ts        商品画像（Google Drive）のマッピング
        └── SettingsScreen.tsx     セット定義の編集画面
```

---

## 3. アーキテクチャ

### 設計の基本原則

**外部依存の構造を1ファイルに閉じ込める。**
CROSS MALL の列構成は `parsers.ts` の `COL` 定数だけに、
商品画像のIDは `imageMapping.ts` だけに集約している。
外部の仕様が変わってもそのファイルだけ直せばよい。

**業務ルールはデータとして持つ。**
セット商品の同梱物はコードに埋め込まず `setDefinitions.ts` のデータとして定義し、
設定画面から現場が編集できる。新商品が出てもコード変更なしで対応できる。

**ピッキングの集約キーは「正規化された部品名」。**
同じ物理的な部品には同じ名前を付けることで、プラットフォームを横断して数量を合算する。
たとえば「メガネケーブル」は PS1・PS2・PS3中期/後期・PS4 のセットで共通なので、
これらの注文が混在しても `メガネケーブル ×7` と1行にまとまる。

**進捗は「完了記録」で持つ。**
「今何番目を見ているか」ではなく「どの管理番号を完了したか」を配列で保存する。
これにより前後の注文を自由に行き来しても完了件数が変わらず、中断位置も特定できる。

---

## 4. 外部依存の構造 ★最重要

外部サービスの仕様が変わったときに真っ先に見る場所。

### 4-1. CROSS MALL 注文詳細CSV

**文字コード: Shift_JIS。** `TextDecoder("shift_jis")` でデコードしてから PapaParse に渡す。

出力設定（現場が CROSS MALL 上で選ぶ値）:

| 項目 | 値 |
|---|---|
| 種別 | 注文詳細 |
| 定義 | 梱包サポートツール用CSV |
| 注文日時 | 実行日の約1か月前から |
| 処理フェーズ | 本日発送分 |

使用している列（`parsers.ts` の `COL` 定数、0始まり）:

| # | 列名 | 用途 |
|---|---|---|
| 0 | 管理番号 | 注文の一意キー。**午後便の差分検出にも使う** |
| 1 | 店舗名 | モール判定（枠色・チラシ対象） |
| 2 | 注文者氏名 | 表示 |
| 3 | 届け先氏名 | 宛名表示 |
| 4 | 届け先郵便番号 | 宛先表示 |
| 5-7 | 都道府県・住所1・住所2 | 結合して宛先表示 |
| 8 | 届け先TEL | 保持（現在は非表示） |
| 10 | 配送便名 | **キャリア判定の権威列** |
| 11 | 配送希望日 | 梱包画面に強調表示 |
| 14 | 商品コード | セット定義との照合キー |
| 15 | 商品名 | 表示・型番ハイライト対象 |
| 18 | 属性１名 | カラー。**電池本数・Switch2構成の判定にも使う** |
| 21 | 属性２名 | 補助表示 |
| 36 | 数量 | 集計 |
| 40 | SKUコード | 保持 |
| 41 | 品目 | 短縮表示名・プラットフォーム判定 |

**列39「棚番」は使用しない。** A/C/S などが入るが実務上は機能していないため、
プラットフォーム判定でグルーピングしている。

**キャリア判定**（`detectCarrier`）:
配送便名に `ネコポス` を含めば `nekopos`、それ以外は `takkyubin`。

**品目の文字数制限**: 列41は20文字前後で切られる。
20文字未満で商品名の方が長ければ、商品名（列15）を表示名として採用する。

**スペースの揺れ**: 全角スペースと半角スペースが混在する。
`normalizeSpaces()` で正規化しないと同一商品が別アイテムに分裂する。

### 4-2. 商品画像（Google Drive）

Drive フォルダ `set_product_id_photo`（ID: `1uUVFWi-BF3V6OU0ZlOMSIXlC5nxO5Ret`）に
**セット定義IDをファイル名にした画像**を置き、そのファイルIDを `imageMapping.ts` に登録する。

表示URL形式:
```
https://lh3.googleusercontent.com/d/{fileId}
```

`getSetImageUrl(setId)` が「完全一致 → 正規化一致（記号・大小文字を無視）→ 部分一致」の
3段階で検索する。命名が大きく異なるものは `IMAGE_MAP` にエイリアスを追加している。

**画像を追加する手順**: Drive に `{セット定義ID}.jpg` で置く → ファイルIDを取得 →
`imageMapping.ts` の `IMAGE_MAP` に1行追加。

現在のカバー率: 139セット中 136件（残り3件は販売終了商品）。

### 4-3. 各モールの商品コード体系

**同じセット商品でもモールごとに商品コードが異なる。**
このため `SetDefinition` は `codes: string[]` で複数コードを保持する。

```
PS2薄型すぐ遊べるセット
  = "ps270-7701"（.md原典）
  = "PS27000-0-77000-00001"（楽天）
  = "ps27000-0-77000-00003"（別バリアント）
```

新しいモールやコード体系が増えた場合は、設定画面から該当セットにコードを追加するだけでよい。

---

## 5. モジュール責務表

| ファイル | 責務 | 他モジュールへの依存 |
|---|---|---|
| `platformDetector.ts` | 品目・商品コードからプラットフォームを判定。PS3/PS4の型番サブタイプ判定。ポケモン電池交換対象の判定 | なし |
| `setDefinitions.ts` | セット商品の同梱物定義とCRUD。localStorage永続化 | なし |
| `shopColors.ts` | 店舗名からモールを判定し、枠色・バッジ色・チラシ要否を返す | なし |
| `imageMapping.ts` | セット定義ID → Google Drive 画像URL | なし |
| `parsers.ts` | CSV解析。セット分解とピッキング集計。属性に応じた同梱物の動的調整 | platformDetector, setDefinitions |
| `shipmentStore.ts` | 午前便/午後便のセッション管理。管理番号による差分検出。進捗集計と永続化 | parsers |
| `SettingsScreen.tsx` | セット定義の編集UI。チラシアラートのON/OFF | setDefinitions, shopColors |
| `App.tsx` | 全画面の描画と状態管理 | すべて |

---

## 6. データフロー

```
CSVファイル
   ↓ TextDecoder("shift_jis") → PapaParse
行データ
   ↓ buildProduct()  … 列を Product に変換
   │   ├ detectPlatform()      プラットフォーム判定
   │   ├ findSetDefinition()   セット定義の照合
   │   └ 属性に応じた同梱物の動的調整（電池本数・おまけソフト・Switch2構成）
Product[]（管理番号でグルーピング）
   ↓ Order[] を構築 → キャリア別に振り分け
   ↓ buildPickingItems()  … セットを部品に分解し、正規化名で集約
ParsedData { takkyubin: CarrierData, nekopos: CarrierData }
   ↓ createSession() / extractNewOrders()
ShipmentSession（午前便 or 午後便）
   ↓ WorkDay に格納
localStorage（キー: game-packing-workday）
```

### ピッキング集計の具体例

PS3中期型セット×2、PS4(1000番台)セット×2、PS2厚型セット×1 の注文があった場合:

```
メガネケーブル          ×5   ← 3種類のセットから合算
HDMIケーブル            ×4   ← PS3・PS4から合算
DUALSHOCK3              ×2
DUALSHOCK4              ×2
USBケーブル(miniB/太)   ×2   ← PS3用
USBケーブル(microB/細)  ×2   ← PS4用
PS3本体(中期型)         ×2
PS4本体(1000番台)       ×2
PS2本体(厚型)           ×1
DUALSHOCK2              ×1
AVケーブル(PS系)        ×1
ACアダプタ(PS2薄型)     ×0   ← 厚型なので出ない
```

本体・コントローラー類は**カラーが集約キーに含まれる**（`isColorRelevant()`）。
`3DS本体(ブラック) ×1` `3DS本体(ホワイト) ×1` のように色ごとに分かれる。
ケーブル類は色に依存しないので集約したままにする。

---

## 7. 安全機構

現場での誤操作・見落としを防ぐ仕組み。

| 機構 | 内容 | 実装場所 |
|---|---|---|
| 全項目チェック必須 | 全部チェックするまで「梱包完了」が押せない | App.tsx `allItemsChecked` |
| 移動と完了の分離 | 前後移動は画面上部の矢印のみ。下部は完了ボタン専用 | App.tsx 梱包画面 |
| 残数の明示 | 「あと3項目チェックしてください（2/5）」 | App.tsx `uncheckedCount` |
| 商品インデックス付きキー | 同一商品コードの色違いでチェックが連動しない | App.tsx `p${pIdx}_${code}_` |
| 型番ハイライト | SCPH/CECH/CUH/CFI を黄色バッジで強調 | App.tsx `renderWithModelHighlight()` |
| カラーの強調表示 | 属性1をオレンジの大きめ文字で表示 | App.tsx 梱包画面 |
| モール別の枠色 | 楽天=赤、Yahoo=紫、Amazon=橙、メルカリ=シアン | shopColors.ts |
| チラシ確認アラート | 楽天・Yahoo の注文のみ。設定でON/OFF可 | shopColors.ts + App.tsx |
| タッチペン確認 | DS/3DS系のセットで必ず表示 | platformDetector `needsTouchPenAlert()` |
| ポケモン電池交換 | 対象13商品を別グループにまとめ、梱包時にも確認 | platformDetector `POKEMON_BATTERY_CODES` |
| PS4型番A/B | 1000/2000番台で「型番Aを優先」と表示 | setDefinitions `packingAlerts` |
| 完了記録 | 前後移動しても完了件数が減らない | shipmentStore `packingDone` |
| 日付リセット | 日付が変わると前日データを自動破棄 | shipmentStore `loadWorkDay()` |
| 午前便の保護 | 午後便CSVを入れても午前便は上書きされない | shipmentStore `extractNewOrders()` |

---

## 8. 仕様変更時の対応手順

| 症状・要望 | 修正すべきファイル |
|---|---|
| セット商品の同梱物が違う／増えた | 設定画面から編集。恒久対応なら `setDefinitions.ts` |
| 新商品がセットとして認識されない | `setDefinitions.ts` の該当セットに `codes` を追加 |
| 新しいハードに対応したい | `platformDetector.ts` の `PLATFORMS` と `detectPlatform()` |
| プラットフォームの判定を誤る | `platformDetector.ts` の `detectPlatform()`（**判定順序に注意**） |
| CROSS MALL の列構成が変わった | `parsers.ts` の `COL` 定数 |
| キャリアが増えた（佐川など） | `parsers.ts` の `detectCarrier()` と `ParsedData` 型 |
| 新しいモールが増えた | `shopColors.ts` の `SHOP_STYLES` と `detectShop()` |
| 商品画像を追加・変更したい | Drive にアップ → `imageMapping.ts` に1行追加 |
| 属性で同梱物を変えたい | `parsers.ts` の `buildProduct()` 内の動的調整ブロック |
| 梱包時のアラートを追加したい | `setDefinitions.ts` の `packingAlerts`、または `parsers.ts` |
| 型番のハイライトを増やしたい | `App.tsx` の `renderWithModelHighlight()` の正規表現 |

---

## 9. 開発規約

### コーディング

- **Tailwind のクラス名は完全な文字列で書く。**
  `border-${color}-500` のような動的生成はビルド時の静的解析で拾えず、スタイルが効かない。
- **判定関数は順序が重要。** 長いプレフィックスから先に評価する。
  `Switch2` は `Switch` より先、`PS5`→`PS4`→`PS3`→`PS2`→`PS1` の順。
- **try-catch には次に見る場所を書く。** 単に「エラーが発生しました」では原因を追えない。
- **localStorage の読み込みには後方互換の補完を入れる。**
  `ShipmentSession` にフィールドを足したら `loadWorkDay()` にも `?? {}` を追加する。

### 進め方

- **編集後は必ず `npm run build` を通す。** App.tsx は長く、JSX の閉じタグを壊しやすい。
- **部分的な差分編集より、関数やブロック単位の置き換えを優先する。**
  過去に閉じタグの欠落・import の重複が複数回発生している。
- フェーズの区切りごとに `git add -A && git commit` する。
- コミットメッセージは日本語可。`feat:` `fix:` `refactor:` `docs:` を先頭に付ける。

---

## 10. トラブルシューティング

実際に遭遇した問題と対処。

| 症状 | 原因 | 対処 |
|---|---|---|
| 同じ商品が2行に分裂する | 全角スペースと半角スペースの混在 | `normalizeSpaces()` で正規化（対応済み） |
| 色違いの同一商品でチェックが連動する | チェックキーが商品コードのみで重複 | キーに商品インデックスを付与（対応済み） |
| 商品名が途中で切れて判別できない | 品目列が20文字で切られている | 短い場合は商品名にフォールバック（対応済み） |
| 「Switch2」が「Switch」と判定される | 判定順序の誤り | Switch2 を先に評価（対応済み） |
| セット商品として認識されない | モール固有の商品コードが未登録 | `codes` に追加 |
| 画像の📷ボタンが出ない | `imageMapping.ts` に未登録 | Drive にアップして登録 |
| import 文に赤線が出るがビルドは通る | VS Code の TS サーバーのキャッシュ | コマンドパレット →「TypeScript: Restart TS Server」 |
| GitHub Actions が `Get Pages site failed` で落ちる | Pages が未有効化 | Settings → Pages → Source を「GitHub Actions」に |
| デプロイ後に画面が真っ白 | `vite.config.ts` の `base` がリポジトリ名と不一致 | `base: "/daichu_game_packing_support/"` を確認 |
| 前日のデータが残っている | 日付リセットは起動時のみ判定 | ホーム画面の「新しい日を開始（全データ削除）」 |

---

## 11. 技術スタック

| 分類 | 採用 |
|---|---|
| フレームワーク | React 19 + TypeScript |
| ビルド | Vite |
| スタイル | Tailwind CSS v4 |
| CSV解析 | PapaParse |
| 永続化 | localStorage |
| ホスティング | GitHub Pages（Actions で自動デプロイ） |
| 対象デバイス | iPad Safari（ホーム画面に追加してスタンドアロン起動） |

サーバーサイドは持たない。全処理がブラウザ内で完結するため、
注文データが外部に送信されることはない。
// src/parsers.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CROSS MALL 注文詳細CSV 解析
// ゲーム・リサイクル部門用（宅急便/ネコポス）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Papa from "papaparse";
import { detectPlatform, comparePlatform, isPokemonBatteryProduct, POKEMON_BATTERY_GROUP, type Platform } from "./platformDetector";
import { findSetDefinition, type SetComponent } from "./setDefinitions";

// ============================================================
// 型定義
// ============================================================

export type Product = {
  code: string;          // 商品コード (col 14)
  skuCode: string;       // SKUコード (col 40)
  name: string;          // 商品名 (col 15)
  shortName: string;     // 品目 (col 41)
  attr1: string;         // 属性１名 (col 18)
  attr2: string;         // 属性２名 (col 21)
  qty: number;           // 数量 (col 36)
  platform: Platform;    // 自動判定プラットフォーム
  isSet: boolean;        // セット商品フラグ
  setComponents: SetComponent[];  // セット同梱物リスト
  packingAlerts: string[];        // 梱包時アラート
};

export type Order = {
  mgmtNo: string;         // 管理番号 (col 0)
  shopName: string;        // 店舗名 (col 1)
  ordererName: string;     // 注文者氏名 (col 2)
  recipientName: string;   // 届け先氏名 (col 3)
  recipientPostal: string; // 届け先郵便番号 (col 4)
  recipientAddr: string;   // 届け先住所（結合済み）
  recipientTel: string;    // 届け先TEL (col 8)
  deliveryDate: string;    // 配送希望日 (col 11)
  products: Product[];
  totalItems: number;
};

/** ピッキングアイテム（同梱物展開済み・プラットフォーム別集約） */
export type PickingItem = {
  name: string;           // 正規化部品名（集約キー）
  platform: Platform;     // プラットフォーム
  totalQty: number;       // 合計必要数
  sources: string[];      // 由来説明（例: "PS3中期型セット×2"）
  checked: boolean;       // ピッキング済みフラグ
};

export type CarrierData = {
  label: string;             // "ヤマト宅急便" or "ヤマトネコポス"
  orders: Order[];
  pickingItems: PickingItem[];
  totalPickingQty: number;
  totalOrders: number;
};

export type ParsedData = {
  takkyubin: CarrierData;
  nekopos: CarrierData;
};

// ============================================================
// CSV 列インデックス (0-based)
// ============================================================

const COL = {
  MGMT_NO:        0,   // 管理番号
  SHOP_NAME:      1,   // 店舗名
  ORDERER_NAME:   2,   // 注文者氏名
  RECIPIENT_NAME: 3,   // 届け先氏名
  POSTAL:         4,   // 届け先郵便番号
  PREF:           5,   // 届け先都道府県
  ADDR1:          6,   // 届け先住所１
  ADDR2:          7,   // 届け先住所２
  TEL:            8,   // 届け先TEL
  CARRIER:       10,   // 配送便名
  DELIVERY_DATE: 11,   // 配送希望日
  PRODUCT_CODE:  14,   // 商品コード
  PRODUCT_NAME:  15,   // 商品名
  ATTR1_NAME:    18,   // 属性１名
  ATTR2_NAME:    21,   // 属性２名
  QTY:           36,   // 数量
  SKU_CODE:      40,   // SKUコード
  SHORT_NAME:    41,   // 品目
} as const;

// ============================================================
// キャリア判定
// ============================================================

type CarrierType = "takkyubin" | "nekopos";

function detectCarrier(carrierStr: string): CarrierType {
  const s = carrierStr.trim();
  if (s.includes("ネコポス")) return "nekopos";
  // "ヤマト（発払い）" やその他 → 宅急便扱い
  return "takkyubin";
}

// ============================================================
// セーフなフィールド取得
// ============================================================

function getField(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  return (row[index] ?? "").trim();
}

function getNumField(row: string[], index: number): number {
  const val = parseInt(getField(row, index), 10);
  return isNaN(val) ? 1 : val;
}

/**
 * 全角スペース・連続スペース・前後空白を正規化。
 * 「PS2 本体　【すぐ遊べるセッ」と「PS2 本体 【すぐ遊べるセッ」の分裂を防ぐ。
 */
function normalizeSpaces(s: string): string {
  return s.replace(/[\s\u3000]+/g, " ").trim();
}

/**
 * 本体やコントローラーなど、カラーが重要な部品かどうかを判定。
 * trueの場合、ピッキング集約時にカラーを名前に付加する。
 */
function isColorRelevant(componentName: string): boolean {
  return (
    componentName.includes("本体") ||
    componentName.includes("コントローラ") ||
    componentName.includes("DUALSHOCK") ||
    componentName.includes("Joy-Con") ||
    componentName.includes("リモコン")
  );
}

// ============================================================
// Product 構築（セット定義照合含む）
// ============================================================

function buildProduct(row: string[]): Product {
  const code = getField(row, COL.PRODUCT_CODE);
  const rawShortName = getField(row, COL.SHORT_NAME);
  const rawName = getField(row, COL.PRODUCT_NAME);
  // スペース正規化（全角/半角スペースの差による分裂を防止）
  const shortName = normalizeSpaces(rawShortName);
  const name = normalizeSpaces(rawName);
  const attr1 = getField(row, COL.ATTR1_NAME);
  let platform: Platform | string = detectPlatform(shortName, code);

  // ポケモン電池交換対象 → 特別グループに分類
  const isPokemon = isPokemonBatteryProduct(code);
  if (isPokemon) {
    platform = POKEMON_BATTERY_GROUP as unknown as Platform;
  }

  // 品目がCROSS MALLの文字数制限で切られている場合は商品名（フル）を使う
  const displayName =
    shortName && shortName.length >= 20
      ? shortName
      : name.length > shortName.length
        ? name
        : shortName || name;

  const setDef = findSetDefinition(code);
  const isSet = !!setDef && setDef.components.length > 0;

  // 電池セットの動的計算: wiinomalbattset0001 は attr1 から電池本数を判定
  let components = setDef?.components ? [...setDef.components] : [];
  if (setDef && code.toLowerCase().startsWith("wiinomalbattset")) {
    const batteryQty = attr1.includes("4本") ? 4 : 2;
    // 既存の電池componentがなければ追加
    if (!components.some((c) => c.name === "単三電池")) {
      components = [...components, { name: "単三電池", qty: batteryQty }];
    }
  }

  // ポケモン用梱包アラート
  const alerts = setDef?.packingAlerts ? [...setDef.packingAlerts] : [];
  if (isPokemon) {
    alerts.push("ポケモンソフトは電池交換を行いましたか？");
  }

  return {
    code,
    skuCode: getField(row, COL.SKU_CODE),
    name,
    shortName: displayName,
    attr1,
    attr2: getField(row, COL.ATTR2_NAME),
    qty: getNumField(row, COL.QTY),
    platform: platform as Platform,
    isSet,
    setComponents: components,
    packingAlerts: alerts,
  };
}

// ============================================================
// ピッキングリスト構築（セット展開 + プラットフォーム横断集約）
// ============================================================

function buildPickingItems(orders: Order[]): PickingItem[] {
  // 集約マップ: name → { platform, totalQty, sources }
  const aggregated = new Map<
    string,
    { platform: Platform; totalQty: number; sources: string[] }
  >();

  for (const order of orders) {
    for (const product of order.products) {
      if (product.isSet && product.setComponents.length > 0) {
        // --- セット商品: 同梱物に分解して集約 ---
        for (const comp of product.setComponents) {
          // カラーが重要な部品（本体・コントローラー等）はカラーを集約キーに含める
          let key = comp.name;
          if (isColorRelevant(comp.name) && product.attr1) {
            key = `${comp.name}(${product.attr1})`;
          }

          const addQty = comp.qty * product.qty;
          const sourceDesc = `${product.shortName}×${product.qty}`;

          const existing = aggregated.get(key);
          if (existing) {
            existing.totalQty += addQty;
            if (!existing.sources.includes(sourceDesc)) {
              existing.sources.push(sourceDesc);
            }
          } else {
            aggregated.set(key, {
              platform: product.platform,
              totalQty: addQty,
              sources: [sourceDesc],
            });
          }
        }
      } else {
        // --- 単品商品: そのまま集約 ---
        // 単品もスペースを正規化してから集約キーにする
        const baseName = normalizeSpaces(product.shortName || product.name);
        // 単品のカラー付き集約（同じ商品名でもカラー違いは分ける）
        const key = product.attr1 ? `${baseName}(${product.attr1})` : baseName;
        const addQty = product.qty;

        const existing = aggregated.get(key);
        if (existing) {
          existing.totalQty += addQty;
        } else {
          aggregated.set(key, {
            platform: product.platform,
            totalQty: addQty,
            sources: [],
          });
        }
      }
    }
  }

  // Map → PickingItem[]（プラットフォーム順ソート）
  const items: PickingItem[] = Array.from(aggregated.entries()).map(
    ([name, data]) => ({
      name,
      platform: data.platform,
      totalQty: data.totalQty,
      sources: data.sources,
      checked: false,
    })
  );

  items.sort((a, b) => {
    const platformCmp = comparePlatform(a.platform, b.platform);
    if (platformCmp !== 0) return platformCmp;
    return a.name.localeCompare(b.name, "ja");
  });

  return items;
}

// ============================================================
// メインパース関数
// ============================================================

export function parseCSV(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("[parsers] ファイル読み込みに失敗しました。"));
    };

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          throw new Error("[parsers] ファイル内容が空です。");
        }

        // Shift_JIS → UTF-8 変換
        const decoder = new TextDecoder("shift_jis");
        const csvText = decoder.decode(arrayBuffer);

        // PapaParse で解析
        const parsed = Papa.parse<string[]>(csvText, {
          header: false,
          skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
          console.warn("[parsers] CSVパース警告:", parsed.errors);
        }

        const rows = parsed.data;
        if (rows.length < 2) {
          throw new Error("[parsers] CSVにデータ行がありません（ヘッダのみ）。");
        }

        // ヘッダ行をスキップ（最初の行）
        const dataRows = rows.slice(1);

        // --- 管理番号ごとにグルーピング + キャリア振り分け ---
        const takkyubinOrders = new Map<string, { order: Partial<Order>; products: Product[] }>();
        const nekoposOrders = new Map<string, { order: Partial<Order>; products: Product[] }>();

        for (const row of dataRows) {
          if (row.length < 42) {
            console.warn("[parsers] 列数不足の行をスキップ:", row.slice(0, 3));
            continue;
          }

          const mgmtNo = getField(row, COL.MGMT_NO);
          if (!mgmtNo) continue;

          const carrier = detectCarrier(getField(row, COL.CARRIER));
          const targetMap = carrier === "nekopos" ? nekoposOrders : takkyubinOrders;

          const product = buildProduct(row);

          if (!targetMap.has(mgmtNo)) {
            // 新規注文
            const addr = [
              getField(row, COL.PREF),
              getField(row, COL.ADDR1),
              getField(row, COL.ADDR2),
            ]
              .filter(Boolean)
              .join(" ");

            targetMap.set(mgmtNo, {
              order: {
                mgmtNo,
                shopName: getField(row, COL.SHOP_NAME),
                ordererName: getField(row, COL.ORDERER_NAME),
                recipientName: getField(row, COL.RECIPIENT_NAME),
                recipientPostal: getField(row, COL.POSTAL),
                recipientAddr: addr,
                recipientTel: getField(row, COL.TEL),
                deliveryDate: getField(row, COL.DELIVERY_DATE),
              },
              products: [product],
            });
          } else {
            // 既存注文に商品追加
            targetMap.get(mgmtNo)!.products.push(product);
          }
        }

        // --- Order オブジェクト生成 ---
        const buildOrders = (
          map: Map<string, { order: Partial<Order>; products: Product[] }>
        ): Order[] => {
          return Array.from(map.values()).map(({ order, products }) => ({
            mgmtNo: order.mgmtNo!,
            shopName: order.shopName ?? "",
            ordererName: order.ordererName ?? "",
            recipientName: order.recipientName ?? "",
            recipientPostal: order.recipientPostal ?? "",
            recipientAddr: order.recipientAddr ?? "",
            recipientTel: order.recipientTel ?? "",
            deliveryDate: order.deliveryDate ?? "",
            products,
            totalItems: products.reduce((sum, p) => sum + p.qty, 0),
          }));
        };

        const takkyubinOrderList = buildOrders(takkyubinOrders);
        const nekoposOrderList = buildOrders(nekoposOrders);

        // --- ピッキングリスト構築（セット展開 + 集約） ---
        const takkyubinPicking = buildPickingItems(takkyubinOrderList);
        const nekoposPicking = buildPickingItems(nekoposOrderList);

        const result: ParsedData = {
          takkyubin: {
            label: "ヤマト宅急便",
            orders: takkyubinOrderList,
            pickingItems: takkyubinPicking,
            totalPickingQty: takkyubinPicking.reduce((s, i) => s + i.totalQty, 0),
            totalOrders: takkyubinOrderList.length,
          },
          nekopos: {
            label: "ヤマトネコポス",
            orders: nekoposOrderList,
            pickingItems: nekoposPicking,
            totalPickingQty: nekoposPicking.reduce((s, i) => s + i.totalQty, 0),
            totalOrders: nekoposOrderList.length,
          },
        };

        console.log(
          `[parsers] パース完了: 宅急便 ${result.takkyubin.totalOrders}件(ピッキング${result.takkyubin.pickingItems.length}種), ` +
          `ネコポス ${result.nekopos.totalOrders}件(ピッキング${result.nekopos.pickingItems.length}種)`
        );

        resolve(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[parsers] パースエラー:", msg);
        reject(new Error(msg));
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

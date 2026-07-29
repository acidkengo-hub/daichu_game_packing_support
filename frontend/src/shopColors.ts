// src/shopColors.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// モール別カラー定義 + チラシ同梱対象の判定
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ShopKey = "rakuten" | "yahoo" | "amazon" | "mercari" | "other";

export type ShopStyle = {
  key: ShopKey;
  /** 画面に表示する短縮名 */
  label: string;
  /** 画面全体を囲む太枠 */
  frame: string;
  /** 宛先カードの枠線 */
  cardBorder: string;
  /** 店舗名バッジ */
  badge: string;
  /** チラシ同梱対象か */
  needsFlyer: boolean;
};

/**
 * モール別スタイル定義。
 * Tailwindはソースを静的解析するため、クラス名は必ず完全な文字列で記述すること
 * （`border-${color}-500` のような動的生成は効かない）。
 */
export const SHOP_STYLES: Record<ShopKey, ShopStyle> = {
  rakuten: {
    key: "rakuten",
    label: "楽天市場",
    frame: "border-red-500",
    cardBorder: "border-red-500",
    badge: "bg-red-600 text-white",
    needsFlyer: true,
  },
  yahoo: {
    key: "yahoo",
    label: "Yahoo!ショッピング",
    frame: "border-purple-500",
    cardBorder: "border-purple-500",
    badge: "bg-purple-600 text-white",
    needsFlyer: true,
  },
  amazon: {
    key: "amazon",
    label: "Amazon",
    frame: "border-amber-500",
    cardBorder: "border-amber-500",
    badge: "bg-amber-600 text-white",
    needsFlyer: false,
  },
  mercari: {
    key: "mercari",
    label: "メルカリshops",
    frame: "border-cyan-500",
    cardBorder: "border-cyan-500",
    badge: "bg-cyan-600 text-white",
    needsFlyer: false,
  },
  other: {
    key: "other",
    label: "その他",
    frame: "border-gray-700",
    cardBorder: "border-gray-800",
    badge: "bg-gray-700 text-gray-200",
    needsFlyer: false,
  },
};

/**
 * CSVの店舗名（列2）からモールを判定。
 * 表記ゆれ（"楽天市場店" / "Yahoo!ショッピング店" / "メルカリshops店" 等）を吸収する。
 */
export function detectShop(shopName: string): ShopStyle {
  const s = (shopName || "").toLowerCase();

  if (s.includes("楽天") || s.includes("rakuten")) return SHOP_STYLES.rakuten;
  if (s.includes("yahoo") || s.includes("ヤフー") || s.includes("ヤフ")) return SHOP_STYLES.yahoo;
  if (s.includes("amazon") || s.includes("アマゾン")) return SHOP_STYLES.amazon;
  if (s.includes("メルカリ") || s.includes("mercari")) return SHOP_STYLES.mercari;

  return SHOP_STYLES.other;
}

// ============================================================
// チラシ確認アラートの ON/OFF 設定（localStorage永続化）
// ============================================================

const FLYER_ALERT_KEY = "game-packing-flyer-alert";

/** チラシ確認アラートを表示するか（デフォルト: 表示する） */
export function isFlyerAlertEnabled(): boolean {
  try {
    const stored = localStorage.getItem(FLYER_ALERT_KEY);
    if (stored === null) return true; // 未設定ならON
    return stored === "true";
  } catch (err) {
    console.error("[shopColors] localStorage読み込みエラー:", err);
    return true;
  }
}

/** チラシ確認アラートのON/OFFを保存 */
export function setFlyerAlertEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FLYER_ALERT_KEY, String(enabled));
  } catch (err) {
    console.error("[shopColors] localStorage保存エラー:", err);
  }
}

/** 梱包画面に表示するチラシ確認アラートの文言 */
export const FLYER_ALERT_TEXT = "📄 チラシを入れましたか？";
// src/platformDetector.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 品目（列42）・商品コード（列15）からプラットフォームを判定
// ピッキングリストのグルーピングに使用
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 定義済みプラットフォーム一覧（表示順） */
export const PLATFORMS = [
  "PS1",
  "PS2",
  "PS3",
  "PS4",
  "PS5",
  "PSP",
  "PSVita",
  "FC",
  "SFC",
  "N64",
  "GC",
  "GB/GBA",
  "DS",
  "3DS",
  "Wii",
  "WiiU",
  "Switch",
  "Switch2",
  "SS",
  "DC",
  "ポケモン（電池交換）",
  "その他",
] as const;

export type Platform = (typeof PLATFORMS)[number];

/** プラットフォーム表示順のインデックスマップ（ソート用） */
const PLATFORM_ORDER: Record<Platform, number> = Object.fromEntries(
  PLATFORMS.map((p, i) => [p, i])
) as Record<Platform, number>;

/**
 * 品目（shortName）と商品コード（code）からプラットフォームを判定。
 * 品目のプレフィックスを優先し、該当しなければ商品コードで判定。
 */
export function detectPlatform(shortName: string, code: string): Platform {
  const sn = shortName.trim();
  const snL = sn.toLowerCase(); // 品目も小文字で比較（CSVの品目が小文字のケースに対応）
  const cd = code.trim().toLowerCase();

  // --- Phase 1: 品目プレフィックスで判定（高精度） ---
  // 順序重要: PS5 → PS4 → PS3 → PS2 → PS1（長いプレフィックスから判定）
  if (snL.startsWith("ps5")) return "PS5";
  if (snL.startsWith("ps4-") || snL.startsWith("ps4 ") || snL.startsWith("ps4コン")) return "PS4";
  if (snL.startsWith("ps3-") || snL.startsWith("ps3 ")) return "PS3";
  if (snL.startsWith("ps2-") || snL.startsWith("ps2 ") || snL.startsWith("ps2薄") || snL.startsWith("ps2厚") || snL.startsWith("ps230") || snL.startsWith("ps250")) return "PS2";
  if (snL.startsWith("ps-") || snL.startsWith("ps1") || snL.startsWith("psメモカ") || snL.startsWith("psｼﾘｰｽﾞ")) return "PS1";
  if (snL.startsWith("psp")) return "PSP";
  if (snL.startsWith("psvita")) return "PSVita";
  if (snL.startsWith("ds-") || snL.startsWith("ds ") || snL.startsWith("dsソフト")) return "DS";
  if (sn.includes("3DS") || sn.includes("3ds") || sn.includes("3ｄｓ") || sn.includes("2DS") || sn.includes("2ds")) return "3DS";
  // Switch 2: 一般のSwitch判定より先に評価する（"Switch2"が"Switch"に食われるのを防ぐ）
  if (/switch\s*2/i.test(sn) || /スイッチ\s*[2２]/.test(sn)) return "Switch2";
  // Switch: 英語 + カタカナ「スイッチ」の両方に対応
  if (snL.includes("switch") || sn.includes("スイッチ")) return "Switch";
  if (snL.startsWith("wiiu") || sn.startsWith("WiiU")) return "WiiU";
  if (snL.startsWith("wii")) return "Wii";
  if (snL.startsWith("sfc") || sn.includes("スーファミ")) return "SFC";
  if (snL.startsWith("gba") || snL.startsWith("gb ") || snL.startsWith("gb-") || snL.startsWith("gbポケ")) return "GB/GBA";
  if (snL.startsWith("gc") || sn.includes("ゲームキューブ")) return "GC";
  if (snL.startsWith("n64") || sn.includes("ニンテンドー64")) return "N64";
  if (snL.startsWith("fc") || sn.includes("ファミコン")) return "FC";
  if (snL.startsWith("ss-") || snL.startsWith("ss ") || sn.includes("サターン")) return "SS";
  if (snL.startsWith("dc-") || snL.startsWith("dc ") || sn.includes("ドリキャス") || sn.includes("ドリームキャスト")) return "DC";
  // DS系ソフト（★ｿﾌﾄのみ★DS- 等）
  if (sn.includes("DS-") || sn.includes("ds-")) return "DS";

  // --- Phase 2: 商品コードで判定 ---
  // PS系（順序重要: ps5 → ps4 → ps3 → ps2 → psp → ps の順に判定）
  if (cd.startsWith("ps5")) return "PS5";
  if (cd.startsWith("ps4") || cd.startsWith("dualshock4") || cd.startsWith("2679-003") || cd.startsWith("2679-004")) return "PS4";
  if (cd.startsWith("ps3") || cd.startsWith("dualshock3") || cd.startsWith("duals3") || cd.startsWith("dualshock3-") || cd.startsWith("2679-002901")) return "PS3";
  if (cd.startsWith("ps2") || cd.startsWith("2679-002774") || cd.startsWith("amazon20240822") || cd.startsWith("mc1mc2set") || cd.startsWith("mcps")) return "PS2";
  if (cd.startsWith("psp") || cd.startsWith("pap-")) return "PSP";
  if (cd.startsWith("vita") || cd.includes("psvita")) return "PSVita";
  if (cd.startsWith("ps") || cd.startsWith("pssyoki")) return "PS1";

  // 任天堂系（順序重要: switch2 → switch, wiiu → wii, new3ds → 3ds → 2ds → ds）
  if (cd === "2025122601" || /^switch\s*2/i.test(cd)) return "Switch2";
  if (cd.startsWith("switch")) return "Switch";
  if (cd.startsWith("wiiu") || cd.startsWith("2023081305")) return "WiiU";
  if (cd.startsWith("wii") || cd.startsWith("hajime") || cd.startsWith("handle") || cd.startsWith("remo") || cd.startsWith("tatakon") || cd.startsWith("merukari") || cd === "1") return "Wii";
  if (cd.startsWith("new3ds") || cd.startsWith("3ds") || cd.startsWith("2ds") || cd.startsWith("monhun4")) return "3DS";
  if (cd.startsWith("dslite") || cd.startsWith("dssyoki") || cd.startsWith("dsi")) return "DS";
  if (cd.startsWith("64") || cd.startsWith("n64")) return "N64";
  if (cd.startsWith("sfc") || cd.startsWith("sfcmini")) return "SFC";
  if (cd.startsWith("gamecube")) return "GC";
  if (cd.startsWith("gb")) return "GB/GBA";
  if (cd.startsWith("amazon2024121002")) return "FC";

  // セガ系（ss- のように区切り文字があるケースのみ。"ss"単独は短すぎて誤判定リスク）
  if (cd.startsWith("sssig") || cd.startsWith("sega")) return "SS";
  if (cd.startsWith("dreamcast")) return "DC";

  // その他
  if (cd.startsWith("disc")) return "FC";

  return "その他";
}

/**
 * PS4型番のサブタイプを判定（1000番台/2000番台/Pro）
 * 梱包時のA/Bチェックルール適用に使用
 */
export type PS4SubType = "PS4_1000" | "PS4_2000" | "PS4_Pro" | "PS4_unknown";

export function detectPS4SubType(code: string, productName: string): PS4SubType {
  const cd = code.toLowerCase();
  const name = productName.toLowerCase();

  // 7000番台 = Pro
  if (cd.includes("pro") || name.includes("pro") || name.includes("7000") || name.includes("7200")) {
    return "PS4_Pro";
  }
  // 1000番台
  if (name.includes("1000") || name.includes("1200") || cd.includes("1000") || cd.includes("1200")) {
    // 2000を含まない場合のみ（"CUH-1000〜1200" と "CUH-2000" を区別）
    if (!name.includes("2000") && !name.includes("2200")) {
      return "PS4_1000";
    }
  }
  // 2000番台
  if (name.includes("2000") || name.includes("2200") || cd.includes("2000") || cd.includes("2200")) {
    return "PS4_2000";
  }
  // 品番ベースの推測
  if (cd.startsWith("ps4jyunsei10001200") || cd.startsWith("2679-004195")) return "PS4_1000";
  if (cd.startsWith("ps4jyunsei200020200") || cd.startsWith("ps4gokan200020200")) return "PS4_2000";
  if (cd.startsWith("ps4projyunsei")) return "PS4_Pro";

  return "PS4_unknown";
}

/**
 * PS3型番のサブタイプを判定（初期型/中期型/後期型）
 * 電源ケーブルの種類判定に使用
 */
export type PS3SubType = "PS3_early" | "PS3_mid" | "PS3_late" | "PS3_unknown";

export function detectPS3SubType(code: string, productName: string): PS3SubType {
  const cd = code.toLowerCase();
  const name = productName;

  // 初期型: CECHA, CECHB, CECHH, CECHL, 20GB, 60GB, 80GB
  if (
    name.includes("CECHA") || name.includes("CECHB") ||
    name.includes("CECHH") || name.includes("CECHL") ||
    name.includes("初期型") ||
    cd.includes("syoki") || cd.includes("60g") || cd.includes("cecha")
  ) {
    return "PS3_early";
  }
  // 後期型: CECH-4000
  if (
    name.includes("CECH-4000") || name.includes("4000シリーズ") ||
    name.includes("後期型") ||
    cd.includes("ps340") || cd.includes("ps3_4000")
  ) {
    return "PS3_late";
  }
  // 中期型: CECH-2000〜3000
  if (
    name.includes("CECH-2000") || name.includes("CECH-3000") ||
    name.includes("2000-3000") || name.includes("2000〜3000") ||
    cd.includes("ps320") || cd.includes("ps32000") || cd.includes("ps3ff")
  ) {
    return "PS3_mid";
  }

  return "PS3_unknown";
}

/**
 * プラットフォーム順でソートするための比較関数
 */
export function comparePlatform(a: Platform, b: Platform): number {
  return (PLATFORM_ORDER[a] ?? 99) - (PLATFORM_ORDER[b] ?? 99);
}

/**
 * DS/3DS系かどうか判定（タッチペンアラート表示用）
 */
export function needsTouchPenAlert(platform: Platform): boolean {
  return platform === "DS" || platform === "3DS";
}

/**
 * PS4でA/B型番チェックが必要か判定
 */
export function needsPS4ABCheck(subType: PS4SubType): boolean {
  return subType === "PS4_1000" || subType === "PS4_2000";
}

// ============================================================
// ポケモン電池交換判定
// ============================================================

/**
 * 電池交換が必要なポケモンソフトの商品コード一覧。
 * GB/GBA世代のポケモンは内蔵電池が切れるとセーブできない。
 * DAICHUでは出荷前に電池交換を行うルール。
 */
const POKEMON_BATTERY_CODES: string[] = [
  // GB ポケモン
  "amazom1971",      // GB ポケットモンスター クリスタル
  "amazom2111",      // GB ポケットモンスター（バリアント1）
  "amazom2112",      // GB ポケットモンスター（バリアント2）
  "amazon9108",      // GB ポケモン（バリアント）
  "amazon9109",      // GB ポケモン（バリアント）
  // GBA ポケモン
  "amazon2307051",   // GBA ポケモン
  "amazon2307052",   // GBA ポケモン
  "amazon2307053",   // GBA ポケモン
  "amazon2307054",   // GBA ポケモン
  "amazon2307057",   // GBA ポケモン
  "amazon202410211", // ポケモン（バリアント）
  // セット商品（電池交換済みで出荷）
  "gbapokesr2set",   // GBA ポケモン ルビー&サファイア 2本セット
  "gbpokemon4set",   // GB ポケモン 初代4本セット
];

/**
 * 商品コードがポケモン電池交換対象かどうか判定。
 */
export function isPokemonBatteryProduct(code: string): boolean {
  return POKEMON_BATTERY_CODES.includes(code.toLowerCase()) ||
         POKEMON_BATTERY_CODES.includes(code);
}

/**
 * ピッキング時の特別グループ名。
 * 通常のプラットフォーム分類とは別枠で表示される。
 */
export const POKEMON_BATTERY_GROUP = "ポケモン（電池交換）" as const;
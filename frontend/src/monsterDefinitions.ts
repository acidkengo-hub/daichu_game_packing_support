// src/monsterDefinitions.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RPG梱包モード用モンスター定義
//
// 設計方針:
//  1. 実在ハードの外観に寄せない。抽象的な図形8種の組み合わせで表現する
//  2. 色は Tailwind クラスではなく16進数で保持する
//     （Tailwind は動的なクラス名をビルド時に拾えないため。DEVLOG教訓5）
//  3. 22プラットフォームすべてを Record で網羅する
//     （定義漏れは npx tsc --noEmit で検出される）
//  4. このファイルは既存モジュールへ一切依存を追加しない
//     （platformDetector の型だけを読み取り、副作用を持たない）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { PLATFORMS, type Platform } from "./platformDetector";

// ============================================================
// シェイプ（見た目の骨格）
// ============================================================

/**
 * モンスターの骨格8種。
 * 22プラットフォームをこの8種にマッピングし、色と装飾で個性を出す。
 * 個別に22体描くのは非現実的なため、この方式を採用した。
 */
export const SHAPE_KEYS = [
  "box",        // 箱型: 据置機の据わった感じ
  "slab",       // 薄板型: 薄型の据置機
  "disc",       // 円盤型: ディスクメディア
  "tower",      // 縦箱型: 縦に立つ据置機
  "clamshell",  // 二つ折り型: 折りたたみ携帯機
  "handheld",   // 横長型: 横持ちの携帯機
  "cartridge",  // カートリッジ型: 差し込むメディア
  "blob",       // 塊型: 分類不能なもの
] as const;

export type ShapeKey = (typeof SHAPE_KEYS)[number];

/** シェイプごとの種族名（モンスター名の後半に使う） */
const SHAPE_FAMILY: Record<ShapeKey, string> = {
  box: "ハコマジン",
  slab: "イタバン",
  disc: "エンバンさま",
  tower: "トウマジン",
  clamshell: "パカリング",
  handheld: "ケイタイン",
  cartridge: "カートリン",
  blob: "カタマリ",
};

// ============================================================
// パレット
// ============================================================

/**
 * SVGの塗り分けに使う4色セット。
 * base=本体, dark=影, light=ハイライト, accent=目や装飾。
 */
export type Palette = {
  base: string;
  dark: string;
  light: string;
  accent: string;
};

/** 色を作るヘルパー（記述量を減らすため） */
function palette(base: string, dark: string, light: string, accent: string): Palette {
  return { base, dark, light, accent };
}

// よく使う配色をあらかじめ用意しておく
const P_SLATE = palette("#4b5563", "#1f2937", "#9ca3af", "#38bdf8");
const P_INK = palette("#374151", "#111827", "#6b7280", "#60a5fa");
const P_SNOW = palette("#d1d5db", "#6b7280", "#f9fafb", "#3b82f6");
const P_RED = palette("#b91c1c", "#7f1d1d", "#f87171", "#fde047");
const P_PURPLE = palette("#6d28d9", "#3b0764", "#a78bfa", "#f0abfc");
const P_GREEN = palette("#15803d", "#14532d", "#4ade80", "#fde047");
const P_BLUE = palette("#1d4ed8", "#1e3a8a", "#60a5fa", "#67e8f9");
const P_AMBER = palette("#b45309", "#78350f", "#fbbf24", "#fef08a");
const P_TEAL = palette("#0f766e", "#134e4a", "#2dd4bf", "#a7f3d0");
const P_PINK = palette("#be185d", "#831843", "#f9a8d4", "#fef08a");

// ============================================================
// プラットフォーム別の見た目
// ============================================================

export type PlatformVisual = {
  shape: ShapeKey;
  palette: Palette;
};

/**
 * 22プラットフォーム → 見た目のマッピング。
 *
 * ★型を Record<Platform, PlatformVisual> にしているため、
 *   PLATFORMS に新しい要素を足すとこのオブジェクトが型エラーになる。
 *   「定義を忘れたまま本番に出る」事故をビルド時に防いでいる。
 */
export const PLATFORM_VISUALS: Record<Platform, PlatformVisual> = {
  PS1: { shape: "box", palette: P_SNOW },
  PS2: { shape: "tower", palette: P_INK },
  PS3: { shape: "slab", palette: P_SLATE },
  PS4: { shape: "slab", palette: P_BLUE },
  PS5: { shape: "tower", palette: P_SNOW },
  PSP: { shape: "handheld", palette: P_INK },
  PSVita: { shape: "handheld", palette: P_SLATE },
  FC: { shape: "box", palette: P_RED },
  SFC: { shape: "box", palette: P_SNOW },
  N64: { shape: "blob", palette: P_PURPLE },
  GC: { shape: "box", palette: P_PURPLE },
  "GB/GBA": { shape: "handheld", palette: P_GREEN },
  DS: { shape: "clamshell", palette: P_SLATE },
  "3DS": { shape: "clamshell", palette: P_TEAL },
  Wii: { shape: "tower", palette: P_SNOW },
  WiiU: { shape: "slab", palette: P_SNOW },
  Switch: { shape: "handheld", palette: P_RED },
  Switch2: { shape: "handheld", palette: P_INK },
  SS: { shape: "box", palette: P_SLATE },
  DC: { shape: "disc", palette: P_SNOW },
  "ポケモン（電池交換）": { shape: "cartridge", palette: P_PINK },
  その他: { shape: "blob", palette: P_AMBER },
};

// ============================================================
// 強さのランク
// ============================================================

/** 1=ざこ 2=中堅 3=強敵 */
export type MonsterTier = 1 | 2 | 3;

/** ランクごとの接頭辞（レトロRPGの「はぐれメタル」的な語感） */
const TIER_PREFIX: Record<MonsterTier, string> = {
  1: "",
  2: "つよそうな",
  3: "きょうだいな",
};

/** ボス専用の接頭辞 */
const BOSS_PREFIX = "こんぽう魔王";

/**
 * 梱包チェック項目の数から強さランクを決める。
 * 同梱物が多いセット商品ほど強くなる。
 *
 *   1〜2項目  → ランク1
 *   3〜5項目  → ランク2
 *   6項目以上 → ランク3
 */
export function calcTier(itemCount: number): MonsterTier {
  if (itemCount >= 6) return 3;
  if (itemCount >= 3) return 2;
  return 1;
}

// ============================================================
// モンスター生成
// ============================================================

export type Monster = {
  /** 表示名（例: 「つよそうな PS3のイタバン」） */
  name: string;
  /** ハード名。実在名は文字で出す方針 */
  platformLabel: string;
  /** 商品名（画面下部のサブ情報として出す） */
  productLabel: string;
  shape: ShapeKey;
  palette: Palette;
  tier: MonsterTier;
  isBoss: boolean;
  /** 最大HP = 梱包チェック項目の総数。残HP = 未チェック数 */
  maxHp: number;
  /** 撃破時に得られる経験値 */
  exp: number;
};

/**
 * モンスターを1体組み立てる。
 *
 * HPを別途管理しないのが設計の要点。
 * 「未チェックの項目数 = 残りHP」なので、既存のチェック状態と
 * 絶対にズレない。状態を二重に持たない。
 *
 * @param platform  注文の代表プラットフォーム
 * @param productLabel 商品名（セット名など）
 * @param itemCount 梱包チェック項目の総数（= 最大HP）
 * @param isBoss    残り1件のときに true
 */
export function buildMonster(
  platform: Platform,
  productLabel: string,
  itemCount: number,
  isBoss: boolean
): Monster {
  // 未知のプラットフォームが来ても落とさず「その他」で代替する。
  // 型上は起こらないが、localStorage の古いデータ経由で
  // 未定義の文字列が入る可能性がある（実行時の防御）。
  const visual = PLATFORM_VISUALS[platform];
  if (!visual) {
    console.warn(
      `[monsterDefinitions] 未定義のプラットフォーム: "${platform}"\n` +
      `　→ PLATFORM_VISUALS に定義を追加してください（monsterDefinitions.ts）`
    );
  }
  const safeVisual = visual ?? PLATFORM_VISUALS["その他"];

  // HPは最低1を保証する。0だと「出現した瞬間に倒れている」状態になる
  const maxHp = Math.max(1, itemCount);
  const tier = calcTier(maxHp);

  const family = SHAPE_FAMILY[safeVisual.shape];
  const prefix = isBoss ? BOSS_PREFIX : TIER_PREFIX[tier];

  // ボスは「こんぽう魔王 PS3のイタバン」のように仰々しくする
  const name = prefix ? `${prefix} ${platform}の${family}` : `${platform}の${family}`;

  // 経験値: 項目数 × ランク × 10。ボスは2倍
  const exp = maxHp * tier * 10 * (isBoss ? 2 : 1);

  return {
    name,
    platformLabel: platform,
    productLabel,
    shape: safeVisual.shape,
    palette: safeVisual.palette,
    tier,
    isBoss,
    maxHp,
    exp,
  };
}

// ============================================================
// 開発時の自己検査
// ============================================================

/**
 * 全プラットフォームに定義があるかを実行時にも確認する。
 * 型チェックで拾えるはずだが、as any 等をすり抜けた場合の保険。
 * 開発サーバー起動時にコンソールへ1回だけ出力する。
 */
export function verifyMonsterDefinitions(): void {
  const missing = PLATFORMS.filter((p) => !PLATFORM_VISUALS[p]);
  if (missing.length > 0) {
    console.error(
      `[monsterDefinitions] 定義が不足しています: ${missing.join(", ")}\n` +
      `　→ monsterDefinitions.ts の PLATFORM_VISUALS に追加してください`
    );
    return;
  }
  console.log(
    `[monsterDefinitions] 定義OK: ${PLATFORMS.length}プラットフォーム / ${SHAPE_KEYS.length}シェイプ`
  );
}
// src/uiSettings.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 画面の表示設定（文字サイズ）
//
// ルート要素（html）の font-size を変えることで画面全体を拡大する。
// Tailwind の文字サイズ・余白は rem 基準なので、これだけで比例して大きくなる。
// ボタンの最小高さ（min-h-[56px]）や最大幅（max-w-[780px]）は px 指定のため
// 変化しない ＝ タップ領域を保ったまま文字だけが大きくなる。
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 文字サイズの段階 */
export type FontSizeLevel = "small" | "medium" | "large";

/** 各段階のルートフォントサイズ（px） */
export const FONT_SIZE_PX: Record<FontSizeLevel, number> = {
  small: 16,   // 標準（ブラウザ既定と同じ）
  medium: 18,
  large: 20,
};

/** 設定画面に出すラベル */
export const FONT_SIZE_LABELS: Record<FontSizeLevel, string> = {
  small: "小",
  medium: "中",
  large: "大",
};

/** 既定値 */
export const DEFAULT_FONT_SIZE: FontSizeLevel = "small";

const STORAGE_KEY = "game-packing-font-size";

/** 保存済みの文字サイズを取得。未設定・不正値なら既定値を返す */
export function getFontSize(): FontSizeLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "small" || stored === "medium" || stored === "large") {
      return stored;
    }
  } catch (err) {
    console.error("[uiSettings] 文字サイズの読み込みエラー:", err);
  }
  return DEFAULT_FONT_SIZE;
}

/** 文字サイズを保存する（画面への反映は applyFontSize が行う） */
export function saveFontSize(level: FontSizeLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch (err) {
    console.error("[uiSettings] 文字サイズの保存エラー:", err);
  }
}

/**
 * ルート要素に文字サイズを適用する。
 * 起動時と、設定変更時に呼ぶ。
 */
export function applyFontSize(level: FontSizeLevel): void {
  try {
    document.documentElement.style.fontSize = `${FONT_SIZE_PX[level]}px`;
  } catch (err) {
    console.error("[uiSettings] 文字サイズの適用エラー:", err);
  }
}

/**
 * 保存済みの設定を読み出して即座に適用する。
 * アプリ起動時に1回だけ呼ぶ。
 */
export function initFontSize(): FontSizeLevel {
  const level = getFontSize();
  applyFontSize(level);
  return level;
}
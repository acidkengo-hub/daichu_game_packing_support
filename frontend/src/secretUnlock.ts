// src/secretUnlock.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// シークレット「レトロ梱包モード」の解除判定
//
// 解除方法: ホーム画面のロゴを1.5秒以内の間隔で7回連続タップ
//
// 設計方針:
//  1. 判定の中身は純粋関数（pushTap）にして、時刻を引数で受け取る
//     → ブラウザに依存せずテストできる
//  2. localStorage のキーは新規のものだけを使う
//     → game-packing-workday には一切触れないため業務データを壊さない
//  3. 日付が変わったら自動的に無効化する
//     → shipmentStore の loadWorkDay と同じ思想を揃える
//  4. iPad Safari で確実に動く「連続タップ」のみを使う
//     → 長押し（テキスト選択メニュー）やダブルタップ（ズーム）を避ける
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ============================================================
// 定数
// ============================================================

/** 解除に必要なタップ回数 */
export const REQUIRED_TAPS = 7;

/** この間隔(ms)を超えて間が空いたらカウントをリセットする */
export const TAP_TIMEOUT_MS = 1500;

/** 「あと少し」のヒントを出し始めるタップ回数 */
export const HINT_THRESHOLD = 4;

/** localStorage のキー（既存キーとは完全に別） */
const STORAGE_KEY = "game-packing-retro";

// ============================================================
// 純粋関数: タップ履歴の評価
// ============================================================

export type TapResult = {
  /** 有効な連続タップ数 */
  count: number;
  /** 解除まであと何回 */
  remaining: number;
  /** この一打で解除条件を満たしたか */
  reached: boolean;
  /** ヒント表示を出すべきか */
  showHint: boolean;
  /** 次に引き継ぐタップ履歴（タイムスタンプの配列） */
  nextHistory: number[];
};

/**
 * タップ履歴に1打を加え、状態を評価する。
 *
 * 純粋関数にしている理由:
 *   Date.now() を内部で呼ぶと「1.5秒待ったとき本当にリセットされるか」を
 *   テストするのに実際に1.5秒待つ必要が出てしまう。
 *   時刻を引数で受け取れば、任意の時刻を渡して即座に検証できる。
 *
 * @param history 直前までのタップ時刻（昇順のタイムスタンプ配列）
 * @param now     今回のタップ時刻
 */
export function pushTap(history: number[], now: number): TapResult {
  // 直前のタップから TAP_TIMEOUT_MS 以上空いていたら履歴を捨てる。
  // 「連続」の定義を「最後のタップからの間隔」に置いている点に注意。
  // 全体の経過時間で判定すると、ゆっくり7回押しても通らなくなる。
  const last = history.length > 0 ? history[history.length - 1] : null;
  const isContinuing = last !== null && now - last <= TAP_TIMEOUT_MS;

  const nextHistory = isContinuing ? [...history, now] : [now];
  const count = nextHistory.length;
  const reached = count >= REQUIRED_TAPS;

  return {
    count,
    remaining: Math.max(0, REQUIRED_TAPS - count),
    reached,
    showHint: count >= HINT_THRESHOLD && !reached,
    // 解除に達したら履歴を空に戻す（連続でトグルが暴発しないように）
    nextHistory: reached ? [] : nextHistory,
  };
}

// ============================================================
// ステートフルなラッパー
// ============================================================

/**
 * モジュール内部に持つタップ履歴。
 *
 * トレードオフ:
 *   モジュールレベルの状態はテストしにくいが、呼び出し側（App.tsx）が
 *   履歴の受け渡しを意識せずに済む。判定の本体は pushTap 側に
 *   純粋関数として切り出してあるため、テスト性は確保できている。
 */
let tapHistory: number[] = [];

/**
 * ロゴがタップされたときに呼ぶ。
 * 戻り値の reached が true なら、呼び出し側でモードをトグルする。
 */
export function registerTap(now: number = Date.now()): TapResult {
  const result = pushTap(tapHistory, now);
  tapHistory = result.nextHistory;
  return result;
}

/** タップ履歴を明示的に破棄する（画面遷移時などに呼ぶ） */
export function resetTaps(): void {
  tapHistory = [];
}

// ============================================================
// localStorage への永続化
// ============================================================

/** 保存する形。日付を一緒に持つことで翌日の自動失効を実現する */
type RetroState = {
  enabled: boolean;
  /** 有効化した日付 "YYYY-MM-DD" */
  date: string;
};

/** 今日の日付を "YYYY-MM-DD" で返す（shipmentStore と同じ形式） */
function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * レトロモードが現在有効かどうか。
 *
 * 日付が変わっていた場合は無効として扱い、保存も消す。
 * 「その日の作業限り」という仕様を、読み出し側で担保している。
 */
export function isRetroModeEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const parsed = JSON.parse(stored) as RetroState;

    // 後方互換・壊れたデータへの防御:
    // 想定外の形が入っていたら黙って無効にする（業務を止めないため）
    if (typeof parsed?.enabled !== "boolean" || typeof parsed?.date !== "string") {
      console.warn(
        `[secretUnlock] 保存データの形式が不正です: ${stored}\n` +
        `　→ ${STORAGE_KEY} を削除して無効状態に戻します`
      );
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    if (parsed.date !== todayString()) {
      console.log(
        `[secretUnlock] 日付が変わったためレトロモードを解除 (${parsed.date} → ${todayString()})`
      );
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    return parsed.enabled;
  } catch (err) {
    // JSON.parse の失敗や、プライベートブラウズでの localStorage 拒否など。
    // ここで throw すると業務用の画面が真っ白になるため、必ず false で返す。
    console.error(
      "[secretUnlock] 状態の読み込みに失敗しました:", err,
      `\n　→ DevTools の Application → Local Storage で "${STORAGE_KEY}" を確認してください`
    );
    return false;
  }
}

/**
 * レトロモードの有効/無効を保存する。
 * @returns 保存後の状態（保存に失敗した場合も、意図した値を返す）
 */
export function setRetroMode(enabled: boolean): boolean {
  try {
    if (!enabled) {
      localStorage.removeItem(STORAGE_KEY);
      console.log("[secretUnlock] レトロモード: OFF");
      return false;
    }
    const state: RetroState = { enabled: true, date: todayString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log("[secretUnlock] レトロモード: ON");
    return true;
  } catch (err) {
    console.error(
      "[secretUnlock] 状態の保存に失敗しました:", err,
      "\n　→ localStorage の容量制限、またはプライベートブラウズの可能性があります"
    );
    return enabled;
  }
}

/**
 * 現在の状態を反転させる。7回タップの到達時に呼ぶ。
 * @returns 反転後の状態
 */
export function toggleRetroMode(): boolean {
  return setRetroMode(!isRetroModeEnabled());
}

/**
 * レトロモードを強制的に解除する。
 * 「本日の全データを削除」および梱包完了時に呼ぶ。
 * タップ履歴も破棄するため、再開には改めて7回タップが必要になる。
 */
export function disableRetroMode(): void {
  resetTaps();
  setRetroMode(false);
}
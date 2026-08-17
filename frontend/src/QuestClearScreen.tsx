// src/QuestClearScreen.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DAICHU QUEST クリア画面（1便の梱包が全件完了したときに表示）
//
// 設計方針:
//  1. 状態を持たない。与えられた戦績を表示するだけ
//  2. 集計は接続側（App.tsx）で行う。必要な情報は既存の carrierData に
//     あるため、そこで計算するのが自然
//  3. 経過時間の計算は純粋関数として切り出す。時刻を引数で受け取れば
//     日付跨ぎなどの境界を実際に待たずに検証できる
//  4. 経過時間は「はじめてから」と明示する。CSV取込からの経過であり
//     休憩や中断も含まれるため、作業時間と誤解させない
//  5. レベルは表示しない。1便完結の設計では経験値から機械的に決まる
//     だけの値であり、育てる感覚がないため意味が薄い
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import MonsterSprite from "./MonsterSprite";
import type { Monster } from "./monsterDefinitions";

// ============================================================
// 経過時間の計算（純粋関数）
// ============================================================

/**
 * 開始時刻から現在までの経過を「Nじかん Mふん」形式で返す。
 *
 * 純粋関数にしている理由:
 *   Date.now() を内部で呼ぶと日付跨ぎや長時間経過のテストが
 *   実際に待たないと検証できない。時刻を引数で受ければ即座に試せる。
 *
 * @param startedAtIso 開始時刻（ISO文字列）
 * @param nowMs        現在時刻（ミリ秒）
 * @returns 表示用の文字列。計算できない場合は null
 */
export function formatElapsed(startedAtIso: string, nowMs: number): string | null {
  try {
    const startMs = new Date(startedAtIso).getTime();

    // Invalid Date は NaN になる。isNaN で弾かないと "NaNふん" と表示される
    if (Number.isNaN(startMs)) {
      console.warn(
        `[QuestClearScreen] 開始時刻の形式が不正です: "${startedAtIso}"\n` +
        `　→ shipmentStore の uploadedAt が ISO文字列かを確認してください`
      );
      return null;
    }

    const diffMs = nowMs - startMs;

    // 未来の時刻が入っていた場合（端末の時刻ズレなど）は表示しない
    if (diffMs < 0) return null;

    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) return `${hours}じかん ${minutes}ふん`;
    // 1分未満でも「0ふん」ではなく「1ふん」にする（違和感を避ける）
    return `${Math.max(1, minutes)}ふん`;
  } catch (err) {
    console.error("[QuestClearScreen] 経過時間の計算に失敗しました:", err);
    return null;
  }
}

// ============================================================
// 型定義
// ============================================================

/** 倒したモンスター1体分の記録（表示に必要な最小限） */
export type DefeatedRecord = Pick<Monster, "name" | "shape" | "palette" | "detail" | "tier" | "exp"> & { isBoss: boolean };

export type QuestClearScreenProps = {
  /** キャリア名（例: ヤマト宅急便） */
  carrierLabel: string;
  /** 倒したモンスター（梱包完了した注文） */
  defeated: DefeatedRecord[];
  /** 梱包したアイテムの総数（チェック項目の合計） */
  totalItems: number;
  /** 獲得した総経験値 */
  totalExp: number;
  /** CSV取込時刻（ISO文字列）。経過時間の起点 */
  startedAtIso: string;
  /** 別キャリアが残っている場合のラベルと件数。無ければ null */
  nextCarrier: { label: string; count: number } | null;

  // --- 操作 ---
  onNextCarrier: () => void;
  onBackToHome: () => void;
};

// ============================================================
// 部品
// ============================================================

/** 戦績の1行 */
function StatRow({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-white/70 text-sm shrink-0">{label}</span>
      {/* 点線のリーダー。目録らしくなる */}
      <span className="flex-1 border-b border-dotted border-white/20 mb-1" />
      <span
        className={`shrink-0 tabular-nums ${
          highlight ? "text-yellow-300 text-2xl font-bold" : "text-white text-lg"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="text-white/60 text-sm ml-1">{unit}</span>}
      </span>
    </div>
  );
}

// ============================================================
// 本体
// ============================================================

/** 一覧表示するモンスターの上限。超えた分は数字で示す */
const MAX_SHOWN_MONSTERS = 20;

export default function QuestClearScreen({
  carrierLabel,
  defeated,
  totalItems,
  totalExp,
  startedAtIso,
  nextCarrier,
  onNextCarrier,
  onBackToHome,
}: QuestClearScreenProps) {
  // 経過時間。null（計算不能）の場合はその行を出さない
  const elapsed = formatElapsed(startedAtIso, Date.now());

  const shown = defeated.slice(0, MAX_SHOWN_MONSTERS);
  const hiddenCount = defeated.length - shown.length;

  // OS標準の等幅フォント
  const monoFont = '"Menlo", "Osaka-Mono", "MS Gothic", monospace';

  // CLEAR文字の縁取り。戦闘画面と同じ手法で統一感を出す
  const outline =
    "3px 3px 0 #b45309, -3px 3px 0 #b45309, 3px -3px 0 #b45309, -3px -3px 0 #b45309, " +
    "0 0 20px rgba(253,224,71,0.5), 0 8px 16px rgba(0,0,0,0.9)";

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-6"
      style={{ fontFamily: monoFont }}
    >
      <div className="w-full max-w-[720px]">
        {/* ============================================ */}
        {/* CLEAR（再掲。戦闘画面より控えめに） */}
        {/* ============================================ */}
        <div className="text-center animate-clear-in">
          <p
            className="font-black leading-none"
            style={{
              fontSize: "clamp(2.5rem, 11vw, 4.5rem)",
              color: "#fde047",
              textShadow: outline,
            }}
          >
            CLEAR!!!
          </p>
          <p className="text-yellow-200/70 text-xs tracking-[0.3em] mt-2">
            DAICHU QUEST
          </p>
          <p className="text-white/50 text-sm mt-3">
            {carrierLabel} の こんぽうが すべて おわった
          </p>
        </div>

        {/* ============================================ */}
        {/* ぼうけんの きろく */}
        {/* ============================================ */}
        <div className="mt-7 border-2 border-white bg-black p-0.5">
          <div className="border border-white/60 px-4 py-3">
            <p className="text-yellow-300 text-sm mb-2 tracking-wider">
              ─ ぼうけんの きろく ─
            </p>

            <StatRow label="たおした モンスター" value={defeated.length} unit="たい" />
            <StatRow label="こんぽうした アイテム" value={totalItems} unit="こ" />
            {/* 経過時間。「はじめてから」と明示することで、CSV取込からの
                経過であり作業時間ではないことを正確に伝える */}
            {elapsed && <StatRow label="はじめてから" value={elapsed} />}

            <div className="border-t border-white/30 mt-2 pt-1">
              <StatRow label="そうけいけんち" value={totalExp} highlight />
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* 倒したモンスター一覧 */}
        {/* ============================================ */}
        {shown.length > 0 && (
          <div className="mt-5 border-2 border-white bg-black p-0.5">
            <div className="border border-white/60 px-3 py-3">
              <p className="text-white/60 text-xs mb-3 tracking-wider">
                ─ たおした モンスター ─
              </p>
              <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
                {shown.map((m, i) => (
                  <div
                    key={i}
                    className="w-[86px] text-center animate-clear-char"
                    // 1体ずつ順に出てくる。CLEAR文字と同じ手法
                    style={{ animationDelay: `${300 + i * 45}ms` }}
                  >
                    <MonsterSprite
                      shape={m.shape}
                      palette={m.palette}
                      detail={m.detail}
                      tier={m.tier}
                      isBoss={m.isBoss}
                      size={64}
                      className="opacity-45"
                    />
                    <p
                      className={`text-[9px] leading-tight mt-0.5 ${
                        m.isBoss ? "text-red-400" : "text-white/40"
                      }`}
                    >
                      {m.isBoss && "👑"}
                      {m.name}
                    </p>
                  </div>
                ))}
              </div>
              {hiddenCount > 0 && (
                <p className="text-white/40 text-xs text-center mt-3">
                  ほか {hiddenCount} たい
                </p>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 操作 */}
        {/* ============================================ */}
        <div className="mt-7 space-y-3 pb-4">
          {nextCarrier && (
            <button
              onClick={onNextCarrier}
              className="w-full border-2 border-yellow-300 bg-yellow-500 text-black
                         py-4 text-base font-bold min-h-[60px] active:bg-yellow-400"
            >
              ▶ つぎの びんへ（{nextCarrier.label} {nextCarrier.count}けん）
            </button>
          )}
          <button
            onClick={onBackToHome}
            className="w-full border-2 border-white/40 bg-black text-white/80
                       py-4 text-base min-h-[60px] active:bg-white/10"
          >
            メニューに もどる
          </button>
        </div>
      </div>
    </div>
  );
}
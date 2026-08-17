// src/QuestTitleScreen.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DAICHU QUEST タイトル画面（シークレットモード解除時に1回だけ表示）
//
// 設計方針:
//  1. 状態を持たない。タップされたら onStart を呼ぶだけ
//  2. 既存のホーム画面は一切改造しない。この画面を「幕開け」として
//     手前に差し込むだけにする
//     → 接続作業が軽く保たれ、業務導線も変わらない
//  3. 背景モンスターの配置は配列データで持つ。
//     → 調整のたびにJSX構造を触らずに済む
//  4. アニメーションは index.css の既存 keyframes を再利用する。
//     animationDelay を個別に与えて同期を崩し、機械的に見えないようにする
//  5. 画面のどこをタップしても進める。
//     → 現場では手袋の可能性があり、小さなボタンを狙わせない
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import MonsterSprite from "./MonsterSprite";
import { PLATFORM_VISUALS } from "./monsterDefinitions";
import type { Platform } from "./platformDetector";

// ============================================================
// 背景モンスターの配置
// ============================================================

/**
 * タイトル画面に浮かべるモンスター。
 *
 * 位置は % 指定にして画面幅に追従させる。
 * delay をずらすことで3体が別々のリズムで浮く。
 */
type BgMonster = {
  platform: Platform;
  /** 左からの位置(%) */
  left: number;
  /** 上からの位置(%) */
  top: number;
  size: number;
  /** 待機モーションの開始をずらす(ms) */
  delay: number;
  /** 奥にいるものは薄くして遠近感を出す */
  opacity: number;
};

const BG_MONSTERS: BgMonster[] = [
  { platform: "PS3", left: 12, top: 58, size: 110, delay: 0, opacity: 0.75 },
  { platform: "3DS", left: 74, top: 62, size: 90, delay: 700, opacity: 0.65 },
  { platform: "FC", left: 44, top: 72, size: 74, delay: 1400, opacity: 0.5 },
  { platform: "Switch", left: 86, top: 30, size: 62, delay: 1000, opacity: 0.35 },
  { platform: "DC", left: 6, top: 26, size: 58, delay: 400, opacity: 0.3 },
];

// ============================================================
// 本体
// ============================================================

export type QuestTitleScreenProps = {
  /** 「はじめる」がタップされたとき。既存のホーム画面へ進む */
  onStart: () => void;
};

export default function QuestTitleScreen({ onStart }: QuestTitleScreenProps) {
  // OS標準の等幅フォント。Webフォントを読まないためオフラインでも崩れない
  const monoFont = '"Menlo", "Osaka-Mono", "MS Gothic", monospace';

  // タイトル文字の縁取り。CLEAR演出と同じ手法で統一感を出す
  const titleOutline =
    "4px 4px 0 #7f1d1d, -4px 4px 0 #7f1d1d, 4px -4px 0 #7f1d1d, -4px -4px 0 #7f1d1d, " +
    "0 0 28px rgba(253,224,71,0.5), 0 12px 24px rgba(0,0,0,0.9)";

  return (
    // 画面全体がタップ領域。role と aria で操作可能なことを明示する
    <div
      onClick={onStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // キーボードでも進めるようにする（開発時の確認が楽になる）
        if (e.key === "Enter" || e.key === " ") onStart();
      }}
      className="min-h-screen bg-black text-white relative overflow-hidden
                 flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ fontFamily: monoFont }}
    >
      {/* ============================================ */}
      {/* 背景: 地平線のグラデーション */}
      {/* ============================================ */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(30,58,138,0.35), rgba(0,0,0,0) 70%)",
        }}
      />

      {/* ============================================ */}
      {/* 背景: モンスターがうろついている */}
      {/* ============================================ */}
      {BG_MONSTERS.map((m, i) => {
        const visual = PLATFORM_VISUALS[m.platform];
        return (
          <div
            key={i}
            className="absolute animate-idle pointer-events-none"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              opacity: m.opacity,
              // 各体で開始をずらし、3体が別々のリズムで浮くようにする
              animationDelay: `${m.delay}ms`,
            }}
          >
            <MonsterSprite
              shape={visual.shape}
              palette={visual.palette}
              detail={visual.detail}
              tier={1}
              size={m.size}
            />
          </div>
        );
      })}

      {/* ============================================ */}
      {/* タイトル */}
      {/* ============================================ */}
      <div className="relative text-center px-6 -mt-12">
        <p
          className="font-black leading-[0.85] tracking-tight"
          style={{
            // clamp で画面幅に追従。狭い画面でもはみ出さない
            fontSize: "clamp(3rem, 15vw, 6.5rem)",
            color: "#fde047",
            textShadow: titleOutline,
          }}
        >
          DAICHU
        </p>
        <p
          className="font-black leading-[0.85] tracking-tight"
          style={{
            fontSize: "clamp(3rem, 15vw, 6.5rem)",
            color: "#fde047",
            textShadow: titleOutline,
          }}
        >
          QUEST
        </p>

        {/* サブタイトル。上下に線を引くとレトロなタイトルらしくなる */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-white/40" />
          <p
            className="text-red-400 tracking-[0.25em]"
            style={{ fontSize: "clamp(0.7rem, 3vw, 1rem)" }}
          >
            こんぽうの まおう
          </p>
          <span className="h-px w-8 bg-white/40" />
        </div>
      </div>

      {/* ============================================ */}
      {/* メニュー */}
      {/* ============================================ */}
      <div className="relative mt-12 text-center">
        {/* 押せる場所の目印。実際の判定は画面全体にある */}
        <div
          className="inline-flex items-center gap-3 border-2 border-white bg-black/70
                     px-7 py-4 min-h-[60px]"
        >
          <span className="animate-blink text-yellow-300 text-xl leading-none">▶</span>
          <span className="text-white text-lg">ぼうけんを はじめる</span>
        </div>

        <p className="mt-6 text-white/50 text-xs tracking-[0.3em] animate-blink">
          PRESS START
        </p>
        <p className="mt-1 text-white/25 text-[10px]">
          （がめんの どこでも タップ）
        </p>
      </div>

      {/* ============================================ */}
      {/* フッター */}
      {/* ============================================ */}
      <p className="absolute bottom-4 text-white/20 text-[10px] tracking-widest">
        © DAICHU 2026 ─ SECRET MODE
      </p>
    </div>
  );
}
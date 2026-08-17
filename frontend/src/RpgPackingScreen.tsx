// src/RpgPackingScreen.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// レトロRPG風の梱包画面（シークレットモード / DAICHUクエスト）
//
// 設計方針:
//  1. 業務データ（チェック状態・完了記録）は一切持たない。
//     App.tsx が持つものを props で受け取り、操作は callback で返す。
//     → 既存ロジックを1行も変更せず画面だけ差し替えられる
//  2. ただし「演出の進行状態」だけは内部に持つ。
//     全チェック → とどめの一撃 → 撃破 → 次へ という段階を表現するため。
//     これは一時的な表示状態であり localStorage にも保存しない
//  3. HPは別管理しない。「未チェックの項目数 = 残HP」。
//     → 既存のチェック状態と構造的にズレない
//  4. チェック記号を ✖ にして HPバーの ■□ と揃える。
//     → 「1項目 = HP1」が視覚的にリンクする
//  5. アニメーションはこのファイルに書かない。
//     → 演出は index.css の @keyframes として次フェーズで追加する
//  6. Webフォントを使わない。
//     → 現場のiPadがオフラインでも確実に表示されるようにする
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect } from "react";
import MonsterSprite from "./MonsterSprite";
import type { Monster } from "./monsterDefinitions";

// ============================================================
// 型定義
// ============================================================

/**
 * チェック項目1件。
 * App.tsx の allCheckItems と同じ形にしてある。
 * 型を合わせておくことで、App.tsx 側で変換処理を書かずに渡せる。
 */
export type CheckItem = {
  label: string;
  key: string;
  isAlert?: boolean;
  index?: number;
  total?: number;
};

export type RpgPackingScreenProps = {
  /** 表示するモンスター */
  monster: Monster;
  /**
   * 注文の識別子（管理番号）。
   * これが変わったら演出状態をリセットするために使う。
   * 前後移動で別の注文に移ったとき「倒した」表示が残る問題への対応。
   */
  orderKey: string;
  /** チェック項目の一覧 */
  items: CheckItem[];
  /** チェック状態: キー → チェック済みか */
  checked: Record<string, boolean>;
  /** 何件目 / 全何件 */
  currentIndex: number;
  totalCount: number;
  /** 完了済みの件数 */
  doneCount: number;
  /** これまでに稼いだ経験値の累計 */
  totalExp: number;
  /** 最後の敵（残り1件）か。ボス演出と完了後の文言に使う */
  isLast: boolean;
  /** 宛名 */
  recipientName: string;
  /** 配送希望日。無ければ空文字 */
  deliveryDate: string;
  /** この注文が既に完了記録済みか */
  isDone: boolean;

  // --- 操作（すべて App.tsx の既存ハンドラを渡す） ---
  onToggle: (key: string) => void;
  onComplete: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
};

/** 演出の進行段階。業務データではなく表示上の状態 */
type BattlePhase = "battle" | "defeated";

// ============================================================
// 部品
// ============================================================

/**
 * CLEAR演出。ボス撃破時にモンスターの上へ重ねる。
 *
 * 4つの要素を重ねて「クリアー！！！」感を出している:
 *   1. 閃光      — 一瞬白く飛ぶ
 *   2. 集中線    — conic-gradient で放射状の縞を作り、回しながら開く
 *   3. CLEAR文字 — 1字ずつ delay をずらして着弾させる
 *   4. サブ文字  — 遅れて出てくる
 *
 * アニメーションは transform と opacity のみを動かしているため、
 * レイアウトの再計算が起きずiPadでもコマ落ちしにくい。
 */
function ClearBanner() {
  const chars = "CLEAR!!!".split("");

  // レトロゲームの縁取り文字。text-shadow を4方向＋下影で重ねる
  const outline =
    "4px 4px 0 #b45309, -4px 4px 0 #b45309, 4px -4px 0 #b45309, -4px -4px 0 #b45309, " +
    "0 0 24px rgba(253,224,71,0.6), 0 10px 20px rgba(0,0,0,0.9)";

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* 1. 閃光 */}
      <div className="absolute inset-0 bg-white animate-clear-flash" />

      {/* 2. 集中線。conic-gradient で放射状の縞模様を作る */}
      <div
        className="absolute animate-clear-burst"
        style={{
          width: "160%",
          aspectRatio: "1 / 1",
          background:
            "repeating-conic-gradient(from 0deg, rgba(253,224,71,0.85) 0deg 4deg, transparent 4deg 11deg)",
          // 中心を抜いて文字を読みやすくする
          maskImage: "radial-gradient(circle, transparent 22%, black 46%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 22%, black 46%)",
        }}
      />

      {/* 3. CLEAR文字。1字ずつ遅延させて着弾させる */}
      <div className="relative text-center animate-clear-pulse">
        <p
          className="font-black leading-none whitespace-nowrap"
          style={{
            // clamp で画面幅に追従させる。狭い画面でもはみ出さない
            fontSize: "clamp(3.5rem, 13vw, 7rem)",
            letterSpacing: "-0.02em",
            color: "#fde047",
            textShadow: outline,
          }}
        >
          {chars.map((ch, i) => (
            <span
              key={i}
              className="inline-block animate-clear-char"
              // 1字ごとに 60ms ずらす。同じアニメーションでも
              // delay を変えるだけで連続ヒット感が出る
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {ch}
            </span>
          ))}
        </p>
        <p
          className="text-yellow-200 mt-3 tracking-[0.35em] animate-clear-char"
          style={{
            fontSize: "clamp(0.7rem, 2.4vw, 1rem)",
            animationDelay: "560ms",
            textShadow: "0 2px 6px rgba(0,0,0,0.9)",
          }}
        >
          DAICHU QUEST
        </p>
      </div>
    </div>
  );
}

/**
 * レトロRPG風の二重枠ウィンドウ。
 * 外枠を白、内側に少し隙間を空けてもう1本引く。
 */
function RetroWindow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-2 border-white bg-black p-0.5 ${className}`}>
      <div className="border border-white/60 h-full px-3 py-2">{children}</div>
    </div>
  );
}

/**
 * HPバーをブロック文字で描く。例: HP 3/5 → ■■■□□
 *
 * 項目数ぶん並べるので、同梱物が多いセットほどバーが長くなり
 * 「強そう」が視覚的に伝わる。20を超える場合は圧縮する。
 */
function HpBar({ current, max }: { current: number; max: number }) {
  const MAX_BLOCKS = 20;
  const scale = max > MAX_BLOCKS ? MAX_BLOCKS / max : 1;
  const totalBlocks = Math.min(max, MAX_BLOCKS);
  const filledBlocks = Math.round(current * scale);

  const ratio = max > 0 ? current / max : 0;
  const color =
    ratio > 0.5 ? "text-emerald-400" : ratio > 0.25 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex items-center gap-2">
      <span className="text-white text-sm">HP</span>
      <span className={`${color} tracking-tighter text-base leading-none`}>
        {"■".repeat(filledBlocks)}
        <span className="text-white/25">{"□".repeat(totalBlocks - filledBlocks)}</span>
      </span>
      <span className="text-white text-sm tabular-nums">
        {current}/{max}
      </span>
    </div>
  );
}

// ============================================================
// 本体
// ============================================================

export default function RpgPackingScreen({
  monster,
  orderKey,
  items,
  checked,
  currentIndex,
  totalCount,
  doneCount,
  totalExp,
  isLast,
  recipientName,
  deliveryDate,
  isDone,
  onToggle,
  onComplete,
  onPrev,
  onNext,
  onExit,
}: RpgPackingScreenProps) {
  // --- 演出の進行段階。既に完了記録済みなら最初から撃破状態にする ---
  const [phase, setPhase] = useState<BattlePhase>(isDone ? "defeated" : "battle");

  /**
   * 被弾回数。値そのものには意味がなく、増えたことだけが重要。
   *
   * React は key が変わると要素を作り直すため、これを key に含めると
   * 同じCSSアニメーションを何度でも再生し直せる。
   * CSSアニメーションは「クラスを付け直す」だけでは再生されないため、
   * この手法が必要になる。
   */
  const [hitCount, setHitCount] = useState(0);

  // --- 注文が変わったら演出をリセットする ---
  // 前後移動で別の注文に移ったとき「倒した」表示が残るのを防ぐ。
  // 依存に orderKey を入れることで、注文の切り替わりだけに反応する
  useEffect(() => {
    setPhase(isDone ? "defeated" : "battle");
    setHitCount(0);
  }, [orderKey, isDone]);

  /**
   * 攻撃（チェック）。業務データの更新は親に任せ、
   * ここでは被弾演出のトリガーだけを担当する。
   */
  const handleAttack = (key: string) => {
    onToggle(key);
    setHitCount((c) => c + 1);
  };

  // --- 残HP = 未チェックの項目数 ---
  // ここが設計の要点。HPを別に管理していないため既存の状態とズレない
  const remainingHp = items.filter((item) => !checked[item.key]).length;
  const allChecked = remainingHp === 0 && items.length > 0;
  const isDefeated = phase === "defeated";

  /** とどめの一撃。演出を進めるだけで、業務データはまだ更新しない */
  const handleFinishBlow = () => {
    setPhase("defeated");
  };

  // --- メッセージウィンドウの文言 ---
  let message: string;
  if (isDefeated) {
    if (isLast) {
      message = `こんぽう魔王を たおした！\nDAICHUに へいわが もどった！`;
    } else {
      message = `${monster.name} を たおした！\nけいけんち ${monster.exp} を かくとく！`;
    }
  } else if (allChecked) {
    message = `${monster.name} は よわっている！\nとどめを さすか？`;
  } else if (isLast) {
    message = `さいごの てき\n${monster.name} が たちふさがった！`;
  } else {
    message = `${monster.name} が あらわれた！`;
  }

  // OS標準の等幅フォント。Webフォントを読まないためオフラインでも崩れない
  const monoFont = '"Menlo", "Osaka-Mono", "MS Gothic", monospace';

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col"
      style={{ fontFamily: monoFont }}
    >
      {/* ============================================ */}
      {/* 上部: 進行状況 */}
      {/* ============================================ */}
      <header className="px-3 pt-3 pb-2">
        <div className="max-w-[780px] mx-auto flex items-center justify-between text-sm">
          <button
            onClick={onExit}
            className="text-white/60 hover:text-white px-2 min-h-[44px]"
          >
            ← もどる
          </button>
          <span className="text-emerald-400">
            {currentIndex + 1}／{totalCount} たいせん中
          </span>
          <span className="text-yellow-400 tabular-nums">EXP {totalExp}</span>
        </div>
      </header>

      {/* ============================================ */}
      {/* 敵のステータスウィンドウ */}
      {/* ============================================ */}
      <div className="px-3">
        <div className="max-w-[780px] mx-auto">
          <RetroWindow>
            <p
              className={`font-bold leading-tight ${
                isLast ? "text-red-400 text-xl" : "text-white text-lg"
              }`}
            >
              {isLast && "👑 "}
              {monster.name}
            </p>
            <div className="mt-1.5">
              <HpBar current={isDefeated ? 0 : remainingHp} max={monster.maxHp} />
            </div>
          </RetroWindow>
        </div>
      </div>

      {/* ============================================ */}
      {/* 戦闘フィールド */}
      {/* CLEARを重ねるため relative にしている。absolute で重ねれば */}
      {/* レイアウトを押し広げないので他の要素が動かない */}
      {/* ============================================ */}
      <div
        className={`flex-1 flex items-center justify-center py-4 relative ${
          isDefeated && isLast ? "min-h-[300px]" : "min-h-[210px]"
        }`}
      >
        <div className="text-center">
          {/*
            アニメーションの選択:
              撃破後   → defeat（潰れて消える）
              被弾直後 → hit（横揺れ）
              ボス登場 → boss-appear（拡大して現れる）
              通常     → idle（ゆっくり浮く）
            key に hitCount を含めることで、同じアニメーションを
            再生し直せる。React は key が変わると要素を作り直すため
          */}
          <div
            key={`sprite-${orderKey}-${hitCount}`}
            className={
              isDefeated
                ? "animate-defeat"
                : hitCount > 0
                  ? "animate-hit"
                  : isLast
                    ? "animate-boss-appear"
                    : "animate-idle"
            }
          >
            <MonsterSprite
              shape={monster.shape}
              palette={monster.palette}
              detail={monster.detail}
              tier={monster.tier}
              isBoss={isLast}
              size={isLast ? 220 : 180}
            />
          </div>
          <p className="text-white/70 text-sm mt-2 max-w-[340px] mx-auto leading-snug">
            {monster.productLabel}
          </p>
        </div>

        {/* --- CLEAR演出。ボス撃破時のみ、モンスターの上に重ねる --- */}
        {/* absolute で重ねているのでレイアウトを押し広げず、他の要素が動かない */}
        {isDefeated && isLast && <ClearBanner />}
      </div>

      {/* ============================================ */}
      {/* メッセージウィンドウ */}
      {/* ============================================ */}
      <div className="px-3">
        <div className="max-w-[780px] mx-auto">
          <RetroWindow>
            <p
              className={`whitespace-pre-line leading-relaxed text-base ${
                isDefeated
                  ? "text-yellow-300"
                  : allChecked
                    ? "text-orange-300"
                    : "text-white"
              }`}
            >
              {message}
              {/* 次の操作を促すカーソル。レトロRPGの「次へ」記号 */}
              {(allChecked || isDefeated) && (
                <span className="animate-blink ml-1">▼</span>
              )}
            </p>
          </RetroWindow>
        </div>
      </div>

      {/* ============================================ */}
      {/* 宛先情報（業務上必須なので常に出す） */}
      {/* ============================================ */}
      <div className="px-3 mt-2">
        <div className="max-w-[780px] mx-auto">
          <RetroWindow>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-white/60">おくりさき</span>
              <span className="text-white font-bold flex-1 text-right">
                {recipientName} さま
              </span>
            </div>
            {deliveryDate && (
              <div className="flex items-baseline justify-between gap-2 text-sm mt-1">
                <span className="text-white/60">きぼうび</span>
                <span className="text-orange-300 font-bold flex-1 text-right">
                  {deliveryDate}
                </span>
              </div>
            )}
          </RetroWindow>
        </div>
      </div>

      {/* ============================================ */}
      {/* コマンドウィンドウ（同梱物チェック） */}
      {/* 撃破後は隠す。次の敵に進む導線に集中させるため */}
      {/* ============================================ */}
      {!isDefeated && (
        <div className="px-3 mt-2">
          <div className="max-w-[780px] mx-auto">
            <RetroWindow>
              <p className="text-white/50 text-xs mb-2">
                ▼ こうげき（タップして こんぽう）
              </p>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const isChecked = !!checked[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleAttack(item.key)}
                      className={`w-full flex items-center gap-3 text-left px-2 py-2
                        min-h-[56px] border transition-colors
                        ${
                          isChecked
                            ? "border-white/15 text-white/30"
                            : item.isAlert
                              ? "border-yellow-400/70 text-yellow-300 hover:bg-yellow-400/10 active:bg-yellow-400/25"
                              : "border-white/40 text-white hover:bg-white/10 active:bg-white/25"
                        }`}
                    >
                      {/* チェック枠。HPバーの ■□ と記号を揃えている */}
                      <span
                        className={`shrink-0 w-7 h-7 border-2 flex items-center justify-center
                          text-base leading-none font-bold
                          ${
                            isChecked
                              ? "border-white/20 text-red-500/70"
                              : item.isAlert
                                ? "border-yellow-400 text-transparent"
                                : "border-white text-transparent"
                          }`}
                      >
                        {isChecked ? "✖" : "□"}
                      </span>
                      <span
                        className={`flex-1 text-base leading-snug ${
                          isChecked ? "line-through" : ""
                        }`}
                      >
                        {item.isAlert && "⚠ "}
                        {item.label}
                        {item.index && item.total && (
                          <span className="text-white/50 ml-1">
                            （{item.index}／{item.total}）
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* アクションボタン */}
      {/* ============================================ */}
      <div className="px-3 mt-3 pb-3">
        <div className="max-w-[780px] mx-auto">
          {isDefeated ? (
            /* --- 撃破後: 次の敵へ進む --- */
            <button
              onClick={onComplete}
              className="w-full border-2 border-emerald-400 bg-emerald-600 text-white
                         py-4 text-lg font-bold min-h-[64px] active:bg-emerald-500"
            >
              {isLast ? "▼ けっかを みる" : "▼ モンスターの けはいが…！"}
            </button>
          ) : allChecked ? (
            /* --- 全チェック: とどめの一撃 --- */
            <button
              onClick={handleFinishBlow}
              className="w-full border-2 border-yellow-300 bg-yellow-500 text-black
                         py-4 text-lg font-bold min-h-[64px] active:bg-yellow-400"
            >
              ▶ とどめを さす！
            </button>
          ) : (
            /* --- 戦闘中: 残HPを表示（押せない） --- */
            <div
              className="w-full border-2 border-white/20 bg-black text-white/40
                         py-4 text-base text-center min-h-[64px] flex items-center justify-center"
            >
              のこり HP {remainingHp} ─ こうげきを つづけよ
            </div>
          )}

          {/* --- 前後移動。完了ボタンと分離する（既存の安全機構と同じ思想） --- */}
          <div className="flex items-center justify-between gap-2 mt-3">
            <button
              onClick={onPrev}
              disabled={currentIndex === 0}
              className={`px-4 py-2 border min-h-[48px] text-sm
                ${
                  currentIndex === 0
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : "border-white/40 text-white/70 hover:bg-white/10"
                }`}
            >
              ‹ まえ
            </button>
            <span className="text-white/40 text-sm">
              たおした てき {doneCount}／{totalCount}
            </span>
            <button
              onClick={onNext}
              disabled={currentIndex >= totalCount - 1}
              className={`px-4 py-2 border min-h-[48px] text-sm
                ${
                  currentIndex >= totalCount - 1
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : "border-white/40 text-white/70 hover:bg-white/10"
                }`}
            >
              つぎ ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
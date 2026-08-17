// src/gallery.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// モンスタースプライトの確認用ページ（開発専用）
//
// Vite の本番ビルドは index.html のみを入口にするため、
// このファイルと gallery.html は dist に含まれない。
// 本番URLからは到達できないので、現場に影響しない。
//
// 表示URL: http://localhost:5173/daichu_game_packing_support/gallery.html
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import MonsterSprite from "./MonsterSprite";
import RpgPackingScreen, { type CheckItem } from "./RpgPackingScreen";
import QuestTitleScreen from "./QuestTitleScreen";
import {
  SHAPE_KEYS,
  PLATFORM_VISUALS,
  buildMonster,
  verifyMonsterDefinitions,
  type MonsterTier,
} from "./monsterDefinitions";
import { PLATFORMS, type Platform } from "./platformDetector";

// 定義の網羅性を起動時に確認する
verifyMonsterDefinitions();

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center bg-gray-900 border border-gray-800 rounded p-2">
      {children}
      <p className="text-[10px] text-gray-400 mt-1 text-center leading-tight">{label}</p>
    </div>
  );
}

/**
 * 戦闘画面のプレビュー。
 *
 * RpgPackingScreen が状態を持たない設計であるため、
 * ここで仮の状態を用意するだけで単体動作を確認できる。
 * これが Presentational コンポーネントの利点そのもの。
 */
function BattlePreview() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [isBoss, setIsBoss] = useState(false);
  const [platform, setPlatform] = useState<Platform>("PS3");

  // PS3初期型セットを想定した仮データ
  const items: CheckItem[] = [
    { label: "楽天のチラシを同梱しましたか？", key: "a1", isAlert: true },
    { label: "PS3本体(初期型)", key: "c1" },
    { label: "三芯ケーブル", key: "c2" },
    { label: "HDMIケーブル", key: "c3" },
    { label: "DUALSHOCK3", key: "c4", index: 1, total: 2 },
    { label: "DUALSHOCK3", key: "c5", index: 2, total: 2 },
    { label: "USBケーブル(miniB/太)", key: "c6" },
  ];

  const monster = buildMonster(platform, "PS3初期型 すぐ遊べるセット CECHA00", items.length, isBoss);

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => setIsBoss((b) => !b)}
          className="px-3 py-1 bg-gray-800 text-gray-200 rounded text-xs"
        >
          ボス切替（現在: {isBoss ? "BOSS" : "通常"}）
        </button>
        <button
          onClick={() => setChecked({})}
          className="px-3 py-1 bg-gray-800 text-gray-200 rounded text-xs"
        >
          チェックをリセット
        </button>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="px-2 py-1 bg-gray-800 text-gray-200 rounded text-xs"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* iPadの画面比に近い枠で囲んで確認する */}
      <div className="border-2 border-gray-700 rounded overflow-hidden max-w-[820px]">
        <RpgPackingScreen
          monster={monster}
          orderKey={`preview-${platform}-${isBoss}`}
          items={items}
          checked={checked}
          currentIndex={2}
          totalCount={8}
          doneCount={2}
          totalExp={340}
          isLast={isBoss}
          recipientName="山田 太郎"
          deliveryDate="8月19日"
          isDone={false}
          onToggle={(key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))}
          onComplete={() => {
            alert("完了処理が呼ばれました（本番では次の敵へ進みます）");
            setChecked({});
          }}
          onPrev={() => console.log("前へ")}
          onNext={() => console.log("次へ")}
          onExit={() => console.log("戻る")}
        />
      </div>
    </div>
  );
}

function Gallery() {
  const tiers: MonsterTier[] = [1, 2, 3];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <h1 className="text-xl font-bold text-emerald-400 mb-1">Monster Gallery（開発専用）</h1>
      <p className="text-xs text-gray-500 mb-6">
        本番ビルドには含まれません。shape-rendering="crispEdges" の効きと3面塗りを確認します。
      </p>

      {/* --- タイトル画面プレビュー --- */}
      <h2 className="text-sm font-bold text-blue-300 mb-2">タイトル画面プレビュー</h2>
      <div className="border-2 border-gray-700 rounded overflow-hidden max-w-[820px] mb-10">
        <QuestTitleScreen
          onStart={() => alert("ぼうけんを はじめる → 本番では既存のホーム画面へ進みます")}
        />
      </div>

      {/* --- 戦闘画面プレビュー --- */}
      <h2 className="text-sm font-bold text-blue-300 mb-2">戦闘画面プレビュー</h2>
      <BattlePreview />

      {/* --- シェイプ8種 × ランク3段階 + ボス --- */}
      <h2 className="text-sm font-bold text-blue-300 mb-2">シェイプ8種 × 強さ</h2>
      <div className="grid grid-cols-4 gap-2 mb-8">
        {SHAPE_KEYS.map((shape) =>
          [...tiers, "boss" as const].map((t) => {
            const isBoss = t === "boss";
            const tier: MonsterTier = isBoss ? 3 : t;
            return (
              <Cell key={`${shape}-${t}`} label={`${shape} / ${isBoss ? "BOSS" : `rank${tier}`}`}>
                <MonsterSprite
                  shape={shape}
                  palette={PLATFORM_VISUALS.PS3.palette}
                  tier={tier}
                  isBoss={isBoss}
                  size={110}
                />
              </Cell>
            );
          })
        )}
      </div>

      {/* --- 22プラットフォーム全部 --- */}
      <h2 className="text-sm font-bold text-blue-300 mb-2">
        全{PLATFORMS.length}プラットフォーム（rank2表示）
      </h2>
      <div className="grid grid-cols-6 gap-2">
        {PLATFORMS.map((platform: Platform) => {
          const v = PLATFORM_VISUALS[platform];
          const m = buildMonster(platform, "テスト商品", 4, false);
          return (
            <Cell key={platform} label={`${platform}${v.detail ? " ★" : ""}\n${m.name}`}>
              <MonsterSprite
                shape={v.shape}
                palette={v.palette}
                detail={v.detail}
                tier={2}
                size={100}
              />
            </Cell>
          );
        })}
      </div>
    </div>
  );
}

const el = document.getElementById("gallery-root");
if (!el) {
  throw new Error(
    "gallery-root が見つかりません\n" +
    "　→ frontend/gallery.html に <div id=\"gallery-root\"></div> があるか確認してください"
  );
}
createRoot(el).render(<Gallery />);
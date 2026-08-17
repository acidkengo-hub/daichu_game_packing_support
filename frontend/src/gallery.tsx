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

import { createRoot } from "react-dom/client";
import "./index.css";
import MonsterSprite from "./MonsterSprite";
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

function Gallery() {
  const tiers: MonsterTier[] = [1, 2, 3];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <h1 className="text-xl font-bold text-emerald-400 mb-1">Monster Gallery（開発専用）</h1>
      <p className="text-xs text-gray-500 mb-6">
        本番ビルドには含まれません。shape-rendering="crispEdges" の効きと3面塗りを確認します。
      </p>

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
            <Cell key={platform} label={`${platform}\n${m.name}`}>
              <MonsterSprite shape={v.shape} palette={v.palette} tier={2} size={100} />
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
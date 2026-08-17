// src/MonsterSprite.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 抽象シェイプ8種のSVGスプライト
//
// 設計方針:
//  1. 実在ハードの外観には寄せない。幾何学的な図形の組み合わせのみ
//  2. shape-rendering="crispEdges" + 整数座標でドット絵的な硬さを出す
//  3. グラデーション禁止。light/base/dark の3面ベタ塗りで立体を表現する
//     （レトロ感が出るのと同時にiPadでの描画負荷も下がる）
//  4. アニメーションを含めない。外から className を受けて適用する
//     → 演出を変えるときにこのファイルを触らなくて済む
//
// 座標系: 64×64 のグリッド。地面は y=57 に置いている
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { Palette, ShapeKey, MonsterTier } from "./monsterDefinitions";

// ============================================================
// 共通パーツ
// ============================================================

/** 目。ボスと強敵は怒った形にする */
function Eyes({
  cx, cy, gap, palette, angry,
}: {
  cx: number; cy: number; gap: number; palette: Palette; angry: boolean;
}) {
  const half = gap / 2;
  return (
    <>
      {/* 白目にあたる部分。accent色を使うことで種族ごとの個性になる */}
      <rect x={cx - half - 5} y={cy} width={5} height={5} fill={palette.accent} />
      <rect x={cx + half} y={cy} width={5} height={5} fill={palette.accent} />
      {/* 瞳。2×2の小さな四角にするとドット絵らしくなる */}
      <rect x={cx - half - 4} y={cy + 2} width={2} height={2} fill="#0b0f19" />
      <rect x={cx + half + 2} y={cy + 2} width={2} height={2} fill="#0b0f19" />
      {/* 怒り眉。目の上に斜めの帯を置くだけで表情が変わる */}
      {angry && (
        <>
          <polygon
            points={`${cx - half - 6},${cy - 3} ${cx - half},${cy - 1} ${cx - half},${cy + 1} ${cx - half - 6},${cy - 1}`}
            fill="#0b0f19"
          />
          <polygon
            points={`${cx + half + 6},${cy - 3} ${cx + half},${cy - 1} ${cx + half},${cy + 1} ${cx + half + 6},${cy - 1}`}
            fill="#0b0f19"
          />
        </>
      )}
    </>
  );
}

/** 接地影。真下に細い帯を置くだけで「立っている」ように見える */
function Shadow({ w = 40 }: { w?: number }) {
  const x = 32 - w / 2;
  return <rect x={x} y={57} width={w} height={3} fill="#000000" opacity="0.35" />;
}

/** ランク2以上のトゲ。頭頂に三角を並べる */
function Spikes({ y, palette, count }: { y: number; palette: Palette; count: number }) {
  const items = [];
  const step = 10;
  const startX = 32 - ((count - 1) * step) / 2;
  for (let i = 0; i < count; i++) {
    const x = startX + i * step;
    items.push(
      <polygon key={i} points={`${x - 4},${y} ${x},${y - 7} ${x + 4},${y}`} fill={palette.dark} />
    );
  }
  return <>{items}</>;
}

/** ボスの冠。ギザギザの帯を頭上に置く */
function Crown({ y }: { y: number }) {
  return (
    <>
      <polygon
        points={`16,${y} 16,${y - 8} 22,${y - 3} 28,${y - 11} 32,${y - 3} 36,${y - 11} 42,${y - 3} 48,${y - 8} 48,${y}`}
        fill="#fbbf24"
      />
      <rect x={16} y={y} width={32} height={3} fill="#b45309" />
    </>
  );
}

/** ボスのオーラ。四隅に浮かぶ小さな四角。線を使わないのがレトロ流 */
function Aura() {
  const dots = [
    [6, 14], [56, 18], [4, 38], [58, 42], [10, 52], [52, 8],
  ];
  return (
    <>
      {dots.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={3} height={3} fill="#f87171" opacity="0.9" />
      ))}
    </>
  );
}

// ============================================================
// シェイプ8種
// 各関数は palette と angry だけを受け取り、本体だけを描く
// ============================================================

type ShapeProps = { p: Palette; angry: boolean };

/** 箱型: 正面・天面・側面の3面で立方体に見せる */
function BoxShape({ p, angry }: ShapeProps) {
  return (
    <>
      <polygon points="14,24 22,16 54,16 46,24" fill={p.light} />
      <polygon points="46,24 54,16 54,44 46,52" fill={p.dark} />
      <rect x={14} y={24} width={32} height={28} fill={p.base} />
      <rect x={18} y={44} width={24} height={3} fill={p.dark} />
      <Eyes cx={30} cy={32} gap={8} palette={p} angry={angry} />
    </>
  );
}

/** 薄板型: 高さを抑え、横に広い */
function SlabShape({ p, angry }: ShapeProps) {
  return (
    <>
      <polygon points="8,34 16,26 56,26 48,34" fill={p.light} />
      <polygon points="48,34 56,26 56,42 48,50" fill={p.dark} />
      <rect x={8} y={34} width={40} height={16} fill={p.base} />
      <rect x={12} y={44} width={28} height={2} fill={p.dark} />
      <Eyes cx={28} cy={37} gap={10} palette={p} angry={angry} />
    </>
  );
}

/** 円盤型: 円を3枚重ねてメディアらしさを出す */
function DiscShape({ p, angry }: ShapeProps) {
  return (
    <>
      <circle cx={32} cy={34} r={20} fill={p.dark} />
      <circle cx={32} cy={34} r={17} fill={p.base} />
      <circle cx={32} cy={34} r={9} fill={p.light} />
      <circle cx={32} cy={34} r={4} fill="#0b0f19" />
      <Eyes cx={32} cy={22} gap={14} palette={p} angry={angry} />
    </>
  );
}

/** 縦箱型: 縦に立つ。背が高いので影は小さめ */
function TowerShape({ p, angry }: ShapeProps) {
  return (
    <>
      <polygon points="22,14 28,8 46,8 40,14" fill={p.light} />
      <polygon points="40,14 46,8 46,50 40,56" fill={p.dark} />
      <rect x={22} y={14} width={18} height={42} fill={p.base} />
      <rect x={26} y={44} width={10} height={3} fill={p.dark} />
      <Eyes cx={31} cy={22} gap={4} palette={p} angry={angry} />
    </>
  );
}

/** 二つ折り型: 下半分と、奥に倒れた上蓋 */
function ClamshellShape({ p, angry }: ShapeProps) {
  return (
    <>
      {/* 上蓋。奥に倒れているので台形にする */}
      <polygon points="14,34 18,14 46,14 50,34" fill={p.dark} />
      <polygon points="18,32 21,17 43,17 46,32" fill={p.light} />
      {/* ヒンジ */}
      <rect x={12} y={34} width={40} height={4} fill={p.dark} />
      {/* 下半分 */}
      <rect x={12} y={38} width={40} height={14} fill={p.base} />
      <rect x={18} y={44} width={12} height={4} fill={p.dark} />
      <Eyes cx={32} cy={22} gap={10} palette={p} angry={angry} />
    </>
  );
}

/** 横長型: 中央に画面、左右にグリップ */
function HandheldShape({ p, angry }: ShapeProps) {
  return (
    <>
      <rect x={6} y={22} width={52} height={24} fill={p.base} />
      {/* 左右のグリップを暗い色で分ける */}
      <rect x={6} y={22} width={10} height={24} fill={p.dark} />
      <rect x={48} y={22} width={10} height={24} fill={p.dark} />
      <rect x={6} y={22} width={52} height={2} fill={p.light} />
      {/* 画面 */}
      <rect x={18} y={26} width={28} height={16} fill="#0b0f19" />
      <Eyes cx={32} cy={31} gap={8} palette={p} angry={angry} />
      {/* ボタンに見立てた四角 */}
      <rect x={9} y={32} width={4} height={4} fill={p.light} />
      <rect x={51} y={32} width={4} height={4} fill={p.light} />
    </>
  );
}

/** カートリッジ型: 下部に差し込み端子 */
function CartridgeShape({ p, angry }: ShapeProps) {
  return (
    <>
      <rect x={18} y={14} width={28} height={34} fill={p.base} />
      <rect x={18} y={14} width={28} height={3} fill={p.light} />
      <rect x={44} y={14} width={2} height={34} fill={p.dark} />
      {/* ラベル */}
      <rect x={22} y={19} width={20} height={13} fill={p.light} />
      {/* 端子 */}
      <rect x={22} y={48} width={20} height={6} fill={p.dark} />
      {[24, 28, 32, 36, 40].map((x) => (
        <rect key={x} x={x} y={48} width={2} height={6} fill={p.accent} />
      ))}
      <Eyes cx={32} cy={36} gap={8} palette={p} angry={angry} />
    </>
  );
}

/** 塊型: 分類不能なものに割り当てる不定形 */
function BlobShape({ p, angry }: ShapeProps) {
  return (
    <>
      <polygon points="14,52 10,36 16,20 32,12 48,20 54,36 50,52" fill={p.dark} />
      <polygon points="18,50 15,36 20,24 32,17 44,24 49,36 46,50" fill={p.base} />
      <polygon points="24,26 32,21 40,26 36,30 28,30" fill={p.light} />
      <Eyes cx={32} cy={34} gap={10} palette={p} angry={angry} />
    </>
  );
}

/** シェイプキー → 描画関数の対応表。Record にすることで定義漏れを型で防ぐ */
const SHAPE_RENDERERS: Record<ShapeKey, (props: ShapeProps) => React.ReactElement> = {
  box: BoxShape,
  slab: SlabShape,
  disc: DiscShape,
  tower: TowerShape,
  clamshell: ClamshellShape,
  handheld: HandheldShape,
  cartridge: CartridgeShape,
  blob: BlobShape,
};

/** シェイプごとの接地影の幅と、装飾を置くY座標 */
const SHAPE_METRICS: Record<ShapeKey, { shadowW: number; topY: number }> = {
  box: { shadowW: 40, topY: 16 },
  slab: { shadowW: 46, topY: 26 },
  disc: { shadowW: 38, topY: 14 },
  tower: { shadowW: 26, topY: 8 },
  clamshell: { shadowW: 42, topY: 14 },
  handheld: { shadowW: 50, topY: 22 },
  cartridge: { shadowW: 30, topY: 14 },
  blob: { shadowW: 42, topY: 12 },
};

// ============================================================
// 公開コンポーネント
// ============================================================

export type MonsterSpriteProps = {
  shape: ShapeKey;
  palette: Palette;
  tier: MonsterTier;
  isBoss?: boolean;
  /** 表示サイズ(px)。SVG内部は常に64×64で描き、外側で拡大する */
  size?: number;
  /** アニメーション用。演出はここから外部から与える */
  className?: string;
};

/**
 * モンスター1体を描画する。
 *
 * 内部座標を64×64に固定し、表示サイズは width/height で変える。
 * こうすると全シェイプの見た目の比率が揃い、
 * どのサイズで出しても崩れない。
 */
export default function MonsterSprite({
  shape, palette, tier, isBoss = false, size = 180, className = "",
}: MonsterSpriteProps) {
  // 未定義のシェイプが来ても落とさず blob で代替する（実行時の防御）
  const Renderer = SHAPE_RENDERERS[shape];
  if (!Renderer) {
    console.warn(
      `[MonsterSprite] 未定義のシェイプ: "${shape}"\n` +
      `　→ MonsterSprite.tsx の SHAPE_RENDERERS に追加してください`
    );
  }
  const SafeRenderer = Renderer ?? BlobShape;
  const metrics = SHAPE_METRICS[shape] ?? SHAPE_METRICS.blob;

  // ボスと強敵は怒り顔にする
  const angry = isBoss || tier === 3;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      // ★アンチエイリアスを切る。これがレトロ感の要
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {isBoss && <Aura />}
      <Shadow w={metrics.shadowW} />
      <SafeRenderer p={palette} angry={angry} />
      {/* 装飾は本体の後に重ねる。描画順が前後関係になる */}
      {tier === 2 && !isBoss && <Spikes y={metrics.topY} palette={palette} count={2} />}
      {tier === 3 && !isBoss && <Spikes y={metrics.topY} palette={palette} count={3} />}
      {isBoss && <Crown y={metrics.topY - 2} />}
    </svg>
  );
}
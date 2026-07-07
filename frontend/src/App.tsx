// src/App.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DAICHU Game Packing Support — メインUI
// フェーズ: home → picking → packing → complete
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useCallback, useMemo, useRef } from "react";
import { parseCSV, type ParsedData, type CarrierData, type PickingItem, type Order } from "./parsers";
import { type Platform, PLATFORMS, needsTouchPenAlert, POKEMON_BATTERY_GROUP } from "./platformDetector";
import { findSetDefinition } from "./setDefinitions";
import { getSetImageUrl } from "./imageMapping";
import SettingsScreen from "./SettingsScreen";

// ============================================================
// フェーズ型
// ============================================================

type Phase =
  | "home"
  | "picking"
  | "pickingSummary"
  | "packing"
  | "packingSummary"
  | "settings";

// ============================================================
// 型番ハイライト
// PS2/PS3/PS4/PS5の型番をテキストから検出し、強調表示するJSXを返す
// ============================================================

function renderWithModelHighlight(text: string): React.ReactNode {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /(SCPH-\d{4,5}[A-Z]?|CECH[A-Z]\d{2,3}|CECH-\d{4,5}[A-Z]?|CUH-\d{4,5}[A-Z]?|CFI-\d{4,5}[A-Z]?\d{0,2}|CFH-\d{4,5}[A-Z]?\d{0,2})/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // マッチ前のテキスト
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    // ハイライトされた型番
    result.push(
      <span key={match.index} className="bg-yellow-400 text-gray-900 font-bold px-1 mx-0.5 rounded text-sm">
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  // 残りのテキスト
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : text;
}

// ============================================================
// App
// ============================================================

export default function App() {
  // --- 状態 ---
  const [phase, setPhase] = useState<Phase>("home");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<"takkyubin" | "nekopos" | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // ピッキング
  const [pickingChecked, setPickingChecked] = useState<Record<string, boolean>>({});
  const [pickingViewMode, setPickingViewMode] = useState<"list" | "card">("list");
  const [currentPlatformIdx, setCurrentPlatformIdx] = useState(0);
  // 梱包
  const [currentPackingIdx, setCurrentPackingIdx] = useState(0);
  const [packingSetChecked, setPackingSetChecked] = useState<Record<string, Record<string, boolean>>>({});
  // 画像モーダル
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 現在のキャリアデータ ---
  const carrierData: CarrierData | null = useMemo(() => {
    if (!parsedData || !selectedCarrier) return null;
    return parsedData[selectedCarrier];
  }, [parsedData, selectedCarrier]);

  // --- ピッキング進捗 ---
  const pickingProgress = useMemo(() => {
    if (!carrierData) return { done: 0, total: 0 };
    const total = carrierData.pickingItems.length;
    const done = carrierData.pickingItems.filter((item) => pickingChecked[item.name]).length;
    return { done, total };
  }, [carrierData, pickingChecked]);

  // --- 梱包進捗 ---
  const currentOrder: Order | null = useMemo(() => {
    if (!carrierData || currentPackingIdx >= carrierData.orders.length) return null;
    return carrierData.orders[currentPackingIdx];
  }, [carrierData, currentPackingIdx]);

  // ============================================================
  // ハンドラ
  // ============================================================

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError("");

    try {
      const data = await parseCSV(file);
      setParsedData(data);
      setPhase("home"); // キャリア選択へ
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CSV解析に失敗しました。";
      setError(msg);
      console.error("[App] CSV解析エラー:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCarrierSelect = useCallback((carrier: "takkyubin" | "nekopos") => {
    setSelectedCarrier(carrier);
    setPickingChecked({});
    setCurrentPackingIdx(0);
    setPackingSetChecked({});
    setPhase("picking");
  }, []);

  const handlePickingToggle = useCallback((itemName: string) => {
    setPickingChecked((prev) => ({ ...prev, [itemName]: !prev[itemName] }));
  }, []);

  const handlePickingComplete = useCallback(() => {
    setPhase("pickingSummary");
  }, []);

  const handleStartPacking = useCallback(() => {
    setCurrentPackingIdx(0);
    setPackingSetChecked({});
    setPhase("packing");
  }, []);

  const handlePackingSetToggle = useCallback((mgmtNo: string, compName: string) => {
    setPackingSetChecked((prev) => {
      const orderMap = { ...(prev[mgmtNo] || {}) };
      orderMap[compName] = !orderMap[compName];
      return { ...prev, [mgmtNo]: orderMap };
    });
  }, []);

  const handleNextOrder = useCallback(() => {
    if (!carrierData) return;
    const nextIdx = currentPackingIdx + 1;
    if (nextIdx >= carrierData.orders.length) {
      setPhase("packingSummary");
    } else {
      setCurrentPackingIdx(nextIdx);
    }
  }, [carrierData, currentPackingIdx]);

  const handleReset = useCallback(() => {
    setParsedData(null);
    setSelectedCarrier(null);
    setPickingChecked({});
    setCurrentPackingIdx(0);
    setPackingSetChecked({});
    setError("");
    setPhase("home");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ============================================================
  // 設定画面
  // ============================================================

  if (phase === "settings") {
    return <SettingsScreen onClose={() => setPhase("home")} />;
  }

  // ============================================================
  // ホーム画面（CSVアップロード + キャリア選択）
  // ============================================================

  if (phase === "home") {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        {/* ヘッダ */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-emerald-400">
            🎮 GAME PACKING SUPPORT
          </h1>
          <button
            onClick={() => setPhase("settings")}
            className="text-gray-400 hover:text-white px-3 py-2 min-h-[44px]"
          >
            ⚙ 設定
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-[780px] mx-auto w-full">
          {/* CSVアップロード */}
          {!parsedData && (
            <div className="w-full mb-8">
              <p className="text-gray-400 text-center mb-4">
                CROSS MALL 注文詳細CSVをアップロード
              </p>
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-gray-700 hover:border-emerald-500 
                                rounded-2xl p-8 text-center transition-colors">
                  <p className="text-2xl mb-2">📄</p>
                  <p className="text-gray-300 text-lg">
                    {isLoading ? "解析中..." : "タップしてCSVを選択"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
              {error && (
                <p className="mt-4 text-red-400 text-center text-sm">{error}</p>
              )}
            </div>
          )}

          {/* キャリア選択 */}
          {parsedData && (
            <div className="w-full">
              <p className="text-gray-400 text-center mb-6">配送方法を選択してください</p>
              <div className="space-y-4">
                {/* 宅急便 */}
                <button
                  onClick={() => handleCarrierSelect("takkyubin")}
                  disabled={parsedData.takkyubin.totalOrders === 0}
                  className={`w-full rounded-2xl p-6 text-left transition-all min-h-[80px] ${
                    parsedData.takkyubin.totalOrders > 0
                      ? "bg-blue-950 border-2 border-blue-700 hover:border-blue-500"
                      : "bg-gray-900 border-2 border-gray-800 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <p className="text-xl font-bold text-blue-300">📦 ヤマト宅急便</p>
                  <p className="text-gray-400 mt-1">
                    {parsedData.takkyubin.totalOrders}件 ／ ピッキング{parsedData.takkyubin.pickingItems.length}種
                  </p>
                </button>

                {/* ネコポス */}
                <button
                  onClick={() => handleCarrierSelect("nekopos")}
                  disabled={parsedData.nekopos.totalOrders === 0}
                  className={`w-full rounded-2xl p-6 text-left transition-all min-h-[80px] ${
                    parsedData.nekopos.totalOrders > 0
                      ? "bg-amber-950 border-2 border-amber-700 hover:border-amber-500"
                      : "bg-gray-900 border-2 border-gray-800 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <p className="text-xl font-bold text-amber-300">✉️ ヤマトネコポス</p>
                  <p className="text-gray-400 mt-1">
                    {parsedData.nekopos.totalOrders}件 ／ ピッキング{parsedData.nekopos.pickingItems.length}種
                  </p>
                </button>
              </div>

              <button
                onClick={handleReset}
                className="w-full mt-6 text-gray-500 hover:text-gray-300 py-3 text-sm min-h-[48px]"
              >
                CSVを読み直す
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // ピッキング画面（プラットフォーム別グルーピング）
  // ============================================================

  if (phase === "picking" && carrierData) {
    // プラットフォーム別にグルーピング
    const platformGroups = new Map<Platform, PickingItem[]>();
    for (const item of carrierData.pickingItems) {
      const group = platformGroups.get(item.platform) || [];
      group.push(item);
      platformGroups.set(item.platform, group);
    }

    // プラットフォーム順でソートされた配列
    const sortedPlatforms = Array.from(platformGroups.keys()).sort((a, b) => {
      const idxA = PLATFORMS.indexOf(a);
      const idxB = PLATFORMS.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    const allChecked = pickingProgress.done === pickingProgress.total && pickingProgress.total > 0;

    // カードモード用: 現在表示中のプラットフォーム
    const safeIdx = Math.min(currentPlatformIdx, sortedPlatforms.length - 1);
    const currentPlatform = sortedPlatforms[safeIdx];
    const currentItems = currentPlatform ? platformGroups.get(currentPlatform) || [] : [];
    const cardGroupDone = currentItems.filter((i) => pickingChecked[i.name]).length;

    // ---- チェックボックス行の共通レンダー ----
    const renderPickingItem = (item: PickingItem) => {
      const checked = !!pickingChecked[item.name];
      return (
        <button
          key={item.name}
          onClick={() => handlePickingToggle(item.name)}
          className={`w-full flex items-center gap-3 rounded-xl p-4 text-left 
                      transition-all min-h-[60px] ${
            checked
              ? "bg-gray-900/50 border border-gray-800"
              : "bg-gray-900 border border-gray-700 hover:border-emerald-600"
          }`}
        >
          <div className={`w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 ${
            checked ? "bg-emerald-600 border-emerald-500" : "border-gray-600"
          }`}>
            {checked && <span className="text-white text-sm">✓</span>}
          </div>
          <div className={`flex-1 min-w-0 ${checked ? "opacity-40" : ""}`}>
            <p className={`text-base break-words ${checked ? "line-through" : "font-medium"}`}>
              {renderWithModelHighlight(item.name)}
            </p>
            {item.sources.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5 break-words">
                {item.sources.join(" + ")}
              </p>
            )}
          </div>
          <span className={`text-xl font-bold shrink-0 ${
            checked ? "text-gray-600" : "text-emerald-400"
          }`}>
            ×{item.totalQty}
          </span>
        </button>
      );
    };

    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        {/* ヘッダ */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-[780px] mx-auto">
            <div className="flex items-center justify-between">
              <button onClick={() => { setSelectedCarrier(null); setPhase("home"); }} className="text-gray-400 hover:text-white min-h-[44px] px-2">
                ← 戻る
              </button>
              <h2 className="font-bold text-emerald-400">ピッキング ─ {carrierData.label}</h2>
              <span className="text-sm text-gray-400">
                {pickingProgress.done}/{pickingProgress.total}
              </span>
            </div>
            {/* プログレスバー + ビュー切替 */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${pickingProgress.total > 0 ? (pickingProgress.done / pickingProgress.total) * 100 : 0}%` }}
                />
              </div>
              <button
                onClick={() => {
                  setPickingViewMode((m) => (m === "list" ? "card" : "list"));
                  setCurrentPlatformIdx(0);
                }}
                className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded min-h-[32px]"
              >
                {pickingViewMode === "list" ? "📇 カード" : "📋 一覧"}
              </button>
            </div>
          </div>
        </header>

        {/* ===== 一覧モード ===== */}
        {pickingViewMode === "list" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-[780px] mx-auto space-y-6 pt-1">
              {sortedPlatforms.map((platform) => {
                const items = platformGroups.get(platform)!;
                const groupDone = items.filter((i) => pickingChecked[i.name]).length;
                const groupTotal = items.length;
                const isPokemonGroup = platform === POKEMON_BATTERY_GROUP;
                return (
                  <div key={platform}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                        isPokemonGroup
                          ? "bg-yellow-700 text-yellow-100"
                          : "bg-emerald-800 text-emerald-200"
                      }`}>
                        {isPokemonGroup ? "⚡ " : ""}{platform}
                      </span>
                      <span className="text-gray-500 text-sm">{groupDone}/{groupTotal}</span>
                      {groupDone === groupTotal && groupTotal > 0 && (
                        <span className="text-emerald-400 text-sm">✓</span>
                      )}
                    </div>
                    {isPokemonGroup && (
                      <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-3 mb-2 text-sm text-yellow-300">
                        ⚡ こちらの商品はピッキングしたのちにまとめて電池交換してください
                      </div>
                    )}
                    <div className="space-y-1">
                      {items.map(renderPickingItem)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== カードモード ===== */}
        {pickingViewMode === "card" && currentPlatform && (
          <div className="flex-1 flex flex-col p-4">
            <div className="max-w-[780px] mx-auto w-full flex-1 flex flex-col">
              {/* プラットフォームナビ */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentPlatformIdx((i) => Math.max(0, i - 1))}
                  disabled={safeIdx === 0}
                  className={`px-4 py-2 rounded-lg text-lg font-bold min-h-[48px] min-w-[60px] ${
                    safeIdx === 0
                      ? "bg-gray-900 text-gray-700 cursor-not-allowed"
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  }`}
                >
                  ‹
                </button>

                <div className="text-center flex-1">
                  <span className={`px-4 py-2 rounded-xl text-xl font-bold ${
                    currentPlatform === POKEMON_BATTERY_GROUP
                      ? "bg-yellow-700 text-yellow-100"
                      : "bg-emerald-700 text-emerald-100"
                  }`}>
                    {currentPlatform === POKEMON_BATTERY_GROUP ? "⚡ " : ""}{currentPlatform}
                  </span>
                  <p className="text-gray-500 text-sm mt-1">
                    {safeIdx + 1}/{sortedPlatforms.length} プラットフォーム ─ {cardGroupDone}/{currentItems.length}
                    {cardGroupDone === currentItems.length && currentItems.length > 0 && " ✓"}
                  </p>
                </div>

                <button
                  onClick={() => setCurrentPlatformIdx((i) => Math.min(sortedPlatforms.length - 1, i + 1))}
                  disabled={safeIdx >= sortedPlatforms.length - 1}
                  className={`px-4 py-2 rounded-lg text-lg font-bold min-h-[48px] min-w-[60px] ${
                    safeIdx >= sortedPlatforms.length - 1
                      ? "bg-gray-900 text-gray-700 cursor-not-allowed"
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  }`}
                >
                  ›
                </button>
              </div>

              {/* カード内アイテム */}
              {currentPlatform === POKEMON_BATTERY_GROUP && (
                <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-3 mb-2 text-sm text-yellow-300">
                  ⚡ こちらの商品はピッキングしたのちにまとめて電池交換してください
                </div>
              )}
              <div className="flex-1 overflow-y-auto space-y-1">
                {currentItems.map(renderPickingItem)}
              </div>
            </div>
          </div>
        )}

        {/* 底部ボタン（常に表示） */}
        <div className="sticky bottom-0 bg-gray-950 border-t border-gray-800 p-4">
          <div className="max-w-[780px] mx-auto space-y-2">
            {allChecked ? (
              <button
                onClick={handlePickingComplete}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 
                           rounded-xl text-lg font-bold min-h-[56px] transition-colors"
              >
                ピッキング完了 → 梱包へ
              </button>
            ) : (
              <button
                onClick={handlePickingComplete}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 
                           rounded-xl text-base min-h-[48px] transition-colors"
              >
                梱包へスキップ（{pickingProgress.done}/{pickingProgress.total}）
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // ピッキング完了サマリー
  // ============================================================

  if (phase === "pickingSummary" && carrierData) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-[780px] w-full text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-2xl font-bold text-emerald-400 mb-2">ピッキング完了</h2>
          <p className="text-gray-400 mb-2">
            {carrierData.label} ─ {carrierData.pickingItems.length}種のアイテムをピッキングしました
          </p>
          <p className="text-gray-500 text-sm mb-8">
            次に {carrierData.totalOrders}件の注文を1件ずつ梱包します
          </p>
          <button
            onClick={handleStartPacking}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 
                       rounded-xl text-lg font-bold min-h-[56px]"
          >
            梱包を開始（{carrierData.totalOrders}件）
          </button>
          <button
            onClick={handleReset}
            className="w-full mt-3 text-gray-500 hover:text-gray-300 py-3 text-sm min-h-[48px]"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // 梱包画面（1注文ずつ）
  // ============================================================

  // Image modal for all phases
  const imageModalEl = imageModalUrl ? (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={() => setImageModalUrl(null)}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setImageModalUrl(null)}
          className="absolute -top-3 -right-3 bg-gray-700 hover:bg-gray-600 text-white 
                     w-10 h-10 rounded-full text-xl z-10 flex items-center justify-center"
        >
          ✕
        </button>
        <img
          src={imageModalUrl}
          alt="商品画像"
          className="max-w-full max-h-[85vh] rounded-xl object-contain"
          onError={(e) => { (e.target as HTMLImageElement).alt = "画像の読み込みに失敗"; }}
        />
      </div>
    </div>
  ) : null;

  if (phase === "packing" && carrierData && currentOrder) {
    const mgmtNo = currentOrder.mgmtNo;
    const orderChecks = packingSetChecked[mgmtNo] || {};

    // 全商品のセットチェックリストを構築
    const allCheckItems: { label: string; key: string; isAlert?: boolean; index?: number; total?: number }[] = [];

    // 梱包時アラートを収集 → チェック項目として追加
    for (const product of currentOrder.products) {
      for (const alert of product.packingAlerts) {
        const alertKey = `alert_${alert}`;
        if (!allCheckItems.some((item) => item.key === alertKey)) {
          allCheckItems.push({ label: alert, key: alertKey, isAlert: true });
        }
      }
      if (product.isSet && needsTouchPenAlert(product.platform)) {
        const tpAlert = "本体にタッチペンは付属していますか？";
        const tpKey = `alert_${tpAlert}`;
        if (!allCheckItems.some((item) => item.key === tpKey)) {
          allCheckItems.push({ label: tpAlert, key: tpKey, isAlert: true });
        }
      }
    }

    for (const product of currentOrder.products) {
      if (product.isSet && product.setComponents.length > 0) {
        for (const comp of product.setComponents) {
          const totalCount = comp.qty * product.qty;
          for (let i = 0; i < totalCount; i++) {
            const key = `${product.code}_${comp.name}_${i}`;
            allCheckItems.push({
              label: comp.name,
              key,
              index: totalCount > 1 ? i + 1 : undefined,
              total: totalCount > 1 ? totalCount : undefined,
            });
          }
        }
      } else {
        const totalCount = product.qty;
        for (let i = 0; i < totalCount; i++) {
          const key = `${product.code}_single_${i}`;
          allCheckItems.push({
            label: product.shortName || product.name,
            key,
            index: totalCount > 1 ? i + 1 : undefined,
            total: totalCount > 1 ? totalCount : undefined,
          });
        }
      }
    }

    const allItemsChecked =
      allCheckItems.length > 0 &&
      allCheckItems.every((item) => !!orderChecks[item.key]);

    return (
      <>
      {imageModalEl}
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        {/* ヘッダ */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-[780px] mx-auto">
            <div className="flex items-center justify-between">
              <button onClick={() => setPhase("pickingSummary")} className="text-gray-400 hover:text-white min-h-[44px] px-2">
                ← 戻る
              </button>
              <h2 className="font-bold text-blue-400">
                梱包 {currentPackingIdx + 1}/{carrierData.orders.length}
              </h2>
              <span className="text-sm text-gray-400">{carrierData.label}</span>
            </div>
            {/* プログレスバー */}
            <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${((currentPackingIdx + 1) / carrierData.orders.length) * 100}%` }}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[780px] mx-auto">
            {/* 宛先情報 */}
            <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
              <p className="text-lg font-bold">{currentOrder.recipientName} 様</p>
              <p className="text-sm text-gray-400 mt-1">
                〒{currentOrder.recipientPostal} {currentOrder.recipientAddr}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {currentOrder.shopName} ─ 管理番号: {currentOrder.mgmtNo}
              </p>
              {currentOrder.deliveryDate && (
                <p className="text-sm text-amber-400 mt-1">
                  📅 配送希望日: {currentOrder.deliveryDate}
                </p>
              )}
            </div>

            {/* アラート（チェック付き） */}
            {allCheckItems.filter((item) => item.isAlert).length > 0 && (
              <div className="bg-amber-950 border border-amber-700 rounded-xl overflow-hidden mb-4">
                {allCheckItems
                  .filter((item) => item.isAlert)
                  .map((item) => {
                    const checked = !!orderChecks[item.key];
                    return (
                      <button
                        key={item.key}
                        onClick={() => handlePackingSetToggle(mgmtNo, item.key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-amber-800 
                                    last:border-b-0 min-h-[56px] transition-colors ${
                          checked ? "bg-amber-950/50" : "hover:bg-amber-900/50"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                          checked ? "bg-amber-500 border-amber-400" : "border-amber-600"
                        }`}>
                          {checked && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className={`flex-1 text-sm ${checked ? "line-through text-amber-700" : "text-amber-300"}`}>
                          ⚠️ {item.label}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* 商品ごとのセクション */}
            {currentOrder.products.map((product, pIdx) => (
              <div key={`${product.code}_${pIdx}`} className="mb-4">
                {/* 商品ヘッダ — カラー・数量・画像ボタン */}
                <div className="bg-gray-900 rounded-t-xl p-3 border border-gray-800 border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-base break-words flex-1">{renderWithModelHighlight(product.shortName || product.name)}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const setDef = findSetDefinition(product.code);
                        const imgUrl = setDef ? getSetImageUrl(setDef.id) : null;
                        return imgUrl ? (
                          <button
                            onClick={() => setImageModalUrl(imgUrl)}
                            className="bg-blue-800 hover:bg-blue-700 text-white px-2 py-1 rounded-lg text-sm min-h-[36px]"
                          >
                            📷
                          </button>
                        ) : null;
                      })()}
                      {product.qty > 1 && (
                        <span className="bg-red-600 text-white text-lg font-bold px-3 py-1 rounded-lg">
                          ×{product.qty}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{product.code}</p>
                  {product.attr1 && (
                    <p className="text-base text-amber-300 font-bold mt-1">
                      カラー: {product.attr1}
                    </p>
                  )}
                  {product.attr2 && (
                    <p className="text-sm text-gray-400">{product.attr2}</p>
                  )}
                  {product.isSet && (
                    <span className="inline-block mt-1 text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded">
                      セット商品
                    </span>
                  )}
                </div>

                {/* チェックリスト */}
                <div className="border border-gray-800 rounded-b-xl overflow-hidden">
                  {allCheckItems
                    .filter((item) => !item.isAlert && item.key.startsWith(`${product.code}_`))
                    .map((item) => {
                      const checked = !!orderChecks[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => handlePackingSetToggle(mgmtNo, item.key)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-800 
                                      last:border-b-0 min-h-[56px] transition-colors ${
                            checked ? "bg-gray-900/50" : "bg-gray-900 hover:bg-gray-800"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                            checked ? "bg-blue-600 border-blue-500" : "border-gray-600"
                          }`}>
                            {checked && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className={`flex-1 break-words ${checked ? "line-through text-gray-600" : "text-gray-200"}`}>
                            {item.label}
                          </span>
                          {item.total && (
                            <span className={`shrink-0 text-sm font-bold px-2 py-0.5 rounded ${
                              checked ? "bg-gray-800 text-gray-600" : "bg-blue-900 text-blue-300"
                            }`}>
                              {item.index}/{item.total}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 次へボタン */}
        {allItemsChecked && (
          <div className="sticky bottom-0 bg-gray-950 border-t border-gray-800 p-4">
            <div className="max-w-[780px] mx-auto">
              <button
                onClick={handleNextOrder}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 
                           rounded-xl text-lg font-bold min-h-[56px]"
              >
                {currentPackingIdx + 1 < carrierData.orders.length
                  ? `梱包完了 → 次の注文 (${currentPackingIdx + 2}/${carrierData.orders.length})`
                  : "梱包完了 → 全注文完了"}
              </button>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // ============================================================
  // 梱包完了サマリー
  // ============================================================

  if (phase === "packingSummary" && carrierData) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-[780px] w-full text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h2 className="text-2xl font-bold text-blue-400 mb-2">全注文の梱包が完了しました</h2>
          <p className="text-gray-400 mb-8">
            {carrierData.label} ─ {carrierData.totalOrders}件
          </p>

          <div className="space-y-3">
            {/* 別キャリアがあればそちらへ */}
            {parsedData && selectedCarrier === "takkyubin" && parsedData.nekopos.totalOrders > 0 && (
              <button
                onClick={() => handleCarrierSelect("nekopos")}
                className="w-full bg-amber-700 hover:bg-amber-600 text-white py-4 
                           rounded-xl text-lg font-bold min-h-[56px]"
              >
                ✉️ ネコポス（{parsedData.nekopos.totalOrders}件）を開始
              </button>
            )}
            {parsedData && selectedCarrier === "nekopos" && parsedData.takkyubin.totalOrders > 0 && (
              <button
                onClick={() => handleCarrierSelect("takkyubin")}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white py-4 
                           rounded-xl text-lg font-bold min-h-[56px]"
              >
                📦 宅急便（{parsedData.takkyubin.totalOrders}件）を開始
              </button>
            )}
            <button
              onClick={handleReset}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-4 
                         rounded-xl text-lg min-h-[56px]"
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 画像モーダル（全フェーズで表示可能）
  // ============================================================

  const imageModal = imageModalUrl && (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={() => setImageModalUrl(null)}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setImageModalUrl(null)}
          className="absolute -top-3 -right-3 bg-gray-700 hover:bg-gray-600 text-white 
                     w-10 h-10 rounded-full text-xl z-10 flex items-center justify-center"
        >
          ✕
        </button>
        <img
          src={imageModalUrl}
          alt="商品画像"
          className="max-w-full max-h-[85vh] rounded-xl object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "";
            (e.target as HTMLImageElement).alt = "画像の読み込みに失敗しました";
          }}
        />
      </div>
    </div>
  );

  // ============================================================
  // フォールバック
  // ============================================================

  return (
    <>
      {imageModal}
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">予期しない状態です</p>
          <button
            onClick={handleReset}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl min-h-[48px]"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </>
  );
}
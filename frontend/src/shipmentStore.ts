// src/shipmentStore.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 午前便/午後便のセッション管理
// - localStorage永続化（日付が変わったら自動リセット）
// - 管理番号の差集合による午後便の差分検出
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { buildPickingItems, type ParsedData, type CarrierData, type Order } from "./parsers";

// ============================================================
// 型定義
// ============================================================

/** 便の種別（将来「夕方便」等を追加する場合はここに足す） */
export type ShipmentSlot = "morning" | "afternoon";

/** 便のラベル */
export const SLOT_LABELS: Record<ShipmentSlot, string> = {
  morning: "午前便",
  afternoon: "午後便",
};

/** 便のアイコン */
export const SLOT_ICONS: Record<ShipmentSlot, string> = {
  morning: "🌅",
  afternoon: "🌇",
};

/** 1便分のデータ + 作業進捗 */
export type ShipmentSession = {
  slot: ShipmentSlot;
  /** アップロード日時（ISO文字列） */
  uploadedAt: string;
  /** この便に含まれる管理番号 */
  mgmtNos: string[];
  /** 注文データ（キャリア別） */
  data: ParsedData;
  /** ピッキングのチェック状態: キャリア → アイテム名 → チェック済み */
  pickingChecked: Record<string, Record<string, boolean>>;
  /** 梱包のチェック状態: 管理番号 → チェックキー → チェック済み */
  packingSetChecked: Record<string, Record<string, boolean>>;
  /** 梱包の現在位置: キャリア → インデックス */
  packingIdx: Record<string, number>;
};

/** 1日分の作業単位 */
export type WorkDay = {
  /** "2026-07-08" 形式 */
  date: string;
  morning: ShipmentSession | null;
  afternoon: ShipmentSession | null;
};

// ============================================================
// localStorage 永続化
// ============================================================

const STORAGE_KEY = "game-packing-workday";

/** 今日の日付を "YYYY-MM-DD" 形式で取得 */
export function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * localStorageから作業データを復元。
 * 日付が今日と異なる場合は null を返す（前日データは破棄）。
 */
export function loadWorkDay(): WorkDay | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as WorkDay;

    // 日付が変わっていたら破棄
    if (parsed.date !== todayString()) {
      console.log(`[shipmentStore] 日付が変わったためデータをリセット (${parsed.date} → ${todayString()})`);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // 後方互換: 新しいフィールドが無い場合の補完
    for (const slot of ["morning", "afternoon"] as const) {
      const session = parsed[slot];
      if (session) {
        session.pickingChecked = session.pickingChecked ?? {};
        session.packingSetChecked = session.packingSetChecked ?? {};
        session.packingIdx = session.packingIdx ?? {};
        session.mgmtNos = session.mgmtNos ?? [];
      }
    }

    return parsed;
  } catch (err) {
    console.error("[shipmentStore] 読み込みエラー:", err);
    return null;
  }
}

/** 作業データを保存 */
export function saveWorkDay(workDay: WorkDay): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workDay));
  } catch (err) {
    // 容量超過の可能性がある（QuotaExceededError）
    console.error("[shipmentStore] 保存エラー:", err);
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      console.error("[shipmentStore] localStorageの容量制限に達しました。");
    }
  }
}

/** 全データを削除（「新しい日を開始」用） */
export function clearWorkDay(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("[shipmentStore] 削除エラー:", err);
  }
}

// ============================================================
// 管理番号の収集と差分検出
// ============================================================

/** ParsedData から全管理番号を収集 */
export function collectMgmtNos(data: ParsedData): string[] {
  const nos = new Set<string>();
  for (const carrier of [data.takkyubin, data.nekopos]) {
    for (const order of carrier.orders) {
      nos.add(order.mgmtNo);
    }
  }
  return Array.from(nos);
}

/**
 * 指定した注文だけを含む CarrierData を再構築。
 * ピッキングリストは残った注文から再集計する。
 */
function rebuildCarrierData(original: CarrierData, keepOrders: Order[]): CarrierData {
  const pickingItems = buildPickingItems(keepOrders);
  return {
    label: original.label,
    orders: keepOrders,
    pickingItems,
    totalPickingQty: pickingItems.reduce((sum, item) => sum + item.totalQty, 0),
    totalOrders: keepOrders.length,
  };
}

/**
 * 新しくアップロードされたCSVから、既存の管理番号に無い注文だけを抽出。
 * 午後便の差分検出に使用する。
 *
 * @param newData 新しくアップロードされたCSVのパース結果（全件）
 * @param existingMgmtNos 既に登録済みの管理番号
 * @returns 新規注文のみを含む ParsedData と、その件数
 */
export function extractNewOrders(
  newData: ParsedData,
  existingMgmtNos: string[]
): { data: ParsedData; newOrderCount: number; newMgmtNos: string[] } {
  const existing = new Set(existingMgmtNos);
  const newMgmtNos: string[] = [];

  const filterCarrier = (carrier: CarrierData): CarrierData => {
    const keepOrders = carrier.orders.filter((order) => {
      const isNew = !existing.has(order.mgmtNo);
      if (isNew && !newMgmtNos.includes(order.mgmtNo)) {
        newMgmtNos.push(order.mgmtNo);
      }
      return isNew;
    });
    return rebuildCarrierData(carrier, keepOrders);
  };

  const data: ParsedData = {
    takkyubin: filterCarrier(newData.takkyubin),
    nekopos: filterCarrier(newData.nekopos),
  };

  const newOrderCount = data.takkyubin.totalOrders + data.nekopos.totalOrders;

  console.log(
    `[shipmentStore] 差分検出: 新規${newOrderCount}件 ` +
    `(宅急便${data.takkyubin.totalOrders}件 / ネコポス${data.nekopos.totalOrders}件)`
  );

  return { data, newOrderCount, newMgmtNos };
}

// ============================================================
// セッション生成ヘルパー
// ============================================================

/** 新しい便セッションを作成 */
export function createSession(
  slot: ShipmentSlot,
  data: ParsedData,
  mgmtNos: string[]
): ShipmentSession {
  return {
    slot,
    uploadedAt: new Date().toISOString(),
    mgmtNos,
    data,
    pickingChecked: {},
    packingSetChecked: {},
    packingIdx: {},
  };
}

/** 空の作業日データを作成 */
export function createWorkDay(): WorkDay {
  return {
    date: todayString(),
    morning: null,
    afternoon: null,
  };
}

// ============================================================
// 進捗サマリー（ホーム画面の表示用）
// ============================================================

export type SessionProgress = {
  totalOrders: number;
  /** ピッキング: 全キャリア合計の チェック済み / 総数 */
  pickingDone: number;
  pickingTotal: number;
  /** 梱包: 完了した注文数 */
  packingDone: number;
  packingTotal: number;
};

/** セッションの進捗を集計 */
export function getSessionProgress(session: ShipmentSession): SessionProgress {
  let pickingDone = 0;
  let pickingTotal = 0;
  let packingDone = 0;

  for (const carrierKey of ["takkyubin", "nekopos"] as const) {
    const carrier = session.data[carrierKey];
    const checked = session.pickingChecked[carrierKey] ?? {};

    pickingTotal += carrier.pickingItems.length;
    pickingDone += carrier.pickingItems.filter((item) => checked[item.name]).length;

    // 梱包位置から完了数を推定
    packingDone += session.packingIdx[carrierKey] ?? 0;
  }

  const totalOrders = session.data.takkyubin.totalOrders + session.data.nekopos.totalOrders;

  return {
    totalOrders,
    pickingDone,
    pickingTotal,
    packingDone,
    packingTotal: totalOrders,
  };
}
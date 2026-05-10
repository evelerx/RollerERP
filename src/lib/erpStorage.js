const LOCAL_STORAGE_KEY = "roller_erp_v4";
const PRIMARY_RECORD_ID = "main";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const ERP_STATE_ENDPOINT = `${API_BASE_URL}/api/erp-state/${PRIMARY_RECORD_ID}`;
const REMOTE_TIMEOUT_MS = 8000;

const DEMO_ORDER_IDS = new Set([
  "ORD-001","ORD-002","ORD-003","ORD-004","ORD-005","ORD-006","ORD-007",
  "ORD-008","ORD-009","ORD-010","ORD-011","ORD-012","ORD-013",
]);
const DEMO_RAW_IDS = new Set([
  "RM-001","RM-002","RM-003","RM-004","RM-005","RM-006","RM-007","RM-008","RM-009","RM-010","RM-011",
]);
const DEMO_CLIENT_IDS = new Set([
  "C001","C002","C003","C004","C005","C006","C007","C008",
]);
const createEmptyState = () => ({
  sizes: [],
  orders: [],
  rawMaterials: [],
  inventory: {},
  stockLogs: [],
  clients: [],
  notifications: [],
  _erpMeta: { localUpdatedAt: 0, serverUpdatedAt: 0, dirty: false },
});

let saveTimer = null;
let lastLocalWriteAt = 0;
let pendingRemotePayload = null;
let retryDelayMs = 1000;

export const getLastLocalWriteAt = () => lastLocalWriteAt;
export const hasPendingRemoteSync = () => Boolean(pendingRemotePayload);

const readLocalBackup = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLocalBackup = (data) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore localStorage failures and rely on the remote copy when available.
  }
};

const getLocalUpdatedAt = (data) => {
  const value = Number(data?._erpMeta?.localUpdatedAt || 0);
  return Number.isFinite(value) ? value : 0;
};

const getServerUpdatedAt = (data) => Number(data?._erpMeta?.serverUpdatedAt || 0) || 0;
const isDirty = (data) => Boolean(data?._erpMeta?.dirty);

const mergeById = (base = [], incoming = []) => {
  const map = new Map();

  [...(Array.isArray(base) ? base : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((item) => {
    if (!item || typeof item !== "object" || !item.id) return;
    map.set(item.id, item);
  });

  return Array.from(map.values());
};

const mergeErpState = (current = {}, incoming = {}) => ({
  ...current,
  ...incoming,
  sizes: Array.isArray(incoming.sizes) ? incoming.sizes : Array.isArray(current.sizes) ? current.sizes : [],
  inventory:
    incoming.inventory && typeof incoming.inventory === "object"
      ? incoming.inventory
      : current.inventory && typeof current.inventory === "object"
        ? current.inventory
        : {},
  orders: mergeById(current.orders, incoming.orders),
  rawMaterials: mergeById(current.rawMaterials, incoming.rawMaterials),
  stockLogs: mergeById(current.stockLogs, incoming.stockLogs),
  clients: mergeById(current.clients, incoming.clients),
  notifications: mergeById(current.notifications, incoming.notifications),
  _erpMeta:
    incoming._erpMeta && typeof incoming._erpMeta === "object"
      ? incoming._erpMeta
      : current._erpMeta && typeof current._erpMeta === "object"
        ? current._erpMeta
        : undefined,
});

const stampErpData = (data, timestamp = Date.now()) => {
  if (!data || typeof data !== "object") {
    return createEmptyState();
  }

  const nextTimestamp = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();
  data._erpMeta = {
    ...(data._erpMeta || {}),
    localUpdatedAt: nextTimestamp,
    serverUpdatedAt: getServerUpdatedAt(data),
    dirty: true,
  };
  return data;
};

const applyServerMeta = (data, serverUpdatedAt) => {
  const stampedServerTime = Number(Date.parse(serverUpdatedAt || "")) || Date.now();
  return {
    ...data,
    _erpMeta: {
      ...(data?._erpMeta || {}),
      localUpdatedAt: Math.max(getLocalUpdatedAt(data), stampedServerTime),
      serverUpdatedAt: stampedServerTime,
      dirty: false,
    },
  };
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  const mergedHeaders = {
    Accept: "application/json",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    ...(options.headers || {}),
  };

  try {
    return await fetch(url, {
      ...options,
      headers: mergedHeaders,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const stripDemoRecords = (data) => ({
  ...data,
  orders: Array.isArray(data.orders)
    ? data.orders.filter((item) => !DEMO_ORDER_IDS.has(item.id))
    : [],
  rawMaterials: Array.isArray(data.rawMaterials)
    ? data.rawMaterials.filter((item) => !DEMO_RAW_IDS.has(item.id))
    : [],
  clients: Array.isArray(data.clients)
    ? data.clients.filter((item) => !DEMO_CLIENT_IDS.has(item.id))
    : [],
});

const sanitizeErpData = (data, buildSeed) => {
  if (!data || typeof data !== "object") {
    return createEmptyState();
  }

  const fallback = buildSeed();
  const cleaned = stripDemoRecords(data);

  return {
    sizes: Array.isArray(cleaned.sizes) ? cleaned.sizes : fallback.sizes,
    orders: Array.isArray(cleaned.orders) ? cleaned.orders : fallback.orders,
    rawMaterials: Array.isArray(cleaned.rawMaterials) ? cleaned.rawMaterials : fallback.rawMaterials,
    inventory: cleaned.inventory && typeof cleaned.inventory === "object" ? cleaned.inventory : fallback.inventory,
    stockLogs: Array.isArray(cleaned.stockLogs) ? cleaned.stockLogs : fallback.stockLogs,
    clients: Array.isArray(cleaned.clients) ? cleaned.clients : fallback.clients,
    notifications: Array.isArray(cleaned.notifications) ? cleaned.notifications : fallback.notifications,
    _erpMeta: {
      ...(cleaned._erpMeta && typeof cleaned._erpMeta === "object" ? cleaned._erpMeta : {}),
      localUpdatedAt: getLocalUpdatedAt(cleaned),
      serverUpdatedAt: getServerUpdatedAt(cleaned),
      dirty: isDirty(cleaned),
    },
  };
};

const prepareDirtyLocalSync = (localData, remoteData, buildSeed) => {
  const localServerUpdatedAt = getServerUpdatedAt(localData);
  const localUpdatedAt = getLocalUpdatedAt(localData);
  const remoteServerUpdatedAt = getServerUpdatedAt(remoteData);
  const hasUnsyncedLocalChanges = isDirty(localData) && localUpdatedAt > localServerUpdatedAt;

  if (!hasUnsyncedLocalChanges) {
    return {
      action: "use-remote",
      payload: remoteData,
    };
  }

  if (remoteServerUpdatedAt > localServerUpdatedAt && localUpdatedAt <= remoteServerUpdatedAt) {
    return {
      action: "use-remote",
      payload: remoteData,
    };
  }

  const mergedPayload = sanitizeErpData(
    mergeErpState(remoteData, localData),
    buildSeed
  );

  return {
    action: "push-merged",
    payload: stampErpData(mergedPayload, localUpdatedAt || Date.now()),
  };
};

export const readCachedErpData = (buildSeed) =>
  sanitizeErpData(readLocalBackup(), buildSeed);

const fetchRemoteState = async () => {
  const response = await fetchWithTimeout(ERP_STATE_ENDPOINT);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load ERP state: ${response.status}`);
  }
  return response.json();
};

const upsertRemoteState = async (data) => {
  const response = await fetchWithTimeout(ERP_STATE_ENDPOINT, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: data }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save ERP state: ${response.status}`);
  }

  return response.json();
};

const queueRemoteRetry = () => {
  if (saveTimer || !pendingRemotePayload) return;

  saveTimer = setTimeout(async () => {
    saveTimer = null;

    if (!pendingRemotePayload) return;

    try {
      const payload = pendingRemotePayload;
      const remoteRow = await upsertRemoteState(payload);
      const syncedPayload = applyServerMeta(payload, remoteRow?.updated_at);
      writeLocalBackup(syncedPayload);
      pendingRemotePayload = null;
      retryDelayMs = 1000;
    } catch (error) {
      console.error("Backend retry failed, will retry again.", error);
      retryDelayMs = Math.min(retryDelayMs * 2, 10000);
      queueRemoteRetry();
    }
  }, retryDelayMs);
};

export const loadErpData = async (buildSeed) => {
  const localData = sanitizeErpData(readLocalBackup(), buildSeed);

  try {
    const remoteData = await fetchRemoteState();
    if (remoteData?.payload) {
      const sanitizedRemote = applyServerMeta(
        sanitizeErpData(remoteData.payload, buildSeed),
        remoteData.updated_at
      );

      if (isDirty(localData)) {
        const resolution = prepareDirtyLocalSync(localData, sanitizedRemote, buildSeed);

        if (resolution.action === "use-remote") {
          writeLocalBackup(sanitizedRemote);
          pendingRemotePayload = null;
          return sanitizedRemote;
        }

        const remoteRow = await upsertRemoteState(resolution.payload);
        const syncedMerged = applyServerMeta(resolution.payload, remoteRow?.updated_at);
        writeLocalBackup(syncedMerged);
        pendingRemotePayload = null;
        return syncedMerged;
      }

      writeLocalBackup(sanitizedRemote);
      if (JSON.stringify(sanitizedRemote) !== JSON.stringify(remoteData.payload)) {
        const normalizedRow = await upsertRemoteState(sanitizedRemote);
        const syncedRemote = applyServerMeta(sanitizedRemote, normalizedRow?.updated_at);
        writeLocalBackup(syncedRemote);
        return syncedRemote;
      }
      return sanitizedRemote;
    }

    const initialData = isDirty(localData)
      ? localData
      : stampErpData(localData, Date.now());
    const remoteRow = await upsertRemoteState(initialData);
    const syncedInitial = applyServerMeta(initialData, remoteRow?.updated_at);
    writeLocalBackup(syncedInitial);
    pendingRemotePayload = null;
    return syncedInitial;
  } catch (error) {
    console.error("Backend load failed, using local backup instead.", error);
    return localData;
  }
};

export const saveErpData = (data) => {
  lastLocalWriteAt = Date.now();
  const stampedData = stampErpData(data, lastLocalWriteAt);
  writeLocalBackup(stampedData);
  pendingRemotePayload = stampedData;

  upsertRemoteState(stampedData)
    .then((remoteRow) => {
      const syncedPayload = applyServerMeta(stampedData, remoteRow?.updated_at);
      writeLocalBackup(syncedPayload);
      if (pendingRemotePayload === stampedData) {
        pendingRemotePayload = null;
      }
      retryDelayMs = 1000;
    })
    .catch((error) => {
      console.error("Backend save failed, keeping retry queue.", error);
      queueRemoteRetry();
    });
};

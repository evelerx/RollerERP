const LOCAL_STORAGE_KEY = "roller_erp_v4";
const PRIMARY_RECORD_ID = "main";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const ERP_STATE_ENDPOINT = `${API_BASE_URL}/api/erp-state/${PRIMARY_RECORD_ID}`;
const REMOTE_TIMEOUT_MS = 5000;

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
});

let saveTimer = null;

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

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const isSubsetOf = (items, getKey, knownKeys) =>
  Array.isArray(items) && items.length > 0 && items.every((item) => knownKeys.has(getKey(item)));

const isLikelyDemoData = (data) =>
  Boolean(data) &&
  isSubsetOf(data.orders || [], (item) => item.id, DEMO_ORDER_IDS) &&
  isSubsetOf(data.rawMaterials || [], (item) => item.id, DEMO_RAW_IDS) &&
  isSubsetOf(data.clients || [], (item) => item.id, DEMO_CLIENT_IDS);

const sanitizeErpData = (data, buildSeed) => {
  if (!data || typeof data !== "object") {
    return createEmptyState();
  }

  if (isLikelyDemoData(data)) {
    return createEmptyState();
  }

  const fallback = buildSeed();

  return {
    sizes: Array.isArray(data.sizes) ? data.sizes : fallback.sizes,
    orders: Array.isArray(data.orders) ? data.orders : [],
    rawMaterials: Array.isArray(data.rawMaterials) ? data.rawMaterials : [],
    inventory: data.inventory && typeof data.inventory === "object" ? data.inventory : {},
    stockLogs: Array.isArray(data.stockLogs) ? data.stockLogs : [],
    clients: Array.isArray(data.clients) ? data.clients : [],
  };
};

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
};

export const loadErpData = async (buildSeed) => {
  const localData = readLocalBackup();

  try {
    const remoteData = await fetchRemoteState();
    if (remoteData?.payload) {
      const sanitizedRemote = sanitizeErpData(remoteData.payload, buildSeed);
      writeLocalBackup(sanitizedRemote);
      if (sanitizedRemote !== remoteData.payload) {
        await upsertRemoteState(sanitizedRemote);
      }
      return sanitizedRemote;
    }

    const initialData = sanitizeErpData(localData, buildSeed);
    await upsertRemoteState(initialData);
    writeLocalBackup(initialData);
    return initialData;
  } catch (error) {
    console.error("Backend load failed, using local backup instead.", error);
    return sanitizeErpData(localData, buildSeed);
  }
};

export const saveErpData = (data) => {
  writeLocalBackup(data);

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    upsertRemoteState(data).catch((error) => {
      console.error("Backend save failed, kept local backup.", error);
    });
  }, 300);
};

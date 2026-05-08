const LOCAL_STORAGE_KEY = "roller_erp_v4";
const PRIMARY_RECORD_ID = "main";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const ERP_STATE_ENDPOINT = `${API_BASE_URL}/api/erp-state/${PRIMARY_RECORD_ID}`;

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

const fetchRemoteState = async () => {
  const response = await fetch(ERP_STATE_ENDPOINT);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load ERP state: ${response.status}`);
  }
  return response.json();
};

const upsertRemoteState = async (data) => {
  const response = await fetch(ERP_STATE_ENDPOINT, {
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
      writeLocalBackup(remoteData.payload);
      return remoteData.payload;
    }

    const initialData = localData || buildSeed();
    await upsertRemoteState(initialData);
    writeLocalBackup(initialData);
    return initialData;
  } catch (error) {
    console.error("Backend load failed, using local backup instead.", error);
    return localData || buildSeed();
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

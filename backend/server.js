import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ensureSchema, pool, syncNormalizedTables } from "./db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

const mergeById = (base = [], incoming = []) => {
  const map = new Map();

  [...(Array.isArray(base) ? base : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((item) => {
    if (!item || typeof item !== "object") return;
    if (!item.id) return;
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
  orders: Array.isArray(incoming.orders) ? incoming.orders : mergeById(current.orders, incoming.orders),
  rawMaterials: Array.isArray(incoming.rawMaterials) ? incoming.rawMaterials : mergeById(current.rawMaterials, incoming.rawMaterials),
  stockLogs: Array.isArray(incoming.stockLogs) ? incoming.stockLogs : mergeById(current.stockLogs, incoming.stockLogs),
  clients: Array.isArray(incoming.clients) ? incoming.clients : mergeById(current.clients, incoming.clients),
  notifications: Array.isArray(incoming.notifications) ? incoming.notifications : mergeById(current.notifications, incoming.notifications),
  _erpMeta:
    incoming._erpMeta && typeof incoming._erpMeta === "object"
      ? incoming._erpMeta
      : current._erpMeta && typeof current._erpMeta === "object"
        ? current._erpMeta
        : undefined,
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", async (_req, res) => {
  if (!pool) {
    return res.status(200).json({ ok: true, database: "not-configured" });
  }

  try {
    await pool.query("select 1");
    return res.status(200).json({ ok: true, database: "connected" });
  } catch (error) {
    return res.status(500).json({ ok: false, database: "error", error: error.message });
  }
});

app.get("/api/erp-state/:id", async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: "DATABASE_URL is not configured." });
  }

  try {
    const result = await pool.query(
      "select id, payload, updated_at from public.erp_state where id = $1",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "ERP state not found." });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put("/api/erp-state/:id", async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: "DATABASE_URL is not configured." });
  }

  const { payload } = req.body || {};
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Request body must include a payload object." });
  }

  try {
    const existing = await pool.query(
      "select payload from public.erp_state where id = $1",
      [req.params.id]
    );
    const mergedPayload = existing.rowCount > 0
      ? mergeErpState(existing.rows[0].payload || {}, payload)
      : payload;

    const result = await pool.query(
      `
        insert into public.erp_state (id, payload, updated_at)
        values ($1, $2::jsonb, timezone('utc', now()))
        on conflict (id)
        do update set
          payload = excluded.payload,
          updated_at = timezone('utc', now())
        returning id, payload, updated_at
      `,
      [req.params.id, JSON.stringify(mergedPayload)]
    );

    await syncNormalizedTables(mergedPayload);

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const start = async () => {
  try {
    await ensureSchema();
    app.listen(port, () => {
      console.log(`Roller ERP backend running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
};

start();

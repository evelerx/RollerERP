import { ensureSchema, getPool, syncNormalizedTables } from "../_lib/db.js";

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

export default async function handler(req, res) {
  const pool = getPool();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  if (!pool) {
    return res.status(503).json({ error: "DATABASE_URL is not configured." });
  }

  try {
    await ensureSchema();

    if (req.method === "GET") {
      const result = await pool.query(
        "select id, payload, updated_at from public.erp_state where id = $1",
        [req.query.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "ERP state not found." });
      }

      return res.status(200).json(result.rows[0]);
    }

    if (req.method === "PUT") {
      const { payload } = req.body || {};
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ error: "Request body must include a payload object." });
      }

      const existing = await pool.query(
        "select payload from public.erp_state where id = $1",
        [req.query.id]
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
        [req.query.id, JSON.stringify(mergedPayload)]
      );

      await syncNormalizedTables(mergedPayload);
      return res.status(200).json(result.rows[0]);
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

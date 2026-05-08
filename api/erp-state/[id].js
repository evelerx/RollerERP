import { ensureSchema, getPool, syncNormalizedTables } from "../_lib/db.js";

export default async function handler(req, res) {
  const pool = getPool();

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
        [req.query.id, JSON.stringify(payload)]
      );

      await syncNormalizedTables(payload);
      return res.status(200).json(result.rows[0]);
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

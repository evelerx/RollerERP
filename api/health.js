import { ensureSchema, getPool } from "./_lib/db.js";

export default async function handler(_req, res) {
  const pool = getPool();

  if (!pool) {
    return res.status(200).json({ ok: true, database: "not-configured" });
  }

  try {
    await ensureSchema();
    await pool.query("select 1");
    return res.status(200).json({ ok: true, database: "connected" });
  } catch (error) {
    return res.status(500).json({ ok: false, database: "error", error: error.message });
  }
}

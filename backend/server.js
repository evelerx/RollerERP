import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ensureSchema, pool, syncNormalizedTables } from "./db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

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
      [req.params.id, JSON.stringify(payload)]
    );

    await syncNormalizedTables(payload);

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

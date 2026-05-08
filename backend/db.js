import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const hasRealDatabaseUrl =
  Boolean(databaseUrl) && !databaseUrl.includes("[YOUR-PASSWORD]");

if (!hasRealDatabaseUrl) {
  console.warn("DATABASE_URL is not set. Backend API will fall back to browser storage.");
}

export const pool = hasRealDatabaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    })
  : null;

export const ensureSchema = async () => {
  if (!pool) return;

  await pool.query(`
    create table if not exists public.erp_state (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default timezone('utc', now())
    )
  `);

  await pool.query(`
    create table if not exists public.erp_sizes (
      code text primary key,
      label text not null,
      price numeric(12,2) not null default 0,
      cost numeric(12,2) not null default 0,
      active boolean not null default true
    )
  `);

  await pool.query(`
    create table if not exists public.erp_orders (
      id text primary key,
      client_name text,
      client_phone text,
      client_email text,
      client_address text,
      status text,
      order_date date,
      due_date date,
      delivery_date date,
      total_value numeric(14,2) not null default 0,
      paid_amount numeric(14,2) not null default 0,
      notes text
    )
  `);

  await pool.query(`
    create table if not exists public.erp_order_items (
      order_id text not null references public.erp_orders(id) on delete cascade,
      line_no integer not null,
      size_code text,
      qty integer not null default 0,
      unit_price numeric(12,2) not null default 0,
      is_custom boolean not null default false,
      custom_label text,
      custom_note text,
      primary key (order_id, line_no)
    )
  `);

  await pool.query(`
    create table if not exists public.erp_raw_materials (
      id text primary key,
      type text,
      supplier text,
      qty numeric(14,2) not null default 0,
      unit_cost numeric(14,2) not null default 0,
      total_cost numeric(14,2) not null default 0,
      paid_amount numeric(14,2) not null default 0,
      order_date date,
      received_date date,
      status text
    )
  `);

  await pool.query(`
    create table if not exists public.erp_inventory (
      size_code text primary key,
      qty integer not null default 0
    )
  `);

  await pool.query(`
    create table if not exists public.erp_stock_logs (
      id text primary key,
      type text,
      size_code text,
      qty integer not null default 0,
      note text,
      order_id text,
      log_date date
    )
  `);

  await pool.query(`
    create table if not exists public.erp_clients (
      id text primary key,
      name text not null,
      phone text,
      email text,
      address text,
      gst text
    )
  `);

  const existingState = await pool.query(`
    select payload
    from public.erp_state
    where id = 'main'
  `);

  if (existingState.rowCount > 0) {
    await syncNormalizedTables(existingState.rows[0].payload);
  }
};

const insertSizes = async (client, sizes = []) => {
  for (const size of sizes) {
    await client.query(
      `
        insert into public.erp_sizes (code, label, price, cost, active)
        values ($1, $2, $3, $4, $5)
      `,
      [
        size.code,
        size.label || "",
        Number(size.price || 0),
        Number(size.cost || 0),
        size.active !== false,
      ]
    );
  }
};

const insertOrders = async (client, orders = []) => {
  for (const order of orders) {
    await client.query(
      `
        insert into public.erp_orders (
          id, client_name, client_phone, client_email, client_address, status,
          order_date, due_date, delivery_date, total_value, paid_amount, notes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        order.id,
        order.clientName || null,
        order.clientPhone || null,
        order.clientEmail || null,
        order.clientAddress || null,
        order.status || null,
        order.orderDate || null,
        order.dueDate || null,
        order.deliveryDate || null,
        Number(order.totalValue || 0),
        Number(order.paidAmount || 0),
        order.notes || null,
      ]
    );

    const items = Array.isArray(order.items) ? order.items : [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      await client.query(
        `
          insert into public.erp_order_items (
            order_id, line_no, size_code, qty, unit_price, is_custom, custom_label, custom_note
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          order.id,
          index + 1,
          item.size || null,
          Number(item.qty || 0),
          Number(item.unitPrice || 0),
          Boolean(item.isCustom),
          item.customLabel || null,
          item.note || order.notes || null,
        ]
      );
    }
  }
};

const insertRawMaterials = async (client, rawMaterials = []) => {
  for (const material of rawMaterials) {
    await client.query(
      `
        insert into public.erp_raw_materials (
          id, type, supplier, qty, unit_cost, total_cost, paid_amount,
          order_date, received_date, status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        material.id,
        material.type || null,
        material.supplier || null,
        Number(material.qty || 0),
        Number(material.unitCost || 0),
        Number(material.totalCost || 0),
        Number(material.paidAmount || 0),
        material.orderDate || null,
        material.receivedDate || null,
        material.status || null,
      ]
    );
  }
};

const insertInventory = async (client, inventory = {}) => {
  for (const [sizeCode, qty] of Object.entries(inventory || {})) {
    await client.query(
      `
        insert into public.erp_inventory (size_code, qty)
        values ($1, $2)
      `,
      [sizeCode, Number(qty || 0)]
    );
  }
};

const insertStockLogs = async (client, stockLogs = []) => {
  for (const log of stockLogs) {
    await client.query(
      `
        insert into public.erp_stock_logs (
          id, type, size_code, qty, note, order_id, log_date
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        log.id,
        log.type || null,
        log.size || null,
        Number(log.qty || 0),
        log.note || null,
        log.orderId || null,
        log.date || null,
      ]
    );
  }
};

const insertClients = async (client, clients = []) => {
  for (const row of clients) {
    await client.query(
      `
        insert into public.erp_clients (id, name, phone, email, address, gst)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [
        row.id,
        row.name || "",
        row.phone || null,
        row.email || null,
        row.address || null,
        row.gst || null,
      ]
    );
  }
};

export const syncNormalizedTables = async (payload) => {
  if (!pool || !payload || typeof payload !== "object") return;

  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query("delete from public.erp_order_items");
    await client.query("delete from public.erp_orders");
    await client.query("delete from public.erp_raw_materials");
    await client.query("delete from public.erp_inventory");
    await client.query("delete from public.erp_stock_logs");
    await client.query("delete from public.erp_clients");
    await client.query("delete from public.erp_sizes");

    await insertSizes(client, payload.sizes);
    await insertOrders(client, payload.orders);
    await insertRawMaterials(client, payload.rawMaterials);
    await insertInventory(client, payload.inventory);
    await insertStockLogs(client, payload.stockLogs);
    await insertClients(client, payload.clients);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

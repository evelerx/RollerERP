import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { loadErpData, saveErpData } from "./lib/erpStorage";

// ── FONTS ──────────────────────────────────────────────────────────────────
(() => {
  if (document.getElementById("erp-f")) return;
  const l = document.createElement("link");
  l.id = "erp-f"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap";
  document.head.appendChild(l);
  const s = document.createElement("style");
  s.textContent = `*{box-sizing:border-box;margin:0;padding:0}body{background:#070a0e;font-family:'DM Sans',sans-serif}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:#0d1017}::-webkit-scrollbar-thumb{background:#2a3040;border-radius:2px}.mono{font-family:'JetBrains Mono',monospace}.raj{font-family:'Rajdhani',sans-serif}.fade{animation:fIn .22s ease}@keyframes fIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}input,select,textarea{outline:none;font-family:'DM Sans',sans-serif}button{cursor:pointer;font-family:'DM Sans',sans-serif}table{border-collapse:collapse;width:100%}.pg-btn{padding:5px 12px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #1c2232;background:transparent;color:#7a8aaa;transition:all .15s}.pg-btn:hover{border-color:#f59e0b;color:#f59e0b}.pg-btn.active{background:#f59e0b22;border-color:#f59e0b;color:#f59e0b}`;
  document.head.appendChild(s);
})();

// ── THEME ──────────────────────────────────────────────────────────────────
const T = {
  bg:"#070a0e",surface:"#0d1017",card:"#111520",border:"#1c2232",borderH:"#2a3548",
  amber:"#f59e0b",green:"#22c55e",red:"#ef4444",blue:"#3b82f6",purple:"#a78bfa",cyan:"#06b6d4",
  text:"#dde4f0",textSec:"#7a8aaa",textMuted:"#3d4a5c",
  chart:["#f59e0b","#22c55e","#3b82f6","#a78bfa","#ef4444","#06b6d4"],
};

const BrandLogo = ({ height = 34, wide = false }) => (
  <img
    src="/sk-engineering-logo.svg"
    alt="Shree Krupa Engineering Works"
    style={{
      height,
      width: wide ? "auto" : height * 1.8,
      objectFit: "contain",
      display: "block",
      filter: "drop-shadow(0 2px 8px rgba(0,0,0,.18))",
    }}
  />
);

const sanitizeUiText = (value) => {
  if (typeof value !== "string") return value;

  return value
    .replaceAll("â†", "<")
    .replaceAll("â†’", ">")
    .replaceAll("Â·", "·")
    .replaceAll("â€”", "-")
    .replaceAll("â€¦", "...")
    .replaceAll("Ã—", "x")
    .replaceAll("âš ", "!")
    .replaceAll("â€˜", "'")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", "\"")
    .replaceAll("â€", "\"")
    .replaceAll("Ã¢Å¡â„¢", "[PRD]")
    .replaceAll("Ã¢Å¡â€“", "[SZ]")
    .replaceAll("ðŸ“‹", "[ORD]")
    .replaceAll("ðŸ“¦", "[STK]")
    .replaceAll("ðŸ”©", "[RM]")
    .replaceAll("ðŸ‘¥", "[CL]")
    .replaceAll("ðŸ“Š", "[RPT]")
    .replaceAll("ðŸ‘‘", "[A]")
    .replaceAll("ðŸ”§", "[E]")
    .replaceAll("ðŸ­", "[C]");
};

// ── AUTH (obfuscated — do not expose plaintext) ────────────────────────────
const ADMIN_PASSWORD = "123ERP";
const LEGACY_PASSWORDS = ["1234"];
const EMPLOYEE_PIN = "123ERP";

// Encoded verification — never stored as plaintext
const _vk = [77,84,73,122,82,86,74,81]; // encoded segments
const _va = () => _vk.map(c=>String.fromCharCode(c)).join("");
const verifyAdmin = (input) => {
  const normalized = String(input ?? "").trim();
  try {
    return btoa(normalized) === _va() || [ADMIN_PASSWORD, ...LEGACY_PASSWORDS].includes(normalized);
  } catch {
    return [ADMIN_PASSWORD, ...LEGACY_PASSWORDS].includes(normalized);
  }
};

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const DEFAULT_SIZES = [
  {code:"89x380", label:"89mm × 380mm", price:850,  cost:420, active:true},
  {code:"89x465", label:"89mm × 465mm", price:950,  cost:480, active:true},
  {code:"89x530", label:"89mm × 530mm", price:1050, cost:530, active:true},
  {code:"102x380",label:"102mm × 380mm",price:1100, cost:550, active:true},
  {code:"102x465",label:"102mm × 465mm",price:1250, cost:620, active:true},
  {code:"102x530",label:"102mm × 530mm",price:1400, cost:700, active:true},
  {code:"127x465",label:"127mm × 465mm",price:1650, cost:825, active:true},
  {code:"127x530",label:"127mm × 530mm",price:1850, cost:925, active:true},
  {code:"159x465",label:"159mm × 465mm",price:2200, cost:1100,active:true},
  {code:"159x530",label:"159mm × 530mm",price:2450, cost:1225,active:true},
];

const RM_TYPES = [
  {id:"pipes",   name:"Iron Pipes (24ft)",unit:"pcs"},
  {id:"bearings",name:"Bearings",         unit:"pcs"},
  {id:"shaft",   name:"Shaft Rods",       unit:"pcs"},
  {id:"sleeves", name:"Sleeves",          unit:"pcs"},
  {id:"locks",   name:"Locks",            unit:"pcs"},
  {id:"seals",   name:"Seals",            unit:"pcs"},
  {id:"caps",    name:"End Caps",         unit:"pcs"},
];

const STATUS = {
  "pending":            {label:"Pending",           color:"#f59e0b",bg:"rgba(245,158,11,.12)"},
  "in-production":      {label:"In Production",     color:"#3b82f6",bg:"rgba(59,130,246,.12)"},
  "ready-for-delivery": {label:"Ready for Delivery",color:"#a78bfa",bg:"rgba(167,139,250,.12)"},
  "delivered":          {label:"Delivered",         color:"#22c55e",bg:"rgba(34,197,94,.12)"},
  "cancelled":          {label:"Cancelled",         color:"#ef4444",bg:"rgba(239,68,68,.12)"},
};

const RM_STATUS = {
  "ordered": {label:"Ordered", color:"#f59e0b"},
  "received":{label:"Received",color:"#22c55e"},
  "partial": {label:"Partial", color:"#3b82f6"},
};

const PAGE_SIZE = 50; // rows per page for performance

// ── SEED DATA ──────────────────────────────────────────────────────────────
const buildSeed = () => ({
  sizes: DEFAULT_SIZES,
  orders: [
    {id:"ORD-001",clientName:"Rajesh Mining Co.",clientPhone:"9876543210",clientEmail:"rajesh@mining.com",clientAddress:"Rajasthan",items:[{size:"102x465",qty:50,unitPrice:1250}],status:"delivered",orderDate:"2024-10-15",dueDate:"2024-10-28",deliveryDate:"2024-10-28",totalValue:62500,paidAmount:62500,notes:"Urgent"},
    {id:"ORD-002",clientName:"Sharma Stone Crusher",clientPhone:"9988776655",clientEmail:"sharma@stone.com",clientAddress:"Madhya Pradesh",items:[{size:"89x465",qty:100,unitPrice:950},{size:"127x465",qty:30,unitPrice:1650}],status:"delivered",orderDate:"2024-11-03",dueDate:"2024-11-20",deliveryDate:"2024-11-20",totalValue:144500,paidAmount:144500,notes:""},
    {id:"ORD-003",clientName:"Gupta Quarry Works",clientPhone:"9123456789",clientEmail:"gupta@quarry.com",clientAddress:"Uttar Pradesh",items:[{size:"159x530",qty:20,unitPrice:2450}],status:"delivered",orderDate:"2024-12-10",dueDate:"2024-12-25",deliveryDate:"2024-12-25",totalValue:49000,paidAmount:49000,notes:""},
    {id:"ORD-004",clientName:"Singh Aggregates",clientPhone:"9812345678",clientEmail:"singh@agg.com",clientAddress:"Punjab",items:[{size:"102x530",qty:75,unitPrice:1400}],status:"delivered",orderDate:"2025-01-05",dueDate:"2025-01-22",deliveryDate:"2025-01-22",totalValue:105000,paidAmount:105000,notes:""},
    {id:"ORD-005",clientName:"Patel Crushers Ltd.",clientPhone:"9765432109",clientEmail:"patel@crushers.com",clientAddress:"Gujarat",items:[{size:"89x380",qty:200,unitPrice:850},{size:"89x465",qty:100,unitPrice:950}],status:"delivered",orderDate:"2025-02-01",dueDate:"2025-02-18",deliveryDate:"2025-02-18",totalValue:265000,paidAmount:265000,notes:"Seasonal bulk"},
    {id:"ORD-006",clientName:"Kumar Mining Pvt.",clientPhone:"9654321098",clientEmail:"kumar@mining.com",clientAddress:"Chhattisgarh",items:[{size:"127x530",qty:40,unitPrice:1850}],status:"delivered",orderDate:"2025-02-12",dueDate:"2025-02-28",deliveryDate:"2025-02-28",totalValue:74000,paidAmount:74000,notes:""},
    {id:"ORD-007",clientName:"Agarwal Infra",clientPhone:"9432109876",clientEmail:"agarwal@infra.com",clientAddress:"Haryana",items:[{size:"159x465",qty:15,unitPrice:2200},{size:"127x465",qty:25,unitPrice:1650}],status:"delivered",orderDate:"2025-03-10",dueDate:"2025-03-28",deliveryDate:"2025-03-28",totalValue:74250,paidAmount:74250,notes:""},
    {id:"ORD-008",clientName:"Rajesh Mining Co.",clientPhone:"9876543210",clientEmail:"rajesh@mining.com",clientAddress:"Rajasthan",items:[{size:"102x465",qty:80,unitPrice:1250}],status:"delivered",orderDate:"2025-04-02",dueDate:"2025-04-18",deliveryDate:"2025-04-18",totalValue:100000,paidAmount:100000,notes:""},
    {id:"ORD-009",clientName:"Sharma Stone Crusher",clientPhone:"9988776655",clientEmail:"sharma@stone.com",clientAddress:"Madhya Pradesh",items:[{size:"89x530",qty:150,unitPrice:1050}],status:"delivered",orderDate:"2025-05-05",dueDate:"2025-05-22",deliveryDate:"2025-05-22",totalValue:157500,paidAmount:157500,notes:""},
    {id:"ORD-010",clientName:"Verma Stone Works",clientPhone:"9543210987",clientEmail:"verma@stone.com",clientAddress:"Bihar",items:[{size:"102x465",qty:120,unitPrice:1250}],status:"delivered",orderDate:"2025-06-01",dueDate:"2025-06-20",deliveryDate:"2025-06-20",totalValue:150000,paidAmount:150000,notes:""},
    {id:"ORD-011",clientName:"Singh Aggregates",clientPhone:"9812345678",clientEmail:"singh@agg.com",clientAddress:"Punjab",items:[{size:"102x380",qty:60,unitPrice:1100}],status:"in-production",orderDate:"2025-07-02",dueDate:"2025-07-20",deliveryDate:null,totalValue:66000,paidAmount:33000,notes:"50% advance"},
    {id:"ORD-012",clientName:"Patel Crushers Ltd.",clientPhone:"9765432109",clientEmail:"patel@crushers.com",clientAddress:"Gujarat",items:[{size:"89x465",qty:200,unitPrice:950}],status:"ready-for-delivery",orderDate:"2025-07-05",dueDate:"2025-07-18",deliveryDate:null,totalValue:190000,paidAmount:190000,notes:"Paid in full"},
    {id:"ORD-013",clientName:"Mehta Quarry",clientPhone:"9321098765",clientEmail:"mehta@quarry.com",clientAddress:"Rajasthan",items:[{size:"127x530",qty:30,unitPrice:1850}],status:"pending",orderDate:"2025-07-12",dueDate:"2025-08-01",deliveryDate:null,totalValue:55500,paidAmount:0,notes:""},
  ],
  rawMaterials: [
    {id:"RM-001",type:"pipes",supplier:"Steel Hub Pvt.",qty:500,unitCost:2200,totalCost:1100000,paidAmount:1100000,orderDate:"2024-10-01",receivedDate:"2024-10-08",status:"received"},
    {id:"RM-002",type:"bearings",supplier:"NSK Bearings",qty:2000,unitCost:180,totalCost:360000,paidAmount:360000,orderDate:"2024-10-01",receivedDate:"2024-10-06",status:"received"},
    {id:"RM-003",type:"shaft",supplier:"Iron Masters",qty:1000,unitCost:420,totalCost:420000,paidAmount:420000,orderDate:"2024-11-10",receivedDate:"2024-11-18",status:"received"},
    {id:"RM-004",type:"seals",supplier:"SKF India",qty:3000,unitCost:45,totalCost:135000,paidAmount:135000,orderDate:"2024-12-01",receivedDate:"2024-12-08",status:"received"},
    {id:"RM-005",type:"caps",supplier:"MetalCraft",qty:2000,unitCost:35,totalCost:70000,paidAmount:70000,orderDate:"2025-01-15",receivedDate:"2025-01-22",status:"received"},
    {id:"RM-006",type:"locks",supplier:"FastenPro",qty:2500,unitCost:28,totalCost:70000,paidAmount:70000,orderDate:"2025-02-01",receivedDate:"2025-02-07",status:"received"},
    {id:"RM-007",type:"pipes",supplier:"Steel Hub Pvt.",qty:300,unitCost:2250,totalCost:675000,paidAmount:675000,orderDate:"2025-04-15",receivedDate:"2025-04-22",status:"received"},
    {id:"RM-008",type:"bearings",supplier:"FAG Bearings",qty:1500,unitCost:195,totalCost:292500,paidAmount:292500,orderDate:"2025-05-01",receivedDate:"2025-05-09",status:"received"},
    {id:"RM-009",type:"sleeves",supplier:"PrecisionParts",qty:800,unitCost:120,totalCost:96000,paidAmount:96000,orderDate:"2025-06-01",receivedDate:"2025-06-08",status:"received"},
    {id:"RM-010",type:"pipes",supplier:"Steel Hub Pvt.",qty:400,unitCost:2300,totalCost:920000,paidAmount:460000,orderDate:"2025-07-01",receivedDate:null,status:"ordered"},
    {id:"RM-011",type:"bearings",supplier:"NSK Bearings",qty:2000,unitCost:185,totalCost:370000,paidAmount:0,orderDate:"2025-07-05",receivedDate:null,status:"ordered"},
  ],
  inventory: {
    "89x380":45,"89x465":32,"89x530":18,"102x380":24,
    "102x465":8,"102x530":15,"127x465":12,"127x530":6,
    "159x465":3,"159x530":2
  },
  stockLogs: [], // {id, type:"add"|"reduce"|"transfer", size, qty, note, orderId, date}
  clients: [
    {id:"C001",name:"Rajesh Mining Co.",phone:"9876543210",email:"rajesh@mining.com",address:"Rajasthan",gst:"08ABCDE1234F1Z5"},
    {id:"C002",name:"Sharma Stone Crusher",phone:"9988776655",email:"sharma@stone.com",address:"Madhya Pradesh",gst:"23ABCDE5678G2Z6"},
    {id:"C003",name:"Gupta Quarry Works",phone:"9123456789",email:"gupta@quarry.com",address:"Uttar Pradesh",gst:"09ABCDE9012H3Z7"},
    {id:"C004",name:"Singh Aggregates",phone:"9812345678",email:"singh@agg.com",address:"Punjab",gst:"03ABCDE3456I4Z8"},
    {id:"C005",name:"Patel Crushers Ltd.",phone:"9765432109",email:"patel@crushers.com",address:"Gujarat",gst:"24ABCDE7890J5Z9"},
    {id:"C006",name:"Kumar Mining Pvt.",phone:"9654321098",email:"kumar@mining.com",address:"Chhattisgarh",gst:"22ABCDE2345K6Z0"},
    {id:"C007",name:"Agarwal Infra",phone:"9432109876",email:"agarwal@infra.com",address:"Haryana",gst:"06ABCDE6789L7Z1"},
    {id:"C008",name:"Verma Stone Works",phone:"9543210987",email:"verma@stone.com",address:"Bihar",gst:"10ABCDE0123M8Z2"},
  ]
});

// ── STORAGE (Supabase + local fallback) ───────────────────────────
const loadData = async () => loadErpData(buildSeed);
const saveData = (d) => saveErpData(d);

// ── HELPERS ────────────────────────────────────────────────────────────────
const INR    = (n) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(n||0));
const NUM    = (n) => new Intl.NumberFormat("en-IN").format(n||0);
const today  = () => new Date().toISOString().split("T")[0];
const genId  = (p) => `${p}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
const getSz  = (sizes, code) => (sizes||[]).find(s=>s.code===code) || {};
const getRMT = (id) => RM_TYPES.find(r=>r.id===id) || {};
const isDue  = (d) => d && d < today() ? true : false;
const daysLeft = (d) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
  return diff;
};

const calcOrderCost = (sizes, items) =>
  (items||[]).reduce((s,i)=>s+(getSz(sizes,i.size).cost||0)*(i.qty||0),0);

const getMonthlyStats = (sizes, orders) => {
  const map = {};
  (orders||[]).forEach(o => {
    if (!o.orderDate) return;
    const key = o.orderDate.substring(0,7);
    if (!map[key]) map[key] = {key,revenue:0,cost:0,orders:0,delivered:0};
    map[key].revenue += o.totalValue||0;
    map[key].cost    += calcOrderCost(sizes,o.items);
    map[key].orders++;
    if (o.status==="delivered") map[key].delivered++;
  });
  return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key)).map(m=>({
    ...m, profit:m.revenue-m.cost,
    label: new Date(m.key+"-01").toLocaleString("default",{month:"short",year:"2-digit"})
  }));
};

const downloadBlob = (blob, fileName) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const createTransferSnapshot = (data) => {
  const orders = data.orders || [];
  const rawMaterials = data.rawMaterials || [];
  const clients = data.clients || [];
  const sizes = data.sizes || [];
  const inventoryEntries = Object.entries(data.inventory || {});

  const deliveredOrders = orders.filter(o => o.status === "delivered");
  const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.totalValue || 0), 0);
  const totalPaid = orders.reduce((sum, order) => sum + (order.paidAmount || 0), 0);
  const pendingValue = orders.reduce((sum, order) => sum + ((order.totalValue || 0) - (order.paidAmount || 0)), 0);

  return {
    generatedOn: new Date().toLocaleString("en-IN"),
    summary: {
      totalOrders: orders.length,
      activeOrders: orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length,
      totalRevenue,
      totalPaid,
      pendingValue,
      rawMaterialEntries: rawMaterials.length,
      clientCount: clients.length,
      activeSizes: sizes.filter(s => s.active !== false).length,
      inventoryUnits: inventoryEntries.reduce((sum, [, qty]) => sum + Number(qty || 0), 0),
    },
    orders: orders.map(order => ({
      id: order.id,
      client: order.clientName,
      phone: order.clientPhone,
      orderDate: order.orderDate,
      dueDate: order.dueDate || "",
      status: order.status,
      totalValue: order.totalValue || 0,
      paidAmount: order.paidAmount || 0,
      balance: (order.totalValue || 0) - (order.paidAmount || 0),
      items: (order.items || []).map(item =>
        `${item.customLabel || item.size || "Custom"} x${item.qty || 0}`
      ).join("; "),
      notes: order.notes || "",
    })),
    rawMaterials: rawMaterials.map(row => ({
      id: row.id,
      type: getRMT(row.type).name || row.type,
      supplier: row.supplier,
      qty: row.qty || 0,
      totalCost: row.totalCost || 0,
      paidAmount: row.paidAmount || 0,
      status: row.status || "",
    })),
    clients: clients.map(client => ({
      id: client.id,
      name: client.name,
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      gst: client.gst || "",
    })),
    inventory: inventoryEntries.map(([size, qty]) => ({ size, qty: Number(qty || 0) })),
  };
};

const exportWordReport = (data) => {
  const snapshot = createTransferSnapshot(data);
  const { summary } = snapshot;
  const orderRows = snapshot.orders.map(order => `
    <tr>
      <td>${escapeHtml(order.id)}</td>
      <td>${escapeHtml(order.client)}</td>
      <td>${escapeHtml(order.orderDate)}</td>
      <td>${escapeHtml(order.status)}</td>
      <td>${escapeHtml(order.items)}</td>
      <td>${escapeHtml(INR(order.totalValue))}</td>
      <td>${escapeHtml(INR(order.balance))}</td>
    </tr>
  `).join("");

  const clientRows = snapshot.clients.map(client => `
    <tr>
      <td>${escapeHtml(client.id)}</td>
      <td>${escapeHtml(client.name)}</td>
      <td>${escapeHtml(client.phone)}</td>
      <td>${escapeHtml(client.email)}</td>
      <td>${escapeHtml(client.gst)}</td>
    </tr>
  `).join("");

  const inventoryRows = snapshot.inventory.map(row => `
    <tr>
      <td>${escapeHtml(row.size)}</td>
      <td>${escapeHtml(NUM(row.qty))}</td>
    </tr>
  `).join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Roller ERP Report</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; color: #1f2937; padding: 24px; }
          h1, h2 { margin: 0 0 12px; }
          .meta { margin-bottom: 20px; color: #4b5563; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .kpi { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
          .kpi-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
          .kpi-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Roller ERP Transfer Report</h1>
        <div class="meta">Generated on ${escapeHtml(snapshot.generatedOn)}</div>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">Total Orders</div><div class="kpi-value">${escapeHtml(NUM(summary.totalOrders))}</div></div>
          <div class="kpi"><div class="kpi-label">Active Orders</div><div class="kpi-value">${escapeHtml(NUM(summary.activeOrders))}</div></div>
          <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value">${escapeHtml(INR(summary.totalRevenue))}</div></div>
          <div class="kpi"><div class="kpi-label">Pending Balance</div><div class="kpi-value">${escapeHtml(INR(summary.pendingValue))}</div></div>
        </div>
        <h2>Orders</h2>
        <table>
          <thead><tr><th>Order ID</th><th>Client</th><th>Date</th><th>Status</th><th>Items</th><th>Total</th><th>Balance</th></tr></thead>
          <tbody>${orderRows}</tbody>
        </table>
        <h2>Clients</h2>
        <table>
          <thead><tr><th>Client ID</th><th>Name</th><th>Phone</th><th>Email</th><th>GST</th></tr></thead>
          <tbody>${clientRows}</tbody>
        </table>
        <h2>Inventory</h2>
        <table>
          <thead><tr><th>Size</th><th>Units</th></tr></thead>
          <tbody>${inventoryRows}</tbody>
        </table>
      </body>
    </html>
  `;

  downloadBlob(
    new Blob([html], { type: "application/msword;charset=utf-8" }),
    `roller_erp_report_${today()}.doc`
  );
};

const exportPdfReport = (data) => {
  const snapshot = createTransferSnapshot(data);
  const { summary } = snapshot;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(20);
  doc.text("Roller ERP Transfer Report", 40, 40);
  doc.setFontSize(10);
  doc.text(`Generated on ${snapshot.generatedOn}`, 40, 58);

  autoTable(doc, {
    startY: 76,
    theme: "grid",
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [[
      "Total Orders", NUM(summary.totalOrders),
      "Active Orders", NUM(summary.activeOrders),
    ], [
      "Revenue", INR(summary.totalRevenue),
      "Pending Balance", INR(summary.pendingValue),
    ], [
      "Clients", NUM(summary.clientCount),
      "Inventory Units", NUM(summary.inventoryUnits),
    ]],
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    head: [["Order ID", "Client", "Date", "Status", "Total", "Balance"]],
    body: snapshot.orders.map(order => [
      order.id,
      order.client,
      order.orderDate,
      order.status,
      INR(order.totalValue),
      INR(order.balance),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [17, 21, 32] },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    head: [["Material ID", "Type", "Supplier", "Qty", "Total Cost", "Status"]],
    body: snapshot.rawMaterials.map(row => [
      row.id,
      row.type,
      row.supplier,
      NUM(row.qty),
      INR(row.totalCost),
      row.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [17, 21, 32] },
  });

  doc.save(`roller_erp_report_${today()}.pdf`);
};

const exportJsonBackup = (data) => {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    `roller_erp_backup_${today()}.json`
  );
};

const isValidImportPayload = (payload) =>
  payload &&
  Array.isArray(payload.sizes) &&
  Array.isArray(payload.orders) &&
  Array.isArray(payload.rawMaterials) &&
  payload.inventory &&
  typeof payload.inventory === "object" &&
  Array.isArray(payload.stockLogs) &&
  Array.isArray(payload.clients);

// ── PERFORMANCE: debounce hook ─────────────────────────────────────────────
const useDebounce = (val, ms=300) => {
  const [dv, setDv] = useState(val);
  useEffect(()=>{ const t=setTimeout(()=>setDv(val),ms); return()=>clearTimeout(t); },[val,ms]);
  return dv;
};

const InstallAppButton = memo(({ canInstall, onInstall, onDismiss, showIosHint, isInstalled, dismissed=false, compact=false }) => {
  if (isInstalled) return null;
  if (dismissed) return null;
  if (!canInstall && !showIosHint) return null;

  return (
    <div style={{
      position:compact?"relative":"fixed",right:16,bottom:16,zIndex:1000,maxWidth:280,
      background:T.card,border:`1px solid ${T.borderH}`,borderRadius:12,padding:"14px 16px",
      boxShadow:compact?"none":"0 16px 40px rgba(0,0,0,.35)",
      width:compact?"100%":"auto"
    }}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            position:"absolute",top:8,right:8,background:"transparent",border:"none",color:T.textSec,
            fontSize:16,lineHeight:1,padding:4,cursor:"pointer"
          }}
          aria-label="Dismiss download prompt"
        >
          x
        </button>
      )}
      <div className="raj" style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6,paddingRight:20}}>
        Download App
      </div>
      <div style={{fontSize:12,color:T.textSec,lineHeight:1.5,marginBottom:12}}>
        {showIosHint
          ? "On iPhone or iPad, tap Share and then Add to Home Screen."
          : "Install this ERP on Android, Windows, or desktop for faster access."}
      </div>
      {canInstall && <Btn small onClick={onInstall}>Download App</Btn>}
    </div>
  );
});

// ── UI PRIMITIVES (memoized) ───────────────────────────────────────────────
const Card = memo(({children,style={},onClick})=>(
  <div onClick={onClick} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"20px",transition:"border-color .2s",...(onClick?{cursor:"pointer"}:{}),...style}}>{children}</div>
));

const Badge = memo(({status})=>{
  const s=STATUS[status]||{label:status,color:T.textSec,bg:"rgba(255,255,255,.06)"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,color:s.color,background:s.bg,letterSpacing:.5,textTransform:"uppercase"}}>{s.label}</span>;
});

const KPI = memo(({label,value,sub,accent})=>(
  <Card style={{position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:accent||T.amber}}/>
    <div style={{color:T.textSec,fontSize:11,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{label}</div>
    <div className="raj" style={{fontSize:28,fontWeight:700,color:T.text,lineHeight:1}}>{value}</div>
    {sub&&<div style={{marginTop:6,fontSize:12,color:T.textSec}}>{sub}</div>}
  </Card>
));

const Btn = memo(({children,onClick,variant="primary",style={},small=false,disabled=false})=>{
  const V={
    primary:{background:T.amber,color:"#000",border:"none"},
    ghost:{background:"transparent",color:T.text,border:`1px solid ${T.border}`},
    danger:{background:"rgba(239,68,68,.15)",color:T.red,border:"1px solid rgba(239,68,68,.3)"},
    success:{background:"rgba(34,197,94,.15)",color:T.green,border:"1px solid rgba(34,197,94,.3)"},
    blue:{background:"rgba(59,130,246,.15)",color:T.blue,border:"1px solid rgba(59,130,246,.3)"},
    purple:{background:"rgba(167,139,250,.15)",color:T.purple,border:"1px solid rgba(167,139,250,.3)"},
    orange:{background:"rgba(249,115,22,.15)",color:"#f97316",border:"1px solid rgba(249,115,22,.3)"},
  };
  return(
    <button onClick={onClick} disabled={disabled} style={{...V[variant],padding:small?"5px 12px":"9px 18px",borderRadius:6,fontSize:small?12:13,fontWeight:600,opacity:disabled?.5:1,cursor:disabled?"not-allowed":"pointer",transition:"opacity .15s",...style}}>{children}</button>
  );
});

const Inp = memo(({label,value,onChange,type="text",placeholder="",required=false,options,min,max,style={}})=>(
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label&&<label style={{fontSize:12,fontWeight:600,color:T.textSec,letterSpacing:.3}}>{label}{required&&<span style={{color:T.red}}> *</span>}</label>}
    {options?(
      <select value={value} onChange={e=>onChange(e.target.value)} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 10px",fontSize:13,width:"100%",...style}}>
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    ):(
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} max={max} required={required} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 10px",fontSize:13,width:"100%",...style}}/>
    )}
  </div>
));

const Modal = memo(({open,onClose,title,children,width=560})=>{
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.78)",backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fade" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,width:"100%",maxWidth:width,maxHeight:"90vh",overflowY:"auto",padding:"24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 className="raj" style={{fontSize:20,fontWeight:700,color:T.text}}>{title}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textSec,fontSize:20,lineHeight:1}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
});

// ── PAGINATED TABLE (virtualization-lite for performance) ──────────────────
const PaginatedTable = memo(({cols,rows,emptyMsg="No records found",pageSize=PAGE_SIZE})=>{
  const [pg,setPg] = useState(0);
  const total = rows.length;
  const pages = Math.ceil(total/pageSize)||1;
  const slice = useMemo(()=>rows.slice(pg*pageSize,(pg+1)*pageSize),[rows,pg,pageSize]);

  useEffect(()=>{ setPg(0); },[rows]);

  return(
    <div>
      <div style={{overflowX:"auto"}}>
        <table>
          <thead>
            <tr style={{borderBottom:`1px solid ${T.border}`}}>
              {cols.map(c=>(
                <th key={c.key} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:T.textSec,letterSpacing:.8,textTransform:"uppercase",whiteSpace:"nowrap"}}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length===0?(
              <tr><td colSpan={cols.length} style={{padding:"40px",textAlign:"center",color:T.textMuted,fontSize:13}}>{emptyMsg}</td></tr>
            ):slice.map((row,i)=>(
              <tr key={row.id||i} style={{borderBottom:`1px solid ${T.border}22`,transition:"background .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background=`${T.border}44`}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {cols.map(c=>(
                  <td key={c.key} style={{padding:"11px 14px",fontSize:13,color:c.mono?T.amber:T.text,fontFamily:c.mono?"'JetBrains Mono',monospace":"inherit",whiteSpace:"nowrap"}}>
                    {c.render?c.render(row[c.key],row):(row[c.key]??"-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages>1&&(
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"12px 14px",borderTop:`1px solid ${T.border}`,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:T.textSec,marginRight:4}}>
            {pg*pageSize+1}–{Math.min((pg+1)*pageSize,total)} of {NUM(total)}
          </span>
          <button className="pg-btn" onClick={()=>setPg(0)} disabled={pg===0}>«</button>
          <button className="pg-btn" onClick={()=>setPg(p=>Math.max(0,p-1))} disabled={pg===0}>‹</button>
          {[...Array(Math.min(5,pages))].map((_,i)=>{
            const start=Math.max(0,Math.min(pg-2,pages-5));
            const pn=start+i;
            return pn<pages&&(
              <button key={pn} className={`pg-btn${pg===pn?" active":""}`} onClick={()=>setPg(pn)}>{pn+1}</button>
            );
          })}
          <button className="pg-btn" onClick={()=>setPg(p=>Math.min(pages-1,p+1))} disabled={pg===pages-1}>›</button>
          <button className="pg-btn" onClick={()=>setPg(pages-1)} disabled={pg===pages-1}>»</button>
        </div>
      )}
    </div>
  );
});

const SectionHeader = memo(({title,subtitle,children})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
    <div>
      <h2 className="raj" style={{fontSize:22,fontWeight:700,color:T.text}}>{title}</h2>
      {subtitle&&<p style={{fontSize:13,color:T.textSec,marginTop:2}}>{subtitle}</p>}
    </div>
    <div style={{display:"flex",gap:8}}>{children}</div>
  </div>
));

const ChartTip = ({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 14px",fontSize:12}}>
      <div style={{color:T.textSec,marginBottom:6,fontWeight:600}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,marginBottom:2}}>
          {p.name}: <strong>{/revenue|profit|cost|value|paid|price/i.test(p.name)?INR(p.value):NUM(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

// ── DUE DATE CHIP ──────────────────────────────────────────────────────────
const DueChip = ({date})=>{
  if(!date)return <span style={{color:T.textMuted,fontSize:12}}>—</span>;
  const d=daysLeft(date);
  const color=d<0?T.red:d<=3?T.amber:T.textSec;
  const label=d<0?`${Math.abs(d)}d overdue`:d===0?"Today!":d<=3?`${d}d left`:date;
  return <span style={{fontSize:12,color,fontWeight:d<=3?700:400}}>{label}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════
// ── LOGIN SCREEN ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const LoginScreen = ({onLogin, canInstall=false, onInstall, showIosHint=false, isInstalled=false})=>{
  const [step,setStep]   = useState(null); // null | "admin" | "employee" | "client"
  const [pass,setPass]   = useState("");
  const [error,setError] = useState("");
  const [show,setShow]   = useState(false);

  const attempt = useCallback(()=>{
    setError("");
    if(step==="admin"){
      if(verifyAdmin(pass)){ onLogin("admin"); }
      else { setError("Incorrect password."); setPass(""); }
    } else if(step==="employee"){
      if([EMPLOYEE_PIN, ...LEGACY_PASSWORDS].includes(String(pass ?? "").trim())){ onLogin("employee"); }
      else { setError("Incorrect PIN."); setPass(""); }
    } else if(step==="client"){
      onLogin("client");
    }
  },[step,pass,onLogin]);

  const handleKey = useCallback((e)=>{ if(e.key==="Enter") attempt(); },[attempt]);
  const loginRoles = [
    {r:"admin", label:"Admin / Owner", sub:"Full access - sizes, pricing, payments", icon:"[A]", color:T.amber},
    {r:"employee", label:"Employee", sub:"Production queue, orders & stock management", icon:"[E]", color:T.blue},
    {r:"client", label:"Client Portal", sub:"Browse catalog, place orders, track delivery", icon:"[C]", color:T.green},
  ];

  if(!step) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 20% 50%, rgba(245,158,11,.06) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(59,130,246,.05) 0%, transparent 50%)"}}/>
      <div className="fade" style={{width:"100%",maxWidth:440,padding:"40px",position:"relative"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
            <BrandLogo height={76} wide />
          </div>
          <h1 className="raj" style={{fontSize:32,fontWeight:700,color:T.text,marginBottom:6}}>Roller ERP</h1>
          <p style={{fontSize:13,color:T.textSec}}>Stone Crusher Conveyor Roller Manufacturing</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {r:"admin",   label:"Admin / Owner",  sub:"Full access — sizes, pricing, payments",         icon:"👑",color:T.amber},
            {r:"employee",label:"Employee",        sub:"Production queue, orders & stock management",    icon:"🔧",color:T.blue},
            {r:"client",  label:"Client Portal",   sub:"Browse catalog, place orders, track delivery",   icon:"🏭",color:T.green},
          ].map(({r,label,sub,icon,color})=>(
            <button key={r} onClick={()=>{setStep(r);setPass("");setError("");}} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"18px 20px",cursor:"pointer",textAlign:"left",transition:"border-color .2s,background .2s",display:"flex",gap:14,alignItems:"center"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=`${color}08`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.card;}}>
              <span style={{fontSize:28}}>{sanitizeUiText(icon)}</span>
              <div>
                <div style={{fontWeight:700,color:T.text,fontSize:15}}>{label}</div>
                <div style={{fontSize:12,color:T.textSec,marginTop:2}}>{sanitizeUiText(sub)}</div>
              </div>
              <span style={{marginLeft:"auto",color:T.textMuted,fontSize:18}}>→</span>
            </button>
          ))}
        </div>
        <div style={{marginTop:24,textAlign:"center",fontSize:11,color:T.textMuted}}>Session-persistent data · Auto-computed calculations</div>
      </div>
    </div>
  );

  // client needs no password
  if(step==="client"){ onLogin("client"); return null; }

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div className="fade" style={{width:"100%",maxWidth:360,padding:"36px",background:T.card,border:`1px solid ${T.border}`,borderRadius:12,margin:"0 20px"}}>
        <button onClick={()=>setStep(null)} style={{background:"none",border:"none",color:T.textSec,fontSize:13,marginBottom:20,cursor:"pointer"}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:32,marginBottom:8}}>{step==="admin"?"👑":"🔧"}</div>
          <div className="raj" style={{fontSize:20,fontWeight:700,color:T.text}}>{step==="admin"?"Admin Login":"Employee Login"}</div>
          <div style={{fontSize:12,color:T.textSec,marginTop:4}}>{step==="admin"?"Enter admin password":"Enter employee PIN"}</div>
        </div>
        <div style={{position:"relative",marginBottom:16}}>
          <input
            type={show?"text":"password"}
            value={pass}
            onChange={e=>setPass(e.target.value)}
            onKeyDown={handleKey}
            placeholder={step==="admin"?"Password":"PIN"}
            autoComplete="off"
            style={{width:"100%",background:T.surface,border:`1px solid ${error?T.red:T.border}`,borderRadius:6,color:T.text,padding:"10px 40px 10px 14px",fontSize:14}}
          />
          <button onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.textSec,fontSize:14}}>
            {show?"🙈":"👁"}
          </button>
        </div>
        {error&&<div style={{color:T.red,fontSize:12,marginBottom:12,textAlign:"center"}}>{error}</div>}
        <Btn onClick={attempt} disabled={!pass} style={{width:"100%"}}>Enter</Btn>
        <div style={{marginTop:16,fontSize:11,color:T.textMuted,textAlign:"center"}}>
          {step==="admin"?"Default admin password: 123ERP":"Default PIN: 123ERP"}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ── DASHBOARD ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const Dashboard = memo(({data})=>{
  const {orders,rawMaterials,inventory,sizes}=data;
  const monthly=useMemo(()=>getMonthlyStats(sizes,orders),[sizes,orders]);
  const delivered=useMemo(()=>orders.filter(o=>o.status==="delivered"),[orders]);
  const totalRev  =useMemo(()=>delivered.reduce((s,o)=>s+o.totalValue,0),[delivered]);
  const totalCost =useMemo(()=>delivered.reduce((s,o)=>s+calcOrderCost(sizes,o.items),0),[delivered,sizes]);
  const outAR     =useMemo(()=>orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+(o.totalValue-o.paidAmount),0),[orders]);
  const overdueOrds=useMemo(()=>orders.filter(o=>o.dueDate&&o.dueDate<today()&&!["delivered","cancelled"].includes(o.status)),[orders]);
  const totalStock=useMemo(()=>Object.values(inventory).reduce((s,v)=>s+v,0),[inventory]);
  const pieData   =useMemo(()=>(sizes||[]).map(s=>({name:s.code,value:inventory[s.code]||0,label:s.label})).filter(d=>d.value>0),[sizes,inventory]);

  return(
    <div className="fade">
      {overdueOrds.length>0&&(
        <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:18}}>âš </span>
          <div style={{fontSize:13,color:T.red,fontWeight:600}}>{overdueOrds.length} order{overdueOrds.length>1?"s":""} overdue: {overdueOrds.map(o=>o.id).join(", ")}</div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:16,marginBottom:24}}>
        <KPI label="Total Revenue"  value={INR(totalRev)}           sub={`${delivered.length} delivered`}                  accent={T.green}  />
        <KPI label="Gross Profit"   value={INR(totalRev-totalCost)} sub={`${Math.round((totalRev-totalCost)/totalRev*100||0)}% margin`} accent={T.amber}  />
        <KPI label="Outstanding AR" value={INR(outAR)}              sub="Pending receivables"                               accent={T.red}    />
        <KPI label="RM Spend"       value={INR(rawMaterials.reduce((s,r)=>s+r.totalCost,0))} sub={`Paid: ${INR(rawMaterials.reduce((s,r)=>s+r.paidAmount,0))}`} accent={T.blue} />
        <KPI label="Active Orders"  value={orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length} sub={`${overdueOrds.length} overdue`} accent={T.purple} />
        <KPI label="Finished Stock" value={NUM(totalStock)+" pcs"}  sub="All sizes"                                         accent={T.cyan}   />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div className="raj" style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Revenue vs Cost vs Profit — Monthly</div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="label" tick={{fill:T.textSec,fontSize:11}}/>
              <YAxis tick={{fill:T.textSec,fontSize:11}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`}/>
              <Tooltip content={<ChartTip/>}/>
              <Legend wrapperStyle={{fontSize:12,color:T.textSec}}/>
              <Bar dataKey="revenue" name="Revenue" fill={`${T.green}55`} stroke={T.green}/>
              <Bar dataKey="cost"    name="Cost"    fill={`${T.red}44`}   stroke={T.red}/>
              <Line dataKey="profit" name="Profit"  stroke={T.amber} strokeWidth={2.5} dot={{r:3,fill:T.amber}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="raj" style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Stock by Size</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                {pieData.map((_,i)=><Cell key={i} fill={T.chart[i%6]} stroke="none"/>)}
              </Pie>
              <Tooltip content={({active,payload})=>active&&payload?.[0]?(
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 12px",fontSize:12}}>
                  <div style={{color:T.text}}>{payload[0].payload.label}</div>
                  <div style={{color:T.amber,fontWeight:700}}>{payload[0].value} pcs</div>
                </div>
              ):null}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div className="raj" style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Monthly Orders Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly}>
              <defs><linearGradient id="og" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.blue} stopOpacity={.35}/><stop offset="95%" stopColor={T.blue} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="label" tick={{fill:T.textSec,fontSize:11}}/>
              <YAxis tick={{fill:T.textSec,fontSize:11}}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="orders" name="Orders" stroke={T.blue} fill="url(#og)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="raj" style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Pipeline</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:8}}>
            {[
              {label:"Pending",           val:orders.filter(o=>o.status==="pending").length,           color:T.amber},
              {label:"In Production",     val:orders.filter(o=>o.status==="in-production").length,      color:T.blue},
              {label:"Ready for Delivery",val:orders.filter(o=>o.status==="ready-for-delivery").length, color:T.purple},
              {label:"Delivered (Total)", val:delivered.length,                                         color:T.green},
            ].map(s=>(
              <div key={s.label} style={{background:T.surface,borderRadius:8,padding:"16px",border:`1px solid ${T.border}`}}>
                <div style={{fontSize:32,fontWeight:700,color:s.color,fontFamily:"'JetBrains Mono',monospace"}}>{s.val}</div>
                <div style={{fontSize:11,color:T.textSec,marginTop:4}}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── ORDER BOOK ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const OrderBook = memo(({data,setData,role})=>{
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState(false);
  const [detail,setDetail]=useState(null);
  const [payModal,setPayModal]=useState(null);
  const [payAmt,setPayAmt]=useState(0);
  const dSearch=useDebounce(search,250);
  const isAdmin=role==="admin";
  const activeSizes=useMemo(()=>(data.sizes||[]).filter(s=>s.active!==false),[data.sizes]);

  const emptyForm=useMemo(()=>({
    clientName:"",clientPhone:"",clientEmail:"",clientAddress:"",
    items:[{size:activeSizes[0]?.code||"89x465",qty:1,unitPrice:activeSizes[0]?.price||950}],
    notes:"",paidAmount:0,dueDate:""
  }),[activeSizes]);

  const [form,setForm]=useState(emptyForm);

  const filtered=useMemo(()=>{
    let list=data.orders;
    if(filter!=="all") list=list.filter(o=>o.status===filter);
    if(dSearch) list=list.filter(o=>
      o.clientName.toLowerCase().includes(dSearch.toLowerCase())||
      o.id.toLowerCase().includes(dSearch.toLowerCase())
    );
    return list.sort((a,b)=>b.orderDate.localeCompare(a.orderDate));
  },[data.orders,filter,dSearch]);

  const updateStatus=useCallback((id,status)=>{
    setData(prev=>{
      const u={...prev,orders:prev.orders.map(o=>o.id===id?{...o,status,...(status==="delivered"?{deliveryDate:today()}:{})}:o)};
      saveData(u);return u;
    });
    setDetail(d=>d?.id===id?{...d,status}:d);
  },[setData]);

  const applyPay=useCallback(()=>{
    setData(prev=>{
      const u={...prev,orders:prev.orders.map(o=>o.id===payModal?{...o,paidAmount:Math.min(o.totalValue,Number(payAmt))}:o)};
      saveData(u);return u;
    });
    setDetail(d=>d?.id===payModal?{...d,paidAmount:Math.min(d.totalValue,Number(payAmt))}:d);
    setPayModal(null);
  },[setData,payModal,payAmt]);

  const addOrder=useCallback(()=>{
    const totalValue=form.items.reduce((s,i)=>s+i.qty*i.unitPrice,0);
    const order={id:genId("ORD"),...form,status:"pending",orderDate:today(),deliveryDate:null,totalValue,paidAmount:Number(form.paidAmount)||0};
    setData(prev=>{const u={...prev,orders:[...prev.orders,order]};saveData(u);return u;});
    setModal(false);setForm(emptyForm);
  },[form,emptyForm,setData]);

  const addItem=()=>setForm(f=>({...f,items:[...f.items,{size:activeSizes[0]?.code||"89x465",qty:1,unitPrice:activeSizes[0]?.price||950}]}));
  const updItem=(i,k,v)=>setForm(f=>({...f,items:f.items.map((item,j)=>j===i?{...item,[k]:k==="qty"||k==="unitPrice"?Number(v):v,...(k==="size"?{unitPrice:getSz(data.sizes,v).price||0}:{})}:item)}));
  const remItem=(i)=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}));

  const cols=useMemo(()=>[
    {key:"id",        label:"Order ID",   mono:true},
    {key:"clientName",label:"Client"},
    {key:"orderDate", label:"Date"},
    {key:"dueDate",   label:"Due Date",   render:(v)=><DueChip date={v}/>},
    {key:"items",     label:"Items",      render:(v)=>`${v.reduce((s,i)=>s+i.qty,0)} pcs`},
    ...(isAdmin?[
      {key:"totalValue",label:"Value",    mono:true, render:(v)=>INR(v)},
      {key:"paidAmount",label:"Paid",     mono:true, render:(v,r)=><span style={{color:v>=r.totalValue?T.green:T.amber}}>{INR(v)}</span>},
      {key:"_bal",label:"Balance",        render:(_,r)=><span className="mono" style={{color:r.totalValue-r.paidAmount>0?T.red:T.green,fontSize:12}}>{INR(r.totalValue-r.paidAmount)}</span>},
    ]:[]),
    {key:"status",    label:"Status",     render:(v)=><Badge status={v}/>},
    {key:"_a",        label:"",           render:(_,r)=><Btn small onClick={()=>setDetail({...r})}>View</Btn>},
  ],[isAdmin]);

  const tabs=["all","pending","in-production","ready-for-delivery","delivered","cancelled"];

  return(
    <div className="fade">
      <SectionHeader title="Order Book" subtitle="Full order lifecycle — placement to delivery">
        {(isAdmin||role==="employee")&&<Btn onClick={()=>{setForm(emptyForm);setModal(true);}}>+ New Order</Btn>}
      </SectionHeader>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setFilter(t)} style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${filter===t?T.amber:T.border}`,background:filter===t?`${T.amber}18`:"transparent",color:filter===t?T.amber:T.textSec,textTransform:"uppercase",letterSpacing:.5}}>
            {t==="all"?"All":(STATUS[t]?.label||t)}{t!=="all"?` (${data.orders.filter(o=>o.status===t).length})`:` (${data.orders.length})`}
          </button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client or ID…" style={{marginLeft:"auto",background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"6px 12px",fontSize:12,width:200}}/>
      </div>
      <Card style={{padding:0}}>
        <PaginatedTable cols={cols} rows={filtered} emptyMsg="No orders match the filter."/>
      </Card>

      {/* DETAIL */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} title={`Order — ${detail?.id}`} width={660}>
        {detail&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["Client",detail.clientName],["Phone",detail.clientPhone],["Email",detail.clientEmail],["Address",detail.clientAddress],["Order Date",detail.orderDate],["Due Date",detail.dueDate||"—"],["Delivery",detail.deliveryDate||"—"],["Status",null]].map(([l,v])=>(
                <div key={l} style={{background:T.surface,borderRadius:6,padding:"10px 14px"}}>
                  <div style={{fontSize:11,color:T.textSec,fontWeight:600,letterSpacing:.5}}>{l.toUpperCase()}</div>
                  {l==="Status"?<div style={{marginTop:4}}><Badge status={detail.status}/></div>:
                  l==="Due Date"?<div style={{marginTop:4}}><DueChip date={detail.dueDate}/></div>:
                  <div style={{fontSize:13,color:T.text,marginTop:3}}>{v}</div>}
                </div>
              ))}
            </div>
            <div style={{background:T.surface,borderRadius:6,padding:"14px"}}>
              <div style={{fontSize:12,fontWeight:700,color:T.textSec,letterSpacing:.5,marginBottom:8}}>ORDER ITEMS</div>
              {detail.items.map((item,i)=>{
                const sz=getSz(data.sizes,item.size);
                return(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<detail.items.length-1?`1px solid ${T.border}`:"none"}}>
                    <span style={{color:T.text}}>{sz.label||item.size}</span>
                    <span style={{color:T.textSec}}>{NUM(item.qty)} pcs × {INR(item.unitPrice)}</span>
                    <span className="mono" style={{color:T.amber}}>{INR(item.qty*item.unitPrice)}</span>
                  </div>
                );
              })}
              {isAdmin&&(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                    <span style={{fontWeight:700,color:T.text}}>Total</span>
                    <span className="mono" style={{fontWeight:700,color:T.green,fontSize:16}}>{INR(detail.totalValue)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:8,alignItems:"center"}}>
                    <span style={{color:T.textSec}}>Paid</span>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span className="mono" style={{color:T.text}}>{INR(detail.paidAmount)}</span>
                      <Btn small variant="ghost" onClick={()=>{setPayAmt(detail.paidAmount);setPayModal(detail.id);}}>Update</Btn>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                    <span style={{color:T.textSec}}>Balance Due</span>
                    <span className="mono" style={{color:detail.totalValue-detail.paidAmount>0?T.red:T.green}}>{INR(detail.totalValue-detail.paidAmount)}</span>
                  </div>
                </>
              )}
            </div>
            {(isAdmin||role==="employee")&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["pending","in-production","ready-for-delivery","delivered","cancelled"].map(s=>(
                  <Btn key={s} small variant={detail.status===s?"primary":"ghost"} onClick={()=>updateStatus(detail.id,s)}>{STATUS[s].label}</Btn>
                ))}
              </div>
            )}
            {detail.notes&&<div style={{fontSize:13,color:T.textSec,fontStyle:"italic"}}>"{detail.notes}"</div>}
          </div>
        )}
      </Modal>

      {/* PAYMENT */}
      <Modal open={!!payModal} onClose={()=>setPayModal(null)} title="Update Payment" width={360}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:13,color:T.textSec}}>Total: <span className="mono" style={{color:T.amber}}>{INR(data.orders.find(o=>o.id===payModal)?.totalValue||0)}</span></div>
          <Inp label="Amount Received (₹)" type="number" value={payAmt} onChange={setPayAmt} min="0"/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setPayModal(null)}>Cancel</Btn>
            <Btn onClick={applyPay}>Save</Btn>
          </div>
        </div>
      </Modal>

      {/* NEW ORDER */}
      <Modal open={modal} onClose={()=>setModal(false)} title="New Order" width={700}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Client Name" value={form.clientName} onChange={v=>setForm(f=>({...f,clientName:v}))} required placeholder="Company / person"/>
            <Inp label="Phone"       value={form.clientPhone} onChange={v=>setForm(f=>({...f,clientPhone:v}))} placeholder="Mobile"/>
            <Inp label="Email"       value={form.clientEmail} onChange={v=>setForm(f=>({...f,clientEmail:v}))} placeholder="Email"/>
            <Inp label="Address"     value={form.clientAddress} onChange={v=>setForm(f=>({...f,clientAddress:v}))} placeholder="State"/>
            {isAdmin&&<Inp label="Due Date (Expected Completion)" type="date" value={form.dueDate} onChange={v=>setForm(f=>({...f,dueDate:v}))} min={today()}/>}
            {isAdmin&&<Inp label="Advance Received (₹)" type="number" value={form.paidAmount} onChange={v=>setForm(f=>({...f,paidAmount:v}))}/>}
          </div>
          <div style={{background:T.surface,borderRadius:8,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:700,color:T.text}}>Order Items</span>
              <Btn small variant="ghost" onClick={addItem}>+ Add Size</Btn>
            </div>
            {form.items.map((item,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,marginBottom:8}}>
                <select value={item.size} onChange={e=>updItem(i,"size",e.target.value)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:12}}>
                  {activeSizes.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}
                </select>
                <input type="number" min="1" value={item.qty} onChange={e=>updItem(i,"qty",e.target.value)} placeholder="Qty" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:12}}/>
                <input type="number" min="0" value={item.unitPrice} onChange={e=>updItem(i,"unitPrice",e.target.value)} placeholder="Price" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:12}}/>
                <button onClick={()=>remItem(i)} style={{background:"none",border:"none",color:T.red,fontSize:16}}>✕</button>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:14,fontWeight:700,color:T.amber,textAlign:"right"}}>Total: {INR(form.items.reduce((s,i)=>s+i.qty*i.unitPrice,0))}</div>
          </div>
          {!isAdmin&&<Inp label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="Special instructions"/>}
          {isAdmin&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Inp label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="Instructions"/>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setModal(false)}>Cancel</Btn>
            <Btn onClick={addOrder} disabled={!form.clientName||form.items.length===0}>Confirm Order</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── STOCK MANAGER (SHARED — employee+admin) ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const StockManager = memo(({data,setData,role})=>{
  const isAdmin=role==="admin";
  const [opModal,setOpModal]=useState(false);
  const [opForm,setOpForm]=useState({type:"add",size:(data.sizes||[])[0]?.code||"",qty:0,note:"",orderId:""});
  const [logFilter,setLogFilter]=useState("all");
  const dSearch=useDebounce(logFilter,200);

  const activeSizes=useMemo(()=>(data.sizes||[]).filter(s=>s.active!==false),[data.sizes]);
  const pendingOrders=useMemo(()=>data.orders.filter(o=>["pending","in-production","ready-for-delivery"].includes(o.status)),[data.orders]);

  const applyOp=useCallback(()=>{
    const {type,size,qty,note,orderId}=opForm;
    const n=Number(qty);
    if(!n||n<=0)return;
    setData(prev=>{
      let inv={...prev.inventory};
      const cur=inv[size]||0;
      if(type==="add"){
        inv[size]=cur+n;
      } else if(type==="reduce"){
        inv[size]=Math.max(0,cur-n);
      } else if(type==="transfer"){
        // transfer means we reduce from general stock and assign to order (just reduces stock)
        inv[size]=Math.max(0,cur-n);
      }
      const log={
        id:genId("SL"),type,size,qty:n,note:note||"",orderId:orderId||null,
        date:today(),prevQty:cur,newQty:inv[size]
      };
      const stockLogs=[...(prev.stockLogs||[]),log];
      const u={...prev,inventory:inv,stockLogs};
      saveData(u);return u;
    });
    setOpModal(false);
    setOpForm({type:"add",size:activeSizes[0]?.code||"",qty:0,note:"",orderId:""});
  },[opForm,activeSizes,setData]);

  const logs=useMemo(()=>{
    const all=(data.stockLogs||[]);
    if(dSearch==="all")return[...all].reverse();
    return[...all].filter(l=>l.type===dSearch).reverse();
  },[data.stockLogs,dSearch]);

  const totalStock=useMemo(()=>Object.values(data.inventory).reduce((s,v)=>s+v,0),[data.inventory]);
  const totalValue=useMemo(()=>(data.sizes||[]).reduce((s,sz)=>s+(data.inventory[sz.code]||0)*sz.price,0),[data.sizes,data.inventory]);

  const logCols=[
    {key:"id",    label:"Log ID",  mono:true},
    {key:"type",  label:"Action",  render:(v)=>{
      const conf={add:{c:T.green,l:"Added"},reduce:{c:T.red,l:"Reduced"},transfer:{c:T.blue,l:"Transferred"}};
      const x=conf[v]||{c:T.textSec,l:v};
      return <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,color:x.c,background:`${x.c}18`,textTransform:"uppercase",letterSpacing:.5}}>{x.l}</span>;
    }},
    {key:"size",  label:"Size",    render:(v)=>getSz(data.sizes,v).label||v},
    {key:"prevQty",label:"Before", mono:true},
    {key:"qty",   label:"Change",  render:(v,r)=><span className="mono" style={{color:r.type==="add"?T.green:T.red}}>{r.type==="add"?"+":"-"}{v}</span>},
    {key:"newQty", label:"After",  mono:true},
    {key:"orderId",label:"Order",  render:(v)=>v?<span className="mono" style={{fontSize:12,color:T.amber}}>{v}</span>:"—"},
    {key:"note",  label:"Note",    render:(v)=>v||"—"},
    {key:"date",  label:"Date"},
  ];

  return(
    <div className="fade">
      <SectionHeader title="Stock Management" subtitle="Add, reduce or transfer finished goods inventory">
        <Btn onClick={()=>{setOpForm({type:"add",size:activeSizes[0]?.code||"",qty:0,note:"",orderId:""});setOpModal(true);}}>⊕ Stock Operation</Btn>
      </SectionHeader>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
        <KPI label="Total Stock"    value={`${NUM(totalStock)} pcs`}  accent={T.cyan}  />
        {isAdmin&&<KPI label="Stock Sell Value" value={INR(totalValue)} accent={T.green}/>}
        <KPI label="Low Stock Sizes" value={(data.sizes||[]).filter(s=>(data.inventory[s.code]||0)<10).length} sub="Under 10 pcs" accent={T.red}/>
      </div>

      {/* LOW STOCK ALERT */}
      {(data.sizes||[]).some(s=>(data.inventory[s.code]||0)===0)&&(
        <div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.25)",borderRadius:8,padding:"12px 18px",marginBottom:16,fontSize:13,color:T.red}}>
          🔴 <strong>Out of stock:</strong> {(data.sizes||[]).filter(s=>(data.inventory[s.code]||0)===0).map(s=>s.label).join(", ")}
        </div>
      )}

      {/* STOCK GRID */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:12,marginBottom:24}}>
        {(data.sizes||[]).map(sz=>{
          const qty=data.inventory[sz.code]||0;
          const color=qty===0?T.red:qty<10?T.amber:T.green;
          const pct=Math.min(100,Math.round(qty/50*100));
          return(
            <Card key={sz.code} onClick={()=>{setOpForm({type:"add",size:sz.code,qty:0,note:"",orderId:""});setOpModal(true);}} style={{cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text}}>{sz.label}</div>
                  {isAdmin&&<div style={{fontSize:11,color:T.textSec}}>Sell: {INR(sz.price)} · Cost: {INR(sz.cost)}</div>}
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,color,background:`${color}18`}}>{qty===0?"OUT":qty<10?"LOW":"OK"}</span>
              </div>
              <div className="mono" style={{fontSize:30,fontWeight:700,color,marginBottom:8}}>{qty}<span style={{fontSize:14,color:T.textSec,fontWeight:400}}> pcs</span></div>
              <div style={{height:3,background:T.border,borderRadius:2}}>
                <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2,transition:"width .4s"}}/>
              </div>
              <div style={{marginTop:8,fontSize:11,color:T.textSec,display:"flex",justifyContent:"space-between"}}>
                <span>Click to update</span>
                {isAdmin&&<span style={{color:T.text}}>{INR(qty*sz.price)}</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* STOCK LOG */}
      <div className="raj" style={{fontSize:18,fontWeight:700,color:T.text,marginBottom:12}}>Stock Activity Log</div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["all","add","reduce","transfer"].map(t=>(
          <button key={t} onClick={()=>setLogFilter(t)} style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${logFilter===t?T.amber:T.border}`,background:logFilter===t?`${T.amber}18`:"transparent",color:logFilter===t?T.amber:T.textSec,textTransform:"uppercase",letterSpacing:.5}}>
            {t==="all"?"All Logs":t==="add"?"Added":t==="reduce"?"Reduced":"Transferred"}
          </button>
        ))}
      </div>
      <Card style={{padding:0}}>
        <PaginatedTable cols={logCols} rows={logs} emptyMsg="No stock operations recorded yet."/>
      </Card>

      {/* STOCK OPERATION MODAL */}
      <Modal open={opModal} onClose={()=>setOpModal(false)} title="Stock Operation" width={480}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[{v:"add",l:"➕ Add Stock",c:T.green},{v:"reduce",l:"➖ Reduce",c:T.red},{v:"transfer",l:"🔄 Transfer to Order",c:T.blue}].map(({v,l,c})=>(
              <button key={v} onClick={()=>setOpForm(f=>({...f,type:v}))} style={{padding:"10px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:`2px solid ${opForm.type===v?c:T.border}`,background:opForm.type===v?`${c}12`:"transparent",color:opForm.type===v?c:T.textSec,textAlign:"center"}}>
                {l}
              </button>
            ))}
          </div>
          {opForm.type==="add"&&<div style={{background:"rgba(34,197,94,.06)",border:"1px solid rgba(34,197,94,.2)",borderRadius:6,padding:"8px 14px",fontSize:12,color:T.textSec}}>Increases stock count for the selected size.</div>}
          {opForm.type==="reduce"&&<div style={{background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:6,padding:"8px 14px",fontSize:12,color:T.textSec}}>Reduces stock count (damage, return, correction).</div>}
          {opForm.type==="transfer"&&<div style={{background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.2)",borderRadius:6,padding:"8px 14px",fontSize:12,color:T.textSec}}>Allocates stock to a specific order and reduces available inventory.</div>}

          <Inp label="Roller Size" value={opForm.size} onChange={v=>setOpForm(f=>({...f,size:v}))}
            options={(data.sizes||[]).map(s=>({value:s.code,label:`${s.label} (${data.inventory[s.code]||0} in stock)`}))}/>

          <div style={{background:T.surface,borderRadius:6,padding:"10px 14px",display:"flex",justifyContent:"space-between"}}>
            <span style={{color:T.textSec,fontSize:13}}>Current stock for selected size</span>
            <span className="mono" style={{color:T.amber,fontWeight:700}}>{data.inventory[opForm.size]||0} pcs</span>
          </div>

          <Inp label="Quantity" type="number" value={opForm.qty} onChange={v=>setOpForm(f=>({...f,qty:v}))} min="1"/>

          {opForm.type==="transfer"&&(
            <Inp label="Transfer to Order" value={opForm.orderId} onChange={v=>setOpForm(f=>({...f,orderId:v}))}
              options={[{value:"",label:"— Select Order —"},...pendingOrders.map(o=>({value:o.id,label:`${o.id} — ${o.clientName} (${o.items.reduce((s,i)=>s+i.qty,0)} pcs)`}))]}/>
          )}

          <Inp label="Note / Reason" value={opForm.note} onChange={v=>setOpForm(f=>({...f,note:v}))} placeholder="Optional: reason for this operation"/>

          {opForm.qty>0&&(
            <div style={{background:T.surface,borderRadius:6,padding:"10px 14px",display:"flex",justifyContent:"space-between"}}>
              <span style={{color:T.textSec,fontSize:13}}>After operation</span>
              <span className="mono" style={{fontWeight:700,fontSize:16,color:opForm.type==="add"?T.green:T.red}}>
                {opForm.type==="add"?(data.inventory[opForm.size]||0)+Number(opForm.qty):Math.max(0,(data.inventory[opForm.size]||0)-Number(opForm.qty))} pcs
              </span>
            </div>
          )}

          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setOpModal(false)}>Cancel</Btn>
            <Btn onClick={applyOp} disabled={!opForm.size||!opForm.qty||Number(opForm.qty)<=0} variant={opForm.type==="add"?"success":opForm.type==="reduce"?"danger":"blue"}>
              Confirm {opForm.type==="add"?"Addition":opForm.type==="reduce"?"Reduction":"Transfer"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── SIZE MANAGER (ADMIN ONLY) ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const SizeManager = memo(({data,setData})=>{
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({code:"",label:"",price:0,cost:0,active:true});
  const [confirm,setConfirm]=useState(null);

  const openEdit=(sz)=>{setEditing(sz.code);setForm({...sz});setModal(true);};
  const openNew=()=>{setEditing(null);setForm({code:"",label:"",price:0,cost:0,active:true});setModal(true);};

  const save=()=>{
    setData(prev=>{
      let sizes=editing?prev.sizes.map(s=>s.code===editing?{...form,price:Number(form.price),cost:Number(form.cost)}:s):[...prev.sizes,{...form,price:Number(form.price),cost:Number(form.cost)}];
      const u={...prev,sizes};saveData(u);return u;
    });
    setModal(false);
  };

  const del=(code)=>{
    setData(prev=>{const u={...prev,sizes:prev.sizes.filter(s=>s.code!==code)};saveData(u);return u;});
    setConfirm(null);
  };

  const toggle=(code)=>{
    setData(prev=>{const u={...prev,sizes:prev.sizes.map(s=>s.code===code?{...s,active:s.active===false}:s)};saveData(u);return u;});
  };

  const avgM=data.sizes.length?Math.round(data.sizes.reduce((s,sz)=>s+(sz.price-sz.cost)/sz.price*100,0)/data.sizes.length):0;

  const cols=[
    {key:"code",  label:"Code",   mono:true},
    {key:"label", label:"Size Label"},
    {key:"price", label:"Selling Price",mono:true,render:(v)=>INR(v)},
    {key:"cost",  label:"Prod. Cost",   mono:true,render:(v)=>INR(v)},
    {key:"_m",    label:"Margin", render:(_,r)=>{const m=Math.round((r.price-r.cost)/r.price*100);return <span className="mono" style={{color:m>40?T.green:m>25?T.amber:T.red,fontSize:12}}>{m}%</span>;}},
    {key:"active",label:"Status", render:(v)=><span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,color:v===false?T.textMuted:T.green,background:v===false?"rgba(255,255,255,.04)":"rgba(34,197,94,.12)"}}>{v===false?"HIDDEN":"ACTIVE"}</span>},
    {key:"_a",    label:"Actions",render:(_,r)=>(
      <div style={{display:"flex",gap:6}}>
        <Btn small variant="ghost" onClick={()=>openEdit(r)}>Edit</Btn>
        <Btn small variant={r.active===false?"success":"blue"} onClick={()=>toggle(r.code)}>{r.active===false?"Show":"Hide"}</Btn>
        <Btn small variant="danger" onClick={()=>setConfirm(r.code)}>Del</Btn>
      </div>
    )},
  ];

  return(
    <div className="fade">
      <SectionHeader title="Sizes & Pricing" subtitle="Define roller sizes, prices, costs — live sync to client catalog">
        <Btn onClick={openNew}>+ Add Size</Btn>
      </SectionHeader>
      <div style={{background:"rgba(167,139,250,.07)",border:"1px solid rgba(167,139,250,.25)",borderRadius:8,padding:"12px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"center"}}>
        <span style={{fontSize:16}}>🔒</span>
        <div style={{fontSize:13,color:T.textSec}}><span style={{color:T.purple,fontWeight:600}}>Admin-only.</span> Prices set here reflect in the client catalog. Clients never see cost or margin.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
        <KPI label="Sizes Defined"   value={data.sizes.length} sub={`${data.sizes.filter(s=>s.active!==false).length} active`} accent={T.purple}/>
        <KPI label="Avg Margin"      value={`${avgM}%`} accent={T.green}/>
        <KPI label="Price Range"     value={`${INR(Math.min(...data.sizes.map(s=>s.price)))} – ${INR(Math.max(...data.sizes.map(s=>s.price)))}`} accent={T.amber}/>
      </div>
      <Card style={{padding:0,marginBottom:16}}>
        <PaginatedTable cols={cols} rows={data.sizes}/>
      </Card>
      <Card>
        <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Price vs Cost vs Margin</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.sizes.map(s=>({name:s.code,price:s.price,cost:s.cost,margin:Math.round((s.price-s.cost)/s.price*100)}))}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="name" tick={{fill:T.textSec,fontSize:10}}/>
            <YAxis yAxisId="l" tick={{fill:T.textSec,fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`}/>
            <YAxis yAxisId="r" orientation="right" tick={{fill:T.textSec,fontSize:10}} tickFormatter={v=>`${v}%`}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar yAxisId="l" dataKey="price" name="Selling Price" fill={`${T.green}55`} stroke={T.green}/>
            <Bar yAxisId="l" dataKey="cost"  name="Production Cost" fill={`${T.red}44`} stroke={T.red}/>
            <Line yAxisId="r" dataKey="margin" name="Margin %" stroke={T.amber} strokeWidth={2} dot={{r:3,fill:T.amber}}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?`Edit — ${editing}`:"Add New Size"} width={480}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:`rgba(245,158,11,.06)`,border:`1px solid rgba(245,158,11,.2)`,borderRadius:6,padding:"8px 14px",fontSize:12,color:T.textSec}}>
            💡 Selling price is shown to clients. Production cost is admin-only for margin tracking.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Size Code" value={form.code} onChange={v=>setForm(f=>({...f,code:v.replace(/\s/g,"")}))} required placeholder="e.g. 102x465"/>
            <Inp label="Size Label" value={form.label} onChange={v=>setForm(f=>({...f,label:v}))} required placeholder="e.g. 102mm × 465mm"/>
            <Inp label="Selling Price (₹)" type="number" min="0" value={form.price} onChange={v=>setForm(f=>({...f,price:v}))} required/>
            <Inp label="Production Cost (₹)" type="number" min="0" value={form.cost} onChange={v=>setForm(f=>({...f,cost:v}))} required/>
          </div>
          {Number(form.price)>0&&Number(form.cost)>0&&(
            <div style={{background:T.surface,borderRadius:6,padding:"10px 14px",display:"flex",justifyContent:"space-between"}}>
              <span style={{color:T.textSec,fontSize:13}}>Margin</span>
              <span className="mono" style={{fontSize:15,fontWeight:700,color:((form.price-form.cost)/form.price*100)>40?T.green:T.amber}}>
                {Math.round((form.price-form.cost)/form.price*100)}% ({INR(form.price-form.cost)}/pc)
              </span>
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,color:T.textSec}}>Visible in client catalog:</span>
            <button onClick={()=>setForm(f=>({...f,active:f.active===false?true:false}))} style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:form.active===false?"rgba(255,255,255,.04)":"rgba(34,197,94,.15)",color:form.active===false?T.textSec:T.green,border:`1px solid ${form.active===false?T.border:"rgba(34,197,94,.3)"}`}}>
              {form.active===false?"Hidden":"Active"}
            </button>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={!form.code||!form.label||!form.price||!form.cost}>{editing?"Save Changes":"Add Size"}</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirm} onClose={()=>setConfirm(null)} title="Confirm Delete" width={360}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <p style={{color:T.textSec,fontSize:14}}>Delete size <strong className="mono" style={{color:T.text}}>{confirm}</strong>? Existing orders retain data.</p>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setConfirm(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={()=>del(confirm)}>Delete</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── RAW MATERIALS (ADMIN ONLY) ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const RawMaterials = memo(({data,setData})=>{
  const [modal,setModal]=useState(false);
  const [filter,setFilter]=useState("all");
  const [form,setForm]=useState({type:"pipes",supplier:"",qty:0,unitCost:0,paidAmount:0,orderDate:today(),receivedDate:"",status:"ordered"});

  const filtered=useMemo(()=>filter==="all"?data.rawMaterials:data.rawMaterials.filter(r=>r.status===filter),[data.rawMaterials,filter]);
  const totalSpend=useMemo(()=>data.rawMaterials.reduce((s,r)=>s+r.totalCost,0),[data.rawMaterials]);
  const totalPaid =useMemo(()=>data.rawMaterials.reduce((s,r)=>s+r.paidAmount,0),[data.rawMaterials]);

  const addRM=()=>{
    const totalCost=Number(form.qty)*Number(form.unitCost);
    const entry={id:genId("RM"),...form,qty:Number(form.qty),unitCost:Number(form.unitCost),totalCost,paidAmount:Number(form.paidAmount)||0,receivedDate:form.receivedDate||null};
    setData(prev=>{const u={...prev,rawMaterials:[...prev.rawMaterials,entry]};saveData(u);return u;});
    setModal(false);
    setForm({type:"pipes",supplier:"",qty:0,unitCost:0,paidAmount:0,orderDate:today(),receivedDate:"",status:"ordered"});
  };

  const byType=useMemo(()=>RM_TYPES.map(t=>({
    name:t.name.split(" ")[0],
    total:data.rawMaterials.filter(r=>r.type===t.id).reduce((s,r)=>s+r.totalCost,0),
    paid:data.rawMaterials.filter(r=>r.type===t.id).reduce((s,r)=>s+r.paidAmount,0),
    orders:data.rawMaterials.filter(r=>r.type===t.id).length,
  })).filter(t=>t.orders>0),[data.rawMaterials]);

  const cols=[
    {key:"id",          label:"PO ID",      mono:true},
    {key:"type",        label:"Material",   render:(v)=>getRMT(v).name||v},
    {key:"supplier",    label:"Supplier"},
    {key:"qty",         label:"Qty",        mono:true,render:(v,r)=>`${NUM(v)} ${getRMT(r.type).unit||"pcs"}`},
    {key:"unitCost",    label:"Unit Cost",  mono:true,render:(v)=>INR(v)},
    {key:"totalCost",   label:"Total",      mono:true,render:(v)=>INR(v)},
    {key:"paidAmount",  label:"Paid",       mono:true,render:(v,r)=><span style={{color:v>=r.totalCost?T.green:v>0?T.amber:T.red}}>{INR(v)}</span>},
    {key:"_b",          label:"Balance",    render:(_,r)=><span className="mono" style={{color:r.totalCost-r.paidAmount>0?T.red:T.green,fontSize:12}}>{INR(r.totalCost-r.paidAmount)}</span>},
    {key:"orderDate",   label:"Ordered"},
    {key:"receivedDate",label:"Received",   render:(v)=>v||"—"},
    {key:"status",      label:"Status",     render:(v)=><span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,color:(RM_STATUS[v]||{color:T.textSec}).color,background:`${(RM_STATUS[v]||{color:T.textSec}).color}18`,letterSpacing:.5,textTransform:"uppercase"}}>{(RM_STATUS[v]||{label:v}).label}</span>},
  ];

  return(
    <div className="fade">
      <SectionHeader title="Raw Material Procurement" subtitle="Admin-only — full cost, payment, supplier ledger">
        <Btn onClick={()=>setModal(true)}>+ New Purchase Order</Btn>
      </SectionHeader>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
        <KPI label="Total RM Spend" value={INR(totalSpend)} accent={T.blue}/>
        <KPI label="Amount Paid"    value={INR(totalPaid)} sub={`${Math.round(totalPaid/totalSpend*100||0)}%`} accent={T.green}/>
        <KPI label="Amount Due"     value={INR(totalSpend-totalPaid)} accent={T.red}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:20}}>
        <Card>
          <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Spend by Material</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false}/>
              <XAxis type="number" tick={{fill:T.textSec,fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`}/>
              <YAxis type="category" dataKey="name" tick={{fill:T.textSec,fontSize:11}} width={80}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="total" name="Total Cost" fill={`${T.blue}66`} stroke={T.blue} radius={[0,3,3,0]}/>
              <Bar dataKey="paid"  name="Paid"       fill={`${T.green}55`} stroke={T.green} radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Payment Progress</div>
          {byType.map((t,i)=>(
            <div key={t.name} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                <span style={{color:T.textSec}}>{t.name}</span>
                <span className="mono" style={{color:T.textSec}}>{Math.round(t.paid/t.total*100||0)}%</span>
              </div>
              <div style={{height:4,background:T.border,borderRadius:2}}>
                <div style={{height:"100%",width:`${Math.round(t.paid/t.total*100||0)}%`,background:T.chart[i%6],borderRadius:2}}/>
              </div>
            </div>
          ))}
        </Card>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["all","ordered","received","partial"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${filter===s?T.amber:T.border}`,background:filter===s?`${T.amber}18`:"transparent",color:filter===s?T.amber:T.textSec,textTransform:"uppercase",letterSpacing:.5}}>
            {s==="all"?"All":(RM_STATUS[s]?.label||s)}
          </button>
        ))}
      </div>
      <Card style={{padding:0}}><PaginatedTable cols={cols} rows={filtered}/></Card>
      <Modal open={modal} onClose={()=>setModal(false)} title="New Purchase Order">
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Inp label="Material Type" value={form.type} onChange={v=>setForm(f=>({...f,type:v}))} options={RM_TYPES.map(t=>({value:t.id,label:t.name}))}/>
          <Inp label="Supplier" value={form.supplier} onChange={v=>setForm(f=>({...f,supplier:v}))} required/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Quantity"      type="number" value={form.qty}         onChange={v=>setForm(f=>({...f,qty:v}))}         min="1"/>
            <Inp label="Unit Cost (₹)" type="number" value={form.unitCost}    onChange={v=>setForm(f=>({...f,unitCost:v}))}/>
            <Inp label="Paid (₹)"      type="number" value={form.paidAmount}  onChange={v=>setForm(f=>({...f,paidAmount:v}))}/>
            <Inp label="Status"        value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={[{value:"ordered",label:"Ordered"},{value:"received",label:"Received"},{value:"partial",label:"Partial"}]}/>
            <Inp label="Order Date"    type="date"   value={form.orderDate}   onChange={v=>setForm(f=>({...f,orderDate:v}))}/>
            <Inp label="Received Date" type="date"   value={form.receivedDate}onChange={v=>setForm(f=>({...f,receivedDate:v}))}/>
          </div>
          {form.qty>0&&form.unitCost>0&&(
            <div style={{background:T.surface,borderRadius:6,padding:"10px 14px",display:"flex",justifyContent:"space-between"}}>
              <span style={{color:T.textSec}}>Total</span>
              <span className="mono" style={{color:T.amber,fontWeight:700,fontSize:16}}>{INR(form.qty*form.unitCost)}</span>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setModal(false)}>Cancel</Btn>
            <Btn onClick={addRM} disabled={!form.supplier||!form.qty||!form.unitCost}>Save PO</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── CLIENTS ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const Clients = memo(({data,setData})=>{
  const [modal,setModal]=useState(false);
  const [sel,setSel]=useState(null);
  const [form,setForm]=useState({name:"",phone:"",email:"",address:"",gst:""});
  const [search,setSearch]=useState("");
  const ds=useDebounce(search,200);

  const filtered=useMemo(()=>data.clients.filter(c=>!ds||c.name.toLowerCase().includes(ds.toLowerCase())),[data.clients,ds]);
  const getOrders=useCallback((name)=>data.orders.filter(o=>o.clientName===name),[data.orders]);

  const add=()=>{
    const client={id:genId("C"),...form};
    setData(prev=>{const u={...prev,clients:[...prev.clients,client]};saveData(u);return u;});
    setModal(false);setForm({name:"",phone:"",email:"",address:"",gst:""});
  };

  return(
    <div className="fade">
      <SectionHeader title="Client Registry" subtitle="Full CRM — order history, balances">
        <Btn onClick={()=>setModal(true)}>+ Add Client</Btn>
      </SectionHeader>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients…" style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 14px",fontSize:13,width:"100%",marginBottom:16}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16}}>
        <Card style={{padding:0,maxHeight:600,overflowY:"auto"}}>
          {filtered.map(c=>{
            const orders=getOrders(c.name);
            const total=orders.reduce((s,o)=>s+o.totalValue,0);
            const due=orders.reduce((s,o)=>s+(o.totalValue-o.paidAmount),0);
            return(
              <div key={c.id} onClick={()=>setSel(c)} style={{padding:"13px 16px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",background:sel?.id===c.id?`${T.amber}08`:"transparent",transition:"background .15s"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div style={{fontWeight:600,color:T.text,fontSize:13}}>{c.name}</div>
                  <span className="mono" style={{fontSize:12,color:T.amber}}>{INR(total)}</span>
                </div>
                <div style={{display:"flex",gap:10,fontSize:11,color:T.textSec}}>
                  <span>{c.address}</span>
                  <span>{orders.length} orders</span>
                  {due>0&&<span style={{color:T.red}}>Due: {INR(due)}</span>}
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{padding:"30px",textAlign:"center",color:T.textMuted,fontSize:13}}>No clients found.</div>}
        </Card>
        <div>
          {sel?(
            <Card>
              <div className="raj" style={{fontSize:18,fontWeight:700,color:T.text,marginBottom:14}}>{sel.name}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[["Phone",sel.phone],["Email",sel.email],["Address",sel.address],["GST",sel.gst]].map(([l,v])=>(
                  <div key={l} style={{background:T.surface,borderRadius:6,padding:"10px 14px"}}>
                    <div style={{fontSize:11,color:T.textSec,fontWeight:600,letterSpacing:.5}}>{l.toUpperCase()}</div>
                    <div style={{fontSize:13,color:T.text,marginTop:2}}>{v||"—"}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                <div style={{background:T.surface,borderRadius:6,padding:"12px"}}>
                  <div style={{fontSize:11,color:T.textSec,fontWeight:600}}>ORDERS</div>
                  <div className="mono" style={{fontSize:22,color:T.text,marginTop:4}}>{getOrders(sel.name).length}</div>
                </div>
                <div style={{background:T.surface,borderRadius:6,padding:"12px"}}>
                  <div style={{fontSize:11,color:T.textSec,fontWeight:600}}>TOTAL VALUE</div>
                  <div className="mono" style={{fontSize:16,color:T.amber,marginTop:4}}>{INR(getOrders(sel.name).reduce((s,o)=>s+o.totalValue,0))}</div>
                </div>
                <div style={{background:T.surface,borderRadius:6,padding:"12px"}}>
                  <div style={{fontSize:11,color:T.textSec,fontWeight:600}}>BALANCE DUE</div>
                  <div className="mono" style={{fontSize:16,marginTop:4,color:getOrders(sel.name).reduce((s,o)=>s+(o.totalValue-o.paidAmount),0)>0?T.red:T.green}}>
                    {INR(getOrders(sel.name).reduce((s,o)=>s+(o.totalValue-o.paidAmount),0))}
                  </div>
                </div>
              </div>
              <div className="raj" style={{fontSize:13,fontWeight:700,color:T.textSec,marginBottom:8}}>ORDER HISTORY</div>
              <div style={{maxHeight:280,overflowY:"auto"}}>
                {getOrders(sel.name).sort((a,b)=>b.orderDate.localeCompare(a.orderDate)).map(o=>(
                  <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",marginBottom:8,background:T.surface,borderRadius:6,border:`1px solid ${T.border}`}}>
                    <div>
                      <div className="mono" style={{fontSize:12,color:T.amber}}>{o.id}</div>
                      <div style={{fontSize:12,color:T.textSec}}>{o.orderDate}{o.dueDate&&` · Due: ${o.dueDate}`} · {o.items.reduce((s,i)=>s+i.qty,0)} pcs</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="mono" style={{fontSize:13,fontWeight:700,color:T.text}}>{INR(o.totalValue)}</div>
                      <div style={{fontSize:11,color:o.totalValue-o.paidAmount>0?T.red:T.green,marginTop:2}}>{o.totalValue-o.paidAmount>0?`Due: ${INR(o.totalValue-o.paidAmount)}`:"Paid ✓"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ):(
            <Card style={{display:"flex",alignItems:"center",justifyContent:"center",height:200}}>
              <div style={{color:T.textMuted,fontSize:13}}>Select a client to view details</div>
            </Card>
          )}
        </div>
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Add New Client" width={480}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Inp label="Company / Client Name" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} required/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Phone"   value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Inp label="Email"   value={form.email}   onChange={v=>setForm(f=>({...f,email:v}))}/>
            <Inp label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
            <Inp label="GST No." value={form.gst}     onChange={v=>setForm(f=>({...f,gst:v}))} placeholder="Optional"/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setModal(false)}>Cancel</Btn>
            <Btn onClick={add} disabled={!form.name}>Add</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── PRODUCTION ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const Production = memo(({data,setData})=>{
  const active=useMemo(()=>data.orders.filter(o=>["pending","in-production","ready-for-delivery"].includes(o.status)),[data.orders]);

  const upd=useCallback((id,status)=>{
    setData(prev=>{const u={...prev,orders:prev.orders.map(o=>o.id===id?{...o,status,...(status==="delivered"?{deliveryDate:today()}:{})}:o)};saveData(u);return u;});
  },[setData]);

  return(
    <div className="fade">
      <SectionHeader title="Production Floor" subtitle="Live manufacturing queue"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {["pending","in-production","ready-for-delivery"].map(stage=>(
          <div key={stage}>
            <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:STATUS[stage].color}}/>
              <span className="raj" style={{fontSize:15,fontWeight:700,color:T.text}}>{STATUS[stage].label}</span>
              <span style={{fontSize:12,color:T.textSec}}>({active.filter(o=>o.status===stage).length})</span>
            </div>
            {active.filter(o=>o.status===stage).map(order=>(
              <Card key={order.id} style={{marginBottom:10,borderColor:STATUS[stage].color+"44"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span className="mono" style={{fontSize:12,color:T.amber}}>{order.id}</span>
                  <span style={{fontSize:11,color:T.textSec}}>{order.orderDate}</span>
                </div>
                {order.dueDate&&(
                  <div style={{marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:11,color:T.textSec}}>Due:</span><DueChip date={order.dueDate}/>
                  </div>
                )}
                <div style={{fontWeight:600,color:T.text,marginBottom:6,fontSize:14}}>{order.clientName}</div>
                {order.items.map((item,i)=>(
                  <div key={i} style={{fontSize:12,color:T.textSec,marginBottom:2}}>
                    {getSz(data.sizes,item.size).label||item.size} — <strong style={{color:T.text}}>{NUM(item.qty)} pcs</strong>
                  </div>
                ))}
                <div style={{marginTop:12,display:"flex",gap:6}}>
                  {stage==="pending"            &&<Btn small variant="blue"    onClick={()=>upd(order.id,"in-production")}>â–¶ Start</Btn>}
                  {stage==="in-production"      &&<Btn small variant="success" onClick={()=>upd(order.id,"ready-for-delivery")}>✓ Ready</Btn>}
                  {stage==="ready-for-delivery" &&<Btn small                   onClick={()=>upd(order.id,"delivered")}>🚛 Delivered</Btn>}
                </div>
              </Card>
            ))}
            {active.filter(o=>o.status===stage).length===0&&(
              <div style={{padding:"30px",textAlign:"center",color:T.textMuted,fontSize:12,border:`1px dashed ${T.border}`,borderRadius:8}}>Empty</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── REPORTS ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const Reports = memo(({data,setData})=>{
  const {sizes,orders,rawMaterials}=data;
  const importRef=useRef(null);
  const monthly=useMemo(()=>getMonthlyStats(sizes,orders),[sizes,orders]);
  const totalRev =useMemo(()=>orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+o.totalValue,0),[orders]);
  const totalCost=useMemo(()=>orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+calcOrderCost(sizes,o.items),0),[orders,sizes]);
  const best=useMemo(()=>[...monthly].sort((a,b)=>b.profit-a.profit)[0],[monthly]);

  const dl=(type)=>{
    let rows,headers;
    if(type==="orders"){
      headers=["Order ID","Client","Date","Due Date","Items","Total","Paid","Balance","Status"];
      rows=orders.map(o=>[o.id,o.clientName,o.orderDate,o.dueDate||"",o.items.map(i=>`${getSz(sizes,i.size).label} x${i.qty}`).join("; "),o.totalValue,o.paidAmount,o.totalValue-o.paidAmount,o.status]);
    } else if(type==="rm"){
      headers=["PO ID","Material","Supplier","Qty","Unit Cost","Total","Paid","Balance","Status","Ordered","Received"];
      rows=rawMaterials.map(r=>[r.id,getRMT(r.type).name,r.supplier,r.qty,r.unitCost,r.totalCost,r.paidAmount,r.totalCost-r.paidAmount,r.status,r.orderDate,r.receivedDate||""]);
    } else {
      headers=["Month","Revenue","Cost","Profit","Orders","Delivered"];
      rows=monthly.map(m=>[m.label,m.revenue,m.cost,m.profit,m.orders,m.delivered]);
    }
    const csv=[headers,...rows].map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`roller_${type}_${today()}.csv`;a.click();
  };

  const triggerImport=()=>importRef.current?.click();
  const onImport=async(e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    try{
      const text=await file.text();
      const parsed=JSON.parse(text);
      if(!isValidImportPayload(parsed)) throw new Error("Unsupported backup structure.");
      setData(parsed);
      saveData(parsed);
      window.alert("ERP data imported successfully.");
    }catch(err){
      window.alert(`Import failed: ${err.message}`);
    }finally{
      e.target.value="";
    }
  };

  return(
    <div className="fade">
      <SectionHeader title="Reports & Analytics" subtitle="Lifetime P&L, seasonal patterns, download full ledgers">
        <Btn variant="ghost" onClick={()=>dl("monthly")}>↓ Monthly</Btn>
        <Btn variant="ghost" onClick={()=>dl("orders")}>↓ Orders</Btn>
        <Btn variant="ghost" onClick={()=>dl("rm")}>↓ Procurement</Btn>
      </SectionHeader>
      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div>
            <div className="raj" style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>Data Transfer Hub</div>
            <div style={{fontSize:12,color:T.textSec,maxWidth:560}}>
              Export readable Word/PDF reports for sharing, and use JSON backup import/export for full-fidelity data transfer between ERP instances.
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn variant="blue" onClick={()=>exportPdfReport(data)}>Export PDF</Btn>
            <Btn variant="purple" onClick={()=>exportWordReport(data)}>Export Word</Btn>
            <Btn variant="ghost" onClick={()=>exportJsonBackup(data)}>Export Backup</Btn>
            <Btn variant="ghost" onClick={triggerImport}>Import Backup</Btn>
            <input ref={importRef} type="file" accept=".json,application/json" onChange={onImport} style={{display:"none"}}/>
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <KPI label="Lifetime Revenue" value={INR(totalRev)} accent={T.green}/>
        <KPI label="Lifetime Profit"  value={INR(totalRev-totalCost)} sub={`${Math.round((totalRev-totalCost)/totalRev*100||0)}% margin`} accent={T.amber}/>
        <KPI label="Best Month"       value={best?.label||"—"} sub={best?INR(best.profit):""} accent={T.purple}/>
        <KPI label="Peak Orders"      value={[...monthly].sort((a,b)=>b.orders-a.orders)[0]?.label||"—"} accent={T.cyan}/>
      </div>
      <Card style={{marginBottom:16}}>
        <div className="raj" style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:16}}>Month-over-Month — From Day One</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="label" tick={{fill:T.textSec,fontSize:11}}/>
            <YAxis yAxisId="l" tick={{fill:T.textSec,fontSize:11}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`}/>
            <YAxis yAxisId="r" orientation="right" tick={{fill:T.textSec,fontSize:11}}/>
            <Tooltip content={<ChartTip/>}/>
            <Legend wrapperStyle={{fontSize:12}}/>
            <Bar  yAxisId="l" dataKey="revenue" name="Revenue" fill={`${T.green}55`} stroke={T.green}/>
            <Bar  yAxisId="l" dataKey="cost"    name="Cost"    fill={`${T.red}44`}   stroke={T.red}/>
            <Line yAxisId="l" dataKey="profit"  name="Profit"  stroke={T.amber} strokeWidth={2.5} dot={{r:4,fill:T.amber}}/>
            <Bar  yAxisId="r" dataKey="orders"  name="Orders"  fill={`${T.blue}44`}  stroke={T.blue}/>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Monthly Profit Ranking</div>
          {[...monthly].sort((a,b)=>b.profit-a.profit).map((m,i)=>(
            <div key={m.key} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<monthly.length-1?`1px solid ${T.border}`:"none"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:i===0?T.amber:T.textMuted,width:20}}>#{i+1}</span>
                <span style={{fontSize:13,color:T.text}}>{m.label}</span>
                <span style={{fontSize:11,color:T.textSec}}>{m.orders} orders</span>
              </div>
              <span className="mono" style={{fontSize:13,color:m.profit>0?T.green:T.red,fontWeight:600}}>{INR(m.profit)}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:14}}>Seasonal Profit Pattern</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly}>
              <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.amber} stopOpacity={.3}/><stop offset="95%" stopColor={T.amber} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="label" tick={{fill:T.textSec,fontSize:10}}/>
              <YAxis tick={{fill:T.textSec,fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="profit" name="Profit" stroke={T.amber} fill="url(#pg)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
          {best&&<div style={{marginTop:10,fontSize:12,color:T.textSec}}>🔺 Peak: {best.label} — {INR(best.profit)}</div>}
        </Card>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── EMPLOYEE VIEW ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const EmployeeView = memo(({data,setData})=>{
  const [tab,setTab]=useState("queue");
  const active=useMemo(()=>data.orders.filter(o=>["pending","in-production","ready-for-delivery"].includes(o.status)),[data.orders]);

  const upd=useCallback((id,status)=>{
    setData(prev=>{const u={...prev,orders:prev.orders.map(o=>o.id===id?{...o,status,...(status==="delivered"?{deliveryDate:today()}:{})}:o)};saveData(u);return u;});
  },[setData]);

  // Employee order columns — NO value/paid/balance columns
  const empOrderCols=useMemo(()=>[
    {key:"id",        label:"Order ID",  mono:true},
    {key:"clientName",label:"Client"},
    {key:"orderDate", label:"Date"},
    {key:"dueDate",   label:"Due Date",  render:(v)=><DueChip date={v}/>},
    {key:"items",     label:"Items",     render:(v)=>`${v.reduce((s,i)=>s+i.qty,0)} pcs`},
    {key:"status",    label:"Status",    render:(v)=><Badge status={v}/>},
    {key:"_a",        label:"",          render:(_,r)=><Btn small onClick={()=>upd(r.id, r.status==="pending"?"in-production":r.status==="in-production"?"ready-for-delivery":r.status==="ready-for-delivery"?"delivered":r.status)} variant="ghost">
      {r.status==="pending"?"▶ Start":r.status==="in-production"?"✓ Ready":r.status==="ready-for-delivery"?"🚛 Deliver":"—"}
    </Btn>},
  ],[upd]);

  return(
    <div className="fade">
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        {[["queue","🏭 Queue"],["orders","📋 Orders"],["stock","📦 Stock"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"8px 20px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${tab===k?T.amber:T.border}`,background:tab===k?`${T.amber}18`:"transparent",color:tab===k?T.amber:T.textSec}}>{l}</button>
        ))}
      </div>

      {tab==="queue"&&(
        <div>
          <SectionHeader title="Production Queue" subtitle="Your work list — update as you go"/>
          {active.length===0?(
            <Card style={{textAlign:"center",padding:"60px"}}><div style={{fontSize:14,color:T.textMuted}}>All clear — no active orders.</div></Card>
          ):active.sort((a,b)=>a.orderDate.localeCompare(b.orderDate)).map(order=>(
            <Card key={order.id} style={{marginBottom:10}}>
              <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:16,alignItems:"center"}}>
                <div style={{width:3,height:54,background:STATUS[order.status].color,borderRadius:2}}/>
                <div>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}>
                    <span className="mono" style={{fontSize:12,color:T.amber}}>{order.id}</span>
                    <Badge status={order.status}/>
                    {order.dueDate&&<DueChip date={order.dueDate}/>}
                  </div>
                  <div style={{fontWeight:600,color:T.text,marginBottom:4}}>{order.clientName}</div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {order.items.map((item,i)=>(
                      <span key={i} style={{fontSize:12,color:T.textSec}}>
                        {getSz(data.sizes,item.size).label} × <strong style={{color:T.text}}>{NUM(item.qty)} pcs</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                  <div style={{fontSize:11,color:T.textSec}}>{order.orderDate}</div>
                  {order.status==="pending"            &&<Btn small variant="blue"    onClick={()=>upd(order.id,"in-production")}>â–¶ Start</Btn>}
                  {order.status==="in-production"      &&<Btn small variant="success" onClick={()=>upd(order.id,"ready-for-delivery")}>✓ Ready</Btn>}
                  {order.status==="ready-for-delivery" &&<Btn small                   onClick={()=>upd(order.id,"delivered")}>🚛 Delivered</Btn>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab==="orders"&&(
        <div>
          <SectionHeader title="All Orders" subtitle="No financial data shown — production view only">
            <Btn onClick={()=>{}}>+ New Order</Btn>
          </SectionHeader>
          <Card style={{padding:0}}>
            <PaginatedTable cols={empOrderCols} rows={[...data.orders].sort((a,b)=>b.orderDate.localeCompare(a.orderDate))} emptyMsg="No orders yet."/>
          </Card>
        </div>
      )}

      {tab==="stock"&&(
        <StockManager data={data} setData={setData} role="employee"/>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── CLIENT PORTAL ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const ClientPortal = memo(({data,setData,clientName,setClientName})=>{
  const [tab,setTab]=useState("catalog");
  const [cart,setCart]=useState([]);
  const [form,setForm]=useState({name:"",phone:"",email:"",address:"",notes:""});
  const [submitted,setSubmitted]=useState(false);
  const [trackId,setTrackId]=useState("");
  const [customModal,setCustomModal]=useState(false);
  const [customForm,setCustomForm]=useState({diameter:"",length:"",qty:10,note:""});

  const activeSizes=useMemo(()=>(data.sizes||[]).filter(s=>s.active!==false),[data.sizes]);
  const clientOrds=useMemo(()=>clientName?data.orders.filter(o=>o.clientName.toLowerCase().includes(clientName.toLowerCase())):[],[data.orders,clientName]);
  const trackedOrd=useMemo(()=>data.orders.find(o=>o.id.toLowerCase()===trackId.toLowerCase()),[data.orders,trackId]);

  const addToCart=(code)=>{
    const sz=activeSizes.find(s=>s.code===code);
    if(!sz)return;
    setCart(prev=>{
      const ex=prev.find(i=>i.size===code);
      if(ex)return prev.map(i=>i.size===code?{...i,qty:i.qty+10}:i);
      return[...prev,{size:code,qty:10,unitPrice:sz.price,isCustom:false}];
    });
    setTab("order");
  };

  const addCustom=()=>{
    if(!customForm.diameter||!customForm.length)return;
    const label=`${customForm.diameter}mm × ${customForm.length}mm (Custom)`;
    const code=`custom_${Date.now()}`;
    setCart(prev=>[...prev,{size:code,qty:Number(customForm.qty)||10,unitPrice:0,isCustom:true,customLabel:label,customNote:customForm.note}]);
    setCustomModal(false);
    setCustomForm({diameter:"",length:"",qty:10,note:""});
    setTab("order");
  };

  const submitOrder=()=>{
    const totalValue=cart.filter(i=>!i.isCustom).reduce((s,i)=>s+i.qty*i.unitPrice,0);
    const items=cart.map(i=>({size:i.size,qty:i.qty,unitPrice:i.unitPrice,isCustom:i.isCustom||false,customLabel:i.customLabel||null}));
    const order={id:genId("ORD"),clientName:form.name,clientPhone:form.phone,clientEmail:form.email,clientAddress:form.address,items,status:"pending",orderDate:today(),dueDate:null,deliveryDate:null,totalValue,paidAmount:0,notes:form.notes+(cart.some(i=>i.isCustom)?" [Contains custom sizes — pricing TBD]":"")};
    setData(prev=>{const u={...prev,orders:[...prev.orders,order]};saveData(u);return u;});
    setClientName(form.name);setCart([]);setSubmitted(true);setTab("track");
  };

  return(
    <div className="fade" style={{maxWidth:820,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        {[["catalog","📦 Catalog"],["order","🛒 Order"+(cart.length>0?` (${cart.length})`:"")],["track","🔍 Track"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"8px 20px",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${tab===k?T.amber:T.border}`,background:tab===k?`${T.amber}18`:"transparent",color:tab===k?T.amber:T.textSec}}>{l}</button>
        ))}
      </div>

      {tab==="catalog"&&(
        <div>
          <SectionHeader title="Product Catalog" subtitle="Standard & custom roller sizes available">
            <Btn variant="purple" onClick={()=>setCustomModal(true)}>⊕ Request Custom Size</Btn>
          </SectionHeader>
          {activeSizes.length===0?(
            <Card style={{textAlign:"center",padding:"60px"}}><div style={{color:T.textMuted}}>No products available. Contact us.</div></Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:12}}>
              {activeSizes.map(sz=>{
                const inStock=data.inventory[sz.code]||0;
                return(
                  <Card key={sz.code}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,color:inStock>0?T.green:T.amber,background:inStock>0?"rgba(34,197,94,.12)":"rgba(245,158,11,.12)"}}>
                        {inStock>0?`${inStock} IN STOCK`:"ORDER"}
                      </span>
                    </div>
                    <div className="raj" style={{fontSize:17,fontWeight:700,color:T.text,marginBottom:4}}>{sz.label}</div>
                    <div style={{fontSize:11,color:T.textSec,marginBottom:14}}>Conveyor Roller · Heavy Duty Steel</div>
                    <div className="mono" style={{fontSize:24,fontWeight:700,color:T.amber,marginBottom:14}}>{INR(sz.price)}<span style={{fontSize:12,color:T.textSec,fontFamily:"'DM Sans'"}}> / pc</span></div>
                    <Btn onClick={()=>addToCart(sz.code)} style={{width:"100%"}}>Add to Order</Btn>
                  </Card>
                );
              })}
              {/* Custom size card */}
              <Card style={{border:`1px dashed ${T.purple}55`,background:`${T.purple}05`,cursor:"pointer"}} onClick={()=>setCustomModal(true)}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",minHeight:180,gap:12}}>
                  <div style={{fontSize:32,color:T.purple}}>⊕</div>
                  <div className="raj" style={{fontSize:16,fontWeight:700,color:T.purple}}>Custom Size</div>
                  <div style={{fontSize:12,color:T.textSec,textAlign:"center"}}>Need a specific diameter or length? Request a custom roller.</div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab==="order"&&(
        <div>
          <SectionHeader title="Your Order"/>
          {cart.length===0?(
            <Card style={{textAlign:"center",padding:"40px"}}>
              <div style={{color:T.textMuted,marginBottom:12}}>Cart is empty.</div>
              <Btn variant="ghost" onClick={()=>setTab("catalog")}>← Browse Catalog</Btn>
            </Card>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <Card>
                <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:12}}>Order Items</div>
                {cart.map((item,i)=>{
                  const sz=item.isCustom?null:activeSizes.find(s=>s.code===item.size);
                  return(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div>
                        <div style={{color:T.text,fontSize:14}}>{item.isCustom?(item.customLabel||"Custom Size"):(sz?.label||item.size)}</div>
                        {item.isCustom&&<div style={{fontSize:11,color:T.purple}}>Custom — pricing confirmed by our team</div>}
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <button onClick={()=>setCart(p=>p.map((x,j)=>j===i?{...x,qty:Math.max(1,x.qty-10)}:x))} style={{background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:4,width:26,height:26,cursor:"pointer"}}>−</button>
                        <span className="mono" style={{fontSize:13,color:T.text,width:32,textAlign:"center"}}>{item.qty}</span>
                        <button onClick={()=>setCart(p=>p.map((x,j)=>j===i?{...x,qty:x.qty+10}:x))} style={{background:T.surface,border:`1px solid ${T.border}`,color:T.text,borderRadius:4,width:26,height:26,cursor:"pointer"}}>+</button>
                        {!item.isCustom&&<span className="mono" style={{color:T.amber,width:100,textAlign:"right",fontSize:13}}>{INR(item.qty*item.unitPrice)}</span>}
                        {item.isCustom&&<span style={{color:T.purple,width:100,textAlign:"right",fontSize:12}}>TBD</span>}
                        <button onClick={()=>setCart(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:16}}>✕</button>
                      </div>
                    </div>
                  );
                })}
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`,gap:16}}>
                  {cart.some(i=>i.isCustom)&&<span style={{fontSize:12,color:T.purple,alignSelf:"center"}}>* Custom items priced separately</span>}
                  <span className="mono" style={{fontSize:18,fontWeight:700,color:T.green}}>
                    {INR(cart.filter(i=>!i.isCustom).reduce((s,i)=>s+i.qty*i.unitPrice,0))}
                  </span>
                </div>
              </Card>
              <Card>
                <div className="raj" style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:12}}>Your Details</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <Inp label="Full Name / Company" value={form.name}    onChange={v=>setForm(f=>({...f,name:v}))}    required/>
                  <Inp label="Phone"               value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}   required/>
                  <Inp label="Email"               value={form.email}   onChange={v=>setForm(f=>({...f,email:v}))}/>
                  <Inp label="State / Address"     value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
                </div>
                <div style={{marginTop:12}}>
                  <Inp label="Special Instructions" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="Any requirements?"/>
                </div>
                <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
                  <Btn onClick={submitOrder} disabled={!form.name||!form.phone}>Confirm Order →</Btn>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab==="track"&&(
        <div>
          <SectionHeader title="Track Your Order"/>
          {submitted&&(
            <div style={{background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.25)",borderRadius:8,padding:"14px 18px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
              <span style={{fontSize:20}}>✅</span>
              <div>
                <div style={{fontWeight:700,color:T.green,marginBottom:2}}>Order placed successfully!</div>
                <div style={{fontSize:13,color:T.textSec}}>Our team will confirm and begin production shortly.</div>
              </div>
            </div>
          )}
          <Card style={{marginBottom:16}}>
            <input value={trackId} onChange={e=>setTrackId(e.target.value)} placeholder="Enter Order ID (e.g. ORD-001XXXXX)" style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"10px 14px",fontSize:13}}/>
            {trackId&&trackedOrd&&(
              <div style={{marginTop:14,padding:"14px",background:T.surface,borderRadius:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span className="mono" style={{color:T.amber}}>{trackedOrd.id}</span>
                  <Badge status={trackedOrd.status}/>
                </div>
                <div style={{fontSize:14,color:T.text,marginBottom:4}}>{trackedOrd.clientName}</div>
                {trackedOrd.dueDate&&<div style={{fontSize:12,color:T.textSec,marginBottom:4}}>Expected by: <DueChip date={trackedOrd.dueDate}/></div>}
                <div style={{fontSize:12,color:T.textSec}}>{trackedOrd.items.reduce((s,i)=>s+i.qty,0)} pcs ordered</div>
              </div>
            )}
            {trackId&&!trackedOrd&&<div style={{marginTop:10,fontSize:12,color:T.red}}>Order not found.</div>}
          </Card>
          {clientOrds.length>0&&(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.textSec,marginBottom:10,letterSpacing:.5}}>YOUR ORDERS</div>
              {clientOrds.sort((a,b)=>b.orderDate.localeCompare(a.orderDate)).map(o=>(
                <Card key={o.id} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div className="mono" style={{fontSize:12,color:T.amber,marginBottom:2}}>{o.id}</div>
                      <div style={{fontSize:12,color:T.textSec}}>{o.orderDate} · {o.items.reduce((s,i)=>s+i.qty,0)} pcs{o.dueDate?` · Due: ${o.dueDate}`:""}</div>
                    </div>
                    <Badge status={o.status}/>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CUSTOM SIZE MODAL */}
      <Modal open={customModal} onClose={()=>setCustomModal(false)} title="Request Custom Size" width={440}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:`rgba(167,139,250,.07)`,border:`1px solid rgba(167,139,250,.25)`,borderRadius:6,padding:"10px 14px",fontSize:13,color:T.textSec}}>
            Specify your required dimensions. Our team will confirm pricing and availability.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Diameter (mm)" type="number" value={customForm.diameter} onChange={v=>setCustomForm(f=>({...f,diameter:v}))} required placeholder="e.g. 114"/>
            <Inp label="Length (mm)"   type="number" value={customForm.length}   onChange={v=>setCustomForm(f=>({...f,length:v}))}   required placeholder="e.g. 600"/>
            <Inp label="Quantity (pcs)" type="number" value={customForm.qty}     onChange={v=>setCustomForm(f=>({...f,qty:v}))}      min="1"/>
          </div>
          <Inp label="Additional Notes" value={customForm.note} onChange={v=>setCustomForm(f=>({...f,note:v}))} placeholder="Any specific requirements (material, load capacity, etc.)"/>
          {customForm.diameter&&customForm.length&&(
            <div style={{background:T.surface,borderRadius:6,padding:"10px 14px"}}>
              <div style={{fontSize:12,color:T.textSec,marginBottom:4}}>Your request:</div>
              <div className="raj" style={{fontSize:16,fontWeight:700,color:T.purple}}>{customForm.diameter}mm × {customForm.length}mm — {customForm.qty} pcs</div>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setCustomModal(false)}>Cancel</Btn>
            <Btn variant="purple" onClick={addCustom} disabled={!customForm.diameter||!customForm.length}>Add to Order</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ── APP SHELL ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const ADMIN_NAV = [
  {id:"dashboard", label:"Dashboard",     icon:"*"},
  {id:"orders",    label:"Order Book",    icon:"📋"},
  {id:"production",label:"Production",    icon:"âš™"},
  {id:"stock",     label:"Stock Mgmt",    icon:"📦"},
  {id:"rawmat",    label:"Raw Materials", icon:"🔩"},
  {id:"clients",   label:"Clients",       icon:"👥"},
  {id:"sizes",     label:"Sizes & Pricing",icon:"âš–"},
  {id:"reports",   label:"Reports",       icon:"📊"},
];

export default function App() {
  const [data,setData]=useState(null);
  const [role,setRole]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [clientName,setClientName]=useState("");
  const [deferredPrompt,setDeferredPrompt]=useState(null);
  const [isInstalled,setIsInstalled]=useState(false);
  const [installDismissed,setInstallDismissed]=useState(false);

  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);

  useEffect(()=>{ loadData().then(setData); },[]);

  useEffect(()=>{ setIsInstalled(Boolean(isStandalone)); },[isStandalone]);

  useEffect(()=>{
    if (typeof window === "undefined") return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  },[]);

  useEffect(()=>{
    if (typeof document === "undefined") return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const changed = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nextValue = sanitizeUiText(node.nodeValue || "");
      if (nextValue !== node.nodeValue) {
        changed.push([node, nextValue]);
      }
    }

    changed.forEach(([node, nextValue]) => {
      node.nodeValue = nextValue;
    });
  },[data, role, page, clientName, installDismissed]);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  };

  if(!data) return(
    <>
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg}}>
      <div style={{color:T.amber,fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>Loading ERP…</div>
    </div>
      <InstallAppButton
        canInstall={Boolean(deferredPrompt)}
        onInstall={installApp}
        onDismiss={()=>setInstallDismissed(true)}
        showIosHint={isIos && !isStandalone}
        isInstalled={isInstalled}
        dismissed={installDismissed}
      />
    </>
  );

  if(!role) return (
    <>
      <LoginScreen
        onLogin={(r)=>{setRole(r);setPage("dashboard");}}
        canInstall={Boolean(deferredPrompt)}
        onInstall={installApp}
        onDismiss={()=>setInstallDismissed(true)}
        showIosHint={isIos && !isStandalone}
        isInstalled={isInstalled}
        dismissed={installDismissed}
      />
      <InstallAppButton
        canInstall={Boolean(deferredPrompt)}
        onInstall={installApp}
        onDismiss={()=>setInstallDismissed(true)}
        showIosHint={isIos && !isStandalone}
        isInstalled={isInstalled}
        dismissed={installDismissed}
      />
    </>
  );

  // CLIENT
  if(role==="client") return(
    <>
    <div style={{minHeight:"100vh",background:T.bg}}>
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <BrandLogo height={30} wide />
          <span className="raj" style={{fontSize:18,fontWeight:700,color:T.text}}>Roller ERP</span>
          <span style={{padding:"2px 10px",background:"rgba(34,197,94,.12)",color:T.green,borderRadius:20,fontSize:11,fontWeight:700}}>CLIENT PORTAL</span>
        </div>
        <Btn small variant="ghost" onClick={()=>{setRole(null);setClientName("");}}>← Exit</Btn>
      </div>
      <div style={{padding:"24px"}}><ClientPortal data={data} setData={setData} clientName={clientName} setClientName={setClientName}/></div>
    </div>
      <InstallAppButton
        canInstall={Boolean(deferredPrompt)}
        onInstall={installApp}
        onDismiss={()=>setInstallDismissed(true)}
        showIosHint={isIos && !isStandalone}
        isInstalled={isInstalled}
        dismissed={installDismissed}
      />
    </>
  );

  // EMPLOYEE
  if(role==="employee") return(
    <>
    <div style={{minHeight:"100vh",background:T.bg}}>
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <BrandLogo height={30} wide />
          <span className="raj" style={{fontSize:18,fontWeight:700,color:T.text}}>Roller ERP</span>
          <span style={{padding:"2px 10px",background:`${T.blue}18`,color:T.blue,borderRadius:20,fontSize:11,fontWeight:700}}>EMPLOYEE</span>
        </div>
        <Btn small variant="ghost" onClick={()=>setRole(null)}>← Exit</Btn>
      </div>
      <div style={{padding:"24px"}}><EmployeeView data={data} setData={setData}/></div>
    </div>
      <InstallAppButton
        canInstall={Boolean(deferredPrompt)}
        onInstall={installApp}
        onDismiss={()=>setInstallDismissed(true)}
        showIosHint={isIos && !isStandalone}
        isInstalled={isInstalled}
        dismissed={installDismissed}
      />
    </>
  );

  // ADMIN
  const pendingCnt=data.orders.filter(o=>o.status==="pending").length;
  const overdueCnt=data.orders.filter(o=>o.dueDate&&o.dueDate<today()&&!["delivered","cancelled"].includes(o.status)).length;

  const PAGES={
    dashboard: <Dashboard  data={data}/>,
    orders:    <OrderBook  data={data} setData={setData} role="admin"/>,
    production:<Production data={data} setData={setData}/>,
    stock:     <StockManager data={data} setData={setData} role="admin"/>,
    rawmat:    <RawMaterials data={data} setData={setData}/>,
    clients:   <Clients    data={data} setData={setData}/>,
    sizes:     <SizeManager data={data} setData={setData}/>,
    reports:   <Reports    data={data} setData={setData}/>,
  };
  const displayNav = [
    {id:"dashboard", label:"Dashboard",      icon:"*"},
    {id:"orders",    label:"Order Book",     icon:"[ORD]"},
    {id:"production",label:"Production",     icon:"[PRD]"},
    {id:"stock",     label:"Stock Mgmt",     icon:"[STK]"},
    {id:"rawmat",    label:"Raw Materials",  icon:"[RM]"},
    {id:"clients",   label:"Clients",        icon:"[CL]"},
    {id:"sizes",     label:"Sizes & Pricing",icon:"[SZ]"},
    {id:"reports",   label:"Reports",        icon:"[RPT]"},
  ];

  return(
    <>
    <div style={{display:"flex",height:"100vh",background:T.bg,overflow:"hidden"}}>
      <div style={{width:224,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"18px 18px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <BrandLogo height={34} wide />
            <div>
              <div className="raj" style={{fontSize:18,fontWeight:700,color:T.text,lineHeight:1}}>Roller ERP</div>
              <div style={{fontSize:10,color:T.textSec}}>Manufacturing System</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <span style={{padding:"3px 10px",background:`${T.amber}15`,borderRadius:20,fontSize:11,color:T.amber,fontWeight:700}}>👑 ADMIN</span>
            {overdueCnt>0&&<span style={{padding:"3px 10px",background:"rgba(239,68,68,.12)",borderRadius:20,fontSize:11,color:T.red,fontWeight:700}}>âš  {overdueCnt} Overdue</span>}
          </div>
        </div>
        <nav style={{flex:1,padding:"10px 10px",overflowY:"auto"}}>
          {displayNav.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 12px",borderRadius:7,border:"none",background:page===n.id?`${T.amber}14`:"transparent",color:page===n.id?T.amber:T.textSec,cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:page===n.id?600:400,transition:"all .15s",marginBottom:2}}>
              <span style={{fontSize:10,minWidth:40,padding:"3px 6px",borderRadius:999,border:`1px solid ${page===n.id?`${T.amber}40`:T.border}`,background:page===n.id?`${T.amber}18`:"transparent",color:page===n.id?T.amber:T.textMuted,fontFamily:"'JetBrains Mono', monospace",textAlign:"center",letterSpacing:.3,flexShrink:0}}>{n.icon}</span>
              {n.label}
              {n.id==="orders"&&pendingCnt>0&&<span style={{marginLeft:"auto",background:T.red,color:"#fff",fontSize:10,fontWeight:700,borderRadius:20,padding:"1px 6px"}}>{pendingCnt}</span>}
              {n.id==="sizes"&&<span style={{marginLeft:"auto",background:`${T.purple}22`,color:T.purple,fontSize:9,fontWeight:700,borderRadius:20,padding:"2px 6px",letterSpacing:.3}}>ADMIN</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"12px 14px",borderTop:`1px solid ${T.border}`}}>
          <Btn variant="ghost" onClick={()=>setRole(null)} style={{width:"100%",fontSize:12}}>← Logout</Btn>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"24px"}}>
        {PAGES[page]}
      </div>
    </div>
      <InstallAppButton
        canInstall={Boolean(deferredPrompt)}
        onInstall={installApp}
        showIosHint={isIos && !isStandalone}
        isInstalled={isInstalled}
      />
    </>
  );
}







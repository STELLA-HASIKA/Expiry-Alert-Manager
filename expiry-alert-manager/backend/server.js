require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");
const { getSupabaseClient } = require("./supabase");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5500,http://127.0.0.1:5500")
  .split(",").map(value => value.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("This origin is not allowed by the API CORS configuration."));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "20kb" }));

const CATEGORIES = ["Food", "Medicine", "Personal Care", "Household", "Other"];
const PRODUCT_COLUMNS = "id, name, category, quantity, expiry_date, notes, created_at, updated_at";
const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
function validateProduct(body, partial = false) {
  if (!isPlainObject(body)) return { error: "Request body must be a JSON object." };
  const output = {};
  const allowed = ["name", "category", "quantity", "expiry_date", "notes"];
  const unexpected = Object.keys(body).filter(key => !allowed.includes(key));
  if (unexpected.length) return { error: `Unexpected field(s): ${unexpected.join(", ")}.` };
  if (!partial || Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) return { error: "Name is required and must be 1–100 characters." };
    output.name = body.name.trim();
  }
  if (!partial || Object.hasOwn(body, "category")) {
    if (typeof body.category !== "string" || !CATEGORIES.includes(body.category)) return { error: `Category must be one of: ${CATEGORIES.join(", ")}.` };
    output.category = body.category;
  }
  if (!partial || Object.hasOwn(body, "quantity")) {
    if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 99999) return { error: "Quantity must be a whole number between 1 and 99,999." };
    output.quantity = body.quantity;
  }
  if (!partial || Object.hasOwn(body, "expiry_date")) {
    if (typeof body.expiry_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.expiry_date)) return { error: "Expiry date must use YYYY-MM-DD format." };
    const parsed = new Date(`${body.expiry_date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.expiry_date) return { error: "Expiry date is not a valid calendar date." };
    output.expiry_date = body.expiry_date;
  }
  if (!partial || Object.hasOwn(body, "notes")) {
    if (body.notes !== undefined && body.notes !== null && (typeof body.notes !== "string" || body.notes.length > 500)) return { error: "Notes must be text with a maximum length of 500 characters." };
    output.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }
  if (partial && Object.keys(output).length === 0) return { error: "Provide at least one field to update." };
  return { value: output };
}
function validId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function sendDbError(res, error, action) {
  console.error(`Supabase ${action} failed:`, error.message || error);
  if (error.code === "SUPABASE_CONFIG_MISSING") return res.status(503).json({ error: error.message });
  if (error.code === "42P01" || error.code === "PGRST205") return res.status(503).json({ error: "Database table is missing. Run database/schema.sql in your Supabase SQL Editor." });
  if (error.code === "42501" || error.code === "PGRST301") return res.status(403).json({ error: "Database access was denied. Check the RLS policies and API key configuration." });
  return res.status(500).json({ error: "A database error occurred. Check the backend logs for details." });
}
function withClient(handler) {
  return async (req, res) => {
    try { await handler(req, res, getSupabaseClient()); }
    catch (error) { if (!res.headersSent) sendDbError(res, error, `${req.method} ${req.path}`); }
  };
}

app.get("/api/health", (_req, res) => {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  res.status(200).json({ status: "ok", service: "expiry-alert-manager-api", supabaseConfigured: configured });
});
app.get("/api/products", withClient(async (_req, res, supabase) => {
  const { data, error } = await supabase.from("products").select(PRODUCT_COLUMNS).order("expiry_date", { ascending: true }).order("name", { ascending: true });
  if (error) throw error;
  res.json({ products: data });
}));
app.get("/api/products/:id", withClient(async (req, res, supabase) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Product ID must be a valid UUID." });
  const { data, error } = await supabase.from("products").select(PRODUCT_COLUMNS).eq("id", req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Product not found." });
  res.json({ product: data });
}));
app.post("/api/products", withClient(async (req, res, supabase) => {
  const checked = validateProduct(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const { data, error } = await supabase.from("products").insert({ id: randomUUID(), ...checked.value }).select(PRODUCT_COLUMNS).single();
  if (error) throw error;
  res.status(201).json({ product: data });
}));
app.patch("/api/products/:id", withClient(async (req, res, supabase) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Product ID must be a valid UUID." });
  const checked = validateProduct(req.body, true);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const { data, error } = await supabase.from("products").update(checked.value).eq("id", req.params.id).select(PRODUCT_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Product not found." });
  res.json({ product: data });
}));
app.delete("/api/products/:id", withClient(async (req, res, supabase) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Product ID must be a valid UUID." });
  const { data, error } = await supabase.from("products").delete().eq("id", req.params.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Product not found." });
  res.json({ message: "Product deleted successfully.", id: data.id });
}));
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: "Invalid JSON request body." });
  if (error.message?.includes("CORS")) return res.status(403).json({ error: error.message });
  console.error("Unhandled API error:", error.message || error);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`Expiry Alert Manager API listening on http://localhost:${PORT}`);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) console.warn("Supabase is not configured. Add backend/.env before using product endpoints.");
});

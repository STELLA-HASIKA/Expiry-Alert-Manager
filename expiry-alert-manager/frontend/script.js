/* Expiry Alert Manager — vanilla JavaScript frontend */
(() => {
  "use strict";
  const API_BASE = window.EXPIRY_API_BASE || "http://localhost:3000/api";
  const $ = (selector) => document.querySelector(selector);
  const els = {
    list: $("#product-list"), empty: $("#empty-state"), emptyTitle: $("#empty-title"),
    emptyMessage: $("#empty-message"), resultCount: $("#result-count"),
    search: $("#search-input"), category: $("#category-filter"), status: $("#status-filter"),
    dialog: $("#product-dialog"), form: $("#product-form"), formError: $("#form-error"),
    save: $("#save-product-btn"), alert: $("#alert-banner")
  };
  let products = [];
  let requestCount = 0;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const todayISO = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  };
  const daysUntil = (date) => {
    const today = new Date(`${todayISO()}T00:00:00`);
    const expiry = new Date(`${date}T00:00:00`);
    return Math.round((expiry - today) / 86400000);
  };
  const statusFor = (date) => {
    const days = daysUntil(date);
    return days < 0 ? "expired" : days <= 7 ? "soon" : "safe";
  };
  const statusText = (date) => {
    const days = daysUntil(date);
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
    if (days === 0) return "Expires today";
    if (days === 1) return "Expires tomorrow";
    return `${days} days left`;
  };
  const formatDate = (date) => new Intl.DateTimeFormat("en-IN", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T00:00:00Z`));
  const toast = (message, type = "success") => {
    const node = document.createElement("div");
    node.className = `toast ${type === "error" ? "error" : ""}`;
    node.textContent = message;
    $("#toast-region").append(node);
    window.setTimeout(() => node.remove(), 4200);
  };
  const setLoading = (loading) => {
    els.save.disabled = loading;
    els.save.innerHTML = loading ? '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Saving…' : '<span>✓</span> Save product';
  };
  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }
  function showFatalError(message) {
    els.list.innerHTML = "";
    els.empty.classList.remove("hidden");
    els.emptyTitle.textContent = "We couldn't load your inventory.";
    els.emptyMessage.textContent = message;
    $("#empty-add-btn").classList.add("hidden");
    els.resultCount.textContent = "Inventory unavailable";
    els.alert.textContent = "Check that the backend is running and Supabase is configured, then try again.";
    els.alert.classList.remove("hidden");
    const retry = document.createElement("button");
    retry.className = "button button-outline";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadProducts);
    els.empty.append(retry);
  }
  async function loadProducts() {
    const thisRequest = ++requestCount;
    els.list.innerHTML = '<div class="loading-state"><span class="spinner"></span><p>Loading your inventory…</p></div>';
    els.empty.classList.add("hidden");
    els.alert.classList.add("hidden");
    try {
      const data = await api("/products");
      if (thisRequest !== requestCount) return;
      products = data.products;
      render();
    } catch (error) {
      if (thisRequest !== requestCount) return;
      showFatalError(`${error.message}. Start the backend and confirm your Supabase environment variables and schema.`);
    }
  }
  function filteredProducts() {
    const term = els.search.value.trim().toLowerCase();
    const category = els.category.value;
    const status = els.status.value;
    return products.filter((p) => {
      const matchesTerm = !term || p.name.toLowerCase().includes(term) || (p.notes || "").toLowerCase().includes(term);
      const matchesCategory = !category || p.category === category;
      const matchesStatus = !status || statusFor(p.expiry_date) === status;
      return matchesTerm && matchesCategory && matchesStatus;
    }).sort((a,b) => a.expiry_date.localeCompare(b.expiry_date) || a.name.localeCompare(b.name));
  }
  function renderStats() {
    $("#stat-total").textContent = products.length;
    $("#stat-soon").textContent = products.filter(p => statusFor(p.expiry_date) === "soon").length;
    $("#stat-expired").textContent = products.filter(p => statusFor(p.expiry_date) === "expired").length;
    $("#stat-categories").textContent = new Set(products.map(p => p.category)).size;
  }
  function productCard(p) {
    const status = statusFor(p.expiry_date);
    return `<article class="product-card">
      <div class="product-card-top"><span class="category-chip">${escapeHTML(p.category)}</span><span class="status-chip ${status}">${escapeHTML(statusText(p.expiry_date))}</span></div>
      <h3>${escapeHTML(p.name)}</h3><div class="product-notes">${escapeHTML(p.notes || "No notes added")}</div>
      <div class="product-details"><div><div class="detail-label">EXPIRY DATE</div><div class="detail-value expiry-value ${status}">${escapeHTML(formatDate(p.expiry_date))}</div></div><div><div class="detail-label">QUANTITY</div><div class="detail-value">${escapeHTML(p.quantity)}</div></div></div>
      <div class="product-actions"><button class="small-action" data-action="edit" data-id="${escapeHTML(p.id)}">Edit</button><button class="small-action delete" data-action="delete" data-id="${escapeHTML(p.id)}">Delete</button></div>
    </article>`;
  }
  function render() {
    renderStats();
    const filtered = filteredProducts();
    els.resultCount.textContent = `${filtered.length} product${filtered.length === 1 ? "" : "s"} shown`;
    els.list.innerHTML = filtered.map(productCard).join("");
    const noProducts = filtered.length === 0;
    els.empty.classList.toggle("hidden", !noProducts);
    els.list.classList.toggle("hidden", noProducts);
    if (noProducts) {
      const hasFilters = Boolean(els.search.value.trim() || els.category.value || els.status.value);
      els.emptyTitle.textContent = hasFilters ? "No matches found." : "A fresh start.";
      els.emptyMessage.textContent = hasFilters ? "Try changing your search or clearing the filters." : "Add your first product to start tracking expiry dates.";
      $("#empty-add-btn").classList.toggle("hidden", hasFilters);
    }
  }
  function openForm(product = null) {
    els.form.reset();
    els.formError.classList.add("hidden");
    $("#product-id").value = product?.id || "";
    $("#product-name").value = product?.name || "";
    $("#product-category").value = product?.category || "";
    $("#product-quantity").value = product?.quantity ?? 1;
    $("#product-expiry").value = product?.expiry_date || "";
    $("#product-notes").value = product?.notes || "";
    $("#dialog-title").textContent = product ? "Edit product" : "Add a product";
    $("#dialog-eyebrow").textContent = product ? "UPDATE YOUR INVENTORY" : "YOUR INVENTORY";
    els.save.innerHTML = product ? '<span>✓</span> Save changes' : '<span>✓</span> Save product';
    if (!els.dialog.open) els.dialog.showModal();
    $("#product-name").focus();
  }
  function closeForm() { if (els.dialog.open) els.dialog.close(); }
  function validateForm() {
    const name = $("#product-name").value.trim();
    const category = $("#product-category").value;
    const quantity = Number($("#product-quantity").value);
    const expiry = $("#product-expiry").value;
    const notes = $("#product-notes").value.trim();
    if (!name) return "Enter a product name.";
    if (name.length > 100) return "Product names must be 100 characters or fewer.";
    if (!["Food","Medicine","Personal Care","Household","Other"].includes(category)) return "Choose a valid category.";
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99999) return "Quantity must be a whole number between 1 and 99,999.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(Date.parse(`${expiry}T00:00:00Z`))) return "Choose a valid expiry date.";
    if (notes.length > 500) return "Notes must be 500 characters or fewer.";
    return null;
  }
  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const validation = validateForm();
    if (validation) { els.formError.textContent = validation; els.formError.classList.remove("hidden"); return; }
    const id = $("#product-id").value;
    const body = { name: $("#product-name").value.trim(), category: $("#product-category").value, quantity: Number($("#product-quantity").value), expiry_date: $("#product-expiry").value, notes: $("#product-notes").value.trim() || null };
    setLoading(true); els.formError.classList.add("hidden");
    try {
      await api(id ? `/products/${encodeURIComponent(id)}` : "/products", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      closeForm(); toast(id ? "Product updated successfully." : "Product added successfully."); await loadProducts();
    } catch (error) {
      els.formError.textContent = error.message; els.formError.classList.remove("hidden");
    } finally { setLoading(false); }
  });
  els.list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const product = products.find(p => p.id === button.dataset.id);
    if (!product) return;
    if (button.dataset.action === "edit") { openForm(product); return; }
    if (button.dataset.action === "delete") {
      if (!window.confirm(`Delete "${product.name}" from your inventory? This cannot be undone.`)) return;
      button.disabled = true;
      try { await api(`/products/${encodeURIComponent(product.id)}`, { method:"DELETE" }); toast("Product deleted."); await loadProducts(); }
      catch (error) { toast(error.message, "error"); button.disabled = false; }
    }
  });
  $("#add-product-btn").addEventListener("click", () => openForm());
  $("#empty-add-btn").addEventListener("click", () => openForm());
  $("#close-dialog").addEventListener("click", closeForm);
  $("#cancel-dialog").addEventListener("click", closeForm);
  els.dialog.addEventListener("click", (event) => { if (event.target === els.dialog) closeForm(); });
  [els.search, els.category, els.status].forEach(el => el.addEventListener(el === els.search ? "input" : "change", render));
  $("#clear-filters").addEventListener("click", () => { els.search.value = ""; els.category.value = ""; els.status.value = ""; render(); });
  loadProducts();
})();
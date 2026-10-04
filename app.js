const ITEMS = { "日常开销": ["饮食", "出行费", "日用品", "娱乐"], "月固定开销": ["房租", "网费", "手机费", "水电费"], "宠物开销": ["宠物食品", "医疗", "美容", "用品"] };
const categories = Object.keys(ITEMS);
const $ = (id) => document.getElementById(id);
const form = $("record-form"), category = $("category"), item = $("item"), amount = $("amount"), expenseDate = $("expense-date"), note = $("note"), monthPicker = $("month-picker");
let db;

function localDate() { const now = new Date(); const offset = now.getTimezoneOffset() * 60000; return new Date(now - offset).toISOString().slice(0, 10); }
function currentMonth() { return localDate().slice(0, 7); }
function openDatabase() { return new Promise((resolve, reject) => { const request = indexedDB.open("bookkeeping-pwa", 1); request.onupgradeneeded = () => request.result.createObjectStore("records", { keyPath: "id" }); request.onsuccess = () => { db = request.result; resolve(); }; request.onerror = () => reject(request.error); }); }
function transaction(mode = "readonly") { return db.transaction("records", mode).objectStore("records"); }
function allRecords() { return new Promise((resolve, reject) => { const request = transaction().getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function writeRecord(record) { return new Promise((resolve, reject) => { const request = transaction("readwrite").put(record); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); }
function removeRecord(id) { return new Promise((resolve, reject) => { const request = transaction("readwrite").delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); }
function updateItemOptions() { $("item-options").replaceChildren(...ITEMS[category.value].map((name) => Object.assign(document.createElement("option"), { value: name }))); }
function money(value) { return `¥${Number(value).toFixed(2)}`; }
function recordTime(value) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }

async function render() {
  const records = (await allRecords()).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.recordedAt.localeCompare(a.recordedAt));
  const selected = monthPicker.value || currentMonth();
  const totals = Object.fromEntries(categories.map((name) => [name, 0]));
  records.filter((record) => record.expenseDate.startsWith(selected)).forEach((record) => { totals[record.category] = (totals[record.category] || 0) + Number(record.amount); });
  $("month-total").textContent = `本月 ${money(Object.values(totals).reduce((sum, value) => sum + value, 0))}`;
  $("summary").replaceChildren(...categories.map((name) => { const card = document.createElement("div"); card.innerHTML = `${name}<strong>${money(totals[name])}</strong>`; return card; }));
  $("record-count").textContent = `${records.length} 笔`;
  const list = $("records"); list.replaceChildren();
  if (!records.length) { list.innerHTML = '<p class="empty">还没有账目，开始记录第一笔吧。</p>'; return; }
  for (const record of records) { const node = $("record-template").content.firstElementChild.cloneNode(true); node.querySelector(".record-title").textContent = `${record.category} · ${record.item}`; node.querySelector(".record-meta").textContent = `消费：${record.expenseDate}　录入：${recordTime(record.recordedAt)}`; node.querySelector(".record-note").textContent = record.note || ""; node.querySelector("strong").textContent = money(record.amount); node.querySelector("button").addEventListener("click", async () => { if (confirm(`删除“${record.item}”这笔账目？`)) { await removeRecord(record.id); render(); } }); list.append(node); }
}

form.addEventListener("submit", async (event) => { event.preventDefault(); const value = Number(amount.value); if (!Number.isFinite(value) || value <= 0) return; await writeRecord({ id: crypto.randomUUID(), category: category.value, item: item.value.trim(), amount: Math.round(value * 100) / 100, expenseDate: expenseDate.value, note: note.value.trim(), recordedAt: new Date().toISOString() }); form.reset(); category.value = categories[0]; expenseDate.value = localDate(); updateItemOptions(); await render(); });
category.addEventListener("change", updateItemOptions); monthPicker.addEventListener("change", render);
$("export-button").addEventListener("click", async () => { const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: await allRecords() }, null, 2); const url = URL.createObjectURL(new Blob([content], { type: "application/json" })); const link = Object.assign(document.createElement("a"), { href: url, download: `记账器备份-${localDate()}.json` }); link.click(); URL.revokeObjectURL(url); });
$("import-input").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); if (!Array.isArray(imported.records)) throw new Error(); if (!confirm(`导入 ${imported.records.length} 笔账目？同编号记录将被更新。`)) return; for (const record of imported.records) { if (!record.id || !record.category || !record.item || !record.expenseDate) throw new Error(); await writeRecord(record); } await render(); alert("导入完成。"); } catch { alert("备份文件格式不正确，未导入任何数据。"); } finally { event.target.value = ""; } });

(async () => { expenseDate.value = localDate(); monthPicker.value = currentMonth(); updateItemOptions(); await openDatabase(); await render(); if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js"); })().catch(() => alert("本地数据库无法启动，请确认浏览器允许网站存储数据。"));


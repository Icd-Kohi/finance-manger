import React, { useEffect, useMemo, useRef, useState } from "react";

// - Import/Export JSON of all months
//
// Notes:
// - Storage JSON: { months: { "YYYY-MM": { maxBudget: number, items: Item[] } } }

// ---------- Types ----------
/** @typedef {{ id: string; name: string; price: number; createdAt: string; }} Item */
/** @typedef {{ maxBudget: number; items: Item[]; }} MonthData */
/** @typedef {{ months: Record<string, MonthData> }} Store */

// ---------- Storage Helpers ----------
const STORAGE_KEY = "finance_manager_v1";

/** @returns {Store} */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { months: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { months: {} };
    if (!parsed.months || typeof parsed.months !== "object") return { months: {} };
    return parsed;
  } catch (e) {
    console.warn("Falha no parsing do JSON, resetando.", e);
    return { months: {} };
  }
}

/** @param {Store} store */
function saveData(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ---------- Date Helpers ----------
function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

// ---------- Currency ----------
const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ---------- UI Primitives ----------
function TextField({ label, type = "text", value, onChange, placeholder, step, min }) {
  return (
    <label className="flex flex-col gap-1 w-full">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        min={min}
      />
    </label>
  );
}

function Button({ children, onClick, variant = "solid", type = "button", disabled }) {
  const base =
    "rounded-xl px-4 py-2 text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    solid: "bg-indigo-600 text-white hover:bg-indigo-700",
    outline: "border border-gray-300 text-gray-800 hover:bg-gray-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    subtle: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
}

function Card({ children }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">{children}</div>;
}

function Pill({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-800",
    green: "bg-emerald-100 text-emerald-900",
    red: "bg-rose-100 text-rose-900",
    amber: "bg-amber-100 text-amber-900",
    indigo: "bg-indigo-100 text-indigo-900",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${tones[tone]}`}>{children}</span>;
}

// ---------- Core Component ----------
export default function FinanceManager() {
  const [store, setStore] = useState/** @type {[Store, any]} */(loadData());
  const [activeMonth, setActiveMonth] = useState(monthKey());

  // Ensure month exists on load / month change
  useEffect(() => {
    setStore((prev) => {
      const next = { ...prev };
      if (!next.months[activeMonth]) {
        next.months[activeMonth] = { maxBudget: 0, items: [] };
        saveData(next);
      }
      return next;
    });
  }, [activeMonth]);

  // Persist store
  useEffect(() => {
    saveData(store);
  }, [store]);

  const data = store.months[activeMonth] || { maxBudget: 0, items: [] };
  const items = data.items;
  const maxBudget = Number(data.maxBudget) || 0;

  // Derived totals
  const total = useMemo(() => items.reduce((s, it) => s + (Number(it.price) || 0), 0), [items]);
  const exceeded = Math.max(total - maxBudget, 0);
  const exceeding = total > maxBudget && maxBudget > 0;

  // Compute which items are beyond the budget using cumulative sum
  const overBudgetMap = useMemo(() => {
    let running = 0;
    return items.map((it) => {
      const price = Number(it.price) || 0;
      const start = running;
      running += price;
      // Mark item red if any portion of this item lies beyond maxBudget
      return maxBudget > 0 && start < maxBudget && running > maxBudget || start >= maxBudget;
    });
  }, [items, maxBudget]);

  // --- Actions ---
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

function addItem() {
  if (!newName.trim()) return;
  const price = Number(newPrice);
  if (isNaN(price) || price <= 0) return;

  const item = {
    id: crypto.randomUUID(),
    name: newName.trim(),
    price,
    createdAt: new Date().toISOString(),
  };

  setStore((prev) => {
    const next = { ...prev, months: { ...prev.months } };
    const current = next.months[activeMonth];
    next.months[activeMonth] = {
      ...current,
      items: [...current.items, item], // <-- new array, safe
    };
    return next;
  });

  setNewName("");
  setNewPrice("");
}

function removeItem(id) {
  if (!confirm("Excluir item?")) return;
  setStore((prev) => {
    const next = { ...prev, months: { ...prev.months } };
    const current = next.months[activeMonth];
    next.months[activeMonth] = {
      ...current,
      items: current.items.filter((it) => it.id !== id),
    };
    return next;
  });
}

function updateItem(id, fields) {
  setStore((prev) => {
    const next = { ...prev, months: { ...prev.months } };
    const current = next.months[activeMonth];
    next.months[activeMonth] = {
      ...current,
      items: current.items.map((it) =>
        it.id === id ? { ...it, ...fields } : it
      ),
    };
    return next;
  });
}

  function updateBudget(val) {
    const n = Number(val);
    setStore((prev) => {
      const next = { ...prev };
      const m = next.months[activeMonth];
      m.maxBudget = isNaN(n) ? 0 : n;
      return next;
    });
  }

  function resetMonth() {
    if (!confirm("Resetar este mês? Todos os itens serão removidos.")) return;
    setStore((prev) => {
      const next = { ...prev };
      next.months[activeMonth] = { maxBudget: 0, items: [] };
      return next;
    });
  }

  // Import / Export
  function exportAll() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${activeMonth}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fileRef = useRef/** @type {React.RefObject<HTMLInputElement>} */(null);
  function importAll(evt) {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object" || !parsed.months) throw new Error("Formato inválido");
        setStore(parsed);
        alert("Importado com sucesso.");
      } catch (e) {
        alert("Falha ao importar: " + (e?.message || e));
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  // Editing inline state
  const [editingId, setEditingId] = useState/** @type {[string|null, any]} */(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  function startEdit(it) {
    setEditingId(it.id);
    setEditName(it.name);
    setEditPrice(String(it.price));
  }

  function confirmEdit() {
    if (!editingId) return;
    const nPrice = Number(editPrice);
    if (!editName.trim() || isNaN(nPrice) || nPrice <= 0) return;
    updateItem(editingId, { name: editName.trim(), price: nPrice });
    cancelEdit();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
  }

  // Auto-rollover note: If system month changes while app open, you can add a timer.
  // Simpler: on load we use the current system month; users can change via Month Picker.

  // Month Picker (YYYY-MM)
  const [monthInput, setMonthInput] = useState(activeMonth);
  useEffect(() => setMonthInput(activeMonth), [activeMonth]);

  function applyMonthChange() {
    if (!/^\d{4}-\d{2}$/.test(monthInput)) return alert("Use o formato AAAA-MM");
    setActiveMonth(monthInput);
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Despesas mensais.</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2"
          />
          <Button variant="outline" onClick={applyMonthChange}>Abrir mês</Button>
          <Button variant="subtle" onClick={() => setActiveMonth(monthKey())}>Este mês</Button>
        </div>
      </div>

      {/* Budget + Totals */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="Orçamento maximo do mês" // maxBudget
              type="number"
              value={data.maxBudget}
              onChange={(e) => updateBudget(e.target.value)}
              step="0.01"
              min="0"
            />
            <div className="flex-1" />
            <div className="flex flex-col gap-2 min-w-[220px]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <strong>{fmt.format(total)}</strong>
              </div>
              <div className="w-full rounded-full bg-gray-100 h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${exceeding ? "bg-rose-500" : "bg-emerald-500"}`}
                  style={{ width: `${maxBudget > 0 ? Math.min((total / maxBudget) * 100, 100) : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={exceeding ? "red" : "green"}>
                  {exceeding ? "Acima do orçamento" : "Dentro do orçamento"}
                </Pill>
                {maxBudget > 0 && (
                  <Pill tone="indigo">Orçamento: {fmt.format(maxBudget)}</Pill>
                )}
                {exceeded > 0 && (
                  <Pill tone="red">Excedido: {fmt.format(exceeded)}</Pill>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Add Item */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField label="Item" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Mercado" />
          <TextField label="Preço" type="number" step="0.01" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0,00" />
          <div className="flex gap-2">
            <Button onClick={addItem}>Adicionar</Button>
            <Button variant="subtle" onClick={() => { setNewName(""); setNewPrice(""); }}>Limpar</Button>
          </div>
        </div>
        {exceeding && (
          <p className="mt-3 text-sm text-rose-600">Orçamento excedido: os próximos itens ficam destacados em vermelho e contam no total excedido.</p>
        )}
      </Card>

      {/* Items List */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Itens</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2">#</th>
                <th className="py-2">Item</th>
                <th className="py-2">Preço</th>
                <th className="py-2">Criado em</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">Sem itens neste mês.</td>
                </tr>
              )}
              {items.map((it, idx) => {
                const isEditing = editingId === it.id;
                const isOver = overBudgetMap[idx];
                return (
                  <tr key={it.id} className={isOver ? "bg-rose-50" : ""}>
                    <td className="py-2 align-middle">{idx + 1}</td>
                    <td className="py-2 align-middle">
                      {isEditing ? (
                        <input
                          className="w-full rounded-lg border border-gray-300 px-2 py-1"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        <span className={`font-medium ${isOver ? "text-rose-700" : "text-gray-900"}`}>{it.name}</span>
                      )}
                    </td>
                    <td className="py-2 align-middle">
                      {isEditing ? (
                        <input
                          className="w-32 rounded-lg border border-gray-300 px-2 py-1"
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                        />
                      ) : (
                        <span className={`tabular-nums ${isOver ? "text-rose-700" : "text-gray-900"}`}>{fmt.format(it.price)}</span>
                      )}
                    </td>
                    <td className="py-2 align-middle text-gray-600">
                      {new Date(it.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 align-middle text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="subtle" onClick={cancelEdit}>Cancelar</Button>
                          <Button onClick={confirmEdit}>Salvar</Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => startEdit(it)}>Editar</Button>
                          <Button variant="danger" onClick={() => removeItem(it.id)}>Excluir</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Footer */}
      <div className="flex gap-2">
      <Button variant="outline" onClick={exportAll}>Exportar</Button>
      <input ref={fileRef} onChange={importAll} type="file" accept="application/json" className="hidden" />
      <Button variant="outline" onClick={() => fileRef.current?.click()}>Importar</Button>
      <Button variant="danger" onClick={resetMonth}>Resetar mês</Button>
      </div>
      <div className="text-xs text-gray-500" >
      <p>
          <strong>FAZER BACKUP PERIODICAMENTE</strong>. (Só pressionar Exportar)
        </p>
      </div>
    </div>
  );
}

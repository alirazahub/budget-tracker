"use client";

import { useEffect, useMemo, useState } from "react";

type TransactionType = "income" | "expense";

type Transaction = {
  _id: string;
  type: TransactionType;
  category: string;
  amount: number;
  note?: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
};

type TransactionForm = {
  type: TransactionType;
  category: string;
  amount: string;
  note: string;
  date: string;
};

const todayISO = new Date().toISOString().slice(0, 10);

const presetCategories: Record<TransactionType, string[]> = {
  income: ["Salary", "Bonus", "Investments", "Freelance", "Gift", "Other"],
  expense: [
    "Housing",
    "Food",
    "Transportation",
    "Health",
    "Entertainment",
    "Utilities",
    "Debt",
    "Savings",
    "Other",
  ],
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<TransactionForm>({
    type: "expense",
    category: "Housing",
    amount: "",
    note: "",
    date: todayISO,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((item) => item.type === filter);
  }, [transactions, filter]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);

  async function fetchTransactions() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/transactions", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load transactions");
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
      setError("Could not load your transactions. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ type: "expense", category: "Housing", amount: "", note: "", date: todayISO });
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      ...form,
      amount: Number(form.amount),
    };

    try {
      const endpoint = editingId ? `/api/transactions/${editingId}` : "/api/transactions";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save transaction");
      }

      if (editingId) {
        setTransactions((prev) =>
          prev.map((item) => (item._id === editingId ? data.transaction : item))
        );
      } else {
        setTransactions((prev) => [data.transaction, ...prev]);
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx._id);
    setForm({
      type: tx.type,
      category: tx.category,
      amount: tx.amount.toString(),
      note: tx.note || "",
      date: tx.date.slice(0, 10),
    });
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete transaction");
      }
      setTransactions((prev) => prev.filter((item) => item._id !== id));
      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete transaction");
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Personal finance</p>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Budget Tracker</h1>
          </div>
          <div className="pill text-sm text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            MongoDB + Next.js
          </div>
        </header>

        {error ? (
          <div className="card border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-sm text-slate-600">Balance</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {currency.format(totals.balance)}
            </p>
            <p className="text-xs text-slate-500">Income - Expenses</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-emerald-600">Income</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">
              {currency.format(totals.income)}
            </p>
            <p className="text-xs text-slate-500">Total money in</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-rose-600">Expenses</p>
            <p className="mt-2 text-3xl font-semibold text-rose-700">
              {currency.format(totals.expense)}
            </p>
            <p className="text-xs text-slate-500">Total money out</p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[420px,1fr]">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Add or edit</p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingId ? "Update transaction" : "New transaction"}
                </h2>
              </div>
              {editingId ? (
                <button className="muted-btn text-sm" type="button" onClick={resetForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600" htmlFor="type">
                    Type
                  </label>
                  <select
                    id="type"
                    className="input mt-1"
                    value={form.type}
                    onChange={(e) => {
                      const nextType = e.target.value as TransactionType;
                      setForm((prev) => ({
                        ...prev,
                        type: nextType,
                        category: presetCategories[nextType][0],
                      }));
                    }}
                    required
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600" htmlFor="category">
                    Category
                  </label>
                  <select
                    id="category"
                    className="input mt-1"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    required
                  >
                    {presetCategories[form.type].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600" htmlFor="amount">
                    Amount
                  </label>
                  <input
                    id="amount"
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600" htmlFor="date">
                    Date
                  </label>
                  <input
                    id="date"
                    className="input mt-1"
                    type="date"
                    value={form.date}
                    max={todayISO}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600" htmlFor="note">
                  Note
                </label>
                <input
                  id="note"
                  className="input mt-1"
                  type="text"
                  value={form.note}
                  maxLength={200}
                  placeholder="Optional note"
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <button className="primary-btn mt-1" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save changes" : "Add transaction"}
              </button>
            </form>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm text-slate-600">History</p>
                <h2 className="text-xl font-semibold text-slate-900">Recent transactions</h2>
              </div>
              <div className="ml-auto flex gap-2 text-sm">
                {["all", "income", "expense"].map((option) => (
                  <button
                    key={option}
                    className={`muted-btn ${
                      filter === option ? "border-sky-400 bg-sky-50 text-sky-700" : ""
                    }`}
                    onClick={() => setFilter(option as typeof filter)}
                    type="button"
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-slate-600">Loading transactions...</p>
            ) : filteredTransactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">
                No transactions yet. Add your first entry.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Note</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx._id} className="table-row">
                        <td className="px-4 py-3">
                          <span
                            className={`pill text-xs font-semibold ${
                              tx.type === "income" ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                tx.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {tx.type === "income" ? "Income" : "Expense"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{tx.category}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {tx.type === "expense" ? "-" : "+"}
                          {currency.format(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{tx.note || "—"}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <div className="flex justify-end gap-2">
                            <button
                              className="muted-btn"
                              type="button"
                              onClick={() => startEdit(tx)}
                            >
                              Edit
                            </button>
                            <button
                              className="muted-btn text-rose-600"
                              type="button"
                              onClick={() => handleDelete(tx._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

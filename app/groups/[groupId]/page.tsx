"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

type User = {
  id: string;
  email: string;
  name: string;
};

type GroupMember = {
  _id: string;
  name: string;
  role: string;
};

type Group = {
  _id: string;
  name: string;
  inviteCode: string;
  createdByName: string;
  createdById: string;
  members: GroupMember[];
  expenseTypes: string[];
};

type Expense = {
  _id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  paidByUserId: string;
  involved: Array<{ userId: string; name: string }>;
  date: string;
  type: string;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [involved, setInvolved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Auth check
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("auth_token");
    const userStr = window.localStorage.getItem("auth_user");

    if (!token || !userStr) {
      router.push("/auth");
      return;
    }

    try {
      setUser(JSON.parse(userStr));
    } catch {
      router.push("/auth");
    }

    setAuthChecked(true);
  }, [router]);

  // Fetch group and expenses
  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`);
      const data = await response.json();
      if (response.ok) {
        setGroup(data.group);
        setType(data.group.expenseTypes[0] || "");
        setPaidBy(data.group.members[0]?.name || "");
        setInvolved(data.group.members.map((m: GroupMember) => m.name));
      }
    } catch (err) {
      console.error("Failed to fetch group:", err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchExpenses = useCallback(async () => {
    if (!groupId) return;
    try {
      const response = await fetch(`/api/groups/${groupId}/expenses`);
      const data = await response.json();
      if (response.ok) {
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    }
  }, [groupId]);

  useEffect(() => {
    if (!authChecked) return;
    fetchGroup();
    fetchExpenses();
  }, [authChecked, fetchGroup, fetchExpenses]);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!group || !user) return;

    if (!description.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter valid description and amount");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: Number(amount),
          type,
          paidBy,
          paidByUserId: group.members.find((m) => m.name === paidBy)?._id || user.id,
          involved: involved.map((name) => ({
            userId: group.members.find((m) => m.name === name)?._id || "",
            name,
          })),
          date,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add expense");
      }

      setExpenses((prev) => [data.expense, ...prev]);
      setDescription("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setShowAddExpense(false);
      setToast("Expense added successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setSaving(false);
    }
  }

  function copyInviteLink() {
    if (!group || typeof window === "undefined") return;
    const link = `${window.location.origin}?invite=${group.inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setToast("Invite link copied!");
    });
  }

  const isAdmin = group && user && group.createdById === user.id;
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (!authChecked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading group...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-linear-to-br from-sky-50 to-slate-50 p-4 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <button
            className="muted-btn text-sm mb-8"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            ← Back to Dashboard
          </button>
          <div className="card p-6 text-center">
            <p className="text-slate-600">Group not found</p>
            <button
              className="primary-btn text-sm mt-4"
              type="button"
              onClick={() => router.push("/dashboard")}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-sky-50 to-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            className="muted-btn text-sm mb-4"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">{group.name}</h1>
              <p className="text-slate-600 mt-1">{group.members.length} members</p>
            </div>
            {isAdmin && (
              <span className="pill text-sm text-emerald-700">You're the admin</span>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mb-4 card p-3 bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
            {toast}
            <button
              className="muted-btn text-xs ml-2"
              type="button"
              onClick={() => setToast(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 card p-3 bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
            <button
              className="muted-btn text-xs ml-2"
              type="button"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">Total Spent</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{currency.format(totalSpent)}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">Expenses</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{expenses.length}</p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">Members</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{group.members.length}</p>
          </div>
        </div>

        {/* Add Expense Section */}
        {showAddExpense && (
          <div className="mb-8 card p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Add Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600" htmlFor="description">
                    Description
                  </label>
                  <input
                    id="description"
                    className="input mt-1"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Dinner, Groceries..."
                    required
                  />
                </div>
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600" htmlFor="type">
                    Category
                  </label>
                  <select
                    id="type"
                    className="input mt-1"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    required
                  >
                    {group.expenseTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600" htmlFor="paidBy">
                    Paid By
                  </label>
                  <select
                    id="paidBy"
                    className="input mt-1"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    required
                  >
                    {group.members.map((m) => (
                      <option key={m._id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  className="input mt-1"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Who was involved?</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.members.map((member) => (
                    <label
                      key={member._id}
                      className="pill cursor-pointer select-none text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={involved.includes(member.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInvolved((prev) => [...prev, member.name]);
                          } else {
                            setInvolved((prev) =>
                              prev.filter((n) => n !== member.name)
                            );
                          }
                        }}
                        className="mr-2"
                      />
                      {member.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  className="primary-btn flex-1"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Add Expense"}
                </button>
                <button
                  className="muted-btn"
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {!showAddExpense && (
          <div className="mb-8">
            <button
              className="primary-btn text-sm"
              type="button"
              onClick={() => setShowAddExpense(true)}
            >
              + Add Expense
            </button>
          </div>
        )}

        {/* Expenses List */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Expenses</h2>
          {expenses.length === 0 ? (
            <div className="card p-6 text-center text-slate-600">
              No expenses yet
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div key={expense._id} className="card p-4 flex justify-between items-center">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{expense.description}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(expense.date).toLocaleDateString()} • {expense.type} • Paid by{" "}
                      {expense.paidBy}
                    </p>
                  </div>
                  <p className="font-bold text-slate-900">{currency.format(expense.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Group Settings */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Group Settings</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 font-semibold mb-2">Invite Link</p>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  type="text"
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}?invite=${group.inviteCode}`
                      : ""
                  }
                  readOnly
                />
                <button
                  className="muted-btn"
                  type="button"
                  onClick={copyInviteLink}
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-600 font-semibold mb-2">Members</p>
              <div className="flex flex-wrap gap-2">
                {group.members.map((member) => (
                  <div
                    key={member._id}
                    className="pill text-sm text-slate-700 flex items-center gap-2"
                  >
                    {member.name}
                    {group.createdById &&
                      group.members.find((m) => m._id === member._id)?._id ===
                        group.members.find((m) => m._id === group.members[0]._id)?._id && (
                        <span className="text-xs text-emerald-600 font-semibold">admin</span>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

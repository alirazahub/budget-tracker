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
  currency: string;
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

// Supported currencies (must match API)
const CURRENCIES = [
  { code: "USD", name: "US Dollar ($)" },
  { code: "EUR", name: "Euro (€)" },
  { code: "GBP", name: "British Pound (£)" },
  { code: "PKR", name: "Pakistani Rupee (₨)" },
];

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
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [changingCurrency, setChangingCurrency] = useState(false);
  const [balances, setBalances] = useState<Record<string, { net: number }>>({});

  function isSameWeek(dateA: Date, dateB: Date) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    const startOfWeek = (d: Date) => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const res = new Date(d);
      res.setDate(diff);
      res.setHours(0, 0, 0, 0);
      return res;
    };
    const aStart = startOfWeek(a);
    const bStart = startOfWeek(b);
    return aStart.getTime() === bStart.getTime();
  }

  function isSameMonth(dateA: Date, dateB: Date) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function getPeriodTotal(list: Expense[], period: "week" | "month") {
    const now = new Date();
    return list.reduce((sum, e) => {
      const d = new Date(e.date);
      const match = period === "week" ? isSameWeek(d, now) : isSameMonth(d, now);
      return match ? sum + (Number(e.amount) || 0) : sum;
    }, 0);
  }

  function computeBalances(list: Expense[], members: GroupMember[]) {
    const map: Record<string, { net: number }> = {};
    const ensure = (id: string) => {
      if (!map[id]) map[id] = { net: 0 };
      return id;
    };
    const resolveId = (userId?: string, name?: string) => {
      const memberMatch = name ? members.find((m) => m.name === name) : undefined;
      if (memberMatch) return ensure(memberMatch._id);
      if (userId) return ensure(userId);
      return null;
    };

    members.forEach((m) => ensure(m._id));

    list.forEach((e) => {
      const payerId = resolveId(e.paidByUserId, e.paidBy);
      const involvedIds = e.involved
        .map((inv) => resolveId(inv.userId, inv.name))
        .filter((id): id is string => Boolean(id));

      const share = involvedIds.length > 0 ? (Number(e.amount) || 0) / involvedIds.length : 0;

      if (payerId) {
        map[payerId].net += Number(e.amount) || 0;
      }

      involvedIds.forEach((uid) => {
        map[uid].net -= share;
      });
    });
    return map;
  }

  function getOverallOwe(b: Record<string, { net: number }>) {
    return Object.values(b).reduce((sum, x) => (x.net < 0 ? sum + Math.abs(x.net) : sum), 0);
  }
  function getOverallOwedTo(b: Record<string, { net: number }>) {
    return Object.values(b).reduce((sum, x) => (x.net > 0 ? sum + x.net : sum), 0);
  }

  const getUserNet = useCallback(
    (userId: string) => balances[userId]?.net ?? 0,
    [balances]
  );

  function computeUserSettlements(
    b: Record<string, { net: number }>,
    userId: string,
    members: GroupMember[]
  ) {
    const userNet = b[userId]?.net ?? 0;
    if (userNet === 0) return [];

    const creditors = Object.entries(b)
      .filter(([id, v]) => id !== userId && v.net > 0)
      .map(([id, v]) => ({ id, amount: v.net }));
    const debtors = Object.entries(b)
      .filter(([id, v]) => id !== userId && v.net < 0)
      .map(([id, v]) => ({ id, amount: Math.abs(v.net) }));

    const settlements: Array<{ counterpartyId: string; amount: number; direction: "owes" | "owed" }> = [];

    if (userNet < 0) {
      let remaining = Math.abs(userNet);
      for (const c of creditors) {
        if (remaining <= 0) break;
        const pay = Math.min(remaining, c.amount);
        if (pay > 0) {
          settlements.push({ counterpartyId: c.id, amount: pay, direction: "owes" });
          remaining -= pay;
        }
      }
    } else if (userNet > 0) {
      let remaining = userNet;
      for (const d of debtors) {
        if (remaining <= 0) break;
        const receive = Math.min(remaining, d.amount);
        if (receive > 0) {
          settlements.push({ counterpartyId: d.id, amount: receive, direction: "owed" });
          remaining -= receive;
        }
      }
    }

    // Filter to only members present
    const memberIds = new Set(members.map((m) => m._id));
    return settlements.filter((s) => memberIds.has(s.counterpartyId));
  }

  function getUserExpenseDelta(expense: Expense, currentUserId: string, members: GroupMember[]) {
    const memberIdByName = members.find((m) => m.name === user?.name)?._id;
    const userKeys = [currentUserId, memberIdByName].filter(Boolean) as string[];

    const involvedIds = expense.involved
      .map((inv) => inv.userId || members.find((m) => m.name === inv.name)?._id)
      .filter((id): id is string => Boolean(id));
    const share = involvedIds.length > 0 ? (Number(expense.amount) || 0) / involvedIds.length : 0;

    const userInvolved = involvedIds.some((id) => userKeys.includes(id));
    const isPayer = userKeys.includes(expense.paidByUserId) || (user?.name && expense.paidBy === user.name);

    if (isPayer) {
      const selfShare = userInvolved ? share : 0;
      return (Number(expense.amount) || 0) - selfShare;
    }
    if (userInvolved) {
      return -share;
    }
    return 0;
  }

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
        setSelectedCurrency(data.group.currency || "USD");
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
        if (group) {
          setBalances(computeBalances(data.expenses || [], group.members));
        }
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

  // Recompute balances when group or expenses change
  useEffect(() => {
    if (group) {
      setBalances(computeBalances(expenses, group.members));
    }
  }, [group, expenses]);

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

        {/* Spending & Balances */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">Current Week Spent</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(getPeriodTotal(expenses, "week"))}
            </p>
            <p className="text-sm text-slate-600 mt-2">Current Month Spent</p>
            <p className="text-xl font-semibold text-slate-900">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(getPeriodTotal(expenses, "month"))}
            </p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">Your Balance</p>
            {(() => {
              const net = getUserNet(user.id);
              const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(Math.abs(net));
              const status = net < 0 ? "You owe" : net > 0 ? "You are owed" : "You are settled";
              const color = net < 0 ? "text-rose-700" : net > 0 ? "text-emerald-700" : "text-slate-700";
              return (
                <div className="mt-2">
                  <p className="text-xs text-slate-500">Current user</p>
                  <p className={`text-2xl font-bold ${color}`}>
                    {status} {net === 0 ? "" : formatted}
                  </p>
                </div>
              );
            })()}
            <div className="mt-4 flex justify-between text-sm text-slate-600">
              <div>
                <p className="uppercase font-semibold">Total Owe</p>
                <p className="font-semibold text-rose-700">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(getOverallOwe(balances))}
                </p>
              </div>
              <div className="text-right">
                <p className="uppercase font-semibold">Total Owed</p>
                <p className="font-semibold text-emerald-700">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(getOverallOwedTo(balances))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Member-wise balances relative to you */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Member Balances</h2>
          <div className="space-y-2">
            {computeUserSettlements(balances, user.id, group.members).map((s) => {
              const member = group.members.find((m) => m._id === s.counterpartyId);
              if (!member) return null;
              const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(s.amount);
              const isOwe = s.direction === "owes";
              return (
                <div key={member._id} className="card p-4 flex justify-between items-center">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">{isOwe ? "You owe" : "Owes you"}</p>
                  </div>
                  <p className={`font-bold ${isOwe ? "text-rose-700" : "text-emerald-700"}`}>{formatted}</p>
                </div>
              );
            })}
            {computeUserSettlements(balances, user.id, group.members).length === 0 && (
              <div className="card p-4 text-slate-600 text-sm">You're settled with everyone.</div>
            )}
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
                    <p className="text-xs text-slate-400">
                      Involved: {expense.involved.map((inv) => inv.name).join(", ")}
                    </p>
                    <p className="text-xs text-slate-400">Total: {new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(expense.amount)}</p>
                  </div>
                  {(() => {
                    const delta = getUserExpenseDelta(expense, user.id, group.members);
                    if (delta === 0) {
                      return (
                        <p className="font-semibold text-slate-700">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(0)}
                        </p>
                      );
                    }
                    const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: group.currency || "USD" }).format(Math.abs(delta));
                    const isOwe = delta < 0;
                    return (
                      <div className="text-right">
                        <p className={`font-bold ${isOwe ? "text-rose-700" : "text-emerald-700"}`}>
                          {isOwe ? "You owe" : "You get"} {formatted}
                        </p>
                      </div>
                    );
                  })()}
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

            {isAdmin && (
              <div>
                <p className="text-sm text-slate-600 font-semibold mb-2">Group Currency</p>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-slate-900 min-w-fit">
                    {CURRENCIES.find((c) => c.code === selectedCurrency)?.name || selectedCurrency}
                  </div>
                  <button
                    className="muted-btn text-sm"
                    type="button"
                    onClick={() => setChangingCurrency(!changingCurrency)}
                    disabled={changingCurrency}
                  >
                    {changingCurrency ? "Changing..." : "Change"}
                  </button>
                </div>
                {changingCurrency && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <select
                      className="input text-sm w-full"
                      aria-label="Select group currency"
                      value={selectedCurrency}
                      onChange={async (e) => {
                        const newCurrency = e.target.value;
                        setSelectedCurrency(newCurrency);
                        setChangingCurrency(false);

                        try {
                          const response = await fetch(`/api/groups/${groupId}/currency`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                              currency: newCurrency,
                              userId: user?.id 
                            }),
                          });

                          if (response.ok) {
                            setToast(`Currency updated to ${newCurrency}`);
                            // Update local group state so UI immediately reflects new currency
                            setGroup((prev) => prev ? { ...prev, currency: newCurrency } : prev);
                            // Refetch group to ensure DB persistence and fresh data
                            await fetchGroup();
                          } else {
                            const data = await response.json();
                            setToast(data.error || "Failed to update currency");
                            setSelectedCurrency(group.currency);
                          }
                        } catch (err) {
                          console.error("Failed to update currency:", err);
                          setToast("Error updating currency");
                          setSelectedCurrency(group.currency);
                        }
                      }}
                    >
                      {CURRENCIES.map((curr) => (
                        <option key={curr.code} value={curr.code}>
                          {curr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

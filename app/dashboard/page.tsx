"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
  members: GroupMember[];
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  // Stats calculations
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlySpent = expenses
    .filter((e) => {
      const expDate = new Date(e.date);
      const now = new Date();
      return (
        expDate.getMonth() === now.getMonth() &&
        expDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const weeklySpent = expenses
    .filter((e) => {
      const expDate = new Date(e.date);
      const now = new Date();
      const daysAgo = (now.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // Settlement calculations
  const calculateGroupSettlement = (groupId: string) => {
    const groupExpenses = expenses.filter((e) => e.groupId === groupId);
    let userOwes = 0;
    let userIsOwed = 0;

    groupExpenses.forEach((expense) => {
      const isInvolved = expense.involved.some((inv) => inv.userId === user?.id);
      if (isInvolved) {
        const shareAmount = expense.amount / expense.involved.length;
        if (expense.paidByUserId === user?.id) {
          userIsOwed += expense.amount - shareAmount;
        } else {
          userOwes += shareAmount;
        }
      }
    });

    return { owes: userOwes, owed: userIsOwed, net: userIsOwed - userOwes };
  };

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

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const response = await fetch(
        `/api/groups?memberName=${encodeURIComponent(user.name)}`
      );
      const data = await response.json();
      if (response.ok) {
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, [user]);

  // Fetch all expenses
  const fetchAllExpenses = useCallback(async () => {
    if (groups.length === 0) {
      setExpenses([]);
      return;
    }
    setLoadingExpenses(true);
    try {
      const expensePromises = groups.map((group) =>
        fetch(`/api/groups/${group._id}/expenses`).then((r) => r.json())
      );
      const results = await Promise.all(expensePromises);
      const allExpenses = results.flatMap((data) => data.expenses || []);
      setExpenses(allExpenses);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoadingExpenses(false);
    }
  }, [groups]);

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user, fetchGroups]);

  useEffect(() => {
    if (groups.length === 0) {
      setExpenses([]);
      return;
    }
    fetchAllExpenses();
  }, [groups, fetchAllExpenses]);

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    router.push("/auth");
  }

  if (!authChecked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Splitwise</h1>
            <p className="text-slate-600">Welcome, {user.name}</p>
          </div>
          <button
            className="muted-btn"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </header>

        {/* Spending Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">
              This Week
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {currency.format(weeklySpent)}
            </p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">
              This Month
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {currency.format(monthlySpent)}
            </p>
          </div>
          <div className="card p-6">
            <p className="text-sm text-slate-600 font-semibold uppercase">
              Total Spent
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {currency.format(totalSpent)}
            </p>
          </div>
        </div>

        {/* Settlement Summary */}
        <div className="mb-8 card p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Settlement Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-600">You owe</p>
              <p className="text-3xl font-bold text-rose-600">
                {currency.format(
                  groups.reduce((sum, g) => sum + calculateGroupSettlement(g._id).owes, 0)
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">You are owed</p>
              <p className="text-3xl font-bold text-emerald-600">
                {currency.format(
                  groups.reduce((sum, g) => sum + calculateGroupSettlement(g._id).owed, 0)
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Personal Expenses */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Personal Expenses
          </h2>
          {loadingExpenses ? (
            <div className="card p-6 text-center text-slate-600">
              Loading expenses...
            </div>
          ) : expenses.filter((e) => e.paidByUserId === user.id).length === 0 ? (
            <div className="card p-6 text-center text-slate-600">
              No personal expenses yet
            </div>
          ) : (
            <div className="space-y-2">
              {expenses
                .filter((e) => e.paidByUserId === user.id)
                .slice(0, 5)
                .map((expense) => (
                  <div
                    key={expense._id}
                    className="card p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {expense.description}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(expense.date).toLocaleDateString()} •{" "}
                        {expense.type}
                      </p>
                    </div>
                    <p className="font-bold text-slate-900">
                      {currency.format(expense.amount)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Groups */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900">Your Groups</h2>
            <div className="flex gap-2">
              <button
                className="primary-btn text-sm"
                type="button"
                onClick={() => router.push("/groups/new")}
              >
                + New Group
              </button>
              <button
                className="muted-btn text-sm"
                type="button"
                onClick={() => router.push("/groups/join")}
              >
                Join Group
              </button>
            </div>
          </div>

          {loadingGroups ? (
            <div className="card p-6 text-center text-slate-600">
              Loading groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="card p-6 text-center text-slate-600">
              <p>No groups yet</p>
              <div className="flex gap-2 justify-center mt-3">
                <button
                  className="primary-btn text-sm"
                  type="button"
                  onClick={() => router.push("/groups/new")}
                >
                  Create Group
                </button>
                <button
                  className="muted-btn text-sm"
                  type="button"
                  onClick={() => router.push("/groups/join")}
                >
                  Join Group
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const settlement = calculateGroupSettlement(group._id);
                return (
                  <div
                    key={group._id}
                    className="card p-4 flex justify-between items-center hover:shadow-md transition cursor-pointer"
                    onClick={() => router.push(`/groups/${group._id}`)}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {group.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {group.members.length} members
                      </p>
                    </div>
                    <div className="text-right">
                      {settlement.net > 0 ? (
                        <p className="font-bold text-emerald-600">
                          +{currency.format(settlement.net)}
                        </p>
                      ) : settlement.net < 0 ? (
                        <p className="font-bold text-rose-600">
                          {currency.format(settlement.net)}
                        </p>
                      ) : (
                        <p className="font-bold text-slate-600">Settled</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {settlement.net > 0
                          ? "you are owed"
                          : settlement.net < 0
                          ? "you owe"
                          : "settled"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

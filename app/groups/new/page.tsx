"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  name: string;
};

export default function NewGroupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !groupName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          createdByName: user.name,
          createdById: user.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create group");
      }

      // Redirect to group details page
      router.push(`/groups/${data.group._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-sky-50 to-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-md">
        <div className="mb-8">
          <button
            className="muted-btn text-sm"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="card p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Group</h1>
          <p className="text-slate-600 mb-6">
            You'll be the admin and can manage group settings.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="text-sm text-slate-600" htmlFor="group-name">
                Group Name
              </label>
              <input
                id="group-name"
                className="input mt-1"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Roommates, Trip, Project"
                required
              />
            </div>

            <button
              className="primary-btn w-full"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Group"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

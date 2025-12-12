"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  name: string;
};

export default function JoinGroupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
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

  function extractInviteCode(input: string) {
    const trimmed = input.trim();
    const regex = /([a-f0-9]{10,})/i;
    const match = trimmed.match(regex);
    return match ? match[1] : trimmed;
  }

  async function handleJoinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const code = extractInviteCode(inviteCode);
    if (!code) {
      setError("Please enter a valid invite code or link");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: code,
          memberName: user.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to join group");
      }

      // Redirect to group details page
      router.push(`/groups/${data.group._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Join Group</h1>
          <p className="text-slate-600 mb-6">
            Enter the invite code or paste the invite link you received.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div>
              <label className="text-sm text-slate-600" htmlFor="invite-code">
                Invite Code or Link
              </label>
              <input
                id="invite-code"
                className="input mt-1"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="https://... or paste code"
                required
              />
            </div>

            <button
              className="primary-btn w-full"
              type="submit"
              disabled={loading}
            >
              {loading ? "Joining..." : "Join Group"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

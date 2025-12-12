"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = window.localStorage.getItem("auth_token");

    if (!token) {
      // Not authenticated, redirect to auth
      router.push("/auth");
    } else {
      // Authenticated, redirect to dashboard
      router.push("/dashboard");
    }

    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-sky-50 to-slate-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Splitwise</h1>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}

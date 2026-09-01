"use client";

import { useRouter } from "next/navigation";

import { clearToken } from "@healthcore/auth";

import { setTelemetryUser } from "@/lib/telemetry";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  function handleLogout() {
    setTelemetryUser(null);
    clearToken();
    router.replace("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className ?? "text-slate-400 hover:text-white hover:underline"}
    >
      Log out
    </button>
  );
}

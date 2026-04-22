"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function RangePicker({ defaultMonth }: { defaultMonth: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"month" | "custom">(
    sp.get("from") && sp.get("to") ? "custom" : "month",
  );
  const [month, setMonth] = useState(sp.get("month") ?? defaultMonth);
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (mode === "month") {
      params.set("month", month);
    } else if (from && to) {
      params.set("from", from);
      params.set("to", to);
    }
    start(() => router.push(`/?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-ink-200/70 rounded-full px-2 py-1.5">
      <div className="inline-flex rounded-full bg-ink-100 p-0.5 text-xs">
        <button
          onClick={() => setMode("month")}
          className={`px-3 py-1.5 rounded-full transition ${
            mode === "month" ? "bg-white shadow-sm text-primary-700" : "text-ink-500"
          }`}
        >
          Month
        </button>
        <button
          onClick={() => setMode("custom")}
          className={`px-3 py-1.5 rounded-full transition ${
            mode === "custom" ? "bg-white shadow-sm text-primary-700" : "text-ink-500"
          }`}
        >
          Custom
        </button>
      </div>
      {mode === "month" ? (
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-transparent text-sm px-2 py-1.5 outline-none text-ink-800"
        />
      ) : (
        <>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-transparent text-sm px-2 py-1.5 outline-none text-ink-800"
          />
          <span className="text-ink-400 text-sm">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-transparent text-sm px-2 py-1.5 outline-none text-ink-800"
          />
        </>
      )}
      <button
        onClick={apply}
        disabled={pending}
        className="ml-1 rounded-full bg-primary-700 hover:bg-primary-600 text-white text-xs font-medium px-4 py-1.5 disabled:opacity-50"
      >
        {pending ? "…" : "Apply"}
      </button>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const PRESETS = [
  { id: "mom", label: "This month vs. last month" },
  { id: "yoy", label: "This month vs. same month last year" },
  { id: "custom", label: "Custom range A vs. B" },
] as const;

export function ComparePicker() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>(
    (sp.get("preset") as "mom" | "yoy" | "custom") ?? "mom",
  );
  const [aFrom, setAFrom] = useState(sp.get("aFrom") ?? "");
  const [aTo, setATo] = useState(sp.get("aTo") ?? "");
  const [bFrom, setBFrom] = useState(sp.get("bFrom") ?? "");
  const [bTo, setBTo] = useState(sp.get("bTo") ?? "");

  function apply() {
    const p = new URLSearchParams();
    p.set("preset", preset);
    if (preset === "custom") {
      p.set("aFrom", aFrom);
      p.set("aTo", aTo);
      p.set("bFrom", bFrom);
      p.set("bTo", bTo);
    }
    start(() => router.push(`/compare?${p.toString()}`));
  }

  return (
    <div className="rounded-2xl bg-white border border-ink-200/70 p-4 flex flex-wrap items-center gap-3">
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value as typeof preset)}
        className="bg-transparent text-sm px-3 py-2 border border-ink-200 rounded-full outline-none text-ink-800"
      >
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {preset === "custom" && (
        <>
          <span className="text-xs text-ink-500">A:</span>
          <input
            type="date"
            value={aFrom}
            onChange={(e) => setAFrom(e.target.value)}
            className="text-sm px-2 py-1.5 border border-ink-200 rounded-full outline-none"
          />
          <span className="text-ink-400">→</span>
          <input
            type="date"
            value={aTo}
            onChange={(e) => setATo(e.target.value)}
            className="text-sm px-2 py-1.5 border border-ink-200 rounded-full outline-none"
          />
          <span className="text-xs text-ink-500 ml-3">B:</span>
          <input
            type="date"
            value={bFrom}
            onChange={(e) => setBFrom(e.target.value)}
            className="text-sm px-2 py-1.5 border border-ink-200 rounded-full outline-none"
          />
          <span className="text-ink-400">→</span>
          <input
            type="date"
            value={bTo}
            onChange={(e) => setBTo(e.target.value)}
            className="text-sm px-2 py-1.5 border border-ink-200 rounded-full outline-none"
          />
        </>
      )}
      <button
        onClick={apply}
        disabled={pending}
        className="ml-auto rounded-full bg-primary-700 hover:bg-primary-600 text-white text-xs font-medium px-5 py-2 disabled:opacity-50"
      >
        {pending ? "…" : "Compare"}
      </button>
    </div>
  );
}

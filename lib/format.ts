export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtDelta(curr: number, prev: number): { label: string; up: boolean; zero: boolean } {
  if (prev === 0) {
    if (curr === 0) return { label: "—", up: false, zero: true };
    return { label: "new", up: true, zero: false };
  }
  const pct = (curr - prev) / prev;
  const up = pct >= 0;
  return {
    label: `${up ? "+" : ""}${(pct * 100).toFixed(1)}%`,
    up,
    zero: pct === 0,
  };
}

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TZ = "America/New_York";

export type DateRange = { start: Date; end: Date; label: string };

export function monthRange(year: number, monthIndex0: number): DateRange {
  // Start of month in ET → UTC, end = start of next month.
  const startLocal = new Date(Date.UTC(year, monthIndex0, 1));
  const endLocal = new Date(Date.UTC(year, monthIndex0 + 1, 1));
  const start = fromZonedTime(
    `${startLocal.getUTCFullYear()}-${pad(startLocal.getUTCMonth() + 1)}-01 00:00:00`,
    TZ,
  );
  const end = fromZonedTime(
    `${endLocal.getUTCFullYear()}-${pad(endLocal.getUTCMonth() + 1)}-01 00:00:00`,
    TZ,
  );
  const label = formatInTimeZone(start, TZ, "MMMM yyyy");
  return { start, end, label };
}

export function currentMonth(): DateRange {
  const now = new Date();
  const y = Number(formatInTimeZone(now, TZ, "yyyy"));
  const m = Number(formatInTimeZone(now, TZ, "M")) - 1;
  return monthRange(y, m);
}

export function previousMonth(of: DateRange): DateRange {
  const y = Number(formatInTimeZone(of.start, TZ, "yyyy"));
  const m = Number(formatInTimeZone(of.start, TZ, "M")) - 1;
  return monthRange(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1);
}

export function sameMonthLastYear(of: DateRange): DateRange {
  const y = Number(formatInTimeZone(of.start, TZ, "yyyy"));
  const m = Number(formatInTimeZone(of.start, TZ, "M")) - 1;
  return monthRange(y - 1, m);
}

export function customRange(startIso: string, endIso: string): DateRange {
  const start = fromZonedTime(`${startIso} 00:00:00`, TZ);
  const end = fromZonedTime(`${endIso} 00:00:00`, TZ);
  const label = `${formatInTimeZone(start, TZ, "MMM d, yyyy")} – ${formatInTimeZone(
    new Date(end.getTime() - 1),
    TZ,
    "MMM d, yyyy",
  )}`;
  return { start, end, label };
}

export function fmtDate(d: Date, pattern = "MMM d"): string {
  return formatInTimeZone(d, TZ, pattern);
}

export function fmtMonthInput(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM");
}

export function fmtDateInput(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export { TZ };

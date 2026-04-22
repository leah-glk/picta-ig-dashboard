function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  IG_BUSINESS_ID: required("IG_BUSINESS_ID"),
  IG_ACCESS_TOKEN: required("IG_ACCESS_TOKEN"),
  META_APP_ID: process.env.META_APP_ID ?? "",
  GRAPH_API_VERSION: process.env.GRAPH_API_VERSION ?? "v21.0",

  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",

  DASHBOARD_PASSWORD: required("DASHBOARD_PASSWORD"),
  SESSION_SECRET: required("SESSION_SECRET"),

  CRON_SECRET: process.env.CRON_SECRET ?? "",

  TIMEZONE: "America/New_York" as const,
  BACKFILL_START: "2025-01-01" as const,
};

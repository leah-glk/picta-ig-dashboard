import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Server-only client (uses service role). Never import from client components.
export function supabaseAdmin() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createClient } from "@supabase/supabase-js";

function requireEnv(
  name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY",
): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy apps/web/.env.example to apps/web/.env and add the Supabase project values.`,
    );
  }
  return value;
}

export const supabase = createClient(
  requireEnv("VITE_SUPABASE_URL"),
  requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
    },
  },
);

import { clientEnv } from "./client";
import { serverEnv } from "./server";

/**
 * Compatibility export while modules migrate to serverEnv/clientEnv.
 * Prefer importing from `@/env/server` or `@/env/client` in new code.
 */
export const env = {
  ...serverEnv,
  ...clientEnv,
  DATABASE_URL: serverEnv.POSTGRES_PRISMA_URL,
  DIRECT_URL: serverEnv.POSTGRES_URL_NON_POOLING,
  SUPABASE_URL: serverEnv.SUPABASE_URL ?? clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export { clientEnv, serverEnv };

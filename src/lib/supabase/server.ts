// Server-side Supabase client bound to the request's auth cookies.
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Fast auth check: verifies the JWT locally via getClaims (no network
 * round trip on projects with asymmetric signing keys) instead of the
 * getUser() server call. Use in server components/actions — the proxy
 * already refreshed the session cookie.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSessionUser(supabase: SupabaseClient<any, any, any>): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    },
  );
}

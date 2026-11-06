import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://zxtcshattguqoosobkji.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_ZNPpONJIf8TpYZMpVZIi6w_iFbZbYNY";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseAnonKey && supabaseAnonKey.length > 20);

// A Proxy-based fallback dummy client that handles any method invocation (e.g. from().select())
// gracefully, returning empty datasets or error indicators rather than raising runtime errors.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as any, {
      get(target, prop) {
        if (prop === "auth") {
          return {
            signUp: () => Promise.resolve({ data: { user: null }, error: null }),
            signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
            signOut: () => Promise.resolve({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
          };
        }
        
        // Return a chainable proxy method for database queries (e.g. supabase.from().select().eq().order())
        return function chain() {
          return new Proxy({}, {
            get(subTarget, subProp) {
              if (subProp === "then") {
                return (resolve: any) => resolve({ data: [], error: new Error("Supabase is unconfigured. Running in Offline Mock mode.") });
              }
              return chain;
            }
          });
        };
      }
    });

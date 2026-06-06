import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure there's *some* Supabase session before we hit protected server fns.
 * If there is none, mint an anonymous one. Safe to call multiple times — it
 * short-circuits once a session exists.
 *
 * Requires Supabase Auth → Providers → "Allow anonymous sign-ins" to be ON.
 */
let inflight: Promise<void> | null = null;

export async function ensureAnonSession(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      // Surface a developer-helpful message; the UI catches it.
      throw new Error(
        `Couldn't start a session: ${error.message}. ` +
          `If this is "Anonymous sign-ins are disabled", enable them in ` +
          `Supabase → Auth → Providers.`,
      );
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

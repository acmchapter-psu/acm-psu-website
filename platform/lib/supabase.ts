/**
 * The Supabase client, and the guard that keeps the site usable before anyone
 * has configured one.
 *
 * The anon key is a public value by design: every table in this schema has row
 * level security, so the key on its own opens nothing. Privileged keys — the
 * service role key, the Cloudflare token, Google's private key — live in Edge
 * Function secrets and never appear in a bundle.
 */
import {
  createClient,
  type SupabaseClient,
  type Session,
} from "@supabase/supabase-js";

interface RuntimeEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  siteBase?: string;
}

declare global {
  interface Window {
    ACM_ENV?: RuntimeEnv;
  }
}

const env: RuntimeEnv = window.ACM_ENV ?? {
  supabaseUrl: "",
  supabaseAnonKey: "",
  siteUrl: "",
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const siteUrl = env.siteUrl || window.location.origin;

const configuredBase =
  env.siteBase ||
  (() => {
    try {
      const pathname = new URL(siteUrl).pathname;
      return pathname.endsWith("/") ? pathname : `${pathname}/`;
    } catch {
      return "/";
    }
  })();

/*
 * GitHub Pages serves the site under /acm-psu-website/, but a local server
 * (python -m http.server, npm run serve) serves the repository from "/". Use
 * the configured base only when this page is actually being served beneath
 * it; otherwise every portal redirect would point at a folder that does not
 * exist locally.
 */
const siteBase = window.location.pathname.startsWith(configuredBase)
  ? configuredBase
  : "/";

export function sitePath(path: string): string {
  if (path.startsWith(siteBase)) return path;
  return new URL(
    path.replace(/^\/+/, ""),
    new URL(siteBase, window.location.origin),
  ).href;
}

/* --------------------------------------------------------- session lifetime */

/*
 * Supabase refresh tokens never expire on their own, so without these limits a
 * browser that signed in once stays signed in forever. A session ends when it
 * is older than SESSION_MAX_AGE_MS since the person entered their password, or
 * when nobody has used the site in that browser for SESSION_IDLE_MS.
 *
 * The server is what actually enforces this — see
 * supabase/migrations/20260922000000_session_lifetime.sql, which uses the same
 * numbers. The checks here only make the browser agree with it sooner.
 *
 * assets/js/signed-in-redirect.js and assets/js/main.js read the same storage
 * without this module and repeat the check — keep the three in step.
 */
const AUTH_STORAGE_KEY = "acm-psu-auth";
const LAST_ACTIVE_KEY = "acm-psu-auth-last-active";
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 3 * 24 * 60 * 60 * 1000;

/** When the person last authenticated, from the access token's `amr` claim. */
function signedInAt(accessToken: string): number | null {
  try {
    const payload = JSON.parse(
      atob(
        (accessToken.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/"),
      ),
    );
    const times = (payload.amr ?? [])
      .map((entry: { timestamp?: number }) => entry.timestamp)
      .filter((t: unknown): t is number => typeof t === "number");
    return times.length ? Math.max(...times) * 1000 : null;
  } catch {
    return null;
  }
}

function storedSessionExpired(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw);
    const session = stored?.currentSession ?? stored?.session ?? stored;
    if (!session?.access_token) return false;

    const now = Date.now();
    const started = signedInAt(session.access_token);
    if (started !== null && now - started > SESSION_MAX_AGE_MS) return true;

    const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY)) || started;
    return lastActive !== null && now - lastActive > SESSION_IDLE_MS;
  } catch {
    return false;
  }
}

function forgetStoredSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    /* storage unavailable: nothing to forget */
  }
}

function markActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Read once by the login page so it can say why the person is there. */
const EXPIRED_FLAG_KEY = "acm-psu-auth-expired";

export function takeSessionExpiredFlag(): boolean {
  try {
    const flagged = sessionStorage.getItem(EXPIRED_FLAG_KEY) === "1";
    sessionStorage.removeItem(EXPIRED_FLAG_KEY);
    return flagged;
  } catch {
    return false;
  }
}

function flagSessionExpired(): void {
  forgetStoredSession();
  try {
    sessionStorage.setItem(EXPIRED_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

// Runs before the client is created, so no page ever sees a stale session.
if (storedSessionExpired()) flagSessionExpired();

/**
 * The server rejects an expired session with 401 and hint `session_expired`
 * (supabase/migrations/*_session_lifetime.sql). Drop it and reload: a page
 * that needs a sign-in then sends the person to the login page, and a public
 * page simply shows them signed out.
 */
let ending = false;
function endExpiredSession(): void {
  if (ending) return;
  ending = true;
  flagSessionExpired();
  window.location.reload();
}

const sessionAwareFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) {
    try {
      const body = await response.clone().json();
      if (body?.hint === "session_expired") endExpiredSession();
    } catch {
      /* not a JSON error body */
    }
  }
  return response;
};

/**
 * Null when the platform has not been configured yet, so a page can show a
 * setup notice instead of throwing. Use requireClient() where a client is
 * genuinely mandatory.
 */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
      global: { fetch: sessionAwareFetch },
    })
  : null;

if (supabase) {
  markActive();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") markActive();
    if (event === "SIGNED_OUT") forgetStoredSession();
  });

  // A tab left open keeps refreshing its token, so check again whenever the
  // person comes back to it, and record activity while they are here.
  let lastMarked = Date.now();
  const touch = (): void => {
    if (Date.now() - lastMarked < 60_000) return;
    lastMarked = Date.now();
    markActive();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (storedSessionExpired()) {
      endExpiredSession();
      return;
    }
    touch();
  });
  for (const type of ["pointerdown", "keydown", "scroll"] as const) {
    window.addEventListener(type, touch, { passive: true });
  }
}

export function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "The ACM platform is not connected to a database yet. " +
        "See docs/SETUP.md step 1.",
    );
  }
  return supabase;
}

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Turns a PostgREST error into something a student can act on. */
export function readableError(error: unknown): string {
  if (!error) return "Something went wrong.";
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string }).message ?? String(error));

  if (/row-level security|violates row-level/i.test(message)) {
    return "You do not have permission to do that.";
  }
  if (/duplicate key|already exists/i.test(message)) {
    return "That already exists — check whether you have already submitted it.";
  }
  if (/JWT expired|invalid claim|session expired/i.test(message)) {
    return "Your session expired. Please sign in again.";
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return "Could not reach the server. Check your connection and retry.";
  }
  return message;
}

/**
 * Calls an Edge Function with the caller's session attached.
 * Returns the raw Response so callers can stream file downloads.
 */
export async function callFunction(
  name: string,
  body: unknown,
): Promise<Response> {
  const client = requireClient();
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("Sign in required.");

  return fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

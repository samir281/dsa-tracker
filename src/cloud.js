// Tiny Supabase client using plain fetch (no extra npm package).
// Auth: email + password. Data: one row per problem in the `problems` table, protected by row level security.

const BASE = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const cloudEnabled = Boolean(BASE && ANON);

const SESSION_KEY = "dsa-tracker-session";

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return s && s.access_token && s.refresh_token ? s : null;
  } catch (e) { return null; }
}
function writeSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) { /* storage blocked */ }
}

let session = cloudEnabled ? readSession() : null;
export const getSession = () => session;

class CloudError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function toSession(body) {
  if (!body || !body.access_token) return null;
  const expiresAt = body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600);
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: expiresAt,
    user: body.user ? { id: body.user.id, email: body.user.email } : (session && session.user) || null,
  };
}

async function authCall(path, payload) {
  let res;
  try {
    res = await fetch(`${BASE}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new CloudError("Cannot reach the server. Check your internet and try again.", "network");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CloudError(body.error_description || body.msg || body.message || "Sign in failed.", "auth_failed");
  }
  return body;
}

export async function signIn(email, password) {
  const body = await authCall("token?grant_type=password", { email, password });
  session = toSession(body);
  writeSession(session);
  return session;
}

// Returns a session, or null when the project requires email confirmation first.
export async function signUp(email, password) {
  const body = await authCall("signup", { email, password });
  const s = toSession(body);
  if (s) { session = s; writeSession(s); }
  return s;
}

export function signOut() {
  session = null;
  writeSession(null);
}

async function refresh() {
  if (!session) throw new CloudError("Signed out.", "auth");
  try {
    const body = await authCall("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
    session = toSession(body);
    writeSession(session);
  } catch (e) {
    if (e.code === "network") throw e;
    signOut();
    throw new CloudError("Your session expired. Sign in again.", "auth");
  }
}

async function rest(path, { method = "GET", body, prefer } = {}, retried = false) {
  if (!session) throw new CloudError("Signed out.", "auth");
  if (session.expires_at - Math.floor(Date.now() / 1000) < 60) await refresh();
  let res;
  try {
    res = await fetch(`${BASE}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new CloudError("Offline. Changes will sync when you are back online.", "network");
  }
  if (res.status === 401 && !retried) { await refresh(); return rest(path, { method, body, prefer }, true); }
  if (res.status === 401) { signOut(); throw new CloudError("Your session expired. Sign in again.", "auth"); }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CloudError(`Server error ${res.status}. ${text.slice(0, 160)}`, "server");
  }
  return res.status === 204 || method !== "GET" ? null : res.json();
}

export const fetchAll = () => rest("problems?select=id,data&order=id.asc&limit=1000");

export const upsertMany = (list) =>
  rest("problems?on_conflict=user_id,id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: list.map((p) => ({ user_id: session.user.id, id: p.id, data: p, updated_at: new Date().toISOString() })),
  });

export const deleteMany = (ids) =>
  rest(`problems?id=in.(${ids.map((i) => `"${String(i).replace(/"/g, "")}"`).join(",")})`, { method: "DELETE", prefer: "return=minimal" });

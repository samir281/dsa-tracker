// Tiny Supabase client using plain fetch (no extra npm package).
// Auth: email + password. Data: one row per problem in `problems` (private per user, via row level security).
// The public leaderboard comes from the `leaderboard` SQL function, which returns only names and counts.

const BASE = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const cloudEnabled = Boolean(BASE && ANON);

const SESSION_KEY = "dsa-tracker-session";

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return s && s.access_token && s.refresh_token && s.user && s.user.id ? s : null;
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

export class CloudError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function userFrom(u, previous) {
  if (!u) return previous || null;
  const meta = u.user_metadata || {};
  return { id: u.id, email: u.email, name: meta.display_name || (previous && previous.name) || "" };
}

function toSession(body) {
  if (!body || !body.access_token) return null;
  const expiresAt = body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600);
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: expiresAt,
    user: userFrom(body.user, session && session.user),
  };
}

async function authCall(path, payload, { method = "POST", token } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/auth/v1/${path}`, {
      method,
      headers: { apikey: ANON, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new CloudError("Cannot reach the server. Check your internet and try again.", "network");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CloudError(body.error_description || body.msg || body.message || "Request failed.", "auth_failed");
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
export async function signUp(email, password, displayName) {
  const body = await authCall("signup", { email, password, data: { display_name: displayName } });
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

async function ensureFresh() {
  if (!session) throw new CloudError("Signed out.", "auth");
  if (session.expires_at - Math.floor(Date.now() / 1000) < 60) await refresh();
}

async function rest(path, { method = "GET", body, prefer } = {}, retried = false) {
  await ensureFresh();
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

export async function updateDisplayName(name) {
  await ensureFresh();
  const body = await authCall("user", { data: { display_name: name } }, { method: "PUT", token: session.access_token });
  session = { ...session, user: { ...session.user, name: (body.user_metadata && body.user_metadata.display_name) || name } };
  writeSession(session);
  return session;
}

// Public: works without signing in. Returns [{display_name, easy, medium, hard, total, points}].
export async function getLeaderboard(days) {
  let res;
  try {
    res = await fetch(`${BASE}/rest/v1/rpc/leaderboard`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
  } catch (e) {
    throw new CloudError("Cannot reach the server.", "network");
  }
  if (!res.ok) {
    throw new CloudError(
      res.status === 404 ? "Leaderboard is not set up yet. Run supabase.sql in Supabase." : `Leaderboard error ${res.status}.`,
      "server"
    );
  }
  return res.json();
}

import { useEffect, useState } from "react";
import { cloudEnabled, getProfile, getSession, signOut } from "./cloud.js";
import Home from "./Home.jsx";
import AuthForm from "./AuthForm.jsx";
import Tracker from "./Tracker.jsx";
import ProfileGate from "./ProfileGate.jsx";

const ROUTES = ["home", "login", "signup", "tracker"];
const readRoute = () => {
  const r = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.includes(r) ? r : "home";
};

export default function App() {
  const [session, setSession] = useState(() => (cloudEnabled ? getSession() : null));
  const [route, setRoute] = useState(readRoute);
  // profile: undefined = still loading, null = this account has no short ID yet, object = { short_id }
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const uid = session && session.user.id;
  useEffect(() => {
    if (!uid) { setProfile(undefined); return undefined; }
    let alive = true;
    getProfile()
      .then((p) => { if (alive) setProfile(p); })
      .catch((e) => {
        if (!alive) return;
        if (e && e.code === "auth") { signOut(); setSession(null); }
        else setProfile((prev) => (prev === undefined ? { short_id: "" } : prev)); // offline: do not block the app
      });
    return () => { alive = false; };
  }, [uid]);

  const go = (r) => { window.location.hash = r === "home" ? "/" : "/" + r; setRoute(r); window.scrollTo(0, 0); };
  const refreshSession = () => setSession(getSession() ? { ...getSession() } : null);
  const logout = () => { signOut(); setSession(null); go("home"); };

  // Guard routes: tracker needs a login, login and signup are pointless once logged in.
  let view = route;
  if (view === "tracker" && !session) view = "login";
  if ((view === "login" || view === "signup") && session) view = "tracker";
  if (!cloudEnabled && view !== "home") view = "home";

  const needsProfile = Boolean(session) && (!session.user.name || profile === null);

  return (
    <>
      <header className="nav">
        <button className="brand" onClick={() => go("home")}>DSA Tracker</button>
        <nav className="nav-actions" aria-label="Main">
          {session ? (
            <>
              <button className="btn small" aria-current={view === "home"} onClick={() => go("home")}>Leaderboard</button>
              <button className="btn small" aria-current={view === "tracker"} onClick={() => go("tracker")}>My tracker</button>
              <button className="btn small" onClick={logout}>Logout</button>
            </>
          ) : cloudEnabled ? (
            <>
              <button className="btn small" aria-current={view === "login"} onClick={() => go("login")}>Login</button>
              <button className="btn small primary" aria-current={view === "signup"} onClick={() => go("signup")}>Sign up</button>
            </>
          ) : null}
        </nav>
      </header>

      {needsProfile && (
        <ProfileGate
          needName={!session.user.name}
          needShortId={profile === null}
          onSaved={() => { refreshSession(); getProfile().then(setProfile).catch(() => {}); }}
          onSignOut={logout}
        />
      )}
      {!needsProfile && view === "home" && <Home loggedIn={Boolean(session)} go={go} />}
      {(view === "login" || view === "signup") && (
        <AuthForm mode={view} go={go} onDone={() => { refreshSession(); go("tracker"); }} />
      )}
      {view === "tracker" && session && !needsProfile && (
        <Tracker key={session.user.id} session={session} profile={profile} onSignOut={logout}
          onSessionChange={refreshSession} onProfileChange={(n) => setProfile((p) => ({ ...(p || {}), ...n }))} />
      )}
    </>
  );
}

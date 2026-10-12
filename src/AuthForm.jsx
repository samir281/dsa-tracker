import { useState } from "react";
import {
  SHORT_ID_RE, createProfile, normalizeShortId, shortIdAvailable, signIn, signInWithShortId, signUp,
} from "./cloud.js";

export default function AuthForm({ mode, go, onDone }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [shortId, setShortId] = useState("");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState(""); // short ID or email, login form only
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Enter your password (at least 6 characters).");
    setBusy(true);
    try {
      if (isSignup) {
        const sid = normalizeShortId(shortId);
        if (!name.trim()) throw new Error("Enter the name you want on the leaderboard.");
        if (!SHORT_ID_RE.test(sid)) throw new Error("Short ID must be 3 to 20 characters: letters, numbers, dot, dash or underscore.");
        if (!email.trim()) throw new Error("Enter your email.");
        if (!(await shortIdAvailable(sid))) throw new Error("That short ID is already taken. Try another one.");
        const s = await signUp(email.trim(), password, name.trim().slice(0, 24));
        if (!s) throw new Error("Account created. Open the confirmation email, then come back and log in.");
        try { await createProfile(sid); } catch (err) { /* the app asks for the short ID again after login */ }
        onDone();
      } else {
        const id = login.trim();
        if (!id) throw new Error("Enter your short ID or email.");
        const s = id.includes("@") ? await signIn(id, password) : await signInWithShortId(id, password);
        if (s) onDone();
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="panel auth">
      <h1>{isSignup ? "Create your account" : "Login"}</h1>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        {isSignup
          ? "Your problems and solutions stay private. Only your name and counts show on the leaderboard."
          : "Use your short ID or your email."}
      </p>
      <form onSubmit={submit}>
        <div className="form-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          {isSignup ? (
            <>
              <div className="field">
                <label htmlFor="a-name">Name on leaderboard</label>
                <input id="a-name" value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} placeholder="Samir" />
              </div>
              <div className="field">
                <label htmlFor="a-sid">Short ID</label>
                <input id="a-sid" value={shortId} maxLength={20} autoComplete="username" autoCapitalize="none" spellCheck="false"
                  onChange={(e) => setShortId(e.target.value)} placeholder="samir" />
                <span className="hint">3 to 20 characters. You can log in with this instead of your email.</span>
              </div>
              <div className="field">
                <label htmlFor="a-email">Email</label>
                <input id="a-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="a-login">Short ID or email</label>
              <input id="a-login" value={login} autoComplete="username" autoCapitalize="none" spellCheck="false" onChange={(e) => setLogin(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="a-pass">Password</label>
            <input id="a-pass" type="password" autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            {isSignup && <span className="hint">At least 6 characters.</span>}
          </div>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>{isSignup ? "Sign up" : "Login"}</button>
          <button type="button" className="btn" onClick={() => go(isSignup ? "login" : "signup")}>
            {isSignup ? "I already have an account" : "Create an account"}
          </button>
        </div>
      </form>
    </div>
  );
}

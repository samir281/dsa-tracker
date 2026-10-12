import { useState } from "react";
import { signIn, signUp } from "./cloud.js";

export default function AuthForm({ mode, go, onDone }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (isSignup && !name.trim()) return setError("Enter the name you want on the leaderboard.");
    if (!email.trim() || password.length < 6) return setError("Enter your email and a password of at least 6 characters.");
    setBusy(true); setError("");
    try {
      const s = isSignup ? await signUp(email.trim(), password, name.trim().slice(0, 24)) : await signIn(email.trim(), password);
      if (s) onDone();
      else setError("Account created. Open the confirmation email, then come back and log in.");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="panel auth">
      <h1>{isSignup ? "Create your account" : "Login"}</h1>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        {isSignup ? "Your problems and solutions stay private. Only your name and counts show on the leaderboard." : "Welcome back."}
      </p>
      <form onSubmit={submit}>
        <div className="form-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          {isSignup && (
            <div className="field">
              <label htmlFor="a-name">Name on leaderboard</label>
              <input id="a-name" value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} placeholder="Samir" />
            </div>
          )}
          <div className="field">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
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

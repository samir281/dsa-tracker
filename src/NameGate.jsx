import { useState } from "react";
import { updateDisplayName } from "./cloud.js";

// Shown right after login when the account has no leaderboard name yet.
export default function NameGate({ onSaved, onSignOut }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 24);
    if (!clean) return setError("Enter a name to continue.");
    setBusy(true); setError("");
    try {
      await updateDisplayName(clean);
      onSaved();
    } catch (err) {
      if (err && err.code === "auth") onSignOut();
      else setError(err.message || "Could not save the name. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="panel auth">
      <h1>Choose your name</h1>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        This is the name everyone sees on the leaderboard. You can change it later from My tracker.
      </p>
      <form onSubmit={save}>
        <div className="form-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div className="field">
            <label htmlFor="g-name">Name on leaderboard</label>
            <input id="g-name" value={name} maxLength={24} autoFocus autoComplete="nickname"
              onChange={(e) => setName(e.target.value)} placeholder="Samir" />
          </div>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>Save and continue</button>
        </div>
      </form>
    </div>
  );
}

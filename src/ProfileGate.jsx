import { useState } from "react";
import { SHORT_ID_RE, createProfile, normalizeShortId, shortIdAvailable, updateDisplayName } from "./cloud.js";

// Shown after login when the account is missing a leaderboard name and/or a short ID
// (accounts made before short IDs existed, or a sign up that stopped half way).
export default function ProfileGate({ needName, needShortId, onSaved, onSignOut }) {
  const [name, setName] = useState("");
  const [shortId, setShortId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setError("");
    const cleanName = name.trim().slice(0, 24);
    const sid = normalizeShortId(shortId);
    if (needName && !cleanName) return setError("Enter a name to continue.");
    if (needShortId && !SHORT_ID_RE.test(sid)) return setError("Short ID must be 3 to 20 characters: letters, numbers, dot, dash or underscore.");
    setBusy(true);
    try {
      if (needShortId && !(await shortIdAvailable(sid))) throw new Error("That short ID is already taken. Try another one.");
      if (needName) await updateDisplayName(cleanName);
      if (needShortId) await createProfile(sid);
      onSaved();
    } catch (err) {
      if (err && err.code === "auth") onSignOut();
      else setError(err.message || "Could not save. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="panel auth">
      <h1>Finish your profile</h1>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        {needName && needShortId
          ? "Pick the name shown on the leaderboard and a short ID you can log in with."
          : needName
            ? "Pick the name shown on the leaderboard. You can change it later from My tracker."
            : "Pick a short ID. Next time you can log in with it instead of your email."}
      </p>
      <form onSubmit={save}>
        <div className="form-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          {needName && (
            <div className="field">
              <label htmlFor="g-name">Name on leaderboard</label>
              <input id="g-name" value={name} maxLength={24} autoFocus autoComplete="nickname" onChange={(e) => setName(e.target.value)} placeholder="Samir" />
            </div>
          )}
          {needShortId && (
            <div className="field">
              <label htmlFor="g-sid">Short ID</label>
              <input id="g-sid" value={shortId} maxLength={20} autoComplete="username" autoCapitalize="none" spellCheck="false"
                onChange={(e) => setShortId(e.target.value)} placeholder="samir" />
              <span className="hint">3 to 20 characters: letters, numbers, dot, dash or underscore.</span>
            </div>
          )}
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>Save and continue</button>
        </div>
      </form>
    </div>
  );
}

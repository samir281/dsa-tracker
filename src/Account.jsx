import { useState } from "react";
import {
  SHORT_ID_RE, changeShortId, normalizeShortId, shortIdAvailable, updateEmail, updatePassword,
} from "./cloud.js";

// Account panel: change short ID, email and password.
export default function Account({ session, profile, onSessionChange, onProfileChange, onSignOut }) {
  const [form, setForm] = useState(null); // { kind: "sid" | "email" | "pw", a, b, busy, error }
  const [note, setNote] = useState("");

  const open = (kind) => { setNote(""); setForm({ kind, a: "", b: "", busy: false, error: "" }); };
  const close = () => setForm(null);
  const fail = (err) => {
    if (err && err.code === "auth") return onSignOut();
    setForm((f) => ({ ...f, busy: false, error: err.message || "Could not save. Try again." }));
  };

  const save = async (e) => {
    e.preventDefault();
    const { kind, a, b } = form;
    try {
      if (kind === "sid") {
        const sid = normalizeShortId(a);
        if (!SHORT_ID_RE.test(sid)) return setForm({ ...form, error: "Short ID must be 3 to 20 characters: letters, numbers, dot, dash or underscore." });
        if (sid === (profile && profile.short_id)) return setForm({ ...form, error: "That is already your short ID." });
        setForm({ ...form, busy: true, error: "" });
        if (!(await shortIdAvailable(sid))) throw new Error("That short ID is already taken. Try another one.");
        await changeShortId(sid);
        onProfileChange({ short_id: sid });
        setNote(`Short ID changed to ${sid}.`);
      } else if (kind === "email") {
        const next = a.trim();
        if (!next.includes("@")) return setForm({ ...form, error: "Enter a valid email." });
        if (next.toLowerCase() === (session.user.email || "").toLowerCase()) return setForm({ ...form, error: "That is already your email." });
        setForm({ ...form, busy: true, error: "" });
        const { changed } = await updateEmail(next);
        if (changed) { onSessionChange(); setNote(`Email changed to ${next}.`); }
        else setNote(`Almost done. Supabase sent a confirmation link to ${next} (and maybe your old email). Open it to finish. Until then your old email still works.`);
      } else {
        if (a.length < 6) return setForm({ ...form, error: "Use at least 6 characters." });
        if (a !== b) return setForm({ ...form, error: "The two passwords do not match." });
        setForm({ ...form, busy: true, error: "" });
        await updatePassword(a);
        setNote("Password changed.");
      }
      close();
    } catch (err) { fail(err); }
  };

  const shortId = profile && profile.short_id;

  return (
    <div className="panel account">
      <h2>Account</h2>
      <dl className="acct">
        <div className="acct-row">
          <dt>Short ID</dt>
          <dd>{shortId ? <b className="mono">{shortId}</b> : <span className="hint">{profile === undefined ? "loading..." : "not set"}</span>}</dd>
          <button className="btn small" onClick={() => open("sid")}>{shortId ? "Change" : "Set"}</button>
        </div>
        <div className="acct-row">
          <dt>Email</dt>
          <dd><b className="mono">{session.user.email}</b></dd>
          <button className="btn small" onClick={() => open("email")}>Change</button>
        </div>
        <div className="acct-row">
          <dt>Password</dt>
          <dd><span className="hint">hidden</span></dd>
          <button className="btn small" onClick={() => open("pw")}>Change</button>
        </div>
      </dl>
      {note && <p className="note" role="status">{note}</p>}

      {form && (
        <form onSubmit={save} className="acct-form">
          <div className="form-grid">
            {form.kind === "sid" && (
              <div className="field wide">
                <label htmlFor="ac-a">New short ID</label>
                <input id="ac-a" value={form.a} maxLength={20} autoCapitalize="none" spellCheck="false" autoFocus
                  onChange={(e) => setForm({ ...form, a: e.target.value })} />
              </div>
            )}
            {form.kind === "email" && (
              <div className="field wide">
                <label htmlFor="ac-a">New email</label>
                <input id="ac-a" type="email" autoComplete="email" autoFocus value={form.a}
                  onChange={(e) => setForm({ ...form, a: e.target.value })} />
              </div>
            )}
            {form.kind === "pw" && (
              <>
                <div className="field">
                  <label htmlFor="ac-a">New password</label>
                  <input id="ac-a" type="password" autoComplete="new-password" autoFocus value={form.a}
                    onChange={(e) => setForm({ ...form, a: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="ac-b">Type it again</label>
                  <input id="ac-b" type="password" autoComplete="new-password" value={form.b}
                    onChange={(e) => setForm({ ...form, b: e.target.value })} />
                </div>
              </>
            )}
          </div>
          {form.error && <div className="err" role="alert">{form.error}</div>}
          <div className="actions">
            <button type="submit" className="btn primary" disabled={form.busy}>Save</button>
            <button type="button" className="btn" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

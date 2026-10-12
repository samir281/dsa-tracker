import { useState } from "react";
import { saveLinks } from "./cloud.js";

const SITES = {
  github: { label: "GitHub", host: "github.com", placeholder: "https://github.com/your-username", re: /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9._/-]+$/i },
  linkedin: { label: "LinkedIn", host: "linkedin.com", placeholder: "https://www.linkedin.com/in/your-name", re: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[A-Za-z0-9._%/-]+$/i },
};

// "github.com/samir" and "https://github.com/samir/" both become a clean https link. Empty means remove.
const clean = (raw, key) => {
  let v = (raw || "").trim();
  if (!v) return { value: null };
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  v = v.replace(/^http:\/\//i, "https://").replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (v.length > 200 || !SITES[key].re.test(v)) return { error: `Enter a ${SITES[key].label} link like ${SITES[key].placeholder}` };
  return { value: v };
};

// Public links shown next to the user's name on the leaderboard, each with its own on/off switch.
export default function Links({ profile, onProfileChange, onSignOut }) {
  const p = profile || {};
  const [v, setV] = useState({
    github: p.github_url || "", linkedin: p.linkedin_url || "",
    showGithub: Boolean(p.show_github), showLinkedin: Boolean(p.show_linkedin),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  if (profile === undefined) return <div className="panel"><h2>Links</h2><p className="hint">Loading...</p></div>;
  if (profile === null) return null;

  const save = async (e) => {
    e.preventDefault();
    setError(""); setNote("");
    const g = clean(v.github, "github");
    const l = clean(v.linkedin, "linkedin");
    if (g.error) return setError(g.error);
    if (l.error) return setError(l.error);
    const fields = {
      github_url: g.value, linkedin_url: l.value,
      show_github: Boolean(g.value) && v.showGithub, show_linkedin: Boolean(l.value) && v.showLinkedin,
    };
    setBusy(true);
    try {
      await saveLinks(fields);
      onProfileChange(fields);
      setV({ github: g.value || "", linkedin: l.value || "", showGithub: fields.show_github, showLinkedin: fields.show_linkedin });
      setNote("Saved.");
    } catch (err) {
      if (err && err.code === "auth") return onSignOut();
      setError(err.message || "Could not save. Run the latest supabase.sql in Supabase and try again.");
    }
    setBusy(false);
  };

  const field = (key, showKey) => (
    <div className="link-row">
      <div className="field">
        <label htmlFor={`l-${key}`}>{SITES[key].label} link</label>
        <input id={`l-${key}`} value={v[key]} autoCapitalize="none" spellCheck="false" inputMode="url" placeholder={SITES[key].placeholder}
          onChange={(e) => setV({ ...v, [key]: e.target.value })} />
      </div>
      <label className="check">
        <input type="checkbox" checked={v[showKey]} disabled={!v[key].trim()}
          onChange={(e) => setV({ ...v, [showKey]: e.target.checked })} />
        Show on the public leaderboard
      </label>
    </div>
  );

  return (
    <div className="panel">
      <h2>Links</h2>
      <p className="hint" style={{ margin: "4px 0 14px" }}>
        Optional. A link is visible to other people only when its switch is on. Switch it off any time and it disappears from the leaderboard.
      </p>
      <form onSubmit={save}>
        {field("github", "showGithub")}
        {field("linkedin", "showLinkedin")}
        {error && <div className="err" role="alert">{error}</div>}
        {note && <p className="note" role="status">{note}</p>}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy}>Save links</button>
        </div>
      </form>
    </div>
  );
}

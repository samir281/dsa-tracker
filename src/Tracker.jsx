import { useEffect, useMemo, useRef, useState } from "react";
import {
  REDO_GAP_DAYS, KNOWN, addDays, canonicalPattern, diffDays, fmt, fmtFull, newId, patKey, todayISO,
} from "./lib.js";
import { deleteMany, fetchAll, updateDisplayName, updatePassword, upsertMany } from "./cloud.js";

const MAX_FILE_BYTES = 300 * 1024;

// Local copy of the signed-in user's own problems (fast first paint, works through a short offline gap).
const cacheKey = (uid) => `dsa-tracker-v2:${uid}`;
function loadCache(uid) {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(uid)) || "null");
    if (Array.isArray(parsed)) return parsed;
  } catch (e) { /* ignore */ }
  return [];
}

const emptyForm = () => ({
  name: "", pattern: "", difficulty: "Medium", link: "", solvedOn: todayISO(), notes: "", solution: "",
});

export default function Tracker({ session, onSignOut, onSessionChange }) {
  const uid = session.user.id;
  const [problems, setProblems] = useState(() => loadCache(uid));
  const [tab, setTab] = useState("redo");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [open, setOpen] = useState({});
  const [filter, setFilter] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [today, setToday] = useState(todayISO());
  const [toast, setToast] = useState("");
  const [fileNames, setFileNames] = useState({ notes: "", solution: "" });
  const [nameEdit, setNameEdit] = useState(null);
  const [pw, setPw] = useState(null); // null = closed, otherwise { next, again, busy, error }
  const formRef = useRef(null);
  const importRef = useRef(null);

  /* ---- cloud sync ---- */
  const [cloudReady, setCloudReady] = useState(false);
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | saved | offline | error
  const [syncTick, setSyncTick] = useState(0);
  const synced = useRef(new Map()); // id -> updatedAt as last known in the cloud
  const pushing = useRef(false);
  const problemsRef = useRef(problems);
  problemsRef.current = problems;

  const stamp = (p) => p.updatedAt || 1;
  const pendingChanges = (list) => ({
    up: list.filter((p) => synced.current.get(p.id) !== stamp(p)),
    del: [...synced.current.keys()].filter((id) => !list.some((p) => p.id === id)),
  });

  const onCloudError = (e) => {
    if (e && e.code === "auth") { onSignOut(); return; }
    setSyncState(e && e.code === "network" ? "offline" : "error");
  };

  const pull = async (initial) => {
    if (pushing.current) return;
    const { up, del } = pendingChanges(problemsRef.current);
    if (!initial && (up.length || del.length)) return; // local edits not uploaded yet, keep them
    setSyncState("syncing");
    try {
      const rows = await fetchAll();
      if (rows.length === 0 && initial) {
        synced.current = new Map(); // nothing in the cloud yet: upload what is on this device
      } else {
        const list = rows.map((r) => ({ ...r.data, id: r.id }));
        synced.current = new Map(list.map((p) => [p.id, stamp(p)]));
        setProblems(list);
      }
      setCloudReady(true);
      setSyncState("saved");
    } catch (e) { onCloudError(e); }
  };

  useEffect(() => { pull(true); /* eslint-disable-next-line */ }, [uid]);

  useEffect(() => {
    if (!cloudReady) return undefined;
    const { up, del } = pendingChanges(problems);
    if (!up.length && !del.length) return undefined;
    setSyncState("syncing");
    const t = setTimeout(async () => {
      if (pushing.current) return;
      pushing.current = true;
      const snap = pendingChanges(problemsRef.current);
      let ok = false;
      try {
        if (snap.up.length) await upsertMany(snap.up);
        if (snap.del.length) await deleteMany(snap.del);
        snap.up.forEach((p) => synced.current.set(p.id, stamp(p)));
        snap.del.forEach((id) => synced.current.delete(id));
        ok = true;
        setSyncState("saved");
      } catch (e) { onCloudError(e); }
      pushing.current = false;
      setTimeout(() => setSyncTick((x) => x + 1), ok ? 0 : 10000);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [problems, cloudReady, syncTick]);

  useEffect(() => {
    if (!cloudReady) return undefined;
    const onVisible = () => { if (document.visibilityState === "visible") pull(false); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
    // eslint-disable-next-line
  }, [cloudReady]);

  useEffect(() => {
    try { localStorage.setItem(cacheKey(uid), JSON.stringify(problems)); } catch (e) { /* storage blocked: cloud still has it */ }
  }, [problems, uid]);

  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const patch = (id, fields) =>
    setProblems((list) => list.map((p) => (p.id === id ? { ...p, ...fields, updatedAt: Date.now() } : p)));

  const redo = useMemo(
    () => problems.filter((p) => p.redo).sort((a, b) => (a.redoOn || "").localeCompare(b.redoOn || "")),
    [problems]
  );
  const done = useMemo(
    () => problems.filter((p) => !p.redo).sort((a, b) => (b.solvedOn || "").localeCompare(a.solvedOn || "")),
    [problems]
  );
  const redoDueList = redo.filter((p) => p.redoOn && p.redoOn <= today);
  const redoLater = redo.filter((p) => !(p.redoOn && p.redoOn <= today));

  const groups = useMemo(() => {
    const map = new Map();
    problems.forEach((p) => {
      const k = patKey(p.pattern) || "other";
      if (!map.has(k)) map.set(k, { key: k, label: canonicalPattern(p.pattern) || "Other", items: [] });
      map.get(k).items.push(p);
    });
    const arr = [...map.values()];
    arr.forEach((g) => g.items.sort((a, b) => (b.solvedOn || "").localeCompare(a.solvedOn || "")));
    return arr.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  }, [problems]);
  const visibleGroups = filter ? groups.filter((g) => g.key === filter) : groups;

  const patternOptions = useMemo(() => {
    const set = new Set(KNOWN);
    problems.forEach((p) => p.pattern && set.add(canonicalPattern(p.pattern)));
    return [...set];
  }, [problems]);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);

  const cancelForm = () => {
    setForm(emptyForm()); setEditingId(null); setShowForm(false); setFormError(""); setFileNames({ notes: "", solution: "" });
  };

  const submit = (asRedo) => {
    if (!form.name.trim()) return setFormError("Add the problem name.");
    if (!form.pattern.trim()) return setFormError("Add the pattern, for example Two Pointers or Hash Map.");
    const fields = {
      name: form.name.trim(),
      pattern: canonicalPattern(form.pattern),
      difficulty: form.difficulty,
      link: form.link.trim(),
      solvedOn: form.solvedOn || todayISO(),
      notes: form.notes,
      solution: form.solution,
    };
    if (editingId) {
      patch(editingId, asRedo ? { ...fields, redo: true, redoOn: addDays(todayISO(), REDO_GAP_DAYS) } : fields);
    } else {
      setProblems((list) => [
        ...list,
        {
          id: newId(), ...fields,
          redo: asRedo, redoOn: asRedo ? addDays(fields.solvedOn, REDO_GAP_DAYS) : null,
          redoCount: 0, lastRedoneOn: null, createdAt: Date.now(), updatedAt: Date.now(),
        },
      ]);
    }
    setToast(asRedo ? `Saved. Redo on ${fmtFull(addDays(editingId ? todayISO() : fields.solvedOn, REDO_GAP_DAYS))}` : "Saved");
    setTab(asRedo ? "redo" : "done");
    cancelForm();
  };

  const startEdit = (p) => {
    setForm({
      name: p.name || "", pattern: p.pattern || "", difficulty: p.difficulty || "Medium", link: p.link || "",
      solvedOn: p.solvedOn || todayISO(), notes: p.notes || "", solution: p.solution || "",
    });
    setEditingId(p.id); setShowForm(true); setFormError(""); setFileNames({ notes: "", solution: "" });
    scrollToForm();
  };

  const sendToRedo = (p) => patch(p.id, { redo: true, redoOn: addDays(todayISO(), REDO_GAP_DAYS) });
  const redoAgain = (p) =>
    patch(p.id, { redo: true, redoOn: addDays(todayISO(), REDO_GAP_DAYS), redoCount: (p.redoCount || 0) + 1, lastRedoneOn: todayISO() });
  const redoDone = (p) =>
    patch(p.id, { redo: false, redoOn: null, redoCount: (p.redoCount || 0) + 1, lastRedoneOn: todayISO() });
  const remove = (p) => { setProblems((list) => list.filter((x) => x.id !== p.id)); setConfirmDel(null); };

  /* ---- text file upload: fills the Core logic or Solution box ---- */
  const readTextFile = async (field, file) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setFormError("That file is over 300 KB. Upload a plain text file under 300 KB."); return; }
    try {
      const text = await file.text();
      if (text.includes("\u0000")) { setFormError("That looks like a binary file. Upload a .txt, .md or .java file."); return; }
      setForm((f) => ({ ...f, [field]: f[field].trim() ? f[field].replace(/\s+$/, "") + "\n\n" + text : text }));
      setFileNames((n) => ({ ...n, [field]: file.name }));
      setFormError("");
      setToast(`Loaded ${file.name}`);
    } catch (e) {
      setFormError("Could not read that file. Try again.");
    }
  };

  /* ---- backup ---- */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(problems, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dsa-tracker-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Backup downloaded");
  };
  const importJson = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error("not a list");
      const clean = data.filter((p) => p && typeof p.name === "string" && typeof p.pattern === "string")
        .map((p) => ({ ...p, id: p.id || newId(), updatedAt: Date.now() }));
      setProblems((list) => {
        const byId = new Map(list.map((p) => [p.id, p]));
        clean.forEach((p) => byId.set(p.id, p));
        return [...byId.values()];
      });
      setToast(`Imported ${clean.length} problem${clean.length === 1 ? "" : "s"}`);
    } catch (e) {
      setToast("That file is not a DSA Tracker backup");
    }
    if (importRef.current) importRef.current.value = "";
  };

  const saveName = async () => {
    const name = (nameEdit || "").trim().slice(0, 24);
    if (!name) { setToast("Enter a name"); return; }
    try {
      await updateDisplayName(name);
      onSessionChange();
      setNameEdit(null);
      setToast("Leaderboard name updated");
    } catch (e) {
      if (e && e.code === "auth") onSignOut(); else setToast(e.message || "Could not update the name");
    }
  };

  const savePassword = async () => {
    if (pw.next.length < 6) return setPw({ ...pw, error: "Use at least 6 characters." });
    if (pw.next !== pw.again) return setPw({ ...pw, error: "The two passwords do not match." });
    setPw({ ...pw, busy: true, error: "" });
    try {
      await updatePassword(pw.next);
      setPw(null);
      setToast("Password changed");
    } catch (e) {
      if (e && e.code === "auth") onSignOut();
      else setPw({ ...pw, busy: false, error: e.message || "Could not change the password." });
    }
  };

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const renderCard = (p, mode) => {
    const isOpen = !!open[p.id];
    let cls = "card", when = null;
    if (p.redo && p.redoOn) {
      const d = diffDays(p.redoOn, today);
      if (d < 0) { cls += " overdue"; when = <span className="when overdue">Overdue by {-d} day{-d === 1 ? "" : "s"} (was {fmt(p.redoOn)})</span>; }
      else if (d === 0) { cls += " overdue"; when = <span className="when overdue">Redo today</span>; }
      else if (d === 1) { cls += " soon"; when = <span className="when soon">Redo tomorrow ({fmtFull(p.redoOn)})</span>; }
      else when = <span className="when">Redo on {fmtFull(p.redoOn)} (in {d} days)</span>;
    }
    return (
      <div className={cls} key={p.id}>
        <div className="card-head">
          <div className="card-title">
            <strong>{p.name}</strong>
            <span className={"chip " + (p.difficulty || "").toLowerCase()}>{p.difficulty}</span>
            <span className="chip">{canonicalPattern(p.pattern)}</span>
            {mode === "pattern" && (
              <span className={"chip " + (p.redo ? "redo" : "done")}>{p.redo ? "Redo " + fmt(p.redoOn) : "Done"}</span>
            )}
          </div>
          {when}
        </div>
        <div className="meta">
          <span>Solved {fmt(p.solvedOn)}</span>
          {p.redoCount > 0 && <span>Redone {p.redoCount}×{p.lastRedoneOn ? ", last " + fmt(p.lastRedoneOn) : ""}</span>}
          {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Open problem</a>}
        </div>
        <div className="card-actions">
          {p.redo ? (
            <>
              <button className="btn small primary" onClick={() => redoDone(p)}>Redone, move to done</button>
              <button className="btn small" onClick={() => redoAgain(p)}>Redo again in {REDO_GAP_DAYS} days</button>
            </>
          ) : (
            <button className="btn small primary" onClick={() => sendToRedo(p)}>Send to redo ({REDO_GAP_DAYS} days)</button>
          )}
          <button className="btn small" onClick={() => toggle(p.id)} aria-expanded={isOpen}>{isOpen ? "Hide solution" : "Show solution"}</button>
          <button className="btn small" onClick={() => startEdit(p)}>Edit</button>
          {confirmDel === p.id ? (
            <>
              <button className="btn small warn" onClick={() => remove(p)}>Yes, delete</button>
              <button className="btn small" onClick={() => setConfirmDel(null)}>Keep</button>
            </>
          ) : (
            <button className="btn small warn" onClick={() => setConfirmDel(p.id)}>Delete</button>
          )}
        </div>
        {isOpen && (
          <div className="detail">
            <div>
              <h3>Core logic</h3>
              {p.notes ? <p className="notes">{p.notes}</p> : <p className="hint">No notes yet. Use Edit to add or upload the core logic.</p>}
            </div>
            <div>
              <h3>My solution</h3>
              {p.solution ? <CodeBlock code={p.solution} onCopied={() => setToast("Code copied")} /> : <p className="hint">No solution saved yet. Use Edit to paste or upload it.</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const syncLabel = { idle: "", syncing: "Syncing...", saved: "Saved to cloud", offline: "Offline, will retry", error: "Sync problem, will retry" }[syncState];

  return (
    <>
      <div className="syncbar">
        <span className={"sync-dot " + syncState} aria-hidden="true" />
        <span role="status">{syncLabel}</span>
        <span className="spacer" />
        {nameEdit === null ? (
          <>
            <span className="hint">Leaderboard name: <b>{session.user.name || "not set"}</b></span>
            <button className="btn small" onClick={() => setNameEdit(session.user.name || "")}>Change</button>
          </>
        ) : (
          <>
            <label className="visually-hidden" htmlFor="name-edit">Leaderboard name</label>
            <input id="name-edit" className="name-input" value={nameEdit} maxLength={24} placeholder="Your name"
              onChange={(e) => setNameEdit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} />
            <button className="btn small primary" onClick={saveName}>Save</button>
            <button className="btn small" onClick={() => setNameEdit(null)}>Cancel</button>
          </>
        )}
        <button className="btn small" onClick={() => pull(false)}>Sync now</button>
      </div>

      <div className="top">
        <div>
          <h1>My tracker</h1>
          <p>Only you can see these problems and solutions. The leaderboard shows only your name and counts.</p>
        </div>
        <button className="btn primary" onClick={() => { if (showForm) cancelForm(); else { setShowForm(true); scrollToForm(); } }}>
          {showForm ? "Close form" : "+ Log a problem"}
        </button>
      </div>

      <div className="stats">
        <div className={"stat" + (redoDueList.length ? " alert" : "")}><b>{redoDueList.length}</b><span>Redo due now</span></div>
        <div className="stat"><b>{redo.length}</b><span>In redo list</span></div>
        <div className="stat"><b>{done.length}</b><span>Done</span></div>
        <div className="stat"><b>{problems.length}</b><span>Total problems</span></div>
      </div>

      {showForm && (
        <div className="panel" ref={formRef}>
          <h2>{editingId ? "Edit problem" : "Log a problem"}</h2>
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="f-name">Problem</label>
              <input id="f-name" value={form.name} onChange={setF("name")} placeholder="3Sum" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="f-pattern">Pattern</label>
              <input id="f-pattern" list="pattern-list" value={form.pattern} onChange={setF("pattern")} placeholder="Two Pointers, Hash Map, Sliding Window" autoComplete="off" />
              <datalist id="pattern-list">{patternOptions.map((o) => <option key={o} value={o} />)}</datalist>
              <span className="hint">Type any pattern. Same pattern goes to the same list.</span>
            </div>
            <div className="field">
              <label htmlFor="f-diff">Difficulty</label>
              <select id="f-diff" value={form.difficulty} onChange={setF("difficulty")}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
              <span className="hint">Counts on the leaderboard.</span>
            </div>
            <div className="field">
              <label htmlFor="f-date">Solved on</label>
              <input id="f-date" type="date" value={form.solvedOn} onChange={setF("solvedOn")} />
              <span className="hint">Redo date = this date + {REDO_GAP_DAYS} days.</span>
            </div>
            <div className="field">
              <label htmlFor="f-link">Link (optional)</label>
              <input id="f-link" type="url" value={form.link} onChange={setF("link")} placeholder="https://leetcode.com/problems/3sum/" autoComplete="off" />
            </div>

            <div className="field wide">
              <label htmlFor="f-notes">Core logic, in your own words</label>
              <textarea id="f-notes" value={form.notes} onChange={setF("notes")} placeholder="Sort, fix i, then two pointers j and k like Two Sum II. Skip duplicates on i, and on j and k after a match." />
              <div className="upload-row">
                <label className="btn small" htmlFor="u-notes" style={{ cursor: "pointer" }}>Upload logic file (.txt, .md)</label>
                <input id="u-notes" className="visually-hidden" type="file" accept=".txt,.md,.text,text/plain,text/markdown"
                  onChange={(e) => { readTextFile("notes", e.target.files[0]); e.target.value = ""; }} />
                {fileNames.notes && <span className="file-name">Loaded: {fileNames.notes}. You can still edit the text above.</span>}
              </div>
            </div>

            <div className="field wide">
              <label htmlFor="f-sol">Your solution</label>
              <textarea id="f-sol" className="code" spellCheck="false" value={form.solution} onChange={setF("solution")} placeholder="Paste your Java code here, or upload the file" />
              <div className="upload-row">
                <label className="btn small" htmlFor="u-sol" style={{ cursor: "pointer" }}>Upload code file (.java, .txt)</label>
                <input id="u-sol" className="visually-hidden" type="file" accept=".java,.txt,.text,.md,text/plain"
                  onChange={(e) => { readTextFile("solution", e.target.files[0]); e.target.value = ""; }} />
                {fileNames.solution && <span className="file-name">Loaded: {fileNames.solution}</span>}
              </div>
            </div>
          </div>
          {formError && <div className="err" role="alert">{formError}</div>}
          <div className="actions">
            {editingId ? (
              <>
                <button className="btn primary" onClick={() => submit(false)}>Save changes</button>
                <button className="btn" onClick={() => submit(true)}>Save and send to redo</button>
              </>
            ) : (
              <>
                <button className="btn primary" onClick={() => submit(false)}>Submit as done</button>
                <button className="btn" onClick={() => submit(true)}>Submit and redo in {REDO_GAP_DAYS} days</button>
              </>
            )}
            <button className="btn" onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === "redo"} onClick={() => setTab("redo")}>
          Redo<span className={"count" + (redoDueList.length ? " due" : "")}>{redo.length}</span>
        </button>
        <button className="tab" role="tab" aria-selected={tab === "done"} onClick={() => setTab("done")}>
          Done<span className="count">{done.length}</span>
        </button>
        <button className="tab" role="tab" aria-selected={tab === "patterns"} onClick={() => setTab("patterns")}>
          By pattern<span className="count">{groups.length}</span>
        </button>
      </div>

      {tab === "redo" && (
        redo.length === 0 ? (
          <div className="empty"><b>Nothing to redo right now</b>Submit a problem with "redo in {REDO_GAP_DAYS} days", or send one from the Done tab.</div>
        ) : (
          <>
            {redoDueList.length > 0 && (
              <>
                <div className="group-title"><h2>Due today or overdue</h2><span className="hint num">{redoDueList.length}</span></div>
                <div className="list">{redoDueList.map((p) => renderCard(p, "redo"))}</div>
              </>
            )}
            {redoLater.length > 0 && (
              <>
                <div className="group-title"><h2>Coming up</h2><span className="hint num">{redoLater.length}</span></div>
                <div className="list">{redoLater.map((p) => renderCard(p, "redo"))}</div>
              </>
            )}
          </>
        )
      )}

      {tab === "done" && (
        done.length === 0 ? (
          <div className="empty"><b>No finished problems yet</b>Log your first problem with the button above. Problems you submit as done, or finish redoing, show up here.</div>
        ) : (
          <div className="list">{done.map((p) => renderCard(p, "done"))}</div>
        )
      )}

      {tab === "patterns" && (
        groups.length === 0 ? (
          <div className="empty"><b>No patterns yet</b>Log a problem and its pattern gets its own list.</div>
        ) : (
          <>
            <div className="pattern-filter">
              <button className="pill" aria-pressed={!filter} onClick={() => setFilter("")}>All<span className="n">{problems.length}</span></button>
              {groups.map((g) => (
                <button key={g.key} className="pill" aria-pressed={filter === g.key} onClick={() => setFilter(filter === g.key ? "" : g.key)}>
                  {g.label}<span className="n">{g.items.length}</span>
                </button>
              ))}
            </div>
            {visibleGroups.map((g) => (
              <section key={g.key}>
                <div className="group-title">
                  <h2>{g.label}</h2>
                  <span className="hint num">{g.items.length} problem{g.items.length === 1 ? "" : "s"}, {g.items.filter((x) => x.redo).length} in redo</span>
                </div>
                <div className="list">{g.items.map((p) => renderCard(p, "pattern"))}</div>
              </section>
            ))}
          </>
        )
      )}

      <div className="footer">
        <span className="hint">Your problems sync to your account. Export a backup file if you want a copy, or import one (for example the starter file).</span>
        <button className="btn small" onClick={exportJson}>Export backup</button>
        <label className="btn small" htmlFor="import-file" style={{ cursor: "pointer" }}>Import backup</label>
        <input id="import-file" ref={importRef} className="visually-hidden" type="file" accept=".json,application/json"
          onChange={(e) => importJson(e.target.files[0])} />
      </div>

      <div className="panel account">
        <div className="account-head">
          <div>
            <h2>Account</h2>
            <p className="hint" style={{ margin: "2px 0 0" }}>Signed in as {session.user.email}</p>
          </div>
          {pw === null && <button className="btn small" onClick={() => setPw({ next: "", again: "", busy: false, error: "" })}>Change password</button>}
        </div>
        {pw !== null && (
          <form onSubmit={(e) => { e.preventDefault(); savePassword(); }}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pw-new">New password</label>
                <input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pw-again">Type it again</label>
                <input id="pw-again" type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
              </div>
            </div>
            {pw.error && <div className="err" role="alert">{pw.error}</div>}
            <div className="actions">
              <button type="submit" className="btn primary" disabled={pw.busy}>Save new password</button>
              <button type="button" className="btn" onClick={() => setPw(null)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function CodeBlock({ code, onCopied }) {
  const ref = useRef(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); onCopied(); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents(ref.current);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  };
  return (
    <div>
      <pre className="code" ref={ref}>{code}</pre>
      <div style={{ marginTop: 6 }}><button className="btn small" onClick={copy}>Copy code</button></div>
    </div>
  );
}

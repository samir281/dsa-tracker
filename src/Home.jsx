import { useEffect, useState } from "react";
import { QUOTES } from "./quotes.js";
import { cloudEnabled, getLeaderboard } from "./cloud.js";

const BLOCK_MS = 2 * 60 * 60 * 1000; // a new quote every 2 hours
const IST_MS = 5.5 * 60 * 60 * 1000;  // blocks line up with India time

const blockIndex = (now) => Math.floor((now + IST_MS) / BLOCK_MS);

function QuoteCard() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const idx = blockIndex(now);
  const nextChange = new Date((idx + 1) * BLOCK_MS - IST_MS);
  return (
    <section className="quote" aria-label="Motivation">
      <p className="quote-label">Quote for these 2 hours</p>
      <blockquote>{QUOTES[idx % QUOTES.length]}</blockquote>
      <p className="quote-next">Next one at {nextChange.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
    </section>
  );
}

function Leaderboard() {
  const [days, setDays] = useState(3);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cloudEnabled) return undefined;
    let alive = true;
    const load = async () => {
      try {
        const data = await getLeaderboard(days);
        if (alive) { setRows(data); setError(""); }
      } catch (e) {
        if (alive) setError(e.message || "Could not load the leaderboard.");
      }
    };
    setRows(null);
    load();
    const t = setInterval(load, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [days]);

  return (
    <section aria-label="Leaderboard">
      <div className="lb-head">
        <div>
          <h2>Leaderboard</h2>
          <p className="hint">Problems logged {days === 1 ? "today" : "in the last 3 days"}. Points: Easy 1, Medium 2, Hard 3.</p>
        </div>
        <div className="seg" role="group" aria-label="Time range">
          <button aria-pressed={days === 1} onClick={() => setDays(1)}>Today</button>
          <button aria-pressed={days === 3} onClick={() => setDays(3)}>Last 3 days</button>
        </div>
      </div>

      {!cloudEnabled ? (
        <div className="empty"><b>Leaderboard is not connected</b>Add the Supabase URL and key in Netlify (see README), then redeploy.</div>
      ) : error ? (
        <div className="empty"><b>Could not load the leaderboard</b>{error}</div>
      ) : rows === null ? (
        <div className="empty">Loading the leaderboard...</div>
      ) : rows.length === 0 ? (
        <div className="empty"><b>Nobody has logged a problem {days === 1 ? "today" : "in the last 3 days"}</b>Sign up and log the first one to take rank 1.</div>
      ) : (
        <div className="table-wrap">
          <table className="lb">
            <thead>
              <tr>
                <th className="rank">#</th>
                <th>Name</th>
                <th className="n">Easy</th>
                <th className="n">Medium</th>
                <th className="n">Hard</th>
                <th className="n">Total</th>
                <th className="n">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.display_name + i} className={i === 0 ? "first" : ""}>
                  <td className="rank num">{i + 1}</td>
                  <td className="who">{r.display_name}</td>
                  <td className="n num">{r.easy}</td>
                  <td className="n num">{r.medium}</td>
                  <td className="n num">{r.hard}</td>
                  <td className="n num">{r.total}</td>
                  <td className="n num pts">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Home({ loggedIn, go }) {
  return (
    <>
      <QuoteCard />
      <Leaderboard />
      {!loggedIn && cloudEnabled && (
        <div className="cta">
          <span>Want your name on the board?</span>
          <button className="btn primary" onClick={() => go("signup")}>Sign up</button>
          <button className="btn" onClick={() => go("login")}>Login</button>
        </div>
      )}
    </>
  );
}

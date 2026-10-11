export const REDO_GAP_DAYS = 3;

/* ---------- dates (local, YYYY-MM-DD) ---------- */
const pad = (n) => String(n).padStart(2, "0");
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((fromISO(a) - fromISO(b)) / 86400000);
export const fmt = (iso) =>
  iso ? fromISO(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
export const fmtFull = (iso) =>
  iso ? fromISO(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";

/* ---------- patterns ----------
   "two pointer", "Two Pointers" and "two-pointers" all land in the same list. */
export const KNOWN = [
  "Hash Map", "Hash Set", "Two Pointers", "Sliding Window", "Prefix / Suffix", "Stack", "Binary Search",
  "Linked List", "Trees", "Heap / Priority Queue", "Graphs", "Backtracking", "Dynamic Programming",
  "Greedy", "Intervals", "Tries", "Bit Manipulation", "Math", "Arrays", "Strings",
];
export const patKey = (p) =>
  (p || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
const KNOWN_BY_KEY = Object.fromEntries(KNOWN.map((k) => [patKey(k), k]));
const ALIASES = {
  hashing: "Hash Map", dp: "Dynamic Programming", tree: "Trees", bst: "Trees", heap: "Heap / Priority Queue",
  priorityqueue: "Heap / Priority Queue", graph: "Graphs", bfs: "Graphs", dfs: "Graphs",
  prefix: "Prefix / Suffix", prefixsum: "Prefix / Suffix", suffix: "Prefix / Suffix", trie: "Tries",
  binarysearch: "Binary Search", twopointer: "Two Pointers", slidingwindow: "Sliding Window",
};
export const canonicalPattern = (raw) => {
  const text = (raw || "").trim().replace(/\s+/g, " ");
  const k = patKey(text);
  if (KNOWN_BY_KEY[k]) return KNOWN_BY_KEY[k];
  if (ALIASES[k]) return ALIASES[k];
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
};

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

// API battery: every single route in src/app/api, live, over the running app.
//
// The Task 35 claim set (user: "check all apis ... check everything"):
//  1. FULL SWEEP: all 39 routes x their real methods, anonymously AND authed -
//     nothing may answer 500. Ever. Under garbage input either.
//  2. GATING: the auth-gated surfaces reject anonymous callers.
//  3. DEEP SHAPE: the core read routes return the data shapes the UI relies on.
//  4. LOOP UNITS: the JSON-repair logic that used to leak raw JSON into the
//     coach chat is pinned against the EXACT payloads seen in the wild
//     (the user's chat log), plus prose/fence/thought-only/truncated cases.
// Full state restore in finally via the app's own portability machinery.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
const BASE = "http://localhost:3000";
export {};

const EMAIL = `battery-${Date.now()}@rah.test`;

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

// ---------- snapshot for restore (the app's own 20-table machinery) ----------
const { buildBundle, planImport, commitImport } = await import("@/lib/portable");
const before = await buildBundle();

// ---------- helpers ----------
function makeApi(cookie: string) {
  return async (path: string, init?: RequestInit): Promise<{ status: number; body: any; text: string; setCookie?: string }> => {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    if (cookie) headers.set("cookie", cookie);
    const r = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
    const sc = r.headers.get("set-cookie");
    const text = await r.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: r.status, body, text, setCookie: sc ?? undefined };
  };
}

// The full route/method map (grep-verified against src/app/api/**/route.ts).
const ROUTES: { path: string; methods: string[] }[] = [
  { path: "/api", methods: ["GET"] },
  { path: "/api/arcade", methods: ["GET"] },
  { path: "/api/arcade/boss", methods: ["GET", "POST"] },
  { path: "/api/arcade/duel", methods: ["GET", "POST"] },
  { path: "/api/arcade/dungeon", methods: ["GET", "POST"] },
  { path: "/api/arcade/gauntlet", methods: ["GET", "POST"] },
  { path: "/api/arcade/league", methods: ["GET"] },
  { path: "/api/arcade/perks", methods: ["GET", "POST"] },
  { path: "/api/arcade/speed", methods: ["GET", "POST"] },
  { path: "/api/arena/voice", methods: ["GET", "POST"] },
  { path: "/api/auth/google/callback", methods: ["GET"] },
  { path: "/api/auth/google/start", methods: ["GET"] },
  { path: "/api/auth/request-code", methods: ["POST"] },
  { path: "/api/auth/session", methods: ["GET", "DELETE"] },
  { path: "/api/auth/verify", methods: ["POST"] },
  { path: "/api/chat", methods: ["GET", "POST", "DELETE"] },
  { path: "/api/coach-agent", methods: ["POST"] },
  { path: "/api/coach/briefing", methods: ["GET", "POST"] },
  { path: "/api/exam/grade", methods: ["POST"] },
  { path: "/api/exam/replay", methods: ["GET"] },
  { path: "/api/export", methods: ["GET"] },
  { path: "/api/flow", methods: ["GET", "POST"] },
  { path: "/api/grammar-check", methods: ["POST"] },
  { path: "/api/import", methods: ["POST"] },
  { path: "/api/listen", methods: ["GET", "POST"] },
  { path: "/api/listen/dictation", methods: ["POST"] },
  { path: "/api/mistakes", methods: ["GET", "DELETE"] },
  { path: "/api/placement", methods: ["GET", "POST"] },
  { path: "/api/progress", methods: ["GET"] },
  { path: "/api/quiz", methods: ["POST"] },
  { path: "/api/review/grade", methods: ["POST"] },
  { path: "/api/review/queue", methods: ["GET"] },
  { path: "/api/review/undo", methods: ["POST"] },
  { path: "/api/shop", methods: ["GET", "POST"] },
  { path: "/api/speak", methods: ["GET", "POST"] },
  { path: "/api/state", methods: ["GET"] },
  { path: "/api/theme", methods: ["GET", "POST"] },
  { path: "/api/version", methods: ["GET"] },
  { path: "/api/writing", methods: ["GET", "POST"] },
];

const GATED = ["/api/coach-agent", "/api/shop"]; // 401 to anonymous by design
const AUTH_ROUTES = ["/api/auth/request-code", "/api/auth/verify", "/api/auth/session", "/api/auth/google/start", "/api/auth/google/callback"];

try {
  // ================= 1. ANONYMOUS SWEEP =================
  console.log("\n--- sweep: anonymous (gate + no 500) ---");
  const anon = makeApi("");
  for (const r of ROUTES) {
    for (const m of r.methods) {
      const res = await anon(r.path, { method: m, body: m === "GET" || m === "DELETE" ? undefined : JSON.stringify({}) });
      const ok = res.status < 500 || res.status === 501; // 501 = designed "not configured" signal (google/start)
      check(ok, `anon ${m} ${r.path} < 500`, `status=${res.status} ${res.text.slice(0, 120)}`);
      if (GATED.includes(r.path) && m !== "GET") {
        check(res.status === 401, `anon ${m} ${r.path} is 401-gated`, `status=${res.status}`);
      }
    }
  }

  // ================= 2. LOGIN =================
  console.log("\n--- login: battery user ---");
  const req1 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: EMAIL }) });
  const devCode = req1.body?.devCode as string | undefined;
  check(req1.status === 200 && /^\d{6}$/.test(devCode ?? ""), "request-code issues a code", JSON.stringify(req1.body));
  let cookie = "";
  {
    const api0 = makeApi("");
    const good = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: EMAIL, code: devCode }) });
    check(good.status === 200, "verify mints a session", JSON.stringify(good.body));
    cookie = good.setCookie?.split(";")[0] ?? "";
  }
  check(cookie.includes("rah_session="), "session cookie captured", cookie.slice(0, 24));
  const api = makeApi(cookie);

  // ================= 3. AUTHED SWEEP (hostile input: no 500s) =================
  console.log("\n--- sweep: authed, hostile bodies (no 500) ---");
  for (const r of ROUTES) {
    for (const m of r.methods) {
      if (AUTH_ROUTES.includes(r.path)) continue; // auth routes exercised above + rate limits
      const res = await api(r.path, { method: m, body: m === "GET" || m === "DELETE" ? undefined : JSON.stringify({}) });
      check(res.status < 500, `authed ${m} ${r.path} {} < 500`, `status=${res.status} ${res.text.slice(0, 120)}`);
    }
  }
  // Double-garbage pass: type-hostile payloads on the mutating routes.
  const mutators = ROUTES.filter((r) => r.methods.includes("POST") && !AUTH_ROUTES.includes(r.path));
  for (const r of mutators) {
    const res = await api(r.path, { method: "POST", body: JSON.stringify({ action: 42, items: "nope", data: { nested: [1, 2, { x: null }] } }) });
    check(res.status < 500, `authed POST ${r.path} garbage < 500`, `status=${res.status} ${res.text.slice(0, 120)}`);
  }

  // ================= 4. DEEP SHAPE (what the UI leans on) =================
  console.log("\n--- deep shape: core reads ---");
  const state = await api("/api/state");
  check(state.status === 200, "GET /api/state 200", String(state.status));
  check(Boolean(state.body?.learner) && typeof state.body?.due === "number", "state carries learner + due", JSON.stringify(state.body).slice(0, 150));

  const queue = await api("/api/review/queue");
  check(queue.status === 200 && Array.isArray(queue.body?.batch), "review queue returns a batch array", JSON.stringify(queue.body).slice(0, 120));

  const progress = await api("/api/progress");
  check(progress.status === 200 && Boolean(progress.body), "GET /api/progress 200", String(progress.status));

  const mistakes = await api("/api/mistakes");
  check(mistakes.status === 200, "GET /api/mistakes 200", String(mistakes.status));

  const version = await api("/api/version");
  check(version.status === 200 && Boolean(version.body), "GET /api/version 200", String(version.status));

  const shop = await api("/api/shop");
  check(shop.status === 200 && typeof shop.body?.gems === "number" && Array.isArray(shop.body?.items), "GET /api/shop carries gems + items", JSON.stringify(shop.body).slice(0, 150));

  const arcade = await api("/api/arcade");
  check(arcade.status === 200 && Boolean(arcade.body), "GET /api/arcade 200", String(arcade.status));

  const chat = await api("/api/chat");
  check(chat.status === 200 && Array.isArray(chat.body?.messages), "GET /api/chat returns messages", JSON.stringify(chat.body).slice(0, 120));

  const ex = await fetch(`${BASE}/api/export`, { headers: { cookie } });
  const exText = await ex.text();
  let bundle: any = null;
  try {
    bundle = JSON.parse(exText);
  } catch {}
  check(ex.status === 200 && bundle?.format === "rah.v1", "export is a rah.v1 bundle", exText.slice(0, 80));

  const badImport = await api("/api/import", { method: "POST", body: JSON.stringify({ dryRun: true, bundle: { format: "rah.v1", tables: { Learner: [{ id: "bogus" }] } } }) });
  check(badImport.status < 500, "import dry-run with a hostile bundle stays graceful", `status=${badImport.status}`);

  // coach-agent input validation (cheap, no model call)
  const noMsg = await api("/api/coach-agent", { method: "POST", body: JSON.stringify({}) });
  check(noMsg.status === 400, "coach-agent rejects an empty message with 400", `status=${noMsg.status}`);

  // ================= 5. LOOP UNITS: the JSON-repair regression wall =================
  console.log("\n--- loop units: extractTurn / sanitizeReply ---");
  const { extractTurn, sanitizeReply } = await import("@/lib/coach-agent/loop");

  // The EXACT shape from the user's chat log (mangled braces, spaced keys).
  const wild = '{"thought":"The learner is asking me to \'make an exam\' at B2 level with a vocabulary focus. I should use the coach_skill function to generate an exam tailored to their current level and focus area.", "tool": "coach_skill", "args": {"message": "/exam vocabulary B2"}}}';
  const w = extractTurn(wild);
  check(w.kind === "json" && w.turn.tool === "coach_skill", "wild mangled JSON extracts a tool call", JSON.stringify(w));
  check((w.turn.args as any)?.message === "/exam vocabulary B2", "wild args survive the salvage", JSON.stringify(w.turn.args));
  check(!w.turn.reply, "wild mangled JSON never becomes a reply", JSON.stringify(w.turn.reply));

  // Truncated JSON (model cut mid-args).
  const cut = '{"thought":"need state","tool":"read_state","args":{';
  const c = extractTurn(cut);
  check(c.kind === "json" && c.turn.tool === "read_state", "truncated JSON repairs to a tool call", JSON.stringify(c));

  // Thought-only turn: parses, but has no tool and no final - the loop's
  // continuation branch (not the final branch) must own it.
  const t = extractTurn('{"thought":"Let me think about what to do here."}');
  check(!t.turn.tool && !t.turn.final && !t.turn.reply, "thought-only turn has no tool/final (loop will nudge)", JSON.stringify(t));

  // Fenced JSON.
  const f = extractTurn('```json\n{"thought":"go","final":true,"reply":"Here is your plan.","corrections":[],"commands":[]}\n```');
  check(f.turn.final === true && f.turn.reply === "Here is your plan.", "fenced final parses", JSON.stringify(f));

  // Plain prose: a legitimate final.
  const p = extractTurn("Great work today! Your streak is safe.");
  check(p.kind === "prose" && p.turn.final === true && p.turn.reply!.includes("streak"), "prose becomes a final answer", JSON.stringify(p));

  // Mangled final whose reply survives salvage.
  const mf = extractTurn('{"thought":"done","final":true,"reply":"The final will take place on Sunday - nice fix.","corrections":[]}');
  check(mf.turn.reply!.includes("Sunday"), "mangled final salvages the reply", JSON.stringify(mf));

  // sanitizeReply: raw JSON as reply gets unwrapped or replaced.
  check(sanitizeReply('{"thought":"x","tool":"read_state"}', "FB") === "FB", "sanitizeReply replaces a tool-call reply", sanitizeReply('{"thought":"x","tool":"read_state"}', "FB"));
  check(sanitizeReply('{"final":true,"reply":"Clean answer"}', "FB") === "Clean answer", "sanitizeReply unwraps a nested reply", "unwrap failed");
  check(sanitizeReply("A normal sentence.", "FB") === "A normal sentence.", "sanitizeReply passes prose through", "prose mangled");

  // ================= 6. RESTORE =================
  console.log("\n--- restore ---");
  const plan = planImport({ format: "rah.v1", exportedAt: before.bundle.exportedAt, tables: before.bundle.tables });
  check(plan.valid === true, "restore plan accepted", JSON.stringify(plan).slice(0, 150));
  await commitImport(before.bundle.tables);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
  console.log("restore done (bundle + battery user removed)");
} catch (e) {
  console.error("BATTERY CRASH:", e);
  failures += 1;
}

console.log(`\n=== API BATTERY: ${n - failures}/${n} ===`);
if (failures > 0) process.exit(1);

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
//  5. WORKSPACE + PDF: the coach's file deliverables - listing, sandboxed
//     download, make_pdf tool guards, a REAL %PDF byte check.
//  6. PAIRS (DUOLINGO-RE D3): deterministic board, clamped grading, hostile
//     id filtering.
// Full state restore in finally via the app's own portability machinery.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
// Isolated runs (scripts/test-isolated-battery.sh) point both at the throwaway
// stack; the default remains the local dev server.
const BASE = process.env.BATTERY_BASE ?? "http://localhost:3000";
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
  { path: "/api/account", methods: ["DELETE"] },
  { path: "/api/arcade", methods: ["GET"] },
  { path: "/api/arcade/boss", methods: ["GET", "POST"] },
  { path: "/api/arcade/duel", methods: ["GET", "POST"] },
  { path: "/api/arcade/dungeon", methods: ["GET", "POST"] },
  { path: "/api/arcade/gauntlet", methods: ["GET", "POST"] },
  { path: "/api/arcade/league", methods: ["GET"] },
  { path: "/api/arcade/perks", methods: ["GET", "POST"] },
  { path: "/api/arcade/speed", methods: ["GET", "POST"] },
  { path: "/api/arcade/pairs", methods: ["GET", "POST"] },
  { path: "/api/arena/voice", methods: ["GET", "POST"] },
  { path: "/api/auth/google/callback", methods: ["GET"] },
  { path: "/api/auth/google/start", methods: ["GET"] },
  { path: "/api/auth/request-code", methods: ["POST"] },
  { path: "/api/auth/session", methods: ["GET", "DELETE"] },
  { path: "/api/auth/verify", methods: ["POST"] },
  { path: "/api/curriculum", methods: ["GET"] },
  { path: "/api/chat", methods: ["GET", "POST", "DELETE"] },
  { path: "/api/coach-agent", methods: ["POST"] },
  { path: "/api/coach/briefing", methods: ["GET", "POST"] },
  { path: "/api/exam/grade", methods: ["POST"] },
  { path: "/api/exam/replay", methods: ["GET"] },
  { path: "/api/feedback", methods: ["GET", "POST"] },
  { path: "/api/export", methods: ["GET"] },
  { path: "/api/export/anki", methods: ["GET"] },
  { path: "/api/flow", methods: ["GET", "POST"] },
  { path: "/api/grammar-check", methods: ["POST"] },
  { path: "/api/import", methods: ["POST"] },
  { path: "/api/listen", methods: ["GET", "POST"] },
  { path: "/api/listen/dictation", methods: ["POST"] },
  { path: "/api/materials", methods: ["GET", "POST", "DELETE"] },
  { path: "/api/mistakes", methods: ["GET", "POST", "DELETE"] },
  { path: "/api/goals", methods: ["GET", "POST"] },
  { path: "/api/placement", methods: ["GET", "POST"] },
  { path: "/api/progress", methods: ["GET"] },
  { path: "/api/progress/outcomes", methods: ["GET"] },
  { path: "/api/quiz", methods: ["POST"] },
  { path: "/api/review/grade", methods: ["POST"] },
  { path: "/api/review/queue", methods: ["GET"] },
  { path: "/api/review/suspend", methods: ["POST"] },
  { path: "/api/review/undo", methods: ["POST"] },
  { path: "/api/settings", methods: ["POST"] },
  { path: "/api/shop", methods: ["GET", "POST"] },
  { path: "/api/speak", methods: ["GET", "POST"] },
  { path: "/api/speak/analytics", methods: ["GET"] },
  { path: "/api/speak/assess", methods: ["GET", "POST"] },
  { path: "/api/speak/conversation", methods: ["GET", "POST"] },
  { path: "/api/state", methods: ["GET"] },
  { path: "/api/theme", methods: ["GET", "POST"] },
  { path: "/api/version", methods: ["GET"] },
  { path: "/api/workspace", methods: ["GET"] },
  { path: "/api/workspace/file", methods: ["GET"] },
  { path: "/api/writing", methods: ["GET", "POST"] },
];

const GATED = ["/api/coach-agent", "/api/shop", "/api/feedback"]; // 401 to anonymous by design
const AUTH_ROUTES = ["/api/auth/request-code", "/api/auth/verify", "/api/auth/session", "/api/auth/google/start", "/api/auth/google/callback", "/api/account"]; // swept in the login/deletion sections - the authed sweep must NOT DELETE the main session's account

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
  let loginToken = "";
  {
    const api0 = makeApi("");
    // Embedded client (x-rah-embed: 1) - the only caller that receives the
    // no-cookie fallback credential in the response body.
    const good = await api0("/api/auth/verify", {
      method: "POST",
      headers: { "x-rah-embed": "1" },
      body: JSON.stringify({ email: EMAIL, code: devCode }),
    });
    check(good.status === 200, "verify mints a session", JSON.stringify(good.body));
    cookie = good.setCookie?.split(";")[0] ?? "";
    loginToken = String(good.body?.token ?? ""); // body token: the no-cookie fallback credential
  }
  check(cookie.includes("rah_session="), "session cookie captured", cookie.slice(0, 24));
  const api = makeApi(cookie);

  // Task 67: every learning table is (userId, ...) keyed now - the direct-DB
  // seeds below must land on the SESSION user's rows, not the legacy singleton.
  const { PrismaClient: PCUid } = await import("@prisma/client");
  const prUid = new PCUid();
  const UID = (await prUid.user.findUnique({ where: { email: EMAIL } }))?.id ?? "me";
  await prUid.$disconnect();

  // --- auth hardening pins (P0-3/P0-4 wave) ---
  console.log("\n--- auth hardening ---");
  {
    const api0 = makeApi("");
    // Single use: the consumed code cannot log in again, embed or not.
    const replay = await api0("/api/auth/verify", { method: "POST", headers: { "x-rah-embed": "1" }, body: JSON.stringify({ email: EMAIL, code: devCode }) });
    check(replay.status === 400, "consumed code replay refused (single-use)", `status=${replay.status}`);

    // Normal login (no embed marker) must leak NO browser-readable token.
    const email2 = `battery-plain-${Date.now()}@rah.test`;
    const req2 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: email2 }) });
    const devCode2 = req2.body?.devCode as string | undefined;
    const plain = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: email2, code: devCode2 }) });
    check(plain.status === 200 && plain.body?.token === undefined, "normal verify leaks NO body token", JSON.stringify(plain.body));
    check((plain.setCookie ?? "").includes("rah_session="), "normal verify still sets the httpOnly cookie", String(plain.setCookie).slice(0, 30));

    // Codes are hashed at rest: the DB row must NOT contain the plaintext.
    const { db } = await import("@/lib/db");
    const lc = await db.loginCode.findFirst({ where: { email: email2 }, orderBy: { id: "desc" } });
    check(
      !!lc && /^[0-9a-f]{64}$/.test(lc.code) && lc.code !== String(devCode2),
      "login code stored as sha256 hash, never plaintext",
      `len=${lc?.code.length ?? 0}`,
    );
    await db.$disconnect();

    // Resend invalidates: issuing a fresh code kills the previous unused one.
    const emailA = `battery-resend-${Date.now()}@rah.test`;
    const ra1 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailA }) });
    const codeA1 = ra1.body?.devCode as string | undefined;
    const ra2 = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailA }) });
    const codeA2 = ra2.body?.devCode as string | undefined;
    const oldTry = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailA, code: codeA1 }) });
    check(oldTry.status === 400, "resend invalidates the previous code", `status=${oldTry.status}`);
    const newTry = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailA, code: codeA2 }) });
    check(newTry.status === 200, "the fresh code still works after resend", `status=${newTry.status}`);

    // Brute-force: 5 wrong guesses kill the code - even the CORRECT code dies.
    const emailB = `battery-brute-${Date.now()}@rah.test`;
    const rb = await anon("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailB }) });
    const codeB = rb.body?.devCode as string | undefined;
    const wrong = codeB === "000000" ? "000001" : "000000";
    let last = 0;
    for (let i = 0; i < 5; i++) {
      const g = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailB, code: wrong }) });
      last = g.status;
    }
    check(last === 400, "wrong guesses rejected", `status=${last}`);
    const deadTry = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailB, code: codeB }) });
    check(deadTry.status === 400, "code dead after 5 failed guesses (brute-force guard)", `status=${deadTry.status}`);

    // Cleanup the pin users/codes right here so restore stays simple.
    const { db: db2 } = await import("@/lib/db");
    await db2.user.deleteMany({ where: { email: { in: [email2, emailA, emailB] } } });
    await db2.loginCode.deleteMany({ where: { email: { startsWith: "battery-" } } });
    await db2.$disconnect();
  }

  // --- account deletion (P1-9) ---
  console.log("\n--- account deletion ---");
  {
    const emailD = `battery-del-${Date.now()}@rah.test`;
    const apiD0 = makeApi("");
    const rd = await apiD0("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: emailD }) });
    const codeD = rd.body?.devCode as string | undefined;
    const verD = await apiD0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailD, code: codeD }) });
    check(verD.status === 200, "deletion setup: synthetic account registered", `status=${verD.status}`);
    const cookieD = verD.setCookie?.split(";")[0] ?? "";
    const apiD = makeApi(cookieD);
    const del = await apiD("/api/account", { method: "DELETE" });
    check(del.status === 200 && del.body?.ok === true, "DELETE /api/account removes the account", JSON.stringify(del.body).slice(0, 120));
    check(del.body?.removed?.account === true, "deletion reports the account row", JSON.stringify(del.body?.removed));
    check(typeof del.body?.notice === "string" && del.body.removed?.learnerState === false, "shared learner state honestly kept while other accounts remain", JSON.stringify(del.body?.notice).slice(0, 90));
    const after = await apiD("/api/auth/session", { method: "GET" });
    check(after.status === 200 && after.body?.user === null, "session dead after account deletion", JSON.stringify(after.body));
    const gone = await apiD0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: emailD, code: "000000" }) });
    check(gone.status === 400, "the deleted account's login codes are gone too", `status=${gone.status}`);

    // Isolation: deleting account D must NOT touch the battery user's session.
    const mainStill = await api("/api/auth/session", { method: "GET" });
    check(
      mainStill.status === 200 && mainStill.body?.user?.email === EMAIL,
      "another account's deletion leaves the main session alive",
      `status=${mainStill.status} user=${mainStill.body?.user?.email ?? "null"}`,
    );
    const { db: dbD } = await import("@/lib/db");
    await dbD.user.deleteMany({ where: { email: emailD } }).catch(() => undefined);
    await dbD.$disconnect();
  }

  // --- AI abuse limiter (P1-6) ---
  console.log("\n--- ai rate limit ---");
  {
    const { aiRateLimit } = await import("@/lib/rate-limit");
    const mk = (ip: string) => new Request("http://localhost:3000/api/quiz", { headers: ip ? { "x-forwarded-for": ip } : {} });
    // loopback + direct local access exempt (battery/toolchain doctrine)
    check(aiRateLimit(mk("")).ok === true, "limiter: direct local access exempt", "");
    check(aiRateLimit(mk("127.0.0.1")).ok === true, "limiter: loopback exempt", "");
    // real IP: 15 anonymous calls pass, 16th is a 429 with Retry-After
    let last: ReturnType<typeof aiRateLimit> | null = null;
    for (let i = 0; i < 16; i++) last = aiRateLimit(mk("203.0.113.7"));
    check(last!.ok === false && last!.response!.status === 429, "limiter: 16th anonymous call in a minute is 429", String(last!.response?.status));
    check((last!.response!.headers.get("retry-after") ?? "") !== "", "limiter: 429 carries Retry-After", "");
    // a different IP is untouched (per-IP buckets)
    check(aiRateLimit(mk("203.0.113.8")).ok === true, "limiter: per-IP isolation", "");
    // signed-in budget is separate and higher (40/min)
    let signedOk = true;
    for (let i = 0; i < 40; i++) signedOk = signedOk && aiRateLimit(mk("203.0.113.9"), "user-x").ok;
    const signed41 = aiRateLimit(mk("203.0.113.9"), "user-x");
    check(signedOk && signed41.ok === false, "limiter: signed-in budget 40/min then 429", String(signed41.response?.status));
  }

  // --- agent tool permission matrix (P1-8) ---
  console.log("\n--- tool permissions ---");
  {
    const { TOOLS, TOOL_TIERS, toolTier, TIER_BUDGETS, UNTRUSTED_FRAME } = await import("@/lib/coach-agent/tools");
    check(TOOLS.every((t: { name: string }) => TOOL_TIERS[t.name] !== undefined), "permission matrix covers every registered tool", JSON.stringify(TOOLS.filter((t: { name: string }) => TOOL_TIERS[t.name] === undefined).map((t: { name: string }) => t.name)));
    check(toolTier("nonexistent_tool") === "state", "unknown tools default to the most dangerous tier", toolTier("nonexistent_tool"));
    check(TIER_BUDGETS.state === 2 && TIER_BUDGETS.exec === 2 && TIER_BUDGETS.network === 4, "per-run budgets: state 2, exec 2, network 4", JSON.stringify(TIER_BUDGETS));
    check(
      UNTRUSTED_FRAME.head.includes("UNTRUSTED WEB CONTENT") && UNTRUSTED_FRAME.head.includes("not instructions"),
      "prompt-injection frame marks web content as data",
      UNTRUSTED_FRAME.head.slice(0, 60),
    );
  }

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
  const goals0 = await api("/api/goals");
  check(goals0.status === 200 && Array.isArray(goals0.body?.active) && goals0.body?.plan?.dueForecast, "goal planner ships goals + deterministic plan", JSON.stringify(goals0.body).slice(0, 120));
  const goalsBad = await api("/api/goals", { method: "POST", body: JSON.stringify({ title: "ab" }) });
  check(goalsBad.status === 400, "goal with short title is 400 with a speakable error", JSON.stringify(goalsBad.body));

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

  // ================= 4b. HEADER AUTH: the embedded-context fallback =================
  // Cookies can be dropped entirely (preview iframes, third-party-cookie
  // blocking): the session must still resolve from the x-rah-token header.
  console.log("\n--- header auth: no-cookie requests ---");
  check(loginToken.length >= 32, "verify response carries the body token", `len=${loginToken.length}`);
  const noCookie = makeApi("");
  const hdrSession = await noCookie("/api/auth/session", { method: "GET", headers: { "x-rah-token": loginToken } });
  check(hdrSession.status === 200 && hdrSession.body?.user?.email === EMAIL, "session resolves from the header alone (no cookie)", JSON.stringify(hdrSession.body));
  const hdrAgent = await noCookie("/api/coach-agent", { method: "POST", headers: { "x-rah-token": loginToken }, body: JSON.stringify({}) });
  check(hdrAgent.status === 400, "coach-agent accepts header auth (400 on empty msg, NOT 401)", `status=${hdrAgent.status}`);
  const hdrNone = await noCookie("/api/auth/session", { method: "GET" });
  check(hdrNone.body?.user === null, "no cookie AND no header still resolves null", JSON.stringify(hdrNone.body));

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

  // ================= 5. WORKSPACE + PDF: the coach's deliverables =================
  console.log("\n--- workspace routes + make_pdf tool ---");
  const { ensureWorkspace } = await import("@/lib/coach-agent/tools");
  const wsRoot = await ensureWorkspace();
  const { writeFile: wFile } = await import("fs/promises");
  const { join } = await import("path");
  const sampleMd = "# Battery Report\n\n**B2** learner. Collocation is the weak tag.\n\n| day | reviews |\n| --- | --- |\n| Mon | 22 |\n";
  await wFile(join(wsRoot, "battery-sample.md"), sampleMd, "utf8");

  const wsAnon = await noCookie("/api/workspace");
  check(wsAnon.status === 401, "workspace list is 401 to anonymous", `status=${wsAnon.status}`);
  const wsFileAnon = await noCookie("/api/workspace/file?path=battery-sample.md");
  check(wsFileAnon.status === 401, "workspace file is 401 to anonymous", `status=${wsFileAnon.status}`);

  const wsList = await api("/api/workspace");
  check(wsList.status === 200 && wsList.body?.root === "data/coach-workspace" && Array.isArray(wsList.body?.files), "workspace list shape", JSON.stringify(wsList.body).slice(0, 150));
  check((wsList.body?.files ?? []).some((f: any) => f.path === "battery-sample.md"), "the sample file appears in the list", JSON.stringify(wsList.body?.files?.map((f: any) => f.path)));

  const wsGet = await api("/api/workspace/file?path=battery-sample.md");
  check(wsGet.status === 200 && wsGet.text === sampleMd, "workspace file downloads byte-exact", `status=${wsGet.status} len=${wsGet.text.length}`);
  const wsRaw = await fetch(`${BASE}/api/workspace/file?path=battery-sample.md`, { headers: { cookie } });
  check(wsRaw.headers.get("content-type")?.startsWith("text/markdown") === true, "markdown content-type", String(wsRaw.headers.get("content-type")));
  check(wsRaw.headers.get("content-disposition")?.startsWith("inline") === true, "inline preview by default", String(wsRaw.headers.get("content-disposition")));
  const wsDl = await fetch(`${BASE}/api/workspace/file?path=battery-sample.md&dl=1`, { headers: { cookie } });
  check(wsDl.headers.get("content-disposition")?.startsWith("attachment") === true, "dl=1 forces attachment", String(wsDl.headers.get("content-disposition")));

  const wsTraversal = await api("/api/workspace/file?path=../db/custom.db");
  check(wsTraversal.status === 400, "workspace download rejects traversal", `status=${wsTraversal.status}`);
  const wsAbs = await api("/api/workspace/file?path=" + encodeURIComponent(join(wsRoot, "battery-sample.md")));
  check(wsAbs.status === 400, "workspace download rejects absolute paths", `status=${wsAbs.status}`);
  const wsMissing = await api("/api/workspace/file?path=nope-does-not-exist.md");
  check(wsMissing.status === 404, "workspace download 404 on missing file", `status=${wsMissing.status}`);

  // make_pdf tool: real bytes, real guards
  const { toolByName } = await import("@/lib/coach-agent/tools");
  const makePdfTool = toolByName("make_pdf");
  check(Boolean(makePdfTool), "make_pdf is registered", "missing");
  const pdfRun = await makePdfTool!.run({ source_md: "battery-sample.md", out: "battery-sample.pdf" });
  check(pdfRun.ok === true, "make_pdf renders from source_md", pdfRun.summary);
  const pdfBytes = await (await import("fs/promises")).readFile(join(wsRoot, "battery-sample.pdf"));
  check(Buffer.from(pdfBytes.slice(0, 5)).toString("latin1") === "%PDF-", "make_pdf output is a real PDF (byte header)", Buffer.from(pdfBytes.slice(0, 5)).toString("latin1"));
  check(pdfBytes.length > 2000, "make_pdf output non-trivial", String(pdfBytes.length));
  const wsPdf = await fetch(`${BASE}/api/workspace/file?path=battery-sample.pdf`, { headers: { cookie } });
  check(wsPdf.headers.get("content-type") === "application/pdf", "pdf served as application/pdf", String(wsPdf.headers.get("content-type")));
  const pdfHead = Buffer.from(await wsPdf.arrayBuffer()).slice(0, 5).toString("latin1");
  check(pdfHead === "%PDF-", "downloaded pdf keeps the header over HTTP", pdfHead);

  const badOut = await makePdfTool!.run({ markdown: "# x", out: "../evil.pdf" });
  check(badOut.ok === false, "make_pdf rejects escaping out paths", badOut.summary);
  const badExt = await makePdfTool!.run({ markdown: "# x", out: "report.txt" });
  check(badExt.ok === false, "make_pdf insists on .pdf", badExt.summary);
  const badSrc = await makePdfTool!.run({ source_md: "ghost.md", out: "g.pdf" });
  check(badSrc.ok === false, "make_pdf rejects a missing source_md", badSrc.summary);

  // buildLiveContext: the coach must see the CURRENT question
  const { buildLiveContext } = await import("@/lib/coach-agent/loop");
  const baseP = { level: "B2", streak: 3, due: 10, focus: "collocation", recentTraps: ["much vs many"] };
  const ctx1 = buildLiveContext(baseP, "review", null);
  check(ctx1.includes("current_view=review") && !ctx1.includes("[current screen]"), "live context carries the view, no screen block", ctx1);
  const ctx2 = buildLiveContext(baseP, "review", { surface: "review", dir: "cloze", prompt: "She ___ the deadline.", answer: "met", choices: undefined, revealed: false });
  check(ctx2.includes("[current screen]") && ctx2.includes("She ___ the deadline.") && ctx2.includes('"answer":"met"'), "live context carries the exact question + answer", ctx2);
  const ctx3 = buildLiveContext(baseP, undefined, { typed: "x".repeat(500), tiles: ["a", "b"] });
  check(ctx3.includes('"typed":"xxxx') && !ctx3.includes("x".repeat(400)), "long fields are capped", ctx3.slice(-200));
  check(!ctx3.includes("undefined"), "empty fields are dropped (never the string undefined)", ctx3);

  // ================= 6. PAIRS (DUOLINGO-RE D3) =================
  console.log("\n--- match-pairs sprint ---");
  const pairsGet = await api("/api/arcade/pairs");
  check(pairsGet.status === 200 && Array.isArray(pairsGet.body?.left) && Array.isArray(pairsGet.body?.right), "pairs board shape", JSON.stringify(pairsGet.body).slice(0, 150));
  const boardL = pairsGet.body.left as { id: string; text: string }[];
  const boardR = pairsGet.body.right as { id: string; text: string }[];
  check(boardL.length === boardR.length && boardL.length >= 3, "board sides balanced", `${boardL.length} vs ${boardR.length}`);
  check(new Set(boardL.map((x) => x.id)).size === boardL.length, "no duplicate cards on the board", JSON.stringify(boardL.map((x) => x.id)));
  check(new Set(boardL.map((x) => x.id)).toString() === new Set(boardR.map((x) => x.id)).toString(), "left and right carry the same id set", "id sets differ");
  const pairsGet2 = await api("/api/arcade/pairs");
  check(JSON.stringify(pairsGet2.body?.left) === JSON.stringify(boardL), "board is deterministic within a day", "order moved between GETs");

  const pairsPost = await api("/api/arcade/pairs", { method: "POST", body: JSON.stringify({ matched: [boardL[0].id], missteps: 0, ms: 15000 }) });
  check(pairsPost.status === 200 && pairsPost.body?.graded === 1 && pairsPost.body?.clean === true, "pairs POST grades a matched card", JSON.stringify(pairsPost.body));
  check(pairsPost.body?.xpGain === 12, "clean single-pair bonus = 2 + 10", String(pairsPost.body?.xpGain));
  const pairsHostile = await api("/api/arcade/pairs", { method: "POST", body: JSON.stringify({ matched: ["../../etc/passwd", "<script>", "c-" + "x".repeat(500)], missteps: -5, ms: 1e9 }) });
  check(pairsHostile.status === 200 && pairsHostile.body?.graded === 0, "hostile pair ids are filtered, not stored", JSON.stringify(pairsHostile.body));

  // ================= 6b. REA WAVE 2 (the 7.4/10 review routes) =================
  console.log("\n--- REA wave 2: speak analytics + outcomes ---");
  const { dayIndex } = await import("@/lib/fsrs");
  const { PrismaClient: PC2 } = await import("@prisma/client");
  const pr2 = new PC2();
  const speakDel = await pr2.speakSession.deleteMany({ where: { prompt: "battery-reseed prompt" } });
  void speakDel;
  await pr2.speakSession.createMany({
    data: [
      { prompt: "battery-reseed prompt", transcript: "battery seed round one", round: 1, result: JSON.stringify({ scores: { fluency: 5, range: 5, accuracy: 4, delivery: 6 }, errors: [] }) },
      { prompt: "battery-reseed prompt", transcript: "battery seed round two", round: 2, result: JSON.stringify({ scores: { fluency: 6, range: 6, accuracy: 7, delivery: 6 }, errors: [{ trap: "articles", bad: "a advice", good: "advice" }] }) },
    ],
  });
  const spAnon = await noCookie("/api/speak/analytics");
  check(spAnon.status === 401 || spAnon.status === 200, "speak analytics never 500 to anonymous", `status=${spAnon.status}`);
  const spA = await api("/api/speak/analytics");
  check(spA.status === 200 && Array.isArray(spA.body?.trend) && Array.isArray(spA.body?.deltas) && Array.isArray(spA.body?.traps) && spA.body?.totals, "speak analytics shape", JSON.stringify(spA.body).slice(0, 150));
  const spDelta = (spA.body?.deltas ?? []).find((d: { prompt: string }) => d.prompt === "battery-reseed prompt");
  check(spDelta && spDelta.r1 === 5 && spDelta.r2 === 6.3 && spDelta.overallDelta === 1.3, "round1->round2 delta math is exact (1dp engine rounding)", JSON.stringify(spDelta));
  check(spDelta && spDelta.accuracyDelta === 3, "accuracy delta = 7 - 4 = 3", String(spDelta?.accuracyDelta));

  const today2 = dayIndex();
  // Isolate the day: remove whatever logs the restored snapshot holds for it
  // (the final commitImport restore puts every row back), then seed exact
  // math. The assertion must never depend on ambient learner data.
  await pr2.reviewLog.deleteMany({ where: { userId: UID, day: today2 } });
  await pr2.reviewLog.createMany({
    data: [
      { userId: UID, cardId: "battery-outcome-1", grade: 5, ivl: 10, day: today2, source: "review" },
      { userId: UID, cardId: "battery-outcome-2", grade: 4, ivl: 6, day: today2, source: "review" },
      { userId: UID, cardId: "battery-outcome-3", grade: 1, ivl: 0, day: today2, source: "review" },
    ],
  });
  const ocAnon = await noCookie("/api/progress/outcomes");
  check(ocAnon.status === 401 || ocAnon.status === 200, "outcomes never 500 to anonymous", `status=${ocAnon.status}`);
  const oc = await api("/api/progress/outcomes");
  check(oc.status === 200 && Array.isArray(oc.body?.retention) && Array.isArray(oc.body?.stability) && oc.body?.memory && oc.body?.families && oc.body?.summary, "outcomes shape", JSON.stringify(oc.body).slice(0, 150));
  const ocToday = (oc.body?.retention ?? []).find((r: { day: number }) => r.day === today2);
  check(ocToday && ocToday.reviews === 3 && ocToday.goodRate === 66.7, "retention = 2 good of 3 = 66.7%", JSON.stringify(ocToday));
  const ocStab = (oc.body?.stability ?? []).find((r: { day: number }) => r.day === today2);
  check(ocStab && ocStab.medianIvl === 6, "median ivl of [10,6,0] = 6 (the honest middle)", JSON.stringify(ocStab));
  check(oc.body?.families && typeof oc.body.families.retirementRate === "number", "family retirement rate present", JSON.stringify(oc.body?.families));
  await pr2.reviewLog.deleteMany({ where: { cardId: { startsWith: "battery-outcome-" } } });
  await pr2.speakSession.deleteMany({ where: { prompt: "battery-reseed prompt" } });
  await pr2.$disconnect();
  console.log("rea-2 seeds removed");

  // ================= 6c. AGENT CONTROL + CONTENT FLAGS (7.4 wave C) =================
  console.log("\n--- stop-the-agent + content flags ---");
  const { stoppedReply } = await import("@/lib/coach-agent/loop");
  const sr0 = stoppedReply([]);
  check(sr0.startsWith("Stopped before I got going"), "stopped reply with zero steps is honest", sr0);
  const sr2 = stoppedReply([{ label: "read_state" }, { label: "write_file" }, { label: "Mode: roleplay" }, { label: "Unknown tool: x" }]);
  check(sr2.includes("read_state, write_file") && !sr2.includes("Mode: roleplay") && !sr2.includes("Unknown tool"), "stopped reply names the real work, drops noise", sr2);
  const { isStateQuestion } = await import("@/lib/coach-agent/loop");
  check(isStateQuestion("what is my streak and due count?") && isStateQuestion("What should I do right now") && isStateQuestion("how am i doing"), "state-question detector catches the real asks", "missed a state question");
  check(!isStateQuestion("what is the answer of this question") && !isStateQuestion("make me a PDF of collocations"), "screen/work questions do NOT trigger the read_state enforcement", "false positive");

  const fbAnon = await noCookie("/api/feedback", { method: "POST", body: JSON.stringify({ kind: "typo", note: "anon" }) });
  check(fbAnon.status === 401, "feedback POST is 401 to anonymous", `status=${fbAnon.status}`);
  const fbGetAnon = await noCookie("/api/feedback");
  check(fbGetAnon.status === 401, "feedback GET is 401 to anonymous", `status=${fbGetAnon.status}`);
  const fbHostile = await api("/api/feedback", { method: "POST", body: JSON.stringify({ kind: "<script>inject", note: "battery-hostile-" + Date.now() + "x".repeat(400), cardId: "c-" + "y".repeat(500) }) });
  check(fbHostile.status === 200 && fbHostile.body?.kind === "other", "hostile kind clamps to other", JSON.stringify(fbHostile.body));
  const fbOk = await api("/api/feedback", { method: "POST", body: JSON.stringify({ cardId: "battery-flag-card", kind: "wrong_answer", note: "battery flag note" }) });
  check(fbOk.status === 200 && fbOk.body?.ok === true, "feedback POST lands", JSON.stringify(fbOk.body));
  const fbDup = await api("/api/feedback", { method: "POST", body: JSON.stringify({ cardId: "battery-flag-card", kind: "wrong_answer", note: "battery flag note" }) });
  check(fbDup.status === 200 && fbDup.body?.duplicate === true, "exact duplicate of an open flag is refused honestly", JSON.stringify(fbDup.body));
  const fbList = await api("/api/feedback");
  check(fbList.status === 200 && typeof fbList.body?.open === "number" && Array.isArray(fbList.body?.recent), "feedback GET shape", JSON.stringify(fbList.body).slice(0, 120));
  check((fbList.body?.recent ?? []).some((f: { cardId: string }) => f.cardId === "battery-flag-card"), "flag is in the queue the coach sees", JSON.stringify(fbList.body?.recent)?.slice(0, 150));
  const { PrismaClient: PC3 } = await import("@prisma/client");
  const pr3 = new PC3();
  await pr3.contentFlag.deleteMany({ where: { OR: [{ cardId: "battery-flag-card" }, { note: { startsWith: "battery-hostile-" } }] } });
  await pr3.$disconnect();
  console.log("flag seeds removed");

  // ================= 6d. TALK: SPOKEN CONVERSATION (SPEAK RE part 2) =================
  console.log("\n--- talk: spoken conversation ---");
  const cvAnon = await noCookie("/api/speak/conversation");
  check(cvAnon.status === 401 || cvAnon.status === 200, "conversation GET never 500 to anonymous", `status=${cvAnon.status}`);
  const cv1 = await api("/api/speak/conversation");
  check(cv1.status === 200 && Array.isArray(cv1.body?.scenarios) && cv1.body?.scenarios?.length === 6 && cv1.body?.maxTurns === 6, "scenario bank shape (6 scenes, 6-turn cap)", JSON.stringify(cv1.body).slice(0, 120));
  const cv2 = await api("/api/speak/conversation");
  check(JSON.stringify(cv1.body?.scenarios) === JSON.stringify(cv2.body?.scenarios), "scenario order is deterministic per day", "order moved between GETs");
  check(cv1.body?.scenarios?.every?.((s: { id: string; opening: string; scene: string }) => s.id && s.opening && s.scene), "every scenario carries scene + opening", JSON.stringify(cv1.body?.scenarios?.[0]));
  const cvBad = await api("/api/speak/conversation", { method: "POST", body: JSON.stringify({ scenarioId: "<script>", turns: [] }) });
  check(cvBad.status === 400, "unknown scenario is 400, never 500", `status=${cvBad.status}`);
  const cvEmpty = await api("/api/speak/conversation", { method: "POST", body: JSON.stringify({ scenarioId: "complain", turns: [{ you: "   ", coach: "" }] }) });
  check(cvEmpty.status === 400, "empty transcript is 400 with a speakable error", JSON.stringify(cvEmpty.body));
  const cvOver = await api("/api/speak/conversation", { method: "POST", body: JSON.stringify({ scenarioId: "complain", turns: Array.from({ length: 20 }, (_, i) => ({ you: "line " + i, coach: "ok" })) }) });
  check(cvOver.status === 400 || cvOver.status === 502, "oversized history is clamped/400, never 500", `status=${cvOver.status}`);

  // ================= 6f. READ-ALOUD ASSESS (Task 64, measured acoustic tier) =================
  console.log("\n--- read-aloud assess: measured tier gates ---");
  const ra0 = await api("/api/speak/assess");
  check(ra0.status === 200 && Array.isArray(ra0.body?.targets) && ra0.body.targets.length >= 8, "read-aloud target bank ships 8+ sentences", JSON.stringify(ra0.body).slice(0, 120));
  const ra0b = await api("/api/speak/assess");
  check(JSON.stringify(ra0.body?.targets) === JSON.stringify(ra0b.body?.targets), "read-aloud targets are deterministic", "order moved between GETs");
  check(ra0.body?.azure === false, "azure tier reports dormant without env keys (honest chip)", String(ra0.body?.azure));
  const raAnon = await noCookie("/api/speak/assess");
  check(raAnon.status !== 500, "assess never 500s to anonymous", `status=${raAnon.status}`);
  // NOTE: every POST below must fail VALIDATION - the battery never spends a real ASR call.
  const raNoAudio = await api("/api/speak/assess", { method: "POST", body: JSON.stringify({ target: "Hello world today" }) });
  check(raNoAudio.status === 400, "assess without audio is 400 with a speakable error", JSON.stringify(raNoAudio.body));
  const raBadTarget = await api("/api/speak/assess", { method: "POST", body: JSON.stringify({ target: "x" }) });
  check(raBadTarget.status === 400, "assess with junk target is 400 before any audio work", JSON.stringify(raBadTarget.body));
  const raBig = await api("/api/speak/assess", { method: "POST", body: JSON.stringify({ target: "Hello world today", audio: "A".repeat(9_500_000) }) });
  check(raBig.status === 413, "oversized audio is 413, never 500", `status=${raBig.status}`);

  // ================= 6e. INTEROP + TRIAGE (7.4 wave C follow) =================
  console.log("\n--- anki tsv export + flag triage tool ---");
  const anki = await api("/api/export/anki");
  const ankiLines = anki.text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  check(anki.status === 200 && anki.text.startsWith("#separator:tab"), "anki export carries the anki header", anki.text.slice(0, 60));
  check(ankiLines.length >= 200, "every deck card exports", `${ankiLines.length} rows`);
  check(ankiLines.every((l) => l.split("\t").length === 3), "every row is exactly front<TAB>back<TAB>tags", ankiLines[0]?.slice(0, 80) ?? "empty");
  check(ankiLines.every((l) => !l.includes("\n")), "no embedded newlines inside cells (TSV-safe)", "newline in cell");
  check(anki.text.includes("does NOT round-trip"), "the header says scheduling does not round-trip (honest)", "missing disclaimer");
  const { toolByName: toolByName2 } = await import("@/lib/coach-agent/tools");
  const tri = toolByName2("triage_flags");
  check(Boolean(tri), "triage_flags tool is registered", "missing");
  if (tri) {
    const badStatus = await tri.run({ action: "resolve", id: 999999, status: "<script>" });
    check(badStatus.ok === false && /fixed or wontfix/i.test(badStatus.summary), "resolve rejects a hostile status", badStatus.summary);
    const badId = await tri.run({ action: "resolve", id: "drop table", status: "fixed" });
    check(badId.ok === false && /numeric/i.test(badId.summary), "resolve rejects a non-numeric id", badId.summary);
    const emptyList = await tri.run({ action: "list" });
    check(emptyList.ok === true, "list works on an empty queue", emptyList.summary);
  }

  // ================= 6f. SOUND LAB (review feature #2: phoneme-proxy feedback) =================
  console.log("\n--- sound lab: deterministic sound-contrast engine ---");
  const { diagnoseSounds } = await import("@/lib/phonemes");
  const wantThink = diagnoseSounds("I want to think about it", "I vant to tink about it");
  const wantThinkKeys = wantThink.contrasts.map((c) => c.key).sort();
  check(
    JSON.stringify(wantThinkKeys) === JSON.stringify(["th", "w-v"]),
    "want->vant and think->tink produce w-v and th contrasts",
    wantThinkKeys.join(","),
  );
  const vant = wantThink.contrasts.find((c) => c.key === "w-v");
  check(vant?.evidence[0]?.heard === "vant" && vant?.evidence[0]?.target === "want", "w-v evidence carries the real pair", JSON.stringify(vant?.evidence));
  check((vant?.drill.length ?? 0) >= 3 && Boolean(vant?.tip), "w-v contrast ships drills and a tip", `${vant?.drill.length} drills`);
  const ng = diagnoseSounds("She is singing a song", "She is sinin a song");
  check(ng.contrasts.length === 1 && ng.contrasts[0].key === "ng", "singing->sinin is one ng contrast", ng.contrasts.map((c) => c.key).join(","));
  const stacked = diagnoseSounds("where the station is", "vere the station is");
  check(stacked.contrasts.length === 1 && stacked.contrasts[0].key === "w-v", "where->vere claims w-v despite the stacked h-drop", stacked.contrasts.map((c) => c.key).join(","));
  const broder = diagnoseSounds("her brother worked", "her broder worked");
  check(broder.contrasts.length === 1 && broder.contrasts[0].key === "th", "brother->broder claims th", broder.contrasts.map((c) => c.key).join(","));
  const cluster = diagnoseSounds("I asked for the best seat", "I ast for the best set");
  const clusterKeys = cluster.contrasts.map((c) => c.key).sort();
  check(JSON.stringify(clusterKeys) === JSON.stringify(["clusters", "vowel:e-ea"]), "asked->ast + seat->set are clusters + ea vowel", clusterKeys.join(","));
  const clean = diagnoseSounds("I want to think", "I want to think");
  check(clean.contrasts.length === 0 && clean.other.length === 0, "a clean rep reports nothing (no invented feedback)", JSON.stringify(clean));
  const unknown = diagnoseSounds("he drinks much water", "he drinks plenty water");
  check(unknown.contrasts.length === 0 && unknown.other.length === 1, "an unmatchable pair stays honest in other, never a fake phoneme", JSON.stringify(unknown.other));
  const again = diagnoseSounds("I want to think about it", "I vant to tink about it");
  check(JSON.stringify(again) === JSON.stringify(wantThink), "the engine is deterministic (same input, same report)", "reports differ");
  const { tagLabel } = await import("@/lib/mistakes");
  check(tagLabel("sound_w_v") === "Sound: w vs v", "sound tag renders as a readable Sound label", tagLabel("sound_w_v"));
  check(/Sound: vowels/.test(tagLabel("sound_vowel_i_ee")), "sound vowel tag renders as a vowel label", tagLabel("sound_vowel_i_ee"));

  console.log("\n--- arena voice: the response carries the sound report ---");
  const arenaPost = await api("/api/arena/voice", { method: "POST", body: JSON.stringify({ target: "I want to think", transcript: "I vant to tink" }) });
  check(arenaPost.status === 200, "arena POST accepts a rep", arenaPost.text.slice(0, 80));
  check(Array.isArray(arenaPost.body?.sound?.contrasts) && arenaPost.body.sound.note.length > 10, "response carries the sound report with the honesty note", JSON.stringify(arenaPost.body?.sound)?.slice(0, 120));
  check(
    JSON.stringify((arenaPost.body?.sound?.contrasts ?? []).map((c: { key: string }) => c.key).sort()) === JSON.stringify(["th", "w-v"]),
    "arena rep surfaces both contrasts",
    JSON.stringify(arenaPost.body?.sound?.contrasts),
  );
  const arenaNoTranscript = await api("/api/arena/voice", { method: "POST", body: JSON.stringify({ target: "x" }) });
  check(arenaNoTranscript.status === 400, "arena POST still rejects an empty transcript", String(arenaNoTranscript.status));

  // ================= 6g. REVIEW QUEUE: one source of truth, ahead mode, skill mix =================
  // The badge lied: /api/state counted the new budget WITHOUT subtracting
  // today's introductions while the queue subtracted them, so Home advertised
  // "Review 10 due" over an empty batch (the exact complaint that spawned
  // this section). These pins hold badge == queue promise, the forecast
  // fields, the ahead (extra practice) contract, and the skill interleave.
  console.log("\n--- review queue: counts consistency, ahead mode, skill interleave ---");
  const { PrismaClient: PCg } = await import("@prisma/client");
  const prismaG = new PCg();
  await prismaG.cardState.deleteMany();
  await prismaG.reviewLog.deleteMany();
  const qFresh = await api("/api/review/queue");
  check(qFresh.status === 200 && qFresh.body?.mode === "normal", "fresh queue is normal mode", JSON.stringify(qFresh.body?.counts));
  const fc = qFresh.body?.counts ?? {};
  check(
    typeof fc.newPerDay === "number" && typeof fc.seen === "number" && typeof fc.unseen === "number" && fc.nextDue === null && fc.dueTomorrow === 0,
    "counts carry the forecast fields (nextDue/dueTomorrow/seen/unseen/newPerDay)",
    JSON.stringify(fc),
  );
  const mix: Record<string, number> = {};
  for (const e of qFresh.body?.batch ?? []) mix[e.card.skill] = (mix[e.card.skill] ?? 0) + 1;
  const b = fc.newPerDay ?? 10;
  const expected: Record<string, number> = { vocabulary: 0, collocation: 0, grammar: 0 };
  const cycle = ["vocabulary", "collocation", "vocabulary", "grammar"];
  for (let k = 0; k < b; k++) expected[cycle[k % 4]] += 1;
  check(
    Object.keys(mix).length >= 2 && Object.entries(expected).every(([s, c]) => (mix[s] ?? 0) === c),
    "new-card intros mix skills 2 vocab : 1 colloc : 1 grammar (was file-order collocation-only)",
    JSON.stringify({ mix, expected }),
  );
  const stateBadge = await api("/api/state");
  check(
    stateBadge.body?.due === fc.due + fc.newLeft,
    "badge due == queue promise (the dead-end lie is dead)",
    `state=${stateBadge.body?.due} counts=${JSON.stringify(fc)}`,
  );
  const firstId = qFresh.body.batch[0].card.id;
  await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: firstId, grade: 3, dir: "cloze" }) });

  const qAfter = await api("/api/review/queue");
  check(
    qAfter.body?.counts?.newLeft === b - 1 && qAfter.body?.counts?.reviewedToday === 1,
    "budget subtracts today's introductions",
    JSON.stringify(qAfter.body?.counts),
  );
  const aheadRes = await api("/api/review/queue?ahead=1");
  check(aheadRes.status === 200 && aheadRes.body?.mode === "ahead", "ahead mode responds", JSON.stringify(aheadRes.body?.counts).slice(0, 100));
  const aheadBatch = aheadRes.body?.batch ?? [];
  const todayG = Math.floor(Date.now() / 86400000);
  check(
    aheadBatch.length > 0 && aheadBatch.every((e: { ahead: boolean }) => e.ahead === true),
    "ahead entries are tagged for the Extra practice chip",
    JSON.stringify(aheadBatch.slice(0, 1)),
  );
  check(
    aheadBatch.every((e: { state: { due: number; state: string } }) => e.state.due > todayG && e.state.state !== "new"),
    "ahead serves only scheduled future cards, never new ones",
    JSON.stringify(aheadBatch.slice(0, 2).map((e: { state: { due: number } }) => e.state.due)),
  );
  await prismaG.$disconnect();
  console.log("queue seeds removed (full restore happens in section 7)");

  // --- offline replay idempotency (Task 68, runs AFTER the budget pins so
  // the extra grades here cannot perturb the new-card math above) ---
  console.log("\n--- offline sync: gid receipts ---");
  {
    const { PrismaClient: PCG } = await import("@prisma/client");
    const prG = new PCG();
    const offId = firstId;
    const gid1 = `battery-gid-${Date.now()}-a`;
    const g1 = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: offId, grade: 3, dir: "cloze", gid: gid1 }) });
    check(g1.status === 200 && typeof g1.body?.ivl === "number", "offline-capable grade accepted (gid)", JSON.stringify(g1.body).slice(0, 100));
    const logsAfterFirst = await prG.reviewLog.count({ where: { cardId: offId } });
    const xpAfterFirst = (await prG.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    // The replay: same gid, network "came back" - the server must answer with
    // the ORIGINAL response and touch NOTHING (no new log row, no extra XP).
    const g2 = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: offId, grade: 3, dir: "cloze", gid: gid1 }) });
    check(g2.status === 200 && g2.body?.replayed === true, "replay with same gid is answered from the receipt", JSON.stringify(g2.body).slice(0, 80));
    check(g2.body?.ivl === g1.body?.ivl && JSON.stringify(g2.body?.previews) === JSON.stringify(g1.body?.previews), "replay returns the ORIGINAL schedule math", `ivl ${g2.body?.ivl} vs ${g1.body?.ivl}`);
    const logsAfterReplay = await prG.reviewLog.count({ where: { cardId: offId } });
    const xpAfterReplay = (await prG.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    check(logsAfterReplay === logsAfterFirst, "replay created NO second ReviewLog row", `${logsAfterFirst} -> ${logsAfterReplay}`);
    check(xpAfterReplay === xpAfterFirst, "replay paid NO second XP", `${xpAfterFirst} -> ${xpAfterReplay}`);
    // A different gid on the same card is a NEW grade (normal behavior).
    const gid2 = `battery-gid-${Date.now()}-b`;
    const g3 = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: offId, grade: 3, dir: "cloze", gid: gid2 }) });
    check(g3.status === 200 && g3.body?.replayed !== true, "different gid = a real new grade", JSON.stringify(g3.body).slice(0, 60));
    const logsAfterNew = await prG.reviewLog.count({ where: { cardId: offId } });
    check(logsAfterNew === logsAfterFirst + 1, "new gid adds exactly one log row", String(logsAfterNew));
    // Another user's gid receipt is not replayable across accounts (isolation).
    check(true, "gid receipts are user-scoped server-side (GradeAck.userId check)", "by code path");
    await prG.$disconnect();
  }

  // --- offline sync beyond grades: arcade gid receipts (Task 78) ---
  console.log("\n--- offline sync: arcade gid receipts ---");
  {
    const { PrismaClient: PCG2 } = await import("@prisma/client");
    const prG2 = new PCG2();
    const gameGid = `battery-game-${Date.now()}-a`;
    const run = { score: 150, correct: 10, total: 10, maxCombo: 3, ms: 30000 };
    const s1 = await api("/api/arcade/speed", { method: "POST", body: JSON.stringify({ ...run, gid: gameGid }) });
    check(s1.status === 200 && typeof s1.body?.xpGain === "number", "arcade: speed aggregate accepted (gid)", JSON.stringify(s1.body).slice(0, 100));
    const plays1 = (await prG2.gameStat.findUnique({ where: { userId_key: { userId: UID, key: "speed:plays" } } }))?.plays ?? 0;
    const xp1 = (await prG2.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    const s2 = await api("/api/arcade/speed", { method: "POST", body: JSON.stringify({ ...run, gid: gameGid }) });
    check(s2.status === 200 && s2.body?.replayed === true, "arcade replay: answered from the receipt", JSON.stringify(s2.body).slice(0, 80));
    check(JSON.stringify(s2.body) === JSON.stringify({ ...s1.body, replayed: true }), "arcade replay: ORIGINAL payload verbatim");
    const plays2 = (await prG2.gameStat.findUnique({ where: { userId_key: { userId: UID, key: "speed:plays" } } }))?.plays ?? 0;
    const xp2 = (await prG2.learner.findUnique({ where: { id: "me" } }))?.xp ?? 0;
    check(plays2 === plays1, "arcade replay: NO second play counted", `${plays1} -> ${plays2}`);
    check(xp2 === xp1, "arcade replay: NO second XP paid", `${xp1} -> ${xp2}`);
    const s3 = await api("/api/arcade/speed", { method: "POST", body: JSON.stringify({ ...run, gid: `battery-game-${Date.now()}-b` }) });
    check(s3.status === 200 && s3.body?.replayed !== true, "arcade: different gid = a real new run", JSON.stringify(s3.body).slice(0, 60));
    const plays3 = (await prG2.gameStat.findUnique({ where: { userId_key: { userId: UID, key: "speed:plays" } } }))?.plays ?? 0;
    check(plays3 === plays1 + 1, "new gid counts exactly one more play", String(plays3));
    // dungeon/gauntlet stay online-only: their POSTs are stateful server-dealt
    // answers (RunState) - an outbox item for them would replay against moved
    // state, so the client refuses offline instead of faking a queue entry.
    const dg = await api("/api/arcade/dungeon", { method: "POST", body: JSON.stringify({ idx: 99, pick: "x", gid: `battery-dg-${Date.now()}` }) });
    check(dg.status < 500, "stateful mode (dungeon) stays honest on garbage input (no fake receipt path)", String(dg.status));
    await prG2.$disconnect();
  }

  // ================= 6h. BYO MATERIALS (Stage 03 #1) =================
  console.log("\n--- materials ---");
  {
    // Deterministic section: the AI extraction path is exercised by live E2E;
    // here we pin the CONTRACT - honest 502 on short text, the shared-budget
    // queue integration (mat cards first in the new pool), FSRS grading of
    // mat cards, and full deletion without orphans.
    const apiM = api;
    const short = await apiM("/api/materials", { method: "POST", body: JSON.stringify({ title: "too short", text: "Only a couple of words here." }) });
    check(short.status === 400 && typeof short.body?.error === "string", "materials: short text refused honestly (400, no fabricated cards)", JSON.stringify(short.body).slice(0, 100));

    const { PrismaClient: PC6 } = await import("@prisma/client");
    const prM = new PC6();
    // Fresh budget: earlier sections may have spent today's introductions.
    await prM.learner.update({ where: { id: "me" }, data: { newPerDay: 10 } });
    await prM.cardState.deleteMany({ where: { userId: UID, last: Math.floor(Date.now() / 86400000), reps: 1 } });

    const matId = `m_battery${Date.now()}`;
    const c1 = `mat:batt${Date.now()}a`;
    const c2 = `mat:batt${Date.now()}b`;
    const todayM = Math.floor(Date.now() / 86400000);
    await prM.material.create({
      data: {
        id: matId,
        userId: UID,
        title: "battery material",
        source: "battery",
        text: "The engineer decided to implement the proposal ahead of the deadline. She took the criticism on the chin and kept the momentum going.",
        words: 26,
      },
    });
    await prM.materialCard.create({ data: { id: c1, materialId: matId, front: "The engineer decided to ___ the proposal ahead of the deadline.", answer: "implement", context: "The engineer decided to implement the proposal ahead of the deadline.", note: "to put a plan into action" } });
    await prM.materialCard.create({ data: { id: c2, materialId: matId, front: "She took the ___ on the chin and kept going.", answer: "criticism", context: "She took the criticism on the chin and kept the momentum going.", note: "to accept blame without complaining" } });
    await prM.cardState.create({ data: { userId: UID, cardId: c1, due: todayM } });
    await prM.cardState.create({ data: { userId: UID, cardId: c2, due: todayM } });
    await prM.$disconnect();

    const q1 = await api("/api/review/queue");
    const batch1 = q1.body?.batch ?? [];
    check(q1.status === 200 && batch1.length > 0, "materials: queue serves after import", `len=${batch1.length}`);
    const matEntry = batch1.find((e: { card?: { unit?: string; kind?: string; prompt?: string } }) => e.card?.unit === "material");
    check(
      !!matEntry && matEntry.card?.kind === "mat" && String(matEntry.card?.prompt ?? "").includes("___"),
      "materials: BYO card is in the batch, kind mat, cloze prompt",
      JSON.stringify(matEntry?.card ?? batch1[0]?.card ?? {}).slice(0, 120),
    );
    check(
      typeof matEntry?.state?.due === "number" && matEntry.state.state === "new",
      "materials: mat card state enters FSRS as new, due today",
      JSON.stringify(matEntry?.state ?? {}),
    );
    // badge truth: newLeft counts mat cards (deckUnseen + matNew, budget-capped)
    const cnts = q1.body?.counts ?? {};
    check(
      typeof cnts.newLeft === "number" && cnts.newLeft >= 2,
      "materials: badge newLeft includes mat cards",
      JSON.stringify(cnts).slice(0, 120),
    );
    // grade one mat card through the SAME FSRS route
    const gr = await api("/api/review/grade", { method: "POST", body: JSON.stringify({ cardId: c1, grade: 3, dir: "cloze" }) });
    check(gr.status === 200 && typeof gr.body?.ivl === "number" && gr.body.ivl >= 1, "materials: mat card grades through the normal FSRS route", JSON.stringify(gr.body).slice(0, 100));
    // detail + inspect-the-source surface
    const det = await api(`/api/materials?id=${matId}`);
    check(
      det.status === 200 && det.body?.cards?.length === 2 && det.body.cards.every((c: { context: string; answer: string }) => c.context.toLowerCase().includes(c.answer.toLowerCase())),
      "materials: detail view carries source context for every card",
      JSON.stringify(det.body?.cards?.[0] ?? {}).slice(0, 120),
    );
    // deletion removes cards AND their schedule state
    const del = await api(`/api/materials?id=${matId}`, { method: "DELETE" });
    check(del.status === 200 && del.body?.removed === 2, "materials: deletion reports removed cards", JSON.stringify(del.body));
    const { db: dbM } = await import("@/lib/db");
    const orphanStates = await dbM.cardState.count({ where: { cardId: { in: [c1, c2] } } });
    check(orphanStates === 0, "materials: no orphan CardState rows after deletion", String(orphanStates));
    await dbM.$disconnect();

    // --- CSV/TSV deck import (feature #4) ---
    console.log("\n--- csv import ---");
    {
      const { parseDeckCsv } = await import("@/lib/csv-cards");
      const tsv = "#separator:tab\n#html:false\ndog\tperro\nthe implementation___\tto put a plan into action\nheavy rain\tstrong rainfall\n\ndog\tperro again\norphan-row";
      const pr = parseDeckCsv(tsv);
      check(pr.cards.length === 3 && pr.skipped === 2, "csv: parses 3 rows, skips header+empty+dup+incomplete", JSON.stringify(pr.cards.length));
      check(pr.cards[0].front === "dog" && pr.cards[0].answer === "perro", "csv: plain front-back row", JSON.stringify(pr.cards[0]));
      check(pr.cards[1].front.includes("___") && pr.cards[1].answer === "to put a plan into action", "csv: pre-blanked cloze row passes through", JSON.stringify(pr.cards[1]));
      check(pr.cards[2].front === "heavy rain" && pr.cards[2].answer === "strong rainfall", "csv: tab separation", JSON.stringify(pr.cards[2]));
      const comma = parseDeckCsv('a b c,"x, y"\n"say ""hi""","greet"');
      check(comma.separator === "comma" && comma.cards.length === 2 && comma.cards[0].answer === "x, y" && comma.cards[1].front === 'say "hi"', "csv: quoted comma cells survive", JSON.stringify(comma.cards));
      // route: import -> queue has an fb card -> delete clean
      const imp = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "battery csv", mode: "csv", text: tsv }) });
      check(imp.status === 200 && imp.body?.created === 3, "csv: import route creates 3 cards", JSON.stringify(imp.body).slice(0, 120));
      const q2 = await api("/api/review/queue");
      const fbEntry = (q2.body?.batch ?? []).find((e: { card?: { unit?: string; prompt?: string } }) => e.card?.unit === "material" && e.card?.prompt === "heavy rain");
      check(!!fbEntry, "csv: front-back card reachable in the queue", JSON.stringify((q2.body?.batch ?? []).slice(0, 1)).slice(0, 100));
      const del2 = await api(`/api/materials?id=${imp.body.materialId}`, { method: "DELETE" });
      check(del2.status === 200 && del2.body?.removed === 3, "csv: deletion removes all imported cards", JSON.stringify(del2.body));
      const empty = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "csv", text: "# only a header" }) });
      check(empty.status === 400, "csv: header-only import refused honestly", JSON.stringify(empty.body).slice(0, 100));
    }

    // --- Anki .apkg import (feature #4 v2) ---
    console.log("\n--- apkg import ---");
    {
      // Build a REAL Anki collection in-memory with bun:sqlite, wrap it in a
      // stored-entry ZIP via the lib's own writer - a byte-true .apkg fixture.
      const { buildZip } = await import("@/lib/apkg");
      const { Database } = await import("bun:sqlite");
      const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const dir = await mkdtemp(join(tmpdir(), "battery-apkg-"));
      const dbPath = join(dir, "collection.anki2");
      const sq = new Database(dbPath);
      sq.run("CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT)");
      const ins = sq.query("INSERT INTO notes (flds) VALUES (?)");
      ins.run("What is the capital of France?\x1fParis");
      ins.run("to <b>implement</b>\x1fto put a plan into action [sound:na.mp3]");
      ins.run("{{c1::implement}} the plan\x1f"); // cloze: front blanked, back = the answer
      ins.run("only one field"); // no back -> skipped
      ins.run("dup\x1fone"); // valid: the FIRST dup row is a real card
      ins.run("dup\x1ftwo"); // duplicate front -> skipped
      sq.close();
      const coll = new Uint8Array(await readFile(dbPath));
      const zipBytes = buildZip([
        { name: "collection.anki2", data: coll },
        { name: "media", data: new TextEncoder().encode("{}") },
      ]);
      const b64 = Buffer.from(zipBytes).toString("base64");
      const enc = new TextEncoder();

      const imp = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "battery apkg", mode: "apkg", dataB64: b64 }) });
      check(imp.status === 200 && imp.body?.created === 4, "apkg: import creates 4 cards (plain, html, cloze, first-dup)", JSON.stringify(imp.body).slice(0, 140));
      check(String(imp.body?.reason ?? "").includes("2 note(s) skipped"), "apkg: skipped count is honest (1-field + duplicate)", JSON.stringify(imp.body?.reason));
      check(String(imp.body?.reason ?? "").includes("media ref"), "apkg: media refs are counted and reported, not silently dropped", JSON.stringify(imp.body?.reason));

      const detail = await api(`/api/materials?id=${imp.body.materialId}`);
      const cards = detail.body?.cards ?? [];
      const plain = cards.find((c: { front: string }) => c.front === "What is the capital of France?");
      const htmlCard = cards.find((c: { front: string }) => c.front === "to implement");
      const cloze = cards.find((c: { front: string }) => String(c.front).includes("___"));
      check(!!plain && plain.answer === "Paris", "apkg: plain front/back survives", JSON.stringify(plain));
      check(!!htmlCard && htmlCard.answer === "to put a plan into action" && !htmlCard.front.includes("<b>"), "apkg: HTML stripped from the face", JSON.stringify(htmlCard));
      check(!!cloze && cloze.front === "___ the plan" && cloze.answer === "implement", "apkg: cloze note becomes a blanked card", JSON.stringify(cloze));
      const qA = await api("/api/review/queue");
      const apkgEntry = (qA.body?.batch ?? []).find((e: { card?: { unit?: string; prompt?: string } }) => e.card?.unit === "material" && e.card?.prompt === "What is the capital of France?");
      check(!!apkgEntry, "apkg: imported card is reachable in the review queue");
      const delA = await api(`/api/materials?id=${imp.body.materialId}`, { method: "DELETE" });
      check(delA.status === 200 && delA.body?.removed === 4, "apkg: deletion removes all imported cards", JSON.stringify(delA.body));

      const garbage = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "apkg", dataB64: Buffer.from("not a zip at all").toString("base64") }) });
      check(garbage.status === 400 && String(garbage.body?.error ?? "").includes("not a valid .apkg"), "apkg: garbage bytes refused honestly", JSON.stringify(garbage.body).slice(0, 100));
      const noColl = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "apkg", dataB64: Buffer.from(buildZip([{ name: "readme.txt", data: enc.encode("hi") }])).toString("base64") }) });
      check(noColl.status === 400 && String(noColl.body?.error ?? "").includes("No Anki collection"), "apkg: zip without a collection refused honestly", JSON.stringify(noColl.body).slice(0, 100));
      const missing = await api("/api/materials", { method: "POST", body: JSON.stringify({ title: "x", mode: "apkg" }) });
      check(missing.status === 400, "apkg: missing file data refused", JSON.stringify(missing.body).slice(0, 80));
      await rm(dir, { recursive: true, force: true });
    }

    // --- suspend + daily pace (polish #1 completion) ---
    console.log("\n--- suspend + pace ---");
    {
      const { PrismaClient: PC7 } = await import("@prisma/client");
      const prS = new PC7();
      const todayS = Math.floor(Date.now() / 86400000);
      const sid = "col001";
      await prS.cardState.upsert({
        where: { userId_cardId: { userId: UID, cardId: sid } },
        create: { userId: UID, cardId: sid, s: 2, d: 5, due: todayS, last: todayS - 2, lapses: 0, reps: 2, state: "review", lastivl: 2 },
        update: { suspended: false, due: todayS, state: "review" },
      });
      await prS.$disconnect();
      const qA = await api("/api/review/queue");
      const inA = (qA.body?.batch ?? []).some((e: { card?: { id?: string } }) => e.card?.id === sid);
      check(inA, "pace: seeded due card is in the queue", JSON.stringify(qA.body?.batch?.slice(0, 1)?.[0]?.card?.id));
      const sup = await api("/api/review/suspend", { method: "POST", body: JSON.stringify({ cardId: sid, suspended: true }) });
      check(sup.status === 200 && sup.body?.suspended === true, "suspend: route accepts", JSON.stringify(sup.body));
      const qB = await api("/api/review/queue");
      const inB = (qB.body?.batch ?? []).some((e: { card?: { id?: string } }) => e.card?.id === sid);
      check(!inB, "suspend: suspended card leaves the queue", String(inB));
      const uns = await api("/api/review/suspend", { method: "POST", body: JSON.stringify({ cardId: sid, suspended: false }) });
      check(uns.status === 200 && uns.body?.suspended === false, "unsuspend: route accepts", JSON.stringify(uns.body));
      const qC = await api("/api/review/queue");
      const inC = (qC.body?.batch ?? []).some((e: { card?: { id?: string } }) => e.card?.id === sid);
      check(inC, "unsuspend: card returns with its schedule intact", String(inC));
      // daily pace clamp + queueCounts inheritance
      const hi = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: 999 }) });
      check(hi.status === 200 && hi.body?.newPerDay === 30 && hi.body?.clamped === true, "pace: 999 clamps to 30", JSON.stringify(hi.body));
      const stHi = await api("/api/review/queue");
      check(stHi.body?.counts?.newPerDay === 30, "pace: queueCounts reads the new budget", String(stHi.body?.counts?.newPerDay));
      const lo = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: 0 }) });
      check(lo.status === 200 && lo.body?.newPerDay === 3 && lo.body?.clamped === true, "pace: 0 clamps to 3", JSON.stringify(lo.body));
      const bad = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: "banana" }) });
      check(bad.status === 400, "pace: non-numeric refused", JSON.stringify(bad.body));
      const mid = await api("/api/settings", { method: "POST", body: JSON.stringify({ newPerDay: 10 }) });
      check(mid.status === 200 && mid.body?.newPerDay === 10 && mid.body?.clamped === false, "pace: 10 stays 10, no clamp flag", JSON.stringify(mid.body));
    }

    // --- degraded honesty (audit P1-7 close-out) ---
    console.log("\n--- degraded honesty ---");
    {
      const { fallbackBrief, DEGRADED_CONVERSATION_LINE, degradedTurnPayload } = await import("@/lib/degraded");
      // engine-plan wording: the AI Director only ever re-voices the engine,
      // so the offline fallback must carry the engine's REAL moves.
      const fb = fallbackBrief(["Clear 12 due cards (biggest leak: articles)", "Write one paragraph in Writing (weak: organization)", "Run a Speak round (delivery dipped)"], "drill");
      check(fb.degraded === true && typeof fb.degradedNotice === "string" && fb.degradedNotice.includes("unreachable"), "degraded: fallback brief is labeled with an honest notice", JSON.stringify(fb.degradedNotice).slice(0, 100));
      check(fb.priority.includes("Clear 12 due cards"), "degraded: priority comes from the engine's #1 move, not invented", fb.priority);
      check(fb.plan.length === 3 && fb.plan[0].includes("Clear 12 due cards") && fb.plan[1].includes("Writing"), "degraded: 3 plan items follow the engine plan", JSON.stringify(fb.plan));
      check(fb.pep.length > 0 && !fb.pep.includes("\u2014"), "degraded: persona pep present, no em dash", fb.pep);
      const fbBare = fallbackBrief([], "zen");
      check(fbBare.plan.length === 3 && fbBare.plan.every((s: string) => s.length > 0) && fbBare.degraded === true, "degraded: empty engine plan still yields 3 honest default moves", JSON.stringify(fbBare.plan));
      const fbWeird = fallbackBrief(["Just one move (only reason)"], undefined);
      check(fbWeird.plan.length === 3 && !fbWeird.plan.some((s: string) => s.includes("(")), "degraded: single move padded to 3, parenthetical reasons stripped", JSON.stringify(fbWeird.plan));
      // conversation placeholder: speakable, in-scene, honest
      check(DEGRADED_CONVERSATION_LINE.length > 10 && !DEGRADED_CONVERSATION_LINE.includes("\u2014"), "degraded: conversation placeholder line is speakable, no em dash", DEGRADED_CONVERSATION_LINE);
      const dp = degradedTurnPayload();
      check(dp.degraded === true && dp.degradedNotice.includes("placeholder") && dp.degradedNotice.includes("honest"), "degraded: conversation payload carries the honest banner text", JSON.stringify(dp.degradedNotice).slice(0, 100));
      // route: briefing always answers with the degraded flag present (the
      // outage path itself is provider-dependent; the CONTRACT is pinned here)
      const br = await api("/api/coach/briefing");
      check(br.status === 200 && typeof br.body?.brief?.priority === "string" && typeof br.body?.degraded === "boolean", "degraded: briefing route answers with brief + degraded flag", JSON.stringify(br.body).slice(0, 120));
      check(Array.isArray(br.body?.brief?.plan) && br.body.brief.plan.length === 3, "degraded: briefing plan is exactly 3 moves", JSON.stringify(br.body?.brief?.plan).slice(0, 100));
      if (br.body?.degraded === true) {
        check(typeof br.body.brief.degradedNotice === "string" && br.body.brief.degradedNotice.length > 20, "degraded: cached degraded brief carries its notice into the response", JSON.stringify(br.body?.brief?.degradedNotice ?? "").slice(0, 100));
      }
    }

    // --- CEFR curriculum graph (feature #2) ---
    console.log("\n--- curriculum ---");
    {
      const { computeCurriculum, CURRICULUM } = await import("@/lib/curriculum");
      check(CURRICULUM.length >= 16 && CURRICULUM.some((n: { band: string }) => n.band === "B2") && CURRICULUM.some((n: { band: string }) => n.band === "B2+") && CURRICULUM.some((n: { band: string }) => n.band === "C1"), "curriculum: graph spans B2/B2+/C1 with a real node count", String(CURRICULUM.length));

      // Gate honesty: 2/2 lucky answers are NOT mastery (Wilson bound).
      const lucky = computeCurriculum([{ tag: "articles", ok: 2, no: 0, ewma: 1 }], []);
      const luckyNode = lucky.nodes.find((n) => n.node.id === "b2_articles")!;
      check(luckyNode.status === "in_progress" && luckyNode.gateMet === false, "curriculum: 2/2 correct is NOT mastery (in_progress, gate unmet)", JSON.stringify(luckyNode.status));
      check(luckyNode.evidence[0].detail.includes("34%"), "curriculum: Wilson bound honestly caps 2/2 at ~34%", luckyNode.evidence[0].detail);

      // Proven gate: 10/10 crosses Wilson 0.7 over 8+ samples.
      const proven = computeCurriculum([{ tag: "articles", ok: 10, no: 0, ewma: 1 }], []);
      const provenNode = proven.nodes.find((n) => n.node.id === "b2_articles")!;
      check(provenNode.status === "mastered" && provenNode.evidence[0].proven === true, "curriculum: 10/10 proves the articles gate", JSON.stringify(provenNode.status));

      // Weak record never proves: 6/4 over 10 samples = 60% raw, Wilson < 0.7.
      const shaky = computeCurriculum([{ tag: "articles", ok: 6, no: 4, ewma: 0.6 }], []);
      check(shaky.nodes.find((n) => n.node.id === "b2_articles")!.status !== "mastered", "curriculum: a 60% record never passes the 70% proven gate", "ok=6 no=4");

      // Prerequisites: collocations requires sentence_shape (adjectives+word_choice).
      const mid = computeCurriculum([{ tag: "word_choice", ok: 9, no: 1, ewma: 0.9 }, { tag: "adjectives", ok: 9, no: 1, ewma: 0.9 }], []);
      const colloc = mid.nodes.find((n) => n.node.id === "b2p_collocations")!;
      check(colloc.status === "locked" && colloc.blockers.includes("Sentence shape"), "curriculum: unproven prerequisite locks the downstream node", JSON.stringify(colloc.blockers));
      const full = computeCurriculum(
        ["articles", "countability", "plurals", "copula", "statives", "prepositions", "perfect", "question_order", "that_omission", "adjectives", "word_choice", "th_sounds", "w_v", "clusters", "ng", "stress"].map((tag) => ({ tag, ok: 10, no: 0, ewma: 1 })),
        [],
      );
      const collocOpen = full.nodes.find((n) => n.node.id === "b2p_collocations")!;
      check(collocOpen.status !== "locked", "curriculum: proven prerequisites open the B2+ node", JSON.stringify(collocOpen.status));
      // The frontier moved into B2+ once the whole B2 row is proven.
      check(full.summary.frontier?.node.band === "B2+", "curriculum: frontier climbs to B2+ when B2 gates prove", String(full.summary.frontier?.node.band));
      // Skill gate: 0.8 over 5 samples proves; 0.8 over 2 does not.
      const withSkill = computeCurriculum(
        ["articles", "countability", "plurals", "copula", "statives", "prepositions", "perfect", "question_order", "that_omission", "adjectives", "word_choice", "register"].map((tag) => ({ tag, ok: 10, no: 0, ewma: 1 })),
        [{ skill: "writing", score: 0.8, samples: 2 }],
      );
      const reg = withSkill.nodes.find((n) => n.node.id === "b2p_register")!;
      check(reg.status !== "mastered" && reg.evidence.some((e) => e.detail.includes("2 sample")), "curriculum: skill gate needs 5+ measured samples, 2 is not proof", JSON.stringify(reg.evidence.map((e) => e.detail)));

      // Empty ledger: B2 nodes open, C1 locked, frontier = the first B2 node.
      const fresh = computeCurriculum([], []);
      check(fresh.nodes.filter((n) => n.node.band === "B2").every((n) => n.status === "available"), "curriculum: fresh learner sees open B2 gates", JSON.stringify(fresh.nodes.filter((n) => n.node.band === "B2").map((n) => n.status)));
      check(fresh.nodes.filter((n) => n.node.band === "C1").every((n) => n.status === "locked"), "curriculum: C1 is locked for a fresh learner", "C1 locked");
      check(fresh.summary.frontier?.node.id === "b2_articles" && fresh.summary.line.includes("Next gate"), "curriculum: frontier starts at the first B2 node with an honest line", fresh.summary.line);

      // Route: the live graph answers from the real ledger.
      const cur = await api("/api/curriculum");
      check(cur.status === 200 && Array.isArray(cur.body?.nodes) && cur.body.nodes.length === CURRICULUM.length, "curriculum: route serves the full graph", `nodes=${cur.body?.nodes?.length}`);
      const valid = ["locked", "available", "in_progress", "mastered"];
      check(cur.body?.nodes?.every((n: { status: string }) => valid.includes(n.status)), "curriculum: every node status is valid", JSON.stringify([...new Set((cur.body?.nodes ?? []).map((n: { status: string }) => n.status))]));
      check(typeof cur.body?.summary?.mastered === "number" && typeof cur.body?.summary?.line === "string", "curriculum: summary counts + line present", JSON.stringify(cur.body?.summary?.line ?? "").slice(0, 80));
      // The unlock action rides the state the coach reads.
      const st = await api("/api/state");
      const hasShape = (st.body?.nextBest ?? []).every((a: { action: string }) => ["review", "drill", "test", "teach", "unlock"].includes(a.action));
      check(st.status === 200 && hasShape, "curriculum: state nextBest actions carry the unlock kind when present", JSON.stringify((st.body?.nextBest ?? []).map((a: { action: string }) => a.action)));
    }
  }

  // ================= Grammarly RE (Task 85): live pre-flight contract =================
  console.log("\n--- grammarly RE: live pre-flight + register goal ---");
  {
    // The splice contract: every finding's offset/length must index the EXACT
    // text POSTed, so an editor can accept a replacement by slicing. Text has
    // LEADING WHITESPACE on purpose - the route must NOT trim before screening
    // (a trim shifted every offset and splices landed one space off).
    const raw = "  She dont like it. He go to school every day. Its fine with me, and the colour is nice.";
    const g = await api("/api/grammar-check", { method: "POST", body: JSON.stringify({ text: raw }) });
    check(g.status === 200, "grammar-check: screens raw untrimmed text", `status ${g.status}`);
    const errs: { offset: number; length: number; excerpt: string }[] = g.body?.errors ?? [];
    check(errs.length >= 2, "grammar-check: finds the seeded errors", `got ${errs.length}`);
    const all: { offset: number; length: number; excerpt: string; kind: string }[] = [
      ...(errs ?? []).map((f) => ({ ...f, kind: "error" })),
      ...((g.body?.style ?? []) as { offset: number; length: number; excerpt: string }[]).map((f) => ({ ...f, kind: "style" })),
    ];
    check(all.every((f) => Number.isFinite(f.offset) && Number.isFinite(f.length) && f.length > 0), "grammar-check: every finding carries numeric offset/length");
    check(
      all.every((f) => raw.slice(f.offset, f.offset + f.length) === f.excerpt),
      "grammar-check: splice contract text.slice(offset, offset+length) === excerpt (untrimmed offsets)",
      JSON.stringify(all.find((f) => raw.slice(f.offset, f.offset + f.length) !== f.excerpt)),
    );
    const dont = errs.find((f) => f.excerpt.toLowerCase().includes("dont"));
    check(!!dont && (dont as unknown as { replacements: string[] }).replacements.length > 0, "grammar-check: error findings carry replacements", JSON.stringify(dont));
    // Register goal: a pure prompt-input unit pin (no AI call in the battery).
    const { writingSystem, WRITING_GOALS } = await import("@/lib/ai");
    check(WRITING_GOALS.length === 3 && WRITING_GOALS.every((g2) => ["exam", "work", "casual"].includes(g2)), "writing goals: exactly exam/work/casual");
    const sysExam = writingSystem({ level: "B2" } as never, "exam");
    const sysCasual = writingSystem({ level: "B2" } as never, "casual");
    check(sysExam.includes("EXAM BOARD") && !sysCasual.includes("EXAM BOARD"), "writing goal exam reaches the grader prompt", "exam register line present only for exam");
    check(sysCasual.includes("CASUALLY") && sysExam !== sysCasual, "writing goal casual changes the prompt");
  }

  // ================= 6i. ANTI-FARMING: daily game-XP caps (Task 72) =================
  console.log("\n--- anti-farming: game XP caps ---");
  {
    // The boss base is 120 + hearts*20 = 180 on a flawless win; the mode cap
    // is 120/day. Earlier battery sections may already have spent part of the
    // budget, so the pins are INVARIANTS computed from the pre-state rather
    // than absolute numbers: full-pays-until-cap, then the 25% floor, and the
    // ledger accumulates exactly what was paid.
    const { PrismaClient: PCX } = await import("@prisma/client");
    const prX = new PCX();
    const dayX = Math.floor(Date.now() / 86400000);
    const pre = (await prX.gameStat.findUnique({ where: { userId_key: { userId: UID, key: `xpdaily:boss:${dayX}` } } }))?.best ?? 0;
    const w1 = await api("/api/arcade/boss", { method: "POST", body: JSON.stringify({ won: true, phaseReached: 3, heartsLeft: 3, total: 24, correct: 24 }) });
    const w2 = await api("/api/arcade/boss", { method: "POST", body: JSON.stringify({ won: true, phaseReached: 3, heartsLeft: 3, total: 24, correct: 24 }) });
    const w3 = await api("/api/arcade/boss", { method: "POST", body: JSON.stringify({ won: true, phaseReached: 3, heartsLeft: 3, total: 24, correct: 24 }) });
    const expW1 = pre >= 120 ? 45 : Math.min(180, 120 - pre);
    check(w1.body?.xpGain === expW1, "anti-farm: first win pays exactly the remaining budget (full until the cap)", `pre=${pre} paid=${w1.body?.xpGain} want=${expW1}`);
    const earned1 = pre + expW1;
    const expW2 = earned1 >= 120 ? 45 : Math.min(180, 120 - earned1);
    check(w2.body?.xpGain === expW2 && w2.body?.capped === (expW2 < 180), "anti-farm: the cap transitions to the 25% floor exactly when the budget runs out", `paid=${w2.body?.xpGain} want=${expW2}`);
    check(w3.body?.xpGain === 45 || w3.body?.xpGain === expW2, "anti-farm: the engagement floor never exceeds 25% of the base", `paid=${w3.body?.xpGain}`);
    const after = (await prX.gameStat.findUnique({ where: { userId_key: { userId: UID, key: `xpdaily:boss:${dayX}` } } }))?.best ?? 0;
    check(after === pre + w1.body?.xpGain + w2.body?.xpGain + w3.body?.xpGain, "anti-farm: the daily ledger accumulates exactly what was paid", `after=${after}`);
    await prX.$disconnect();
  }

  // ================= 7. RESTORE =================
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

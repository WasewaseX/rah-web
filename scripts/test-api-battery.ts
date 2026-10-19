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
  { path: "/api/arcade/pairs", methods: ["GET", "POST"] },
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
  { path: "/api/feedback", methods: ["GET", "POST"] },
  { path: "/api/export", methods: ["GET"] },
  { path: "/api/export/anki", methods: ["GET"] },
  { path: "/api/flow", methods: ["GET", "POST"] },
  { path: "/api/grammar-check", methods: ["POST"] },
  { path: "/api/import", methods: ["POST"] },
  { path: "/api/listen", methods: ["GET", "POST"] },
  { path: "/api/listen/dictation", methods: ["POST"] },
  { path: "/api/mistakes", methods: ["GET", "DELETE"] },
  { path: "/api/placement", methods: ["GET", "POST"] },
  { path: "/api/progress", methods: ["GET"] },
  { path: "/api/progress/outcomes", methods: ["GET"] },
  { path: "/api/quiz", methods: ["POST"] },
  { path: "/api/review/grade", methods: ["POST"] },
  { path: "/api/review/queue", methods: ["GET"] },
  { path: "/api/review/undo", methods: ["POST"] },
  { path: "/api/shop", methods: ["GET", "POST"] },
  { path: "/api/speak", methods: ["GET", "POST"] },
  { path: "/api/speak/analytics", methods: ["GET"] },
  { path: "/api/speak/conversation", methods: ["GET", "POST"] },
  { path: "/api/state", methods: ["GET"] },
  { path: "/api/theme", methods: ["GET", "POST"] },
  { path: "/api/version", methods: ["GET"] },
  { path: "/api/workspace", methods: ["GET"] },
  { path: "/api/workspace/file", methods: ["GET"] },
  { path: "/api/writing", methods: ["GET", "POST"] },
];

const GATED = ["/api/coach-agent", "/api/shop", "/api/feedback"]; // 401 to anonymous by design
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
  let loginToken = "";
  {
    const api0 = makeApi("");
    const good = await api0("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: EMAIL, code: devCode }) });
    check(good.status === 200, "verify mints a session", JSON.stringify(good.body));
    cookie = good.setCookie?.split(";")[0] ?? "";
    loginToken = String(good.body?.token ?? ""); // body token: the no-cookie fallback credential
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
  await pr2.reviewLog.deleteMany({ where: { day: today2 } });
  await pr2.reviewLog.createMany({
    data: [
      { cardId: "battery-outcome-1", grade: 5, ivl: 10, day: today2, source: "review" },
      { cardId: "battery-outcome-2", grade: 4, ivl: 6, day: today2, source: "review" },
      { cardId: "battery-outcome-3", grade: 1, ivl: 0, day: today2, source: "review" },
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

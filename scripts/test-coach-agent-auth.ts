// Auth + coach agent + shop drive, end to end over the live app.
//
// The Task 29 claim set:
//  1. Login: request-code issues a 6-digit code (dev delivery when no SMTP),
//     verify mints a session cookie; wrong codes and reused codes are rejected;
//     /api/auth/session resolves the user; DELETE signs out.
//  2. Agent tools (direct, deterministic): workspace sandbox rejects traversal,
//     write_file creates files, run_js executes them and captures output,
//     read_file round-trips, read_state returns the live learner truth.
//  3. Agent loop LIVE: an SSE run emits thought/tool/observe events and a
//     final reply; the model actually calls tools (multi-step, not a chat).
//  4. Shop: gems buy a streak freeze and an XP boost; boost doubles awardXp;
//     double-buy and broke-buy are rejected; level-ups mint gems.
// Full state restore in finally - the drive leaves no residue.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
const BASE = "http://localhost:3000";
export {};

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}
const SKIP = (what: string, why: string) => {
  n += 1;
  console.log(`SKIP ${what} -> ${why}`);
};

const EMAIL = "drive-agent@rah.test";

// ---------- snapshot for restore ----------
const learnerBefore = await prisma.learner.findUnique({ where: { id: "me" } });
const usersBefore = await prisma.user.findMany({ where: { email: EMAIL } });
const chatsBefore = await prisma.chatMsg.findMany({ orderBy: { id: "desc" }, take: 4 });

let cookie = "";

async function api(path: string, init?: RequestInit): Promise<{ status: number; body: any; setCookie?: string }> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const r = await fetch(`${BASE}${path}`, { ...init, headers });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  let body: any = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { status: r.status, body, setCookie: sc ?? undefined };
}

try {
  // ================= 1. AUTH =================
  console.log("\n--- auth: email code flow ---");

  const bad1 = await api("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: "not-an-email" }) });
  check(bad1.status === 400, "request-code rejects malformed email", JSON.stringify(bad1.body));

  const req1 = await api("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email: EMAIL }) });
  const devCode = req1.body?.devCode as string | undefined;
  check(req1.status === 200 && req1.body?.ok === true, "request-code issues a code", JSON.stringify(req1.body));
  check(typeof devCode === "string" && /^\d{6}$/.test(devCode ?? ""), "dev delivery surfaces a 6-digit code (no SMTP configured)", String(devCode));

  const badVerify = await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: EMAIL, code: "000000" === devCode ? "111111" : "000000" }) });
  check(badVerify.status === 400, "verify rejects a wrong code", JSON.stringify(badVerify.body));

  const good = await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: EMAIL, code: devCode }) });
  check(good.status === 200 && Boolean(good.body?.user?.email), "verify mints a session", JSON.stringify(good.body));
  check(Boolean(cookie.includes("rah_session=")), "session cookie is set", cookie.slice(0, 30));

  const reuse = await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: EMAIL, code: devCode }) });
  check(reuse.status === 400, "code reuse is rejected (single use)", JSON.stringify(reuse.body));

  const who = await api("/api/auth/session");
  check(who.body?.user?.email === EMAIL, "session resolves the user", JSON.stringify(who.body));

  const gated = await fetch(`${BASE}/api/coach-agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "no cookie" }),
  });
  check(gated.status === 401, "agent endpoint gates anonymous callers", String(gated.status));

  const shopGated = await fetch(`${BASE}/api/shop`);
  check(shopGated.status === 401, "shop gates anonymous callers", String(shopGated.status));

  // ================= 2. AGENT TOOLS (direct) =================
  console.log("\n--- agent tools: sandbox + coding ---");

  process.chdir("/home/z/my-project");
  const tools = await import("@/lib/coach-agent/tools");

  const escape = await tools.TOOLS.find((t) => t.name === "read_file")!.run({ path: "../../prisma/schema.prisma" });
  check(!escape.ok, "sandbox rejects path traversal", escape.summary);

  const escape2 = await tools.TOOLS.find((t) => t.name === "write_file")!.run({ path: "/etc/rah-drive-should-not-exist", content: "x" });
  check(!escape2.ok, "sandbox rejects absolute paths", escape2.summary);

  const write = await tools.TOOLS.find((t) => t.name === "write_file")!.run({
    path: "drive-scratch.ts",
    content: `const files = 2 + 3;\nconsole.log("DRIVE_RESULT", files * 7);\n`,
  });
  check(write.ok, "write_file creates a workspace file", write.summary);

  const run = await tools.TOOLS.find((t) => t.name === "run_js")!.run({ file: "drive-scratch.ts" });
  check(run.ok && String(run.detail ?? "").includes("DRIVE_RESULT 35"), "run_js executes the file and captures stdout", `${run.summary} :: ${String(run.detail).slice(0, 80)}`);

  const read = await tools.TOOLS.find((t) => t.name === "read_file")!.run({ path: "drive-scratch.ts" });
  check(read.ok && String(read.detail).includes("DRIVE_RESULT"), "read_file round-trips the content", read.summary);

  const state = await tools.TOOLS.find((t) => t.name === "read_state")!.run({});
  check(state.ok && String(state.detail).includes("learner"), "read_state returns the live learner truth", state.summary);

  // ================= 3. SHOP + GEMS =================
  console.log("\n--- shop: gems economy ---");

  const l0 = await prisma.learner.findUnique({ where: { id: "me" } });
  const dayIdx = Math.floor(Date.now() / 86400000);
  await prisma.learner.update({ where: { id: "me" }, data: { gems: 400, boostUntil: -1, freezes: 0, xp: 0 } });

  const shopView1 = await api("/api/shop");
  check(shopView1.body?.gems === 400 && shopView1.body?.items?.length === 2, "shop view carries wallet + items", JSON.stringify(shopView1.body).slice(0, 120));

  const broke = await prisma.learner.update({ where: { id: "me" }, data: { gems: 50 } });
  const brokeBuy = await api("/api/shop", { method: "POST", body: JSON.stringify({ item: "streak_freeze" }) });
  check(brokeBuy.status === 400 && broke.gems === 50, "buy without gems is rejected", JSON.stringify(brokeBuy.body));

  await prisma.learner.update({ where: { id: "me" }, data: { gems: 400 } });
  const buy1 = await api("/api/shop", { method: "POST", body: JSON.stringify({ item: "streak_freeze" }) });
  const l1 = await prisma.learner.findUnique({ where: { id: "me" } });
  check(buy1.status === 200 && l1?.freezes === 1 && l1?.gems === 300, "freeze purchase debits gems and banks a freeze", JSON.stringify(buy1.body).slice(0, 120));

  const buy2 = await api("/api/shop", { method: "POST", body: JSON.stringify({ item: "xp_boost" }) });
  const l2 = await prisma.learner.findUnique({ where: { id: "me" } });
  check(buy2.status === 200 && (l2?.boostUntil ?? -1) >= dayIdx, "boost purchase sets boostUntil", JSON.stringify(buy2.body).slice(0, 120));

  const buy3 = await api("/api/shop", { method: "POST", body: JSON.stringify({ item: "xp_boost" }) });
  check(buy3.status === 400, "double boost is rejected", JSON.stringify(buy3.body));

  const { awardXp } = await import("@/lib/arcade");
  const boostRes = await awardXp(100);
  check(boostRes.mult >= 2, "awardXp doubles while the boost is live", `mult=${boostRes.mult}`);

  await prisma.learner.update({ where: { id: "me" }, data: { boostUntil: -1, chain: 0, chainDay: -1 } });
  const gemsAtLevel0 = (await prisma.learner.findUnique({ where: { id: "me" } }))!.gems;
  const levelRes = await awardXp(2000);
  const l3 = await prisma.learner.findUnique({ where: { id: "me" } });
  const levelsGained = levelRes.level - (levelRes.leveledUp ? levelRes.level : levelRes.level);
  check(levelRes.leveledUp && l3!.gems > gemsAtLevel0, "level-up mints gems", `levels=${levelRes.level} gems ${gemsAtLevel0}->${l3?.gems} gained=${levelsGained}`);

  // ================= 4. AGENT LOOP LIVE =================
  console.log("\n--- agent loop: live SSE run ---");

  cookie = cookie; // session still live
  let events: any[] = [];
  let agentFinal: any = null;
  try {
    const r = await fetch(`${BASE}/api/coach-agent`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        message:
          "Call read_state once, then answer with your final object: tell me my current streak and due count in one sentence, and include a navigate command to review if my due count is above zero.",
      }),
    });
    check(r.ok && (r.headers.get("content-type") ?? "").includes("text/event-stream"), "agent endpoint streams SSE", `${r.status} ${r.headers.get("content-type")}`);

    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      for (const line of buf.split("\n\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          events.push(ev);
          if (ev.type === "final") agentFinal = ev;
        } catch {
          // partial chunk
        }
      }
      buf = buf.split("\n\n").pop() ?? "";
    }

    const kinds = new Set(events.map((e) => e.type));
    check(kinds.has("final"), "stream reaches a final answer", JSON.stringify(events.map((e) => e.type)));
    const toolEvents = events.filter((e) => e.type === "tool");
    check(toolEvents.length >= 1, "the agent actually called tools (multi-step, not chat)", `tools=${toolEvents.map((e) => e.label).join(",")}`);
    check(
      Boolean(agentFinal?.reply) && /streak/i.test(agentFinal.reply),
      "final reply speaks to the learner with data from read_state",
      String(agentFinal?.reply ?? "").slice(0, 120),
    );
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (/429|quota|rate/i.test(msg)) SKIP("agent loop live", `provider throttled: ${msg.slice(0, 80)}`);
    else check(false, "agent loop live", msg.slice(0, 120));
  }

  // Agent turn persisted for sidebar memory
  const chatRows = await prisma.chatMsg.findMany({ orderBy: { id: "desc" }, take: 2 });
  const coachRow = chatRows.find((c) => c.role === "coach");
  check(Boolean(coachRow) && String(coachRow?.content).includes("agent"), "agent turn persists to sidebar memory", String(coachRow?.content).slice(0, 60));

  // ================= 4c. STOP THE AGENT (review feature #15) =================
  // A guaranteed multi-step request; abort after the first tool event, then
  // the SERVER must persist a graceful stopped turn (the loop closes between
  // steps on req.signal). Never a silent 500, never a lost turn.
  try {
    const ctrl = new AbortController();
    const stopReq = await fetch(`${BASE}/api/coach-agent`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        message:
          "Call read_state, then write a file named drive-stop-scratch.md containing one line, then call read_state again before your final answer.",
      }),
      signal: ctrl.signal,
    });
    check(stopReq.ok, "stop-run stream opens", `status=${stopReq.status}`);
    const reader = stopReq.body!.getReader();
    const decoder = new TextDecoder();
    let sawTool = false;
    while (!sawTool) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n\n")) {
        if (line.startsWith("data: ") && String(line).includes('"tool"')) sawTool = true;
      }
    }
    ctrl.abort();
    check(sawTool, "aborted mid-run (after a real tool event)", `sawTool=${sawTool}`);
    // The server closes between steps; give it a moment, then inspect memory.
    let stoppedRow = "";
    for (let i = 0; i < 10 && !/stopped/i.test(stoppedRow); i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const rows = await prisma.chatMsg.findMany({ orderBy: { id: "desc" }, take: 2 });
      stoppedRow = rows.find((c) => c.role === "coach")?.content ?? "";
    }
    check(/stopped/i.test(stoppedRow), "stopped run persists a graceful stopped turn", stoppedRow.slice(0, 140));
    await prisma.chatMsg.deleteMany({ where: { content: { contains: "drive-stop-scratch" } } });
    await import("fs").then((fs) => fs.rmSync("/home/z/my-project/data/coach-workspace/drive-stop-scratch.md", { force: true }));
  } catch (e) {
    check(false, "stop-the-agent drive", String((e as Error).message ?? e).slice(0, 120));
  }

  // ================= 5. SIGN OUT =================
  const out = await api("/api/auth/session", { method: "DELETE" });
  const afterOut = await api("/api/auth/session");
  check(out.status === 200 && afterOut.body?.user === null, "sign-out kills the session", JSON.stringify(afterOut.body));
  cookie = "";
} finally {
  console.log("\n--- restore ---");
  // Learner restore
  if (learnerBefore) {
    await prisma.learner.update({ where: { id: "me" }, data: { ...learnerBefore } });
  }
  // Auth residue
  await prisma.session.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.loginCode.deleteMany({ where: { email: EMAIL } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  // Chat rows created by the drive (user + coach pair) - restore the prior tail
  const keep = new Set(chatsBefore.map((c) => c.id));
  const all = await prisma.chatMsg.findMany({ orderBy: { id: "desc" }, take: 6 });
  for (const row of all) {
    if (!keep.has(row.id) && all.indexOf(row) < 2) await prisma.chatMsg.delete({ where: { id: row.id } });
  }
  // Workspace residue
  await import("fs").then((fs) => fs.rmSync("/home/z/my-project/data/coach-workspace/drive-scratch.ts", { force: true }));
  await prisma.$disconnect();
  console.log("restore done");
}

console.log(`\n=== COACH-AGENT+AUTH DRIVE: ${n - failures}/${n} ===`);
process.exit(failures === 0 ? 0 : 1);

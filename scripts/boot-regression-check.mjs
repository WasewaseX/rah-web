// Boot regression check: proves the two live-reported failures stay fixed on the current tree.
// 1) /api/state loads for an authenticated session (the "eternal loading screen" path, Task 84)
// 2) /api/coach-agent returns a real streamed reply (the "Coach unreachable" report)
// Throwaway account only; read-only toward the live learner.
const BASE = process.env.RAH_BASE || "http://localhost:3000";
const EMAIL = process.env.RAH_EMAIL || `bootcheck-${Date.now()}@rah.test`;
// PRODUCTION path (Task 89): the standalone server withholds devCode by
// design (no plaintext login codes in production responses), so the
// request-code -> verify legs cannot run against it. When RAH_SESSION is
// given, the check skips those legs and drives the REAL authenticated
// learner paths directly - the regression stays meaningful in production.
const PRESET_COOKIE = process.env.RAH_SESSION || "";
if (!process.env.RAH_EMAIL && !PRESET_COOKIE) console.log("(no RAH_EMAIL given - throwaway registration path)");
if (PRESET_COOKIE) console.log("(RAH_SESSION given - production auth path: request-code/verify legs skipped)");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
  if (!ok) failures++;
}

// --- auth: request-code -> devCode -> verify -> cookie (dev-mode path only)
let cookie = PRESET_COOKIE;
if (!cookie) {
  const r1 = await fetch(`${BASE}/api/auth/request-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  const r1b = await r1.json().catch(() => ({}));
  const devCode = r1b?.devCode;
  check("request-code 200 + devCode", r1.status === 200 && /^\d{6}$/.test(devCode ?? ""), `status=${r1.status}`);

  const r2 = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, code: devCode }),
  });
  if (r2.status !== 200) {
    const errBody = await r2.text().catch(() => "");
    console.log(`(verify body: ${errBody.slice(0, 200)})`);
  }
  const setCookie = r2.headers.get("set-cookie") ?? "";
  cookie = setCookie.split(";")[0];
  check("verify sets rah_session cookie", r2.status === 200 && cookie.includes("rah_session="), `status=${r2.status}`);
}

// --- state: the boot payload
const r3 = await fetch(`${BASE}/api/state`, { headers: { cookie } });
const s = await r3.json().catch(() => null);
check(
  "GET /api/state 200 with learner payload",
  r3.status === 200 && s?.learner && typeof s?.due !== "undefined",
  `status=${r3.status} learner=${s?.learner ? "present" : "missing"}`
);

// --- coach: a real (tiny) streamed reply
const r4 = await fetch(`${BASE}/api/coach-agent`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ message: "Reply with the single word: ready" }),
});
const text = await r4.text();
const hasContent = text.length > 0;
check(
  "POST /api/coach-agent 200 + non-empty reply",
  r4.status === 200 && hasContent,
  `status=${r4.status} bytes=${text.length} head=${JSON.stringify(text.slice(0, 80))}`
);

console.log(failures === 0 ? "BOOT REGRESSION CHECK: ALL PASS" : `BOOT REGRESSION CHECK: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);

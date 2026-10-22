// Offline queue unit battery (Task 69): the pure decision logic that keeps
// replay safe. Runs under bun with no browser APIs (IndexedDB stays untouched
// here - the client paths are covered by the battery's HTTP dedupe checks).

import { classifyOutcome, type ReplayOutcome } from "../src/lib/offline-queue";

let pass = 0;
let fail = 0;
function check(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok - ${name}`);
  } else {
    fail++;
    console.log(`  FAIL - ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function expect(status: number | null, want: ReplayOutcome, name: string) {
  const got = classifyOutcome(status);
  check(got === want, name, `status=${status} got=${got} want=${want}`);
}

// 2xx = applied (safe to forget the queued item)
expect(200, "applied", "200 applies");
expect(201, "applied", "201 applies");
expect(204, "applied", "204 applies");

// 4xx (except 408/429) = permanent rejection -> dead-letter, never retried
expect(400, "rejected", "400 rejects permanently");
expect(401, "rejected", "401 rejects permanently");
expect(403, "rejected", "403 rejects permanently");
expect(404, "rejected", "404 rejects permanently");
expect(422, "rejected", "422 rejects permanently");

// 408/429/5xx = transient -> keep order, retry later
expect(408, "transient", "408 is transient (request timeout)");
expect(429, "transient", "429 is transient (rate limit)");
expect(500, "transient", "500 is transient");
expect(502, "transient", "502 is transient");
expect(503, "transient", "503 is transient (SW offline marker)");

// fetch threw (no response) = network down = transient
expect(null, "transient", "null (network error) is transient");

console.log(`\nOFFLINE UNIT: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

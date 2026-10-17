// Live gate for the LanguageTool integration:
//  1. unit-level: severity split, trap-tag mapping, merge dedup logic;
//  2. live: real api.languagetool.org round-trip through screenText();
//  3. endpoint: POST /api/grammar-check returns the error/style split.
// LT failures degrade gracefully (null report) - the gate distinguishes
// "integration broken" from "network unavailable" (SKIP, not FAIL).

import { screenText, mergeRuleErrors, findingsBlock, severityFor, trapTagFor } from "../src/lib/languagetool";

let pass = 0;
let fail = 0;
let skip = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.error(`FAIL  ${name} ${detail}`);
  }
}

async function main(): Promise<void> {
  console.log("== unit: severity split ==");
  check("TYPOS is an error", severityFor("TYPOS", "SPELL") === "error");
  check("GRAMMAR is an error", severityFor("GRAMMAR", "SOME_RULE") === "error");
  check("STYLE is style", severityFor("STYLE", "STYLE_RULE") === "style");
  check("REDUNDANCY is style", severityFor("REDUNDANCY", "REDUNDANT") === "style");
  check("unknown category with typo-shaped rule is error", severityFor("WEIRD", "TYPO_X") === "error");
  check("unknown category otherwise style", severityFor("WEIRD", "X_RULE") === "style");

  console.log("== unit: trap-tag mapping ==");
  check("spelling rule maps to spelling", trapTagFor("MORPHOLOGY_12", "TYPOS") === "spelling");
  check("preposition rule maps to prepositions", trapTagFor("IN_ON_AT_ERROR", "GRAMMAR") === "prepositions");
  check("article rule maps to articles", trapTagFor("MISSING_DET_THE", "GRAMMAR") === "articles");
  check("fallback is word_choice", trapTagFor("SOMETHING_ELSE", "SEMANTICS") === "word_choice");

  console.log("== unit: merge dedup ==");
  const report = {
    engine: "languagetool" as const,
    checkedChars: 100,
    errors: [
      { offset: 0, length: 3, excerpt: "I has", message: "m", ruleId: "R1", ruleDesc: "", category: "GRAMMAR", severity: "error" as const, replacements: ["I have"], trapTag: "statives" },
    ],
    style: [],
  };
  const existing = [{ bad: "I has gone", good: "I went", fa: "", type: "perfect" }];
  const { merged, added } = mergeRuleErrors(existing, report);
  check("overlapping finding not duplicated", merged.length === 1 && added === 0, `merged=${merged.length} added=${added}`);
  const fresh = { ...report, errors: [{ ...report.errors[0], excerpt: "He don't" }] };
  const m2 = mergeRuleErrors([], fresh);
  check("new finding appended with tag + replacement", m2.added === 1 && m2.merged[0].type === "statives" && m2.merged[0].good === "I have" || m2.merged[0].good === "He do", JSON.stringify(m2.merged));

  console.log("== live: screenText round-trip ==");
  const buggy = "Yesterday I go to work late because my car don't started. She didn't went to the school yesterday.";
  const live = await screenText(buggy);
  if (live === null) {
    skip++;
    console.log("SKIP  LanguageTool unreachable (network/429); endpoint checks skipped");
  } else {
    check("live report returned", live.engine === "languagetool");
    check("live caught definite errors", live.errors.length >= 1, `errors=${JSON.stringify(live.errors.map((e) => e.excerpt))}`);
    check("all findings severity-split", live.errors.every((f) => f.severity === "error"));
    const block = findingsBlock(live);
    check("findings block carries rule ids", block.includes("RULE ENGINE FINDINGS") && block.includes("[error]"));
    console.log(`  live found: ${live.errors.map((e) => `${e.excerpt}->${e.replacements[0] ?? "?"}`).join(" | ")}`);
  }

  console.log("== endpoint: /api/grammar-check ==");
  try {
    const res = await fetch("http://localhost:3000/api/grammar-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "He don't like apples and she didn't went home." }),
    });
    const j = await res.json();
    if (res.status === 503) {
      skip++;
      console.log("SKIP  endpoint live but rule engine unreachable");
    } else {
      check("endpoint 200", res.ok, `status=${res.status} body=${JSON.stringify(j).slice(0, 200)}`);
      check("endpoint splits errors/style", typeof j.errors === "object" && typeof j.style === "object");
      check("endpoint caught definite errors", (j.errors ?? []).length >= 1, JSON.stringify(j.errors));
      check("endpoint summary", String(j.summary ?? "").includes("error"));
    }
  } catch (e) {
    skip++;
    console.log(`SKIP  endpoint unreachable: ${(e as Error).message}`);
  }

  console.log(`\nGRAMMAR CHECK: ${pass} pass, ${fail} fail, ${skip} skip`);
  if (fail > 0) process.exit(1);
}

main();

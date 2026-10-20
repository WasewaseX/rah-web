// The CEFR curriculum graph (audit feature #2).
//
// Until now "level" was one string from placement and the mastery ledger was
// a flat tag list - the learner could see their leaks but never their ROAD:
// what unlocks what, how far the next gate is, and what "B2+" actually
// demands. This module is that road, as a pure deterministic graph:
//
// - Nodes = competencies in three bands (B2 foundations -> B2+ integration
//   -> C1 precision), each with explicit prerequisites.
// - Gates are PROVEN-ONLY and reuse the ledger's honest statistics: a trap
//   tag counts toward a gate only at Wilson lower bound >= 0.7 over >= 8
//   graded attempts (2/2 lucky answers are NOT mastery - the bound caps them
//   at ~58%), a skill at score >= 0.7 over >= 5 graded samples.
// - Nothing here reads or writes the db: every function takes plain rows,
//   so the whole graph is battery-pinnable with no provider and no server.
//
// Gate vocabulary mirrors the tags the app actually produces (tutor prompt,
// phoneme diagnosis) and the six measured skills.

import type { MeasuredSkill } from "@/lib/agent/levels";

export type CurriculumBand = "B2" | "B2+" | "C1";
export type NodeKind = "grammar" | "lexis" | "discourse" | "sound" | "skill";
export type NodeStatus = "locked" | "available" | "in_progress" | "mastered";

const WILSON_Z = 1.96;
const TAG_GATE = { wilson: 0.7, samples: 8 } as const;
const SKILL_GATE = { score: 0.7, samples: 5 } as const;

export interface CurriculumNode {
  id: string;
  band: CurriculumBand;
  kind: NodeKind;
  title: string;
  blurb: string;
  tags: string[]; // trap tags whose ledger evidence feeds the gate
  skills: MeasuredSkill[]; // measured skills whose band feeds the gate
  requires: string[]; // prerequisite node ids (all must be mastered)
}

export interface TagEvidenceRow {
  tag: string;
  ok: number;
  no: number;
  ewma: number;
}

export interface SkillEvidenceRow {
  skill: string;
  score: number;
  samples: number;
}

export interface EvidenceLine {
  label: string;
  proven: boolean;
  started: boolean; // any graded evidence exists (drives in_progress)
  detail: string; // honest numbers, learner-readable
}

export interface CurriculumNodeView {
  node: CurriculumNode;
  status: NodeStatus;
  blockers: string[]; // prerequisite titles when locked
  evidence: EvidenceLine[];
  gateMet: boolean;
}

export function wilsonLower(ok: number, n: number): number {
  if (n === 0) return 0;
  const p = ok / n;
  const denom = 1 + (WILSON_Z * WILSON_Z) / n;
  const centre = p + (WILSON_Z * WILSON_Z) / (2 * n);
  const spread = WILSON_Z * Math.sqrt((p * (1 - p)) / n + (WILSON_Z * WILSON_Z) / (4 * n * n));
  return Math.max(0, Math.min(1, (centre - spread) / denom));
}

const prettyTag = (t: string) => t.replace(/[_-]/g, " ");

// The curriculum itself. Prerequisites encode the real dependency logic:
// collocations need word choice, register needs collocations, precision
// needs register. B2 closes the Farsi-interference core; B2+ integrates it;
// C1 adds precision and the summit node pulls the whole graph together.
export const CURRICULUM: CurriculumNode[] = [
  // ---------- B2: close the interference core ----------
  {
    id: "b2_articles",
    band: "B2",
    kind: "grammar",
    title: "Articles without guessing",
    blurb: "a/an/the from Persian: no articles in your first language, so the rules must become reflex.",
    tags: ["articles"],
    skills: [],
    requires: [],
  },
  {
    id: "b2_countability",
    band: "B2",
    kind: "grammar",
    title: "Countability and quantity",
    blurb: "information/advices/homeworks die here: uncountables, partitives, and two book vs two books.",
    tags: ["countability", "plurals"],
    skills: [],
    requires: [],
  },
  {
    id: "b2_copula",
    band: "B2",
    kind: "grammar",
    title: "The verb BE, every time",
    blurb: "Persian carries 'is' as a suffix; English demands the full copula and its agreement.",
    tags: ["copula", "statives"],
    skills: [],
    requires: [],
  },
  {
    id: "b2_prepositions",
    band: "B2",
    kind: "grammar",
    title: "Prepositions beyond 'dar'",
    blurb: "in/at/on split one Persian word into three English decisions - by collocation, not translation.",
    tags: ["prepositions"],
    skills: [],
    requires: [],
  },
  {
    id: "b2_perfect",
    band: "B2",
    kind: "grammar",
    title: "Perfect tenses and time",
    blurb: "rafte-am maps wrong: kill 'I have seen him yesterday' and own present perfect vs past simple.",
    tags: ["perfect"],
    skills: [],
    requires: [],
  },
  {
    id: "b2_questions",
    band: "B2",
    kind: "grammar",
    title: "Question and clause order",
    blurb: "Do you know where IS the station dies here: subject-aux inversion, embedded questions, that-clauses.",
    tags: ["question_order", "that_omission"],
    skills: [],
    requires: [],
  },
  {
    id: "b2_sentence_shape",
    band: "B2",
    kind: "grammar",
    title: "Sentence shape",
    blurb: "adjective order (noun+adjective is Persian order) and precise word choice over calques.",
    tags: ["adjectives", "word_choice"],
    skills: [],
    requires: [],
  },
  {
    id: "b2_sounds",
    band: "B2",
    kind: "sound",
    title: "The sound fixes",
    blurb: "th, w/v, consonant clusters, final -ng, word stress: the five contrasts ASR hears you drop.",
    tags: ["th_sounds", "w_v", "clusters", "ng", "stress"],
    skills: [],
    requires: [],
  },
  // ---------- B2+: integrate ----------
  {
    id: "b2p_collocations",
    band: "B2+",
    kind: "lexis",
    title: "Collocations over loose pairs",
    blurb: "make a decision, commit to a plan: mid-frequency word partnerships that mark real B2+ writing.",
    tags: ["word_choice"],
    skills: ["vocabulary"],
    requires: ["b2_sentence_shape"],
  },
  {
    id: "b2p_register",
    band: "B2+",
    kind: "discourse",
    title: "Register awareness",
    blurb: "formal vs casual on demand: the same message in an email to a client and a text to a friend.",
    tags: ["register"],
    skills: ["writing"],
    requires: ["b2p_collocations", "b2_articles"],
  },
  {
    id: "b2p_hedging",
    band: "B2+",
    kind: "discourse",
    title: "Hedging and stance",
    blurb: "it seems, to some extent, I would argue: soften claims and mark position like an academic text.",
    tags: ["word_choice", "register"],
    skills: ["speaking"],
    requires: ["b2_copula", "b2_questions"],
  },
  {
    id: "b2p_writing",
    band: "B2+",
    kind: "skill",
    title: "B2+ writing proof",
    blurb: "your graded writing sits at B2+ on the measured ladder: organization plus range together.",
    tags: [],
    skills: ["writing"],
    requires: ["b2p_register"],
  },
  {
    id: "b2p_fluency",
    band: "B2+",
    kind: "skill",
    title: "B2+ speaking proof",
    blurb: "sustained turns with fewer visible breakdowns: the measured speaking band crosses 0.7.",
    tags: [],
    skills: ["speaking"],
    requires: ["b2_sounds", "b2_perfect"],
  },
  {
    id: "b2p_listening",
    band: "B2+",
    kind: "skill",
    title: "B2+ listening proof",
    blurb: "follow monologues at band speed: the measured listening band crosses 0.7.",
    tags: [],
    skills: ["listening"],
    requires: ["b2_sounds"],
  },
  // ---------- C1: precision ----------
  {
    id: "c1_precise_verbs",
    band: "C1",
    kind: "lexis",
    title: "Precise verbs",
    blurb: "drop get/make/do for the exact verb: nominalizations and precision verbs that C1 examiners hunt.",
    tags: ["word_choice"],
    skills: ["vocabulary"],
    requires: ["b2p_collocations"],
  },
  {
    id: "c1_register_control",
    band: "C1",
    kind: "discourse",
    title: "Register under pressure",
    blurb: "switch register mid-scene without dropping accuracy: the hardest integration move.",
    tags: ["register", "word_choice"],
    skills: ["speaking"],
    requires: ["b2p_register", "b2p_hedging"],
  },
  {
    id: "c1_writing_mastery",
    band: "C1",
    kind: "skill",
    title: "C1 writing proof",
    blurb: "complex subjects, developed support, errors rare and subtle: the measured writing band hits C1.",
    tags: [],
    skills: ["writing"],
    requires: ["b2p_writing", "c1_precise_verbs"],
  },
  {
    id: "c1_speaking_mastery",
    band: "C1",
    kind: "skill",
    title: "C1 speaking proof",
    blurb: "idiomatic, hedged, precise under real time pressure: the measured speaking band hits C1.",
    tags: [],
    skills: ["speaking"],
    requires: ["b2p_fluency", "c1_register_control"],
  },
];

// (Spoken fluency stands on the interference core being closed - declared
// directly in the table above.)

const BY_ID = new Map(CURRICULUM.map((n) => [n.id, n]));

export interface CurriculumSummary {
  frontier: CurriculumNodeView | null; // the closest unmet gate, band order
  mastered: number;
  available: number;
  locked: number;
  line: string; // one honest human sentence
}

export interface CurriculumResult {
  nodes: CurriculumNodeView[];
  summary: CurriculumSummary;
}

function tagEvidence(rows: TagEvidenceRow[], tag: string): EvidenceLine {
  const r = rows.find((t) => t.tag === tag);
  const ok = r?.ok ?? 0;
  const no = r?.no ?? 0;
  const n = ok + no;
  const w = wilsonLower(ok, n);
  const proven = w >= TAG_GATE.wilson && n >= TAG_GATE.samples;
  return {
    label: prettyTag(tag),
    proven,
    started: n > 0,
    detail: n === 0
      ? `no graded attempts yet - need ${TAG_GATE.samples}+ at 70% proven`
      : `${Math.round(w * 100)}% proven over ${n} attempt${n === 1 ? "" : "s"} (gate: 70% over ${TAG_GATE.samples})`,
  };
}

function skillEvidence(rows: SkillEvidenceRow[], skill: string): EvidenceLine {
  const r = rows.find((s) => s.skill === skill);
  const score = r?.score ?? 0;
  const samples = r?.samples ?? 0;
  const proven = score >= SKILL_GATE.score && samples >= SKILL_GATE.samples;
  return {
    label: `${skill} band`,
    proven,
    started: samples > 0,
    detail: samples === 0
      ? `never measured yet - graded ${skill} work fills this in`
      : `${Math.round(score * 100)} measured over ${samples} sample${samples === 1 ? "" : "s"} (gate: 70 over ${SKILL_GATE.samples})`,
  };
}

export function computeCurriculum(tags: TagEvidenceRow[], skills: SkillEvidenceRow[]): CurriculumResult {
  const views = new Map<string, CurriculumNodeView>();

  const evaluate = (node: CurriculumNode): CurriculumNodeView => {
    const cached = views.get(node.id);
    if (cached) return cached;

    const blockerViews = node.requires.map((id) => BY_ID.get(id)).filter((n): n is CurriculumNode => Boolean(n)).map(evaluate);
    const blockers = blockerViews.filter((v) => v.status !== "mastered").map((v) => v.node.title);
    const evidence = [...node.tags.map((t) => tagEvidence(tags, t)), ...node.skills.map((s) => skillEvidence(skills, s))];
    const gateMet = evidence.length > 0 && evidence.every((e) => e.proven);

    let status: NodeStatus;
    if (blockers.length > 0) status = "locked";
    else if (gateMet) status = "mastered";
    else if (evidence.some((e) => e.started)) status = "in_progress";
    else status = "available";

    const view: CurriculumNodeView = { node, status, blockers, evidence, gateMet };
    views.set(node.id, view);
    return view;
  };

  const nodes = CURRICULUM.map(evaluate);

  // Frontier: the first unmastered node in band order whose prerequisites are
  // met - the closest gate the learner can actually push open. Deterministic.
  const bandRank: Record<CurriculumBand, number> = { B2: 0, "B2+": 1, C1: 2 };
  const frontier =
    nodes
      .filter((v) => v.status === "available" || v.status === "in_progress")
      .sort((a, b) => bandRank[a.node.band] - bandRank[b.node.band] || CURRICULUM.indexOf(a.node) - CURRICULUM.indexOf(b.node))[0] ?? null;

  const mastered = nodes.filter((v) => v.status === "mastered").length;
  const available = nodes.filter((v) => v.status === "available" || v.status === "in_progress").length;
  const locked = nodes.filter((v) => v.status === "locked").length;
  const line = frontier
    ? `Next gate: ${frontier.node.title} (${frontier.node.band}) - ${frontier.evidence.filter((e) => !e.proven).length} requirement${frontier.evidence.filter((e) => !e.proven).length === 1 ? "" : "s"} left.`
    : mastered === nodes.length
      ? "Every gate in the graph is proven. The curriculum is yours."
      : "No open gate right now - clear prerequisites to unlock the next one.";

  return { nodes, summary: { frontier, mastered, available, locked, line } };
}

// The dependencies must form a DAG: catch authoring mistakes (a cycle would
// hang evaluate) at import time - cheap insurance for a hand-written graph.
for (const n of CURRICULUM) {
  const seen = new Set<string>();
  const walk = (id: string): boolean => {
    if (id === n.id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (BY_ID.get(id)?.requires ?? []).some(walk);
  };
  if (n.requires.some(walk)) throw new Error(`curriculum cycle at ${n.id}`);
}
if (BY_ID.size !== CURRICULUM.length) throw new Error("duplicate curriculum node id");
for (const n of CURRICULUM) {
  for (const r of n.requires) if (!BY_ID.has(r)) throw new Error(`curriculum node ${n.id} requires unknown node ${r}`);
}

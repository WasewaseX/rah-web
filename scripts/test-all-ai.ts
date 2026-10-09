// End-to-end AI verification for every Rah endpoint.
const BASE = "http://localhost:3000";

interface Check {
  name: string;
  url: string;
  body?: unknown;
  validate: (data: unknown) => string; // returns "ok" or problem description
}

const checks: Check[] = [
  {
    name: "chat (tutor correction)",
    url: "/api/chat",
    body: { message: "I am knowing the answer since two hours." },
    validate: (d) => {
      const r = d as { reply?: string; corrections?: unknown[]; fa_note?: string };
      if (!r.reply || r.reply.length < 5) return "missing reply";
      if (!Array.isArray(r.corrections)) return "corrections not array";
      if (!r.fa_note) return "missing fa_note";
      return "ok";
    },
  },
  {
    name: "writing (CEFR grade)",
    url: "/api/writing",
    body: {
      prompt: "Is it better to master one skill or collect many shallow ones? Take a side and defend it with examples.",
      text: "In my opinion, mastery of one skill is better than collecting many shallow ones. When a person concentrate on a single domain, they build deep knowledge that compounds over time. For example, my uncle who is a carpenter spent twenty years to learn woodworking and now his works are known in all the city. However shallow skills also has advantages, because in the modern world we need to adapt fast to changes. But I still believe deep mastery gives more satisfaction and more money in long term. To sum up, although breadth helps in short term, depth wins in long term because expertise is rare and valuable.",
    },
    validate: (d) => {
      const r = d as { level?: string; scores?: Record<string, number>; errors?: unknown[]; upgrades?: unknown[] };
      if (!r.level) return "missing level";
      if (!r.scores || Object.keys(r.scores).length < 4) return "missing scores";
      if (!Array.isArray(r.errors)) return "errors not array";
      if (!Array.isArray(r.upgrades)) return "upgrades not array";
      return "ok";
    },
  },
  {
    name: "quiz (retrieval builder)",
    url: "/api/quiz",
    body: {
      source: "paste",
      text: "The committee reached a consensus after a heated debate. The chairman put forward a proposal to curb spending, but several members pushed back, arguing that cuts would undermine the project's long-term viability. In the end they struck a compromise: funding would continue, albeit at a reduced rate, and the board would revisit the matter next quarter.",
    },
    validate: (d) => {
      const r = d as { title?: string; items?: unknown[] };
      if (!r.title) return "missing title";
      if (!Array.isArray(r.items) || r.items.length < 5) return `items too few: ${Array.isArray(r.items) ? r.items.length : 0}`;
      return "ok";
    },
  },
  {
    name: "listen (monologue + questions)",
    url: "/api/listen",
    body: { topic: "the strange economics of coffee" },
    validate: (d) => {
      const r = d as { title?: string; text?: string; questions?: unknown[] };
      if (!r.text || r.text.length < 200) return "monologue too short";
      if (!Array.isArray(r.questions) || r.questions.length < 3) return "questions too few";
      return "ok";
    },
  },
  {
    name: "speak (transcript diagnosis)",
    url: "/api/speak",
    body: {
      prompt: "Talk for 2 minutes: a habit you changed and what actually happened.",
      transcript:
        "So, uh, two years ago I decide to stop drinking coffee after lunch because I read it is bad for the sleep. In the beginning it was very hard, I am getting headache every day and I was very tired in the afternoon. My friend told me to replace it with walking, so when I want coffee I go outside for ten minutes. After some weeks the headache stopped and my sleep became better. Now I am sleeping very good and I don't miss the coffee so much. It was interesting that the habit was not about the coffee itself, it was about to have a break.",
      round: 1,
    },
    validate: (d) => {
      const r = d as { scores?: Record<string, number>; errors?: unknown[]; round2?: { constraint?: string } };
      if (!r.scores || Object.keys(r.scores).length < 4) return "missing scores";
      if (!Array.isArray(r.errors)) return "errors not array";
      if (!r.round2?.constraint) return "missing round2 constraint";
      return "ok";
    },
  },
];

async function main() {
  for (const c of checks) {
    const t0 = Date.now();
    try {
      const res = await fetch(BASE + c.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c.body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      const verdict = res.ok ? c.validate(data) : `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`;
      console.log(`[${verdict === "ok" ? "PASS" : "FAIL"}] ${c.name} (${Date.now() - t0}ms) ${verdict === "ok" ? "" : "-> " + verdict}`);
    } catch (e) {
      console.log(`[FAIL] ${c.name} (${Date.now() - t0}ms) -> ${(e as Error).message}`);
    }
  }
}

main();

export {}

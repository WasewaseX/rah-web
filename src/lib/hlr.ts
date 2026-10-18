// Half-Life Regression (HLR) - a 1:1 TypeScript port of Duolingo's own
// reference implementation (scripts/duolingo-reference/experiment.py, MIT
// licence, Settles & Meeder 2016), reverse engineered for the differential
// gate scripts/test-duolingo-hlr.ts. Every constant, clip, feature and
// gradient below is THEIRS, not ours - deviations are documented inline.
//
// Their model: p(recall) = 2^(-t/h), h = clip(2^(w . x)) with features
// sqrt(1+right), sqrt(1+wrong), bias, and one-hot lexeme tags.

export const MIN_HALF_LIFE = 15.0 / (24 * 60); // 15 minutes, in days
export const MAX_HALF_LIFE = 274.0; // 9 months, in days
export const LN2 = Math.log(2.0);

export type HlrMethod = "hlr" | "lr" | "leitner" | "pimsleur";

export function pclip(p: number): number {
  // bound min/max model predictions (helps with loss optimization)
  return Math.min(Math.max(p, 0.0001), 0.9999);
}

export function hclip(h: number): number {
  // bound min/max half-life
  return Math.min(Math.max(h, MIN_HALF_LIFE), MAX_HALF_LIFE);
}

export interface Instance {
  p: number; // observed recall rate, pclipped
  t: number; // time since last practice, in DAYS
  fv: Array<[string, number]>; // sparse feature vector
  h: number; // observed half-life implied by p and t (the hlr target)
  right: number;
  wrong: number;
}

// Observed half-life: invert p = 2^(-t/h) for h, then clip. Their read_data.
export function observedHalfLife(p: number, tDays: number): number {
  return hclip(-tDays / Math.log2(p));
}

// Feature builder - their read_data, hlr/lr branch by branch.
export function buildInstance(
  row: {
    pRecall: number;
    deltaSeconds: number;
    historySeen: number;
    historyCorrect: number;
  },
  opts: {
    method: HlrMethod;
    omitBias?: boolean;
    omitLexemes?: boolean;
    learningLanguage?: string;
    lexemeString?: string;
  },
): Instance {
  const p = pclip(row.pRecall);
  const t = row.deltaSeconds / (60 * 60 * 24); // seconds -> days (their line)
  const h = hclip(-t / Math.log2(p));
  const seen = row.historySeen;
  const right = row.historyCorrect;
  const wrong = seen - right;
  const fv: Array<[string, number]> = [];
  // core features based on method (their branch order)
  if (opts.method === "leitner") {
    fv.push(["diff", right - wrong]);
  } else if (opts.method === "pimsleur") {
    fv.push(["total", right + wrong]);
  } else {
    // their commented-out linear features replaced by sqrt(1+.) in the source
    fv.push(["right", Math.sqrt(1 + right)]);
    fv.push(["wrong", Math.sqrt(1 + wrong)]);
  }
  if (opts.method === "lr") fv.push(["time", t]);
  if (opts.omitBias !== true) fv.push(["bias", 1.0]);
  if (opts.omitLexemes !== true) {
    fv.push([`${opts.learningLanguage ?? "en"}:${opts.lexemeString ?? "?"}`, 1.0]);
  }
  return { p, t, fv, h, right, wrong };
}

// Synthetic instance builder for the parity fixture (no trace row needed).
export function synthInstance(
  pRecall: number,
  tDays: number,
  right: number,
  wrong: number,
  opts: { omitBias?: boolean; omitLexemes?: boolean; lexeme?: string },
): Instance {
  return buildInstance(
    {
      pRecall,
      deltaSeconds: tDays * 86400,
      historySeen: right + wrong,
      historyCorrect: right,
    },
    { method: "hlr", omitBias: opts.omitBias, omitLexemes: opts.omitLexemes, lexemeString: opts.lexeme },
  );
}

export interface EvalScore {
  maeP: number;
  corP: number;
  maeH: number;
  corH: number;
}

// Their "spearmanr" - which is actually the PEARSON formula on raw values.
// Kept 1:1 (quirk included) so our numbers are directly comparable to runs
// of their script; the misnomer is documented in DUOLINGO-RE.md.
export function theirCorrelation(l1: number[], l2: number[]): number {
  const m1 = l1.reduce((a, b) => a + b, 0) / l1.length;
  const m2 = l2.reduce((a, b) => a + b, 0) / l2.length;
  let num = 0.0;
  let d1 = 0.0;
  let d2 = 0.0;
  for (let i = 0; i < l1.length; i++) {
    num += (l1[i] - m1) * (l2[i] - m2);
    d1 += (l1[i] - m1) ** 2;
    d2 += (l2[i] - m2) ** 2;
  }
  return num / Math.sqrt(d1 * d2);
}

export function theirMae(l1: number[], l2: number[]): number {
  let s = 0.0;
  for (let i = 0; i < l1.length; i++) s += Math.abs(l1[i] - l2[i]);
  return s / l1.length;
}

export class SpacedRepetitionModel {
  method: HlrMethod;
  omitHTerm: boolean;
  weights = new Map<string, number>();
  fcounts = new Map<string, number>();
  lrate = 0.001;
  hlwt = 0.01;
  l2wt = 0.1;
  sigma = 1.0;

  constructor(
    method: HlrMethod = "hlr",
    opts?: { omitHTerm?: boolean; lrate?: number; hlwt?: number; l2wt?: number; sigma?: number },
  ) {
    this.method = method;
    this.omitHTerm = opts?.omitHTerm ?? false;
    if (opts?.lrate !== undefined) this.lrate = opts.lrate;
    if (opts?.hlwt !== undefined) this.hlwt = opts.hlwt;
    if (opts?.l2wt !== undefined) this.l2wt = opts.l2wt;
    if (opts?.sigma !== undefined) this.sigma = opts.sigma;
  }

  halflife(inst: Instance): number {
    try {
      let dp = 0.0;
      for (const [k, x] of inst.fv) dp += (this.weights.get(k) ?? 0.0) * x;
      return hclip(Math.pow(2.0, dp));
    } catch {
      // their bare except returns MAX_HALF_LIFE on any numerical blowup
      return MAX_HALF_LIFE;
    }
  }

  predict(inst: Instance): [number, number] {
    if (this.method === "hlr") {
      const h = this.halflife(inst);
      const p = Math.pow(2.0, -inst.t / h);
      return [pclip(p), h];
    } else if (this.method === "leitner") {
      const h = hclip(Math.pow(2.0, inst.fv[0][1]));
      const p = Math.pow(2.0, -inst.t / h);
      return [pclip(p), h];
    } else if (this.method === "pimsleur") {
      const h = hclip(Math.pow(2.0, 2.35 * inst.fv[0][1] - 16.46));
      const p = Math.pow(2.0, -inst.t / h);
      return [pclip(p), h];
    } else {
      // lr
      let dp = 0.0;
      for (const [k, x] of inst.fv) dp += (this.weights.get(k) ?? 0.0) * x;
      const p = 1.0 / (1.0 + Math.exp(-dp));
      return [pclip(p), 0.0];
    }
  }

  trainUpdate(inst: Instance): void {
    if (this.method === "hlr") {
      const [p, h] = this.predict(inst);
      const dlpDw = 2.0 * (p - inst.p) * (LN2 ** 2) * p * (inst.t / h);
      const dlhDw = 2.0 * (h - inst.h) * LN2 * h;
      for (const [k, x] of inst.fv) {
        const fc = this.fcounts.get(k) ?? 0;
        const rate = (1.0 / (1.0 + inst.p)) * (this.lrate / Math.sqrt(1 + fc));
        // sl(p) update
        this.weights.set(k, (this.weights.get(k) ?? 0.0) - rate * dlpDw * x);
        // sl(h) update
        if (!this.omitHTerm) {
          this.weights.set(k, (this.weights.get(k) ?? 0.0) - rate * this.hlwt * dlhDw * x);
        }
        // L2 regularization update
        const w = this.weights.get(k) ?? 0.0;
        this.weights.set(k, w - rate * this.l2wt * w / (this.sigma ** 2));
        this.fcounts.set(k, fc + 1);
      }
    } else if (this.method === "lr") {
      const [p] = this.predict(inst);
      const err = p - inst.p;
      for (const [k, x] of inst.fv) {
        const fc = this.fcounts.get(k) ?? 0;
        const rate = this.lrate / Math.sqrt(1 + fc);
        this.weights.set(k, (this.weights.get(k) ?? 0.0) - rate * err * x);
        const w = this.weights.get(k) ?? 0.0;
        this.weights.set(k, w - rate * this.l2wt * w / (this.sigma ** 2));
        this.fcounts.set(k, fc + 1);
      }
    }
    // leitner / pimsleur: fixed, no training (their pass)
  }

  // DEVIATION (documented): their train() calls random.shuffle(trainset) -
  // nondeterministic. We take the set in the caller's order; the parity gate
  // feeds BOTH implementations the identical pinned order.
  train(trainset: Instance[]): void {
    if (this.method === "leitner" || this.method === "pimsleur") return;
    for (const inst of trainset) this.trainUpdate(inst);
  }

  losses(inst: Instance): { slp: number; slh: number; p: number; h: number } {
    const [p, h] = this.predict(inst); // tuple - destructure by index
    const slp = (inst.p - p) ** 2;
    const slh = (inst.h - h) ** 2;
    return { slp, slh, p, h };
  }

  eval(testset: Instance[]): EvalScore {
    const gtP: number[] = [];
    const pp: number[] = [];
    const gtH: number[] = [];
    const hh: number[] = [];
    for (const inst of testset) {
      const [p, h] = this.predict(inst); // tuple - destructure by index
      gtP.push(inst.p);
      pp.push(p);
      gtH.push(inst.h);
      hh.push(h);
    }
    return {
      maeP: theirMae(gtP, pp),
      corP: theirCorrelation(gtP, pp),
      maeH: theirMae(gtH, hh),
      corH: theirCorrelation(gtH, hh),
    };
  }
}

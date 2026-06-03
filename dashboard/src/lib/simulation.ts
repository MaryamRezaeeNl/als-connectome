// ALS Connectome Simulator — TypeScript port of phase5_criticality.py
// Nonlinear biophysical cascade on C. elegans motor circuit

import { N, VULN_ARRAY, buildAggW, buildExcitotoxW } from "./connectome";

export interface SimParams {
  aggregationAmplification: number;  // [0.05, 20.0]
  mitochondrialFragility: number;    // [0.3, 8.0]
  atpCollapseThreshold: number;      // [0.05, 0.7]
  glutamateSensitivity: number;      // [0.0005, 0.1]
  calciumStressGain: number;         // [0.02, 5.0]
  oxidativeFeedback: number;         // [0.0005, 0.5]
  recoveryIrreversibility: number;   // [0.2, 0.99]
}

export const DEFAULT_PARAMS: SimParams = {
  aggregationAmplification: 1.5,
  mitochondrialFragility: 0.83,
  atpCollapseThreshold: 0.30,
  glutamateSensitivity: 0.00072,
  calciumStressGain: 0.50,
  oxidativeFeedback: 0.020,
  recoveryIrreversibility: 0.80,
};

export const PARAM_RANGES: Record<keyof SimParams, [number, number]> = {
  aggregationAmplification: [0.05, 20.0],
  mitochondrialFragility: [0.3, 8.0],
  atpCollapseThreshold: [0.05, 0.7],
  glutamateSensitivity: [0.0005, 0.1],
  calciumStressGain: [0.02, 5.0],
  oxidativeFeedback: [0.0005, 0.5],
  recoveryIrreversibility: [0.2, 0.99],
};

export const PARAM_LABELS: Record<keyof SimParams, string> = {
  aggregationAmplification: "Aggregation Amplitude",
  mitochondrialFragility: "Mitochondrial Fragility",
  atpCollapseThreshold: "ATP Collapse Threshold",
  glutamateSensitivity: "Glutamate Sensitivity",
  calciumStressGain: "Calcium Stress Gain",
  oxidativeFeedback: "Oxidative Feedback",
  recoveryIrreversibility: "Recovery Irreversibility",
};

export const LOG_PARAMS = new Set(["aggregationAmplification","glutamateSensitivity","oxidativeFeedback"]);

export interface StepHistory {
  step: number;
  alive: number;
  meanAgg: number;
  meanAtp: number;
  meanCal: number;
  nIrrev: number;
}

// Simple seeded pseudo-random number generator (xorshift)
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// Box-Muller normal(0, sigma)
function normalSamples(rng: () => number, n: number, sigma: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k += 2) {
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const mag = sigma * Math.sqrt(-2 * Math.log(u1));
    out.push(mag * Math.cos(2 * Math.PI * u2));
    if (k + 1 < n) out.push(mag * Math.sin(2 * Math.PI * u2));
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class ConnectomeSimulator {
  // Constants
  readonly DEAD_THRESHOLD = 0.15;
  readonly AGG_SEED_RATE = 0.0006;
  readonly AGG_SPREAD_RATE = 0.005;
  readonly ATP_RECOVERY = 0.04;
  readonly ATP_DAMAGE_SCALE = 1.10;
  readonly EXCITOTOX_FACTOR = 0.004;
  readonly CLEARANCE_BASE = 0.025;
  readonly HEALTH_LOSS_AGG = 0.018;
  readonly HEALTH_LOSS_TOX = 0.010;

  private rng: () => number;
  private p: SimParams;

  // State arrays
  health: Float64Array;
  atp: Float64Array;
  toxicity: Float64Array;
  aggregation: Float64Array;
  calcium: Float64Array;
  oxidative: Float64Array;
  irreversible: Uint8Array;

  // Weight matrices (pre-computed)
  private aggW: number[][];
  private excitotoxW: number[][];

  history: StepHistory[] = [];
  time = 0;

  constructor(seed: number = 42, params: Partial<SimParams> = {}) {
    this.rng = makeRng(seed);
    this.p = { ...DEFAULT_PARAMS, ...params };

    this.health = new Float64Array(N).fill(1.0);
    this.atp = new Float64Array(N).fill(1.0);
    this.toxicity = new Float64Array(N).fill(0.0);
    this.aggregation = new Float64Array(N).fill(0.0);
    this.calcium = new Float64Array(N).fill(0.0);
    this.oxidative = new Float64Array(N).fill(0.0);
    this.irreversible = new Uint8Array(N).fill(0);

    // Initialize aggregation — focal ALS-like seeding
    for (let i = 0; i < N; i++) {
      const base = VULN_ARRAY[i] >= 0.65 ? 0.015 : 0.002; // motor vs rest
      this.aggregation[i] = this.rng() * base * VULN_ARRAY[i];
    }

    this.aggW = buildAggW();
    this.excitotoxW = buildExcitotoxW();
  }

  step(): number {
    const h = this.health;
    const atp = this.atp;
    const tox = this.toxicity;
    const agg = this.aggregation;
    const cal = this.calcium;
    const ox = this.oxidative;
    const p = this.p;
    const dt = 1.0;

    // Alive mask
    const alive = new Float64Array(N);
    for (let i = 0; i < N; i++) alive[i] = h[i] > this.DEAD_THRESHOLD ? 1.0 : 0.0;

    const amp = p.aggregationAmplification;
    const noise = normalSamples(this.rng, N, 0.003);

    // 1. Aggregation: intrinsic seeding + prion spread + oxidative feedback
    const newAgg = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      if (!alive[j]) { newAgg[j] = agg[j]; continue; }
      // Prion-like spread: sum over presynaptic neurons
      let spread = 0;
      const row = this.aggW[j];
      for (let i = 0; i < N; i++) spread += row[i] * agg[i] * alive[i];
      const dAgg = (
        VULN_ARRAY[j] * this.AGG_SEED_RATE * amp * dt
        + this.AGG_SPREAD_RATE * amp * spread * dt
        + p.oxidativeFeedback * ox[j] * dt
        + noise[j]
      );
      newAgg[j] = clamp(agg[j] + dAgg, 0, 1);
    }

    // 2. ATP: mitochondrial fragility
    const newAtp = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const atpTarget = clamp(1.0 - this.ATP_DAMAGE_SCALE * p.mitochondrialFragility * newAgg[i], 0, 1);
      let na = clamp(atp[i] + (atpTarget - atp[i]) * this.ATP_RECOVERY * dt, 0, 1);
      // Irreversibility check
      if (!this.irreversible[i] && na < p.atpCollapseThreshold && newAgg[i] > p.recoveryIrreversibility && alive[i] > 0.5) {
        this.irreversible[i] = 1;
      }
      if (this.irreversible[i]) {
        na = Math.min(na, p.atpCollapseThreshold * 0.75);
      }
      newAtp[i] = na;
    }

    // 3. Glutamate -> calcium cascade
    const newCal = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      if (!alive[j]) { newCal[j] = cal[j]; continue; }
      const glutDrive = p.glutamateSensitivity * Math.max(0, 0.5 - newAtp[j]) * alive[j];
      let glutSpread = 0;
      const row = this.excitotoxW[j];
      for (let i = 0; i < N; i++) glutSpread += row[i] * glutDrive * alive[i];
      const dCal = (p.calciumStressGain * glutSpread - 0.05 * cal[j]) * dt;
      newCal[j] = clamp(cal[j] + dCal, 0, 1);
    }

    // 4. Oxidative stress
    const newOx = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (!alive[i]) { newOx[i] = ox[i]; continue; }
      const dOx = (0.15 * newCal[i] - 0.04 * newAtp[i] * ox[i]) * dt;
      newOx[i] = clamp(ox[i] + dOx, 0, 1);
    }

    // 5. Toxicity
    const newTox = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      if (!alive[j]) { newTox[j] = tox[j]; continue; }
      let excitIn = 0;
      const row = this.excitotoxW[j];
      for (let i = 0; i < N; i++) excitIn += row[i] * h[i] * alive[i];
      const dTox = (
        excitIn * (1 - newAtp[j]) * this.EXCITOTOX_FACTOR
        + 0.004 * newCal[j]
        - this.CLEARANCE_BASE * newAtp[j] * tox[j]
      ) * dt;
      newTox[j] = clamp(tox[j] + dTox, 0, 1);
    }

    // 6. Health decline
    const newHealth = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (!alive[i]) { newHealth[i] = h[i]; continue; }
      const dH = -(
        this.HEALTH_LOSS_AGG * newAgg[i]
        + this.HEALTH_LOSS_TOX * newTox[i]
        + 0.005 * newCal[i]
        + 0.004 * newOx[i]
      ) * dt;
      let nh = clamp(h[i] + dH, 0, 1);
      if (this.irreversible[i]) nh = Math.min(nh, h[i]);
      newHealth[i] = nh;
    }

    // Commit
    this.aggregation = newAgg;
    this.atp = newAtp;
    this.toxicity = newTox;
    this.calcium = newCal;
    this.oxidative = newOx;
    this.health = newHealth;
    this.time++;

    // Count alive & record
    let nAlive = 0;
    let sumAgg = 0, sumAtp = 0, sumCal = 0, nAliveCount = 0;
    for (let i = 0; i < N; i++) {
      if (newHealth[i] > this.DEAD_THRESHOLD) {
        nAlive++;
        sumAgg += newAgg[i];
        sumAtp += newAtp[i];
        sumCal += newCal[i];
        nAliveCount++;
      }
    }
    const nIrrev = this.irreversible.reduce((s, v) => s + v, 0);

    this.history.push({
      step: this.time,
      alive: nAlive,
      meanAgg: nAliveCount > 0 ? sumAgg / nAliveCount : 0,
      meanAtp: nAliveCount > 0 ? sumAtp / nAliveCount : 0,
      meanCal: nAliveCount > 0 ? sumCal / nAliveCount : 0,
      nIrrev,
    });

    return nAlive;
  }
}

export function runSimulation(params: Partial<SimParams>, steps: number = 500, seed: number = 134): StepHistory[] {
  const sim = new ConnectomeSimulator(seed, params);
  for (let i = 0; i < steps; i++) sim.step();
  return sim.history;
}

export function classifyRegime(hist: StepHistory[]): "stable" | "critical" | "runaway" {
  if (hist.length < 200) return "stable";
  const alive200 = hist[199].alive;
  const aliveFinal = hist[hist.length - 1].alive;
  if (alive200 < 10) return "runaway";
  if (aliveFinal > 50) return "stable";
  return "critical";
}

// Therapy simulation — apply aggregation suppression from startStep
export function runWithTherapy(
  params: Partial<SimParams>,
  steps: number,
  therapyStrength: number,
  therapyStart: number,
  seed: number = 134
): StepHistory[] {
  const sim = new ConnectomeSimulator(seed, params);
  for (let i = 0; i < steps; i++) {
    if (i >= therapyStart) {
      (sim as any).p = {
        ...(sim as any).p,
        aggregationAmplification:
          (sim as any).p.aggregationAmplification * (1 - therapyStrength),
      };
    }
    sim.step();
  }
  return sim.history;
}

// Run therapy correctly (set params once before start step)
export function runWithTherapyCorrect(
  params: Partial<SimParams>,
  steps: number,
  therapyStrength: number,
  therapyStart: number,
  seed: number = 134
): StepHistory[] {
  const baseParams = { ...DEFAULT_PARAMS, ...params };
  const therapyParams = {
    ...baseParams,
    aggregationAmplification: baseParams.aggregationAmplification * (1 - therapyStrength),
  };

  const sim = new ConnectomeSimulator(seed, baseParams);
  for (let i = 0; i < steps; i++) {
    if (i === therapyStart) {
      // Switch to therapy params
      (sim as any).p = therapyParams;
    }
    sim.step();
  }
  return sim.history;
}

// Detect tipping step (strict criterion C1: max 10-step death rate > 4)
export function detectTippingStep(hist: StepHistory[]): number | null {
  for (let i = 10; i < hist.length; i++) {
    const deaths = hist[i - 10].alive - hist[i].alive;
    if (deaths > 4) return hist[i - 5].step;
  }
  return null;
}

// Compute spatial coherence (simplified: correlation between vuln and death step)
export function computeCoherence(sim: ConnectomeSimulator): number {
  const deathSteps: (number | null)[] = new Array(N).fill(null);
  const hist = sim.history;
  // Re-track which neurons die at each step - approximate from final health state
  // Use vulnerability correlation as proxy
  const vulns = VULN_ARRAY;
  const finalHealth = sim.health;

  // Neurons with lower final health died earlier (rough correlation with vuln)
  const healthArr = Array.from(finalHealth);
  const vulnMean = vulns.reduce((s, v) => s + v, 0) / N;
  const healthMean = healthArr.reduce((s, v) => s + v, 0) / N;

  let num = 0, denVuln = 0, denHealth = 0;
  for (let i = 0; i < N; i++) {
    const dv = vulns[i] - vulnMean;
    const dh = healthArr[i] - healthMean;
    num += dv * (-dh); // neg health = more damage = should correlate with vuln
    denVuln += dv * dv;
    denHealth += dh * dh;
  }
  const denom = Math.sqrt(denVuln * denHealth);
  return denom < 1e-10 ? 0 : num / denom;
}

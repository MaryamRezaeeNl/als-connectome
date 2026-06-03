"use client";
import { useState, useRef } from "react";

// ══════════════════════════════════════════════════════════════════
//  NOTE: This component uses the Phase 3/4 fatigue-toxicity
//  degeneration model (health/fatigue/toxicity Float32Array state).
//  It is intentionally ISOLATED from Phase 5, which uses a separate
//  aggregation/ATP/glutamate/ROS biophysics cascade.
//  Do NOT import from @/lib/simulation here.
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────
//  DATA
// ──────────────────────────────────────────────────────────────────

const EDGES_P4: [number, number][] = [
  [0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,12],[0,13],[0,14],[0,15],
  [0,16],[0,17],[0,18],[0,39],[0,40],[0,41],[0,42],[0,43],[0,55],[0,56],
  [0,57],[0,59],[0,60],[1,4],[1,5],[1,6],[1,7],[1,8],[1,9],[1,12],
  [1,13],[1,14],[1,15],[1,16],[1,17],[1,19],[1,55],[1,56],[1,57],[1,59],
  [1,60],[2,4],[2,5],[2,8],[2,9],[2,10],[2,11],[2,21],[2,22],[2,23],
  [2,24],[2,25],[2,26],[2,27],[2,44],[2,45],[2,46],[2,47],[2,48],[2,55],
  [2,56],[3,4],[3,5],[3,8],[3,9],[3,10],[3,11],[3,21],[3,22],[3,23],
  [3,24],[3,25],[3,26],[3,27],[3,55],[3,56],[4,10],[4,11],[4,49],[4,50],
  [4,53],[4,54],[4,57],[4,58],[5,10],[5,11],[5,49],[5,50],[5,53],[5,54],
  [5,57],[5,58],[12,13],[12,28],[13,14],[13,29],[14,15],[14,30],[15,16],
  [15,31],[16,32],[17,33],[21,22],[21,34],[22,23],[22,35],[23,24],[23,36],
  [24,25],[24,37],[25,38],[28,29],[28,39],[28,44],[29,30],[29,40],[29,45],
  [30,31],[30,41],[30,46],[31,32],[31,42],[31,47],[32,43],[32,48],[51,57],[52,57],
];

const NODE_TYPES_P4: Record<number, number> = {
  0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:5,9:5,10:5,11:5,
  12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,
  21:2,22:2,23:2,24:2,25:2,26:2,27:2,
  28:3,29:3,30:3,31:3,32:3,33:3,34:3,35:3,36:3,37:3,38:3,
  39:1,40:1,41:1,42:1,43:1,
  44:2,45:2,46:2,47:2,48:2,
  49:4,50:4,51:4,52:4,53:4,54:4,
  55:5,56:5,57:5,58:5,59:5,60:5,
};

const N_P4 = 61;
const PROTECTIVE_NODES_P4 = [6, 59, 60, 17, 57]; // AVDL, LUAL, LUAR, DA6, DVA
const ABSORBER_NODES_P4   = [1, 2, 3, 4, 5];     // AVAR, AVBL, AVBR, PVCL, PVCR

const P4C = {
  a:"#00e5ff", b:"#ffd700", green:"#a8ff78", red:"#ff4444",
  orange:"#ff9944", purple:"#a855f7", dim:"#3a5570",
};

// ──────────────────────────────────────────────────────────────────
//  INTERFACES
// ──────────────────────────────────────────────────────────────────

type InterventionFamily = "protect"|"toxsup"|"recovery"|"loadredist"|"rewire"|"none";

interface Intervention {
  type:          InterventionFamily;
  family:        InterventionFamily;
  cost:          number;
  // protect
  strength?:     number;
  startTime?:    number;
  duration?:     number;
  global?:       boolean;
  // toxsup
  suppression?:  number;
  // recovery
  multiplier?:   number;
  // loadredist
  reduction?:    number;
  absorberBoost?:number;
  // rewire
  prob?:         number;
}

interface SimResult {
  finalAlive: number; auc: number; tipStep: number; maxSlope: number; histAlive: number[];
}

interface ScoreResult {
  total: number; survivalGain: number; tipDelay: number;
  aucGain: number; velocityRedux: number; costPenalty: number;
}

interface SearchEntry {
  config: Intervention; res: SimResult; score: ScoreResult; id: number;
}

interface ImportanceEntry { param: string; r: number; }

interface SearchData {
  results:        SearchEntry[];
  bestByGen:      Array<{gen: number; best: number}>;
  importance:     ImportanceEntry[];
  bestPerFamily:  Array<{family: InterventionFamily; result: SearchEntry | null}>;
}

// ──────────────────────────────────────────────────────────────────
//  GRAPH (module-level)
// ──────────────────────────────────────────────────────────────────

const ADJ_P4: number[][] = (() => {
  const adj: number[][] = Array.from({ length: N_P4 }, () => []);
  for (const [a, b] of EDGES_P4) { adj[a].push(b); adj[b].push(a); }
  return adj.map(nb => [...new Set(nb)]);
})();

const DEG_P4     = ADJ_P4.map(nb => nb.length);
const BASE_CAP_P4 = DEG_P4.map(d => Math.max(d, 1));

// ──────────────────────────────────────────────────────────────────
//  DEGENERATION MODEL — Phase 3/4 fatigue-toxicity
//  (NOT the Phase 5 aggregation/ATP/glutamate/ROS cascade)
// ──────────────────────────────────────────────────────────────────

const BASE_DEGEN_P4 = {
  fatigueGain:   0.05, fatigueDecay: 0.95,
  toxSpread:     0.08, toxDecay:     0.92,
  degRate:       0.018, recoveryRate: 0.005,
  initTox:       0.3,  deathThresh:  0.06,
  aFatigue:      0.4,  aToxicity:    0.5,
  wLoad:         0.4,  wFatigue:     0.3, wToxicity: 0.3,
};

function seededRngP4(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function simulateP4(intervention: Intervention, steps = 250, seed = 42): SimResult {
  const p   = BASE_DEGEN_P4;
  const rng = seededRngP4(seed);

  const health   = new Float32Array(N_P4).fill(1);
  const load     = new Float32Array(BASE_CAP_P4);
  const fatigue  = new Float32Array(N_P4);
  const toxicity = new Float32Array(N_P4);
  const alive    = new Uint8Array(N_P4).fill(1);
  const extraCap = new Float32Array(N_P4);

  // ALS init: Motor-A neurons (type 1) start with elevated toxicity
  for (let i = 0; i < N_P4; i++) {
    if (NODE_TYPES_P4[i] === 1) toxicity[i] = p.initTox * 1.8;
  }

  const histAlive: number[] = [];
  let auc = 0, tipStep = -1, maxSlope = 0, prevAlive = N_P4;

  for (let t = 0; t < steps; t++) {
    const aliveCount = alive.reduce((s, v) => s + v, 0);
    histAlive.push(aliveCount);
    auc += aliveCount;

    const slope = prevAlive - aliveCount;
    if (slope > maxSlope) { maxSlope = slope; tipStep = t; }
    prevAlive = aliveCount;

    // ── A) Targeted protection ────────────────────────────────────
    const st  = intervention.startTime ?? 250;
    const dur = intervention.duration  ?? 0;
    if (intervention.type === "protect" && t >= st && t < st + dur) {
      const targets = intervention.global
        ? Array.from({ length: N_P4 }, (_, k) => k)
        : PROTECTIVE_NODES_P4;
      for (const i of targets) extraCap[i] = BASE_CAP_P4[i] * (intervention.strength ?? 0);
    } else {
      extraCap.fill(0);
    }

    // ── Dynamics ──────────────────────────────────────────────────
    const newH = new Float32Array(health);
    const newL = new Float32Array(load);
    const newF = new Float32Array(fatigue);
    const newT = new Float32Array(toxicity);

    // Redistribute load from dead neighbours
    for (let i = 0; i < N_P4; i++) {
      if (!alive[i]) continue;
      newL[i] = BASE_CAP_P4[i] + extraCap[i];
      for (const j of ADJ_P4[i]) {
        if (!alive[j]) {
          const shareCount = Math.max(ADJ_P4[j].filter(k => alive[k]).length, 1);
          newL[i] += load[j] / shareCount;
        }
      }
    }

    for (let i = 0; i < N_P4; i++) {
      if (!alive[i]) continue;
      const cap = BASE_CAP_P4[i] + extraCap[i];

      // B) Toxicity suppression
      let effectiveToxSpread = p.toxSpread;
      if (intervention.type === "toxsup" && t >= (intervention.startTime ?? 250)) {
        effectiveToxSpread *= (1 - (intervention.suppression ?? 0));
      }

      // C) Fatigue recovery boost
      let effectiveRecovery = p.recoveryRate;
      if (intervention.type === "recovery" && t >= (intervention.startTime ?? 250)) {
        effectiveRecovery *= (intervention.multiplier ?? 1);
      }

      const thresh     = cap * (1 - p.aFatigue * fatigue[i]) * (1 - p.aToxicity * toxicity[i]);
      const overload   = Math.max(0, newL[i] - thresh);

      // D) Load redistribution
      let effectiveLoad = newL[i];
      if (intervention.type === "loadredist" && t >= (intervention.startTime ?? 250)) {
        if (ABSORBER_NODES_P4.includes(i))
          effectiveLoad *= (1 + (intervention.absorberBoost ?? 0));
        else
          effectiveLoad *= (1 - (intervention.reduction ?? 0) * 0.3);
      }
      const effectiveOverload = Math.max(0, effectiveLoad - thresh);

      newF[i] = Math.min(1, p.fatigueDecay * fatigue[i] + p.fatigueGain * effectiveOverload / Math.max(cap, 1));

      const nbTox = ADJ_P4[i].length > 0
        ? ADJ_P4[i].reduce((s, j) => s + toxicity[j], 0) / ADJ_P4[i].length
        : 0;
      const dmgTox = (1 - health[i]) * 0.25;
      newT[i] = Math.min(1, p.toxDecay * toxicity[i] + effectiveToxSpread * nbTox + dmgTox);

      // E) Adaptive rewiring
      let rewireBonus = 0;
      if (intervention.type === "rewire" && t >= (intervention.startTime ?? 250) && rng() < (intervention.prob ?? 0)) {
        rewireBonus = 0.003 * (intervention.prob ?? 0);
      }

      const stress   = p.wLoad * (effectiveOverload / Math.max(cap, 1)) + p.wFatigue * fatigue[i] + p.wToxicity * toxicity[i];
      const recovery = effectiveRecovery * (1 - toxicity[i]) + rewireBonus;
      newH[i] = Math.max(0, Math.min(1, health[i] - p.degRate * stress + recovery * 0.01));

      if (newH[i] < p.deathThresh && alive[i]) alive[i] = 0;
    }

    for (let i = 0; i < N_P4; i++) {
      if (!alive[i]) { health[i] = 0; continue; }
      health[i] = newH[i]; load[i] = newL[i]; fatigue[i] = newF[i]; toxicity[i] = newT[i];
    }
  }

  const finalAlive = alive.reduce((s, v) => s + v, 0);
  return { finalAlive, auc, tipStep, maxSlope, histAlive };
}

// ──────────────────────────────────────────────────────────────────
//  BASELINE (module-level)
// ──────────────────────────────────────────────────────────────────

const BASELINE_P4 = simulateP4({ type: "none", family: "none", cost: 0 }, 250, 42);

// ──────────────────────────────────────────────────────────────────
//  SCORING
// ──────────────────────────────────────────────────────────────────

function scoreP4(res: SimResult, baseline: SimResult, cost: number): ScoreResult {
  const survivalGain  = (res.finalAlive - baseline.finalAlive) / N_P4;
  const tipDelay      = res.tipStep >= 0 && baseline.tipStep >= 0
    ? (res.tipStep - baseline.tipStep) / 250 : 0;
  const aucGain       = (res.auc - baseline.auc) / (N_P4 * 250);
  const velocityRedux = baseline.maxSlope > 0
    ? (baseline.maxSlope - res.maxSlope) / baseline.maxSlope : 0;
  const total = 0.3 * survivalGain + 0.2 * tipDelay + 0.25 * aucGain + 0.15 * velocityRedux - 0.1 * cost;
  return { total, survivalGain, tipDelay, aucGain, velocityRedux, costPenalty: cost };
}

// ──────────────────────────────────────────────────────────────────
//  RANDOM CONFIG
// ──────────────────────────────────────────────────────────────────

function randomConfigP4(family: InterventionFamily, rng: () => number): Intervention {
  if (family === "protect") return {
    type: "protect", family: "protect",
    strength: 0.2 + rng() * 1.3, startTime: Math.floor(rng() * 80),
    duration: 30 + Math.floor(rng() * 180), global: rng() < 0.3,
    cost: 0.2 + rng() * 0.5,
  };
  if (family === "toxsup") return {
    type: "toxsup", family: "toxsup",
    suppression: 0.1 + rng() * 0.7, startTime: Math.floor(rng() * 80),
    cost: 0.1 + rng() * 0.4,
  };
  if (family === "recovery") return {
    type: "recovery", family: "recovery",
    multiplier: 1.5 + rng() * 8, startTime: Math.floor(rng() * 80),
    cost: 0.1 + rng() * 0.5,
  };
  if (family === "loadredist") return {
    type: "loadredist", family: "loadredist",
    reduction: 0.1 + rng() * 0.5, absorberBoost: 0.2 + rng() * 0.8,
    startTime: Math.floor(rng() * 80), cost: 0.15 + rng() * 0.4,
  };
  if (family === "rewire") return {
    type: "rewire", family: "rewire",
    prob: 0.05 + rng() * 0.4, startTime: Math.floor(rng() * 80),
    cost: 0.05 + rng() * 0.3,
  };
  return { type: "none", family: "none", cost: 0 };
}

// ──────────────────────────────────────────────────────────────────
//  CHARTS (SVG, prefixed P4)
// ──────────────────────────────────────────────────────────────────

const FAMILY_COLORS: Record<string, string> = {
  protect: P4C.a, toxsup: P4C.red, recovery: P4C.green,
  loadredist: P4C.b, rewire: P4C.purple, none: P4C.dim,
};

const FAMILY_LABELS: Record<string, string> = {
  protect: "Targeted Protection", toxsup: "Toxicity Suppression",
  recovery: "Fatigue Recovery", loadredist: "Load Redistribution", rewire: "Adaptive Rewiring",
};

interface P4LineSeries { label: string; data: number[]; color: string; bold?: boolean; dash?: boolean; dim?: boolean; }
interface P4LineChartProps { series: P4LineSeries[]; height?: number; width?: number; title?: string; }

function P4LineChart({ series, height=100, width=440, title }: P4LineChartProps) {
  const pad = { t:22, r:12, b:20, l:38 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const all = series.flatMap(s => s.data).filter(isFinite);
  if (!all.length) return null;
  const yMin = Math.min(...all), yMax = Math.max(...all) || 1;
  const xLen = Math.max(...series.map(s => s.data.length), 2);
  const tx = (i: number) => (i / Math.max(xLen - 1, 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const mkPath = (d: number[]) =>
    d.map((v, i) => isFinite(v) ? `${i === 0 ? "M" : "L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}` : "")
     .filter(Boolean).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {title && <text x={pad.l+W/2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/>
            <text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={8} fill="#3a5570">
              {Math.round(yMin + f * (yMax - yMin))}
            </text>
          </g>
        ))}
        {series.map(s => (
          <path key={s.label} d={mkPath(s.data)} fill="none" stroke={s.color}
            strokeWidth={s.bold ? 2.5 : 1.5} strokeLinejoin="round"
            opacity={s.dim ? 0.4 : 1} strokeDasharray={s.dash ? "5,3" : "none"}/>
        ))}
      </g>
    </svg>
  );
}

function P4ScatterSearch({ results, width=440, height=160 }: { results: SearchEntry[]; width?: number; height?: number; }) {
  if (!results.length) return null;
  const pad = { t:20, r:12, b:24, l:38 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const scores = results.map(r => r.score.total);
  const gains  = results.map(r => r.score.survivalGain * N_P4);
  const yMin = Math.min(...gains), yMax = Math.max(...gains) || 1;
  const xMin = Math.min(...scores), xMax = Math.max(...scores) || 1;
  const tx = (v: number) => ((v - xMin) / (xMax - xMin || 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l+W/2} y={13} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        SEARCH LANDSCAPE — score vs survival gain
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/>
            <text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={7} fill="#3a5570">
              {(yMin + f*(yMax-yMin)).toFixed(1)}
            </text>
          </g>
        ))}
        <line x1={0} x2={W} y1={ty(0)} y2={ty(0)} stroke="#1a3050" strokeWidth={1} strokeDasharray="3,2"/>
        {results.map((r, i) => (
          <circle key={i}
            cx={tx(r.score.total)} cy={ty(r.score.survivalGain * N_P4)} r={i < 3 ? 6 : 3}
            fill={FAMILY_COLORS[r.config.family] ?? P4C.dim}
            opacity={i < 10 ? 0.9 : 0.35}/>
        ))}
      </g>
    </svg>
  );
}

function P4ImportanceBar({ importance, width=440, height=110 }: { importance: ImportanceEntry[]; width?: number; height?: number; }) {
  const pad  = { t:18, r:16, b:14, l:120 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const top  = importance.slice(0, 7);
  const maxR = Math.max(...top.map(d => Math.abs(d.r)), 0.01);
  const rowH = H / top.length;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l+W/2} y={12} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        PARAMETER IMPORTANCE (|r| with rescue score)
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        <line x1={0} x2={0} y1={0} y2={H} stroke="#1a3050" strokeWidth={1}/>
        {top.map((d, i) => {
          const bw  = (Math.abs(d.r) / maxR) * W * 0.9;
          const y   = i * rowH + rowH * 0.15;
          const bh  = rowH * 0.7;
          const col = d.r > 0 ? P4C.green : P4C.red;
          return (
            <g key={i}>
              <text x={-6} y={y+bh/2+4} textAnchor="end" fontSize={9} fill={col}>{d.param}</text>
              <rect x={0} y={y} width={bw} height={bh} fill={col} rx={2} opacity={0.8}/>
              <text x={bw+4} y={y+bh/2+4} fontSize={9} fill={col}>{d.r.toFixed(3)}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function P4BestEvolution({ bestByGen, width=440, height=100 }: { bestByGen: Array<{gen:number;best:number}>; width?: number; height?: number; }) {
  if (!bestByGen.length) return null;
  const pad = { t:20, r:12, b:18, l:38 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const ys = bestByGen.map(d => d.best);
  const yMin = Math.min(...ys), yMax = Math.max(...ys) || 1;
  const xLen = bestByGen.length;
  const tx = (i: number) => (i / Math.max(xLen - 1, 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const path = bestByGen.map((d, i) =>
    `${i === 0 ? "M" : "L"}${tx(i).toFixed(1)},${ty(d.best).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l+W/2} y={13} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        BEST SCORE OVER SEARCH ITERATIONS
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/>
            <text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={7} fill="#3a5570">
              {(yMin + f*(yMax-yMin)).toFixed(3)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke={P4C.b} strokeWidth={2.2} strokeLinejoin="round"/>
      </g>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────
//  UI ATOMS
// ──────────────────────────────────────────────────────────────────

interface P4StatProps { label: string; value: string; color: string; sub?: string; big?: boolean; }

function P4Stat({ label, value, color, sub, big }: P4StatProps) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22` }}>
      <div className="text-xs uppercase tracking-widest" style={{ color: P4C.dim }}>{label}</div>
      <div style={{ fontSize: big ? 20 : 15, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1.2 }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#1e3050" }}>{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  RESEARCH FINDING
// ──────────────────────────────────────────────────────────────────

function P4ResearchFinding({ searchData }: { searchData: SearchData }) {
  const { results, importance } = searchData;
  const top = results[0];
  if (!top) return null;

  const bestFamily       = top.config.family;
  const bestFamilyColor  = FAMILY_COLORS[bestFamily] ?? P4C.dim;
  const topImportance    = importance[0];
  const earlyWins        = results.slice(0, 10).filter(r => (r.config.startTime ?? 250) < 40).length;
  const costCorr         = importance.find(d => d.param === "cost")?.r ?? 0;
  const posGain          = results.filter(r => r.score.survivalGain > 0).length;
  const negGain          = results.filter(r => r.score.survivalGain < -0.5 / N_P4).length;

  return (
    <div className="rounded-xl p-5"
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${bestFamilyColor}44` }}>
      <div className="text-xs tracking-widest mb-3.5" style={{ color: bestFamilyColor, letterSpacing: "0.15em" }}>
        PHASE 4 — INTERVENTION DISCOVERY FINDINGS
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <P4Stat label="Best strategy"
          value={(FAMILY_LABELS[bestFamily] ?? bestFamily).split(" ")[0]}
          color={bestFamilyColor} sub={`score=${top.score.total.toFixed(3)}`}/>
        <P4Stat label="Max survival gain"
          value={`+${(top.score.survivalGain * N_P4).toFixed(1)}`}
          color={top.score.survivalGain > 0 ? P4C.green : P4C.red}
          sub="neurons saved vs baseline"/>
        <P4Stat label="Top parameter"
          value={topImportance?.param ?? "—"}
          color={P4C.b}
          sub={`|r|=${Math.abs(topImportance?.r ?? 0).toFixed(3)}`}/>
        <P4Stat label="Configs tested"
          value={`${results.length}`}
          color={P4C.a}
          sub={`${posGain} improved / ${negGain} worsened`}/>
      </div>

      <div className="text-sm leading-relaxed max-w-4xl mb-4" style={{ color: "#8ab0cc" }}>
        {top.score.survivalGain > 0
          ? `✅ Best strategy: ${FAMILY_LABELS[bestFamily]} saved ${(top.score.survivalGain * N_P4).toFixed(1)} neurons.`
          : `⚠️ No intervention improved survival in ${results.length} trials — this network is resistant to intervention.`}
        {" "}
        {earlyWins >= 6
          ? `Early intervention (startTime<40) dominated the top-10 — timing matters more than strength.`
          : `Timing had no dominant effect — intensity was the more important parameter.`}
        {" "}
        {costCorr < -0.2
          ? `Higher cost correlated negatively with outcomes — cheaper interventions were more effective.`
          : `The cost-benefit relationship was non-linear in this search.`}
        {" "}
        {negGain > results.length * 0.2
          ? `⚠️ ${negGain} configurations worsened the cascade — some interventions are counter-productive.`
          : `Most interventions were neutral or positive.`}
      </div>

      <div className="rounded-lg p-3.5 text-xs leading-relaxed"
        style={{ background: "rgba(0,0,0,0.3)", color: P4C.dim }}>
        <span style={{ color: P4C.a }}>Important limitations: </span>
        This is a random search over a simulator. Results depend strongly on BASE_DEGEN parameters.
        Parameter importance is computed from Pearson r, not SHAP values.
        These findings are hypothesis-generating and require experimental validation.
        <br/>
        <span style={{ color: P4C.a }}>Next research direction: </span>
        Pairwise combinations of the best family &times; timing, with tighter grid search.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────

export default function Phase4Intervention() {
  const [nConfigs,   setNConfigs]   = useState(80);
  const [running,    setRunning]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [activeTop,  setActiveTop]  = useState(0);
  const cancelRef = useRef<boolean>(false);

  const run = () => {
    cancelRef.current = false;
    setRunning(true); setProgress(0); setSearchData(null);

    const rng = seededRngP4(99);
    const families: InterventionFamily[] = ["protect","toxsup","recovery","loadredist","rewire"];
    const allResults: SearchEntry[] = [];
    const bestByGen: Array<{gen: number; best: number}> = [];
    let bestSoFar = -Infinity;
    let idx = 0;

    const chunk = () => {
      if (cancelRef.current) { setRunning(false); return; }
      const CHUNK = 8;
      for (let c = 0; c < CHUNK && idx < nConfigs; c++, idx++) {
        const family = families[Math.floor(rng() * families.length)];
        const config = randomConfigP4(family, rng);
        const res    = simulateP4(config, 250, 42 + idx);
        const sc     = scoreP4(res, BASELINE_P4, config.cost);
        allResults.push({ config, res, score: sc, id: idx });
        if (sc.total > bestSoFar) bestSoFar = sc.total;
        if (idx % 5 === 0) bestByGen.push({ gen: idx, best: bestSoFar });
      }
      setProgress(Math.round(idx / nConfigs * 100));

      if (idx < nConfigs) {
        setTimeout(chunk, 0);
      } else {
        allResults.sort((a, b) => b.score.total - a.score.total);

        const params = ["startTime","duration","strength","suppression","multiplier","reduction","absorberBoost","prob","cost"];
        const importance: ImportanceEntry[] = params.map(p => {
          const pairs = allResults
            .map(r => ({ x: r.config[p as keyof Intervention] as number | undefined, y: r.score.total }))
            .filter((d): d is {x: number; y: number} => typeof d.x === "number");
          if (pairs.length < 5) return { param: p, r: 0 };
          const mx  = pairs.reduce((a, b) => a + b.x, 0) / pairs.length;
          const my  = pairs.reduce((a, b) => a + b.y, 0) / pairs.length;
          const num = pairs.reduce((s, d) => s + (d.x - mx) * (d.y - my), 0);
          const dx  = Math.sqrt(pairs.reduce((s, d) => s + (d.x - mx) ** 2, 0));
          const dy  = Math.sqrt(pairs.reduce((s, d) => s + (d.y - my) ** 2, 0));
          return { param: p, r: dx * dy < 1e-9 ? 0 : num / (dx * dy) };
        }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

        const bestPerFamily = families.map(f => ({
          family: f,
          result: allResults.find(x => x.config.family === f) ?? null,
        }));

        setSearchData({ results: allResults, bestByGen, importance, bestPerFamily });
        setActiveTop(0);
        setRunning(false);
      }
    };
    setTimeout(chunk, 20);
  };

  const S          = searchData;
  const topResult  = S ? S.results[activeTop] : null;

  const survivalSeries: P4LineSeries[] = S ? [
    { label: "Baseline", data: BASELINE_P4.histAlive, color: P4C.dim, bold: false, dash: true },
    ...S.results.slice(0, 5).map((r, i) => ({
      label: `#${i+1}`,
      data:  r.res.histAlive,
      color: [P4C.green, P4C.b, P4C.a, P4C.orange, P4C.purple][i],
      bold:  i === 0,
    })),
  ] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="text-xs tracking-widest mb-1" style={{ color: P4C.purple, letterSpacing: "0.4em" }}>
          PHASE 4 — INTERVENTION DISCOVERY ENGINE
        </div>
        <h2 className="text-xl font-black tracking-tight mb-1"
          style={{ background: "linear-gradient(100deg,#a855f7,#ff9944 40%,#a8ff78)",
                   WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Autonomous Rescue Strategy Search
        </h2>
        <p className="text-xs max-w-2xl" style={{ color: P4C.dim }}>
          The system automatically tests <strong style={{ color: P4C.purple }}>{nConfigs}</strong> intervention configurations.{" "}
          <span style={{ color: P4C.purple }}>
            Question: which strategy creates the best resistance against network collapse?
          </span>
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        {/* ── Sidebar ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ minWidth: 185, maxWidth: 200 }}>

          {/* Search config */}
          <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-2.5" style={{ color: P4C.dim }}>SEARCH CONFIG</div>
            <div className="text-xs mb-1" style={{ color: P4C.dim }}>
              Configs: <span style={{ color: P4C.purple, fontWeight: 700 }}>{nConfigs}</span>
            </div>
            <input type="range" min={20} max={200} step={10} value={nConfigs}
              onChange={e => setNConfigs(parseInt(e.target.value))}
              className="w-full" style={{ accentColor: P4C.purple }}/>
            <div className="text-xs mt-3 mb-3.5 leading-7" style={{ color: P4C.dim }}>
              5 intervention families:<br/>
              A) Targeted Protection<br/>
              B) Toxicity Suppression<br/>
              C) Fatigue Recovery<br/>
              D) Load Redistribution<br/>
              E) Adaptive Rewiring<br/>
              <br/>
              Score = 0.3×survival + 0.2×tip_delay + 0.25×AUC + 0.15×velocity - 0.1×cost
            </div>
            <button onClick={run} disabled={running}
              className="w-full py-2.5 rounded-lg font-mono font-bold text-xs tracking-wider"
              style={{
                background: running ? "#162030" : "rgba(168,85,247,0.12)",
                border:     `1px solid ${running ? "#162030" : P4C.purple}`,
                color:      running ? P4C.dim : P4C.purple,
                cursor:     running ? "not-allowed" : "pointer",
              }}>
              {running ? `⏳ ${progress}%` : "▶ SEARCH"}
            </button>
            {running && (
              <div className="mt-1.5 rounded overflow-hidden" style={{ background: "#0a1525", height: 5 }}>
                <div style={{ height: "100%", width: `${progress}%`, background: P4C.purple, transition: "width 0.3s" }}/>
              </div>
            )}
          </div>

          {/* Family legend */}
          <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-2" style={{ color: P4C.dim }}>FAMILIES</div>
            {Object.entries(FAMILY_LABELS).map(([k, l]) => (
              <div key={k} className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded flex-shrink-0" style={{ background: FAMILY_COLORS[k] }}/>
                <div className="text-xs" style={{ color: FAMILY_COLORS[k] }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Top result selector */}
          {S && (
            <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
              <div className="text-xs tracking-widest mb-2" style={{ color: P4C.dim }}>VIEW TOP</div>
              {([0,1,2,3,4] as const).map(i => S.results[i] && (
                <button key={i} onClick={() => setActiveTop(i)}
                  className="w-full mb-1 text-left text-xs font-mono rounded py-1.5 px-2"
                  style={{
                    background: activeTop === i ? `${FAMILY_COLORS[S.results[i].config.family]}18` : "transparent",
                    border:     `1px solid ${activeTop === i ? FAMILY_COLORS[S.results[i].config.family] : "#162030"}`,
                    color:      activeTop === i ? FAMILY_COLORS[S.results[i].config.family] : P4C.dim,
                    cursor:     "pointer",
                  }}>
                  #{i+1} {S.results[i].config.family} (s={S.results[i].score.total.toFixed(3)})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Main panel ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">
          {S && (
            <>
              {/* Top result detail */}
              {topResult && (
                <div className="rounded-xl p-4"
                  style={{ background: `${FAMILY_COLORS[topResult.config.family]}0c`,
                           border: `1px solid ${FAMILY_COLORS[topResult.config.family]}44` }}>
                  <div className="text-xs tracking-widest mb-2.5"
                    style={{ color: FAMILY_COLORS[topResult.config.family], letterSpacing: "0.1em" }}>
                    #{activeTop+1} BEST: {FAMILY_LABELS[topResult.config.family]}
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {[
                      { l: "Survival gain", v: `+${(topResult.score.survivalGain * N_P4).toFixed(1)}`,
                        c: topResult.score.survivalGain > 0 ? P4C.green : P4C.red },
                      { l: "Tip delay",     v: topResult.score.tipDelay > 0 ? `+${(topResult.score.tipDelay * 250).toFixed(0)}s` : "none",
                        c: P4C.orange },
                      { l: "AUC gain",      v: (topResult.score.aucGain * 100).toFixed(1) + "%",  c: P4C.a },
                      { l: "Vel. redux",    v: (topResult.score.velocityRedux * 100).toFixed(1) + "%", c: P4C.b },
                      { l: "Cost",          v: topResult.config.cost.toFixed(2), c: P4C.dim },
                    ].map(({ l, v, c }) => (
                      <div key={l} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${c}22` }}>
                        <div style={{ fontSize: 8, color: P4C.dim, letterSpacing: 1 }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: c, fontFamily: "monospace" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs" style={{ color: P4C.dim }}>
                    {Object.entries(topResult.config)
                      .filter(([k]) => !["type","family"].includes(k))
                      .map(([k, v]) => (
                        <span key={k} className="mr-3.5">
                          <span style={{ color: P4C.dim }}>{k}=</span>
                          <span style={{ color: FAMILY_COLORS[topResult.config.family], fontFamily: "monospace" }}>
                            {typeof v === "number" ? v.toFixed(3) : String(v ?? "")}
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Key stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <P4Stat label="Baseline survivors" value={`${BASELINE_P4.finalAlive}/${N_P4}`}
                  color={P4C.dim} sub="no intervention"/>
                <P4Stat label="Best survivors" value={`${S.results[0]?.res.finalAlive ?? 0}/${N_P4}`}
                  color={P4C.green} big
                  sub={`+${(S.results[0]?.res.finalAlive ?? 0) - BASELINE_P4.finalAlive} vs baseline`}/>
                <P4Stat label="Improved configs"
                  value={`${S.results.filter(r => r.score.survivalGain > 0).length}/${S.results.length}`}
                  color={P4C.b}/>
                <P4Stat label="Best family"
                  value={S.results[0]?.config.family ?? "—"}
                  color={FAMILY_COLORS[S.results[0]?.config.family ?? "none"] ?? P4C.dim}/>
              </div>

              {/* Search evolution */}
              <div className="rounded-xl p-4 overflow-x-auto"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <P4BestEvolution bestByGen={S.bestByGen} width={520} height={100}/>
              </div>

              {/* Survival curves */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <P4LineChart series={survivalSeries} height={120} width={520}
                  title="SURVIVAL CURVES — baseline vs top 5 interventions"/>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {([["Baseline",P4C.dim],["#1",P4C.green],["#2",P4C.b],["#3",P4C.a],["#4",P4C.orange],["#5",P4C.purple]] as [string,string][])
                    .map(([l, col]) => (
                      <span key={l} className="flex items-center gap-1 text-xs" style={{ color: col }}>
                        <span style={{ width: 10, height: 2, background: col, display: "inline-block" }}/>{l}
                      </span>
                    ))}
                </div>
              </div>

              {/* Scatter + Importance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="rounded-xl p-3.5 overflow-x-auto"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                  <P4ScatterSearch results={S.results} width={250} height={160}/>
                </div>
                <div className="rounded-xl p-3.5 overflow-x-auto"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                  <P4ImportanceBar importance={S.importance} width={250} height={120}/>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <div className="text-xs tracking-widest mb-2.5" style={{ color: P4C.dim }}>
                  INTERVENTION LEADERBOARD — TOP 10
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["#","Family","Score","Survival+","Tip delay","AUC","Start","Cost"].map(h => (
                          <th key={h} className="text-left px-2 py-1"
                            style={{ color: P4C.dim, borderBottom: "1px solid #162030", fontSize: 8, letterSpacing: 1 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {S.results.slice(0, 10).map((r, i) => {
                        const col = FAMILY_COLORS[r.config.family] ?? P4C.dim;
                        return (
                          <tr key={i} style={{ background: i < 3 ? `${col}08` : "transparent", cursor: "pointer" }}
                            onClick={() => setActiveTop(i)}>
                            <td className="px-2 py-1 font-bold" style={{ color: col }}>#{i+1}</td>
                            <td className="px-2 py-1" style={{ color: col }}>{r.config.family}</td>
                            <td className="px-2 py-1 font-bold" style={{ color: P4C.b }}>{r.score.total.toFixed(4)}</td>
                            <td className="px-2 py-1" style={{ color: r.score.survivalGain > 0 ? P4C.green : P4C.red }}>
                              {r.score.survivalGain > 0 ? "+" : ""}{(r.score.survivalGain * N_P4).toFixed(1)}
                            </td>
                            <td className="px-2 py-1" style={{ color: P4C.orange }}>
                              {r.score.tipDelay > 0 ? `+${(r.score.tipDelay * 250).toFixed(0)}` : "—"}
                            </td>
                            <td className="px-2 py-1" style={{ color: P4C.a }}>{(r.score.aucGain * 100).toFixed(2)}%</td>
                            <td className="px-2 py-1" style={{ color: P4C.dim }}>{r.config.startTime ?? "-"}</td>
                            <td className="px-2 py-1" style={{ color: P4C.dim }}>{r.config.cost.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Best per family */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <div className="text-xs tracking-widest mb-2.5" style={{ color: P4C.dim }}>BEST PER FAMILY</div>
                <div className="grid grid-cols-5 gap-2">
                  {S.bestPerFamily.map(({ family, result }) => {
                    const col     = FAMILY_COLORS[family] ?? P4C.dim;
                    const gainNum = result ? result.score.survivalGain * N_P4 : 0;
                    const gainStr = result
                      ? `${gainNum >= 0 ? "+" : ""}${gainNum.toFixed(1)}`
                      : "—";
                    return (
                      <div key={family} className="rounded-lg p-2.5"
                        style={{ background: `${col}0c`, border: `1px solid ${col}33` }}>
                        <div className="text-xs font-bold mb-1" style={{ color: col }}>{family}</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: col, fontFamily: "monospace" }}>{gainStr}</div>
                        <div style={{ fontSize: 8, color: P4C.dim }}>survivors</div>
                        <div className="text-xs mt-1" style={{ color: P4C.dim }}>
                          score: {result?.score.total.toFixed(3) ?? "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <P4ResearchFinding searchData={S}/>
            </>
          )}

          {!S && (
            <div className="flex items-center justify-center rounded-2xl"
              style={{ height: 300, color: "#162030", fontSize: 12, letterSpacing: "0.2em", border: "1px dashed #162030" }}>
              PRESS SEARCH TO START AUTONOMOUS DISCOVERY
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

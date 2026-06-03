"use client";
import { useState, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EMSParams {
  target: number; magicSteps: number; seed: number; lambdaE: number; attackK: number;
}
interface EMSRunResult {
  score: number; resilience: number; rRand: number; rTarg: number; rCasc: number; sg: number;
}
interface EMSAlphaStat {
  mean: number; std: number; ci: number; n: number; rRand: number; rTarg: number; rCasc: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMS_ALPHAS  = [0.0, 0.1, 0.3, 0.5, 1.0];
const EMS_COLORS  = ["#4488ff", "#00e5ff", "#a8ff78", "#ffd700", "#ff9944"];
const EMS_C = {
  a: "#00e5ff", b: "#ffd700", green: "#a8ff78", red: "#ff6b6b",
  orange: "#ff9944", dim: "#3a5570",
};
const EMS_NUM_SEEDS = 15;
const EMS_SA_STEPS  = 40;

// ── Math helpers ──────────────────────────────────────────────────────────────

function emsRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function emsMakeAdj(n: number, edges: number[][]): Set<number>[] {
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (const [a, b] of edges) { adj[a].add(b); adj[b].add(a); }
  return adj;
}
function emsAdjList(adj: Set<number>[]): number[][] { return adj.map(s => [...s]); }

function emsConnected(adj: Set<number>[]): boolean {
  const n = adj.length, vis = new Uint8Array(n), q = [0]; vis[0] = 1; let c = 1;
  while (q.length) for (const v of adj[q.pop()!]) if (!vis[v]) { vis[v] = 1; c++; q.push(v); }
  return c === n;
}

function emsInitGraph(n: number, tgt: number, seed: number): number[][] {
  const rng = emsRng(seed);
  const key = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;
  const S = new Set<string>();
  for (let i = 0; i < n - 1; i++) S.add(key(i, i + 1));
  let att = 0;
  while (S.size < tgt && att < 300000) {
    att++;
    const a = Math.floor(rng() * n), b = Math.floor(rng() * n);
    if (a !== b) S.add(key(a, b));
  }
  return [...S].map(k => k.split(",").map(Number));
}

function emsDot(a: Float64Array, b: Float64Array): number {
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
}
function emsDefl(v: Float64Array, u: Float64Array): Float64Array {
  const d = emsDot(v, u), r = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) r[i] = v[i] - d * u[i];
  return r;
}
function emsNormV(v: Float64Array): Float64Array {
  const m = Math.sqrt(emsDot(v, v));
  if (m < 1e-12) return v;
  const r = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) r[i] = v[i] / m;
  return r;
}

function emsSpectralGap(n: number, adjList: number[][], iters = 60): number {
  if (n < 3) return 0;
  const deg = adjList.map(nb => nb.length);
  const shift = 2 * Math.max(...deg) + 1;
  const u1 = new Float64Array(n).fill(1 / Math.sqrt(n));
  const Lx = (x: Float64Array): Float64Array => {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { y[i] = deg[i] * x[i]; for (const j of adjList[i]) y[i] -= x[j]; }
    return y;
  };
  const rng = emsRng(37);
  let v = emsNormV(emsDefl(Float64Array.from({ length: n }, () => rng() - 0.5), u1));
  let l2 = 0;
  for (let it = 0; it < iters; it++) {
    const Lv = Lx(v);
    const w0 = new Float64Array(n); for (let i = 0; i < n; i++) w0[i] = shift * v[i] - Lv[i];
    const w = emsDefl(w0, u1);
    const r = Math.sqrt(emsDot(w, w)); if (r < 1e-12) break;
    l2 = shift - emsDot(v, w) / emsDot(v, v);
    v = emsNormV(w);
  }
  return Math.max(0, l2);
}

function emsMagicE(adjList: number[][], x: ArrayLike<number>, tgt: number): number {
  return adjList.reduce((s, nb) => s + (nb.reduce((a, j) => a + x[j], 0) - tgt) ** 2, 0);
}

function emsOptMagic(adjList: number[][], tgt: number, steps: number, seed: number): Float64Array {
  const n = adjList.length, rng = emsRng(seed), lr = 0.002, eps = 1e-4;
  let x = Float64Array.from({ length: n }, () => rng() * 10);
  for (let t = 0; t < steps; t++) {
    const base = emsMagicE(adjList, x, tgt);
    const grad = Array.from({ length: n }, (_, k) => {
      const xp = Array.from(x); xp[k] += eps;
      return (emsMagicE(adjList, xp, tgt) - base) / eps;
    });
    x = x.map((v, k) => Math.max(0, Math.min(100, v - lr * grad[k])));
  }
  return x;
}

function emsAttackRandom(adjList: number[][], k: number, seed: number): number {
  const n = adjList.length, rng = emsRng(seed + 77);
  const dead = new Set([...Array(n).keys()].sort(() => rng() - 0.5).slice(0, k));
  return (n - dead.size) / n;
}

function emsAttackTargeted(adjList: number[][], k: number): number {
  const n = adjList.length, alive = new Set([...Array(n).keys()]);
  for (let r = 0; r < k; r++) {
    if (!alive.size) break;
    let best = -1, bd = -1;
    for (const i of alive) { const d = adjList[i].filter(j => alive.has(j)).length; if (d > bd) { bd = d; best = i; } }
    alive.delete(best);
  }
  return alive.size / n;
}

function emsAttackCascade(adjList: number[][], initialDead: number[]): number {
  const n = adjList.length;
  const cap = adjList.map(nb => Math.max(nb.length, 1));
  const load = new Float64Array(cap);
  const alive = new Uint8Array(n).fill(1);
  let queue = [...initialDead];
  for (const nd of queue) alive[nd] = 0;
  let changed = true;
  while (changed) {
    changed = false; const dying: number[] = [];
    for (const dead of queue) {
      const lnb = adjList[dead].filter(j => alive[j]);
      if (!lnb.length) continue;
      const extra = load[dead] / lnb.length;
      for (const nb of lnb) {
        load[nb] += extra;
        if (load[nb] > cap[nb] * 1.5 && alive[nb]) { alive[nb] = 0; dying.push(nb); changed = true; }
      }
    }
    queue = dying;
  }
  return alive.reduce((s, v) => s + v, 0) / n;
}

function emsTopK(adjList: number[][], k: number): number[] {
  return [...Array(adjList.length).keys()].sort((a, b) => adjList[b].length - adjList[a].length).slice(0, k);
}

function emsEvaluate(edges: number[][], n: number, params: EMSParams, alpha: number): EMSRunResult {
  const { target, magicSteps, seed, lambdaE, attackK } = params;
  const adjSets = emsMakeAdj(n, edges);
  const adjList = emsAdjList(adjSets);
  const x = emsOptMagic(adjList, target, magicSteps, seed);
  const energy = emsMagicE(adjList, x, target);
  const normE  = energy / (n * target * target);
  const sg     = emsSpectralGap(n, adjList);
  const rRand  = emsAttackRandom(adjList, attackK, seed);
  const rTarg  = emsAttackTargeted(adjList, attackK);
  const rCasc  = emsAttackCascade(adjList, emsTopK(adjList, attackK));
  const resilience = 0.2 * rRand + 0.4 * rTarg + 0.4 * rCasc;
  const score = resilience + alpha * (sg / 2) - lambdaE * normE;
  return { score, resilience, rRand, rTarg, rCasc, sg };
}

function emsSAStep(edges: number[][], n: number, rng: () => number): number[][] | null {
  const ri = Math.floor(rng() * edges.length);
  const [ra, rb] = edges[ri];
  const S = new Set(edges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`));
  S.delete(`${Math.min(ra, rb)},${Math.max(ra, rb)}`);
  let na = 0, nb = 0, att = 0;
  do { na = Math.floor(rng() * n); nb = Math.floor(rng() * n); att++; }
  while ((na === nb || S.has(`${Math.min(na, nb)},${Math.max(na, nb)}`)) && att < 300);
  if (att >= 300) return null;
  const ne = [...edges.filter((_, i) => i !== ri), [na, nb]];
  return emsConnected(emsMakeAdj(n, ne)) ? ne : null;
}

function emsRunOneSA(n: number, edgeCount: number, saSteps: number,
  params: EMSParams, alpha: number, graphSeed: number): EMSRunResult {
  const initEdges = emsInitGraph(n, edgeCount, graphSeed);
  const rng = emsRng(graphSeed * 100 + Math.round(alpha * 37));
  let curEdges = initEdges;
  let curScore = emsEvaluate(initEdges, n, params, alpha).score;
  let bstScore = curScore, bstEdges = initEdges;
  const T0 = 0.3;
  for (let step = 0; step < saSteps; step++) {
    const T = T0 * Math.exp(-3 * step / saSteps);
    const cand = emsSAStep(curEdges, n, rng);
    if (!cand) continue;
    const res = emsEvaluate(cand, n, { ...params, seed: params.seed + step }, alpha);
    const d = res.score - curScore;
    if (d > 0 || Math.random() < Math.exp(d / Math.max(T, 1e-6))) {
      curEdges = cand; curScore = res.score;
      if (res.score > bstScore) { bstScore = res.score; bstEdges = cand; }
    }
  }
  return emsEvaluate(bstEdges, n, params, alpha);
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

function emsMean(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function emsStd(arr: number[]): number {
  const m = emsMean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function emsCi95(arr: number[]): number { return 1.96 * emsStd(arr) / Math.sqrt(arr.length); }
function emsCiOverlap(m1: number, ci1: number, m2: number, ci2: number): boolean {
  return !((m1 + ci1) < (m2 - ci2) || (m2 + ci2) < (m1 - ci1));
}

// ── Charts ────────────────────────────────────────────────────────────────────

function EMSCIChart({ alphaStats, width = 540, height = 160 }: {
  alphaStats: (EMSAlphaStat | null)[]; width?: number; height?: number;
}) {
  const pad = { t: 24, r: 20, b: 32, l: 44 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const valid = alphaStats.filter((s): s is EMSAlphaStat => s != null && s.n > 0);
  if (!valid.length) return null;
  const allMeans = valid.map(s => s.mean), allCIs = valid.map(s => s.ci);
  const yMin = Math.max(0, Math.min(...allMeans.map((m, i) => m - allCIs[i])) - 0.02);
  const yMax = Math.min(1, Math.max(...allMeans.map((m, i) => m + allCIs[i])) + 0.02);
  const tx = (i: number) => (i / (EMS_ALPHAS.length - 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const topPts = alphaStats.map((s, i) => s ? { x: tx(i), y: ty(s.mean + s.ci) } : null).filter((p): p is { x: number; y: number } => p != null);
  const botPts = alphaStats.map((s, i) => s ? { x: tx(i), y: ty(s.mean - s.ci) } : null).filter((p): p is { x: number; y: number } => p != null);
  const ribbonPath = topPts.length > 1
    ? topPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      + " " + [...botPts].reverse().map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z"
    : "";
  const meanPath = alphaStats.map((s, i) => s ? `${i === 0 ? "M" : "L"}${tx(i).toFixed(1)},${ty(s.mean).toFixed(1)}` : "").filter(Boolean).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={15} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        MEAN RESILIENCE +/- 95% CI (n={EMS_NUM_SEEDS} seeds per alpha)
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={8} fill="#3a5570">
              {(yMin + f * (yMax - yMin)).toFixed(2)}
            </text>
          </g>
        ))}
        {EMS_ALPHAS.map((a, i) => (
          <text key={i} x={tx(i)} y={H + 16} textAnchor="middle" fontSize={9} fill="#4a6a8a">{a}</text>
        ))}
        <text x={W / 2} y={H + 28} textAnchor="middle" fontSize={9} fill="#3a5570">alpha (spectral weight)</text>
        {ribbonPath && <path d={ribbonPath} fill={EMS_C.a} opacity={0.12} />}
        {meanPath && <path d={meanPath} fill="none" stroke={EMS_C.a} strokeWidth={2.5} strokeLinejoin="round" />}
        {alphaStats.map((s, i) => s && s.n > 0 ? (
          <g key={i}>
            <line x1={tx(i)} x2={tx(i)} y1={ty(s.mean + s.ci)} y2={ty(s.mean - s.ci)}
              stroke={EMS_COLORS[i]} strokeWidth={2} opacity={0.7} />
            <line x1={tx(i) - 6} x2={tx(i) + 6} y1={ty(s.mean + s.ci)} y2={ty(s.mean + s.ci)} stroke={EMS_COLORS[i]} strokeWidth={1.5} />
            <line x1={tx(i) - 6} x2={tx(i) + 6} y1={ty(s.mean - s.ci)} y2={ty(s.mean - s.ci)} stroke={EMS_COLORS[i]} strokeWidth={1.5} />
            <circle cx={tx(i)} cy={ty(s.mean)} r={6} fill={EMS_COLORS[i]} opacity={0.95} />
            <text x={tx(i)} y={ty(s.mean) - 10} textAnchor="middle" fontSize={8} fill={EMS_COLORS[i]} fontWeight="bold">
              {(s.mean * 100).toFixed(1)}%
            </text>
          </g>
        ) : null)}
      </g>
    </svg>
  );
}

function EMSAttackChart({ alphaStats, attackKey, label, color, width = 540, height = 100 }: {
  alphaStats: (EMSAlphaStat | null)[]; attackKey: "rRand" | "rTarg" | "rCasc";
  label: string; color: string; width?: number; height?: number;
}) {
  const pad = { t: 20, r: 20, b: 28, l: 44 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const vals = alphaStats.map(s => s ? s[attackKey] : null);
  const allV = vals.filter((v): v is number => v != null);
  if (!allV.length) return null;
  const yMin = Math.max(0, Math.min(...allV) - 0.05);
  const yMax = Math.min(1, Math.max(...allV) + 0.05);
  const tx = (i: number) => (i / (EMS_ALPHAS.length - 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const mkPath = (arr: (number | null)[]) =>
    arr.map((v, i) => v != null ? `${i === 0 ? "M" : "L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}` : "").filter(Boolean).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={13} textAnchor="middle" fontSize={9} fill={color} letterSpacing={1}>{label}</text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={7} fill="#3a5570">
              {(yMin + f * (yMax - yMin)).toFixed(2)}
            </text>
          </g>
        ))}
        {EMS_ALPHAS.map((a, i) => (
          <text key={i} x={tx(i)} y={H + 14} textAnchor="middle" fontSize={8} fill="#3a5570">{a}</text>
        ))}
        <path d={mkPath(vals)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeDasharray="4,2" />
        {vals.map((v, i) => v != null ? (
          <circle key={i} cx={tx(i)} cy={ty(v)} r={4} fill={color} opacity={0.85} />
        ) : null)}
      </g>
    </svg>
  );
}

function EMSSeedScatter({ seedResults, width = 540, height = 130 }: {
  seedResults: (number | null)[][]; width?: number; height?: number;
}) {
  const pad = { t: 20, r: 20, b: 28, l: 44 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const allV = seedResults.flatMap(row => row.filter((v): v is number => v != null));
  if (!allV.length) return null;
  const yMin = Math.max(0, Math.min(...allV) - 0.03);
  const yMax = Math.min(1, Math.max(...allV) + 0.03);
  const tx = (i: number) => (i / (EMS_ALPHAS.length - 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={13} textAnchor="middle" fontSize={9} fill="#5a7a9a" letterSpacing={1}>
        RAW SEED SCATTER - every dot = one seed run
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={7} fill="#3a5570">
              {(yMin + f * (yMax - yMin)).toFixed(2)}
            </text>
          </g>
        ))}
        {EMS_ALPHAS.map((a, i) => (
          <text key={i} x={tx(i)} y={H + 16} textAnchor="middle" fontSize={8} fill="#3a5570">{a}</text>
        ))}
        {seedResults.map((row, si) =>
          row.map((v, ai) => v != null ? (
            <circle key={`${si}-${ai}`}
              cx={tx(ai) + (emsRng(si * 13 + ai)() - 0.5) * 18}
              cy={ty(v)} r={3}
              fill={EMS_COLORS[ai]} opacity={0.45} />
          ) : null)
        )}
      </g>
    </svg>
  );
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────

function EMSParam({ label, val, set, min, max, step, color = EMS_C.a, hint }: {
  label: string; val: number; set: (v: number) => void;
  min: number; max: number; step: number; color?: string; hint?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: EMS_C.dim, marginBottom: 3 }}>
        {label}: <span style={{ color, fontWeight: 700 }}>{val}</span>
        {hint && <span style={{ color: "#1e3050", marginLeft: 8, fontSize: 9 }}>{hint}</span>}
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        style={{ width: "100%", accentColor: color }} />
    </div>
  );
}

function EMSStat({ label, value, color = EMS_C.a, sub, small }: {
  label: string; value: string; color?: string; sub?: string; small?: boolean;
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22`, borderRadius: 9, padding: "8px 11px" }}>
      <div style={{ fontSize: 9, color: EMS_C.dim, letterSpacing: 1, textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 17, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#1e3050", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const EMS_TOTAL = EMS_ALPHAS.length * EMS_NUM_SEEDS;

export default function ExplorationMultiseed() {
  const [n, setN] = useState(18);
  const [edgeCount, setEdgeCount] = useState(28);
  const [magicSteps, setMagicSteps] = useState(180);
  const [target, setTarget] = useState(20);
  const [lambdaE, setLambdaE] = useState(0.1);
  const [attackK, setAttackK] = useState(3);

  const [rawResults, setRawResults] = useState<(EMSRunResult | null)[][]>(
    EMS_ALPHAS.map(() => Array(EMS_NUM_SEEDS).fill(null))
  );
  const [running, setRunning] = useState(false);
  const [curAlpha, setCurAlpha] = useState(-1);
  const [curSeed, setCurSeed] = useState(-1);
  const [totalDone, setTotalDone] = useState(0);
  const cancelRef = useRef(false);

  const runAll = () => {
    cancelRef.current = false;
    setRunning(true);
    setRawResults(EMS_ALPHAS.map(() => Array(EMS_NUM_SEEDS).fill(null)));
    setTotalDone(0);
    const jobs: { ai: number; si: number; seed: number }[] = [];
    for (let ai = 0; ai < EMS_ALPHAS.length; ai++)
      for (let si = 0; si < EMS_NUM_SEEDS; si++)
        jobs.push({ ai, si, seed: si + 1 });
    let jobIdx = 0;
    const grid: (EMSRunResult | null)[][] = EMS_ALPHAS.map(() => Array(EMS_NUM_SEEDS).fill(null));
    const nextJob = () => {
      if (cancelRef.current || jobIdx >= jobs.length) {
        setRunning(false); setCurAlpha(-1); setCurSeed(-1); return;
      }
      const { ai, si, seed } = jobs[jobIdx]; jobIdx++;
      setCurAlpha(ai); setCurSeed(si);
      const params: EMSParams = { target, magicSteps, seed, lambdaE, attackK };
      const res = emsRunOneSA(n, edgeCount, EMS_SA_STEPS, params, EMS_ALPHAS[ai], seed);
      grid[ai][si] = res;
      setRawResults(grid.map(row => [...row]));
      setTotalDone(jobIdx);
      setTimeout(nextJob, 0);
    };
    setTimeout(nextJob, 20);
  };

  const stop = () => { cancelRef.current = true; };

  // per-alpha stats
  const alphaStats: (EMSAlphaStat | null)[] = EMS_ALPHAS.map((_, ai) => {
    const vals = rawResults[ai].filter((r): r is EMSRunResult => r != null).map(r => r.resilience);
    if (!vals.length) return null;
    return {
      mean: emsMean(vals), std: emsStd(vals), ci: emsCi95(vals), n: vals.length,
      rRand: emsMean(rawResults[ai].filter((r): r is EMSRunResult => r != null).map(r => r.rRand)),
      rTarg: emsMean(rawResults[ai].filter((r): r is EMSRunResult => r != null).map(r => r.rTarg)),
      rCasc: emsMean(rawResults[ai].filter((r): r is EMSRunResult => r != null).map(r => r.rCasc)),
    };
  });

  // seed scatter [seedIdx][alphaIdx]
  const seedScatter: (number | null)[][] = Array.from({ length: EMS_NUM_SEEDS }, (_, si) =>
    EMS_ALPHAS.map((_, ai) => rawResults[ai][si]?.resilience ?? null)
  );

  const allDone = totalDone === EMS_TOTAL;
  const peakIdx = alphaStats.reduce<number>((bi, s, i) =>
    s && (!alphaStats[bi] || s.mean > (alphaStats[bi]?.mean ?? 0)) ? i : bi, 0);

  const verdict = (() => {
    if (!allDone) return null;
    const s0 = alphaStats[0], s1 = alphaStats[1], s2 = alphaStats[2], s4 = alphaStats[4];
    if (!s0 || !s1 || !s2) return null;
    const spectralHelps =
      (s1.mean > s0.mean || s2.mean > s0.mean) &&
      !emsCiOverlap(Math.max(s1.mean, s2.mean), s1.mean > s2.mean ? s1.ci : s2.ci, s0.mean, s0.ci);
    const phaseTransition = s4 != null && s4.mean < s2.mean - 0.005;
    const cascadeLeads = s2.rCasc - s0.rCasc > s2.rRand - s0.rRand &&
      s2.rCasc - s0.rCasc > s2.rTarg - s0.rTarg;
    const gain01 = ((s1.mean - s0.mean) * 100).toFixed(1);
    const gain03 = ((s2.mean - s0.mean) * 100).toFixed(1);
    return { spectralHelps, phaseTransition, cascadeLeads, gain01, gain03,
      overlapWith0: emsCiOverlap(s1.mean, s1.ci, s0.mean, s0.ci) };
  })();

  const progress = Math.round(totalDone / EMS_TOTAL * 100);

  return (
    <div className="space-y-4" style={{ fontFamily: "'Courier New',monospace", color: "#b0c8e0" }}>
      {/* header */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 5, color: EMS_C.a, marginBottom: 4 }}>MULTI-SEED ROBUSTNESS - {EMS_TOTAL} RUNS</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -1,
          background: "linear-gradient(100deg,#4488ff,#00e5ff 30%,#a8ff78 60%,#ffd700 80%,#ff9944)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Is the Result Real or Noise?
        </h2>
        <p style={{ margin: "5px 0 0", fontSize: 11, color: EMS_C.dim, maxWidth: 620 }}>
          {EMS_ALPHAS.length} x {EMS_NUM_SEEDS} seeds x SA steps={EMS_SA_STEPS} = {EMS_TOTAL} runs.
          Each alpha tested on {EMS_NUM_SEEDS} independent graphs - mean +/- 95% CI.
        </p>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const, alignItems: "flex-start" }}>

        {/* sidebar */}
        <div style={{ minWidth: 195, maxWidth: 210 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030",
            borderRadius: 13, padding: 16, display: "flex", flexDirection: "column" as const, gap: 10 }}>
            <div style={{ fontSize: 10, color: EMS_C.dim, letterSpacing: 1 }}>PARAMS</div>
            <EMSParam label="Nodes"       val={n}          set={setN}          min={10}    max={25}  step={1} />
            <EMSParam label="Edges"       val={edgeCount}  set={setEdgeCount}  min={n - 1} max={55}  step={1}
              hint={`${(edgeCount * 2 / (n * (n - 1)) * 100).toFixed(0)}%`} />
            <EMSParam label="Attack k"    val={attackK}    set={setAttackK}    min={1}     max={6}   step={1}   color={EMS_C.red} />
            <EMSParam label="Magic steps" val={magicSteps} set={setMagicSteps} min={80}    max={300} step={20}  color={EMS_C.green} />
            <EMSParam label="lambda E"    val={lambdaE}    set={setLambdaE}    min={0}     max={0.5} step={0.05} color={EMS_C.green} />
            <EMSParam label="Target"      val={target}     set={setTarget}     min={5}     max={40}  step={5} />

            {/* progress matrix */}
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: EMS_C.dim, marginBottom: 8, letterSpacing: 1 }}>PROGRESS MATRIX</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${EMS_NUM_SEEDS},1fr)`, gap: 2, marginBottom: 6 }}>
                {EMS_ALPHAS.map((_, ai) =>
                  Array.from({ length: EMS_NUM_SEEDS }, (__, si) => (
                    <div key={`${ai}-${si}`} style={{
                      width: 9, height: 9, borderRadius: 2,
                      background: rawResults[ai][si]
                        ? EMS_COLORS[ai]
                        : curAlpha === ai && curSeed === si
                        ? EMS_COLORS[ai] + "66"
                        : "#0f1e30",
                      transition: "background 0.2s",
                    }} />
                  ))
                )}
              </div>
              <div style={{ fontSize: 9, color: EMS_C.dim }}>{totalDone}/{EMS_TOTAL} runs</div>
            </div>

            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={runAll} disabled={running} style={{
                flex: 1,
                background: running ? "#162030" : "linear-gradient(135deg,rgba(68,136,255,0.14),rgba(255,153,68,0.14))",
                border: `1px solid ${running ? "#162030" : EMS_C.a}`,
                color: running ? EMS_C.dim : EMS_C.a, borderRadius: 9, padding: "10px 0",
                cursor: running ? "not-allowed" : "pointer",
                fontFamily: "monospace", fontWeight: 700, fontSize: 11, letterSpacing: 1,
              }}>
                {running ? `${progress}%` : `RUN ${EMS_TOTAL}`}
              </button>
              {running && (
                <button onClick={stop} style={{
                  background: "rgba(255,60,60,0.1)", border: "1px solid #ff3c3c",
                  color: "#ff3c3c", borderRadius: 9, padding: "10px 12px",
                  cursor: "pointer", fontFamily: "monospace", fontWeight: 700, fontSize: 12,
                }}>stop</button>
              )}
            </div>

            {(running || totalDone > 0) && (
              <div style={{ background: "#0a1525", borderRadius: 4, height: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`,
                  background: "linear-gradient(90deg,#4488ff,#ff9944)", transition: "width 0.3s" }} />
              </div>
            )}

            {/* live stats */}
            {alphaStats.some(s => s) && (
              <div>
                <div style={{ fontSize: 9, color: EMS_C.dim, marginBottom: 6, letterSpacing: 1 }}>LIVE STATS</div>
                {alphaStats.map((s, i) => s ? (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: EMS_COLORS[i] }} />
                    <div style={{ fontSize: 9, color: EMS_C.dim, flex: 1 }}>a={EMS_ALPHAS[i]}</div>
                    <div style={{ fontSize: 10, color: EMS_COLORS[i], fontFamily: "monospace" }}>
                      {(s.mean * 100).toFixed(1)}+-{(s.ci * 100).toFixed(1)}%
                    </div>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        </div>

        {/* main panel */}
        <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column" as const, gap: 14 }}>

          {/* CI chart */}
          {alphaStats.some(s => s && s.n > 0) && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 12, padding: "14px 16px" }}>
              <EMSCIChart alphaStats={alphaStats} width={520} height={170} />
            </div>
          )}

          {/* seed scatter */}
          {totalDone >= 5 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 12, padding: "14px 16px" }}>
              <EMSSeedScatter seedResults={seedScatter} width={520} height={140} />
            </div>
          )}

          {/* per-attack breakdown */}
          {allDone && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: EMS_C.dim, marginBottom: 10, letterSpacing: 1 }}>MEAN RESILIENCE PER ATTACK TYPE vs alpha</div>
              <EMSAttackChart alphaStats={alphaStats} attackKey="rRand" label="RANDOM FAILURE"  color={EMS_C.red}    width={520} height={100} />
              <EMSAttackChart alphaStats={alphaStats} attackKey="rTarg" label="TARGETED HUB"    color={EMS_C.b}      width={520} height={100} />
              <EMSAttackChart alphaStats={alphaStats} attackKey="rCasc" label="CASCADE LOAD"    color={EMS_C.orange} width={520} height={100} />
            </div>
          )}

          {/* summary table */}
          {alphaStats.some(s => s) && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: EMS_C.dim, marginBottom: 10, letterSpacing: 1 }}>SUMMARY TABLE</div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 11, fontFamily: "monospace" }}>
                  <thead>
                    <tr>{["alpha", "n", "mean", "std", "CI+-", "rRand", "rTarg", "rCasc", "vs a=0"].map(h => (
                      <th key={h} style={{ textAlign: "left" as const, color: EMS_C.dim, padding: "4px 8px",
                        borderBottom: "1px solid #162030", fontSize: 9, letterSpacing: 1 }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {alphaStats.map((s, i) => s ? (
                      <tr key={i} style={{ background: i === peakIdx && allDone ? `${EMS_COLORS[i]}10` : "transparent" }}>
                        <td style={{ padding: "5px 8px", color: EMS_COLORS[i], fontWeight: 700 }}>{EMS_ALPHAS[i]}</td>
                        <td style={{ padding: "5px 8px", color: EMS_C.dim }}>{s.n}</td>
                        <td style={{ padding: "5px 8px", color: EMS_COLORS[i] }}>{(s.mean * 100).toFixed(2)}%</td>
                        <td style={{ padding: "5px 8px", color: EMS_C.dim }}>{(s.std * 100).toFixed(2)}%</td>
                        <td style={{ padding: "5px 8px", color: EMS_C.dim }}>+-{(s.ci * 100).toFixed(2)}%</td>
                        <td style={{ padding: "5px 8px", color: EMS_C.red }}>{(s.rRand * 100).toFixed(1)}%</td>
                        <td style={{ padding: "5px 8px", color: EMS_C.b }}>{(s.rTarg * 100).toFixed(1)}%</td>
                        <td style={{ padding: "5px 8px", color: EMS_C.orange }}>{(s.rCasc * 100).toFixed(1)}%</td>
                        <td style={{ padding: "5px 8px", color: alphaStats[0] && s.mean > (alphaStats[0]?.mean ?? 0) ? EMS_C.green : EMS_C.red }}>
                          {alphaStats[0] ? `${s.mean > (alphaStats[0]?.mean ?? 0) ? "+" : ""}${((s.mean - (alphaStats[0]?.mean ?? 0)) * 100).toFixed(2)}%` : "-"}
                        </td>
                      </tr>
                    ) : null)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* research verdict */}
      {verdict && (
        <div style={{ background: "rgba(255,255,255,0.02)",
          border: `1px solid ${verdict.spectralHelps ? EMS_C.b + "55" : EMS_C.red + "44"}`,
          borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: verdict.spectralHelps ? EMS_C.b : EMS_C.red, letterSpacing: 2, marginBottom: 16 }}>
            ROBUSTNESS VERDICT - {EMS_NUM_SEEDS} SEEDS
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
            <EMSStat label="Spectral helps?" value={verdict.spectralHelps ? "YES" : "NO"}
              color={verdict.spectralHelps ? EMS_C.green : EMS_C.red}
              sub={verdict.spectralHelps ? "CIs non-overlapping" : "CIs overlap"} />
            <EMSStat label="Best alpha" value={`a = ${EMS_ALPHAS[peakIdx]}`}
              color={EMS_COLORS[peakIdx]}
              sub={`mean=${(alphaStats[peakIdx]?.mean ?? 0 * 100).toFixed(1)}%`} />
            <EMSStat label="Phase transition?" value={verdict.phaseTransition ? "YES" : "NO"}
              color={verdict.phaseTransition ? EMS_C.orange : EMS_C.dim}
              sub={verdict.phaseTransition ? "a=1.0 hurt resilience" : "no drop at high alpha"} />
            <EMSStat label="Cascade leads?" value={verdict.cascadeLeads ? "YES" : "NO"}
              color={verdict.cascadeLeads ? EMS_C.orange : EMS_C.dim}
              sub={verdict.cascadeLeads ? "cascade most improved" : "uniform improvement"} />
          </div>

          <div style={{ fontSize: 13, color: "#8ab0cc", lineHeight: 2 }}>
            {verdict.spectralHelps
              ? `Result is real, not noise: spectral pressure at a=${EMS_ALPHAS[peakIdx]} consistently improved resilience (+${parseFloat(verdict.gain03) > parseFloat(verdict.gain01) ? verdict.gain03 : verdict.gain01}% mean across ${EMS_NUM_SEEDS} seeds). CIs did not overlap with a=0.`
              : `Result may be noise: across ${EMS_NUM_SEEDS} seeds, CIs for a=0.1 and a=0.3 overlap heavily with a=0. Spectral pressure shows no provable advantage.`}{" "}
            {verdict.phaseTransition
              ? `Phase transition confirmed: a=1.0 reduced resilience below peak - excessive spectral pressure is harmful.`
              : `a=1.0 showed no significant drop - phase transition is weak at these parameters.`}{" "}
            {verdict.cascadeLeads
              ? `Cascade attack benefited most from spectral optimization - algebraic connectivity blocks load propagation.`
              : `Differences between attack types were not pronounced in this experiment.`}
          </div>
        </div>
      )}
    </div>
  );
}

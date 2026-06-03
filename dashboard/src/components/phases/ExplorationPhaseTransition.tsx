"use client";
import { useState, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EPTParams {
  target: number; magicSteps: number; seed: number; lambdaE: number; attackK: number;
}
interface EPTResult {
  score: number; resilience: number; energy: number; sg: number; normSG: number;
  rRand: number; rTarg: number; rCasc: number; x: Float64Array; adjList: number[][];
}
interface EPTLineSeries {
  label: string; data: (number | null)[];
  color: string; bold?: boolean; dots?: boolean; dash?: boolean; dim?: boolean;
}
interface EPTScatterPt { x: number; y: number; color: string; label?: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const EPT_ALPHAS = [0.0, 0.1, 0.3, 0.5, 1.0];
const EPT_COLORS = ["#4488ff", "#00e5ff", "#a8ff78", "#ffd700", "#ff9944"];
const EPT_C = {
  a: "#00e5ff", b: "#ffd700", green: "#a8ff78", red: "#ff6b6b",
  orange: "#ff9944", dim: "#3a5570",
};

// ── Math helpers ──────────────────────────────────────────────────────────────

function eptRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function eptMakeAdj(n: number, edges: number[][]): Set<number>[] {
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (const [a, b] of edges) { adj[a].add(b); adj[b].add(a); }
  return adj;
}
function eptAdjList(adj: Set<number>[]): number[][] { return adj.map(s => [...s]); }

function eptConnected(adj: Set<number>[]): boolean {
  const n = adj.length, vis = new Uint8Array(n), q = [0]; vis[0] = 1; let c = 1;
  while (q.length) for (const v of adj[q.pop()!]) if (!vis[v]) { vis[v] = 1; c++; q.push(v); }
  return c === n;
}

function eptInitGraph(n: number, tgt: number, seed: number): number[][] {
  const rng = eptRng(seed);
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

function eptDot(a: Float64Array, b: Float64Array): number {
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
}
function eptDefl(v: Float64Array, u: Float64Array): Float64Array {
  const d = eptDot(v, u), r = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) r[i] = v[i] - d * u[i];
  return r;
}
function eptNormV(v: Float64Array): Float64Array {
  const m = Math.sqrt(eptDot(v, v));
  if (m < 1e-12) return v;
  const r = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) r[i] = v[i] / m;
  return r;
}

function eptSpectralGap(n: number, adjList: number[][], iters = 70): number {
  if (n < 3) return 0;
  const deg = adjList.map(nb => nb.length);
  const shift = 2 * Math.max(...deg) + 1;
  const u1 = new Float64Array(n).fill(1 / Math.sqrt(n));
  const Lx = (x: Float64Array): Float64Array => {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { y[i] = deg[i] * x[i]; for (const j of adjList[i]) y[i] -= x[j]; }
    return y;
  };
  const rng = eptRng(37);
  let v = eptNormV(eptDefl(Float64Array.from({ length: n }, () => rng() - 0.5), u1));
  let l2 = 0;
  for (let it = 0; it < iters; it++) {
    const Lv = Lx(v);
    const w0 = new Float64Array(n); for (let i = 0; i < n; i++) w0[i] = shift * v[i] - Lv[i];
    const w = eptDefl(w0, u1);
    const r = Math.sqrt(eptDot(w, w)); if (r < 1e-12) break;
    l2 = shift - eptDot(v, w) / eptDot(v, v);
    v = eptNormV(w);
  }
  return Math.max(0, l2);
}

function eptMagicE(adjList: number[][], x: ArrayLike<number>, tgt: number): number {
  return adjList.reduce((s, nb) => s + (nb.reduce((a, j) => a + x[j], 0) - tgt) ** 2, 0);
}

function eptOptMagic(adjList: number[][], tgt: number, steps: number, lr: number, seed: number): Float64Array {
  const n = adjList.length, rng = eptRng(seed);
  let x = Float64Array.from({ length: n }, () => rng() * 10);
  const eps = 1e-4;
  for (let t = 0; t < steps; t++) {
    const base = eptMagicE(adjList, x, tgt);
    const grad = Array.from({ length: n }, (_, k) => {
      const xp = Array.from(x); xp[k] += eps;
      return (eptMagicE(adjList, xp, tgt) - base) / eps;
    });
    x = x.map((v, k) => Math.max(0, Math.min(100, v - lr * grad[k])));
  }
  return x;
}

function eptAttackRandom(adjList: number[][], k: number, seed: number): number {
  const n = adjList.length, rng = eptRng(seed + 77);
  const dead = new Set([...Array(n).keys()].sort(() => rng() - 0.5).slice(0, k));
  return (n - dead.size) / n;
}

function eptAttackTargeted(adjList: number[][], k: number): number {
  const n = adjList.length, alive = new Set([...Array(n).keys()]);
  for (let r = 0; r < k; r++) {
    if (!alive.size) break;
    let best = -1, bd = -1;
    for (const i of alive) { const d = adjList[i].filter(j => alive.has(j)).length; if (d > bd) { bd = d; best = i; } }
    alive.delete(best);
  }
  return alive.size / n;
}

function eptAttackCascade(adjList: number[][], initialDead: number[]): number {
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

function eptTopK(adjList: number[][], k: number): number[] {
  return [...Array(adjList.length).keys()].sort((a, b) => adjList[b].length - adjList[a].length).slice(0, k);
}

function eptEvaluate(edges: number[][], n: number, params: EPTParams, alpha: number): EPTResult {
  const { target, magicSteps, seed, lambdaE, attackK } = params;
  const adjSets = eptMakeAdj(n, edges);
  const adjList = eptAdjList(adjSets);
  const x = eptOptMagic(adjList, target, magicSteps, 0.002, seed);
  const energy = eptMagicE(adjList, x, target);
  const normE = energy / (n * target * target);
  const sg = eptSpectralGap(n, adjList);
  const normSG = sg / 2;
  const rRand = eptAttackRandom(adjList, attackK, seed);
  const rTarg = eptAttackTargeted(adjList, attackK);
  const rCasc = eptAttackCascade(adjList, eptTopK(adjList, attackK));
  const resilience = 0.2 * rRand + 0.4 * rTarg + 0.4 * rCasc;
  const score = resilience + alpha * normSG - lambdaE * normE;
  return { score, resilience, energy, sg, normSG, rRand, rTarg, rCasc, x, adjList };
}

function eptSAStep(edges: number[][], n: number, rng: () => number): number[][] | null {
  const ri = Math.floor(rng() * edges.length);
  const [ra, rb] = edges[ri];
  const S = new Set(edges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`));
  S.delete(`${Math.min(ra, rb)},${Math.max(ra, rb)}`);
  let na = 0, nb = 0, att = 0;
  do { na = Math.floor(rng() * n); nb = Math.floor(rng() * n); att++; }
  while ((na === nb || S.has(`${Math.min(na, nb)},${Math.max(na, nb)}`)) && att < 300);
  if (att >= 300) return null;
  const ne = [...edges.filter((_, i) => i !== ri), [na, nb]];
  return eptConnected(eptMakeAdj(n, ne)) ? ne : null;
}

function eptRunOneSA(
  n: number, edgeCount: number, saSteps: number,
  params: EPTParams, alpha: number,
  onProgress: (p: number) => void,
  onDone: (res: EPTResult) => void
): void {
  const initEdges = eptInitGraph(n, edgeCount, params.seed);
  let curEdges = initEdges, curScore = eptEvaluate(initEdges, n, params, alpha).score;
  let bstScore = curScore, bstEdges = initEdges;
  const rng = eptRng(params.seed + Math.round(alpha * 100) + 1);
  const T0 = 0.3;
  let step = 0;
  const chunk = () => {
    const CHUNK = 4;
    for (let c = 0; c < CHUNK && step < saSteps; c++, step++) {
      const T = T0 * Math.exp(-3 * step / saSteps);
      const cand = eptSAStep(curEdges, n, rng);
      if (!cand) continue;
      const res = eptEvaluate(cand, n, { ...params, seed: params.seed + step }, alpha);
      const d = res.score - curScore;
      if (d > 0 || Math.random() < Math.exp(d / Math.max(T, 1e-6))) {
        curEdges = cand; curScore = res.score;
        if (res.score > bstScore) { bstScore = res.score; bstEdges = cand; }
      }
    }
    onProgress(step / saSteps);
    if (step < saSteps) setTimeout(chunk, 0);
    else onDone(eptEvaluate(bstEdges, n, params, alpha));
  };
  setTimeout(chunk, 10);
}

// ── Charts ────────────────────────────────────────────────────────────────────

function EPTLineChart({ series, height = 110, width = 500, xLabels, title }: {
  series: EPTLineSeries[]; height?: number; width?: number; xLabels?: string[]; title?: string;
}) {
  const pad = { t: 22, r: 14, b: 28, l: 40 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const all = series.flatMap(s => s.data).filter((v): v is number => v != null && isFinite(v));
  if (!all.length) return null;
  const yMin = Math.min(...all), yMax = Math.max(...all) || 1;
  const xLen = Math.max(...series.map(s => s.data.length), 2);
  const tx = (i: number) => (i / (xLen - 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const mkPath = (d: (number | null)[]) =>
    d.map((v, i) => v != null && isFinite(v)
      ? `${i === 0 || d[i - 1] == null ? "M" : "L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`
      : "").filter(Boolean).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {title && <text x={pad.l + W / 2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={8} fill="#3a5570">
              {(yMin + f * (yMax - yMin)).toFixed(yMax - yMin < 0.5 ? 2 : 1)}
            </text>
          </g>
        ))}
        {xLabels && xLabels.map((l, i) => (
          <text key={i} x={tx(i)} y={H + 16} textAnchor="middle" fontSize={9} fill="#4a6a8a">{l}</text>
        ))}
        {series.map(s => (
          <g key={s.label}>
            <path d={mkPath(s.data)} fill="none" stroke={s.color}
              strokeWidth={s.bold ? 2.5 : 1.6} strokeLinejoin="round"
              opacity={s.dim ? 0.45 : 1} strokeDasharray={s.dash ? "5,3" : "none"} />
            {s.dots && s.data.map((v, i) => v != null && isFinite(v) ? (
              <circle key={i} cx={tx(i)} cy={ty(v)} r={5} fill={s.color} opacity={0.9} />
            ) : null)}
          </g>
        ))}
      </g>
    </svg>
  );
}

function EPTScatterPlot({ points, width = 480, height = 170, title, xLabel, yLabel }: {
  points: EPTScatterPt[]; width?: number; height?: number; title?: string; xLabel?: string; yLabel?: string;
}) {
  const pad = { t: 26, r: 14, b: 32, l: 44 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  if (!points.length) return null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs) || 1;
  const ySpan = Math.max(...ys) - Math.min(...ys) || 0.01;
  const yMin = Math.min(...ys) - ySpan * 0.1, yMax = Math.max(...ys) + ySpan * 0.1;
  const tx = (v: number) => ((v - xMin) / (xMax - xMin || 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const nn = points.length;
  const sx = xs.reduce((a, v) => a + v, 0) / nn, sy = ys.reduce((a, v) => a + v, 0) / nn;
  const num = points.reduce((a, p) => a + (p.x - sx) * (p.y - sy), 0);
  const den = points.reduce((a, p) => a + (p.x - sx) ** 2, 0);
  const showTrend = Math.abs(den) > 1e-9;
  const m = showTrend ? num / den : 0, b = showTrend ? sy - m * sx : 0;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {title && <text x={pad.l + W / 2} y={16} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <line x1={W * f} x2={W * f} y1={0} y2={H} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={7} fill="#3a5570">
              {(yMin + f * (yMax - yMin)).toFixed(2)}
            </text>
            <text x={W * f} y={H + 14} textAnchor="middle" fontSize={7} fill="#3a5570">
              {(xMin + f * (xMax - xMin)).toFixed(2)}
            </text>
          </g>
        ))}
        {xLabel && <text x={W / 2} y={H + 26} textAnchor="middle" fontSize={9} fill="#4a6a8a">{xLabel}</text>}
        {yLabel && <text x={-32} y={H / 2} textAnchor="middle" fontSize={9} fill="#4a6a8a"
          transform={`rotate(-90,-32,${H / 2})`}>{yLabel}</text>}
        {showTrend && (
          <line x1={tx(xMin)} y1={ty(m * xMin + b)} x2={tx(xMax)} y2={ty(m * xMax + b)}
            stroke="#ffffff" strokeWidth={1} opacity={0.15} strokeDasharray="4,3" />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={tx(p.x)} cy={ty(p.y)} r={7} fill={p.color} opacity={0.9} />
            {p.label && <text x={tx(p.x)} y={ty(p.y) - 10} textAnchor="middle" fontSize={9} fill={p.color} fontWeight="bold">{p.label}</text>}
          </g>
        ))}
      </g>
    </svg>
  );
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────

function EPTParam({ label, val, set, min, max, step, color = EPT_C.a, hint }: {
  label: string; val: number; set: (v: number) => void;
  min: number; max: number; step: number; color?: string; hint?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: EPT_C.dim, marginBottom: 3 }}>
        {label}: <span style={{ color, fontWeight: 700 }}>{val}</span>
        {hint && <span style={{ color: "#1e3050", marginLeft: 8, fontSize: 9 }}>{hint}</span>}
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        style={{ width: "100%", accentColor: color }} />
    </div>
  );
}

function EPTStat({ label, value, color = EPT_C.a, sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22`, borderRadius: 9, padding: "9px 11px" }}>
      <div style={{ fontSize: 9, color: EPT_C.dim, letterSpacing: 1, textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#1e3050", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ExplorationPhaseTransition() {
  const [n, setN] = useState(18);
  const [edgeCount, setEdgeCount] = useState(28);
  const [saSteps, setSaSteps] = useState(80);
  const [magicSteps, setMagicSteps] = useState(220);
  const [target, setTarget] = useState(20);
  const [lambdaE, setLambdaE] = useState(0.1);
  const [attackK, setAttackK] = useState(3);
  const [seed, setSeed] = useState(42);

  const [running, setRunning] = useState(false);
  const [curIdx, setCurIdx] = useState(-1);
  const [progresses, setProgresses] = useState<number[]>(EPT_ALPHAS.map(() => 0));
  const [results, setResults] = useState<(EPTResult | null)[]>(EPT_ALPHAS.map(() => null));
  const cancelRef = useRef(false);

  const params: EPTParams = { target, magicSteps, seed, lambdaE, attackK };

  const runSweep = () => {
    cancelRef.current = false;
    setRunning(true);
    setResults(EPT_ALPHAS.map(() => null));
    setProgresses(EPT_ALPHAS.map(() => 0));
    let idx = 0;
    const next = () => {
      if (cancelRef.current || idx >= EPT_ALPHAS.length) { setRunning(false); setCurIdx(-1); return; }
      const ai = idx; setCurIdx(ai);
      eptRunOneSA(n, edgeCount, saSteps, params, EPT_ALPHAS[ai],
        (p) => setProgresses(prev => { const a = [...prev]; a[ai] = Math.round(p * 100); return a; }),
        (res) => { setResults(prev => { const a = [...prev]; a[ai] = res; return a; }); idx++; setTimeout(next, 30); }
      );
    };
    next();
  };

  const done = results.filter(Boolean).length;
  const allDone = done === EPT_ALPHAS.length;

  const resData   = EPT_ALPHAS.map((_, i) => results[i]?.resilience ?? null);
  const rRandData = EPT_ALPHAS.map((_, i) => results[i]?.rRand ?? null);
  const rTargData = EPT_ALPHAS.map((_, i) => results[i]?.rTarg ?? null);
  const rCascData = EPT_ALPHAS.map((_, i) => results[i]?.rCasc ?? null);
  const sgData    = EPT_ALPHAS.map((_, i) => results[i]?.sg ?? null);
  const alphaLabels = EPT_ALPHAS.map(String);

  const peakIdx = resData.reduce<number>((bi, v, i) =>
    v != null && (resData[bi] == null || v > (resData[bi] as number)) ? i : bi, 0);

  const transition = (() => {
    const valid = resData
      .map((v, i) => ({ v, i }))
      .filter((x): x is { v: number; i: number } => x.v != null);
    for (let k = 1; k < valid.length; k++)
      if (valid[k].v < valid[k - 1].v - 0.005) return EPT_ALPHAS[valid[k].i];
    return null;
  })();

  const scatterPts: EPTScatterPt[] = results
    .map((r, i) => r ? { x: r.sg, y: r.resilience, color: EPT_COLORS[i], label: `a=${EPT_ALPHAS[i]}` } : null)
    .filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <div className="space-y-4" style={{ fontFamily: "'Courier New',monospace", color: "#b0c8e0" }}>
      {/* header */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 5, color: EPT_C.a, marginBottom: 4 }}>ABLATION STUDY - alpha SWEEP</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -1,
          background: "linear-gradient(100deg,#4488ff,#00e5ff 25%,#a8ff78 55%,#ffd700 78%,#ff9944)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Phase Transition: Resilience vs alpha
        </h2>
        <p style={{ margin: "5px 0 0", fontSize: 11, color: EPT_C.dim, maxWidth: 620 }}>
          Same graph, same SA, same attack - only the{" "}
          <span style={{ color: EPT_C.b }}>spectral weight (alpha)</span> changes.
          Is there an optimal point? What happens beyond it?
        </p>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const, alignItems: "flex-start" }}>

        {/* sidebar */}
        <div style={{ minWidth: 196, maxWidth: 210 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030",
            borderRadius: 13, padding: 16, display: "flex", flexDirection: "column" as const, gap: 10 }}>
            <div style={{ fontSize: 10, color: EPT_C.dim, letterSpacing: 1 }}>FIXED PARAMS</div>
            <EPTParam label="Nodes"       val={n}          set={setN}          min={10}    max={25}  step={1} />
            <EPTParam label="Edges"       val={edgeCount}  set={setEdgeCount}  min={n - 1} max={55}  step={1}
              hint={`${(edgeCount * 2 / (n * (n - 1)) * 100).toFixed(0)}% dense`} />
            <EPTParam label="Attack k"    val={attackK}    set={setAttackK}    min={1}     max={6}   step={1}   color={EPT_C.red} />
            <EPTParam label="Seed"        val={seed}       set={setSeed}       min={1}     max={99}  step={1} />
            <EPTParam label="SA steps"    val={saSteps}    set={setSaSteps}    min={20}    max={150} step={10}  color={EPT_C.b}
              hint={saSteps >= 80 ? "good" : "fast"} />
            <EPTParam label="Magic steps" val={magicSteps} set={setMagicSteps} min={100}   max={350} step={50}  color={EPT_C.green} />
            <EPTParam label="lambda E"    val={lambdaE}    set={setLambdaE}    min={0}     max={0.5} step={0.05} color={EPT_C.green} />
            <EPTParam label="Target"      val={target}     set={setTarget}     min={5}     max={40}  step={5} />

            {/* alpha queue */}
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: EPT_C.dim, marginBottom: 8, letterSpacing: 1 }}>alpha SWEEP QUEUE</div>
              {EPT_ALPHAS.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: EPT_COLORS[i],
                    boxShadow: curIdx === i ? `0 0 8px ${EPT_COLORS[i]}` : "none", transition: "box-shadow 0.3s" }} />
                  <div style={{ fontSize: 10, flex: 1, color: curIdx === i ? EPT_COLORS[i] : EPT_C.dim, fontFamily: "monospace" }}>
                    alpha = {a}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: "monospace" }}>
                    {results[i]
                      ? <span style={{ color: EPT_COLORS[i] }}>checkmark {(results[i]!.resilience * 100).toFixed(1)}%</span>
                      : running && curIdx === i
                      ? <span style={{ color: EPT_COLORS[i] }}>{progresses[i]}%</span>
                      : <span style={{ color: "#162030" }}>-</span>}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={runSweep} disabled={running} style={{
              background: running ? "#162030" : "linear-gradient(135deg,rgba(68,136,255,0.14),rgba(255,153,68,0.14))",
              border: `1px solid ${running ? "#162030" : EPT_C.a}`,
              color: running ? EPT_C.dim : EPT_C.a, borderRadius: 9, padding: "11px 0",
              cursor: running ? "not-allowed" : "pointer",
              fontFamily: "monospace", fontWeight: 700, fontSize: 12, letterSpacing: 1,
            }}>
              {running
                ? `Sweeping a=${EPT_ALPHAS[curIdx] ?? 0} (${done}/${EPT_ALPHAS.length})`
                : "RUN SWEEP"}
            </button>

            {running && (
              <div style={{ background: "#0a1525", borderRadius: 4, height: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${done / EPT_ALPHAS.length * 100}%`,
                  background: "linear-gradient(90deg,#4488ff,#ff9944)", transition: "width 0.5s" }} />
              </div>
            )}
          </div>
        </div>

        {/* charts panel */}
        <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column" as const, gap: 14 }}>

          {/* alpha summary cards */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {EPT_ALPHAS.map((a, i) => {
              const r = results[i];
              const isPeak = allDone && i === peakIdx;
              return (
                <div key={i} style={{ flex: 1, minWidth: 80,
                  background: `${EPT_COLORS[i]}0f`,
                  border: `1px solid ${isPeak ? EPT_COLORS[i] : EPT_COLORS[i] + "30"}`,
                  borderRadius: 10, padding: "10px",
                  boxShadow: isPeak ? `0 0 14px ${EPT_COLORS[i]}44` : "none", transition: "box-shadow 0.4s" }}>
                  <div style={{ fontSize: 9, color: EPT_C.dim, marginBottom: 4, letterSpacing: 1 }}>a = {a}</div>
                  {r ? (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 900, color: EPT_COLORS[i], fontFamily: "monospace" }}>
                        {(r.resilience * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 9, color: EPT_C.dim, marginTop: 2 }}>resilience</div>
                      <div style={{ fontSize: 10, color: EPT_COLORS[i] + "88", fontFamily: "monospace", marginTop: 3 }}>
                        l2={r.sg.toFixed(2)}
                      </div>
                      {isPeak && <div style={{ fontSize: 9, color: EPT_COLORS[i], marginTop: 5, fontWeight: 700, letterSpacing: 1 }}>PEAK</div>}
                    </>
                  ) : running && curIdx === i ? (
                    <div style={{ fontSize: 14, color: EPT_COLORS[i], fontFamily: "monospace" }}>{progresses[i]}%</div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#162030" }}>-</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* resilience vs alpha */}
          {done >= 2 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 12, padding: "14px 16px" }}>
              <EPTLineChart
                series={[
                  { label: "weighted", data: resData,   color: EPT_C.a,      bold: true, dots: true },
                  { label: "random",   data: rRandData, color: EPT_C.red,    dash: true },
                  { label: "targeted", data: rTargData, color: EPT_C.b,      dash: true },
                  { label: "cascade",  data: rCascData, color: EPT_C.orange, dash: true },
                ]}
                xLabels={alphaLabels} height={130} width={520} title="RESILIENCE vs alpha" />
              <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" as const }}>
                {([["weighted", EPT_C.a, false], ["random", EPT_C.red, true], ["targeted", EPT_C.b, true], ["cascade", EPT_C.orange, true]] as [string, string, boolean][])
                  .map(([l, c, d]) => (
                  <span key={l} style={{ fontSize: 9, color: c, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 14, display: "inline-block", height: d ? 0 : 2, borderTop: d ? `1px dashed ${c}` : "none", background: d ? "none" : c }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* spectral gap */}
          {done >= 2 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 12, padding: "14px 16px" }}>
              <EPTLineChart
                series={[{ label: "sg", data: sgData, color: EPT_C.orange, bold: true, dots: true }]}
                xLabels={alphaLabels} height={90} width={520} title="SPECTRAL GAP l2 vs alpha" />
            </div>
          )}

          {/* scatter */}
          {scatterPts.length >= 2 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 12, padding: "14px 16px" }}>
              <EPTScatterPlot
                points={scatterPts} width={520} height={170}
                title="l2 vs RESILIENCE - each point = one alpha value"
                xLabel="spectral gap l2" yLabel="resilience" />
            </div>
          )}
        </div>
      </div>

      {/* research verdict */}
      {allDone && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${EPT_C.b}44`,
          borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ fontSize: 11, color: EPT_C.b, letterSpacing: 2, marginBottom: 14 }}>PHASE TRANSITION FINDING</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
            {EPT_ALPHAS.map((a, i) => results[i] && (
              <EPTStat key={i} label={`a = ${a}`}
                value={(results[i]!.resilience * 100).toFixed(1) + "%"}
                color={i === peakIdx ? EPT_COLORS[i] : EPT_COLORS[i] + "88"}
                sub={i === peakIdx ? "peak" : "l2=" + results[i]!.sg.toFixed(2)} />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <EPTStat label="Peak alpha" value={`a = ${EPT_ALPHAS[peakIdx]}`}
              color={EPT_COLORS[peakIdx]} sub="best resilience" />
            <EPTStat label="Phase transition"
              value={transition != null ? `a >= ${transition}` : "not detected"}
              color={transition != null ? EPT_C.red : EPT_C.green}
              sub={transition != null ? "resilience dropped after this" : "resilience stayed stable"} />
            <EPTStat label="Cascade gain (0 to peak)"
              value={results[peakIdx] && results[0]
                ? `${((results[peakIdx]!.rCasc - results[0]!.rCasc) * 100).toFixed(1)}%`
                : "-"}
              color={EPT_C.orange} sub="did spectral help cascade?" />
          </div>

          <div style={{ fontSize: 13, color: "#8ab0cc", lineHeight: 1.9 }}>
            {(() => {
              const r0 = results[0], rp = results[peakIdx];
              if (!r0 || !rp) return null;
              const gain = ((rp.resilience - r0.resilience) * 100).toFixed(1);
              const cascGain = ((rp.rCasc - r0.rCasc) * 100).toFixed(1);
              const parts: string[] = [];
              if (parseFloat(gain) > 0.5)
                parts.push(`Spectral pressure up to a=${EPT_ALPHAS[peakIdx]} improved resilience +${gain}% (l2: ${r0.sg.toFixed(2)} to ${rp.sg.toFixed(2)}).`);
              else
                parts.push(`Spectral pressure had no significant positive effect (max gain: +${gain}%).`);
              if (transition != null)
                parts.push(`Phase transition at a>=${transition}: spectral pressure beyond this point made the network fragile - confirms the hypothesis that larger l2 is not always better.`);
              else
                parts.push(`Resilience remained stable throughout sweep - no phase transition detected.`);
              if (parseFloat(cascGain) > parseFloat(((rp.rRand - r0.rRand) * 100).toFixed(1)))
                parts.push(`Cascade attack benefited most from spectral optimization (+${cascGain}%) - algebraic connectivity blocked load propagation.`);
              else
                parts.push(`Attack-type differences were not pronounced in this run - try varying seed or attack k.`);
              return parts.join(" ");
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

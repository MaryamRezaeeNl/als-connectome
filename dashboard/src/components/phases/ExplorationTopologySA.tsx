"use client";
import { useState, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ETSParamsA { target: number; dmg: number; magicSteps: number; seed: number; alpha: number; lambdaE: number; }
interface ETSParamsB { target: number; magicSteps: number; seed: number; alpha: number; lambdaE: number; attackK: number; }

interface ETSResultA {
  score: number; resilience: number; energy: number; sg: number; normSG: number;
  x: Float64Array; adjList: number[][]; hist: number[]; attacked: number[];
}
interface ETSResultB {
  score: number; resilience: number; energy: number; sg: number; normSG: number;
  rRandom: number; rTargeted: number; rCascade: number;
  x: Float64Array; adjList: number[][]; attacked: number[];
}
interface ETSLogEntry { step: number; score: number; resilience: number; sg: number; }
interface ETSLineSeries { label: string; data: number[]; color: string; bold?: boolean; dim?: boolean; }

// ── Constants ─────────────────────────────────────────────────────────────────

const ETS_C = { a: "#00e5ff", b: "#ffd700", dim: "#3a5570", red: "#ff6b6b",
                green: "#a8ff78", orange: "#ff9944" };

// ── Shared Math ───────────────────────────────────────────────────────────────

function etsRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function etsMakeAdj(n: number, edges: number[][]): Set<number>[] {
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (const [a, b] of edges) { adj[a].add(b); adj[b].add(a); }
  return adj;
}
function etsAdjList(adj: Set<number>[]): number[][] { return adj.map(s => [...s]); }
function etsConnected(adj: Set<number>[]): boolean {
  const n = adj.length, vis = new Uint8Array(n), q = [0]; vis[0] = 1; let c = 1;
  while (q.length) for (const v of adj[q.pop()!]) if (!vis[v]) { vis[v] = 1; c++; q.push(v); }
  return c === n;
}
function etsInitGraph(n: number, tgt: number, seed: number): number[][] {
  const rng = etsRng(seed), key = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;
  const S = new Set<string>();
  for (let i = 0; i < n - 1; i++) S.add(key(i, i + 1));
  let att = 0;
  while (S.size < tgt && att < 200000) {
    att++; const a = Math.floor(rng() * n), b = Math.floor(rng() * n);
    if (a !== b) S.add(key(a, b));
  }
  return [...S].map(k => k.split(",").map(Number));
}

function etsDot(a: Float64Array, b: Float64Array): number {
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
}
function etsDefl(v: Float64Array, u: Float64Array): Float64Array {
  const d = etsDot(v, u), r = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) r[i] = v[i] - d * u[i];
  return r;
}
function etsNormV(v: Float64Array): Float64Array {
  const m = Math.sqrt(etsDot(v, v));
  if (m < 1e-12) return v;
  const r = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) r[i] = v[i] / m;
  return r;
}
function etsSpectralGap(n: number, adjList: number[][], iters = 80): number {
  if (n < 3) return 0;
  const deg = adjList.map(nb => nb.length);
  const shift = 2 * Math.max(...deg) + 1;
  const u1 = new Float64Array(n).fill(1 / Math.sqrt(n));
  const Lx = (x: Float64Array): Float64Array => {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { y[i] = deg[i] * x[i]; for (const j of adjList[i]) y[i] -= x[j]; }
    return y;
  };
  const rng = etsRng(37);
  let v = etsNormV(etsDefl(Float64Array.from({ length: n }, () => rng() - 0.5), u1));
  let l2 = 0;
  for (let it = 0; it < iters; it++) {
    const Lv = Lx(v);
    const w0 = new Float64Array(n); for (let i = 0; i < n; i++) w0[i] = shift * v[i] - Lv[i];
    const w = etsDefl(w0, u1);
    const r = Math.sqrt(etsDot(w, w)); if (r < 1e-12) break;
    l2 = shift - etsDot(v, w) / etsDot(v, v);
    v = etsNormV(w);
  }
  return Math.max(0, l2);
}
function etsMagicE(adjList: number[][], x: ArrayLike<number>, target: number): number {
  return adjList.reduce((s, nb) => s + (nb.reduce((a, j) => a + x[j], 0) - target) ** 2, 0);
}
function etsOptMagic(adjList: number[][], target: number, steps: number, lr: number, seed: number): Float64Array {
  const n = adjList.length, rng = etsRng(seed), eps = 1e-4;
  let x = Float64Array.from({ length: n }, () => rng() * 10);
  for (let t = 0; t < steps; t++) {
    const base = etsMagicE(adjList, x, target);
    const grad = Array.from({ length: n }, (_, k) => {
      const xp = Array.from(x); xp[k] += eps;
      return (etsMagicE(adjList, xp, target) - base) / eps;
    });
    x = x.map((v, k) => Math.max(0, Math.min(100, v - lr * grad[k])));
  }
  return x;
}
function etsSAStep(edges: number[][], n: number, rng: () => number): number[][] | null {
  const ri = Math.floor(rng() * edges.length);
  const [ra, rb] = edges[ri];
  const S = new Set(edges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`));
  S.delete(`${Math.min(ra, rb)},${Math.max(ra, rb)}`);
  let na = 0, nb = 0, att = 0;
  do { na = Math.floor(rng() * n); nb = Math.floor(rng() * n); att++; }
  while ((na === nb || S.has(`${Math.min(na, nb)},${Math.max(na, nb)}`)) && att < 300);
  if (att >= 300) return null;
  const ne = [...edges.filter((_, i) => i !== ri), [na, nb]];
  return etsConnected(etsMakeAdj(n, ne)) ? ne : null;
}

// ── v3A specific (simulateCollapse attack model) ──────────────────────────────

function etsGetAttacked(adjList: number[][], k = 3): number[] {
  return [...Array(adjList.length).keys()].sort((a, b) => adjList[b].length - adjList[a].length).slice(0, k);
}
function etsSimCollapse(adjList: number[][], x: Float64Array, attacked: number[], dmg: number, steps = 40): { final: number; hist: number[] } {
  const n = adjList.length;
  let h = new Float32Array(n).fill(100);
  for (const nd of attacked) h[nd] = 0;
  const hist: number[] = [];
  for (let t = 0; t < steps; t++) {
    hist.push(h.filter(v => v > 0).length);
    const nh = new Float32Array(h);
    for (let i = 0; i < n; i++) {
      if (h[i] <= 0) continue;
      const dead = adjList[i].filter(j => h[j] <= 0).length;
      nh[i] = Math.max(0, h[i] - (dead * dmg) / (1 + x[i] / 20));
    }
    h = nh;
  }
  return { final: h.filter(v => v > 0).length / n, hist };
}
function etsEvaluateA(edges: number[][], n: number, params: ETSParamsA, useSpectral: boolean): ETSResultA {
  const { target, dmg, magicSteps, seed, alpha, lambdaE } = params;
  const adjSets = etsMakeAdj(n, edges);
  const adjList = etsAdjList(adjSets);
  const x       = etsOptMagic(adjList, target, magicSteps, 0.002, seed);
  const energy  = etsMagicE(adjList, x, target);
  const normE   = energy / (n * target * target);
  const attacked = etsGetAttacked(adjList);
  const { final: resilience, hist } = etsSimCollapse(adjList, x, attacked, dmg);
  const sg    = useSpectral ? etsSpectralGap(n, adjList) : 0;
  const normSG = sg / 2;
  const score = resilience + (useSpectral ? alpha * normSG : 0) - lambdaE * normE;
  return { score, resilience, energy, sg, normSG, x, adjList, hist, attacked };
}

// ── v3B specific (three separate attack models) ───────────────────────────────

function etsAttackRandB(adjList: number[][], k: number, seed: number): number {
  const n = adjList.length, rng = etsRng(seed + 77);
  const dead = new Set([...Array(n).keys()].sort(() => rng() - 0.5).slice(0, k));
  return (n - dead.size) / n;
}
function etsAttackTargB(adjList: number[][], k: number): number {
  const n = adjList.length, alive = new Set([...Array(n).keys()]);
  for (let r = 0; r < k; r++) {
    if (!alive.size) break;
    let best = -1, bd = -1;
    for (const i of alive) { const d = adjList[i].filter(j => alive.has(j)).length; if (d > bd) { bd = d; best = i; } }
    alive.delete(best);
  }
  return alive.size / n;
}
function etsAttackCascB(adjList: number[][], initialDead: number[]): number {
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
function etsEvaluateB(edges: number[][], n: number, params: ETSParamsB, useSpectral: boolean): ETSResultB {
  const { target, magicSteps, seed, alpha, lambdaE, attackK } = params;
  const adjSets = etsMakeAdj(n, edges);
  const adjList = etsAdjList(adjSets);
  const x       = etsOptMagic(adjList, target, magicSteps, 0.002, seed);
  const energy  = etsMagicE(adjList, x, target);
  const normE   = energy / (n * target * target);
  const sg      = useSpectral ? etsSpectralGap(n, adjList) : 0;
  const normSG  = sg / 2;
  const topK    = [...Array(n).keys()].sort((a, b) => adjList[b].length - adjList[a].length).slice(0, attackK);
  const rRandom   = etsAttackRandB(adjList, attackK, seed);
  const rTargeted = etsAttackTargB(adjList, attackK);
  const rCascade  = etsAttackCascB(adjList, topK);
  const resilience = 0.2 * rRandom + 0.4 * rTargeted + 0.4 * rCascade;
  const score = resilience + (useSpectral ? alpha * normSG : 0) - lambdaE * normE;
  return { score, resilience, energy, sg, normSG, rRandom, rTargeted, rCascade, x, adjList, attacked: topK };
}

// ── Shared Charts ─────────────────────────────────────────────────────────────

function ETSLineChart({ series, height = 80, width = 270 }: {
  series: ETSLineSeries[]; height?: number; width?: number;
}) {
  const pad = { t: 8, r: 8, b: 18, l: 36 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const all = series.flatMap(s => s.data).filter(isFinite);
  if (!all.length) return <svg width={width} height={height} />;
  const yMin = Math.min(...all), yMax = Math.max(...all) || 1;
  const xLen = Math.max(...series.map(s => s.data.length), 2);
  const tx = (i: number) => (i / (xLen - 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const mkPath = (d: number[]) => d.map((v, i) => `${i === 0 ? "M" : "L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#162030" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={8} fill="#3a5570">
              {(yMin + f * (yMax - yMin)).toFixed(yMax - yMin < 1 ? 2 : 0)}
            </text>
          </g>
        ))}
        {series.map(s => (
          <path key={s.label} d={mkPath(s.data)} fill="none" stroke={s.color}
            strokeWidth={s.bold ? 2.5 : 1.8} strokeLinejoin="round" opacity={s.dim ? 0.4 : 1} />
        ))}
      </g>
    </svg>
  );
}

function ETSGraphViz({ adjList, x, attacked = [], size = 160, seed = 77 }: {
  adjList: number[][]; x: Float64Array; attacked?: number[]; size?: number; seed?: number;
}) {
  const n = adjList.length;
  const rng = etsRng(seed);
  const pos = Array.from({ length: n }, () => ({ x: 18 + rng() * (size - 36), y: 18 + rng() * (size - 36) }));
  const mx = Math.max(...Array.from(x)), mn = Math.min(...Array.from(x));
  const col = (v: number) => {
    const t = mx === mn ? 0.5 : (v - mn) / (mx - mn);
    return `hsl(${Math.round(200 - t * 140)},${Math.round(55 + t * 40)}%,${Math.round(35 + t * 30)}%)`;
  };
  return (
    <svg width={size} height={size} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10 }}>
      {adjList.map((nb, i) => nb.filter(j => j > i).map(j => (
        <line key={`${i}-${j}`} x1={pos[i].x} y1={pos[i].y} x2={pos[j].x} y2={pos[j].y}
          stroke="#1a3050" strokeWidth={1.2} />
      )))}
      {pos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={attacked.includes(i) ? 10 : 8}
            fill={attacked.includes(i) ? "#cc2222" : col(x[i])}
            stroke={attacked.includes(i) ? "#ff5555" : "none"} strokeWidth={2} />
          <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={6.5} fill="#fff" fontWeight="bold">{i}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Shared UI Atoms ───────────────────────────────────────────────────────────

function ETSParam({ label, val, set, min, max, step, color = ETS_C.a, hint }: {
  label: string; val: number; set: (v: number) => void;
  min: number; max: number; step: number; color?: string; hint?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: ETS_C.dim, marginBottom: 3 }}>
        {label}: <span style={{ color, fontWeight: 700 }}>{val}</span>
        {hint && <span style={{ color: "#1e3050", marginLeft: 8, fontSize: 9 }}>{hint}</span>}
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        style={{ width: "100%", accentColor: color }} />
    </div>
  );
}

function ETSStat({ label, value, color = ETS_C.a, sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22`, borderRadius: 9, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, color: ETS_C.dim, letterSpacing: 1, textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#1e3050", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// v3B attack breakdown bar
function ETSAttackBar({ label, valA, valB, colorA, colorB }: {
  label: string; valA: number; valB: number; colorA: string; colorB: string;
}) {
  const max = Math.max(valA, valB, 0.01);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: ETS_C.dim, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ width: 36, fontSize: 10, color: colorA, textAlign: "right" as const, fontFamily: "monospace" }}>
          {(valA * 100).toFixed(0)}%
        </div>
        <div style={{ flex: 1, height: 10, background: "#0a1525", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: `${(valA / max) * 50}%`, background: colorA, opacity: 0.7, borderRadius: "5px 0 0 5px" }} />
            <div style={{ width: 2 }} />
            <div style={{ width: `${(valB / max) * 50}%`, background: colorB, opacity: 0.7, borderRadius: "0 5px 5px 0" }} />
          </div>
        </div>
        <div style={{ width: 36, fontSize: 10, color: colorB, fontFamily: "monospace" }}>
          {(valB * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

// ── v3A Panel ─────────────────────────────────────────────────────────────────

function ETSPanelA({ color, label, useSpectral, log, init, best, alpha, lambdaE }: {
  color: string; label: string; useSpectral: boolean;
  log: ETSLogEntry[]; init: ETSResultA | null; best: ETSResultA | null;
  alpha: number; lambdaE: number;
}) {
  return (
    <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: `${color}12`, border: `1px solid ${color}44`, borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 10, color: ETS_C.dim, marginTop: 3 }}>
          {useSpectral
            ? `score = resilience + ${alpha}*l2_norm - ${lambdaE}*E_norm`
            : `score = resilience - ${lambdaE}*E_norm`}
        </div>
      </div>

      {log.length > 2 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 11, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: ETS_C.dim, marginBottom: 4, letterSpacing: 1 }}>SCORE</div>
          <ETSLineChart series={[{ label: "s", data: log.map(l => l.score), color, bold: true }]} height={65} width={270} />
          <div style={{ fontSize: 9, color: ETS_C.dim, margin: "8px 0 4px", letterSpacing: 1 }}>RESILIENCE</div>
          <ETSLineChart series={[{ label: "r", data: log.map(l => l.resilience), color: ETS_C.green, bold: true }]} height={65} width={270} />
          {useSpectral && (
            <>
              <div style={{ fontSize: 9, color: ETS_C.dim, margin: "8px 0 4px", letterSpacing: 1 }}>SPECTRAL GAP l2</div>
              <ETSLineChart series={[{ label: "sg", data: log.map(l => l.sg), color: ETS_C.orange, bold: true }]} height={55} width={270} />
            </>
          )}
        </div>
      )}

      {init && best ? (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 11, padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: ETS_C.red, marginBottom: 6, fontWeight: 700 }}>INITIAL</div>
              <ETSGraphViz adjList={init.adjList} x={init.x} attacked={init.attacked} size={130} seed={88} />
            </div>
            <div>
              <div style={{ fontSize: 9, color, marginBottom: 6, fontWeight: 700 }}>OPTIMIZED</div>
              <ETSGraphViz adjList={best.adjList} x={best.x} attacked={best.attacked} size={130} seed={88} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            <ETSStat label="Resilience Delta"
              value={`${best.resilience >= init.resilience ? "+" : ""}${((best.resilience - init.resilience) * 100).toFixed(1)}%`}
              color={best.resilience >= init.resilience ? color : ETS_C.red} />
            <ETSStat label="Score Delta"
              value={(best.score - init.score).toFixed(3)}
              color={best.score >= init.score ? color : ETS_C.red} />
            <ETSStat label="l2 init to best"
              value={`${init.sg.toFixed(2)} to ${best.sg.toFixed(2)}`}
              color={ETS_C.orange} sub="spectral gap" />
            <ETSStat label="Energy Delta"
              value={(best.energy - init.energy).toFixed(0)}
              color={best.energy <= init.energy ? color : ETS_C.red} sub="lower=better" />
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 9, color: ETS_C.dim, marginBottom: 4, letterSpacing: 1 }}>COLLAPSE: initial vs optimized</div>
            <ETSLineChart
              series={[
                { label: "init", data: init.hist, color: ETS_C.red },
                { label: "best", data: best.hist, color, bold: true },
              ]}
              height={80} width={270} />
          </div>
        </div>
      ) : (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#162030", fontSize: 11, letterSpacing: 3, border: "1px dashed #162030", borderRadius: 11 }}>
          WAITING
        </div>
      )}
    </div>
  );
}

// ── v3B Panel ─────────────────────────────────────────────────────────────────

function ETSPanelB({ color, label, useSpectral, log, init, best, alpha, lambdaE }: {
  color: string; label: string; useSpectral: boolean;
  log: ETSLogEntry[]; init: ETSResultB | null; best: ETSResultB | null;
  alpha: number; lambdaE: number;
}) {
  return (
    <div style={{ flex: 1, minWidth: 275, display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: `${color}10`, border: `1px solid ${color}44`, borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 10, color: ETS_C.dim, marginTop: 3 }}>
          {useSpectral
            ? `score = 0.2R_rand + 0.4R_hub + 0.4R_cascade + ${alpha}*l2 - ${lambdaE}*E`
            : `score = 0.2R_rand + 0.4R_hub + 0.4R_cascade - ${lambdaE}*E`}
        </div>
      </div>

      {log.length > 2 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 11, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, color: ETS_C.dim, marginBottom: 3, letterSpacing: 1 }}>SCORE</div>
          <ETSLineChart series={[{ label: "s", data: log.map(l => l.score), color, bold: true }]} height={60} width={255} />
          <div style={{ fontSize: 9, color: ETS_C.dim, margin: "8px 0 3px", letterSpacing: 1 }}>RESILIENCE (weighted)</div>
          <ETSLineChart series={[{ label: "r", data: log.map(l => l.resilience), color: ETS_C.green, bold: true }]} height={60} width={255} />
          {useSpectral && (
            <>
              <div style={{ fontSize: 9, color: ETS_C.dim, margin: "8px 0 3px", letterSpacing: 1 }}>SPECTRAL GAP l2</div>
              <ETSLineChart series={[{ label: "sg", data: log.map(l => l.sg), color: ETS_C.orange, bold: true }]} height={50} width={255} />
            </>
          )}
        </div>
      )}

      {init && best ? (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030", borderRadius: 11, padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: ETS_C.red, marginBottom: 5, fontWeight: 700 }}>INITIAL</div>
              <ETSGraphViz adjList={init.adjList} x={init.x} attacked={init.attacked} size={125} seed={99} />
            </div>
            <div>
              <div style={{ fontSize: 9, color, marginBottom: 5, fontWeight: 700 }}>OPTIMIZED</div>
              <ETSGraphViz adjList={best.adjList} x={best.x} attacked={best.attacked} size={125} seed={99} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
            <ETSStat label="Resilience Delta"
              value={`${best.resilience >= init.resilience ? "+" : ""}${((best.resilience - init.resilience) * 100).toFixed(1)}%`}
              color={best.resilience >= init.resilience ? color : ETS_C.red} />
            <ETSStat label="l2 init to best"
              value={`${init.sg.toFixed(2)} to ${best.sg.toFixed(2)}`}
              color={ETS_C.orange} sub="spectral gap" />
          </div>
          <div style={{ fontSize: 9, color: ETS_C.dim, marginBottom: 8, letterSpacing: 1 }}>PER-ATTACK: initial vs optimized</div>
          <ETSAttackBar label="Random Failure" valA={init.rRandom}   valB={best.rRandom}   colorA={ETS_C.red} colorB={color} />
          <ETSAttackBar label="Targeted Hub"   valA={init.rTargeted} valB={best.rTargeted} colorA={ETS_C.red} colorB={color} />
          <ETSAttackBar label="Cascade Load"   valA={init.rCascade}  valB={best.rCascade}  colorA={ETS_C.red} colorB={color} />
        </div>
      ) : (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#162030", fontSize: 11, letterSpacing: 3, border: "1px dashed #162030", borderRadius: 11 }}>
          WAITING
        </div>
      )}
    </div>
  );
}

// ── v3A Tab Content ───────────────────────────────────────────────────────────

function ETSv3AContent() {
  const [n, setN] = useState(18); const [edgeCount, setEdgeCount] = useState(28);
  const [saSteps, setSaSteps] = useState(100); const [magicSteps, setMagicSteps] = useState(250);
  const [target, setTarget] = useState(20); const [dmg, setDmg] = useState(1);
  const [lambdaE, setLambdaE] = useState(0.1); const [alpha, setAlpha] = useState(0.3);
  const [temp0, setTemp0] = useState(0.3); const [seed, setSeed] = useState(42);

  const [logA, setLogA] = useState<ETSLogEntry[]>([]); const [initA, setInitA] = useState<ETSResultA | null>(null);
  const [bestA, setBestA] = useState<ETSResultA | null>(null); const [progA, setProgA] = useState(0);
  const [runA, setRunA] = useState(false);
  const [logB, setLogB] = useState<ETSLogEntry[]>([]); const [initB, setInitB] = useState<ETSResultA | null>(null);
  const [bestB, setBestB] = useState<ETSResultA | null>(null); const [progB, setProgB] = useState(0);
  const [runB, setRunB] = useState(false);
  const cancelA = useRef(false); const cancelB = useRef(false);

  const params: ETSParamsA = { target, dmg, magicSteps, seed, alpha, lambdaE };

  function startSA(useSpectral: boolean) {
    const cancel = useSpectral ? cancelB : cancelA;
    const setLog = useSpectral ? setLogB : setLogA;
    const setInit = useSpectral ? setInitB : setInitA;
    const setBest = useSpectral ? setBestB : setBestA;
    const setProg = useSpectral ? setProgB : setProgA;
    const setRun  = useSpectral ? setRunB : setRunA;
    cancel.current = false;
    setRun(true); setLog([]); setInit(null); setBest(null); setProg(0);
    const initEdges = etsInitGraph(n, edgeCount, seed);
    const init = etsEvaluateA(initEdges, n, params, useSpectral);
    setInit(init);
    let curEdges = initEdges, curScore = init.score;
    let bstScore = init.score, bstEdges = initEdges;
    const logLocal: ETSLogEntry[] = [{ step: 0, score: init.score, resilience: init.resilience, sg: init.sg }];
    const rng = etsRng(seed + (useSpectral ? 500 : 0));
    let step = 0;
    const chunk = () => {
      if (cancel.current) { setRun(false); return; }
      const CHUNK = 4;
      for (let c = 0; c < CHUNK && step < saSteps; c++, step++) {
        const T = temp0 * Math.exp(-3 * step / saSteps);
        const cand = etsSAStep(curEdges, n, rng);
        if (!cand) continue;
        const res = etsEvaluateA(cand, n, { ...params, seed: seed + step }, useSpectral);
        const d = res.score - curScore;
        if (d > 0 || Math.random() < Math.exp(d / Math.max(T, 1e-6))) {
          curEdges = cand; curScore = res.score;
          if (res.score > bstScore) { bstScore = res.score; bstEdges = cand; setBest(res); }
        }
        logLocal.push({ step: step + 1, score: curScore, resilience: res.resilience, sg: res.sg });
      }
      setProg(Math.round(step / saSteps * 100));
      setLog([...logLocal]);
      if (step < saSteps) setTimeout(chunk, 0);
      else {
        setBest(etsEvaluateA(bstEdges, n, params, useSpectral));
        setRun(false);
      }
    };
    setTimeout(chunk, 20);
  }

  const runBoth = () => { startSA(false); setTimeout(() => startSA(true), 60); };
  const v = bestA && bestB ? {
    resGain: ((bestB.resilience - bestA.resilience) * 100).toFixed(1),
    sgA: bestA.sg.toFixed(3), sgB: bestB.sg.toFixed(3),
    resWins: bestB.resilience > bestA.resilience,
    sgHigher: bestB.sg > bestA.sg,
  } : null;

  return (
    <div className="space-y-4" style={{ fontFamily: "'Courier New',monospace", color: "#b0c8e0" }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: 5, color: ETS_C.a, marginBottom: 4 }}>v3A - SPECTRAL GAP EXPERIMENT</div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900,
          background: "linear-gradient(100deg,#00e5ff,#ffd700 55%,#a8ff78)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Does l2 Help Resilience?
        </h3>
        <p style={{ margin: "5px 0 0", fontSize: 11, color: ETS_C.dim, maxWidth: 560 }}>
          Two parallel SAs with the same initial graph, same rewiring, same attack - only difference:{" "}
          <span style={{ color: ETS_C.b }}>presence or absence of spectral gap in fitness</span>.
          Does algebraic connectivity improve survival?
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const, alignItems: "flex-start" }}>
        {/* params */}
        <div style={{ minWidth: 205, maxWidth: 220 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030",
            borderRadius: 13, padding: 16, display: "flex", flexDirection: "column" as const, gap: 11 }}>
            <div style={{ fontSize: 10, color: ETS_C.dim, letterSpacing: 1 }}>GRAPH</div>
            <ETSParam label="Nodes"       val={n}          set={setN}          min={10}   max={25}  step={1} />
            <ETSParam label="Edges"       val={edgeCount}  set={setEdgeCount}  min={n - 1} max={55} step={1}
              hint={`${(edgeCount * 2 / (n * (n - 1)) * 100).toFixed(0)}% dense`} />
            <ETSParam label="Seed"        val={seed}       set={setSeed}       min={1}    max={99}  step={1} />
            <div style={{ fontSize: 10, color: ETS_C.dim, letterSpacing: 1, marginTop: 4 }}>SA</div>
            <ETSParam label="Steps"       val={saSteps}    set={setSaSteps}    min={20}   max={200} step={10} color={ETS_C.b}
              hint={saSteps >= 80 ? "thorough" : "fast"} />
            <ETSParam label="T0 temp"     val={temp0}      set={setTemp0}      min={0.05} max={1}   step={0.05} color={ETS_C.b} />
            <div style={{ fontSize: 10, color: ETS_C.dim, letterSpacing: 1, marginTop: 4 }}>OBJECTIVE</div>
            <ETSParam label="alpha (spectral)" val={alpha} set={setAlpha}      min={0.05} max={1}   step={0.05} color={ETS_C.orange} hint="only in v3A" />
            <ETSParam label="lambda E"    val={lambdaE}    set={setLambdaE}    min={0}    max={0.5} step={0.05} color={ETS_C.green} />
            <ETSParam label="Magic target" val={target}    set={setTarget}     min={5}    max={40}  step={5} />
            <ETSParam label="Magic steps" val={magicSteps} set={setMagicSteps} min={100}  max={400} step={50} color={ETS_C.green} />
            <ETSParam label="Damage rate" val={dmg}        set={setDmg}        min={0.5}  max={4}   step={0.5} color={ETS_C.red} />
            <button onClick={runBoth} disabled={runA || runB} style={{
              marginTop: 6,
              background: (runA || runB) ? "#162030" : "linear-gradient(135deg,rgba(0,229,255,0.15),rgba(255,215,0,0.15))",
              border: `1px solid ${(runA || runB) ? "#162030" : ETS_C.a}`,
              color: (runA || runB) ? ETS_C.dim : ETS_C.a,
              borderRadius: 9, padding: "11px 0", cursor: (runA || runB) ? "not-allowed" : "pointer",
              fontFamily: "monospace", fontWeight: 700, fontSize: 12, letterSpacing: 1,
            }}>
              {(runA || runB) ? `A:${progA}% B:${progB}%` : "RUN BOTH"}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {([false, true] as boolean[]).map(sp => (
                <button key={String(sp)} onClick={() => startSA(sp)} disabled={sp ? runB : runA} style={{
                  flex: 1, background: `rgba(${sp ? "255,215,0" : "0,229,255"},0.08)`,
                  border: `1px solid ${sp ? ETS_C.b : ETS_C.a}55`,
                  color: (sp ? runB : runA) ? ETS_C.dim : (sp ? ETS_C.b : ETS_C.a),
                  borderRadius: 8, padding: "7px 0",
                  cursor: (sp ? runB : runA) ? "not-allowed" : "pointer",
                  fontFamily: "monospace", fontWeight: 700, fontSize: 10,
                }}>
                  {(sp ? runB : runA) ? `${sp ? progB : progA}%` : (sp ? "B only" : "A only")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ETSPanelA color={ETS_C.a} label="VERSION A - No Spectral Gap"
          useSpectral={false} log={logA} init={initA} best={bestA} alpha={alpha} lambdaE={lambdaE} />
        <ETSPanelA color={ETS_C.b} label="VERSION B - With Spectral Gap (l2)"
          useSpectral={true}  log={logB} init={initB} best={bestB} alpha={alpha} lambdaE={lambdaE} />
      </div>

      {v && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${v.resWins ? ETS_C.b + "44" : ETS_C.red + "44"}`,
          borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ fontSize: 11, color: v.resWins ? ETS_C.b : ETS_C.red, letterSpacing: 2, marginBottom: 12 }}>
            RESEARCH FINDING
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            <ETSStat label="Resilience B vs A"
              value={`${parseFloat(v.resGain) > 0 ? "+" : ""}${v.resGain}%`}
              color={v.resWins ? ETS_C.b : ETS_C.red} sub="did spectral gap help?" />
            <ETSStat label="l2: A to B"
              value={`${v.sgA} to ${v.sgB}`} color={ETS_C.orange} sub="algebraic connectivity" />
            <ETSStat label="Resilience A"
              value={`${(bestA!.resilience * 100).toFixed(0)}%`}
              color={ETS_C.a} sub="without spectral" />
          </div>
          <div style={{ fontSize: 13, color: "#8ab0cc", lineHeight: 1.8 }}>
            {v.resWins && v.sgHigher &&
              `Spectral gap in fitness caused SA to find networks with higher algebraic connectivity (${v.sgA} to ${v.sgB}) and better resilience (+${v.resGain}%). Spectral gap works as a proxy for robustness.`}
            {v.resWins && !v.sgHigher &&
              `Resilience improved (+${v.resGain}%) but l2 did not increase - SA found a better topology through a non-spectral path.`}
            {!v.resWins && v.sgHigher &&
              `l2 increased in B (${v.sgA} to ${v.sgB}) but resilience did not improve (${v.resGain}%). Confirms the warning: larger l2 is not always better - more connectivity can accelerate propagation.`}
            {!v.resWins && !v.sgHigher &&
              `Neither spectral gap nor resilience improved in B. Try increasing alpha or SA steps.`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── v3B Tab Content ───────────────────────────────────────────────────────────

function ETSv3BContent() {
  const [n, setN] = useState(18); const [edgeCount, setEdgeCount] = useState(28);
  const [saSteps, setSaSteps] = useState(100); const [magicSteps, setMagicSteps] = useState(250);
  const [target, setTarget] = useState(20); const [lambdaE, setLambdaE] = useState(0.1);
  const [alpha, setAlpha] = useState(0.3); const [temp0, setTemp0] = useState(0.3);
  const [attackK, setAttackK] = useState(3); const [seed, setSeed] = useState(42);

  const [logA, setLogA] = useState<ETSLogEntry[]>([]); const [initA, setInitA] = useState<ETSResultB | null>(null);
  const [bestA, setBestA] = useState<ETSResultB | null>(null); const [progA, setProgA] = useState(0);
  const [runA, setRunA] = useState(false);
  const [logB, setLogB] = useState<ETSLogEntry[]>([]); const [initB, setInitB] = useState<ETSResultB | null>(null);
  const [bestB, setBestB] = useState<ETSResultB | null>(null); const [progB, setProgB] = useState(0);
  const [runB, setRunB] = useState(false);
  const cancelA = useRef(false); const cancelB = useRef(false);

  const params: ETSParamsB = { target, magicSteps, seed, alpha, lambdaE, attackK };

  function startSA(useSpectral: boolean) {
    const cancel = useSpectral ? cancelB : cancelA;
    const setLog = useSpectral ? setLogB : setLogA;
    const setInit = useSpectral ? setInitB : setInitA;
    const setBest = useSpectral ? setBestB : setBestA;
    const setProg = useSpectral ? setProgB : setProgA;
    const setRun  = useSpectral ? setRunB : setRunA;
    cancel.current = false;
    setRun(true); setLog([]); setInit(null); setBest(null); setProg(0);
    const initEdges = etsInitGraph(n, edgeCount, seed);
    const init = etsEvaluateB(initEdges, n, params, useSpectral);
    setInit(init);
    let curEdges = initEdges, curScore = init.score;
    let bstScore = init.score, bstEdges = initEdges;
    const logLocal: ETSLogEntry[] = [{ step: 0, score: init.score, resilience: init.resilience, sg: init.sg }];
    const rng = etsRng(seed + (useSpectral ? 500 : 0));
    let step = 0;
    const chunk = () => {
      if (cancel.current) { setRun(false); return; }
      const CHUNK = 3;
      for (let c = 0; c < CHUNK && step < saSteps; c++, step++) {
        const T = temp0 * Math.exp(-3 * step / saSteps);
        const cand = etsSAStep(curEdges, n, rng);
        if (!cand) continue;
        const res = etsEvaluateB(cand, n, { ...params, seed: seed + step }, useSpectral);
        const d = res.score - curScore;
        if (d > 0 || Math.random() < Math.exp(d / Math.max(T, 1e-6))) {
          curEdges = cand; curScore = res.score;
          if (res.score > bstScore) { bstScore = res.score; bstEdges = cand; setBest(res); }
        }
        logLocal.push({ step: step + 1, score: curScore, resilience: res.resilience, sg: res.sg });
      }
      setProg(Math.round(step / saSteps * 100));
      setLog([...logLocal]);
      if (step < saSteps) setTimeout(chunk, 0);
      else { setBest(etsEvaluateB(bstEdges, n, params, useSpectral)); setRun(false); }
    };
    setTimeout(chunk, 20);
  }

  const runBoth = () => { startSA(false); setTimeout(() => startSA(true), 80); };
  const v = bestA && bestB ? {
    resWins:     bestB.resilience > bestA.resilience,
    sgIncreased: bestB.sg > bestA.sg,
    cascDiff:    ((bestB.rCascade  - bestA.rCascade)  * 100).toFixed(1),
    targDiff:    ((bestB.rTargeted - bestA.rTargeted) * 100).toFixed(1),
    randDiff:    ((bestB.rRandom   - bestA.rRandom)   * 100).toFixed(1),
    resDiff:     ((bestB.resilience - bestA.resilience) * 100).toFixed(1),
    sgA: bestA.sg.toFixed(3), sgB: bestB.sg.toFixed(3),
  } : null;

  return (
    <div className="space-y-4" style={{ fontFamily: "'Courier New',monospace", color: "#b0c8e0" }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: 5, color: ETS_C.a, marginBottom: 4 }}>v3B - MULTI-ATTACK EVALUATION</div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900,
          background: "linear-gradient(100deg,#00e5ff,#ffd700 50%,#a8ff78)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          l2 x Three Attack Models
        </h3>
        <p style={{ margin: "5px 0 0", fontSize: 11, color: ETS_C.dim, maxWidth: 580 }}>
          Question: does spectral gap only help{" "}
          <span style={{ color: ETS_C.orange }}>cascade</span> robustness, or also{" "}
          <span style={{ color: ETS_C.red }}>random</span> and{" "}
          <span style={{ color: ETS_C.b }}>targeted</span> attacks?{" "}
          fitness = 0.2R_rand + 0.4R_hub + 0.4R_cascade
        </p>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const, alignItems: "flex-start" }}>
        {/* params */}
        <div style={{ minWidth: 200, maxWidth: 215 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030",
            borderRadius: 13, padding: 16, display: "flex", flexDirection: "column" as const, gap: 10 }}>
            <div style={{ fontSize: 10, color: ETS_C.dim, letterSpacing: 1 }}>GRAPH</div>
            <ETSParam label="Nodes"       val={n}          set={setN}          min={10}   max={25}  step={1} />
            <ETSParam label="Edges"       val={edgeCount}  set={setEdgeCount}  min={n - 1} max={55} step={1}
              hint={`${(edgeCount * 2 / (n * (n - 1)) * 100).toFixed(0)}%`} />
            <ETSParam label="Attack k"    val={attackK}    set={setAttackK}    min={1}    max={6}   step={1}  color={ETS_C.red} hint="nodes removed" />
            <ETSParam label="Seed"        val={seed}       set={setSeed}       min={1}    max={99}  step={1} />
            <div style={{ fontSize: 10, color: ETS_C.dim, letterSpacing: 1, marginTop: 4 }}>ANNEALING</div>
            <ETSParam label="SA steps"    val={saSteps}    set={setSaSteps}    min={20}   max={200} step={10} color={ETS_C.b}
              hint={saSteps >= 80 ? "thorough" : "fast"} />
            <ETSParam label="T0"          val={temp0}      set={setTemp0}      min={0.05} max={1}   step={0.05} color={ETS_C.b} />
            <div style={{ fontSize: 10, color: ETS_C.dim, letterSpacing: 1, marginTop: 4 }}>OBJECTIVE</div>
            <ETSParam label="alpha (B only)" val={alpha}   set={setAlpha}      min={0.05} max={1}   step={0.05} color={ETS_C.orange} />
            <ETSParam label="lambda E"    val={lambdaE}    set={setLambdaE}    min={0}    max={0.5} step={0.05} color={ETS_C.green} />
            <ETSParam label="Magic target" val={target}    set={setTarget}     min={5}    max={40}  step={5} />
            <ETSParam label="Magic steps" val={magicSteps} set={setMagicSteps} min={100}  max={400} step={50} color={ETS_C.green} />
            <button onClick={runBoth} disabled={runA || runB} style={{
              marginTop: 6,
              background: (runA || runB) ? "#162030" : "linear-gradient(135deg,rgba(0,229,255,0.12),rgba(255,215,0,0.12))",
              border: `1px solid ${(runA || runB) ? "#162030" : ETS_C.a}`,
              color: (runA || runB) ? ETS_C.dim : ETS_C.a,
              borderRadius: 9, padding: "11px 0", cursor: (runA || runB) ? "not-allowed" : "pointer",
              fontFamily: "monospace", fontWeight: 700, fontSize: 12, letterSpacing: 1,
            }}>
              {(runA || runB) ? `A:${progA}% B:${progB}%` : "RUN BOTH"}
            </button>
            <div style={{ display: "flex", gap: 7 }}>
              {([false, true] as boolean[]).map(sp => (
                <button key={String(sp)} onClick={() => startSA(sp)} disabled={sp ? runB : runA} style={{
                  flex: 1, background: `rgba(${sp ? "255,215,0" : "0,229,255"},0.06)`,
                  border: `1px solid ${sp ? ETS_C.b : ETS_C.a}55`,
                  color: (sp ? runB : runA) ? ETS_C.dim : (sp ? ETS_C.b : ETS_C.a),
                  borderRadius: 8, padding: "7px 0",
                  cursor: (sp ? runB : runA) ? "not-allowed" : "pointer",
                  fontFamily: "monospace", fontWeight: 700, fontSize: 10,
                }}>
                  {(sp ? runB : runA) ? `${sp ? progB : progA}%` : (sp ? "B only" : "A only")}
                </button>
              ))}
            </div>
            {(runA || runB) && (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                {([["A", progA, ETS_C.a], ["B", progB, ETS_C.b]] as [string, number, string][]).map(([l, p, c]) => (
                  <div key={l}>
                    <div style={{ fontSize: 9, color: ETS_C.dim, marginBottom: 2 }}>{l}: {p}%</div>
                    <div style={{ background: "#0a1525", borderRadius: 3, height: 4 }}>
                      <div style={{ height: "100%", width: `${p}%`, background: c, borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <ETSPanelB color={ETS_C.a} label="VERSION A - No Spectral Gap"
          useSpectral={false} log={logA} init={initA} best={bestA} alpha={alpha} lambdaE={lambdaE} />
        <ETSPanelB color={ETS_C.b} label="VERSION B - With Spectral Gap l2"
          useSpectral={true}  log={logB} init={initB} best={bestB} alpha={alpha} lambdaE={lambdaE} />
      </div>

      {v && (
        <div style={{ background: "rgba(255,255,255,0.02)",
          border: `1px solid ${v.resWins ? ETS_C.b + "55" : ETS_C.red + "55"}`,
          borderRadius: 14, padding: "18px 22px" }}>
          <div style={{ fontSize: 11, color: v.resWins ? ETS_C.b : ETS_C.red, letterSpacing: 2, marginBottom: 14 }}>
            RESEARCH FINDING - v3B
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
            <ETSStat label="Overall Resilience"
              value={`${parseFloat(v.resDiff) > 0 ? "+" : ""}${v.resDiff}%`}
              color={v.resWins ? ETS_C.b : ETS_C.red} sub="B vs A" />
            <ETSStat label="Random Failure"
              value={`${parseFloat(v.randDiff) > 0 ? "+" : ""}${v.randDiff}%`}
              color={parseFloat(v.randDiff) > 0 ? ETS_C.green : ETS_C.red} />
            <ETSStat label="Targeted Hub"
              value={`${parseFloat(v.targDiff) > 0 ? "+" : ""}${v.targDiff}%`}
              color={parseFloat(v.targDiff) > 0 ? ETS_C.green : ETS_C.red} />
            <ETSStat label="Cascade Load"
              value={`${parseFloat(v.cascDiff) > 0 ? "+" : ""}${v.cascDiff}%`}
              color={parseFloat(v.cascDiff) > 0 ? ETS_C.orange : ETS_C.red}
              sub="does spectral help here?" />
          </div>
          <div style={{ fontSize: 13, color: "#8ab0cc", lineHeight: 1.9 }}>
            {v.resWins && v.sgIncreased && parseFloat(v.cascDiff) > parseFloat(v.randDiff)
              ? `Hypothesis confirmed: spectral gap mainly helped through cascade robustness (+${v.cascDiff}%) - algebraic connectivity blocked load propagation.`
              : v.resWins && v.sgIncreased
              ? `Spectral gap improved resilience, but the benefit was spread evenly across attack types, not just cascade.`
              : v.resWins && !v.sgIncreased
              ? `B outperformed A but l2 did not increase - SA found better topology through structural changes, not via algebraic connectivity.`
              : !v.resWins && v.sgIncreased
              ? `Warning confirmed: l2 increased in B (${v.sgA} to ${v.sgB}) but resilience decreased - more connectivity accelerated damage propagation.`
              : `Neither improved. Try increasing steps or alpha.`}{" "}
            <span style={{ color: ETS_C.dim }}>
              (l2: A={v.sgA} B={v.sgB})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

type ETSTab = "v3a" | "v3b";

export default function ExplorationTopologySA() {
  const [subTab, setSubTab] = useState<ETSTab>("v3a");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {([["v3a", "v3A: Does l2 Help?"], ["v3b", "v3B: Multi-Attack"]] as [ETSTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`px-4 py-1.5 rounded-t text-xs font-semibold transition-colors ${
              subTab === id
                ? "bg-cyan-900 text-cyan-200 border-b-2 border-cyan-400"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            {label}
          </button>
        ))}
      </div>
      {subTab === "v3a" && <ETSv3AContent />}
      {subTab === "v3b" && <ETSv3BContent />}
    </div>
  );
}

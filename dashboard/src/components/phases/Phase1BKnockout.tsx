"use client";
import { useState } from "react";

// ──────────────────────────────────────────────────────────────────
//  DATA
// ──────────────────────────────────────────────────────────────────

const EDGES_KB: [number, number][] = [
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

const NEURON_NAMES_KB: Record<number, string> = {
  0:"AVAL",1:"AVAR",2:"AVBL",3:"AVBR",4:"PVCL",5:"PVCR",
  6:"AVDL",7:"AVDR",8:"AIBR",9:"AIBL",10:"RIBL",11:"RIBR",
  12:"DA1",13:"DA2",14:"DA3",15:"DA4",16:"DA5",17:"DA6",
  18:"DA7",19:"DA8",20:"DA9",21:"DB1",22:"DB2",23:"DB3",
  24:"DB4",25:"DB5",26:"DB6",27:"DB7",28:"DD1",29:"DD2",
  30:"DD3",31:"DD4",32:"DD5",33:"DD6",34:"VD1",35:"VD2",
  36:"VD3",37:"VD4",38:"VD5",39:"VA1",40:"VA2",41:"VA3",
  42:"VA4",43:"VA5",44:"VB1",45:"VB2",46:"VB3",47:"VB4",
  48:"VB5",49:"PLML",50:"PLMR",51:"ALML",52:"ALMR",53:"AVM",
  54:"PVM",55:"AVJL",56:"AVJR",57:"DVA",58:"PVP",59:"LUAL",60:"LUAR",
};

const NODE_TYPES_KB: Record<number, number> = {
  0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:5,9:5,10:5,11:5,
  12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,
  21:2,22:2,23:2,24:2,25:2,26:2,27:2,
  28:3,29:3,30:3,31:3,32:3,33:3,34:3,35:3,36:3,37:3,38:3,
  39:1,40:1,41:1,42:1,43:1,
  44:2,45:2,46:2,47:2,48:2,
  49:4,50:4,51:4,52:4,53:4,54:4,
  55:5,56:5,57:5,58:5,59:5,60:5,
};

const TYPE_COLORS_KB = ["#00e5ff","#ff4444","#ffd700","#a855f7","#a8ff78","#6688cc"];
const TYPE_LABELS_KB = ["Command IN","Motor-A (ALS)","Motor-B","Motor-D","Sensory","Interneuron"];
const METRIC_NAMES_KB = ["Degree","Betweenness","Eigenvector","Spectral contrib","Bridge score"];
const METRIC_COLORS_KB = ["#00e5ff","#ff4444","#ffd700","#ff9944","#a855f7"];
const N_KB = 61;

type KBMetricKey = "degree"|"btwn"|"eigenv"|"spectral"|"bridge";
const METRIC_KEYS_KB: KBMetricKey[] = ["degree","btwn","eigenv","spectral","bridge"];

// ──────────────────────────────────────────────────────────────────
//  INTERFACES
// ──────────────────────────────────────────────────────────────────

interface KnockoutRecord {
  id:       number;
  name:     string;
  type:     number;
  damage:   number;
  degree:   number;
  btwn:     number;
  eigenv:   number;
  spectral: number;
  bridge:   number;
}

interface KnockoutResults {
  knockouts:      KnockoutRecord[];
  ranked:         KnockoutRecord[];
  corrs:          number[];
  bestMetricIdx:  number;
  outliers:       KnockoutRecord[];
  residuals:      number[];
  resStd:         number;
}

// ──────────────────────────────────────────────────────────────────
//  GRAPH (module-level)
// ──────────────────────────────────────────────────────────────────

function buildAdjKB(edges: [number, number][], n: number): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  return adj.map(nb => [...new Set(nb)]);
}

const ADJ_KB = buildAdjKB(EDGES_KB, N_KB);
const CAP_KB = ADJ_KB.map(nb => Math.max(nb.length, 1));

// ──────────────────────────────────────────────────────────────────
//  CASCADE SIMULATION
// ──────────────────────────────────────────────────────────────────

function cascadeKB(knockedOut: number): number {
  const cap  = new Float64Array(CAP_KB);
  const load = new Float64Array(N_KB);
  for (let i = 0; i < N_KB; i++) load[i] = cap[i];
  const alive = new Uint8Array(N_KB).fill(1);
  alive[knockedOut] = 0;
  let queue = [knockedOut];

  for (let step = 0; step < 60; step++) {
    const dying: number[] = [];
    for (const dead of queue) {
      const lnb = ADJ_KB[dead].filter(j => alive[j]);
      if (!lnb.length) continue;
      const extra = load[dead] / lnb.length;
      for (const nb of lnb) {
        load[nb] += extra;
        if (load[nb] > cap[nb] * 1.5 && alive[nb]) {
          alive[nb] = 0;
          dying.push(nb);
        }
      }
    }
    queue = dying;
    if (!dying.length) break;
  }

  const finalAlive = alive.reduce((s, v) => s + v, 0);
  return N_KB - 1 - finalAlive;
}

// ──────────────────────────────────────────────────────────────────
//  NETWORK METRICS
// ──────────────────────────────────────────────────────────────────

function computeDegreeKB(): number[] {
  return ADJ_KB.map(nb => nb.length);
}

function computeBetweennessKB(): number[] {
  const bc = new Float64Array(N_KB);
  for (let s = 0; s < N_KB; s++) {
    const stack: number[] = [];
    const pred:  number[][] = Array.from({ length: N_KB }, () => []);
    const sigma  = new Float64Array(N_KB);
    const dist   = new Int32Array(N_KB).fill(-1);
    sigma[s] = 1; dist[s] = 0;
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
      const v = q[qi]; stack.push(v);
      for (const w of ADJ_KB[v]) {
        if (dist[w] < 0) { q.push(w); dist[w] = dist[v] + 1; }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
      }
    }
    const delta = new Float64Array(N_KB);
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) bc[w] += delta[w];
    }
  }
  const factor = (N_KB - 1) * (N_KB - 2);
  return Array.from(bc).map(v => factor > 0 ? v / factor : 0);
}

function computeEigenvectorKB(iters = 100): number[] {
  let x = new Float64Array(N_KB).fill(1 / N_KB);
  for (let it = 0; it < iters; it++) {
    const y = new Float64Array(N_KB);
    for (let i = 0; i < N_KB; i++) for (const j of ADJ_KB[i]) y[i] += x[j];
    const norm = Math.sqrt(y.reduce((s, v) => s + v * v, 0)) || 1;
    x = y.map(v => v / norm);
  }
  return Array.from(x);
}

function computeSpectralContribKB(): number[] {
  const deg   = ADJ_KB.map(nb => nb.length);
  const shift = 2 * Math.max(...deg) + 1;
  const u1    = new Float64Array(N_KB).fill(1 / Math.sqrt(N_KB));
  const dot   = (a: Float64Array, b: Float64Array) => a.reduce((s, v, i) => s + v * b[i], 0);
  const nm    = (v: Float64Array) => Math.sqrt(dot(v, v));
  const defl  = (v: Float64Array, u: Float64Array): Float64Array => {
    const d = dot(v, u);
    return v.map((x, i) => x - d * u[i]);
  };
  const norm_ = (v: Float64Array): Float64Array => {
    const r = nm(v);
    return r < 1e-12 ? v : v.map(x => x / r);
  };
  const Lx = (x: Float64Array): Float64Array => {
    const y = new Float64Array(N_KB);
    for (let i = 0; i < N_KB; i++) {
      y[i] = deg[i] * x[i];
      for (const j of ADJ_KB[i]) y[i] -= x[j];
    }
    return y;
  };
  let v = norm_(defl(Float64Array.from({ length: N_KB }, (_, i) => Math.sin(i + 1)), u1));
  for (let it = 0; it < 80; it++) {
    const Lv = Lx(v);
    let w: Float64Array = v.map((x, i) => shift * x - Lv[i]);
    w = defl(w, u1);
    const r = nm(w);
    if (r < 1e-12) break;
    v = norm_(w);
  }
  return Array.from(v).map(x => Math.abs(x));
}

function computeBridgeScoreKB(): number[] {
  const scores = new Float64Array(N_KB);
  for (let ko = 0; ko < N_KB; ko++) {
    const start = ko === 0 ? 1 : 0;
    const vis = new Uint8Array(N_KB);
    vis[ko] = 1; vis[start] = 1;
    const q = [start]; let cnt = 1;
    for (let qi = 0; qi < q.length; qi++) {
      for (const nb of ADJ_KB[q[qi]]) {
        if (!vis[nb]) { vis[nb] = 1; cnt++; q.push(nb); }
      }
    }
    scores[ko] = cnt < N_KB - 1 ? 1 : 0;
  }
  return Array.from(scores);
}

// ──────────────────────────────────────────────────────────────────
//  STATS
// ──────────────────────────────────────────────────────────────────

function pearsonRKB(x: number[], y: number[]): number {
  const n  = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const dx  = Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0));
  const dy  = Math.sqrt(y.reduce((s, v) => s + (v - my) ** 2, 0));
  return (dx * dy) < 1e-12 ? 0 : num / (dx * dy);
}

// ──────────────────────────────────────────────────────────────────
//  CHARTS (SVG, prefixed KB)
// ──────────────────────────────────────────────────────────────────

interface KBScatterProps {
  xData: number[]; yData: number[]; xLabel: string; yLabel: string;
  title?: string; width?: number; height?: number; nodeTypes?: number[];
}

function KBScatterPlot({ xData, yData, xLabel, yLabel, title, width=280, height=200, nodeTypes }: KBScatterProps) {
  const pad = { t:24, r:12, b:32, l:38 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  if (!xData.length) return null;

  const xMin = Math.min(...xData), xMax = Math.max(...xData) || 1;
  const yMin = Math.min(...yData), yMax = Math.max(...yData) || 1;
  const tx = (v: number) => ((v - xMin) / (xMax - xMin || 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;

  const r  = pearsonRKB(xData, yData);
  const mx = xData.reduce((a, b) => a + b, 0) / xData.length;
  const my = yData.reduce((a, b) => a + b, 0) / yData.length;
  const m  = xData.reduce((s, v, i) => s + (v - mx) * (yData[i] - my), 0) /
             (xData.reduce((s, v) => s + (v - mx) ** 2, 0) || 1);
  const b  = my - m * mx;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {title && <text x={pad.l + W/2} y={14} textAnchor="middle" fontSize={9} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/>
            <line x1={W*f} x2={W*f} y1={0} y2={H} stroke="#0f1e30" strokeWidth={1}/>
            <text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={7} fill="#3a5570">
              {(yMin + f*(yMax-yMin)).toFixed(yMax-yMin < 2 ? 1 : 0)}
            </text>
            <text x={W*f} y={H+14} textAnchor="middle" fontSize={7} fill="#3a5570">
              {(xMin + f*(xMax-xMin)).toFixed(xMax-xMin < 2 ? 2 : 1)}
            </text>
          </g>
        ))}
        {xLabel && <text x={W/2} y={H+26} textAnchor="middle" fontSize={8} fill="#4a6a8a">{xLabel}</text>}
        {yLabel && (
          <text x={-28} y={H/2} textAnchor="middle" fontSize={8} fill="#4a6a8a"
            transform={`rotate(-90,-28,${H/2})`}>{yLabel}</text>
        )}
        <line
          x1={tx(xMin)} y1={ty(m*xMin+b)}
          x2={tx(xMax)} y2={ty(m*xMax+b)}
          stroke="#ffffff" strokeWidth={1} opacity={0.2} strokeDasharray="4,3"/>
        <text x={W-2} y={10} textAnchor="end" fontSize={9}
          fill={Math.abs(r) > 0.5 ? "#ffd700" : "#3a5570"} fontWeight="bold">
          r={r.toFixed(2)}
        </text>
        {xData.map((x, i) => (
          <circle key={i}
            cx={tx(x)} cy={ty(yData[i])} r={4}
            fill={nodeTypes ? TYPE_COLORS_KB[nodeTypes[i]] : "#00e5ff"}
            opacity={0.8}/>
        ))}
      </g>
    </svg>
  );
}

interface KBBarRankingProps { nodes: KnockoutRecord[]; width?: number; height?: number; }

function KBBarRanking({ nodes, width=520, height=200 }: KBBarRankingProps) {
  if (!nodes.length) return null;
  const top = nodes.slice(0, 15);
  const pad = { t:20, r:12, b:50, l:12 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const maxDmg = Math.max(...top.map(n => n.damage), 1);
  const bw  = W / top.length * 0.75;
  const gap = W / top.length;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W/2} y={13} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        TOP 15 CASCADE-CRITICAL NEURONS (secondary deaths)
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {top.map((node, i) => {
          const bh  = (node.damage / maxDmg) * H;
          const x   = i * gap + gap / 2 - bw / 2;
          const col = TYPE_COLORS_KB[NODE_TYPES_KB[node.id]];
          return (
            <g key={i}>
              <rect x={x} y={H-bh} width={bw} height={bh} fill={col} rx={3} opacity={0.85}/>
              <text x={x+bw/2} y={H-bh-4} textAnchor="middle" fontSize={8} fill={col} fontWeight="bold">
                {node.damage}
              </text>
              <text x={x+bw/2} y={H+12} textAnchor="middle" fontSize={8} fill={col}
                transform={`rotate(-40,${x+bw/2},${H+12})`}>
                {node.name}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H} y2={H} stroke="#162030" strokeWidth={1}/>
      </g>
    </svg>
  );
}

interface KBCorrelationBarProps {
  metrics: string[]; correlations: number[]; width?: number; height?: number;
}

function KBCorrelationBar({ metrics, correlations, width=480, height=110 }: KBCorrelationBarProps) {
  const pad  = { t:20, r:16, b:18, l:130 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const rowH = H / metrics.length;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W/2} y={13} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        PEARSON r: METRIC vs CASCADE DAMAGE
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        <line x1={W/2} x2={W/2} y1={0} y2={H} stroke="#1a3050" strokeWidth={1}/>
        {metrics.map((m, i) => {
          const r    = correlations[i];
          const barW = Math.abs(r) * (W / 2);
          const x0   = r >= 0 ? W/2 : W/2 - barW;
          const y    = i * rowH + rowH * 0.15;
          const bh   = rowH * 0.7;
          const col  = METRIC_COLORS_KB[i];
          return (
            <g key={i}>
              <text x={-8} y={y+bh/2+4} textAnchor="end" fontSize={9} fill={col}>{m}</text>
              <rect x={x0} y={y} width={barW} height={bh} fill={col} rx={3} opacity={0.8}/>
              <text x={r>=0 ? x0+barW+4 : x0-4} y={y+bh/2+4}
                textAnchor={r>=0 ? "start" : "end"} fontSize={9} fill={col} fontWeight="bold">
                {r>=0?"+":""}{r.toFixed(3)}
              </text>
            </g>
          );
        })}
        <text x={W/4}   y={H+14} textAnchor="middle" fontSize={8} fill="#3a5570">negative</text>
        <text x={3*W/4} y={H+14} textAnchor="middle" fontSize={8} fill="#3a5570">positive</text>
      </g>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────
//  UI ATOMS
// ──────────────────────────────────────────────────────────────────

interface KBStatProps { label: string; value: string; color: string; sub?: string; }

function KBStat({ label, value, color, sub }: KBStatProps) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22` }}>
      <div className="text-xs uppercase tracking-widest" style={{ color: "#3a5570" }}>{label}</div>
      <div className="text-lg font-black font-mono leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#1e3050" }}>{sub}</div>}
    </div>
  );
}

interface KBMetricSelectorProps { selected: number; onSelect: (i: number) => void; }

function KBMetricSelector({ selected, onSelect }: KBMetricSelectorProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {METRIC_NAMES_KB.map((m, i) => (
        <button key={i} onClick={() => onSelect(i)}
          className="px-2.5 py-1 rounded text-xs font-mono transition-colors"
          style={{
            background:  selected === i ? `${METRIC_COLORS_KB[i]}20` : "rgba(255,255,255,0.02)",
            border:      `1px solid ${selected === i ? METRIC_COLORS_KB[i] : "#162030"}`,
            color:       selected === i ? METRIC_COLORS_KB[i] : "#3a5570",
            fontWeight:  selected === i ? 700 : 400,
            cursor:      "pointer",
          }}>
          {m}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  RESEARCH FINDING
// ──────────────────────────────────────────────────────────────────

interface KBResearchFindingProps { R: KnockoutResults; top10Types: Record<number, number>; }

function KBResearchFinding({ R, top10Types }: KBResearchFindingProps) {
  const bestR    = R.corrs[R.bestMetricIdx];
  const isStrong = Math.abs(bestR) > 0.6;
  const isMod    = Math.abs(bestR) > 0.4;
  const bestColor = METRIC_COLORS_KB[R.bestMetricIdx];

  const dominantType = Object.entries(top10Types).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const domTypeIdx   = dominantType ? parseInt(dominantType[0]) : -1;
  const domTypeLabel = domTypeIdx >= 0 ? TYPE_LABELS_KB[domTypeIdx] : "—";
  const domTypeColor = domTypeIdx >= 0 ? TYPE_COLORS_KB[domTypeIdx] : "#3a5570";
  const domTypeCount = dominantType ? Number(dominantType[1]) : 0;

  const centralityExplains = isStrong || isMod;
  const biologyExplains    = domTypeCount >= 5;

  const borderColor = isStrong ? "#ffd70055" : isMod ? "#ff994444" : "#162030";
  const labelColor  = isStrong ? "#ffd700"   : isMod ? "#ff9944"   : "#3a5570";

  return (
    <div className="rounded-xl p-5"
      style={{ background: isStrong ? "rgba(255,215,0,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${borderColor}` }}>
      <div className="text-xs tracking-widest mb-3.5" style={{ color: labelColor, letterSpacing: "0.15em" }}>
        RESEARCH FINDING
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${bestColor}22` }}>
          <div className="text-xs uppercase tracking-widest" style={{ color: "#3a5570" }}>Best predictor</div>
          <div className="font-black font-mono" style={{ color: bestColor }}>{METRIC_NAMES_KB[R.bestMetricIdx]}</div>
          <div className="text-xs mt-0.5" style={{ color: "#1e3050" }}>r={bestR.toFixed(3)}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${domTypeColor}22` }}>
          <div className="text-xs uppercase tracking-widest" style={{ color: "#3a5570" }}>Dominant type (top 10)</div>
          <div className="font-black font-mono" style={{ color: domTypeColor }}>{domTypeLabel}</div>
          <div className="text-xs mt-0.5" style={{ color: "#1e3050" }}>{domTypeCount}/10 neurons</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #ff994422" }}>
          <div className="text-xs uppercase tracking-widest" style={{ color: "#3a5570" }}>Outliers (1.5σ)</div>
          <div className="text-lg font-black font-mono" style={{ color: "#ff9944" }}>{R.outliers.length}</div>
          <div className="text-xs mt-0.5" style={{ color: "#1e3050" }}>
            {R.outliers.slice(0, 2).map(o => o.name).join(", ")}
          </div>
        </div>
      </div>
      <div className="text-sm leading-relaxed max-w-4xl" style={{ color: "#8ab0cc" }}>
        {isStrong
          ? `✅ ${METRIC_NAMES_KB[R.bestMetricIdx]} was the strongest predictor of cascade damage (r=${bestR.toFixed(3)}) — a significant relationship.`
          : isMod
          ? `⚠️ ${METRIC_NAMES_KB[R.bestMetricIdx]} was a moderate predictor (r=${bestR.toFixed(3)}) — a relationship exists but is weak.`
          : `❌ No metric showed a strong correlation with cascade damage — cascade is not explained by centrality alone.`}
        {" "}
        {biologyExplains && centralityExplains
          ? `${domTypeCount}/10 top-critical neurons were of type ${domTypeLabel} — both centrality and biological type play a role.`
          : biologyExplains
          ? `${domTypeCount}/10 top-critical neurons were of type ${domTypeLabel} — biological type is a stronger predictor than centrality.`
          : centralityExplains
          ? `Top-critical neurons spanned multiple types — centrality explains more than biological type alone.`
          : `Neither centrality nor biological type alone is sufficient — interaction effects likely matter.`}
        {" "}
        {R.outliers.length > 0 &&
          `${R.outliers.slice(0, 2).map(o => o.name).join(" and ")} were outliers — their damage exceeded what centrality predicted.`}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────

export default function Phase1BKnockout() {
  const [results,      setResults]      = useState<KnockoutResults | null>(null);
  const [running,      setRunning]      = useState(false);
  const [activeMetric, setActiveMetric] = useState(0);
  const [activeFilter, setActiveFilter] = useState(-1);

  const runKnockout = () => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const degree   = computeDegreeKB();
      const btwn     = computeBetweennessKB();
      const eigenv   = computeEigenvectorKB();
      const spectral = computeSpectralContribKB();
      const bridge   = computeBridgeScoreKB();

      const knockouts: KnockoutRecord[] = Array.from({ length: N_KB }, (_, i) => ({
        id:       i,
        name:     NEURON_NAMES_KB[i],
        type:     NODE_TYPES_KB[i],
        damage:   cascadeKB(i),
        degree:   degree[i],
        btwn:     btwn[i],
        eigenv:   eigenv[i],
        spectral: spectral[i],
        bridge:   bridge[i],
      }));

      const dmg   = knockouts.map(k => k.damage);
      const corrs = [
        pearsonRKB(knockouts.map(k => k.degree),   dmg),
        pearsonRKB(knockouts.map(k => k.btwn),     dmg),
        pearsonRKB(knockouts.map(k => k.eigenv),   dmg),
        pearsonRKB(knockouts.map(k => k.spectral), dmg),
        pearsonRKB(knockouts.map(k => k.bridge),   dmg),
      ];

      const ranked = [...knockouts].sort((a, b) => b.damage - a.damage);

      const bestMetricIdx = corrs.indexOf(Math.max(...corrs.map(v => Math.abs(v))));
      const bestMetricKey = METRIC_KEYS_KB[bestMetricIdx];
      const xArr    = knockouts.map(k => k[bestMetricKey]);
      const mx      = xArr.reduce((a, b) => a + b, 0) / N_KB;
      const dmgMean = dmg.reduce((a, b) => a + b, 0) / N_KB;
      const mReg    = xArr.reduce((s, v, i) => s + (v - mx) * (dmg[i] - dmgMean), 0) /
                      (xArr.reduce((s, v) => s + (v - mx) ** 2, 0) || 1);
      const bReg    = dmgMean - mReg * mx;
      const residuals = knockouts.map(k => k.damage - (mReg * k[bestMetricKey] + bReg));
      const resStd    = Math.sqrt(residuals.reduce((s, v) => s + v ** 2, 0) / N_KB);
      const outliers  = knockouts
        .filter((_, i) => Math.abs(residuals[i]) > 1.5 * resStd)
        .sort((a, b) => {
          const ai = knockouts.indexOf(a), bi = knockouts.indexOf(b);
          return Math.abs(residuals[bi]) - Math.abs(residuals[ai]);
        });

      setResults({ knockouts, ranked, corrs, bestMetricIdx, outliers, residuals, resStd });
      setRunning(false);
    }, 30);
  };

  const R = results;
  const filteredKO = R
    ? (activeFilter === -1 ? R.knockouts : R.knockouts.filter(k => k.type === activeFilter))
    : [];

  const top10Types: Record<number, number> = R
    ? R.ranked.slice(0, 10).reduce<Record<number, number>>((acc, k) => {
        acc[k.type] = (acc[k.type] || 0) + 1; return acc;
      }, {})
    : {};

  const activeKey = METRIC_KEYS_KB[activeMetric];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="text-xs tracking-widest mb-1" style={{ color: "#00e5ff", letterSpacing: "0.3em" }}>
          SINGLE-NODE KNOCKOUT &middot; 61 RUNS
        </div>
        <h2 className="text-xl font-black tracking-tight mb-1"
          style={{ background: "linear-gradient(100deg,#00e5ff,#ffd700 45%,#ff4444)",
                   WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          What Makes a Neuron Cascade-Critical?
        </h2>
        <p className="text-xs max-w-xl" style={{ color: "#3a5570" }}>
          Each neuron is removed once and cascade damage is measured.{" "}
          <span style={{ color: "#ffd700" }}>
            Question: is cascade vulnerability explained by centrality or biological neuron type?
          </span>
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        {/* ── Sidebar ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ minWidth: 185, maxWidth: 200 }}>

          {/* Controls */}
          <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-2.5" style={{ color: "#3a5570" }}>EXPERIMENT</div>
            <div className="text-xs leading-7 mb-3.5" style={{ color: "#3a5570" }}>
              61 single-node knockouts<br/>
              5 centrality metrics<br/>
              Pearson r correlation<br/>
              Outlier detection (1.5&sigma;)
            </div>
            <button onClick={runKnockout} disabled={running}
              className="w-full py-2.5 rounded-lg font-mono font-bold text-xs tracking-wider"
              style={{
                background: running ? "#162030" : "rgba(0,229,255,0.1)",
                border:     `1px solid ${running ? "#162030" : "#00e5ff"}`,
                color:      running ? "#3a5570" : "#00e5ff",
                cursor:     running ? "not-allowed" : "pointer",
              }}>
              {running ? "⏳ Running 61..." : "▶ RUN KNOCKOUT"}
            </button>
          </div>

          {/* Type filter */}
          <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-2" style={{ color: "#3a5570" }}>FILTER BY TYPE</div>
            <button onClick={() => setActiveFilter(-1)}
              className="w-full mb-1.5 text-left text-xs font-mono rounded py-1.5 px-2"
              style={{
                background: activeFilter === -1 ? "rgba(255,255,255,0.08)" : "transparent",
                border:     `1px solid ${activeFilter === -1 ? "#ffffff33" : "#162030"}`,
                color:      activeFilter === -1 ? "#fff" : "#3a5570",
                cursor:     "pointer",
              }}>ALL TYPES</button>
            {TYPE_LABELS_KB.map((l, i) => (
              <button key={i} onClick={() => setActiveFilter(i)}
                className="w-full mb-1 text-left text-xs font-mono rounded py-1.5 px-2 flex items-center gap-1.5"
                style={{
                  background: activeFilter === i ? `${TYPE_COLORS_KB[i]}18` : "transparent",
                  border:     `1px solid ${activeFilter === i ? TYPE_COLORS_KB[i] : "#162030"}`,
                  color:      activeFilter === i ? TYPE_COLORS_KB[i] : "#3a5570",
                  cursor:     "pointer",
                }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS_KB[i] }}/>
                {l}
              </button>
            ))}
          </div>

          {/* Top 5 */}
          {R && (
            <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
              <div className="text-xs tracking-widest mb-2" style={{ color: "#3a5570" }}>TOP 5 CRITICAL</div>
              {R.ranked.slice(0, 5).map((node, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className="text-xs font-mono w-3.5" style={{ color: "#3a5570" }}>{i+1}</div>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS_KB[node.type] }}/>
                  <div className="flex-1">
                    <div className="text-xs font-bold" style={{ color: TYPE_COLORS_KB[node.type] }}>{node.name}</div>
                    <div className="text-xs" style={{ color: "#3a5570" }}>{node.damage} dead</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main panel ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3.5">

          {R && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <KBStat label="Most critical"  value={R.ranked[0].name}
                  color={TYPE_COLORS_KB[R.ranked[0].type]}
                  sub={`${R.ranked[0].damage} secondary deaths`}/>
                <KBStat label="Best predictor" value={METRIC_NAMES_KB[R.bestMetricIdx]}
                  color={METRIC_COLORS_KB[R.bestMetricIdx]}
                  sub={`r=${R.corrs[R.bestMetricIdx].toFixed(3)}`}/>
                <KBStat label="Outliers"        value={`${R.outliers.length} neurons`}
                  color="#ff9944" sub="damage > 1.5σ from prediction"/>
                <KBStat label="Zero damage"     value={`${R.knockouts.filter(k=>k.damage===0).length}`}
                  color="#a8ff78" sub="no cascade triggered"/>
              </div>

              {/* Bar ranking */}
              <div className="rounded-xl p-4 overflow-x-auto"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <KBBarRanking nodes={R.ranked} width={520} height={200}/>
              </div>

              {/* Correlation bars */}
              <div className="rounded-xl p-4 overflow-x-auto"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <KBCorrelationBar metrics={METRIC_NAMES_KB} correlations={R.corrs} width={520} height={120}/>
              </div>

              {/* Scatter plot */}
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <div className="text-xs tracking-widest mb-2.5" style={{ color: "#3a5570" }}>
                  SCATTER: SELECT METRIC
                </div>
                <KBMetricSelector selected={activeMetric} onSelect={setActiveMetric}/>
                <div className="mt-3 overflow-x-auto">
                  <KBScatterPlot
                    xData={filteredKO.map(k => k[activeKey])}
                    yData={filteredKO.map(k => k.damage)}
                    xLabel={METRIC_NAMES_KB[activeMetric]}
                    yLabel="cascade damage"
                    title={`${METRIC_NAMES_KB[activeMetric]} vs Cascade Damage${activeFilter >= 0 ? " — " + TYPE_LABELS_KB[activeFilter] : ""}`}
                    width={520} height={200}
                    nodeTypes={filteredKO.map(k => k.type)}/>
                </div>
              </div>

              {/* Full table */}
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <div className="text-xs tracking-widest mb-2.5" style={{ color: "#3a5570" }}>FULL RESULTS TABLE</div>
                <div className="overflow-x-auto" style={{ maxHeight: 260, overflowY: "auto" }}>
                  <table className="w-full text-xs font-mono" style={{ borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, background: "#070d1a" }}>
                      <tr>
                        {["#","Neuron","Type","Damage","Degree","Btwn","Eigenv","Spectral","Bridge"].map(h => (
                          <th key={h} className="text-left px-2 py-1"
                            style={{ color: "#3a5570", borderBottom: "1px solid #162030", fontSize: 8, letterSpacing: 1 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {R.ranked.map((node, i) => (
                        <tr key={i} style={{ background: i < 10 ? `${TYPE_COLORS_KB[node.type]}08` : "transparent" }}>
                          <td className="px-2 py-1" style={{ color: "#3a5570" }}>{i+1}</td>
                          <td className="px-2 py-1" style={{ color: TYPE_COLORS_KB[node.type], fontWeight: i < 5 ? 700 : 400 }}>
                            {node.name}
                          </td>
                          <td className="px-2 py-1">
                            <span style={{ fontSize: 8, color: TYPE_COLORS_KB[node.type],
                              border: `1px solid ${TYPE_COLORS_KB[node.type]}44`,
                              borderRadius: 4, padding: "1px 5px" }}>
                              {TYPE_LABELS_KB[node.type].split(" ")[0]}
                            </span>
                          </td>
                          <td className="px-2 py-1 font-bold" style={{ color: node.damage > 0 ? "#ff4444" : "#a8ff78" }}>
                            {node.damage}
                          </td>
                          <td className="px-2 py-1" style={{ color: "#00e5ff" }}>{node.degree}</td>
                          <td className="px-2 py-1" style={{ color: "#3a5570" }}>{node.btwn.toFixed(3)}</td>
                          <td className="px-2 py-1" style={{ color: "#3a5570" }}>{node.eigenv.toFixed(3)}</td>
                          <td className="px-2 py-1" style={{ color: "#3a5570" }}>{node.spectral.toFixed(3)}</td>
                          <td className="px-2 py-1" style={{ color: node.bridge > 0 ? "#ff9944" : "#3a5570" }}>
                            {node.bridge > 0 ? "YES" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <KBResearchFinding R={R} top10Types={top10Types}/>
            </>
          )}

          {!R && (
            <div className="flex items-center justify-center rounded-2xl"
              style={{ height: 300, color: "#162030", fontSize: 12, letterSpacing: "0.2em", border: "1px dashed #162030" }}>
              PRESS RUN KNOCKOUT
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const EDGES_PT: [number, number][] = [
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

// 0=command 1=motor-A(ALS) 2=motor-B 3=motor-D 4=sensory 5=interneuron
const NODE_TYPES_PT: Record<number, number> = {
  0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:5,9:5,10:5,11:5,
  12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,
  21:2,22:2,23:2,24:2,25:2,26:2,27:2,
  28:3,29:3,30:3,31:3,32:3,33:3,34:3,35:3,36:3,37:3,38:3,
  39:1,40:1,41:1,42:1,43:1,
  44:2,45:2,46:2,47:2,48:2,
  49:4,50:4,51:4,52:4,53:4,54:4,
  55:5,56:5,57:5,58:5,59:5,60:5,
};

const TYPE_COLORS_PT = ["#00e5ff","#ff4444","#ffd700","#a855f7","#a8ff78","#6688cc"] as const;
const TYPE_LABELS_PT = ["Command","Motor-A","Motor-B","Motor-D","Sensory","Interneuron"] as const;
const N_PT = 61;

// ─── GRAPH SETUP ─────────────────────────────────────────────────────────────
// NOTE: buildAdjPT intentionally does NOT deduplicate (matching source behaviour)

function buildAdjPT(): number[][] {
  const adj: number[][] = Array.from({ length: N_PT }, () => []);
  for (const [a, b] of EDGES_PT) { adj[a].push(b); adj[b].push(a); }
  return adj;
}
const ADJ_PT = buildAdjPT();
const CAP_PT = ADJ_PT.map(nb => Math.max(nb.length, 1));

// ─── LAYOUT ──────────────────────────────────────────────────────────────────

const LAYOUT_PT: Array<{ x: number; y: number }> = (() => {
  const size = 190, cx = size / 2, cy = size / 2;
  const radii    = [44, 105, 80, 125, 150, 60];
  const angleOff = [0, 0, Math.PI, Math.PI / 2, Math.PI * 1.2, Math.PI * 0.7];
  const tg: Record<number, number[]> = {};
  for (let i = 0; i < N_PT; i++) {
    const t = NODE_TYPES_PT[i] ?? 0;
    if (!tg[t]) tg[t] = [];
    tg[t].push(i);
  }
  const pos: Array<{ x: number; y: number }> = new Array(N_PT);
  for (const [tStr, nodes] of Object.entries(tg)) {
    const t  = Number(tStr);
    const r  = radii[t]    ?? 90;
    const ao = angleOff[t] ?? 0;
    nodes.forEach((ni, idx) => {
      const angle = ao + (idx / nodes.length) * Math.PI * 2;
      pos[ni] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }
  return pos;
})();

// ─── SIMULATION ──────────────────────────────────────────────────────────────

function seededRngPT(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

interface PTCascadeResult {
  finalAlive: number;
  history: number[];
  deadByType: number[];
  snapshot: number[];
}

function runCascadePT(initialDead: number[]): PTCascadeResult {
  const cap  = new Float64Array(CAP_PT);
  const load = new Float64Array(N_PT);
  for (let i = 0; i < N_PT; i++) load[i] = cap[i];
  const alive = new Uint8Array(N_PT).fill(1);
  let queue = [...initialDead];
  for (const nd of queue) alive[nd] = 0;

  const history: number[] = [alive.reduce((s: number, v: number) => s + v, 0)];
  const deadByType: number[] = [0, 0, 0, 0, 0, 0];
  for (const nd of queue) deadByType[NODE_TYPES_PT[nd] ?? 0]++;

  for (let step = 0; step < 60; step++) {
    const dying: number[] = [];
    for (const dead of queue) {
      const lnb = ADJ_PT[dead].filter(j => alive[j]);
      if (!lnb.length) continue;
      const extra = load[dead] / lnb.length;
      for (const nb of lnb) {
        load[nb] += extra;
        if (load[nb] > cap[nb] * 1.5 && alive[nb]) {
          alive[nb] = 0;
          dying.push(nb);
          deadByType[NODE_TYPES_PT[nb] ?? 0]++;
        }
      }
    }
    queue = dying;
    history.push(alive.reduce((s: number, v: number) => s + v, 0));
    if (!dying.length) break;
  }

  return {
    finalAlive: alive.reduce((s: number, v: number) => s + v, 0),
    history,
    deadByType,
    snapshot: Array.from(alive),
  };
}

function alsNodesPT(k: number): number[] {
  return Object.keys(NODE_TYPES_PT)
    .filter(i => NODE_TYPES_PT[Number(i)] === 1)
    .map(Number)
    .slice(0, k);
}

function hubNodesPT(k: number): number[] {
  return Array.from({ length: N_PT }, (_, i) => i)
    .sort((a, b) => ADJ_PT[b].length - ADJ_PT[a].length)
    .slice(0, k);
}

function randomNodesPT(k: number, seed: number): number[] {
  const rng = seededRngPT(seed);
  return Array.from({ length: N_PT }, (_, i) => i)
    .sort(() => rng() - 0.5)
    .slice(0, k);
}

// ─── STATS ───────────────────────────────────────────────────────────────────

function arrMeanPT(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function arrStdPT(arr: number[]) {
  const m = arrMeanPT(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ─── INTERFACES ──────────────────────────────────────────────────────────────

interface PTResults {
  als: PTCascadeResult; hub: PTCascadeResult;
  randomFinals: number[];
  randMean: number; randStd: number; randMin: number; randMax: number;
  sevPct: number; zScore: string;
  chartWorst: number[]; chartBest: number[]; chartMed: number[];
}

// ─── CHARTS ──────────────────────────────────────────────────────────────────

function PTMiniNet({ snapshot, size = 190 }: { snapshot: number[]; size?: number }) {
  return (
    <svg width={size} height={size} style={{ background: "#030810", borderRadius: 10, display: "block" }}>
      {EDGES_PT.map(([a, b], i) =>
        snapshot[a] && snapshot[b] ? (
          <line key={i}
            x1={LAYOUT_PT[a]?.x ?? 0} y1={LAYOUT_PT[a]?.y ?? 0}
            x2={LAYOUT_PT[b]?.x ?? 0} y2={LAYOUT_PT[b]?.y ?? 0}
            stroke="#1a3555" strokeWidth={0.8} opacity={0.5} />
        ) : null
      )}
      {Array.from({ length: N_PT }, (_, i) => {
        const alive = Boolean(snapshot[i]);
        const t = NODE_TYPES_PT[i] ?? 0;
        return (
          <circle key={i}
            cx={LAYOUT_PT[i]?.x ?? 0} cy={LAYOUT_PT[i]?.y ?? 0}
            r={alive ? (t <= 1 ? 7 : 5) : 3}
            fill={alive ? TYPE_COLORS_PT[t] : "#2a0808"}
            opacity={alive ? 0.9 : 0.25} />
        );
      })}
    </svg>
  );
}

function PTHistogram({ randomFinals, alsVal, hubVal, width = 480, height = 155 }: {
  randomFinals: number[]; alsVal: number; hubVal: number; width?: number; height?: number;
}) {
  if (!randomFinals.length) return null;
  const pad = { t: 24, r: 16, b: 30, l: 38 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const allVals = [...randomFinals, alsVal, hubVal];
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);
  const span = maxV - minV || 1;
  const nBins = 14, binW = span / nBins;
  const bins = Array.from({ length: nBins }, (_, i) => ({
    lo: minV + i * binW, hi: minV + (i + 1) * binW, count: 0,
  }));
  for (const v of randomFinals) {
    const bi = Math.min(Math.floor((v - minV) / binW), nBins - 1);
    bins[bi].count++;
  }
  const maxCount = Math.max(...bins.map(b => b.count), 1);
  const tx = (v: number) => ((v - minV) / span) * W;
  const ty = (v: number) => H - (v / maxCount) * H;
  const bwPx = (W / nBins) * 0.8;
  const mu = arrMeanPT(randomFinals);

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={15} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        DISTRIBUTION: 100 RANDOM ATTACKS — final survivors
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={7} fill="#3a5570">
              {Math.round(f * maxCount)}
            </text>
          </g>
        ))}
        {bins.map((b, i) => {
          const bh = (b.count / maxCount) * H;
          const bx = tx(b.lo + binW / 2) - bwPx / 2;
          return b.count > 0 ? (
            <rect key={i} x={bx} y={H - bh} width={bwPx} height={bh}
              fill="#00e5ff" opacity={0.3} rx={2} />
          ) : null;
        })}
        {/* mean line */}
        <line x1={tx(mu)} x2={tx(mu)} y1={0} y2={H}
          stroke="#00e5ff" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.8} />
        <text x={tx(mu)} y={-5} textAnchor="middle" fontSize={8} fill="#00e5ff">
          μ={mu.toFixed(1)}
        </text>
        {/* ALS line */}
        <line x1={tx(alsVal)} x2={tx(alsVal)} y1={0} y2={H}
          stroke="#ff4444" strokeWidth={2.5} />
        <text x={tx(alsVal)} y={-5} textAnchor="middle" fontSize={9} fill="#ff4444" fontWeight="bold">
          ALS={alsVal}
        </text>
        {/* Hub line */}
        <line x1={tx(hubVal)} x2={tx(hubVal)} y1={0} y2={H}
          stroke="#ffd700" strokeWidth={2} />
        <text x={tx(hubVal)} y={H + 20} textAnchor="middle" fontSize={9} fill="#ffd700" fontWeight="bold">
          Hub={hubVal}
        </text>
        {[minV, Math.round(minV + span / 2), maxV].map(v => (
          <text key={v} x={tx(v)} y={H + 14} textAnchor="middle" fontSize={8} fill="#3a5570">{v}</text>
        ))}
        <text x={W / 2} y={H + 28} textAnchor="middle" fontSize={9} fill="#3a5570">
          survivors (higher = less damage)
        </text>
      </g>
    </svg>
  );
}

interface PTLineSeries { label: string; data: number[]; color: string; bold?: boolean; dim?: boolean; }

function PTLineChart({ series, height = 100, width = 480, title }: {
  series: PTLineSeries[]; height?: number; width?: number; title?: string;
}) {
  const pad = { t: 22, r: 12, b: 18, l: 36 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const allVals = series.flatMap(s => s.data).filter(v => isFinite(v));
  if (!allVals.length) return null;
  const yMin = Math.min(...allVals), yMax = Math.max(...allVals) || 1;
  const xLen = Math.max(...series.map(s => s.data.length), 2);
  const tx = (i: number) => (i / Math.max(xLen - 1, 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const mkPath = (d: number[]) =>
    d.map((v, i) => `${i === 0 ? "M" : "L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {title && (
        <text x={pad.l + W / 2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
          {title}
        </text>
      )}
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={8} fill="#3a5570">
              {Math.round(yMin + f * (yMax - yMin))}
            </text>
          </g>
        ))}
        {series.map(s => (
          <path key={s.label} d={mkPath(s.data)} fill="none" stroke={s.color}
            strokeWidth={s.bold ? 2.5 : 1.5} strokeLinejoin="round" opacity={s.dim ? 0.35 : 1} />
        ))}
      </g>
    </svg>
  );
}

// ─── UI ATOMS ────────────────────────────────────────────────────────────────

function PTStat({ label, value, color, sub, big }: {
  label: string; value: string; color: string; sub?: string; big?: boolean;
}) {
  return (
    <div className="rounded-lg px-3 py-2.5"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22` }}>
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#3a5570" }}>{label}</div>
      <div className="font-mono font-black leading-tight" style={{ fontSize: big ? 24 : 16, color }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#1e3050" }}>{sub}</div>}
    </div>
  );
}

function PTParam({ label, val, set, min, max, color }: {
  label: string; val: number; set: (v: number) => void;
  min: number; max: number; color: string;
}) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: "#3a5570" }}>
        {label}: <span className="font-bold" style={{ color }}>{val}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={val}
        onChange={e => set(parseInt(e.target.value))}
        className="w-full" style={{ accentColor: color }} />
    </div>
  );
}

// ─── VERDICT ─────────────────────────────────────────────────────────────────

function PTVerdict({ sevPct, zScore, als, hub, randMean, randStd, k }: {
  sevPct: number; zScore: string;
  als: PTCascadeResult; hub: PTCascadeResult;
  randMean: number; randStd: number; k: number;
}) {
  const isStrong     = sevPct >= 85;
  const isSystematic = sevPct >= 70;
  const alsBetter    = als.finalAlive < hub.finalAlive;
  const zNum         = parseFloat(zScore);
  const borderColor  = isStrong ? "#ff444455" : isSystematic ? "#ff994455" : "#162030";
  const titleColor   = isStrong ? "#ff4444" : isSystematic ? "#ff9944" : "#3a5570";

  return (
    <div className="rounded-2xl p-5"
      style={{
        background: isStrong ? "rgba(255,68,68,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${borderColor}`,
      }}>
      <div className="text-xs tracking-widest mb-4" style={{ color: titleColor }}>
        PERMUTATION TEST RESULT
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <PTStat label="Severity percentile"
          value={`${sevPct}th`}
          color={isStrong ? "#ff4444" : isSystematic ? "#ff9944" : "#a8ff78"}
          sub={`ALS worse than ${sevPct}% of randoms`} />
        <PTStat label="Z-score"
          value={`${zScore}σ`}
          color={zNum <= -1.5 ? "#ff4444" : zNum <= -1 ? "#ff9944" : "#a8ff78"}
          sub="from random mean" />
        <PTStat label="ALS vs Hub"
          value={alsBetter ? "ALS worse" : "Hub worse"}
          color={alsBetter ? "#ff4444" : "#ffd700"}
          sub={`${Math.abs(als.finalAlive - hub.finalAlive)} neuron difference`} />
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "#8ab0cc", maxWidth: 820 }}>
        {isStrong
          ? `✅ Strong result: ALS pattern at the ${sevPct}th percentile — worse than ${sevPct}% of 100 random failures. z=${zScore}σ. Cascade was systematically more severe than random.`
          : isSystematic
          ? `⚠️ Moderate result: ALS was worse than ${sevPct}% of randoms but did not exceed the 85th percentile. Try increasing k.`
          : `❌ At k=${k}, ALS was not worse than random. Motor-A neurons hold no privileged cascade position in this network.`}
        {" "}
        {alsBetter
          ? "Motor-A neurons connect to command interneurons — their loss drives the cascade into the core circuit."
          : "Hub attack was more destructive — command interneurons carry the highest degree."}
        {" "}
        <span style={{ color: "#3a5570" }}>
          (μ_random={randMean.toFixed(1)}±{randStd.toFixed(1)}, ALS={als.finalAlive}, Hub={hub.finalAlive})
        </span>
      </p>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function Phase7PermutationTest() {
  const [k,        setK]       = useState(3);
  const [running,  setRunning] = useState(false);
  const [results,  setResults] = useState<PTResults | null>(null);

  const runTest = () => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const alsResult = runCascadePT(alsNodesPT(k));
      const hubResult = runCascadePT(hubNodesPT(k));

      const randomFinals:    number[]   = [];
      const randomHistories: number[][] = [];
      for (let i = 0; i < 100; i++) {
        const res = runCascadePT(randomNodesPT(k, i + 1));
        randomFinals.push(res.finalAlive);
        randomHistories.push(res.history);
      }

      const mu  = arrMeanPT(randomFinals);
      const sig = arrStdPT(randomFinals);

      // severity percentile: % of randoms with >= ALS survivors (i.e. ALS was worse)
      const sevPct = randomFinals.filter(v => v >= alsResult.finalAlive).length;
      const zScore = sig > 0 ? ((alsResult.finalAlive - mu) / sig).toFixed(2) : "0.00";

      const sorted     = randomFinals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      const chartWorst = randomHistories[sorted[0].i] ?? [];
      const chartBest  = randomHistories[sorted[sorted.length - 1].i] ?? [];
      const chartMed   = randomHistories[sorted[Math.floor(sorted.length / 2)].i] ?? [];

      setResults({
        als: alsResult, hub: hubResult,
        randomFinals, randMean: mu, randStd: sig,
        randMin: Math.min(...randomFinals),
        randMax: Math.max(...randomFinals),
        sevPct, zScore,
        chartWorst, chartBest, chartMed,
      });
      setRunning(false);
    }, 30);
  };

  const R = results;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-red-950 border border-gray-700 rounded-2xl p-5">
        <div className="text-xs tracking-widest mb-1" style={{ color: "#ff4444" }}>
          ALS PERMUTATION TEST · C. ELEGANS
        </div>
        <h2 className="text-xl font-black mb-2" style={{
          background: "linear-gradient(100deg,#ff4444,#ffd700 50%,#00e5ff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          ALS vs 100 Random Failures
        </h2>
        <p className="text-xs max-w-2xl" style={{ color: "#3a5570" }}>
          Does starting from Motor-A neurons (ALS pattern) produce a more severe cascade than random failure?
          Null distribution = 100 random permutations.
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">

        {/* ── SIDEBAR ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ minWidth: 185, maxWidth: 200 }}>

          {/* params */}
          <div className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-3" style={{ color: "#3a5570" }}>PARAMS</div>
            <PTParam label="Initial deaths (k)" val={k} set={setK} min={1} max={8} color="#ff4444" />
            <div className="text-xs mt-2 leading-relaxed" style={{ color: "#3a5570" }}>
              ALS: Motor-A first (DA/VA)<br />
              Hub: highest degree<br />
              Random: 100× shuffled
            </div>
            <button onClick={runTest} disabled={running}
              className="w-full mt-3 rounded-lg py-2.5 font-mono font-bold text-xs tracking-wide cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: running ? "#162030" : "rgba(255,68,68,0.12)",
                border: `1px solid ${running ? "#162030" : "#ff4444"}`,
                color: running ? "#3a5570" : "#ff4444",
              }}>
              {running ? "⏳ Running..." : "▶ RUN TEST"}
            </button>
          </div>

          {/* neuron type legend */}
          <div className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-2" style={{ color: "#3a5570" }}>NEURON TYPES</div>
            {TYPE_LABELS_PT.map((l, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <div className="rounded-full flex-shrink-0"
                  style={{ width: 8, height: 8, background: TYPE_COLORS_PT[i] }} />
                <div className="text-xs" style={{ color: i === 1 ? TYPE_COLORS_PT[i] : "#3a5570" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* network snapshots */}
          {R && (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-center tracking-wide" style={{ color: "#ff4444" }}>ALS FINAL</div>
              <PTMiniNet snapshot={R.als.snapshot} size={185} />
              <div className="text-xs text-center tracking-wide mt-1" style={{ color: "#ffd700" }}>HUB FINAL</div>
              <PTMiniNet snapshot={R.hub.snapshot} size={185} />
            </div>
          )}
        </div>

        {/* ── MAIN PANEL ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4" style={{ minWidth: 300 }}>
          {R ? (
            <>
              {/* key stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <PTStat big label="ALS survivors" value={`${R.als.finalAlive}/${N_PT}`}
                  color="#ff4444" sub={`${(R.als.finalAlive / N_PT * 100).toFixed(0)}% alive`} />
                <PTStat big label="Hub survivors" value={`${R.hub.finalAlive}/${N_PT}`}
                  color="#ffd700" sub={`${(R.hub.finalAlive / N_PT * 100).toFixed(0)}% alive`} />
                <PTStat label="Random μ±σ"
                  value={`${R.randMean.toFixed(1)}±${R.randStd.toFixed(1)}`}
                  color="#00e5ff" sub={`range: ${R.randMin}–${R.randMax}`} />
                <PTStat label="ALS severity"
                  value={`${R.sevPct}th pct`}
                  color={R.sevPct >= 85 ? "#ff4444" : R.sevPct >= 70 ? "#ff9944" : "#a8ff78"}
                  sub={`worse than ${R.sevPct}% of randoms`} />
              </div>

              {/* histogram */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <PTHistogram
                  randomFinals={R.randomFinals}
                  alsVal={R.als.finalAlive}
                  hubVal={R.hub.finalAlive}
                  width={500} height={155} />
              </div>

              {/* cascade timelines */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <PTLineChart
                  title="CASCADE TIMELINE — ALS vs Hub vs Random (worst/med/best)"
                  series={[
                    { label: "als", data: R.als.history,  color: "#ff4444", bold: true },
                    { label: "hub", data: R.hub.history,  color: "#ffd700", bold: true },
                    { label: "rw",  data: R.chartWorst,   color: "#00e5ff", dim: true },
                    { label: "rm",  data: R.chartMed,     color: "#00e5ff", dim: true },
                    { label: "rb",  data: R.chartBest,    color: "#00e5ff", dim: true },
                  ]}
                  height={110} width={500} />
                <div className="flex gap-4 mt-2 flex-wrap">
                  {[["ALS", "#ff4444"], ["Hub", "#ffd700"], ["Random ×3", "#00e5ff"]].map(([l, col]) => (
                    <span key={l} className="text-xs flex items-center gap-1" style={{ color: col }}>
                      <span style={{ width: 12, height: 2, background: col, display: "inline-block" }} />{l}
                    </span>
                  ))}
                </div>
              </div>

              {/* deaths by neuron type */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <div className="text-xs tracking-widest mb-3" style={{ color: "#3a5570" }}>
                  DEATHS BY NEURON TYPE
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {TYPE_LABELS_PT.map((l, i) => {
                    const total   = Object.values(NODE_TYPES_PT).filter(t => t === i).length;
                    const alsDead = R.als.deadByType[i] ?? 0;
                    const hubDead = R.hub.deadByType[i] ?? 0;
                    const col     = TYPE_COLORS_PT[i];
                    return (
                      <div key={i} className="rounded-lg px-2 py-2 text-center"
                        style={{ background: `${col}10`, border: `1px solid ${col}22` }}>
                        <div className="text-xs mb-1" style={{ color: col }}>{l}</div>
                        <div className="text-sm font-black font-mono" style={{ color: "#ff4444" }}>{alsDead}/{total}</div>
                        <div className="text-xs mb-1" style={{ color: "#3a5570" }}>ALS</div>
                        <div className="text-sm font-black font-mono" style={{ color: "#ffd700" }}>{hubDead}/{total}</div>
                        <div className="text-xs" style={{ color: "#3a5570" }}>Hub</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* verdict */}
              <PTVerdict
                sevPct={R.sevPct} zScore={R.zScore}
                als={R.als} hub={R.hub}
                randMean={R.randMean} randStd={R.randStd}
                k={k} />
            </>
          ) : (
            <div className="h-72 flex items-center justify-center rounded-2xl text-xs tracking-widest"
              style={{ color: "#162030", border: "1px dashed #162030" }}>
              PRESS RUN TEST
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

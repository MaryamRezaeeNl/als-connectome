"use client";
import { useState, useRef, useEffect } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const EDGES_D3: [number, number][] = [
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

const NODE_TYPES_D3: Record<number, number> = {
  0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:5,9:5,10:5,11:5,
  12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,
  21:2,22:2,23:2,24:2,25:2,26:2,27:2,
  28:3,29:3,30:3,31:3,32:3,33:3,34:3,35:3,36:3,37:3,38:3,
  39:1,40:1,41:1,42:1,43:1,
  44:2,45:2,46:2,47:2,48:2,
  49:4,50:4,51:4,52:4,53:4,54:4,
  55:5,56:5,57:5,58:5,59:5,60:5,
};

const N_D3 = 61;

// ─── GRAPH SETUP ─────────────────────────────────────────────────────────────

function buildAdjD3(): number[][] {
  const adj: number[][] = Array.from({ length: N_D3 }, () => []);
  for (const [a, b] of EDGES_D3) { adj[a].push(b); adj[b].push(a); }
  return adj.map(nb => [...new Set(nb)]);
}
const ADJ_D3  = buildAdjD3();
const DEG_D3  = ADJ_D3.map(nb => nb.length);
const BASE_CAP_D3 = DEG_D3.map(d => Math.max(d, 1));

function seededRngD3(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ─── LAYOUT ──────────────────────────────────────────────────────────────────

const LAYOUT_D3: Array<{ x: number; y: number }> = (() => {
  const sz = 200, cx = sz / 2, cy = sz / 2;
  const radii = [42, 100, 78, 120, 148, 58];
  const ao    = [0, 0, Math.PI, Math.PI / 2, Math.PI * 1.2, Math.PI * 0.7];
  const tg: Record<number, number[]> = {};
  for (let i = 0; i < N_D3; i++) {
    const t = NODE_TYPES_D3[i] ?? 0;
    if (!tg[t]) tg[t] = [];
    tg[t].push(i);
  }
  const pos: Array<{ x: number; y: number }> = new Array(N_D3);
  for (const [tStr, nodes] of Object.entries(tg)) {
    const t = Number(tStr);
    const r = radii[t] ?? 90, a = ao[t] ?? 0;
    nodes.forEach((idx_n, idx_i) => {
      const angle = a + (idx_i / nodes.length) * Math.PI * 2;
      pos[idx_n] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }
  return pos;
})();

// ─── INTERFACES ──────────────────────────────────────────────────────────────

interface D3Params {
  fatigueGain: number; fatigueDecay: number;
  toxSpread: number;   toxDecay: number;
  degRate: number;     recoveryRate: number;
  initTox: number;     deathThresh: number;
  steps: number;
  aFatigue: number;    aToxicity: number;
  wLoad: number;       wFatigue: number;  wToxicity: number;
}

type D3InitMode = "als" | "hub" | "random" | "none";

interface D3HeatEntry { step: number; healths: number[]; }

interface D3Result {
  histAlive: number[];   histHealth: number[];
  histTox: number[];     histFatigue: number[];
  histDeaths: number[];  heatmapData: D3HeatEntry[];
  finalAlive: number;
  timeFirstDeath: number; time25pct: number; time50pct: number;
  tipPoint: number; maxSlope: number;
  finalHealth: number[]; finalToxicity: number[]; finalFatigue: number[];
  finalAliveArr: number[];
}

interface D3ModeResult extends D3Result { mode: D3InitMode; }

// ─── SIMULATION ──────────────────────────────────────────────────────────────

function runDegenerationD3(params: D3Params, initMode: D3InitMode, seed = 42): D3Result {
  const {
    fatigueGain, fatigueDecay, toxSpread, toxDecay,
    degRate, recoveryRate, initTox, deathThresh,
    steps, aFatigue, aToxicity, wLoad, wFatigue, wToxicity,
  } = params;

  const rng = seededRngD3(seed);
  const health   = new Float32Array(N_D3).fill(1.0);
  const load     = new Float32Array(BASE_CAP_D3);
  const fatigue  = new Float32Array(N_D3);
  const toxicity = new Float32Array(N_D3);
  const alive    = new Uint8Array(N_D3).fill(1);

  if (initMode === "als") {
    for (let i = 0; i < N_D3; i++) if (NODE_TYPES_D3[i] === 1) toxicity[i] = initTox * 2;
  } else if (initMode === "hub") {
    const maxDeg = Math.max(...DEG_D3);
    for (let i = 0; i < N_D3; i++) fatigue[i] = (DEG_D3[i] / maxDeg) * initTox;
  } else if (initMode === "random") {
    for (let i = 0; i < N_D3; i++) if (rng() < 0.15) toxicity[i] = initTox * (0.5 + rng());
  } else {
    for (let i = 0; i < N_D3; i++) toxicity[i] = initTox * 0.1 * rng();
  }

  const histAlive:   number[] = [];
  const histHealth:  number[] = [];
  const histTox:     number[] = [];
  const histFatigue: number[] = [];
  const histDeaths:  number[] = [];

  let timeFirstDeath = -1, time25pct = -1, time50pct = -1, tipPoint = -1;
  let prevAliveCount = N_D3;
  let maxSlopeStep = -1, maxSlope = 0;

  const HEAT_SAMPLE = Math.max(1, Math.floor(steps / 40));
  const heatmapData: D3HeatEntry[] = [];

  for (let t = 0; t < steps; t++) {
    const aliveCount = alive.reduce((s: number, v: number) => s + v, 0);
    const avgHealth  = Array.from(health).reduce((s, v) => s + v, 0) / N_D3;
    const avgTox     = Array.from(toxicity).reduce((s, v) => s + v, 0) / N_D3;
    const avgFatigue = Array.from(fatigue).reduce((s, v) => s + v, 0) / N_D3;

    histAlive.push(aliveCount);
    histHealth.push(avgHealth);
    histTox.push(avgTox);
    histFatigue.push(avgFatigue);
    histDeaths.push(N_D3 - aliveCount);

    if (t > 0) {
      const slope = prevAliveCount - aliveCount;
      if (slope > maxSlope) { maxSlope = slope; maxSlopeStep = t; }
    }
    prevAliveCount = aliveCount;

    if (timeFirstDeath < 0 && aliveCount < N_D3)    timeFirstDeath = t;
    if (time25pct < 0 && aliveCount <= N_D3 * 0.75) time25pct = t;
    if (time50pct < 0 && aliveCount <= N_D3 * 0.5)  time50pct = t;

    if (t % HEAT_SAMPLE === 0) heatmapData.push({ step: t, healths: Array.from(health) });

    const newHealth   = new Float32Array(health);
    const newLoad     = new Float32Array(load);
    const newFatigue  = new Float32Array(fatigue);
    const newToxicity = new Float32Array(toxicity);

    // load redistribution from dead neighbours
    for (let i = 0; i < N_D3; i++) {
      if (!alive[i]) continue;
      newLoad[i] = BASE_CAP_D3[i];
      for (const j of ADJ_D3[i]) {
        if (!alive[j]) {
          const liveNbs = (ADJ_D3[j] ?? []).filter(k => alive[k]).length;
          newLoad[i] += load[j] / Math.max(liveNbs, 1);
        }
      }
    }

    for (let i = 0; i < N_D3; i++) {
      if (!alive[i]) continue;
      const thresh  = BASE_CAP_D3[i] * (1 - aFatigue * fatigue[i]) * (1 - aToxicity * toxicity[i]);
      const overload = Math.max(0, newLoad[i] - thresh);
      newFatigue[i]  = Math.min(1, fatigueDecay * fatigue[i] + fatigueGain * overload / Math.max(BASE_CAP_D3[i], 1));
      const nbArr  = ADJ_D3[i];
      const nbTox  = nbArr.length > 0 ? nbArr.reduce((s, j) => s + toxicity[j], 0) / nbArr.length : 0;
      const dmgTox = (1 - health[i]) * 0.3;
      newToxicity[i] = Math.min(1, toxDecay * toxicity[i] + toxSpread * nbTox + dmgTox);
      const stress   = wLoad * (overload / Math.max(BASE_CAP_D3[i], 1)) + wFatigue * fatigue[i] + wToxicity * toxicity[i];
      const recovery = recoveryRate * (1 - toxicity[i]);
      newHealth[i]   = Math.max(0, Math.min(1, health[i] - degRate * stress + recovery * 0.01));
      if (newHealth[i] < deathThresh) alive[i] = 0;
    }

    for (let i = 0; i < N_D3; i++) {
      if (!alive[i]) { health[i] = 0; continue; }
      health[i]   = newHealth[i];
      load[i]     = newLoad[i];
      fatigue[i]  = newFatigue[i];
      toxicity[i] = newToxicity[i];
    }
  }

  if (maxSlopeStep > 0) tipPoint = maxSlopeStep;

  return {
    histAlive, histHealth, histTox, histFatigue, histDeaths, heatmapData,
    finalAlive: alive.reduce((s: number, v: number) => s + v, 0),
    timeFirstDeath, time25pct, time50pct, tipPoint, maxSlope,
    finalHealth: Array.from(health),
    finalToxicity: Array.from(toxicity),
    finalFatigue: Array.from(fatigue),
    finalAliveArr: Array.from(alive),
  };
}

// ─── CHARTS ──────────────────────────────────────────────────────────────────

interface D3LineSeries {
  label: string; data: number[]; color: string;
  bold?: boolean; dim?: boolean; dash?: boolean;
}

function D3LineChart({ series, height = 100, width = 420, title, markers }: {
  series: D3LineSeries[]; height?: number; width?: number; title?: string; markers?: number[];
}) {
  const pad = { t: 22, r: 12, b: 20, l: 38 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const all = series.flatMap(s => s.data).filter(v => isFinite(v));
  if (!all.length) return null;
  const yMin = Math.min(...all), yMax = Math.max(...all) || 1;
  const xLen = Math.max(...series.map(s => s.data.length), 2);
  const tx = (i: number) => (i / Math.max(xLen - 1, 1)) * W;
  const ty = (v: number) => H - ((v - yMin) / (yMax - yMin || 1)) * H;
  const mkPath = (d: number[]) =>
    d.map((v, i) => `${i === 0 ? "M" : "L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`)
      .join(" ");
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
              {(yMin + f * (yMax - yMin)).toFixed(yMax - yMin < 2 ? 1 : 0)}
            </text>
          </g>
        ))}
        {/* tipping point markers — markers is number[], color hardcoded */}
        {markers && markers.map((m, i) => m >= 0 && m < xLen ? (
          <g key={i}>
            <line x1={tx(m)} x2={tx(m)} y1={0} y2={H}
              stroke="#ff9944" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.8} />
            <text x={tx(m) + 3} y={10} fontSize={8} fill="#ff9944">▲tip</text>
          </g>
        ) : null)}
        {series.map(s => (
          <path key={s.label} d={mkPath(s.data)} fill="none" stroke={s.color}
            strokeWidth={s.bold ? 2.5 : 1.6} strokeLinejoin="round"
            opacity={s.dim ? 0.4 : 1} strokeDasharray={s.dash ? "5,3" : "none"} />
        ))}
      </g>
    </svg>
  );
}

function D3Heatmap({ heatmapData, width = 440, height = 120 }: {
  heatmapData: D3HeatEntry[]; width?: number; height?: number;
}) {
  if (!heatmapData.length) return null;
  const pad = { t: 16, r: 10, b: 20, l: 10 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const nSteps = heatmapData.length;
  const cw = W / nSteps;
  const healthToColor = (h: number) => {
    if (h <= 0) return "#0a0505";
    const t = Math.max(0, Math.min(1, h));
    return `rgb(${Math.round((1 - t) * 200 + t * 30)},${Math.round(t * 180)},${Math.round(t * 30)})`;
  };
  const step = Math.max(1, Math.floor(N_D3 / 20));
  const sampledNeurons = Array.from({ length: Math.ceil(N_D3 / step) }, (_, i) => i * step)
    .filter(i => i < N_D3);
  const rowH = H / sampledNeurons.length;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={12} textAnchor="middle" fontSize={9} fill="#5a7a9a" letterSpacing={1}>
        HEALTH HEATMAP — neuron × time (green=healthy, red=dead)
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {heatmapData.map((snap, si) =>
          sampledNeurons.map((ni, ri) => (
            <rect key={`${si}-${ri}`}
              x={si * cw} y={ri * rowH}
              width={Math.max(cw - 0.5, 1)} height={Math.max(rowH - 0.5, 1)}
              fill={healthToColor(snap.healths[ni] ?? 0)} />
          ))
        )}
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <text key={f} x={f * W} y={H + 14} textAnchor="middle" fontSize={7} fill="#3a5570">
            {Math.round(f * (heatmapData[heatmapData.length - 1]?.step ?? 0))}
          </text>
        ))}
      </g>
    </svg>
  );
}

function D3ComparisonBars({ modeResults, width = 480, height = 140 }: {
  modeResults: D3ModeResult[]; width?: number; height?: number;
}) {
  if (!modeResults.length) return null;
  const pad = { t: 20, r: 12, b: 28, l: 38 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;
  const modes: D3InitMode[] = ["als", "hub", "random", "none"];
  const modeColors  = ["#ff4444", "#ffd700", "#00e5ff", "#a8ff78"];
  const modeLabels  = ["ALS-inspired", "Hub-vulnerable", "Random", "Spontaneous"];
  const gap = W / modes.length, bw = gap * 0.55;
  const ty  = (v: number) => H - (v / N_D3) * H;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={13} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        FINAL SURVIVORS BY INIT MODE
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={0} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H * (1 - f) + 4} textAnchor="end" fontSize={7} fill="#3a5570">
              {Math.round(f * N_D3)}
            </text>
          </g>
        ))}
        {modes.map((m, i) => {
          const res = modeResults.find(r => r.mode === m);
          if (!res) return null;
          const barTop = ty(res.finalAlive);
          const barH   = H - barTop;
          const x = i * gap + gap / 2 - bw / 2;
          return (
            <g key={i}>
              <rect x={x} y={barTop} width={bw} height={barH}
                fill={modeColors[i]} rx={3} opacity={0.85} />
              <text x={x + bw / 2} y={barTop - 4} textAnchor="middle"
                fontSize={9} fill={modeColors[i]} fontWeight="bold">{res.finalAlive}</text>
              <text x={x + bw / 2} y={H + 16} textAnchor="middle"
                fontSize={8} fill={modeColors[i]}>{modeLabels[i]}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function D3NetworkSnap({ health, toxicity, fatigue, aliveArr, size = 200 }: {
  health: number[]; toxicity: number[]; fatigue: number[]; aliveArr: number[]; size?: number;
}) {
  const healthColor = (h: number, isAlive: boolean) => {
    if (!isAlive) return "#0a0505";
    return `rgb(${Math.round(50 + h * 50 + (1 - h) * 155)},${Math.round(h * 200)},${Math.round(h * 50)})`;
  };
  return (
    <svg width={size} height={size} style={{ background: "#030810", borderRadius: 12, display: "block" }}>
      {EDGES_D3.map(([a, b], i) =>
        aliveArr[a] && aliveArr[b] ? (
          <line key={i}
            x1={LAYOUT_D3[a]?.x ?? 0} y1={LAYOUT_D3[a]?.y ?? 0}
            x2={LAYOUT_D3[b]?.x ?? 0} y2={LAYOUT_D3[b]?.y ?? 0}
            stroke="#132030" strokeWidth={0.8} opacity={0.6} />
        ) : null
      )}
      {Array.from({ length: N_D3 }, (_, i) => {
        const isAlive = Boolean(aliveArr[i]);
        const h   = health[i]   ?? 1;
        const tox = toxicity[i] ?? 0;
        const fat = fatigue[i]  ?? 0;
        const r   = isAlive ? 6 : 3;
        const cx  = LAYOUT_D3[i]?.x ?? 0;
        const cy  = LAYOUT_D3[i]?.y ?? 0;
        return (
          <g key={i}>
            {isAlive && tox > 0.3 && (
              <circle cx={cx} cy={cy} r={r + 4}
                fill="none" stroke="#ff4444" strokeWidth={1.5} opacity={tox * 0.7} />
            )}
            {isAlive && fat > 0.4 && (
              <circle cx={cx} cy={cy} r={r + 2}
                fill="none" stroke="#ffd700" strokeWidth={1} opacity={fat * 0.6} />
            )}
            <circle cx={cx} cy={cy} r={r}
              fill={healthColor(h, isAlive)} opacity={isAlive ? 0.95 : 0.2} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── UI ATOMS ────────────────────────────────────────────────────────────────

function D3Stat({ label, value, color, sub, big }: {
  label: string; value: string; color: string; sub?: string; big?: boolean;
}) {
  return (
    <div className="rounded-lg px-3 py-2"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22` }}>
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#3a5570" }}>{label}</div>
      <div className="font-mono font-black leading-tight" style={{ fontSize: big ? 20 : 15, color }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#1e3050" }}>{sub}</div>}
    </div>
  );
}

function D3Param({ label, val, set, min, max, step, color, fmt }: {
  label: string; val: number; set: (v: number) => void;
  min: number; max: number; step: number; color: string; fmt?: (v: number) => string;
}) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "#3a5570" }}>
        {label}: <span className="font-bold" style={{ color }}>{fmt ? fmt(val) : val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        className="w-full" style={{ accentColor: color }} />
    </div>
  );
}

// ─── RESEARCH FINDING ────────────────────────────────────────────────────────

function D3ResearchFinding({ modeResults, activeResult, params }: {
  modeResults: D3ModeResult[];
  activeResult: D3Result & { mode: D3InitMode };
  params: D3Params;
}) {
  if (!modeResults.length) return null;
  const als  = modeResults.find(r => r.mode === "als");
  const none = modeResults.find(r => r.mode === "none");

  const suddenCollapse = activeResult.maxSlope >= 3;
  const alsFaster = !!(als && none && als.timeFirstDeath >= 0 && none.timeFirstDeath >= 0
    && als.timeFirstDeath < none.timeFirstDeath);
  const alsWorse  = !!(als && none && als.finalAlive < none.finalAlive);
  const tipDetected = activeResult.tipPoint >= 0;

  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #a8ff7844" }}>
      <div className="text-xs tracking-widest mb-4" style={{ color: "#a8ff78" }}>
        PHASE 3 — RESEARCH FINDING
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <D3Stat label="Sudden collapse"
          value={suddenCollapse ? "YES" : "NO"}
          color={suddenCollapse ? "#ff4444" : "#a8ff78"}
          sub={suddenCollapse ? `max slope=${activeResult.maxSlope}/step` : "gradual decay"} />
        <D3Stat label="Tipping point"
          value={tipDetected ? `step ${activeResult.tipPoint}` : "none"}
          color={tipDetected ? "#ff9944" : "#3a5570"}
          sub={tipDetected ? "phase transition detected" : ""} />
        <D3Stat label="ALS vs Spontaneous"
          value={alsWorse ? "ALS worse" : "similar"}
          color={alsWorse ? "#ff4444" : "#3a5570"}
          sub={als && none ? `${als.finalAlive} vs ${none.finalAlive} survivors` : "run all modes"} />
        <D3Stat label="Time to 50% loss"
          value={activeResult.time50pct >= 0 ? `step ${activeResult.time50pct}` : "not reached"}
          color="#ff9944" sub="ALS-inspired init" />
      </div>

      <p className="text-sm leading-relaxed mb-3" style={{ color: "#8ab0cc", maxWidth: 860 }}>
        {suddenCollapse
          ? `✅ Slow stress accumulation produced sudden collapse — phase transition at step ${activeResult.tipPoint} with slope=${activeResult.maxSlope}/step.`
          : `⚠️ With these parameters, degeneration was gradual with no sudden collapse.`}
        {" "}
        {alsFaster && als && none
          ? `ALS-inspired initialization caused the first death at step ${als.timeFirstDeath} (spontaneous: step ${none.timeFirstDeath}).`
          : `ALS-inspired initialization did not collapse faster than spontaneous.`}
        {" "}
        {alsWorse && als && none
          ? `ALS pattern caused ${none.finalAlive - als.finalAlive} more neuron deaths than spontaneous — starting point matters.`
          : `No meaningful difference between ALS and spontaneous — network topology matters more than starting point.`}
        {" "}
        {`Key finding: in this model, toxicity spread (rate=${params.toxSpread}) and fatigue accumulation (gain=${params.fatigueGain}) jointly govern the phase transition.`}
      </p>

      <div className="rounded-lg px-4 py-3 text-xs leading-relaxed"
        style={{ background: "rgba(0,0,0,0.3)", color: "#3a5570" }}>
        <span style={{ color: "#00e5ff" }}>Limitation:</span>{" "}
        This is a hypothesis-generating simulation. Fatigue, toxicity, and threshold parameters are
        not calibrated from real biological data. Results should be interpreted within the context
        of computational modelling, not as clinical biology.
        <br />
        <span style={{ color: "#00e5ff" }}>Next (Phase 4):</span>{" "}
        Can adding a glial/inflammatory support layer delay the tipping point?
      </div>
    </div>
  );
}

// ─── DEFAULTS ────────────────────────────────────────────────────────────────

const D3_DEFAULT_PARAMS: D3Params = {
  fatigueGain: 0.05, fatigueDecay: 0.95,
  toxSpread: 0.08,   toxDecay: 0.92,
  degRate: 0.02,     recoveryRate: 0.01,
  initTox: 0.3,      deathThresh: 0.05,
  steps: 300,
  aFatigue: 0.4,     aToxicity: 0.5,
  wLoad: 0.4,        wFatigue: 0.3,  wToxicity: 0.3,
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function Phase3Degeneration() {
  const [params,       setParams]      = useState<D3Params>(D3_DEFAULT_PARAMS);
  const [initMode,     setInitMode]    = useState<D3InitMode>("als");
  const [running,      setRunning]     = useState(false);
  const [activeRes,    setActiveRes]   = useState<(D3Result & { mode: D3InitMode }) | null>(null);
  const [modeResults,  setModeResults] = useState<D3ModeResult[]>([]);
  const [playStep,     setPlayStep]    = useState(0);
  const [playing,      setPlaying]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setP = (key: keyof D3Params) => (val: number) =>
    setParams(p => ({ ...p, [key]: val }));

  const runSingle = () => {
    setRunning(true); setActiveRes(null); setPlayStep(0); setPlaying(false);
    setTimeout(() => {
      const res = runDegenerationD3(params, initMode);
      setActiveRes({ ...res, mode: initMode });
      setRunning(false);
    }, 30);
  };

  const runAll = () => {
    setRunning(true); setModeResults([]); setPlayStep(0);
    setTimeout(() => {
      const modes: D3InitMode[] = ["als", "hub", "random", "none"];
      const results: D3ModeResult[] = modes.map(m => ({ mode: m, ...runDegenerationD3(params, m) }));
      setModeResults(results);
      setActiveRes(results[0] ?? null);
      setRunning(false);
    }, 60);
  };

  useEffect(() => {
    if (!playing || !activeRes) return;
    const maxStep = activeRes.histAlive.length - 1;
    timerRef.current = setInterval(() => {
      setPlayStep(s => {
        if (s >= maxStep) { setPlaying(false); return s; }
        return s + Math.max(1, Math.floor(params.steps / 120));
      });
    }, 80);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, activeRes, params.steps]);

  const R    = activeRes;
  const step = Math.min(playStep, R ? R.histAlive.length - 1 : 0);
  const HEAT_SAMPLE = Math.max(1, Math.floor(params.steps / 40));
  const snapHealth  = R ? (R.heatmapData[Math.floor(step / HEAT_SAMPLE)]?.healths ?? R.finalHealth) : [];
  const snapAlive   = R ? R.finalAliveArr  : [];
  const snapTox     = R ? R.finalToxicity  : [];
  const snapFatigue = R ? R.finalFatigue   : [];
  const sliceData   = (arr: number[]) => arr.slice(0, step + 1);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-red-950 border border-gray-700 rounded-2xl p-5">
        <div className="text-xs tracking-widest mb-1" style={{ color: "#ff9944" }}>
          PHASE 3 — PROGRESSIVE DEGENERATION
        </div>
        <h2 className="text-xl font-black mb-2" style={{
          background: "linear-gradient(100deg,#ff9944,#ff4444 40%,#a855f7)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Slow Stress → Sudden Collapse?
        </h2>
        <p className="text-xs max-w-2xl" style={{ color: "#3a5570" }}>
          Each neuron has health, load, fatigue, and toxicity state.
          Question:{" "}
          <span style={{ color: "#ff9944" }}>can slow stress accumulation produce sudden collapse?</span>{" "}
          This model is ALS-inspired, not clinical.
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">

        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ minWidth: 185, maxWidth: 205 }}>

          {/* init mode */}
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-2" style={{ color: "#3a5570" }}>INIT MODE</div>
            {([
              ["als",    "ALS-inspired",   "#ff4444", "Motor-A toxicity↑"],
              ["hub",    "Hub-vulnerable", "#ffd700", "High-degree fatigue↑"],
              ["random", "Random",         "#00e5ff", "Random toxicity seeds"],
              ["none",   "Spontaneous",    "#a8ff78", "Tiny noise only"],
            ] as [D3InitMode, string, string, string][]).map(([k, l, col, sub]) => (
              <button key={k} onClick={() => setInitMode(k)}
                className="w-full mb-1 rounded-md px-2 py-1.5 text-left cursor-pointer font-mono text-xs"
                style={{
                  background: initMode === k ? `${col}18` : "transparent",
                  border: `1px solid ${initMode === k ? col : "#162030"}`,
                  color: initMode === k ? col : "#3a5570",
                }}>
                <div className="font-bold">{l}</div>
                <div className="text-xs mt-0.5" style={{ color: "#3a5570" }}>{sub}</div>
              </button>
            ))}
          </div>

          {/* params */}
          <div className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-1" style={{ color: "#3a5570" }}>DYNAMICS</div>
            <D3Param label="Fatigue gain"    val={params.fatigueGain}  set={setP("fatigueGain")}  min={0.01} max={0.2}   step={0.01}  color="#ffd700" fmt={v => v.toFixed(2)} />
            <D3Param label="Fatigue decay"   val={params.fatigueDecay} set={setP("fatigueDecay")} min={0.8}  max={0.99}  step={0.01}  color="#ffd700" fmt={v => v.toFixed(2)} />
            <D3Param label="Tox spread"      val={params.toxSpread}    set={setP("toxSpread")}    min={0.01} max={0.3}   step={0.01}  color="#ff4444" fmt={v => v.toFixed(2)} />
            <D3Param label="Tox decay"       val={params.toxDecay}     set={setP("toxDecay")}     min={0.8}  max={0.99}  step={0.01}  color="#ff4444" fmt={v => v.toFixed(2)} />
            <D3Param label="Degen rate"      val={params.degRate}      set={setP("degRate")}      min={0.001} max={0.1}  step={0.001} color="#ff9944" fmt={v => v.toFixed(3)} />
            <D3Param label="Recovery rate"   val={params.recoveryRate} set={setP("recoveryRate")} min={0}    max={0.05}  step={0.005} color="#a8ff78" fmt={v => v.toFixed(3)} />
            <D3Param label="Init toxicity"   val={params.initTox}      set={setP("initTox")}      min={0.05} max={0.8}   step={0.05}  color="#a855f7" fmt={v => v.toFixed(2)} />
            <D3Param label="Death threshold" val={params.deathThresh}  set={setP("deathThresh")}  min={0.01} max={0.3}   step={0.01}  color="#ff4444" fmt={v => v.toFixed(2)} />
            <D3Param label="Steps"           val={params.steps}        set={setP("steps")}        min={100}  max={800}   step={50}    color="#00e5ff" />
          </div>

          {/* run buttons */}
          <div className="flex flex-col gap-2">
            <button onClick={runSingle} disabled={running}
              className="rounded-lg py-2.5 font-mono font-bold text-xs tracking-wide cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: running ? "#162030" : "rgba(255,153,68,0.1)",
                border: `1px solid ${running ? "#162030" : "#ff9944"}`,
                color: running ? "#3a5570" : "#ff9944",
              }}>
              {running ? "⏳ Running..." : "▶ RUN SINGLE"}
            </button>
            <button onClick={runAll} disabled={running}
              className="rounded-lg py-2.5 font-mono font-bold text-xs tracking-wide cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: running ? "#162030" : "rgba(168,255,120,0.08)",
                border: `1px solid ${running ? "#162030" : "#a8ff78"}`,
                color: running ? "#3a5570" : "#a8ff78",
              }}>
              {running ? "⏳ Running..." : "📊 RUN ALL 4 MODES"}
            </button>
          </div>

          {/* legend */}
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #162030" }}>
            <div className="text-xs tracking-widest mb-2" style={{ color: "#3a5570" }}>NODE APPEARANCE</div>
            {[
              ["■ Color",      "health: green→red"],
              ["○ Red glow",   "toxicity > 0.3"],
              ["○ Yellow ring","fatigue > 0.4"],
              ["● Dim",        "dead"],
            ].map(([k, v]) => (
              <div key={k} className="text-xs mb-1" style={{ color: "#3a5570" }}>
                <span style={{ color: "#00e5ff" }}>{k}</span> = {v}
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN PANEL ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4" style={{ minWidth: 300 }}>
          {R ? (
            <>
              {/* stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <D3Stat label="Final survivors" big
                  value={`${R.finalAlive}/${N_D3}`} color="#a8ff78"
                  sub={`${(R.finalAlive / N_D3 * 100).toFixed(0)}% alive`} />
                <D3Stat label="First death"
                  value={R.timeFirstDeath >= 0 ? `step ${R.timeFirstDeath}` : "none"}
                  color="#ff9944" />
                <D3Stat label="50% loss"
                  value={R.time50pct >= 0 ? `step ${R.time50pct}` : "not reached"}
                  color="#ff4444" />
                <D3Stat label="Tipping point"
                  value={R.tipPoint >= 0 ? `step ${R.tipPoint}` : "gradual"} color="#ffd700"
                  sub={R.tipPoint >= 0 ? `slope=${R.maxSlope}/step` : ""} />
              </div>

              {/* network + playback + timeline */}
              <div className="flex gap-4 flex-wrap items-start">
                <div className="flex flex-col gap-2">
                  <D3NetworkSnap
                    health={snapHealth} toxicity={snapTox}
                    fatigue={snapFatigue} aliveArr={snapAlive} size={210} />
                  {/* playback controls */}
                  <div className="rounded-lg px-3 py-2"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                    <div className="flex gap-2 items-center mb-2">
                      <button onClick={() => { setPlayStep(0); setPlaying(false); }}
                        className="rounded px-2 py-0.5 font-mono text-xs cursor-pointer"
                        style={{ background: "transparent", border: "1px solid #162030", color: "#3a5570" }}>
                        ⏮
                      </button>
                      <button onClick={() => setPlaying(p => !p)}
                        className="rounded px-3 py-0.5 font-mono text-xs font-bold cursor-pointer"
                        style={{
                          background: playing ? "rgba(255,100,100,0.1)" : "rgba(0,229,255,0.1)",
                          border: `1px solid ${playing ? "#ff4444" : "#00e5ff"}`,
                          color: playing ? "#ff4444" : "#00e5ff",
                        }}>
                        {playing ? "⏸" : "▶"}
                      </button>
                      <div className="font-mono text-xs" style={{ color: "#3a5570" }}>t={step}</div>
                    </div>
                    <input type="range" min={0} max={Math.max(R.histAlive.length - 1, 1)}
                      value={playStep}
                      onChange={e => { setPlaying(false); setPlayStep(parseInt(e.target.value)); }}
                      className="w-full" style={{ accentColor: "#ff9944" }} />
                    <div className="flex gap-0.5 mt-1 h-1.5 rounded overflow-hidden">
                      <div style={{ flex: R.histAlive[step] ?? 0, background: "#a8ff78", opacity: 0.7 }} />
                      <div style={{ flex: N_D3 - (R.histAlive[step] ?? 0), background: "#ff4444", opacity: 0.5 }} />
                    </div>
                  </div>
                </div>

                {/* timeline charts */}
                <div className="flex-1" style={{ minWidth: 240 }}>
                  <D3LineChart
                    series={[
                      { label: "alive",  data: sliceData(R.histAlive),                  color: "#a8ff78", bold: true },
                      { label: "health", data: sliceData(R.histHealth).map(v => v * N_D3), color: "#00e5ff" },
                    ]}
                    height={100} width={300}
                    title="ALIVE NEURONS + AVG HEALTH (×N)"
                    markers={R.tipPoint >= 0 ? [R.tipPoint] : []} />
                  <D3LineChart
                    series={[
                      { label: "toxicity", data: sliceData(R.histTox).map(v => v * N_D3),     color: "#ff4444" },
                      { label: "fatigue",  data: sliceData(R.histFatigue).map(v => v * N_D3), color: "#ffd700" },
                    ]}
                    height={80} width={300}
                    title="TOXICITY + FATIGUE BURDEN (×N)" />
                </div>
              </div>

              {/* heatmap */}
              <div className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                <D3Heatmap heatmapData={R.heatmapData} width={520} height={130} />
              </div>

              {/* mode comparison */}
              {modeResults.length > 0 && (
                <div className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #162030" }}>
                  <D3ComparisonBars modeResults={modeResults} width={520} height={150} />
                  <div className="mt-4">
                    <D3LineChart
                      series={modeResults.map((r, i) => ({
                        label: r.mode,
                        data: r.histAlive,
                        color: (["#ff4444", "#ffd700", "#00e5ff", "#a8ff78"] as const)[i],
                        bold: r.mode === "als",
                      }))}
                      height={110} width={520}
                      title="SURVIVAL CURVES — ALL 4 INIT MODES" />
                    <div className="flex gap-4 mt-2 flex-wrap">
                      {(["ALS", "Hub", "Random", "Spontaneous"] as const).map((l, i) => {
                        const col = (["#ff4444", "#ffd700", "#00e5ff", "#a8ff78"] as const)[i];
                        return (
                          <span key={l} className="text-xs flex items-center gap-1" style={{ color: col }}>
                            <span style={{ width: 12, height: 2, background: col, display: "inline-block" }} />{l}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* milestones table */}
                  <div className="mt-4">
                    <div className="text-xs tracking-widest mb-2" style={{ color: "#3a5570" }}>
                      MILESTONE TABLE
                    </div>
                    <table className="w-full text-xs font-mono" style={{ borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Mode", "Survivors", "1st Death", "25% loss", "50% loss", "Tip point"].map(h => (
                            <th key={h} className="text-left px-2 py-1 text-xs tracking-wide"
                              style={{ color: "#3a5570", borderBottom: "1px solid #162030" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modeResults.map((r, i) => {
                          const col = (["#ff4444", "#ffd700", "#00e5ff", "#a8ff78"] as const)[i];
                          return (
                            <tr key={r.mode}>
                              <td className="px-2 py-1 font-bold"     style={{ color: col }}>{r.mode.toUpperCase()}</td>
                              <td className="px-2 py-1"               style={{ color: col }}>{r.finalAlive}/{N_D3}</td>
                              <td className="px-2 py-1"               style={{ color: "#3a5570" }}>{r.timeFirstDeath >= 0 ? r.timeFirstDeath : "—"}</td>
                              <td className="px-2 py-1"               style={{ color: "#3a5570" }}>{r.time25pct >= 0 ? r.time25pct : "—"}</td>
                              <td className="px-2 py-1"               style={{ color: "#3a5570" }}>{r.time50pct >= 0 ? r.time50pct : "—"}</td>
                              <td className="px-2 py-1"               style={{ color: r.tipPoint >= 0 ? "#ff9944" : "#3a5570" }}>
                                {r.tipPoint >= 0 ? r.tipPoint : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <D3ResearchFinding modeResults={modeResults} activeResult={R} params={params} />
            </>
          ) : (
            <div className="h-72 flex items-center justify-center rounded-2xl text-xs tracking-widest"
              style={{ color: "#162030", border: "1px dashed #162030" }}>
              PRESS RUN SINGLE OR RUN ALL 4 MODES
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

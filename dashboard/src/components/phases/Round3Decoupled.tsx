"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";

// 5×5 grid: rows=TSSE (high→low), cols=ISR (low→high)
const ISR_VALS  = [0.05, 0.5, 2.0, 5.0, 10.0];
const TSSE_VALS = [10.0, 5.0, 2.0, 0.5, 0.05]; // display top→bottom

// genuine_tipping_rate[tsse_idx][isr_idx] — ordered to match TSSE_VALS × ISR_VALS
const GRID: number[][] = [
  [1.0,  1.0,  1.0,  1.0, 1.0],  // TSSE=10
  [1.0,  1.0,  1.0,  1.0, 1.0],  // TSSE=5
  [0.5,  1.0,  1.0,  1.0, 1.0],  // TSSE=2
  [0.0,  0.4,  1.0,  1.0, 1.0],  // TSSE=0.5
  [0.0, 0.05,  1.0,  1.0, 1.0],  // TSSE=0.05
];

function heatColor(v: any) {
  if (v >= 0.95) return "#dc2626";   // red — full tipping
  if (v >= 0.70) return "#f97316";   // orange
  if (v >= 0.40) return "#eab308";   // yellow
  if (v >= 0.10) return "#3b82f6";   // blue
  return "#1e3a5f";                  // deep blue — no tipping
}

// Predictor bar data
const PREDICTOR_DATA = [
  { label: "ISR",  r: 0.586, color: "#00e5ff" },
  { label: "TSSE", r: 0.463, color: "#a855f7" },
];

// Mechanism dominance (diagonal cells from results)
const MECH_DATA = [
  { ctx: "ISR=0.05\nTSSE=0.05", dominant: "both",    genuine: 0.00, color: "#1e3a5f" },
  { ctx: "ISR=0.5\nTSSE=0.5",   dominant: "both",    genuine: 0.40, color: "#3b82f6" },
  { ctx: "ISR=2\nTSSE=2",       dominant: "seeding",  genuine: 1.00, color: "#dc2626" },
  { ctx: "ISR=5\nTSSE=5",       dominant: "neither",  genuine: 1.00, color: "#dc2626" },
  { ctx: "ISR=10\nTSSE=10",     dominant: "neither",  genuine: 1.00, color: "#dc2626" },
];

export default function Round3Decoupled() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Mean genuine rate",   value: "83.8%",  sub: "across 25 grid cells",  color: "#00e5ff" },
          { label: "ISR predictor r",     value: "0.586",  sub: "r(log ISR, genuine)",   color: "#a8ff78" },
          { label: "TSSE predictor r",    value: "0.463",  sub: "r(log TSSE, genuine)",  color: "#a855f7" },
          { label: "Both-required cells", value: "5/25",   sub: "low ISR + low TSSE",    color: "#ffd700" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Genuine Tipping Rate — ISR × TSSE Grid
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            20 seeds × 500 steps per cell. Red = 100% tipping; blue = no tipping.
          </p>
          {/* TSSE y-axis label */}
          <div className="flex gap-2">
            <div className="flex flex-col justify-center">
              <span className="text-xs text-gray-500 [writing-mode:vertical-rl] rotate-180 text-center">
                TSSE (trans-synaptic spread) →
              </span>
            </div>
            <div className="flex-1">
              {/* Column headers */}
              <div className="grid grid-cols-5 gap-1 mb-1 pl-10">
                {ISR_VALS.map(v => (
                  <div key={v} className="text-center text-xs text-gray-500">{v}</div>
                ))}
              </div>
              {/* Rows */}
              {GRID.map((row, ri) => (
                <div key={ri} className="grid grid-cols-5 gap-1 mb-1 items-center">
                  <div className="col-start-1" style={{ gridColumn: "1/1" }} />
                  {/* row label */}
                  <div className="absolute -ml-10 w-9 text-right text-xs text-gray-500">
                    {TSSE_VALS[ri]}
                  </div>
                  {row.map((v, ci) => (
                    <div key={ci}
                      className="h-10 rounded flex items-center justify-center text-xs font-mono font-bold"
                      style={{ background: heatColor(v), color: v >= 0.4 ? "#fff" : "#9ca3af" }}>
                      {v.toFixed(2)}
                    </div>
                  ))}
                </div>
              ))}
              <div className="text-center text-xs text-gray-500 mt-2">ISR (intracellular seeding rate) →</div>
            </div>
          </div>
        </div>

        {/* Predictor comparison */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-1">
              Mechanism Predictiveness
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Pearson r of log(mechanism) vs genuine_rate across 25 cells
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={PREDICTOR_DATA} layout="vertical"
                margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis type="number" domain={[0, 0.7]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} width={35} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                  formatter={(v: any) => [v.toFixed(3), "Pearson r"]} />
                <Bar dataKey="r" radius={[0, 3, 3, 0]}>
                  {PREDICTOR_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-1">Diagonal Cells — Mechanism Dominance</h3>
            <div className="space-y-1">
              {MECH_DATA.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: d.color }} />
                  <span className="text-gray-400 w-28 font-mono">{d.ctx.replace("\n", " ")}</span>
                  <span className="font-semibold" style={{ color: d.color }}>
                    {(d.genuine * 100).toFixed(0)}%
                  </span>
                  <span className="text-gray-500 ml-1">dominant: {d.dominant}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap legend */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Colour Scale</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "1.00 (full tipping)", color: "#dc2626" },
            { label: "0.70–0.95",           color: "#f97316" },
            { label: "0.40–0.70",           color: "#eab308" },
            { label: "0.10–0.40",           color: "#3b82f6" },
            { label: "0.00–0.10 (no tip)",  color: "#1e3a5f" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-4 h-4 rounded" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) Grid uses 5 values per axis only — results between grid points
        are interpolated. (2) Mean genuine rate (83.8%) includes the low-ISR/low-TSSE region which is
        biologically implausible (minimal seeding). (3) Mechanism dominance tested by ablation; &ldquo;neither&rdquo; means
        both can sustain tipping independently.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.1):</strong> The v1.0 aggregationAmplification dominance is <strong>genuine</strong>,
        not a coupling artifact. Decoupling into ISR and TSSE shows both mechanisms are independently load-bearing.
        ISR is more predictive (r=0.586 vs 0.463). In the medium context (ISR=TSSE=2.0), genuine tipping rate
        reaches <strong>100%</strong>. Only the low-ISR/low-TSSE corner requires both simultaneously.
      </div>
    </div>
  );
}

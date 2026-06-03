"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";
import { runSimulation, DEFAULT_PARAMS } from "@/lib/simulation";
import { N } from "@/lib/connectome";

const Phase7PermutationTest = dynamic(
  () => import("@/components/phases/Phase7PermutationTest"),
  { ssr: false }
);

type P7SubTab = "tipping" | "permutation";

// Pre-computed null model data (from Phase 7B results)
const NULL_MODEL_FPR_ORIGINAL = 44;
const NULL_MODEL_FPR_STRICT = 0;
const GENUINE_CONFIGS = 247;
const TOTAL_CRITICAL = 382;

const CRITERIA_STATS = [
  { name: "C1: Slope > 4",          pass: 382, label: "All critical configs pass (trivially)" },
  { name: "C2: Coherence r > 0.30", pass: 248, label: "Spatial coherence - decisive discriminator" },
  { name: "C3: Silent > 50 steps",  pass: 382, label: "All genuine configs have silent phase" },
  { name: "All 3 (AND)",            pass: 247, label: "Genuine tipping points after falsification" },
];

const TOPOLOGY_DATA = [
  { name: "C. elegans",       rate: 1.000, color: "#00e5ff", coherence:  0.582 },
  { name: "Watts-Strogatz",   rate: 0.780, color: "#a8ff78", coherence:  0.423 },
  { name: "Degree-Preserved", rate: 0.730, color: "#ffd700", coherence:  0.378 },
  { name: "Erdos-Renyi",      rate: 0.480, color: "#ff9944", coherence:  0.295 },
  { name: "Barabasi-Albert",  rate: 0.000, color: "#ff4444", coherence: -0.104 },
];

function runNullModel(seed: number): number[] {
  let rng = seed;
  const next = () => {
    rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  const health = new Float64Array(N).fill(1.0);
  const ratePerNeuron = Array.from({ length: N }, () => 0.002 + next() * 0.003);
  const alive: number[] = [];
  for (let t = 0; t < 300; t++) {
    let n = 0;
    for (let i = 0; i < N; i++) {
      health[i] = Math.max(0, health[i] - ratePerNeuron[i]);
      if (health[i] > 0.15) n++;
    }
    alive.push(n);
  }
  return alive;
}

export default function Phase7Tipping() {
  const [subTab,   setSubTab]   = useState<P7SubTab>("tipping");
  const [simHist,  setSimHist]  = useState<number[]>([]);
  const [nullHist, setNullHist] = useState<number[]>([]);
  const [ran,      setRan]      = useState(false);

  const run = useCallback(() => {
    const h = runSimulation(DEFAULT_PARAMS, 300, 134);
    setSimHist(h.map(x => x.alive));
    setNullHist(runNullModel(42));
    setRan(true);
  }, []);

  const chartData = simHist
    .map((alive, i) => ({ step: i + 1, mechanistic: alive, null: nullHist[i] ?? null }))
    .filter((_, i) => i % 2 === 0);

  const slope10Max = simHist.reduce((mx, _, i) => {
    if (i < 10) return mx;
    return Math.max(mx, simHist[i - 10] - simHist[i]);
  }, 0);

  const nullSlope10Max = nullHist.reduce((mx, _, i) => {
    if (i < 10) return mx;
    return Math.max(mx, nullHist[i - 10] - nullHist[i]);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Sub-tab strip */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {([
          ["tipping",     "Falsification & Tipping"],
          ["permutation", "Permutation Test"],
        ] as [P7SubTab, string][]).map(([id, label]) => (
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

      {subTab === "permutation" && <Phase7PermutationTest />}

      {subTab === "tipping" && (
        <div className="space-y-6">
          {/* Key numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Null FPR (original)",      value: `${NULL_MODEL_FPR_ORIGINAL}%`, color: "#ff4444" },
              { label: "Null FPR (strict)",         value: `${NULL_MODEL_FPR_STRICT}%`,  color: "#a8ff78" },
              { label: "Genuine tipping configs",   value: `${GENUINE_CONFIGS}/${TOTAL_CRITICAL}`, color: "#00e5ff" },
              { label: "Key criterion",             value: "Coherence r>0.30",            color: "#ffd700" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Live comparison */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">
                Mechanistic vs. Null Model (Config #334)
              </h3>
              <button onClick={run}
                className="py-1.5 px-4 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded">
                Run Comparison
              </button>
            </div>
            {!ran ? (
              <div className="h-44 flex items-center justify-center text-gray-600 text-sm">
                Click Run to compare
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis type="number" dataKey="step" name="Step"
                      tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis type="number" domain={[0, 61]}
                      tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Scatter name="Mechanistic"
                      data={chartData.map(d => ({ step: d.step, alive: d.mechanistic }))}
                      fill="#00e5ff" dataKey="alive" />
                    <Scatter name="Null model"
                      data={chartData.map(d => ({ step: d.step, alive: d.null }))}
                      fill="#ff4444" dataKey="alive" />
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <p className="font-semibold text-cyan-300">Mechanistic model</p>
                    <p className="text-gray-300 mt-1">
                      Max 10-step death rate: <strong>{slope10Max}</strong> neurons
                    </p>
                    <p className="text-gray-400">Sharp tipping point - genuine cascade</p>
                  </div>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <p className="font-semibold text-red-400">Null model (uncoupled)</p>
                    <p className="text-gray-300 mt-1">
                      Max 10-step death rate: <strong>{nullSlope10Max}</strong> neurons
                    </p>
                    <p className="text-gray-400">Gradual decline - false tipping point</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Criteria + Topology */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Three-Part Strict Criterion</h3>
              <div className="space-y-3">
                {CRITERIA_STATS.map(c => (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-200">{c.name}</span>
                      <span className="text-cyan-300">{c.pass}/{TOTAL_CRITICAL} pass</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${(c.pass / TOTAL_CRITICAL) * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Phase 7C: Topology Dependence
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={TOPOLOGY_DATA} layout="vertical"
                  margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" horizontal={false} />
                  <XAxis type="number" domain={[0, 1]}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fontSize: 10, fill: "#9ca3af" }} width={100} />
                  <Tooltip
                    formatter={(v: unknown) => `${((Number(v) ?? 0) * 100).toFixed(0)}%`}
                    contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }} />
                  <Bar dataKey="rate" name="Genuine tipping rate">
                    {TOPOLOGY_DATA.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-2">
                C. elegans wiring = 100% genuine. Barabasi-Albert (scale-free) = 0%
                - hub topology distributes damage, preventing cascade.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

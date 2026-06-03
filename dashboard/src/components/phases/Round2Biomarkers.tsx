"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// Feature separation (Cohen d and Pearson r) between C0 slow and C1 fast
const FEATURES = [
  { name: "aggregationAmplification", short: "aggAmp",    cohenD: 51.49, r:  0.999, rank: 1, color: "#00e5ff", clinical: "TDP-43 aggregation rate (CSF pSer409/410)" },
  { name: "tipping_step",             short: "tip_step",  cohenD: 18.79, r: -0.995, rank: 2, color: "#a8ff78", clinical: "Time to first EMG denervation" },
  { name: "collapse_velocity",        short: "vel.",      cohenD:  9.32, r:  0.982, rank: 3, color: "#ffd700", clinical: "ALSFRS-R decline slope" },
  { name: "plateau_survivors",        short: "plateau",   cohenD:  6.61, r: -0.965, rank: 4, color: "#fb923c", clinical: "Motor unit count at diagnosis (MUNE)" },
  { name: "therapy_window_width",     short: "window",    cohenD:  3.28, r: -0.878, rank: 5, color: "#a855f7", clinical: "Simulation-derived intervention window estimate" },
  { name: "coherence_r",              short: "coherence", cohenD:  1.13, r:  0.534, rank: 6, color: "#f87171", clinical: "EMG anatomical spread pattern (spatial order)" },
];

// Topology response predictors
const TOPO_PREDICTORS = [
  { feature: "plateau_survivors",        topology: "sparse_chain_benefit",    r:  0.791, color: "#00e5ff" },
  { feature: "aggregationAmplification", topology: "triangle_rich_harm",      r:  0.914, color: "#ffd700" },
  { feature: "tipping_step",             topology: "sparse_chain_benefit",    r:  0.762, color: "#a8ff78" },
  { feature: "therapy_window_width",     topology: "distributed_benefit",     r:  0.709, color: "#a855f7" },
];

// C0 vs C1 means for each feature (illustrative values from report)
const MEANS = [
  { short: "aggAmp",   c0: 1.355, c1: 5.881,  unit: "" },
  { short: "tip_step", c0: 218.4, c1:  96.6,  unit: " steps" },
  { short: "vel.",     c0:   9.9, c1:  20.7,  unit: "/100 steps" },
  { short: "plateau",  c0:  21.3, c1:   9.5,  unit: " neurons" },
  { short: "window",   c0:  75.0, c1:  -1.0,  unit: " steps" },
  { short: "coherence",c0:  0.40, c1:   0.53, unit: "" },
];

const cohenDData = FEATURES.map(f => ({ name: f.short, "Cohen d": Math.abs(f.cohenD), color: f.color }));

export default function Round2Biomarkers() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Top discriminator",  value: "aggAmp",  sub: "d=51.5, r=0.999",     color: "#00e5ff" },
          { label: "LOO-CV accuracy",    value: "100%",    sub: "aggAmp alone (N=10)",  color: "#a8ff78" },
          { label: "Topo predictor",     value: "r=0.914", sub: "aggAmp→tri_rich_harm", color: "#ffd700" },
          { label: "Features analysed",  value: "7",       sub: "disease + 3 topology", color: "#a855f7" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cohen d bar */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Feature Separation Power (|Cohen d|, C0 vs C1)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            aggAmp dominates by 2.7× over next best feature — log scale
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cohenDData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 68 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" horizontal={false} />
              <XAxis type="number" scale="log" domain={[0.5, 100]}
                tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(2), "|Cohen d|"]} />
              <ReferenceLine x={2} stroke="#4b5563" strokeDasharray="3 3"
                label={{ value: "d=2", fill: "#6b7280", fontSize: 9 }} />
              <Bar dataKey="Cohen d" radius={[0, 3, 3, 0]}>
                {cohenDData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Topology response predictors */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Topology Response Predictors
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Pearson r between disease feature and topology benefit/harm (N=10 simulation configs)
          </p>
          <div className="space-y-3">
            {TOPO_PREDICTORS.map(tp => (
              <div key={tp.feature + tp.topology} className="p-3 bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-300">{tp.feature}</span>
                  <span className="text-xs font-mono" style={{ color: tp.color }}>→ {tp.topology.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-gray-700 rounded flex-1">
                    <div className="h-2 rounded" style={{ width: `${Math.abs(tp.r) * 100}%`, background: tp.color }} />
                  </div>
                  <span className="text-xs font-mono font-bold" style={{ color: tp.color }}>r={tp.r}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Note: N=10 — directional signal only; magnitude unreliable.</p>
        </div>
      </div>

      {/* Feature table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Full Feature Comparison Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-400">
            <thead>
              <tr className="border-b border-gray-700 text-gray-500">
                <th className="text-left py-2 pr-3">Rank</th>
                <th className="text-left py-2 pr-3">Feature</th>
                <th className="text-right py-2 pr-3">Cohen d</th>
                <th className="text-right py-2 pr-3">Pearson r</th>
                <th className="text-right py-2 pr-3">Mean C0</th>
                <th className="text-right py-2 pr-3">Mean C1</th>
                <th className="text-left py-2">Clinical proxy</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => {
                const m = MEANS.find(m => m.short === f.short);
                return (
                  <tr key={f.name} className="border-b border-gray-800">
                    <td className="py-1.5 pr-3 font-mono font-bold" style={{ color: f.color }}>#{f.rank}</td>
                    <td className="py-1.5 pr-3 text-gray-200">{f.short}</td>
                    <td className="text-right pr-3 font-mono">{f.cohenD.toFixed(2)}</td>
                    <td className="text-right pr-3 font-mono">{f.r.toFixed(3)}</td>
                    <td className="text-right pr-3 font-mono">{m ? m.c0.toFixed(2) : "—"}</td>
                    <td className="text-right pr-3 font-mono">{m ? m.c1.toFixed(2) : "—"}</td>
                    <td className="py-1.5 text-gray-500 max-w-xs">{f.clinical}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200 mb-2">
        <strong>Sample size note:</strong> Topology response predictors (r values) are based on N=10 configs
        (5 C0 + 5 C1). These are directionally informative but statistically underpowered.
        The 100% LOO-CV accuracy for aggAmp subtype classification is trivial at N=10.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding:</strong> aggAmp is the dominant bifurcation parameter with Cohen d=51.5 —
        2.7× larger than the next best feature. It alone achieves 100% LOO-CV subtype classification
        (N=10; validated at 84.6% on all 247 configs in Phase 12). The strongest topology predictor
        is aggAmp → triangle_rich_harm (r=0.914): high-aggAmp patients are most damaged by feedback loops.
      </div>
    </div>
  );
}




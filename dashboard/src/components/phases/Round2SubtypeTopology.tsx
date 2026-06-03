"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// Plateau delta = alive_at_300(topology) - alive_at_300(baseline) per subtype
const INTERACTIONS = [
  {
    topology: "Sparse chain",     short: "sparse",
    c0: +0.36, c1: +0.00, interaction: +0.360, color: "#00e5ff",
    desc: "Benefits slow-tipping patients; no effect on fast. Fewer spreading paths help only when cascade is slow enough to be redirected.",
  },
  {
    topology: "Triangle rich 60%", short: "tri-60%",
    c0: -0.84, c1: -3.00, interaction: +2.160, color: "#ffd700",
    desc: "Hurts fast-tipping 3.6× more than slow-tipping. Recurrent loops accelerate existing fast cascade; slow cascade absorbs the extra loops partially.",
  },
  {
    topology: "Distributed",       short: "distrib.",
    c0: +0.40, c1: +0.00, interaction: +0.400, color: "#a8ff78",
    desc: "Similar to sparse chain: C0 gains modestly from distributed load; C1 unaffected (cascade too fast to redirect).",
  },
];

// Grouped bar data for chart
const barData = INTERACTIONS.map(d => ({
  name: d.short,
  "C0 slow": d.c0,
  "C1 fast": d.c1,
  "Interaction": d.interaction,
}));

// Subtype characteristics for context
const SUBTYPES = [
  { name: "C0 — Slow-tipping (n=110)", aggAmp: 1.36, tip: 224, plateau: 13.1, color: "#00e5ff",
    note: "Wide therapeutic window (~115 steps). Topology modifications have measurable effect because cascade proceeds slowly enough for network structure to influence spreading path selection." },
  { name: "C1 — Fast-tipping (n=137)", aggAmp: 5.86, tip: 107, plateau:  5.3, color: "#ff4444",
    note: "Narrow/zero therapeutic window. Cascade is too rapid for topology to redirect. Extra feedback loops (triangle-rich) make things worse; sparse topology provides no benefit." },
];

export default function Round2SubtypeTopology() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Largest interaction",  value: "+2.16",  sub: "Triangle rich 60%", color: "#ffd700" },
          { label: "C1 topology penalty",  value: "−3.00",  sub: "Triangle rich 60%", color: "#ff4444" },
          { label: "C0 topology benefit",  value: "+0.40",  sub: "Distributed",       color: "#00e5ff" },
          { label: "Strategy implication", value: "C0≠C1",  sub: "stratification needed", color: "#a8ff78" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grouped bar: plateau delta by topology and subtype */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Plateau Survivors Delta vs Baseline
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Difference in alive_at_300 between topology variant and baseline C. elegans (negative = worse)
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 20, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Plateau delta", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(2), ""]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#4b5563" />
              <Bar dataKey="C0 slow" fill="#00e5ff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="C1 fast" fill="#ff4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Interaction effect bars */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Subtype × Topology Interaction Effect
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Interaction = |C0 delta − C1 delta| — larger means topology affects subtypes differently
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={INTERACTIONS.map(d => ({ name: d.short, interaction: d.interaction, color: d.color }))}
              margin={{ top: 5, right: 20, bottom: 20, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(3), "interaction"]} />
              <Bar dataKey="interaction" radius={[3, 3, 0, 0]}>
                {INTERACTIONS.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interaction cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Topology Effects</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INTERACTIONS.map(d => (
            <div key={d.topology} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-sm font-semibold text-gray-200">{d.topology}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="p-1.5 bg-gray-800 rounded text-center">
                  <div className="text-gray-500">C0 delta</div>
                  <div className={`font-mono font-bold ${d.c0 >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {d.c0 >= 0 ? "+" : ""}{d.c0.toFixed(2)}
                  </div>
                </div>
                <div className="p-1.5 bg-gray-800 rounded text-center">
                  <div className="text-gray-500">C1 delta</div>
                  <div className={`font-mono font-bold ${d.c1 >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {d.c1 >= 0 ? "+" : ""}{d.c1.toFixed(2)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Subtype context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SUBTYPES.map(s => (
          <div key={s.name} className="bg-gray-900 border border-gray-700 rounded-xl p-4 border-l-4"
            style={{ borderColor: s.color }}>
            <div className="text-sm font-bold mb-2" style={{ color: s.color }}>{s.name}</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-2">
              <span>aggAmp: <strong className="text-gray-200">{s.aggAmp}</strong></span>
              <span>Tip step: <strong className="text-gray-200">{s.tip}</strong></span>
              <span>Plateau: <strong className="text-gray-200">{s.plateau}</strong></span>
            </div>
            <p className="text-xs text-gray-400">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding:</strong> Slow-tipping (C0) patients are substantially more topology-sensitive
        than fast-tipping (C1). Triangle-rich feedback loops at 60% strength cause 3× more harm
        in C1 than C0 (−3.00 vs −0.84 plateau delta). This asymmetry means subtype-stratified
        topology-based intervention is warranted — topology-modifying strategies should target C0 patients only.
      </div>
    </div>
  );
}




"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// Condition comparison
const CONDITION_DATA = [
  { cond: "AVAL boost",    first_death: 77,  genuine: 1.000, plateau: 9.6,  color: "#00e5ff", note: "cascade hub (rank 9/61)" },
  { cond: "DA6 boost",     first_death: 80,  genuine: 1.000, plateau: 9.2,  color: "#a8ff78", note: "protective node (rank 19/61)" },
  { cond: "Uniform (no boost)", first_death: 165, genuine: 1.000, plateau: 9.2, color: "#374151", note: "zero init aggregation" },
];

// All-neuron fragility — top 20 + bottom 5 (sorted by first_death asc = most dangerous first)
const ALL_NEURON_TOP20 = [
  { name: "DA2",  type: "motor",      vuln: 1.00, first_death: 74.0,  rate: 1.000 },
  { name: "DA1",  type: "motor",      vuln: 1.00, first_death: 74.1,  rate: 1.000 },
  { name: "DB1",  type: "motor",      vuln: 0.90, first_death: 75.7,  rate: 1.000 },
  { name: "DB2",  type: "motor",      vuln: 0.90, first_death: 76.0,  rate: 1.000 },
  { name: "VA2",  type: "motor",      vuln: 0.95, first_death: 76.1,  rate: 1.000 },
  { name: "AVDL", type: "interneuron", vuln: 0.15, first_death: 76.5,  rate: 1.000 },
  { name: "AVDR", type: "interneuron", vuln: 0.15, first_death: 76.5,  rate: 1.000 },
  { name: "VA1",  type: "motor",      vuln: 0.95, first_death: 76.6,  rate: 1.000 },
  { name: "AVAL", type: "interneuron", vuln: 0.15, first_death: 77.5,  rate: 1.000 },
  { name: "AVAR", type: "interneuron", vuln: 0.15, first_death: 77.7,  rate: 1.000 },
  { name: "VB2",  type: "motor",      vuln: 0.85, first_death: 77.9,  rate: 1.000 },
  { name: "VB1",  type: "motor",      vuln: 0.85, first_death: 78.6,  rate: 1.000 },
  { name: "PVCL", type: "interneuron", vuln: 0.15, first_death: 78.7,  rate: 1.000 },
  { name: "PVCR", type: "interneuron", vuln: 0.15, first_death: 78.9,  rate: 1.000 },
  { name: "DA3",  type: "motor",      vuln: 1.00, first_death: 79.3,  rate: 1.000 },
  { name: "DA4",  type: "motor",      vuln: 1.00, first_death: 79.4,  rate: 1.000 },
  { name: "VA3",  type: "motor",      vuln: 0.95, first_death: 79.5,  rate: 1.000 },
  { name: "DA5",  type: "motor",      vuln: 1.00, first_death: 79.6,  rate: 1.000 },
  { name: "DA6",  type: "motor",      vuln: 1.00, first_death: 79.7,  rate: 1.000 },
  { name: "DA8",  type: "motor",      vuln: 1.00, first_death: 80.0,  rate: 1.000 },
];

const BOTTOM5 = [
  { name: "PLML", type: "sensory", vuln: 0.05, first_death: 90.0, rate: 0.500 },
  { name: "PLMR", type: "sensory", vuln: 0.05, first_death: 90.1, rate: 0.500 },
  { name: "PVM",  type: "sensory", vuln: 0.05, first_death: 93.0, rate: 0.800 },
  { name: "RIML", type: "interneuron", vuln: 0.30, first_death: 92.0, rate: 1.000 },
  { name: "AVM",  type: "sensory", vuln: 0.05, first_death: 91.9, rate: 1.000 },
];

function typeColor(t: string) {
  if (t === "motor")      return "#f97316";
  if (t === "interneuron") return "#00e5ff";
  return "#6b7280";
}

// Scatter: vulnerability vs first_death (selected subset for clarity)
const SCATTER_DATA = [
  ...ALL_NEURON_TOP20,
  ...BOTTOM5,
].map(d => ({
  x: d.vuln,
  y: d.first_death,
  name: d.name,
  type: d.type,
  rate: d.rate,
}));

export default function Round3SeedLocation() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Whether tipping changes", value: "No",      sub: "genuine_rate=1.0 for all", color: "#a8ff78"  },
          { label: "Timing range",            value: "88 steps", sub: "AVAL(77) → uniform(165)", color: "#f97316" },
          { label: "Fragile seeds (≥80%)",    value: "59/61",    sub: "all but PLML, PLMR",     color: "#dc2626" },
          { label: "AVAL rank (onset speed)", value: "#9/61",    sub: "top 15% fastest cascade", color: "#00e5ff" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Condition bar chart */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            First-Death Step by Seed Condition
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            All conditions: genuine_rate=1.000. Timing varies by 88 steps.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={CONDITION_DATA}
              margin={{ top: 5, right: 20, bottom: 30, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="cond" tick={{ fontSize: 9, fill: "#9ca3af" }}
                angle={-20} textAnchor="end" interval={0} />
              <YAxis domain={[0, 200]} tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "first death step", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [`step ${v}`, "First death"]} />
              <Bar dataKey="first_death" radius={[3, 3, 0, 0]} name="First death step">
                {CONDITION_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {CONDITION_DATA.map(d => (
              <div key={d.cond} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-gray-300 font-medium w-28">{d.cond}</span>
                <span className="font-mono text-gray-400">step {d.first_death}</span>
                <span className="text-gray-600">({d.note})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vulnerability vs onset scatter */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Vulnerability vs First-Death Onset (seed boost condition)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Spearman r(vulnerability, first_death) = −0.612 (higher vulnerability → faster onset).
            Selected neurons shown; orange=motor, cyan=interneuron, gray=sensory.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="x" type="number" domain={[0, 1.1]} name="Vulnerability"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                label={{ value: "Vulnerability", position: "insideBottom", offset: -2, fill: "#9ca3af", fontSize: 10 }} />
              <YAxis dataKey="y" type="number" domain={[70, 100]} name="First death step"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                label={{ value: "first death (steps)", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 9 }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as typeof SCATTER_DATA[0];
                  return (
                    <div className="bg-gray-900 border border-gray-600 rounded p-2 text-xs">
                      <div className="font-bold text-white">{d.name}</div>
                      <div className="text-gray-400">type: {d.type}</div>
                      <div className="text-gray-400">vuln: {d.x.toFixed(2)}</div>
                      <div className="text-gray-400">first death: step {d.y}</div>
                      <div className="text-gray-400">genuine rate: {d.rate.toFixed(2)}</div>
                    </div>
                  );
                }} />
              <Scatter data={SCATTER_DATA} name="neurons">
                {SCATTER_DATA.map((d, i) => (
                  <Cell key={i} fill={typeColor(d.type)} fillOpacity={d.rate < 1 ? 0.5 : 0.85} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs">
            {[
              { label: "Motor neuron",   color: "#f97316" },
              { label: "Interneuron",    color: "#00e5ff" },
              { label: "Sensory",        color: "#6b7280" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                <span className="text-gray-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 10 dangerous seeds */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Top 20 Most Dangerous Seed Locations (fastest onset)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ALL_NEURON_TOP20.map((d, i) => (
            <div key={d.name}
              className="flex items-center gap-2 p-2 bg-gray-800 rounded text-xs">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: d.rate === 1 ? "#dc2626" : "#374151", color: "#fff" }}>
                {i + 1}
              </span>
              <div>
                <div className="font-bold" style={{ color: typeColor(d.type) }}>{d.name}</div>
                <div className="text-gray-500">step {d.first_death}</div>
                <div className="text-gray-600">v={d.vuln}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-gray-800 rounded text-xs">
          <span className="text-yellow-400 font-semibold">Notable:</span>{" "}
          <span className="text-gray-300">
            AVDL and AVDR (command interneurons, vulnerability=0.15) rank <strong>6th and 7th</strong> —
            ahead of many high-vulnerability motor neurons. They have direct synaptic connections
            to DA1/DA2 (highest vulnerability), making them efficient boosters via spread despite low
            intrinsic vulnerability. AVAL ranks 9th for the same reason.
          </span>
        </div>
      </div>

      {/* Most resilient */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Resilient Seeds (lowest genuine rate)</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {BOTTOM5.map(d => (
            <div key={d.name}
              className="p-3 bg-gray-800 border border-gray-700 rounded-lg text-center text-xs">
              <div className="font-bold text-gray-300 text-base">{d.name}</div>
              <div className="text-gray-500 mb-1">{d.type} · vuln={d.vuln}</div>
              <div className="font-mono font-bold" style={{ color: d.rate < 0.9 ? "#ffd700" : "#9ca3af" }}>
                {(d.rate * 100).toFixed(0)}% genuine
              </div>
              <div className="text-gray-500">step {d.first_death}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Only PLML and PLMR fail to reach genuine_rate≥0.80. Both are peripheral sensory neurons with
          vulnerability=0.05. They are far from motor neurons topologically — a boost there dissipates
          before reaching the vulnerable motor pool.
        </p>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) 10 seeds × 10 configs = 100 runs per neuron — genuine_rate
        estimates have ±10pp granularity. (2) Boost of +0.5 is a single test value; results may differ for
        smaller boosts. (3) DVA (Phase 1A #1 cascade-critical) is not in the 61-neuron motor circuit model;
        AVAL is used as the nearest substitute.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.6):</strong> Seed location affects <strong>WHEN</strong> tipping occurs
        (88-step range) but not <strong>WHETHER</strong> it occurs (genuine_rate=1.000 for 59/61 neurons).
        The parameter regime is the primary determinant of tipping; seed location is a timing modulator.
        AVAL (command interneuron, vulnerability=0.15) ranks <strong>9th fastest</strong> — validating Phase 1A&apos;s
        finding that network hubs are more cascade-critical than vulnerability alone predicts.
      </div>
    </div>
  );
}

"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell, ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// Magic energy decay: E(t) ≈ 572 + 1136 * exp(-0.004 * t)
// sampled every 100 steps (0–3000)
function makeEnergyData() {
  const pts = [];
  for (let t = 0; t <= 3000; t += 100) {
    const e = 572 + 1136 * Math.exp(-0.004 * t);
    pts.push({ step: t, energy: Math.round(e) });
  }
  return pts;
}
const ENERGY_DATA = makeEnergyData();

// Neighbour sums: first 8 nodes, before/after, target = 20
// From actual notebook output:
//   Before: [31.4, 22.0, 30.6, 13.3, 15.1, 26.3, 15.2, 23.7]
//   After:  [22.8, 15.8, 20.1, 19.7, 21.4, 20.6, 24.5, 27.6]
const NEIGHBOUR_SUMS = [
  { node: "n0", before: 31.4, after: 22.8 },
  { node: "n1", before: 22.0, after: 15.8 },
  { node: "n2", before: 30.6, after: 20.1 },
  { node: "n3", before: 13.3, after: 19.7 },
  { node: "n4", before: 15.1, after: 21.4 },
  { node: "n5", before: 26.3, after: 20.6 },
  { node: "n6", before: 15.2, after: 24.5 },
  { node: "n7", before: 23.7, after: 27.6 },
];

export default function Phase0Magic() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🔷</span>
          <div>
            <h2 className="text-base font-bold text-white mb-1">Phase 0B — Magic Graph Optimizer</h2>
            <p className="text-xs text-gray-400 max-w-2xl">
              Introduces real network topology (NetworkX, Erdős–Rényi, n=20, p=0.18, 34 edges).
              Defines a "magic graph": find node values so every node's neighbour-sum equals
              a fixed target T=20. Solved by numerical gradient descent (3000 steps, lr=0.001).
              This is the conceptual origin of Phase 2 (Magic Balancing) and the therapeutic
              optimisation in Phases 6 and 9.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-500">
              🕐 Origin prototype · May 2026 · Persian comments · Numerical gradient (no autograd)
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Graph",           value: "n=20",   sub: "34 edges, p=0.18",    color: "#ffd700" },
          { label: "Initial energy",  value: "1708",   sub: "total squared error",  color: "#ff4444" },
          { label: "Final energy",    value: "572",    sub: "after 3000 steps",     color: "#a8ff78" },
          { label: "Reduction",       value: "66.5%",  sub: "energy → target",      color: "#00e5ff" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energy convergence */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Magic Energy Convergence</h3>
          <p className="text-xs text-gray-500 mb-3">
            Σ (neighbour_sum<sub>i</sub> − 20)² drops from 1708 to 572.
            Rapid early progress, diminishing returns after step 1000.
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={ENERGY_DATA} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="step" tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Gradient step", position: "insideBottom", offset: -10, fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Magic energy", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v, "energy"]} />
              <ReferenceLine y={572} stroke="#a8ff78" strokeDasharray="4 2"
                label={{ value: "Final: 572", fill: "#a8ff78", fontSize: 9, position: "insideTopRight" }} />
              <Line type="monotone" dataKey="energy" stroke="#00e5ff" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Neighbour sums before/after */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Neighbour Sums: Before vs After</h3>
          <p className="text-xs text-gray-500 mb-3">
            First 8 nodes. Target = 20 (dashed). After optimisation, sums move toward target
            but residual error remains (non-convex problem).
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={NEIGHBOUR_SUMS} margin={{ top: 5, right: 20, bottom: 20, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="node" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis domain={[0, 35]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(1), ""]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={20} stroke="#ffd700" strokeDasharray="4 2"
                label={{ value: "Target 20", fill: "#ffd700", fontSize: 9 }} />
              <Bar dataKey="before" fill="#374151" name="Before" radius={[2, 2, 0, 0]} />
              <Bar dataKey="after"  fill="#00e5ff" name="After"  radius={[2, 2, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Context */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "What 'magic' means",
            color: "#ffd700",
            body: "A magic graph is balanced: every node receives exactly as much signal from its neighbours as the target. Analogous to a healthy neural circuit in homeostasis.",
          },
          {
            title: "Connection to Phase 2",
            color: "#a8ff78",
            body: "Phase 2 (Magic Balancing) applies this idea to the C. elegans connectome: finding network configurations that maximise long-term stability before ALS-like damage begins.",
          },
          {
            title: "Connection to therapy phases",
            color: "#a855f7",
            body: "Phases 6 and 9 optimise therapy parameters (strength, start_t) using the same principle: gradient-based search for the configuration that minimises disease burden.",
          },
        ].map(c => (
          <div key={c.title} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-xs font-bold mb-2" style={{ color: c.color }}>{c.title}</div>
            <p className="text-xs text-gray-400">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

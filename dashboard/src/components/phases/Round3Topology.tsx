"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

const TOPO_DATA = [
  { name: "C. elegans",  short: "C.eleg", v2: 1.000, v1: 1.000, coh: 0.668, rank_ce: 1.000, seed_dom: 1.000, spread_dom: 1.000, color: "#00e5ff" },
  { name: "Deg.Shuffled", short: "Shuffled", v2: 0.895, v1: 0.730, coh: 0.466, rank_ce: 0.823, seed_dom: 1.000, spread_dom: 0.000, color: "#a8ff78" },
  { name: "Watts-Strogatz",short: "WS",     v2: 0.870, v1: 0.780, coh: 0.520, rank_ce: 0.497, seed_dom: 1.000, spread_dom: 0.050, color: "#ffd700" },
  { name: "Erdos-Renyi",  short: "ER",      v2: 0.700, v1: 0.480, coh: 0.396, rank_ce: 0.399, seed_dom: 1.000, spread_dom: 0.000, color: "#fb923c" },
  { name: "Barabasi-Albert",short: "BA",    v2: 0.105, v1: 0.000, coh: 0.073, rank_ce: 0.020, seed_dom: 1.000, spread_dom: 0.000, color: "#ff4444" },
];

// Mechanism isolation: ISR-dom vs TSSE-dom
const MECH_ISOLATION = TOPO_DATA.map(d => ({
  name: d.short,
  seeding: d.seed_dom,
  spread: d.spread_dom,
  color: d.color,
}));

export default function Round3Topology() {
  const v2Range = (1.000 - 0.105).toFixed(3);
  const v1Range = (1.000 - 0.000).toFixed(3);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "v2.0 range (BA→CE)",    value: v2Range,   sub: "weaker than v1.0 (1.000)", color: "#f97316" },
          { label: "BA genuine rate (v2.0)", value: "10.5%",   sub: "vs 0% in v1.0",           color: "#ff4444" },
          { label: "Seeding-dom (all topos)", value: "100%",   sub: "ISR-dominant: ALL tip",    color: "#a8ff78" },
          { label: "Spread-dom (CE only)",   value: "1.000",   sub: "TSSE-dominant: others 0",  color: "#00e5ff" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* v1 vs v2 genuine rate */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Genuine Tipping Rate — v1.0 vs v2.0
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            v1.0 = coupled aggAmp (Phase 7C) · v2.0 = decoupled ISR+TSSE, medium context (ISR=TSSE=2)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={TOPO_DATA}
              margin={{ top: 5, right: 15, bottom: 40, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="short"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any, name: any) => [
                  `${(v * 100).toFixed(1)}%`, name === "v2" ? "v2.0 (decoupled)" : "v1.0 (coupled)",
                ]} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(v) => v === "v2" ? "v2.0 Decoupled (R3.5)" : "v1.0 Coupled (7C)"} />
              <Bar dataKey="v1" fill="#374151" radius={[2, 2, 0, 0]} name="v1" />
              <Bar dataKey="v2" radius={[2, 2, 0, 0]} name="v2">
                {TOPO_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mechanism isolation */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Mechanism Isolation — ISR-dominant vs TSSE-dominant
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            ISR-dom: ISR=5.0, TSSE=0.5 · TSSE-dom: ISR=0.5, TSSE=5.0
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MECH_ISOLATION}
              margin={{ top: 5, right: 15, bottom: 40, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any, name: any) => [
                  `${(v * 100).toFixed(1)}%`,
                  name === "seeding" ? "ISR-dominant (seeding)" : "TSSE-dominant (spread)",
                ]} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(v) => v === "seeding" ? "ISR-dominant (all topologies)" : "TSSE-dominant (C.eleg. only)"} />
              <Bar dataKey="seeding" fill="#a8ff78" radius={[2, 2, 0, 0]} name="seeding" />
              <Bar dataKey="spread"  fill="#a855f7" radius={[2, 2, 0, 0]} name="spread"  />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full results table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Full Results Table</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-3 text-gray-400">Topology</th>
              <th className="text-center py-2 px-2 text-gray-400">v2.0 genuine</th>
              <th className="text-center py-2 px-2 text-gray-400">v1.0 genuine</th>
              <th className="text-center py-2 px-2 text-gray-400">Delta</th>
              <th className="text-center py-2 px-2 text-gray-400">Coh r</th>
              <th className="text-center py-2 px-2 text-gray-400">Rank pres. (CE)</th>
              <th className="text-center py-2 px-2 text-gray-400">Seed-dom</th>
              <th className="text-center py-2 px-2 text-gray-400">Spread-dom</th>
            </tr>
          </thead>
          <tbody>
            {TOPO_DATA.map((d, i) => {
              const delta = d.v2 - d.v1;
              return (
                <tr key={i} className={`border-b border-gray-800 ${i % 2 ? "bg-gray-800 bg-opacity-20" : ""}`}>
                  <td className="py-2 pr-3 font-semibold" style={{ color: d.color }}>{d.name}</td>
                  <td className="text-center py-2 px-2 font-mono font-bold" style={{ color: d.color }}>
                    {(d.v2 * 100).toFixed(1)}%
                  </td>
                  <td className="text-center py-2 px-2 font-mono text-gray-400">
                    {(d.v1 * 100).toFixed(1)}%
                  </td>
                  <td className="text-center py-2 px-2 font-mono" style={{ color: delta >= 0 ? "#a8ff78" : "#ff4444" }}>
                    {delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}pp
                  </td>
                  <td className="text-center py-2 px-2 font-mono text-gray-300">{d.coh.toFixed(3)}</td>
                  <td className="text-center py-2 px-2 font-mono text-gray-300">{d.rank_ce.toFixed(3)}</td>
                  <td className="text-center py-2 px-2 font-mono text-green-400">{(d.seed_dom * 100).toFixed(0)}%</td>
                  <td className="text-center py-2 px-2 font-mono" style={{ color: d.spread_dom > 0 ? "#a855f7" : "#374151" }}>
                    {(d.spread_dom * 100).toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-2">
          v2.0: 20 instances × 10 configs × 10 seeds = 2000 runs per topology. v1.0: 10 instances × 10 configs × 3 seeds.
        </p>
      </div>

      {/* Key insight box */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Why TSSE is Topology-Sensitive but ISR is Not</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="font-bold text-green-300 mb-1">ISR (intracellular seeding) — topology-invariant</div>
            <p className="text-gray-300">ISR is intrinsic to each neuron — it grows aggregation proportional to the
            neuron&apos;s own vulnerability, independent of which edges exist. Seeding a neuron in a BA graph
            causes the same per-neuron cascade as in C. elegans. All 5 topologies: 100% genuine at
            ISR=5.0, TSSE=0.5.</p>
          </div>
          <div className="p-3 bg-purple-950 border border-purple-800 rounded-lg">
            <div className="font-bold text-purple-300 mb-1">TSSE (trans-synaptic spread) — topology-sensitive</div>
            <p className="text-gray-300">TSSE routes aggregation spread along edges. BA&apos;s hub structure sends spread
            through high-degree (not necessarily high-vulnerability) neurons, destroying the vulnerability-ordered
            death sequence. Coherence r collapses to 0.073 on BA — below the C2 criterion (0.30).
            Only C. elegans: 100% genuine at ISR=0.5, TSSE=5.0.</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) v2.0 topology sensitivity is slightly weaker than v1.0 (range 0.895 vs 1.0) —
        the medium ISR=TSSE=2 context gives ISR a baseline contribution that partially compensates for topology-disrupted spread.
        (2) 20 synthetic instances per type — still shows high variance for ER (std=0.210).
        (3) Rank preservation (CE) measures ordering similarity, not dynamic equivalence.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.5):</strong> <strong>TSSE (trans-synaptic spread) is the topology-sensitive mechanism.</strong>{" "}
        Under ISR-dominant conditions, ALL 5 topologies achieve 100% genuine tipping.
        Under TSSE-dominant conditions, only C. elegans tips — ER, BA, WS, and shuffled all fail.
        BA&apos;s Barabasi-Albert hub structure is specifically incompatible with vulnerability-ordered spreading.
        The C. elegans wiring is not merely permissive: it is specifically tuned for spatially coherent spread.
      </div>
    </div>
  );
}

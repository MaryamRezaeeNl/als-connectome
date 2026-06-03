"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";

const TOPOLOGIES = [
  { name: "Sparse chain",  short: "sparse",      res: 0.815, genuine: 1.0,  plateau: 13.4, tier2: 231, color: "#00e5ff" },
  { name: "Distributed",   short: "distributed", res: 0.803, genuine: 1.0,  plateau: 12.8, tier2: 228, color: "#a8ff78" },
  { name: "Baseline",      short: "baseline",    res: 0.800, genuine: 1.0,  plateau: 12.3, tier2: 225, color: "#ffd700" },
  { name: "Anti-hub",      short: "anti-hub",    res: 0.800, genuine: 1.0,  plateau: 12.1, tier2: 225, color: "#ffd700" },
  { name: "Modular",       short: "modular",     res: 0.799, genuine: 0.8,  plateau: 12.0, tier2: 224, color: "#a8cc78" },
  { name: "Bypass loops",  short: "bypass",      res: 0.796, genuine: 1.0,  plateau: 11.8, tier2: 222, color: "#f59e0b" },
  { name: "Hierarchical",  short: "hier.",       res: 0.790, genuine: 1.0,  plateau: 11.3, tier2: 220, color: "#fb923c" },
  { name: "Rich club",     short: "rich-club",   res: 0.787, genuine: 1.0,  plateau: 10.8, tier2: 218, color: "#f87171" },
  { name: "Triangle rich", short: "triangle",    res: 0.738, genuine: 1.0,  plateau:  8.7, tier2: 222, color: "#ff4444" },
];

const RES_DATA = TOPOLOGIES.map(t => ({ name: t.short, RES: t.res, color: t.color }));
const PLATEAU_DATA = TOPOLOGIES.map(t => ({ name: t.short, plateau: t.plateau, color: t.color }));

export default function Round2Motif() {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Best topology",     value: "Sparse chain", sub: "RES = 0.815",  color: "#00e5ff" },
          { label: "Worst topology",    value: "Triangle rich",sub: "RES = 0.738",  color: "#ff4444" },
          { label: "Resilience range",  value: "0.077",        sub: "sparse vs tri",color: "#ffd700" },
          { label: "Therapy escape",    value: "0 / 9",        sub: "all preventable",color: "#a8ff78" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RES score bar */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Resilience Score by Topology</h3>
          <p className="text-xs text-gray-500 mb-3">
            RES = weighted combination of genuine tipping rate, Tier-2 delay, and plateau survivors
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={RES_DATA} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" horizontal={false} />
              <XAxis type="number" domain={[0.70, 0.84]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="name" width={68} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(3), "RES"]}
              />
              <Bar dataKey="RES" radius={[0, 3, 3, 0]}>
                {RES_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Plateau survivors bar */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Mean Plateau Survivors by Topology</h3>
          <p className="text-xs text-gray-500 mb-3">
            Neurons alive at t=300 (baseline, no therapy) — lower feedback loops = more survivors
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={PLATEAU_DATA} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" horizontal={false} />
              <XAxis type="number" domain={[0, 16]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="name" width={68} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(1), "survivors"]}
              />
              <Bar dataKey="plateau" radius={[0, 3, 3, 0]}>
                {PLATEAU_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Topology comparison table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Full Topology Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-400">
            <thead>
              <tr className="border-b border-gray-700 text-gray-500">
                <th className="text-left py-2 pr-4">Topology</th>
                <th className="text-right py-2 pr-4">RES</th>
                <th className="text-right py-2 pr-4">Genuine rate</th>
                <th className="text-right py-2 pr-4">Plateau survivors</th>
                <th className="text-right py-2">Tier-2 activation</th>
              </tr>
            </thead>
            <tbody>
              {TOPOLOGIES.map(t => (
                <tr key={t.name} className="border-b border-gray-800">
                  <td className="py-1.5 pr-4 font-medium" style={{ color: t.color }}>{t.name}</td>
                  <td className="text-right pr-4 font-mono text-gray-200">{t.res.toFixed(3)}</td>
                  <td className="text-right pr-4 font-mono">{(t.genuine * 100).toFixed(0)}%</td>
                  <td className="text-right pr-4 font-mono">{t.plateau.toFixed(1)}</td>
                  <td className="text-right font-mono">step {t.tier2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Finding */}
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding:</strong> Sparse chain topology is the most resilient (RES=0.815) because
        fewer redundant spreading paths slow the prion-like cascade. Triangle-rich feedback loops (RES=0.738)
        accelerate Tier-2 activation and reduce plateau survivors by 35% vs sparse chain.
        All topologies remain 100% preventable with aggregation suppression therapy.
      </div>
    </div>
  );
}




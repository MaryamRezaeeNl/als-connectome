"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// Causal power table: shift (steps) per mechanism per regime
const CAUSAL_DATA = [
  { mechanism: "ISR (seeding)",   r1: 179, r2:   4, r3:  64, role: "load_bearing" },
  { mechanism: "TSSE (spread)",   r1:  22, r2: 247, r3:  33, role: "load_bearing" },
  { mechanism: "Mitochondria",    r1:   3, r2:   0, r3:  61, role: "conditional"  },
  { mechanism: "Glutamate",       r1:   0, r2:  -2, r3:  18, role: "negligible"   },
  { mechanism: "Ca²⁺ / ROS",     r1:   0, r2:  -2, r3:  18, role: "negligible"   },
  { mechanism: "Irreversibility", r1:   0, r2:  -2, r3:   4, role: "negligible"   },
];

const REGIME_COLORS = {
  r1: "#00e5ff",  // seeding-dominant — cyan
  r2: "#a855f7",  // spread-dominant — purple
  r3: "#ff9944",  // downstream-stressed — orange
};

// Effect size coding for the table
function effectBadge(shift: number) {
  const abs = Math.abs(shift);
  if (abs > 50) return { label: "large",  color: "#dc2626" };
  if (abs > 20) return { label: "medium", color: "#f97316" };
  return { label: "small",   color: "#6b7280" };
}

// Summary KPIs
const ABLATION_SUMMARY = [
  { label: "Mechanisms tested",    value: "6",       color: "#00e5ff" },
  { label: "Load-bearing (always)", value: "2",      color: "#a8ff78", note: "ISR + TSSE" },
  { label: "Conditional (stressed)", value: "1",     color: "#ffd700", note: "Mitochondria" },
  { label: "Negligible (all regimes)", value: "3",   color: "#6b7280", note: "Glut / Ca / Irrev" },
];

export default function Round3Downstream() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ABLATION_SUMMARY.map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            {s.note && <div className="text-xs font-mono text-gray-300">{s.note}</div>}
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Grouped bar chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          First-Death Shift by Mechanism Ablation and Regime
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Positive = ablating the mechanism delays cascade onset (mechanism was accelerating death).
          Regimes: R1=seeding-dominant, R2=spread-dominant, R3=downstream-stressed.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={CAUSAL_DATA} margin={{ top: 5, right: 20, bottom: 60, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis dataKey="mechanism"
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }}
              label={{ value: "shift (steps)", angle: -90, position: "insideLeft",
                fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
              formatter={(v: any, name: any) => [
                `${v > 0 ? "+" : ""}${v} steps`,
                name === "r1" ? "R1 Seeding-dom" : name === "r2" ? "R2 Spread-dom" : "R3 Stressed",
              ]} />
            <Legend
              formatter={(v) => v === "r1" ? "R1: Seeding-dominant" : v === "r2" ? "R2: Spread-dominant" : "R3: Downstream-stressed"}
              wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={50} stroke="#374151" strokeDasharray="3 3"
              label={{ value: "large (>50)", fill: "#6b7280", fontSize: 9 }} />
            <ReferenceLine y={20} stroke="#1f2937" strokeDasharray="3 3"
              label={{ value: "medium (>20)", fill: "#6b7280", fontSize: 9 }} />
            <Bar dataKey="r1" fill={REGIME_COLORS.r1} radius={[2, 2, 0, 0]} name="r1" />
            <Bar dataKey="r2" fill={REGIME_COLORS.r2} radius={[2, 2, 0, 0]} name="r2" />
            <Bar dataKey="r3" fill={REGIME_COLORS.r3} radius={[2, 2, 0, 0]} name="r3" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Causal power table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Causal Power Table — Shift (steps)</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-4 text-gray-400 font-medium">Mechanism</th>
              <th className="text-center py-2 px-3 text-cyan-400">R1 Seeding-dom</th>
              <th className="text-center py-2 px-3 text-purple-400">R2 Spread-dom</th>
              <th className="text-center py-2 px-3 text-orange-400">R3 Stressed</th>
              <th className="text-left py-2 pl-3 text-gray-400">Role</th>
            </tr>
          </thead>
          <tbody>
            {CAUSAL_DATA.map((row, i) => {
              const roleColor =
                row.role === "load_bearing"  ? "#a8ff78" :
                row.role === "conditional"   ? "#ffd700" : "#6b7280";
              return (
                <tr key={i} className={`border-b border-gray-800 ${i % 2 === 0 ? "" : "bg-gray-800 bg-opacity-30"}`}>
                  <td className="py-2 pr-4 text-gray-200 font-medium">{row.mechanism}</td>
                  {[row.r1, row.r2, row.r3].map((v, j) => {
                    const e = effectBadge(v);
                    return (
                      <td key={j} className="text-center py-2 px-3">
                        <span className="font-mono font-semibold" style={{ color: e.color }}>
                          {v > 0 ? "+" : ""}{v}
                        </span>
                        <span className="ml-1 text-gray-600">{e.label}</span>
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 font-semibold" style={{ color: roleColor }}>
                    {row.role.replace("_", " ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-2">
          Effect sizes: large = shift &gt;50 OR gain &gt;10 OR rate_drop &gt;0.30 · medium = &gt;20/5/0.10 · small = otherwise
        </p>
      </div>

      {/* Regime definitions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            label: "R1: Seeding-dominant",
            color: REGIME_COLORS.r1,
            desc: "High ISR (2–10), moderate TSSE (0.5–2.0). Aggregation seeding drives cascade. ISR ablation = large effect; TSSE ablation = small.",
          },
          {
            label: "R2: Spread-dominant",
            color: REGIME_COLORS.r2,
            desc: "Low ISR (0.05–0.5), high TSSE (2–10). Trans-synaptic spread drives cascade. TSSE ablation = large effect; ISR ablation = small.",
          },
          {
            label: "R3: Downstream-stressed",
            color: REGIME_COLORS.r3,
            desc: "Moderate ISR/TSSE + elevated mitFrag (4–8), glutSens, calcGain. Mitochondria becomes load-bearing (shift=+61).",
          },
        ].map(r => (
          <div key={r.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-xs font-bold mb-1" style={{ color: r.color }}>{r.label}</div>
            <p className="text-xs text-gray-400">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) Ablation tests one mechanism at a time — interaction effects not captured.
        (2) &ldquo;Downstream-stressed&rdquo; regime uses mitFrag values (4–8) well above the v1.0 baseline (1.0).
        (3) Glutamate and Ca²⁺ are co-identical in effect because their parameters couple in the current model.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.2):</strong> Mitochondria can become <strong>load-bearing only under extreme stress</strong>{" "}
        (mitFrag ≥ 4 in the downstream-stressed regime). Glutamate, calcium, and irreversibility remain negligible
        across all regimes. The cascade has <strong>multiple entry points</strong> but only under biologically
        extreme conditions. ISR and TSSE are the sole universally load-bearing mechanisms.
      </div>
    </div>
  );
}

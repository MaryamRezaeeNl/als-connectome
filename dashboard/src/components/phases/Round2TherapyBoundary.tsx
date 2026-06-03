"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

// Therapy boundary: max_start_t = slope * strength + intercept
const BOUNDARIES = [
  { name: "Baseline",          slope: 175, intercept: -62.5, r2: 0.942, area: 17, color: "#ffd700" },
  { name: "Sparse chain",      slope: 175, intercept: -62.5, r2: 0.942, area: 17, color: "#00e5ff" },
  { name: "Triangle rich 60%", slope: 225, intercept: -102,  r2: 0.920, area: 16, color: "#a8ff78" },
  { name: "Triangle rich 100%",slope: 175, intercept: -72,   r2: 0.817, area: 15, color: "#ff4444" },
];

// Reference from Phase 9/10 aggregate (top configs)
const REF_SLOPE = 252, REF_INTERCEPT = -107;

// Build line data: strength 0.1 to 0.9
const STRENGTHS = [0.40, 0.50, 0.60, 0.70, 0.80, 0.90];
const boundaryLineData = STRENGTHS.map(s => {
  const pt: Record<string, number | string> = { strength: s };
  BOUNDARIES.forEach(b => {
    pt[b.name] = Math.max(0, b.slope * s + b.intercept);
  });
  pt["Phase 9/10 ref"] = Math.max(0, REF_SLOPE * s + REF_INTERCEPT);
  return pt;
});

// Window area bar data
const windowAreaData = BOUNDARIES.map(b => ({ name: b.name, area: b.area, color: b.color }));

// Grid preview data: 9×9 outcome grid for each topology (simplified)
// prevention=green, mixed=yellow, ineffective=red
function gridCell(s: number, t: number, slope: number, intercept: number): "P" | "M" | "I" {
  const maxT = slope * s + intercept;
  if (t <= maxT - 25) return "P";
  if (t <= maxT + 10) return "M";
  return "I";
}

const GRID_STRENGTHS = [0.5, 0.6, 0.7, 0.8, 0.9];
const GRID_STARTS    = [0, 25, 50, 75, 100, 125, 150, 175, 200];
const CELL_COLOR = { P: "#a8ff78", M: "#ffd700", I: "#374151" };
const CELL_LABEL = { P: "P", M: "M", I: "—" };

export default function Round2TherapyBoundary() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Max start_t (str=0.80)", value: "t=75",   sub: "all topologies",     color: "#ffd700" },
          { label: "Widest window",          value: "Area 17", sub: "Baseline = Sparse",  color: "#00e5ff" },
          { label: "Narrowest window",       value: "Area 15", sub: "Triangle rich 100%", color: "#ff4444" },
          { label: "Ph.9/10 ref slope",      value: "252",     sub: "R²=0.98 (config #334)", color: "#a855f7" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Boundary lines */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Therapeutic Boundary: max_start_t vs Strength
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Above the line = prevention possible; below = too late. Dashed = Phase 9/10 reference.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={boundaryLineData} margin={{ top: 5, right: 20, bottom: 20, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="strength" tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Therapy strength", position: "insideBottom", offset: -10, fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Max start_t", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }}
                formatter={(v: any) => [Math.round(v), "max start_t"]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {BOUNDARIES.map(b => (
                <Line key={b.name} type="linear" dataKey={b.name}
                  stroke={b.color} dot={false} strokeWidth={2} />
              ))}
              <Line type="linear" dataKey="Phase 9/10 ref" stroke="#6b7280"
                dot={false} strokeWidth={1.5} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Window area bar */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Preventive Window Area (grid cells)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Number of (strength, start_t) grid cells achieving prevention — topology range is only 2 cells
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={windowAreaData} margin={{ top: 5, right: 20, bottom: 40, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-15} textAnchor="end" />
              <YAxis domain={[12, 18]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }} />
              <ReferenceLine y={17} stroke="#ffd700" strokeDasharray="3 3"
                label={{ value: "Baseline", fill: "#ffd700", fontSize: 9, position: "insideTopRight" }} />
              <Bar dataKey="area" radius={[3, 3, 0, 0]}>
                {windowAreaData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outcome grid for baseline */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">Prevention Grid — Baseline vs Triangle Rich 100%</h3>
        <p className="text-xs text-gray-500 mb-3">
          <span className="text-green-400">P</span> = Prevention &nbsp;
          <span className="text-yellow-400">M</span> = Mixed &nbsp;
          <span className="text-gray-500">—</span> = Ineffective
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[BOUNDARIES[0], BOUNDARIES[3]].map(b => (
            <div key={b.name}>
              <p className="text-xs font-semibold mb-2" style={{ color: b.color }}>{b.name}</p>
              <div className="overflow-x-auto">
                <table className="text-xs font-mono border-collapse">
                  <thead>
                    <tr>
                      <th className="text-gray-500 text-right pr-2">str\t</th>
                      {GRID_STARTS.map(t => (
                        <th key={t} className="w-8 text-center text-gray-500">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {GRID_STRENGTHS.map(s => (
                      <tr key={s}>
                        <td className="text-gray-400 text-right pr-2">{s.toFixed(1)}</td>
                        {GRID_STARTS.map(t => {
                          const cell = gridCell(s, t, b.slope, b.intercept);
                          return (
                            <td key={t} className="w-8 h-6 text-center font-bold"
                              style={{ color: CELL_COLOR[cell], background: cell === "P" ? "rgba(168,255,120,0.08)" : "transparent" }}>
                              {CELL_LABEL[cell]}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Boundary equations */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Boundary Equations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BOUNDARIES.map(b => (
            <div key={b.name} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
              <div>
                <span className="text-xs font-semibold text-gray-200">{b.name}</span>
                <span className="ml-2 font-mono text-xs" style={{ color: b.color }}>
                  max_t = {b.slope}×str{b.intercept >= 0 ? "+" : ""}{b.intercept}
                </span>
                <span className="ml-2 text-xs text-gray-500">R²={b.r2}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding:</strong> Topology modifications do <strong>not</strong> widen the therapeutic window timing —
        all variants converge to max_start_t≈75 at strength=0.80. Triangle-rich 60% provides slightly higher
        slope (225 vs 175) but the same peak start time. Connectivity structure alters cascade dynamics
        but cannot substitute for earlier therapy initiation.
      </div>
    </div>
  );
}




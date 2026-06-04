"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const MITFRAG_VALS = [0.3, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0];

// Cell states per context
const LOW_STATES    = ["TAKEOVER","transit.","transit.","seeding","transit.","transit.","TAKEOVER","TAKEOVER","TAKEOVER","TAKEOVER"];
const MEDIUM_STATES = ["seeding","seeding","seeding","seeding","seeding","seeding","seeding","seeding","seeding","transit."];
const HIGH_STATES   = Array(10).fill("seeding");

function cellColor(state: string) {
  if (state === "TAKEOVER") return { bg: "#7f1d1d", text: "#fca5a5", border: "#dc2626" };
  if (state === "transit.")  return { bg: "#713f12", text: "#fde68a", border: "#f59e0b" };
  return { bg: "#172554",   text: "#93c5fd", border: "#1d4ed8" };
}

// Shift data for the line chart (low context only — the only one with a signal)
const SHIFT_DATA = MITFRAG_VALS.map((mf, i) => ({
  mitFrag: mf,
  low:    [10.2, 20.0, 1.7, 13.9, 27.2, 42.1, 64.9, 67.9, 92.7, 121.6][i],
  medium: [ -0.5,  0.5, 2.2,  2.7,  0.8,  9.3,  9.1, 15.0, 16.3,  23.7][i],
  high:   [ -0.3,  0.1, 0.1, -0.1,  0.1, -0.4, -0.2,  0.2,  0.1,   0.5][i],
}));

export default function Round3MitoThreshold() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Near-takeover onset",        value: "mitFrag=4.0",  sub: "low context (2/3 criteria)",  color: "#dc2626" },
          { label: "Low ctx threshold",           value: "4.0",          sub: "shift & gain both pass",      color: "#f97316" },
          { label: "Medium ctx threshold",        value: "> 8.0",        sub: "not reached",                 color: "#6b7280" },
          { label: "High ctx threshold",          value: "> 8.0",        sub: "aggregation saturates mito",  color: "#6b7280" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heat table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          Cell State Heat Map — 3 Contexts × 10 mitFrag Levels
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Classification: <span className="text-red-400">TAKEOVER</span> = large effect (shift&gt;50 OR gain&gt;10 OR rdrop&gt;0.30) ·{" "}
          <span className="text-yellow-400">transit.</span> = medium · <span className="text-blue-400">seeding</span> = dominant mechanism
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-3 text-gray-400">Context</th>
              {MITFRAG_VALS.map(v => (
                <th key={v} className="text-center py-2 px-1 text-gray-400 font-mono">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Low (ISR=0.5, TSSE=0.5)",    states: LOW_STATES },
              { label: "Medium (ISR=2.0, TSSE=2.0)", states: MEDIUM_STATES },
              { label: "High (ISR=5.0, TSSE=5.0)",   states: HIGH_STATES },
            ].map(ctx => (
              <tr key={ctx.label} className="border-b border-gray-800">
                <td className="py-2 pr-3 text-gray-300 whitespace-nowrap font-medium">{ctx.label}</td>
                {ctx.states.map((state, ci) => {
                  const c = cellColor(state);
                  return (
                    <td key={ci} className="text-center py-1.5 px-1">
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                        {state}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Shift line chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          First-Death Shift vs mitFrag — by Aggregation Context (16B, n=15)
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Positive shift = removing mitochondrial fragility <em>delays</em> death onset (mito was accelerating it).
        </p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={SHIFT_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis dataKey="mitFrag" tick={{ fontSize: 10, fill: "#9ca3af" }}
              label={{ value: "mitFrag", position: "insideBottom", offset: -2, fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }}
              label={{ value: "shift (steps)", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
              formatter={(v: any, name: any) => [
                `${v > 0 ? "+" : ""}${v} steps`,
                name === "low" ? "Low context" : name === "medium" ? "Medium context" : "High context",
              ]} />
            <Legend formatter={(v) => v === "low" ? "Low (ISR=0.5, TSSE=0.5)" : v === "medium" ? "Medium (ISR=2.0, TSSE=2.0)" : "High (ISR=5.0, TSSE=5.0)"}
              wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={4.0} stroke="#dc2626" strokeDasharray="4 2"
              label={{ value: "threshold", fill: "#dc2626", fontSize: 9, position: "top" }} />
            <ReferenceLine y={50} stroke="#374151" strokeDasharray="3 3"
              label={{ value: "large (50)", fill: "#6b7280", fontSize: 9, position: "right" }} />
            <Line type="monotone" dataKey="low"    stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="medium" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="high"   stroke="#6b7280" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Mechanistic explanation */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Why High Aggregation Suppresses Mitochondrial Takeover</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {[
            {
              title: "Low context (ISR=0.5, TSSE=0.5)",
              color: "#f97316",
              text: "Aggregation is slow. Mitochondrial fragility becomes the dominant driver of ATP depletion at high mitFrag. Near-takeover onset at mitFrag=4.0 — shift and gain criteria both pass.",
            },
            {
              title: "Medium context (ISR=2.0, TSSE=2.0)",
              color: "#a855f7",
              text: "Aggregation-driven ATP depletion already saturates the mito→ATP pathway. High mitFrag adds marginal damage on top of an already-depleted ATP pool. Barely transitional at mitFrag=8.",
            },
            {
              title: "High context (ISR=5.0, TSSE=5.0)",
              color: "#6b7280",
              text: "Aggregation completely dominates ATP suppression. Mitochondrial fragility has near-zero independent effect across all tested values. The pathway is fully captured by ISR/TSSE.",
            },
          ].map(c => (
            <div key={c.title} className="p-3 bg-gray-800 rounded-lg">
              <div className="font-semibold mb-1" style={{ color: c.color }}>{c.title}</div>
              <p className="text-gray-400">{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) n=15 seeds per cell — noisy, especially for genuine_rate_drop.
        (2) &ldquo;Transitional&rdquo; classification at low mitFrag values (0.3, 0.5) in low context is stochastic noise.
        (3) The takeover at mitFrag=0.3 seen here was confirmed as artifact in R3.4 (n=50 seeds).
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.3):</strong> Mitochondrial near-takeover onset is at <strong>mitFrag=4.0</strong> in
        the low-aggregation context only. In medium and high contexts, the aggregation cascade saturates the
        mitochondrial pathway, making mitFrag parameter irrelevant as an independent driver.
        The apparent TAKEOVER at mitFrag=0.3 (n=15 seeds) was a single-criterion false positive — see R3.4.
      </div>
    </div>
  );
}

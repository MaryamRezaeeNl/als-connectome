"use client";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

// n=50 seeds, low context (ISR=0.5, TSSE=0.5)
const VALIDATION_DATA = [
  { mitFrag: 0.3, shift:   1, ci_lo:  -7, ci_hi:   9, label: "seeding_dominant",  gain:  0.9, rdrop: -0.060 },
  { mitFrag: 0.5, shift:   2, ci_lo:  -5, ci_hi:  10, label: "seeding_dominant",  gain:  1.7, rdrop:  0.000 },
  { mitFrag: 1.0, shift:  10, ci_lo:   3, ci_hi:  18, label: "seeding_dominant",  gain:  1.4, rdrop:  0.140 },
  { mitFrag: 2.0, shift:  28, ci_lo:  20, ci_hi:  36, label: "seeding_dominant",  gain:  3.0, rdrop: -0.140 },
  { mitFrag: 3.0, shift:  44, ci_lo:  36, ci_hi:  51, label: "seeding_dominant",  gain:  4.9, rdrop: -0.020 },
  { mitFrag: 4.0, shift:  66, ci_lo:  60, ci_hi:  72, label: "near_takeover",     gain:  7.9, rdrop: -0.040 },
  { mitFrag: 5.0, shift:  72, ci_lo:  63, ci_hi:  81, label: "near_takeover",     gain:  8.9, rdrop:  0.100 },
  { mitFrag: 6.0, shift:  88, ci_lo:  81, ci_hi:  95, label: "near_takeover",     gain:  9.6, rdrop:  0.160 },
  { mitFrag: 8.0, shift: 106, ci_lo:  98, ci_hi: 113, label: "near_takeover",     gain: 10.8, rdrop:  0.060 },
];

function stateColor(label: string) {
  if (label === "near_takeover")     return "#f97316";
  return "#3b82f6";
}

// Phase 16B vs 16C comparison at mitFrag=0.3
const COMPARISON_03 = [
  { phase: "R3.3 (n=15)", shift: 10.2, gain: 1.2, rdrop: 0.333, verdict: "FALSE POSITIVE" },
  { phase: "R3.4 (n=50)", shift:  1.0, gain: 0.9, rdrop: -0.060, verdict: "ARTIFACT" },
];

export default function Round3MitoValidation() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Validated threshold",     value: "mitFrag=4.0", sub: "2/3 strict criteria",      color: "#f97316" },
          { label: "R3.3 mitFrag=0.3 verdict", value: "ARTIFACT",   sub: "1/3 criteria at n=15",     color: "#dc2626" },
          { label: "Seeds per level",          value: "50",          sub: "vs 15 in R3.3",            color: "#00e5ff" },
          { label: "Bootstrap resamples",      value: "10,000",      sub: "percentile 95% CI",        color: "#a855f7" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Shift chart with CI bands */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          First-Death Shift vs mitFrag with 95% Bootstrap CI (n=50, low context)
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Shaded band = 95% CI from 10,000 bootstrap resamples.
          Blue = seeding-dominant (0/3 strict criteria); orange = near-takeover (2/3 criteria).
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={VALIDATION_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis dataKey="mitFrag" tick={{ fontSize: 10, fill: "#9ca3af" }}
              label={{ value: "mitFrag", position: "insideBottom", offset: -2, fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }}
              label={{ value: "shift (steps)", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
              formatter={(v: any, name: any) => {
                if (name === "shift") return [`${v > 0 ? "+" : ""}${v} steps`, "Mean shift"];
                if (name === "ci_hi") return [`${v > 0 ? "+" : ""}${v}`, "CI upper"];
                if (name === "ci_lo") return [`${v > 0 ? "+" : ""}${v}`, "CI lower"];
                return [v, name];
              }} />
            <ReferenceLine x={4.0} stroke="#f97316" strokeDasharray="4 2"
              label={{ value: "threshold", fill: "#f97316", fontSize: 9, position: "top" }} />
            <ReferenceLine y={50} stroke="#374151" strokeDasharray="3 3"
              label={{ value: "large (>50)", fill: "#6b7280", fontSize: 9, position: "right" }} />
            <ReferenceLine y={0}  stroke="#1f2937" />
            {/* CI band */}
            <Area type="monotone" dataKey="ci_hi" fill="#3b82f6" fillOpacity={0.12} stroke="none" legendType="none" />
            <Area type="monotone" dataKey="ci_lo" fill="#1d1d1d" fillOpacity={1} stroke="none" legendType="none" />
            {/* Mean line — colour per point done via gradient proxy */}
            <Line type="monotone" dataKey="shift" stroke="#00e5ff" strokeWidth={2.5}
              dot={(props: any) => {
                const d = VALIDATION_DATA[props.index];
                if (!d) return <circle key={props.index} cx={0} cy={0} r={0} />;
                return (
                  <circle key={props.index}
                    cx={props.cx} cy={props.cy} r={5}
                    fill={stateColor(d.label)} stroke="#111827" strokeWidth={1.5} />
                );
              }}
              activeDot={{ r: 7 }} name="shift" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: "#3b82f6" }} />
            <span className="text-gray-400">seeding_dominant (0/3 criteria)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: "#f97316" }} />
            <span className="text-gray-400">near_takeover (2/3 criteria — shift &amp; gain pass)</span>
          </div>
        </div>
      </div>

      {/* R3.3 vs R3.4 comparison at 0.3 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          R3.3 vs R3.4 Comparison at mitFrag=0.3 — Artifact Diagnosis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPARISON_03.map((row, i) => (
            <div key={i} className={`p-4 rounded-xl border ${
              i === 0 ? "border-red-800 bg-red-950 bg-opacity-30" : "border-green-800 bg-green-950 bg-opacity-20"
            }`}>
              <div className={`text-sm font-bold mb-2 ${i === 0 ? "text-red-300" : "text-green-300"}`}>
                {row.phase} — <span className={i === 0 ? "text-red-400" : "text-green-400"}>{row.verdict}</span>
              </div>
              <div className="space-y-1 text-xs">
                {[
                  { label: "shift > 50?", value: `${row.shift > 0 ? "+" : ""}${row.shift}`, pass: row.shift > 50 },
                  { label: "gain > 5?",   value: `+${row.gain}`,                            pass: row.gain > 5 },
                  { label: "rdrop > 0.20?", value: row.rdrop.toFixed(3),                    pass: row.rdrop > 0.20 },
                ].map(c => (
                  <div key={c.label} className="flex justify-between items-center p-1.5 bg-gray-900 bg-opacity-60 rounded">
                    <span className="text-gray-400">{c.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-200">{c.value}</span>
                      <span className={c.pass ? "text-green-400" : "text-red-400"}>
                        {c.pass ? "✓ PASS" : "✗ FAIL"}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="pt-1 text-center font-mono text-xs">
                  Criteria met:{" "}
                  <span className={i === 0 ? "text-red-400" : "text-green-400"} style={{ fontWeight: "bold" }}>
                    {[row.shift > 50, row.gain > 5, row.rdrop > 0.20].filter(Boolean).length}/3
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-gray-800 rounded text-xs text-gray-400">
          <strong className="text-gray-200">Root cause:</strong> At n=15 seeds with genuine_rate≈0.2–0.5 (near
          tipping boundary), genuine_rate_drop is dominated by stochastic variability. R3.3&apos;s
          rdrop=+0.333 at mitFrag=0.3 was a single-criterion artifact. With n=50, rdrop collapses
          to −0.060 (CI: −0.240 to +0.140) — consistent with zero.
        </div>
      </div>

      {/* Per-level summary table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Per-Level Results — n=50 Seeds</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-3 text-gray-400">mitFrag</th>
              <th className="text-center py-2 px-2 text-gray-400">Shift (95% CI)</th>
              <th className="text-center py-2 px-2 text-gray-400">Gain</th>
              <th className="text-center py-2 px-2 text-gray-400">rdrop</th>
              <th className="text-center py-2 px-2 text-gray-400">Criteria</th>
              <th className="text-left py-2 pl-2 text-gray-400">Label</th>
            </tr>
          </thead>
          <tbody>
            {VALIDATION_DATA.map((d, i) => {
              const sc = stateColor(d.label);
              const crit = [d.shift > 50, d.gain > 5, d.rdrop > 0.20];
              return (
                <tr key={i} className={`border-b border-gray-800 ${i % 2 ? "bg-gray-800 bg-opacity-20" : ""}`}>
                  <td className="py-1.5 pr-3 font-mono text-gray-200 font-bold">{d.mitFrag}</td>
                  <td className="text-center py-1.5 px-2 font-mono">
                    <span style={{ color: d.shift > 50 ? "#f97316" : "#9ca3af" }}>
                      {d.shift > 0 ? "+" : ""}{d.shift}
                    </span>
                    <span className="text-gray-600 text-xs ml-1">[{d.ci_lo},{d.ci_hi > 0 ? "+" : ""}{d.ci_hi}]</span>
                  </td>
                  <td className="text-center py-1.5 px-2 font-mono text-gray-300">+{d.gain}</td>
                  <td className="text-center py-1.5 px-2 font-mono text-gray-300">{d.rdrop.toFixed(3)}</td>
                  <td className="text-center py-1.5 px-2">
                    <span className="font-bold" style={{ color: sc }}>
                      {crit.filter(Boolean).length}/3
                    </span>
                  </td>
                  <td className="py-1.5 pl-2 text-xs" style={{ color: sc }}>
                    {d.label.replace(/_/g, " ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) Strict TAKEOVER (3/3 criteria) is never reached — the rdrop criterion
        is structurally constrained: genuine_rate ≈ 0.2–0.4 in this context, so rdrop &gt; 0.20 would require
        ablation genuine_rate ≤ 0, which is impossible. (2) &ldquo;Near-takeover&rdquo; is a weaker form of mito
        load-bearing — it accelerates death but does not gate the tipping event.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.4):</strong> The R3.3 mitFrag=0.3 takeover signal is a <strong>confirmed artifact</strong>.
        With n=50 seeds, mitFrag=0.3 satisfies 0/3 strict criteria (shift=+1, gain=+0.9, rdrop=−0.060).
        The validated near-takeover onset is <strong>mitFrag=4.0</strong> (2/3 criteria, tight bootstrap CIs:
        shift CI [+60, +72], gain CI [+6.7, +9.1] — both entirely above their thresholds).
      </div>
    </div>
  );
}

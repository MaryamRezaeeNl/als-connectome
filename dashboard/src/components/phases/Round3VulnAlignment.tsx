"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// ── Data ──────────────────────────────────────────────────────────────────────

const RESULTS = [
  { id: "BA-Orig",  topo: "BA",          vuln: "Original",       genuine: 0.000, coh: -0.265, ddc: 0.411, topoColor: "#ff4444", bar: "#ff4444" },
  { id: "BA-Deg",   topo: "BA",          vuln: "Degree-corr",    genuine: 0.800, coh:  0.371, ddc: 0.401, topoColor: "#ff4444", bar: "#ff9966" },
  { id: "BA-Inv",   topo: "BA",          vuln: "Inverse-degree", genuine: 0.000, coh: -0.326, ddc: 0.419, topoColor: "#ff4444", bar: "#cc2222" },
  { id: "CE-Orig",  topo: "C. elegans",  vuln: "Original",       genuine: 1.000, coh:  0.453, ddc: 0.289, topoColor: "#00e5ff", bar: "#00e5ff" },
  { id: "CE-Deg",   topo: "C. elegans",  vuln: "Degree-corr",    genuine: 0.000, coh:  0.278, ddc: 0.408, topoColor: "#00e5ff", bar: "#66f0ff" },
  { id: "CE-Inv",   topo: "C. elegans",  vuln: "Inverse-degree", genuine: 0.000, coh: -0.291, ddc: 0.482, topoColor: "#00e5ff", bar: "#0099aa" },
];

// Short x-axis labels
const CHART_DATA = RESULTS.map(d => ({
  ...d,
  short: d.id.replace("-Orig", "\nOrig").replace("-Deg", "\nDeg").replace("-Inv", "\nInv"),
  label: d.id,
}));

// Insight cards
const INSIGHTS = [
  {
    title: "BA rescued to 80%",
    desc: "Degree-correlated vulnerability rescues BA from 0% → 80% genuine tipping. Hubs now die early AND are high-vulnerability → coherence restored (r = +0.371).",
    color: "#ff9966",
    icon: "↑",
  },
  {
    title: "C. elegans destroyed",
    desc: "Same degree-correlated assignment destroys C. elegans: 1.000 → 0.000. AVAL (highest-degree, vuln=0.15 biologically) becomes most vulnerable, scrambling the death order.",
    color: "#00e5ff",
    icon: "↓",
  },
  {
    title: "Alignment is the mechanism",
    desc: "TSSE routes through hubs in all conditions (deg-death corr ≈ 0.41 for BA regardless). Coherence only emerges when hub-first death order matches the vulnerability gradient.",
    color: "#a855f7",
    icon: "⟺",
  },
];

export default function Round3VulnAlignment() {
  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "BA (original)",       value: "0%",   sub: "TSSE-dominant — R3.5 baseline",    color: "#ff4444" },
          { label: "BA (degree-corr)",    value: "80%",  sub: "hubs made most vulnerable",        color: "#ff9966" },
          { label: "CE (degree-corr)",    value: "0%",   sub: "same assignment destroys CE",      color: "#66f0ff" },
          { label: "Deg-death corr (BA)", value: "0.41", sub: "stable across all assignments",    color: "#a855f7" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {INSIGHTS.map(ins => (
          <div key={ins.title}
            className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: ins.color, color: "#000" }}>{ins.icon}</span>
              <div className="text-sm font-semibold text-gray-200">{ins.title}</div>
            </div>
            <p className="text-xs text-gray-400">{ins.desc}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Genuine tipping rate */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Genuine Tipping Rate by Topology & Vulnerability
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            TSSE-dominant context (ISR=0.5, TSSE=5.0) · 20 BA instances × 10 seeds each
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={CHART_DATA}
              margin={{ top: 5, right: 15, bottom: 50, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="id"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [`${(v * 100).toFixed(1)}%`, "Genuine rate"]}
                labelFormatter={(l) => {
                  const d = CHART_DATA.find(x => x.id === l);
                  return d ? `${d.topo} — ${d.vuln}` : l;
                }} />
              <Bar dataKey="genuine" radius={[3, 3, 0, 0]} name="Genuine rate">
                {CHART_DATA.map((d, i) => <Cell key={i} fill={d.bar} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Coherence r */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Spatial Coherence r — Vulnerability-Death Alignment
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Pearson r(vulnerability, −death_step). Dashed line = C2 threshold (0.30).
            Negative = anti-correlated (hubs die first but are low-vulnerability).
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={CHART_DATA}
              margin={{ top: 5, right: 15, bottom: 50, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="id"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis domain={[-0.6, 0.6]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(3), "Coherence r"]}
                labelFormatter={(l) => {
                  const d = CHART_DATA.find(x => x.id === l);
                  return d ? `${d.topo} — ${d.vuln}` : l;
                }} />
              <ReferenceLine y={0.30} stroke="#a8ff78" strokeDasharray="4 2"
                label={{ value: "C2 threshold (0.30)", fill: "#a8ff78", fontSize: 9, position: "right" }} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar dataKey="coh" radius={[3, 3, 0, 0]} name="Coherence r">
                {CHART_DATA.map((d, i) => (
                  <Cell key={i} fill={d.coh >= 0.30 ? "#a8ff78" : d.coh >= 0 ? "#ffd700" : "#ff4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full results table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Full Results — 630 runs × 500 steps</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-3 text-gray-400">Topology</th>
              <th className="text-left py-2 px-2 text-gray-400">Vulnerability</th>
              <th className="text-center py-2 px-2 text-gray-400">Genuine rate</th>
              <th className="text-center py-2 px-2 text-gray-400">Coherence r</th>
              <th className="text-center py-2 px-2 text-gray-400">Deg-death corr</th>
              <th className="text-left py-2 pl-2 text-gray-400">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {RESULTS.map((d, i) => {
              const interp =
                d.id === "BA-Orig"  ? "Hubs die first; misaligned with vuln → C2 fails" :
                d.id === "BA-Deg"   ? "Hubs die first AND are most vulnerable → coherent" :
                d.id === "BA-Inv"   ? "Hubs die first; anti-aligned with vuln → worse" :
                d.id === "CE-Orig"  ? "Biological alignment: motor neurons most vulnerable" :
                d.id === "CE-Deg"   ? "AVAL (hub, vuln=0.15) now max-vuln; scrambles order" :
                                      "Hubs now min-vuln; order fully anti-correlated";
              return (
                <tr key={i} className={`border-b border-gray-800 ${i % 2 ? "bg-gray-800 bg-opacity-20" : ""}`}>
                  <td className="py-2 pr-3 font-semibold" style={{ color: d.topoColor }}>{d.topo}</td>
                  <td className="py-2 px-2 text-gray-300">{d.vuln}</td>
                  <td className="text-center py-2 px-2 font-mono font-bold"
                    style={{ color: d.genuine > 0.5 ? "#a8ff78" : d.genuine > 0 ? "#ffd700" : "#ff4444" }}>
                    {(d.genuine * 100).toFixed(1)}%
                  </td>
                  <td className="text-center py-2 px-2 font-mono"
                    style={{ color: d.coh >= 0.30 ? "#a8ff78" : d.coh >= 0 ? "#ffd700" : "#ff4444" }}>
                    {d.coh >= 0 ? "+" : ""}{d.coh.toFixed(3)}
                  </td>
                  <td className="text-center py-2 px-2 font-mono text-gray-300">
                    {d.ddc.toFixed(3)}
                  </td>
                  <td className="py-2 pl-2 text-gray-500 text-xs">{interp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-2">
          Deg-death corr = Spearman r(degree, death order). Positive = high-degree nodes die earlier.
          Stable ≈ 0.41 across all BA conditions confirms TSSE always routes through hubs regardless of
          vulnerability assignment.
        </p>
      </div>

      {/* Mechanistic explanation */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Why the Symmetry Holds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-red-950 bg-opacity-40 border border-red-900 rounded-lg">
            <div className="font-bold text-red-300 mb-2">Barabasi-Albert — misalignment by construction</div>
            <p className="text-gray-300 mb-2">
              Hub status is assigned to random neuron indices. Biological vulnerability
              (motor=1.0, interneuron=0.15) does not correlate with degree in a random BA graph.
            </p>
            <p className="text-gray-400">
              TSSE kills hubs first (deg-death corr=0.41), but those hubs carry arbitrary vulnerability.
              With <strong>original</strong> vulnerability: anti-aligned → coherence = −0.265 → C2 fails.<br />
              With <strong>degree-correlated</strong>: hubs are now most vulnerable → aligned →
              coherence = +0.371 → C2 passes → <strong>80% genuine tipping</strong>.
            </p>
          </div>
          <div className="p-3 bg-cyan-950 bg-opacity-40 border border-cyan-900 rounded-lg">
            <div className="font-bold text-cyan-300 mb-2">C. elegans — biological alignment disrupted</div>
            <p className="text-gray-300 mb-2">
              The highest-degree node is AVAL (degree ≈ 23, vulnerability = 0.15 biologically).
              Motor neurons are most vulnerable but have lower degree than AVAL in the circuit.
            </p>
            <p className="text-gray-400">
              With <strong>original</strong> vulnerability: TSSE spread reaches motor neurons coherently
              → coherence = +0.453 → <strong>100% genuine tipping</strong>.<br />
              With <strong>degree-correlated</strong>: AVAL now most vulnerable → dies first via ISR too →
              death order follows degree not motor-neuron vulnerability → coherence = +0.278 → C2 fails.
            </p>
          </div>
        </div>
      </div>

      {/* Revised claim box */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Revised R3.5 Claim</h3>
        <div className="flex gap-3 text-sm">
          <div className="flex-1 p-3 bg-gray-800 rounded border-l-2 border-orange-500">
            <div className="text-xs text-orange-400 font-semibold mb-1">Before R3.7 (R3.5 finding)</div>
            <div className="text-gray-300 text-xs">
              &ldquo;TSSE requires specific circuit architecture to sustain coherent degeneration.&rdquo;
            </div>
          </div>
          <div className="flex-1 p-3 bg-gray-800 rounded border-l-2 border-green-500">
            <div className="text-xs text-green-400 font-semibold mb-1">After R3.7 (refined)</div>
            <div className="text-gray-300 text-xs">
              &ldquo;TSSE requires that the circuit&apos;s hub structure <strong>aligns with</strong> its
              vulnerability gradient. The C. elegans motor circuit achieves this alignment biologically;
              scale-free graphs do not by construction.&rdquo;
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) Vulnerability injection re-seeds initial aggregation but node
        TYPE labels (motor/interneuron/sensory) are unchanged — base seeding rate (0.015 vs 0.002) still follows
        biological type, not degree. (2) BA instances are the same 20 used in R3.5 (seed 1717); different
        instances might show different recovery rates. (3) The 80% recovery (not 100%) suggests some BA instances
        have sufficiently flat degree distributions that alignment alone cannot fully restore coherent spread.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.7):</strong> BA topology&apos;s resistance to TSSE-dominant cascades is
        explained by <strong>hub-vulnerability misalignment</strong>, not hub architecture per se. TSSE
        always routes spread through high-degree hubs (degree-death corr ≈ 0.41, stable across all
        conditions). Coherence emerges only when this hub-first death order aligns with the vulnerability
        gradient. The C. elegans motor circuit achieves this alignment <strong>biologically</strong>;
        correcting it artificially on BA restores 80% genuine tipping while applying the same correction
        to C. elegans destroys its tipping entirely.
      </div>
    </div>
  );
}

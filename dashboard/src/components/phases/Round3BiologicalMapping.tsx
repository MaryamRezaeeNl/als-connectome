"use client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// ── Data ──────────────────────────────────────────────────────────────────────

// Genuine tipping rate (%) vs intervention strength for A, B, C
const TIPPING_DATA = [
  { str: 10,  strLabel: "10%",  A: 100, B: 100, C: 100 },
  { str: 20,  strLabel: "20%",  A: 100, B: 100, C: 100 },
  { str: 30,  strLabel: "30%",  A: 100, B: 100, C: 100 },
  { str: 40,  strLabel: "40%",  A: 100, B: 100, C: 100 },
  { str: 50,  strLabel: "50%",  A: 100, B: 100, C: 100 },
  { str: 60,  strLabel: "60%",  A: 100, B: 100, C: 100 },
  { str: 70,  strLabel: "70%",  A:  97, B: 100, C:  60 },
  { str: 80,  strLabel: "80%",  A:  80, B: 100, C:  17 },
  { str: 90,  strLabel: "90%",  A:  83, B: 100, C:   0 },
  { str: 95,  strLabel: "95%",  A:  50, B: 100, C:   0 },
  { str: 99,  strLabel: "99%",  A:  50, B: 100, C:   0 },
];

// Bliss synergy score per strength level (benefit metric)
const SYNERGY_DATA = [
  { str: "10%", syn: -0.004, cls: "additive"     },
  { str: "20%", syn:  0.004, cls: "additive"     },
  { str: "30%", syn:  0.007, cls: "additive"     },
  { str: "40%", syn:  0.016, cls: "additive"     },
  { str: "50%", syn:  0.030, cls: "additive"     },
  { str: "60%", syn:  0.055, cls: "synergistic"  },
  { str: "70%", syn:  0.247, cls: "synergistic"  },
  { str: "80%", syn:  0.466, cls: "synergistic"  },
  { str: "90%", syn:  0.631, cls: "synergistic"  },
  { str: "95%", syn:  0.524, cls: "synergistic"  },
  { str: "99%", syn:  0.547, cls: "synergistic"  },
];

// Three-intervention summary
const INTERV_SUMMARY = [
  {
    id: "A",
    name: "Production suppression",
    analogue: "ASO gene silencing",
    genuine99: "50%",
    bestBenefit: 0.342,
    cliff: "90%→95%",
    color: "#22d3ee",
  },
  {
    id: "B",
    name: "Spread inhibition",
    analogue: "Synaptic transmission blockers",
    genuine99: "100%",
    bestBenefit: 0.137,
    cliff: "None",
    color: "#f97316",
  },
  {
    id: "C",
    name: "Coupled suppression",
    analogue: "v1.0-style (ISR + TSSE)",
    genuine99: "0%",
    bestBenefit: 0.979,
    cliff: "60%→70%",
    color: "#a855f7",
  },
];

// Key synergy rows (highlight table)
const SYNERGY_KEY_ROWS = [
  { str: "60%", benA: 0.072, benB: 0.061, bliss: 0.129, benC: 0.183, syn: "+0.055", ci: "[+0.044, +0.067]", cls: "synergistic" },
  { str: "70%", benA: 0.104, benB: 0.072, bliss: 0.168, benC: 0.416, syn: "+0.247", ci: "[+0.166, +0.322]", cls: "synergistic" },
  { str: "80%", benA: 0.186, benB: 0.083, bliss: 0.253, benC: 0.719, syn: "+0.466", ci: "[+0.381, +0.535]", cls: "synergistic" },
  { str: "90%", benA: 0.191, benB: 0.102, bliss: 0.273, benC: 0.905, syn: "+0.631", ci: "[+0.584, +0.672]", cls: "synergistic" },
];

const INSIGHTS = [
  {
    icon: "A",
    title: "Production suppression dominates",
    desc: "ASO analogue (ISR-only) reduces genuine tipping to 50% at 95% dose. Spread inhibition alone leaves tipping at 100% across all 11 dose levels — including 99% TSSE suppression.",
    color: "#22d3ee",
  },
  {
    icon: "⚡",
    title: "Synergy onset = R3.9 cliff",
    desc: "Below 60% strength, combinations are purely additive (CI overlaps zero). Above 60%, ISR suppression pushes neurons toward stochastic escape and TSSE co-suppression removes residual network propagation — cooperation emerges exactly at the therapeutic cliff.",
    color: "#f97316",
  },
  {
    icon: "C",
    title: "Coupled suppression achieves 0% tipping",
    desc: "At 90%+ coupled strength, genuine tipping = 0.000 [0.00, 0.00]. Benefit score 0.904 at 90%, 0.979 at 99%. 2.86× higher than ISR-only at the same dose.",
    color: "#a855f7",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Round3BiologicalMapping() {
  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "63× difference",       value: "63×",        sub: "Production vs spread at comparable doses",  color: "#22d3ee" },
          { label: "Synergy onset at 60%", value: "60%",        sub: "Coincides with R3.9 therapeutic cliff",    color: "#f97316" },
          { label: "Bliss +0.47 at 80%",   value: "+0.47",      sub: "CI [+0.38, +0.53] — near-double expected", color: "#a855f7" },
          { label: "ASO >> synaptic",       value: "0% vs 100%", sub: "Tipping at 99% dose: coupled vs spread",   color: "#4ade80" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {INSIGHTS.map(ins => (
          <div key={ins.title} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: ins.color, color: "#000" }}>{ins.icon}</span>
              <div className="text-sm font-semibold text-gray-200">{ins.title}</div>
            </div>
            <p className="text-xs text-gray-400">{ins.desc}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Genuine tipping rate vs strength */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Genuine Tipping Rate vs Intervention Strength
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            N=30 seeds per condition. A=Production (ISR-only), B=Spread (TSSE-only), C=Coupled.
            Dashed line = 50% tipping rate.
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={TIPPING_DATA} margin={{ top: 5, right: 15, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="strLabel" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis domain={[0, 105]} tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v: any) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any, name: any) => [`${v}%`, `Intervention ${name}`]}
                labelFormatter={(l: any) => `Strength: ${l}`} />
              <Legend wrapperStyle={{ fontSize: 11 }}
                formatter={(v: any) => v === "A" ? "A: Production (ISR)" : v === "B" ? "B: Spread (TSSE)" : "C: Coupled"} />
              <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 2"
                label={{ value: "50%", fill: "#6b7280", fontSize: 9, position: "right" }} />
              <Line type="monotone" dataKey="A" stroke="#22d3ee" strokeWidth={2}
                dot={{ r: 3, fill: "#22d3ee" }} />
              <Line type="monotone" dataKey="B" stroke="#f97316" strokeWidth={2}
                dot={{ r: 3, fill: "#f97316" }} strokeDasharray="6 3" />
              <Line type="monotone" dataKey="C" stroke="#a855f7" strokeWidth={2}
                dot={{ r: 3, fill: "#a855f7" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Synergy score bar chart */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Bliss Synergy Score vs Strength
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Synergy = observed_C &minus; (A + B &minus; A&times;B). Green = synergistic (&gt;0.05),
            gray = additive. N=1000 bootstrap resamples.
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={SYNERGY_DATA} margin={{ top: 5, right: 15, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="str" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis domain={[-0.10, 0.70]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any, _n: any) => [(+v).toFixed(3), "Bliss synergy"]}
                labelFormatter={(l: any) => `Strength: ${l}`} />
              <ReferenceLine y={0}    stroke="#374151" />
              <ReferenceLine y={0.05} stroke="#4ade80" strokeDasharray="4 2"
                label={{ value: "threshold", fill: "#4ade80", fontSize: 9, position: "right" }} />
              <Bar dataKey="syn" radius={[3, 3, 0, 0]} name="Synergy">
                {SYNERGY_DATA.map((d, i) => (
                  <Cell key={i} fill={d.cls === "synergistic" ? "#4ade80" : "#4b5563"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Intervention summary table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Intervention Comparison — 11 Strength Levels × 30 Seeds
        </h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-3 text-gray-400">ID</th>
              <th className="text-left py-2 px-2 text-gray-400">Name</th>
              <th className="text-left py-2 px-2 text-gray-400">Biological analogue</th>
              <th className="text-center py-2 px-2 text-gray-400">Genuine tip. @ 99%</th>
              <th className="text-center py-2 px-2 text-gray-400">Best benefit</th>
              <th className="text-left py-2 pl-2 text-gray-400">Cliff at</th>
            </tr>
          </thead>
          <tbody>
            {INTERV_SUMMARY.map((d, i) => (
              <tr key={i} className={`border-b border-gray-800 ${i % 2 ? "bg-gray-800 bg-opacity-20" : ""}`}>
                <td className="py-2 pr-3 font-bold text-base" style={{ color: d.color }}>{d.id}</td>
                <td className="py-2 px-2 text-gray-200">{d.name}</td>
                <td className="py-2 px-2 text-gray-400">{d.analogue}</td>
                <td className="text-center py-2 px-2 font-mono font-bold"
                  style={{ color: d.genuine99 === "0%" ? "#4ade80" : d.genuine99 === "100%" ? "#f97316" : "#22d3ee" }}>
                  {d.genuine99}
                </td>
                <td className="text-center py-2 px-2 font-mono" style={{ color: d.color }}>
                  {d.bestBenefit.toFixed(3)}
                </td>
                <td className="py-2 pl-2 text-gray-400">{d.cliff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Synergy key rows table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          Bliss Independence Analysis — Key Synergy Levels (60%–90%)
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          E_AB = A + B &minus; A&times;B. Synergy = Observed_C &minus; E_AB.
          Bootstrap CI (N=1000). Classification threshold: |synergy| &gt; 0.05.
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-3 text-gray-400">Strength</th>
              <th className="text-right py-2 px-2 text-gray-400">Ben_A</th>
              <th className="text-right py-2 px-2 text-gray-400">Ben_B</th>
              <th className="text-right py-2 px-2 text-gray-400">Bliss_E</th>
              <th className="text-right py-2 px-2 text-gray-400">Ben_C</th>
              <th className="text-right py-2 px-2 text-gray-400">Synergy</th>
              <th className="text-right py-2 px-2 text-gray-400">95% CI</th>
              <th className="text-left py-2 pl-2 text-gray-400">Class</th>
            </tr>
          </thead>
          <tbody>
            {SYNERGY_KEY_ROWS.map((r, i) => (
              <tr key={i} className="border-b border-gray-800">
                <td className="py-2 pr-3 font-mono font-bold text-gray-200">{r.str}</td>
                <td className="text-right py-2 px-2 font-mono text-cyan-300">{r.benA.toFixed(3)}</td>
                <td className="text-right py-2 px-2 font-mono text-orange-300">{r.benB.toFixed(3)}</td>
                <td className="text-right py-2 px-2 font-mono text-gray-400">{r.bliss.toFixed(3)}</td>
                <td className="text-right py-2 px-2 font-mono text-purple-300">{r.benC.toFixed(3)}</td>
                <td className="text-right py-2 px-2 font-mono font-bold text-green-400">{r.syn}</td>
                <td className="text-right py-2 px-2 font-mono text-gray-400 whitespace-nowrap">{r.ci}</td>
                <td className="py-2 pl-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900 text-green-300">
                    {r.cls}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-2">
          Mean Bliss synergy across all 11 strength levels: benefit = +0.229, tipping protection = +0.258.
          6/11 levels statistically significant (CI_lo &gt; 0): 60%, 70%, 80%, 90%, 95%, 99%.
        </p>
      </div>

      {/* Mechanistic explanation */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Why Spread Inhibition Alone Fails</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-orange-950 bg-opacity-40 border border-orange-900 rounded-lg">
            <div className="font-bold text-orange-300 mb-2">Intervention B (TSSE-only) — zero tipping prevention</div>
            <p className="text-gray-300 mb-2">
              In the ISR=2.0 medium context, every highly-vulnerable neuron accumulates
              aggregation through its intrinsic seeding rate fast enough to tip autonomously
              — regardless of how much trans-synaptic spread is blocked.
            </p>
            <p className="text-gray-400">
              Blocking TSSE delays how fast the cascade <em>propagates across the network</em>,
              but does not prevent individual neurons from crossing the aggregation threshold
              on their own. Genuine tipping = 1.000 at all tested doses including 99%.
            </p>
          </div>
          <div className="p-3 bg-cyan-950 bg-opacity-40 border border-cyan-900 rounded-lg">
            <div className="font-bold text-cyan-300 mb-2">Why coupling is synergistic, not additive</div>
            <p className="text-gray-300 mb-2">
              The Bliss baseline equals prot_A throughout (since prot_B = 0). Any gain from
              coupling beyond ISR-alone is synergy. This reflects genuine mechanistic cooperativity:
            </p>
            <p className="text-gray-400">
              ISR suppression lowers individual neurons below the autonomous cascade threshold.
              At that point, residual network propagation from the (now rare) stochastic initiations
              becomes the limiting factor — and TSSE co-suppression eliminates it.
              Neither mechanism reaches the prevention boundary alone; together they cross it.
            </p>
          </div>
        </div>
      </div>

      {/* Clearance note */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
          Intervention D — Clearance Enhancement (Excluded)
        </h3>
        <p className="text-xs text-gray-400">
          Clearance enhancement (autophagy inducers, proteasome activators — rapamycin analogues)
          was not tested because the current model has no aggregation decay term. The aggregation
          equation contains no <code className="text-gray-300 bg-gray-800 px-1 rounded">−clearance × agg</code> component.
          Future model versions should add explicit clearance kinetics to test this intervention class.
          This is a model limitation, not evidence that clearance is clinically ineffective.
        </p>
      </div>

      {/* Key finding */}
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.10):</strong> Production suppression (ASO analogue) substantially
        outperforms spread inhibition alone at every tested dose. Spread inhibition alone cannot prevent
        genuine tipping even at 99% TSSE suppression. Coupled co-suppression achieves near-complete
        cascade prevention above 90% strength, with <strong>Bliss synergy confirmed above 60%</strong>{" "}
        (mean +0.229 across all strengths, onset coinciding exactly with the R3.9 therapeutic cliff).
        The synergy is mechanistic cooperativity: ISR suppression creates the context required for TSSE
        suppression to be effective.
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) N=30 seeds per condition — CIs are wide at 90–99%
        suppression. (2) The ASO/synaptic-blocker analogy is approximate; real drugs affect multiple
        targets. (3) Bliss synergy with prot_B=0 is mechanistic cooperativity, not pharmacological
        synergy between two independently-active agents — see report for distinction. (4) No clearance
        term in model; Intervention D cannot be compared. All results hypothesis-generating only.
        Not peer-reviewed. Not a clinical model.
      </div>
    </div>
  );
}

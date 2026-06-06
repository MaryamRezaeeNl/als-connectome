"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// ── Data (R3.8 simulation results) ───────────────────────────────────────────

const VERDICT = "GATEKEEPER-DOMINANT";

const KEY_BAR = [
  { name: "Baseline",       isrRed: 0,  glutRed: 0,  benefit: 0.000, genuine: 1.000, firstDeath: 168, plateau: 9.0,  color: "#6b7280" },
  { name: "ISR 50%",        isrRed: 50, glutRed: 0,  benefit: 0.057, genuine: 1.000, firstDeath: 195, plateau: 12.5, color: "#2166ac" },
  { name: "Glut 90%",       isrRed: 0,  glutRed: 90, benefit: 0.001, genuine: 1.000, firstDeath: 170, plateau: 9.0,  color: "#d6604d" },
  { name: "ISR20%+Glut50%", isrRed: 20, glutRed: 50, benefit: 0.020, genuine: 1.000, firstDeath: 180, plateau: 10.5, color: "#74add1" },
  { name: "ISR30%+Glut70%", isrRed: 30, glutRed: 70, benefit: 0.037, genuine: 1.000, firstDeath: 184, plateau: 12.0, color: "#fdae61" },
];

// Grid C — 5 ISR reductions x 4 glut reductions
// [isr_red%, glut_red%, benefit_score, first_death, plateau]
const GRID: [number, number, number, number, number][] = [
  [0,  0,  0.000, 168, 9.0],
  [0,  50, 0.002, 170, 9.0],
  [0,  70, 0.003, 169, 9.5],
  [0,  90, 0.001, 170, 9.0],
  [10, 0,  0.011, 174, 10.0],
  [10, 50, 0.011, 172, 10.0],
  [10, 70, 0.016, 174, 11.0],
  [10, 90, 0.016, 173, 11.0],
  [20, 0,  0.027, 181, 11.0],
  [20, 50, 0.020, 180, 10.5],
  [20, 70, 0.023, 176, 11.0],
  [20, 90, 0.026, 179, 11.0],
  [30, 0,  0.036, 181, 12.0],
  [30, 50, 0.038, 187, 12.0],
  [30, 70, 0.037, 184, 12.0],
  [30, 90, 0.031, 182, 11.5],
  [50, 0,  0.057, 195, 12.5],
  [50, 50, 0.058, 197, 13.0],
  [50, 70, 0.059, 198, 13.0],
  [50, 90, 0.062, 199, 13.0],
];

const ISR_ROWS  = [0, 10, 20, 30, 50];
const GLUT_COLS = [0, 50, 70, 90];

// Synergy table — combination cells only
const SYNERGY_ROWS = [
  { isr: 10, glut: 50, syn: -0.002, ci: "[-0.012, +0.006]", cls: "additive" },
  { isr: 10, glut: 70, syn: +0.002, ci: "[-0.009, +0.007]", cls: "additive" },
  { isr: 10, glut: 90, syn: +0.004, ci: "[-0.008, +0.007]", cls: "additive" },
  { isr: 20, glut: 50, syn: -0.008, ci: "[-0.019, +0.003]", cls: "additive" },
  { isr: 20, glut: 70, syn: -0.007, ci: "[-0.018, +0.002]", cls: "additive" },
  { isr: 20, glut: 90, syn: -0.002, ci: "[-0.016, +0.009]", cls: "additive" },
  { isr: 30, glut: 50, syn:  0.000, ci: "[-0.008, +0.011]", cls: "additive" },
  { isr: 30, glut: 70, syn: -0.002, ci: "[-0.014, +0.006]", cls: "additive" },
  { isr: 30, glut: 90, syn: -0.006, ci: "[-0.015, +0.004]", cls: "additive" },
  { isr: 50, glut: 50, syn:  0.000, ci: "[-0.013, +0.007]", cls: "additive" },
  { isr: 50, glut: 70, syn: -0.001, ci: "[-0.010, +0.009]", cls: "additive" },
  { isr: 50, glut: 90, syn: +0.004, ci: "[-0.007, +0.008]", cls: "additive" },
];

// ── Colour helpers ────────────────────────────────────────────────────────────

function benefitColor(b: number): string {
  // 0 → dark gray, 0.12 → bright cyan
  const t = Math.min(1, b / 0.12);
  const r = Math.round(31  + t * (6   - 31));
  const g = Math.round(41  + t * (182 - 41));
  const bv = Math.round(55 + t * (212 - 55));
  return `rgb(${r},${g},${bv})`;
}

function benefitTextColor(b: number): string {
  return b > 0.06 ? "#000" : "#e5e7eb";
}

// ── Benefit heatmap grid ──────────────────────────────────────────────────────

function BenefitHeatmap() {
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[320px]">
        {/* Column headers */}
        <div className="flex mb-1 ml-14">
          {GLUT_COLS.map(g => (
            <div key={g} className="w-16 text-center text-xs text-gray-500">
              Glut {g}%
            </div>
          ))}
        </div>
        {/* Rows */}
        {ISR_ROWS.map(isr => (
          <div key={isr} className="flex items-center mb-1">
            <div className="w-14 text-xs text-gray-400 text-right pr-2">ISR {isr}%</div>
            {GLUT_COLS.map(glut => {
              const cell = GRID.find(([ir, gl]) => ir === isr && gl === glut);
              const b = cell ? cell[2] : 0;
              return (
                <div key={glut}
                  className="w-16 h-10 flex items-center justify-center text-xs font-mono rounded mx-0.5"
                  style={{ background: benefitColor(b), color: benefitTextColor(b) }}>
                  {b.toFixed(3)}
                </div>
              );
            })}
          </div>
        ))}
        <p className="text-xs text-gray-600 mt-2 ml-14">
          Benefit score (0 = baseline, higher = more therapeutic effect).
          Dark = low benefit. Cyan = higher benefit.
        </p>
      </div>
    </div>
  );
}

// ── Insights ──────────────────────────────────────────────────────────────────

const INSIGHTS = [
  {
    icon: "↯",
    title: "Glutamate suppression: negligible effect",
    desc: "Riluzole-like glutamate suppression at 90-99% yields benefit score < 0.003 -- virtually indistinguishable from untreated baseline. Genuine tipping rate stays at 100% across all glutamate-only conditions. The downstream amplifier is not load-bearing at baseline ISR.",
    color: "#d6604d",
  },
  {
    icon: "↑",
    title: "ISR suppression: the dominant lever",
    desc: "ISR suppression monotonically improves all metrics: 50% reduction yields benefit 0.057 (57x Glut 90%); 70% reduction yields 0.111 and drops genuine tipping to 95%. First-death delay scales linearly with ISR reduction (~4 steps per 10% reduction).",
    color: "#2166ac",
  },
  {
    icon: "=",
    title: "All synergies are additive (no CI above 0)",
    desc: "All 12 combination cells produce synergy scores within [-0.008, +0.004]. Bootstrap 95% CIs all cross zero. No evidence of super-additive or antagonistic interaction. Combination benefit = sum of parts.",
    color: "#a855f7",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Round3CombinationTherapy() {
  return (
    <div className="space-y-6">

      {/* Verdict banner */}
      <div className="bg-blue-950 border border-blue-700 rounded-xl p-4 flex items-center gap-4">
        <div className="text-3xl font-black text-blue-300">GATEKEEPER-DOMINANT</div>
        <div className="text-xs text-blue-200 max-w-xl">
          Within this computational framework, ISR suppression (upstream gatekeeper targeting)
          is <strong>63x more effective</strong> than riluzole-like glutamate suppression
          (downstream amplifier targeting) at comparable dose levels.
          All combination synergies are additive.
          <br className="hidden md:block" />
          <span className="text-blue-400 font-semibold"> Hypothesis-generating only. Not a clinical finding.</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "ISR 50% benefit",    value: "0.057",  sub: "ISR val = 1.0 (from 2.0)",        color: "#2166ac" },
          { label: "ISR 70% benefit",    value: "0.111",  sub: "genuine rate drops to 95%",        color: "#4a99d4" },
          { label: "Glut 90% benefit",   value: "0.001",  sub: "no change to genuine tipping",     color: "#d6604d" },
          { label: "Best combo benefit", value: "0.062",  sub: "ISR50%+Glut90% -- additive only",  color: "#a855f7" },
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
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: ins.color, color: "#fff" }}>{ins.icon}</span>
              <div className="text-sm font-semibold text-gray-200">{ins.title}</div>
            </div>
            <p className="text-xs text-gray-400">{ins.desc}</p>
          </div>
        ))}
      </div>

      {/* Bar charts — key scenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Benefit Score — Key Scenarios</h3>
          <p className="text-xs text-gray-500 mb-3">
            Weighted composite vs untreated baseline (40% tipping prevention,
            20% first-death delay, 25% plateau gain, 15% survival gain).
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={KEY_BAR} margin={{ top: 5, right: 15, bottom: 55, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                angle={-28} textAnchor="end" interval={0} />
              <YAxis domain={[0, 0.08]} tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v) => v.toFixed(3)} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [(+v).toFixed(4), "Benefit score"]}
                labelFormatter={(l) => {
                  const d = KEY_BAR.find(x => x.name === l);
                  return d ? `ISR -${d.isrRed}% / Glut -${d.glutRed}%` : l;
                }} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar dataKey="benefit" radius={[3, 3, 0, 0]} name="Benefit">
                {KEY_BAR.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">First-Death Delay — Key Scenarios</h3>
          <p className="text-xs text-gray-500 mb-3">
            Median step of first neuron death. Baseline = 168 steps.
            Dashed reference line at baseline.
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={KEY_BAR} margin={{ top: 5, right: 15, bottom: 55, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                angle={-28} textAnchor="end" interval={0} />
              <YAxis domain={[140, 220]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [`step ${v}`, "First death"]}
                labelFormatter={(l) => {
                  const d = KEY_BAR.find(x => x.name === l);
                  return d ? `ISR -${d.isrRed}% / Glut -${d.glutRed}%` : l;
                }} />
              <ReferenceLine y={168} stroke="#6b7280" strokeDasharray="4 2"
                label={{ value: "Baseline (168)", fill: "#6b7280", fontSize: 9 }} />
              <Bar dataKey="firstDeath" radius={[3, 3, 0, 0]} name="First death step">
                {KEY_BAR.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Benefit score heatmap */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          Benefit Score Heatmap — ISR Suppression x Glutamate Suppression
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Medium aggregation context (ISR=2.0, TSSE=2.0). 20 seeds x 500 steps per cell.
          Reading pattern: benefit increases DOWN (more ISR) but barely changes RIGHT (more Glut).
        </p>
        <BenefitHeatmap />
      </div>

      {/* Synergy analysis */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          Synergy Analysis — Combination Cells
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Synergy = observed benefit - (ISR-only benefit + Glut-only benefit).
          Positive = super-additive; negative = sub-additive. Bootstrap 95% CI (n=500).
          All CIs cross zero; all cells classified as additive.
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-center py-2 px-2 text-gray-400">ISR red.</th>
              <th className="text-center py-2 px-2 text-gray-400">Glut red.</th>
              <th className="text-center py-2 px-2 text-gray-400">Synergy</th>
              <th className="text-center py-2 px-2 text-gray-400">95% CI (bootstrap)</th>
              <th className="text-center py-2 px-2 text-gray-400">Class.</th>
            </tr>
          </thead>
          <tbody>
            {SYNERGY_ROWS.map((r, i) => (
              <tr key={i} className={`border-b border-gray-800 ${i % 2 ? "bg-gray-800 bg-opacity-20" : ""}`}>
                <td className="text-center py-1.5 px-2 text-blue-300 font-mono">{r.isr}%</td>
                <td className="text-center py-1.5 px-2 text-red-300 font-mono">{r.glut}%</td>
                <td className="text-center py-1.5 px-2 font-mono font-bold"
                  style={{ color: r.syn > 0.01 ? "#a8ff78" : r.syn < -0.01 ? "#ff6b6b" : "#9ca3af" }}>
                  {r.syn >= 0 ? "+" : ""}{r.syn.toFixed(4)}
                </td>
                <td className="text-center py-1.5 px-2 text-gray-400 font-mono text-xs">{r.ci}</td>
                <td className="text-center py-1.5 px-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-700 text-gray-300">
                    {r.cls}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mechanistic cascade interpretation */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Why Glutamate Suppression Fails in This Model</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-red-950 bg-opacity-40 border border-red-900 rounded-lg">
            <div className="font-bold text-red-300 mb-2">Cascade hierarchy</div>
            <div className="font-mono text-gray-300 text-xs leading-relaxed">
              ISR (gatekeeper)<br />
              {"  "}→ aggregation ↑<br />
              {"     "}→ ATP collapse<br />
              {"        "}→ <span className="text-yellow-300">glutamate excitotoxicity</span><br />
              {"           "}→ Ca²⁺ overload<br />
              {"              "}→ ROS ↑<br />
              {"                 "}→ aggregation ↑ (loop)
            </div>
          </div>
          <div className="p-3 bg-blue-950 bg-opacity-40 border border-blue-900 rounded-lg">
            <div className="font-bold text-blue-300 mb-2">Why the gate controls the cascade</div>
            <p className="text-gray-300 mb-2">
              Glutamate excitotoxicity in this model is <em>ATP-gated</em>: it activates only when
              ATP falls below 0.5. With ISR=2.0 driving aggregation, ATP collapses regardless of
              glutamate sensitivity. Blocking the glutamate step does not stop ATP collapse.
            </p>
            <p className="text-gray-400">
              Even at 99% glutamate reduction (sensitivity 0.0001 vs baseline 0.01), the cascade
              still initiates via aggregation → ATP collapse, bypassing the blocked amplifier.
              The gate must be suppressed first.
            </p>
          </div>
        </div>
      </div>

      {/* Implication cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            Model implication
          </h4>
          <p className="text-xs text-gray-300 mb-2">
            Within this computational framework, the ISR pathway is the dominant therapeutic target.
            Combination strategies add only incremental benefit over ISR monotherapy when synergy is additive.
            Reaching 70% ISR suppression (benefit 0.111, tipping rate 95%) outperforms any combination
            tested at lower ISR doses.
          </p>
          <p className="text-xs text-gray-500">
            Hypothesis-generating implication: upstream protein-seeding suppression may be a more
            potent intervention point than downstream excitotoxicity suppression in this model.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            Gatekeeper-failure signal
          </h4>
          <p className="text-xs text-gray-300 mb-2">
            ISR 30% + Glut 70% achieves benefit 0.037 — superior to Glut 90% alone (0.001) while using
            lower glutamate suppression. This supports the idea that downstream amplifier suppression
            has minimal effect unless the upstream ISR gate is partially reduced.
          </p>
          <p className="text-xs text-gray-500">
            Benefit ratio at matched "total effort": ISR-dominant combinations consistently outperform
            glut-dominant configurations.
          </p>
        </div>
      </div>

      {/* Disclaimers */}
      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Computational limitations and caveats:</strong>
        <ul className="mt-1 space-y-0.5 list-disc list-inside text-amber-300">
          <li>All results are within the decoupled v2.0 model (R3.1) on C. elegans motor connectome.</li>
          <li>
            "Glutamate suppression" is a direct model parameter reduction — it is NOT a validated model
            of riluzole pharmacokinetics or mechanism. The word "riluzole-like" is used descriptively only.
          </li>
          <li>
            "ISR suppression" is NOT a model of any specific ASO therapy. It represents upstream
            aggregation-seeding rate reduction in abstract model terms.
          </li>
          <li>No clinical claims are made or implied. This phase is strictly hypothesis-generating.</li>
          <li>20 seeds per condition; bootstrap CI based on 500 resamples with fixed seed 38801.</li>
          <li>Functional survival: step when alive count first drops to ≤30/61. Baseline = step 226.</li>
        </ul>
      </div>

      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding (R3.8):</strong> Within this computational framework, glutamate
        excitotoxicity acts as a downstream amplifier with negligible standalone causal power at
        medium ISR context (ISR=2.0). Even 99% reduction of glutamate sensitivity leaves genuine
        tipping rate at 100% and benefit score at 0.0003. ISR suppression is 63x more effective
        at 50% dose. All combination synergies are additive (all bootstrap CIs cross zero).
        The cascade is <strong>gatekeeper-dominant</strong>: the ISR pathway controls whether
        tipping occurs; the glutamate amplifier only modulates its timing once the gate is open.
      </div>

    </div>
  );
}

"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart, Legend,
} from "recharts";

// ── Phase R3.9 results (hardcoded from simulation) ────────────────────────────
const VERDICT = "SHARP_CLIFF";

const LEVELS = [
  { isr_pct: 0,  tipping: 1.000, ci_lo: 1.000, ci_hi: 1.000, benefit: 0.0000,  first_death: 170,  plateau: 9  },
  { isr_pct: 10, tipping: 1.000, ci_lo: 1.000, ci_hi: 1.000, benefit: 0.0105,  first_death: 174,  plateau: 10 },
  { isr_pct: 20, tipping: 1.000, ci_lo: 1.000, ci_hi: 1.000, benefit: 0.0235,  first_death: 179,  plateau: 11 },
  { isr_pct: 30, tipping: 1.000, ci_lo: 1.000, ci_hi: 1.000, benefit: 0.0360,  first_death: 184,  plateau: 12 },
  { isr_pct: 40, tipping: 1.000, ci_lo: 1.000, ci_hi: 1.000, benefit: 0.0421,  first_death: 191,  plateau: 12 },
  { isr_pct: 50, tipping: 1.000, ci_lo: 1.000, ci_hi: 1.000, benefit: 0.0575,  first_death: 198,  plateau: 13 },
  { isr_pct: 60, tipping: 1.000, ci_lo: 1.000, ci_hi: 1.000, benefit: 0.0677,  first_death: 205,  plateau: 13 },
  { isr_pct: 70, tipping: 0.980, ci_lo: 0.940, ci_hi: 1.000, benefit: 0.0931,  first_death: 215,  plateau: 14 },
  { isr_pct: 75, tipping: 0.960, ci_lo: 0.900, ci_hi: 1.000, benefit: 0.1076,  first_death: 219,  plateau: 14 },
  { isr_pct: 80, tipping: 0.880, ci_lo: 0.780, ci_hi: 0.960, benefit: 0.1486,  first_death: 223,  plateau: 14 },
  { isr_pct: 85, tipping: 0.860, ci_lo: 0.760, ci_hi: 0.940, benefit: 0.1626,  first_death: 224,  plateau: 15 },
  { isr_pct: 90, tipping: 0.580, ci_lo: 0.440, ci_hi: 0.700, benefit: 0.2931,  first_death: 235,  plateau: 16 },
  { isr_pct: 92, tipping: 0.640, ci_lo: 0.520, ci_hi: 0.760, benefit: 0.2653,  first_death: 235,  plateau: 16 },
  { isr_pct: 94, tipping: 0.560, ci_lo: 0.420, ci_hi: 0.700, benefit: 0.3049,  first_death: 239,  plateau: 16 },
  { isr_pct: 95, tipping: 0.680, ci_lo: 0.540, ci_hi: 0.800, benefit: 0.2601,  first_death: 243,  plateau: 16 },
  { isr_pct: 96, tipping: 0.560, ci_lo: 0.420, ci_hi: 0.680, benefit: 0.3045,  first_death: 241,  plateau: 16 },
  { isr_pct: 97, tipping: 0.440, ci_lo: 0.300, ci_hi: 0.580, benefit: 0.3602,  first_death: 242,  plateau: 16 },
  { isr_pct: 98, tipping: 0.360, ci_lo: 0.220, ci_hi: 0.500, benefit: 0.3980,  first_death: 246,  plateau: 17 },
  { isr_pct: 99, tipping: 0.520, ci_lo: 0.380, ci_hi: 0.660, benefit: 0.3310,  first_death: 244,  plateau: 17 },
];

const CLIFF = { from_pct: 85, to_pct: 90, delta_tipping: -0.280, delta_benefit: 0.131 };
const ISR50 = { value: 96.5, ci_lo: 89.3, ci_hi: 97.3 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function benefitColor(b: number): string {
  const t = Math.min(b / 0.42, 1.0);
  const r = Math.round(10 + t * (34 - 10));
  const g = Math.round(10 + t * (211 - 10));
  const bl = Math.round(20 + t * (238 - 20));
  return `rgb(${r},${g},${bl})`;
}

function tippingColor(t: number): string {
  const r = Math.round(34 + (1 - t) * (239 - 34));
  const g = Math.round(197 + (1 - t) * (68 - 197));
  const b = Math.round(94 + (1 - t) * (68 - 94));
  return `rgb(${r},${g},${b})`;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function TippingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs">
      <div className="font-bold text-gray-200 mb-1">ISR suppression: {label}%</div>
      <div className="text-cyan-300">Genuine tipping: {(d.tipping * 100).toFixed(0)}%</div>
      <div className="text-gray-400">95% CI: [{(d.ci_lo * 100).toFixed(0)}%, {(d.ci_hi * 100).toFixed(0)}%]</div>
      <div className="text-amber-300">Benefit score: {d.benefit.toFixed(4)}</div>
      <div className="text-gray-400">First death: step {d.first_death}</div>
      <div className="text-gray-400">Plateau survivors: {d.plateau}</div>
    </div>
  );
}

// ── Cliff annotation ─────────────────────────────────────────────────────────
function CliffAnnotation() {
  return (
    <div className="bg-red-950 border border-red-700 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚡</span>
        <div>
          <div className="text-sm font-bold text-red-300 mb-1">Cliff Detected: ISR suppression 85% → 90%</div>
          <div className="text-xs text-red-200 leading-relaxed">
            Single-step genuine tipping rate drop of <strong>28 percentage points</strong> (0.860 → 0.580).
            Benefit score jumps by <strong>+0.131</strong> across the same interval.
            This is the only cliff region detected across the full 0–99% sweep.
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-red-900 bg-opacity-50 rounded-lg p-2">
              <div className="text-red-400 font-medium">Delta tipping rate</div>
              <div className="text-white font-bold text-lg">-0.280</div>
              <div className="text-red-400">per 5% step</div>
            </div>
            <div className="bg-amber-900 bg-opacity-50 rounded-lg p-2">
              <div className="text-amber-400 font-medium">Delta benefit score</div>
              <div className="text-white font-bold text-lg">+0.131</div>
              <div className="text-amber-400">per 5% step</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Round3TherapeuticCliff() {
  return (
    <div className="space-y-6 text-sm">

      {/* Verdict banner */}
      <div className="bg-gradient-to-r from-red-950 via-gray-900 to-gray-900 border border-red-700 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-4xl">⚡</div>
          <div>
            <div className="text-xs uppercase tracking-widest text-red-400 font-semibold mb-1">R3.9 Verdict</div>
            <div className="text-2xl font-extrabold text-white tracking-wide">{VERDICT.replace("_", " ")}</div>
            <div className="text-xs text-gray-400 mt-1">
              ISR suppression does <em>not</em> produce a gradual dose-response — it exhibits a cliff near
              90% suppression where a 5-percentage-point step collapses genuine tipping by 28 pp. Below the
              cliff, doses 0–85% yield incremental benefit only. Above it, noisy plateau 42–60% tipping
              residual persists even at 99% suppression.
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Cliff location",     value: "85–90%",          sub: "ISR suppression",    color: "#ef4444" },
            { label: "ISR50 threshold",    value: "96.5%",           sub: "[89.3%, 97.3%] 95% CI", color: "#f97316" },
            { label: "ISR90",              value: "Not reached",     sub: "even at 99% suppression", color: "#6b7280" },
            { label: "Response shape",     value: "Cliff-like",      sub: "max step drop = 0.28", color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className="bg-gray-800 bg-opacity-60 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-base font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cliff annotation */}
      <CliffAnnotation />

      {/* Tipping rate chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Genuine Tipping Rate vs ISR Suppression</h3>
        <p className="text-xs text-gray-500 mb-3">
          19 suppression levels × 50 seeds. Shaded band = 95% bootstrap CI.
          Dashed line = cliff region (85–90%). ISR50 = 96.5%.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={LEVELS} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="isr_pct" stroke="#6b7280" tick={{ fontSize: 11 }}
              label={{ value: "ISR suppression (%)", position: "insideBottom", offset: -4, fill: "#6b7280", fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[0, 1.05]}
              tickFormatter={(v: any) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip content={<TippingTooltip />} />
            <ReferenceLine x={87.5} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2}
              label={{ value: "CLIFF", fill: "#ef4444", fontSize: 10, position: "top" }} />
            <ReferenceLine x={ISR50.value} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: "ISR50", fill: "#f97316", fontSize: 10, position: "top" }} />
            <Area dataKey="ci_hi" stroke="none" fill="#22d3ee" fillOpacity={0.15} legendType="none" />
            <Area dataKey="ci_lo" stroke="none" fill="#111827" fillOpacity={1} legendType="none" />
            <Line dataKey="tipping" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: "#22d3ee" }}
              name="Genuine tipping rate" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Benefit score chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Composite Benefit Score vs ISR Suppression</h3>
        <p className="text-xs text-gray-500 mb-3">
          Weighted composite (40% tipping prevention, 20% first-death delay, 25% plateau gain, 15% functional survival).
          Jump visible at 85→90% cliff.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={LEVELS} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="isr_pct" stroke="#6b7280" tick={{ fontSize: 11 }}
              label={{ value: "ISR suppression (%)", position: "insideBottom", offset: -4, fill: "#6b7280", fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[0, 0.45]}
              tickFormatter={(v: any) => v.toFixed(2)} />
            <Tooltip formatter={(v: any) => [(+v).toFixed(4), "Benefit score"]}
              labelFormatter={(l: any) => `ISR suppression: ${l}%`}
              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
            <ReferenceLine x={87.5} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2} />
            <Line dataKey="benefit" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3, fill: "#a855f7" }}
              name="Benefit score" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Two mini charts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Plateau Survivors</h3>
          <p className="text-xs text-gray-500 mb-3">Neurons surviving to end (out of 61). Baseline = 9.</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={LEVELS} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="isr_pct" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[0, 20]} />
              <Tooltip formatter={(v: any) => [v, "Plateau survivors"]}
                labelFormatter={(l: any) => `ISR: ${l}%`}
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
              <ReferenceLine x={87.5} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
              <Line dataKey="plateau" stroke="#4ade80" strokeWidth={2} dot={{ r: 2, fill: "#4ade80" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">First Death Step</h3>
          <p className="text-xs text-gray-500 mb-3">Step of first neuron death. Baseline = step 170.</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={LEVELS} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="isr_pct" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} domain={[150, 260]} />
              <Tooltip formatter={(v: any) => [`step ${v}`, "First death"]}
                labelFormatter={(l: any) => `ISR: ${l}%`}
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
              <ReferenceLine x={87.5} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
              <Line dataKey="first_death" stroke="#fbbf24" strokeWidth={2} dot={{ r: 2, fill: "#fbbf24" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Level-by-level table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">All 19 Suppression Levels</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left pb-2 pr-3">ISR supp.</th>
                <th className="text-right pb-2 pr-3">Genuine tipping</th>
                <th className="text-right pb-2 pr-3">95% CI</th>
                <th className="text-right pb-2 pr-3">Benefit</th>
                <th className="text-right pb-2 pr-3">First death</th>
                <th className="text-right pb-2">Plateau</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((r, i) => {
                const isCliff = r.isr_pct === 90;
                return (
                  <tr key={i}
                    className={`border-b border-gray-800 ${isCliff ? "bg-red-950 bg-opacity-40" : ""}`}>
                    <td className="py-1.5 pr-3 font-mono text-gray-300">
                      {r.isr_pct}%
                      {isCliff && <span className="ml-1 text-red-400 text-xs font-bold">⚡CLIFF</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono"
                      style={{ color: tippingColor(r.tipping) }}>
                      {(r.tipping * 100).toFixed(0)}%
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-500">
                      [{(r.ci_lo * 100).toFixed(0)}, {(r.ci_hi * 100).toFixed(0)}]
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono"
                      style={{ color: benefitColor(r.benefit) }}>
                      {r.benefit.toFixed(4)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-gray-400">{r.first_death}</td>
                    <td className="py-1.5 text-right font-mono text-gray-400">{r.plateau}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mechanistic interpretation */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mechanistic Interpretation</h3>
        <div className="text-xs text-gray-400 space-y-2">
          <p>
            <strong className="text-gray-200">Why a cliff at ~90%?</strong> The excitotoxic feedback loop
            (aggregation → mito damage → ATP collapse → glutamate → Ca²⁺ → ROS → aggregation) has a
            saturation regime below ISR ~85%: even with reduced seeding, intracellular aggregation
            accumulates fast enough to trigger cascade onset in nearly all runs. Near ISR = 10% of
            baseline, stochastic escape from cascade initiation becomes possible — some runs never
            exceed the glutamate-excitotoxicity threshold, producing genuine tipping prevention.
          </p>
          <p>
            <strong className="text-gray-200">Why does ISR90 remain unachieved?</strong> Even at 99%
            suppression (ISR = 0.020), 36–52% of seeds still tip. The residual is driven by TSSE =
            2.0 (trans-synaptic spread) operating independently of ISR. Once a single neuron reaches
            critical aggregation via low-probability stochastic events, network spreading takes over.
            Eliminating 90% of genuine tipping would require either: (a) ISR suppression below the
            stochastic floor, or (b) combined ISR + TSSE co-suppression (as explored in R3.8).
          </p>
          <p>
            <strong className="text-gray-200">Clinical translation caveat (model-only):</strong> A
            therapeutic cliff implies that a drug achieving less than ~90% target engagement may provide
            minimal tipping prevention despite observable biomarker improvement. The model suggests
            partial ISR inhibition is useful (incremental benefit 0–85%), but crossing the cliff
            requires near-complete engagement. This is a hypothesis for experimental testing, not a
            clinical prediction.
          </p>
        </div>
      </div>

      {/* Downstream questions */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Open Questions for Follow-Up</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
          {[
            "Does the cliff persist if TSSE is also co-suppressed (R3.8 extension at higher ISR)?",
            "Is the cliff location (85–90%) robust to seed location changes (cf. R3.6)?",
            "Does vulnerability-hub alignment (R3.7) shift the cliff threshold?",
            "What is the stochastic floor for genuine tipping at ISR→0 (biological noise floor)?",
            "Can early-warning signals at t=50 predict whether a run will tip post-cliff?",
            "Does mitochondrial fragility (R3.3) interact with the cliff — lower mitFrag → earlier cliff?",
          ].map((q, i) => (
            <div key={i} className="flex items-start gap-2 bg-gray-800 rounded-lg p-2">
              <span className="text-gray-600 flex-shrink-0 font-mono">{i + 1}.</span>
              <span>{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-950 border border-amber-800 rounded-xl p-3 text-xs text-amber-200">
        <strong>Disclaimer:</strong> All results are from computational simulation of the
        decoupled v2.0 model on the C. elegans motor connectome. N=50 seeds per condition.
        Bootstrap CI N=1000. Not a clinical model. Not peer-reviewed.
        Hypothesis-generating only.
      </div>
    </div>
  );
}

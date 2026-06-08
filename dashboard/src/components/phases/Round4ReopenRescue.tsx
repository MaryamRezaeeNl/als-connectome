"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
  ComposedChart, Area,
} from "recharts";

// ── Data (from r4_2_results.json, N=50 seeds per restoration level) ───────────

const RESTORE_DATA = [
  { pct: 0,   gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.049, plateau: 14.8, atp_before: 0.793, atp_after: 0.793, delta: 0.000 },
  { pct: 10,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.047, plateau: 14.6, atp_before: 0.793, atp_after: 0.814, delta: 0.021 },
  { pct: 20,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.046, plateau: 14.6, atp_before: 0.791, atp_after: 0.832, delta: 0.041 },
  { pct: 30,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.046, plateau: 14.6, atp_before: 0.792, atp_after: 0.854, delta: 0.062 },
  { pct: 40,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.047, plateau: 14.6, atp_before: 0.791, atp_after: 0.875, delta: 0.083 },
  { pct: 50,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.050, plateau: 14.4, atp_before: 0.794, atp_after: 0.897, delta: 0.103 },
  { pct: 60,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.048, plateau: 14.7, atp_before: 0.793, atp_after: 0.917, delta: 0.124 },
  { pct: 70,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.050, plateau: 14.4, atp_before: 0.796, atp_after: 0.939, delta: 0.143 },
  { pct: 80,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.050, plateau: 14.8, atp_before: 0.794, atp_after: 0.959, delta: 0.165 },
  { pct: 90,  gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.046, plateau: 14.5, atp_before: 0.791, atp_after: 0.979, delta: 0.188 },
  { pct: 100, gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.047, plateau: 14.3, atp_before: 0.791, atp_after: 1.000, delta: 0.209 },
];

// ATP trajectory (single seed 420000, estimated from decay formula atp -> 0.729 at rate 0.04/step)
// atp_at_s = atp_target + (atp_start - atp_target) * (1-0.04)^(s-150)
const buildTrajectory = (atp_restore_pct: number, steps = 500) => {
  const data: { s: number; atp: number }[] = [];
  const T = 150;
  const atp_init  = 0.793;
  const atp_target = 0.729;   // 1 - 1.10 * 0.246
  let atp = atp_init;
  for (let s = 1; s <= steps; s++) {
    if (s === T) {
      atp = atp + (atp_restore_pct / 100) * (1.0 - atp);
    }
    atp = atp_target + (atp - atp_target) * (1 - 0.04);
    data.push({ s, atp: Math.max(0, Math.min(1, atp)) });
  }
  return data;
};

const TRAJ_0   = buildTrajectory(0);
const TRAJ_30  = buildTrajectory(30);
const TRAJ_70  = buildTrajectory(70);
const TRAJ_100 = buildTrajectory(100);

// Merge for chart
const TRAJ_DATA = TRAJ_0.map((d, i) => ({
  s:     d.s,
  pct0:  d.atp,
  pct30: TRAJ_30[i].atp,
  pct70: TRAJ_70[i].atp,
  pct100: TRAJ_100[i].atp,
}));

// R4.1 comparison (onset sweep at max therapy, for fig5)
const R41_ONSET = [
  { t: 0,   gtr: 0.000 }, { t: 25,  gtr: 0.040 }, { t: 50,  gtr: 0.200 },
  { t: 75,  gtr: 0.522 }, { t: 100, gtr: 0.938 }, { t: 125, gtr: 0.979 },
  { t: 150, gtr: 1.000 }, { t: 175, gtr: 1.000 }, { t: 200, gtr: 1.000 },
  { t: 225, gtr: 1.000 }, { t: 250, gtr: 1.000 }, { t: 300, gtr: 1.000 },
];

const AGG_AT_T150 = 0.246;
const ATP_BEFORE  = 0.793;
const ATP_TARGET  = 1.0 - 1.10 * AGG_AT_T150;  // 0.729

// ── Component ─────────────────────────────────────────────────────────────────

export default function Round4ReopenRescue() {
  return (
    <div className="space-y-6 text-sm text-gray-200">

      {/* Disclaimer */}
      <div className="bg-amber-950 border border-amber-800 rounded-xl p-3 text-xs text-amber-200">
        <strong>Model-specific finding.</strong> ATP restoration is a model-level state modification —
        it does NOT represent any specific real-world therapy. All results are from the v2.0
        DecoupledSimulator. Hypothesis-generating only.
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Verdict",            value: "ATP IS MARKER",   sub: "zero effect across all levels",    color: "#22c55e" },
          { label: "Max tipping gain",   value: "0.000 pp",        sub: "0% → 100% restore; no change",     color: "#6b7280" },
          { label: "N irreversible @T150", value: "0 neurons",     sub: "all 61 eligible for restore",      color: "#22d3ee" },
          { label: "True barrier",       value: "Aggregation",     sub: "atp_target=1−1.10×0.246=0.729",   color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className="text-lg font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Key finding box */}
      <div className="bg-green-950 border border-green-800 rounded-xl p-4">
        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Key Finding — ATP Is a Marker, Not a Bottleneck</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          100% ATP restoration at T=150 (after the R4.1 point of no return) produced{" "}
          <strong className="text-white">zero improvement</strong> in genuine tipping rate across all
          11 restoration levels. The R4.1 ATP predictor (r=−0.77) was a proxy correlation:{" "}
          <code className="text-cyan-300">atp_target = 1 − 1.10 × agg = 0.729</code> at mean
          aggregation 0.246. Restored ATP decays back toward this target within ∼3 steps.
          The true barrier is <strong className="text-yellow-400">accumulated aggregation</strong> (no
          decay term in the model), which continues driving trans-synaptic spread and oxidative
          feedback even after full ATP restoration and 90% coupled suppression.
        </p>
      </div>

      {/* Fig 1: tipping rate vs restore pct — the null result */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          ATP Restoration vs Genuine Tipping Rate — Null Result
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          N=50 seeds per level. Coupled therapy (ISR=0.20, TSSE=0.20) applied at all levels.
          Genuine tipping rate remains 1.000 regardless of ATP restoration strength.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={RESTORE_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="pct" tickFormatter={(v: any) => `${v}%`}
              label={{ value: "ATP restoration strength (%)", position: "insideBottom", offset: -4, fill: "#9ca3af", fontSize: 11 }}
              tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis domain={[0, 1.10]} tickFormatter={(v: any) => `${(v * 100).toFixed(0)}%`}
              label={{ value: "Genuine tipping rate", angle: -90, position: "insideLeft", offset: 12, fill: "#9ca3af", fontSize: 11 }}
              tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
              formatter={(v: any, n: any) => [`${(+v * 100).toFixed(1)}%`, n]}
              labelFormatter={(l: any) => `Restore ${l}%`}
            />
            <Area type="monotone" dataKey="hi" stroke="none" fill="#ef4444" fillOpacity={0.08} legendType="none" name="CI hi" />
            <Area type="monotone" dataKey="lo" stroke="none" fill="#1f2937"  fillOpacity={1.0}  legendType="none" name="CI lo" />
            <Line type="monotone" dataKey="gtr" stroke="#ef4444" strokeWidth={2} dot={{ r: 5 }} name="Genuine tipping rate" />
            <ReferenceLine y={1.0} stroke="#6b7280" strokeDasharray="3 3" />
            <ReferenceLine y={0.5} stroke="#9ca3af" strokeDasharray="4 4"
              label={{ value: "50%", fill: "#9ca3af", fontSize: 9, position: "right" }} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2 text-center italic">
          All 11 levels produce identical results: genuine tipping rate = 1.000 ± 0.000
        </p>
      </div>

      {/* Fig 4: ATP trajectory — why it doesn't work */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
          Why ATP Restoration Fails — Decay Trajectory
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Estimated ATP trajectories from analytical decay model:
          <code className="text-cyan-300 ml-1">atp → atp_target + (atp₀ − atp_target) × (1−0.04)^t</code>,
          where <code className="text-yellow-300">atp_target = {ATP_TARGET.toFixed(3)}</code> (set
          by mean aggregation {AGG_AT_T150} at T=150). Even 100% restore decays back to near-target
          within ~50 steps — too short to arrest the self-sustaining cascade.
        </p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={TRAJ_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="s" tick={{ fill: "#9ca3af", fontSize: 10 }}
              label={{ value: "Simulation step", position: "insideBottom", offset: -4, fill: "#9ca3af", fontSize: 11 }} />
            <YAxis domain={[0.6, 1.05]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
              formatter={(v: any, n: any) => [(+v).toFixed(3), n]}
              labelFormatter={(l: any) => `Step ${l}`} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <ReferenceLine x={150} stroke="#ef4444" strokeDasharray="4 4"
              label={{ value: "T=150 intervention", fill: "#ef4444", fontSize: 9, position: "top" }} />
            <ReferenceLine y={ATP_TARGET} stroke="#f59e0b" strokeDasharray="3 3"
              label={{ value: `ATP target ${ATP_TARGET.toFixed(3)}`, fill: "#f59e0b", fontSize: 9, position: "right" }} />
            <Line type="monotone" dataKey="pct0"   stroke="#6b7280" strokeWidth={1.5} dot={false} name="0% restore" />
            <Line type="monotone" dataKey="pct30"  stroke="#f59e0b" strokeWidth={1.5} dot={false} name="30% restore" />
            <Line type="monotone" dataKey="pct70"  stroke="#22d3ee" strokeWidth={1.5} dot={false} name="70% restore" />
            <Line type="monotone" dataKey="pct100" stroke="#22c55e" strokeWidth={2.0} dot={false} name="100% restore" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Fig 3: plateau survivors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Plateau Survivors</h3>
          <p className="text-xs text-gray-500 mb-2">
            Mean neurons alive at step 500. Baseline (no therapy): 9.4.
            Coupled therapy alone (T=150): ~14.8 — ATP restore adds noise, no trend.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={RESTORE_DATA} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="pct" tickFormatter={(v: any) => `${v}%`} tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis domain={[0, 30]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
                formatter={(v: any) => [`${(+v).toFixed(1)} neurons`, "Plateau"]}
                labelFormatter={(l: any) => `Restore ${l}%`} />
              <Line type="monotone" dataKey="plateau" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Plateau survivors" />
              <ReferenceLine y={9.4} stroke="#9ca3af" strokeDasharray="4 4"
                label={{ value: "Baseline 9.4", fill: "#9ca3af", fontSize: 9, position: "right" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Actual ATP Boost Applied</h3>
          <p className="text-xs text-gray-500 mb-2">
            Mean ATP delta at T=150 (after restore − before). Full restore raises mean ATP
            from 0.791 to 1.000 (+0.209), but this is immediately undone by aggregation dynamics.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={RESTORE_DATA} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="pct" tickFormatter={(v: any) => `${v}%`} tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v: any) => `+${v.toFixed(2)}`} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
                formatter={(v: any) => [`+${(+v).toFixed(3)} ATP units`, "Delta"]}
                labelFormatter={(l: any) => `Restore ${l}%`} />
              <Bar dataKey="delta" fill="#22d3ee" opacity={0.8} radius={[3, 3, 0, 0]} name="ATP boost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mechanistic explanation */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Mechanistic Analysis: Why ATP Is a Proxy Variable
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-yellow-400 font-bold mb-1">Model ATP equation</div>
            <div className="text-gray-400 leading-relaxed">
              ATP equilibrates toward a target set by aggregation:<br />
              <code className="text-cyan-300">atp_target = 1 − 1.10 × agg</code><br />
              At mean agg=0.246: target = <strong className="text-white">{ATP_TARGET.toFixed(3)}</strong><br />
              Decay rate: <code className="text-cyan-300">0.04/step</code>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-red-400 font-bold mb-1">No aggregation decay</div>
            <div className="text-gray-400 leading-relaxed">
              Aggregation has NO decay term in this model. Existing agg=0.246 at T=150 cannot
              decrease — it only grows. Even with ISR=0.20 and TSSE=0.20, the cascade sustains
              itself through existing agg spread.
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-green-400 font-bold mb-1">Implication for R4.1</div>
            <div className="text-gray-400 leading-relaxed">
              R4.1&apos;s best predictor "mean ATP" (r=−0.77) was a proxy for mean aggregation
              accumulation. ATP tracks aggregation via the target equation. Restoring ATP without
              removing aggregation is ineffective.
            </div>
          </div>
        </div>
      </div>

      {/* R4.1 vs R4.2 comparison */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          R4.1 vs R4.2 — Two Types of Rescue Failure
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs font-bold text-orange-400 mb-1">R4.1 — Timing Cliff</div>
            <div className="text-xs text-gray-400 leading-relaxed">
              90% coupled suppression fails after T=100 (PONR). The system has accumulated enough
              aggregation by step 100 that even maximum therapy cannot stop the cascade. ATP at
              T_start was the best predictor (r=−0.77) — a proxy for accumulated agg.
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs font-bold text-green-400 mb-1">R4.2 — Null Result</div>
            <div className="text-xs text-gray-400 leading-relaxed">
              ATP restoration (0%–100%) at T=150 has zero effect on rescue. Confirms that at
              T=150, the cascade failure is driven by accumulated aggregation (0.246 mean), NOT by
              ATP depletion. Rescue window cannot be reopened by ATP alone in this model.
            </div>
          </div>
        </div>
        <div className="mt-3 bg-gray-800 rounded-lg p-3">
          <div className="text-xs font-bold text-cyan-400 mb-1">Combined Picture (within this computational framework)</div>
          <div className="text-xs text-gray-400 leading-relaxed">
            Three independent constraints govern therapeutic efficacy in this model:
            (1) <strong className="text-yellow-300">Potency cliff</strong> (R3.9): &ge;96.5% ISR suppression required;
            (2) <strong className="text-orange-300">Timing cliff</strong> (R4.1): therapy fails after step 100;
            (3) <strong className="text-red-300">Aggregation lock-in</strong> (R4.2): accumulated agg cannot be addressed
            by ATP restoration — aggregation is the true downstream barrier.
          </div>
        </div>
      </div>

      {/* Full results table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 overflow-x-auto">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Full Results Table (N=50 seeds per level, T=150)
        </h3>
        <table className="w-full text-xs text-center min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-1 px-2 text-gray-400">Restore %</th>
              <th className="py-1 px-2 text-gray-400">Genuine rate</th>
              <th className="py-1 px-2 text-gray-400">Benefit</th>
              <th className="py-1 px-2 text-gray-400">Plateau</th>
              <th className="py-1 px-2 text-gray-400">ATP before</th>
              <th className="py-1 px-2 text-gray-400">ATP after</th>
              <th className="py-1 px-2 text-gray-400">Delta</th>
              <th className="py-1 px-2 text-gray-400">Effect</th>
            </tr>
          </thead>
          <tbody>
            {RESTORE_DATA.map(row => (
              <tr key={row.pct} className="border-b border-gray-800 hover:bg-gray-800/40">
                <td className="py-1 px-2 font-mono">{row.pct}%</td>
                <td className="py-1 px-2 font-mono text-red-400">{(row.gtr * 100).toFixed(1)}%</td>
                <td className="py-1 px-2 font-mono">{row.benefit.toFixed(3)}</td>
                <td className="py-1 px-2 font-mono">{row.plateau.toFixed(1)}</td>
                <td className="py-1 px-2 font-mono text-gray-500">{row.atp_before.toFixed(3)}</td>
                <td className="py-1 px-2 font-mono text-cyan-400">{row.atp_after.toFixed(3)}</td>
                <td className="py-1 px-2 font-mono text-green-400">+{row.delta.toFixed(3)}</td>
                <td className="py-1 px-2 text-gray-500 italic">none</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Limitations</h3>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>ATP restoration is a model-level operation, not a representation of any real-world therapy.</li>
          <li>The "no aggregation decay" model property is a design choice — real protein aggregates can be cleared by autophagy/proteasome; this model does not include clearance.</li>
          <li>A more realistic extension would test direct aggregation clearance (future phase).</li>
          <li>Not peer-reviewed. All results are hypothesis-generating computational observations.</li>
        </ul>
      </div>

    </div>
  );
}

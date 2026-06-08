"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
  BarChart, Bar, Cell,
} from "recharts";

// ── Data (from r4_1_results.json, N=50 seeds per onset) ──────────────────────

const ONSET_DATA = [
  { t: 0,   gtr: 0.000, lo: 0.000, hi: 0.000, benefit: 0.961, plateau: 53.0, fdur: 500, agg: 0.004, atp: 1.000 },
  { t: 25,  gtr: 0.040, lo: 0.000, hi: 0.100, benefit: 0.910, plateau: 45.7, fdur: 500, agg: 0.028, atp: 0.987 },
  { t: 50,  gtr: 0.200, lo: 0.100, hi: 0.300, benefit: 0.720, plateau: 32.9, fdur: 500, agg: 0.056, atp: 0.964 },
  { t: 75,  gtr: 0.522, lo: 0.380, hi: 0.660, benefit: 0.454, plateau: 24.1, fdur: 500, agg: 0.089, atp: 0.934 },
  { t: 100, gtr: 0.938, lo: 0.860, hi: 1.000, benefit: 0.181, plateau: 19.4, fdur: 421, agg: 0.130, atp: 0.897 },
  { t: 125, gtr: 0.979, lo: 0.940, hi: 1.000, benefit: 0.095, plateau: 16.2, fdur: 300, agg: 0.181, atp: 0.851 },
  { t: 150, gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.047, plateau: 14.8, fdur: 224, agg: 0.246, atp: 0.791 },
  { t: 175, gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.027, plateau: 13.4, fdur: 224, agg: 0.302, atp: 0.737 },
  { t: 200, gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.019, plateau: 12.3, fdur: 224, agg: 0.286, atp: 0.743 },
  { t: 225, gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.013, plateau: 11.8, fdur: 224, agg: 0.208, atp: 0.807 },
  { t: 250, gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.014, plateau: 11.7, fdur: 224, agg: 0.186, atp: 0.822 },
  { t: 300, gtr: 1.000, lo: 1.000, hi: 1.000, benefit: 0.007, plateau: 10.5, fdur: 224, agg: 0.131, atp: 0.868 },
];

const FEATURE_DATA = [
  { name: "Mean ATP",          r: -0.768, abs: 0.768 },
  { name: "Mean aggregation",  r: +0.751, abs: 0.751 },
  { name: "Network agg load",  r: +0.729, abs: 0.729 },
  { name: "Mean toxicity",     r: +0.682, abs: 0.682 },
  { name: "Dead neurons",      r: +0.415, abs: 0.415 },
  { name: "Irreversible",      r: +0.099, abs: 0.099 },
  { name: "Coherence r",       r: -0.013, abs: 0.013 },
];

const T50_RESCUE = 73.3;
const PONR       = 100;
const BASELINE_GTR = 1.000;
const BASELINE_PLATEAU = 9.4;
const BASELINE_FDUR    = 224.2;

// ── Component ─────────────────────────────────────────────────────────────────

export default function Round4DynamicWindow() {
  return (
    <div className="space-y-6 text-sm text-gray-200">

      {/* Disclaimer */}
      <div className="bg-amber-950 border border-amber-800 rounded-xl p-3 text-xs text-amber-200">
        <strong>Model-specific finding.</strong> All results are from the v2.0 DecoupledSimulator
        (ISR=2.0, TSSE=2.0; C.&nbsp;elegans motor connectome). This is NOT a clinical ALS model.
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "T50 rescue",     value: "73.3 steps",    sub: "CI [64, 81]",         color: "#f59e0b" },
          { label: "Point of no return", value: "Step 100",  sub: "100% tipping resumes", color: "#ef4444" },
          { label: "Rescue shape",   value: "CLIFF-LIKE",    sub: "max Δ = 0.42 at T75→100", color: "#e879f9" },
          { label: "Best predictor", value: "Mean ATP",      sub: "r = −0.77 (inverse)", color: "#22d3ee" },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className="text-lg font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Fig 1: genuine tipping rate vs onset */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Rescue Probability vs Treatment Onset
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Genuine tipping rate (N=50 seeds) with 95% bootstrap CI. Therapy: 90% coupled ISR+TSSE
          suppression (strongest from R3.10). T50={T50_RESCUE} steps, PONR=step {PONR}.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={ONSET_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="t" label={{ value: "Treatment onset (step)", position: "insideBottom", offset: -4, fill: "#9ca3af", fontSize: 11 }} tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis domain={[0, 1.05]} tickFormatter={(v: any) => `${(v * 100).toFixed(0)}%`}
              label={{ value: "Genuine tipping rate", angle: -90, position: "insideLeft", offset: 12, fill: "#9ca3af", fontSize: 11 }}
              tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
              formatter={(v: any, name: any) => [`${(+v * 100).toFixed(1)}%`, name]}
              labelFormatter={(l: any) => `T_start = ${l} steps`}
            />
            <Area type="monotone" dataKey="hi" stroke="none" fill="#ef4444" fillOpacity={0.12} legendType="none" name="CI hi" />
            <Area type="monotone" dataKey="lo" stroke="none" fill="#1f2937"  fillOpacity={1.0}  legendType="none" name="CI lo" />
            <Line type="monotone" dataKey="gtr" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Genuine tipping rate" />
            <ReferenceLine y={0.5} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: "50%", fill: "#9ca3af", fontSize: 10, position: "right" }} />
            <ReferenceLine x={T50_RESCUE} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `T50=${T50_RESCUE}`, fill: "#f59e0b", fontSize: 10, position: "top" }} />
            <ReferenceLine x={PONR}       stroke="#ef4444" strokeDasharray="4 4" label={{ value: `PONR=${PONR}`,       fill: "#ef4444", fontSize: 10, position: "top" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Fig 2: benefit score + plateau */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Therapeutic Benefit Score</h3>
          <p className="text-xs text-gray-500 mb-2">
            Composite (W_TIP=0.40, W_DEL=0.20, W_PLT=0.25, W_SUR=0.15) vs untreated baseline.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ONSET_DATA} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="t" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis domain={[0, 1.0]} tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v: any) => v.toFixed(1)} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
                formatter={(v: any) => [v.toFixed(3), "Benefit"]}
                labelFormatter={(l: any) => `T_start = ${l}`}
              />
              <Bar dataKey="benefit" name="Benefit score" radius={[3, 3, 0, 0]}>
                {ONSET_DATA.map((d, i) => (
                  <Cell key={i} fill={d.t <= T50_RESCUE ? "#22d3ee" : d.t <= PONR ? "#f59e0b" : "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#22d3ee" }} /> T &le; T50 (rescue zone)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#f59e0b" }} /> T50 &lt; T &le; PONR (cliff)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#6b7280" }} /> T &gt; PONR (failed)</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Plateau Survivors vs Onset</h3>
          <p className="text-xs text-gray-500 mb-2">
            Mean neurons alive at step 500. Baseline (no therapy): {BASELINE_PLATEAU} neurons.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ONSET_DATA} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="t" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis domain={[0, 62]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
                formatter={(v: any) => [`${(+v).toFixed(1)} neurons`, "Plateau survivors"]}
                labelFormatter={(l: any) => `T_start = ${l}`}
              />
              <Line type="monotone" dataKey="plateau" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Plateau survivors" />
              <ReferenceLine y={BASELINE_PLATEAU} stroke="#9ca3af" strokeDasharray="4 4"
                label={{ value: `Baseline ${BASELINE_PLATEAU}`, fill: "#9ca3af", fontSize: 9, position: "right" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* State vars at T_start */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
          System State at Intervention Time
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Network state when therapy is applied. Mean across 50 seeds. The ATP drop and aggregation
          accumulation mark the transition zone where rescue fails.
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={ONSET_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="t" tick={{ fill: "#9ca3af", fontSize: 10 }} label={{ value: "Treatment onset (step)", position: "insideBottom", offset: -4, fill: "#9ca3af", fontSize: 11 }} />
            <YAxis yAxisId="l" domain={[0, 1.05]} tick={{ fill: "#9ca3af", fontSize: 10 }} label={{ value: "ATP / aggregation (0–1)", angle: -90, position: "insideLeft", offset: 12, fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
              formatter={(v: any, n: any) => [(+v).toFixed(3), n]}
              labelFormatter={(l: any) => `T_start = ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <Line yAxisId="l" type="monotone" dataKey="atp" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} name="Mean ATP" />
            <Line yAxisId="l" type="monotone" dataKey="agg" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} name="Mean aggregation" />
            <ReferenceLine yAxisId="l" x={T50_RESCUE} stroke="#f59e0b" strokeDasharray="4 4" />
            <ReferenceLine yAxisId="l" x={PONR}       stroke="#ef4444" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Feature importance */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
          Feature Importance: State Variables vs Rescue Outcome
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Point-biserial Pearson r between each state variable at T_start and is_genuine across
          all 600 (seed, onset) pairs. Positive = higher value predicts cascade still tipping;
          negative = higher value predicts rescue success.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={FEATURE_DATA} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" domain={[0, 0.85]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} width={100} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
              formatter={(v: any, _n: any, props: any) => {
                const row = props.payload as typeof FEATURE_DATA[0];
                return [`r = ${row.r > 0 ? "+" : ""}${row.r.toFixed(3)}`, "Pearson r"];
              }}
            />
            <Bar dataKey="abs" radius={[0, 3, 3, 0]}>
              {FEATURE_DATA.map((d, i) => (
                <Cell key={i} fill={d.r > 0 ? "#ef4444" : "#22d3ee"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: "#22d3ee" }} />Negative r = high value predicts rescue (e.g. high ATP → rescue succeeds)</span>
          <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: "#ef4444" }} />Positive r = high value predicts failure (e.g. high aggregation → rescue fails)</span>
        </div>
      </div>

      {/* Comparison with R3.9 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Potency vs Timing: R3.9 and R4.1 Together
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs font-bold text-yellow-400 mb-1">R3.9 — Potency Cliff</div>
            <div className="text-xs text-gray-400">
              At T=0 (maximum timing advantage), ISR suppression still requires{" "}
              <strong className="text-white">96.5%</strong> to achieve 50% tipping reduction.
              Below 85%, benefit is near-zero. Verdict: SHARP_CLIFF.
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs font-bold text-red-400 mb-1">R4.1 — Timing Cliff</div>
            <div className="text-xs text-gray-400">
              At 90% potency (near-maximum), rescue still fails after step{" "}
              <strong className="text-white">{PONR}</strong>. T50_rescue =&nbsp;
              <strong className="text-white">{T50_RESCUE} steps</strong>. Verdict: NARROW_RESCUE_WINDOW.
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Within this computational framework, potency and timing impose <em>independent</em> constraints.
          Near-complete suppression applied too late still fails (R4.1); early intervention with
          insufficient potency also fails (R3.9). These findings are model-specific and hypothesis-generating
          only.
        </p>
      </div>

      {/* Full onset table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 overflow-x-auto">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Full Onset Results (N=50 seeds, 90% coupled suppression)
        </h3>
        <table className="w-full text-xs text-center min-w-[560px]">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-1 px-2 text-gray-400">T_start</th>
              <th className="py-1 px-2 text-gray-400">Genuine rate</th>
              <th className="py-1 px-2 text-gray-400">95% CI</th>
              <th className="py-1 px-2 text-gray-400">Benefit</th>
              <th className="py-1 px-2 text-gray-400">Plateau</th>
              <th className="py-1 px-2 text-gray-400">Zone</th>
            </tr>
          </thead>
          <tbody>
            {ONSET_DATA.map(row => {
              const zone = row.t <= T50_RESCUE ? "Rescue"
                         : row.t <= PONR       ? "Cliff"
                         :                       "Failed";
              const zoneColor = zone === "Rescue" ? "#22d3ee" : zone === "Cliff" ? "#f59e0b" : "#6b7280";
              return (
                <tr key={row.t} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="py-1 px-2 font-mono">{row.t}</td>
                  <td className="py-1 px-2 font-mono">{(row.gtr * 100).toFixed(1)}%</td>
                  <td className="py-1 px-2 font-mono text-gray-500">[{(row.lo*100).toFixed(0)}%, {(row.hi*100).toFixed(0)}%]</td>
                  <td className="py-1 px-2 font-mono">{row.benefit.toFixed(3)}</td>
                  <td className="py-1 px-2 font-mono">{row.plateau.toFixed(1)}</td>
                  <td className="py-1 px-2 font-bold" style={{ color: zoneColor }}>{zone}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Key Finding */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Key Finding</h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          The strongest therapy identified in R3.10 (90% coupled ISR+TSSE suppression)
          has a <strong className="text-yellow-400">narrow rescue window</strong> in this model (T50=73 steps).
          After step 100 (the point of no return), tipping resumes at 100% even under near-maximum suppression.
          The rescue response is <strong className="text-pink-400">cliff-like</strong> — a step change
          between T=75 (52% tipping) and T=100 (94% tipping; Δ=0.42). The best predictor of rescue failure
          is <strong className="text-cyan-400">mean ATP depletion</strong> at the time of intervention
          (r=−0.77): once ATP has dropped, the cascade is self-sustaining regardless of ISR suppression.
        </p>
        <p className="text-xs text-gray-500 mt-2 italic">
          Model-specific result. Not a clinical ALS finding. All results are
          hypothesis-generating computational observations on a <em>C.&nbsp;elegans</em> motor circuit model.
        </p>
      </div>

    </div>
  );
}

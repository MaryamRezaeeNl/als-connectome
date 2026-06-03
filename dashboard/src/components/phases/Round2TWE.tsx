"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// TWE model accuracy
const MODEL_METRICS = [
  { target: "Simulated subtype", metric: "Accuracy", value: 87.0,  unit: "%",    color: "#00e5ff", r: null,  rmse: null, rmse_unit: "" },
  { target: "Tipping step",   metric: "r",        value: 0.689, unit: "",     color: "#ffd700", r: 0.689, rmse: 53.3, rmse_unit: "steps (120 days)" },
  { target: "Window width",   metric: "r",        value: 0.724, unit: "",     color: "#a8ff78", r: 0.724, rmse: 44.4, rmse_unit: "steps (100 days)" },
  { target: "Success prob",   metric: "r",        value: 0.572, unit: "",     color: "#fb923c", r: 0.572, rmse: 0.35, rmse_unit: "(probability)" },
];

// Strategy distribution
const STRATEGIES = [
  { id: "A", label: "A: Aggressive",        pct: 38.5, n: 95,  color: "#ff4444", str: 0.90, start: 0,
    desc: "Fast-tipping OR window<50 — immediate high-strength aggregation suppression" },
  { id: "B", label: "B: Topology-neutral",  pct:  0.0, n:  0,  color: "#9ca3af", str: 0.70, start: 50,
    desc: "Never assigned — success_prob>0.6 condition unmet at str=0.50, t=50" },
  { id: "C", label: "C: Supportive",        pct: 24.3, n: 60,  color: "#a8ff78", str: 0.50, start: 100,
    desc: "Slow-tipping AND window>100 AND plateau_pred>20 — gentle delayed therapy" },
  { id: "D", label: "D: Combination",       pct: 37.2, n: 92,  color: "#ffd700", str: 0.80, start: 0,
    desc: "Borderline subtype probability (0.30-0.70) — hedged early approach" },
];

// Survival comparison
const survivalData = [
  { name: "Baseline\n(no therapy)", alive: 18.68, color: "#374151" },
  { name: "TWE\nrecommended",       alive: 48.99, color: "#00e5ff" },
  { name: "Oracle\noptimal",        alive: 53.61, color: "#a8ff78" },
];

// Uncertainty decomposition
const UNCERTAINTY = [
  { source: "Parameter variance", pct: 71.7, var_val: 2669.80, color: "#ffd700",
    note: "Within-subtype aggAmp heterogeneity — dominant source. Adding features or t=75 dynamics may reduce." },
  { source: "Subtype ambiguity",  pct: 27.4, var_val: 1020.69, color: "#fb923c",
    note: "13% of configs misclassified. Improving classifier (serial early-warning signals) would reduce." },
  { source: "Stochastic noise",   pct:  0.9, var_val:   34.87, color: "#a855f7",
    note: "Phase-7B seed variance. Irreducible floor — cannot be improved." },
];

// Calibration curve data
const CALIBRATION = [
  { conf: "0.50-0.60", n: 35,  acc: 65.7 },
  { conf: "0.60-0.70", n: 44,  acc: 75.0 },
  { conf: "0.70-0.80", n: 78,  acc: 94.9 },
  { conf: "0.80-0.90", n: 24,  acc: 100.0 },
  { conf: "0.90-1.00", n: 59,  acc: 100.0 },
];

export default function Round2TWE() {
  const oracleGain = 34.93;
  const tweGain = 30.31;
  const regret = 4.62;
  const oracleEfficiency = (tweGain / oracleGain * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Simulated subtype accuracy", value: "87.0%",   sub: "10-fold CV OOF",        color: "#00e5ff" },
          { label: "Triage accuracy",      value: "44.1%",   sub: "exact strategy match",  color: "#ffd700" },
          { label: "Oracle efficiency",    value: "86.8%",   sub: "of max achievable gain", color: "#a8ff78" },
          { label: "Decision regret",      value: "4.62",    sub: "neurons lost vs oracle", color: "#ff4444" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Survival comparison */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Virtual Triage: Survival Outcomes</h3>
          <p className="text-xs text-gray-500 mb-3">
            Mean alive_at_300 across 247 configs, 3 seeds — TWE captures {oracleEfficiency}% of oracle benefit
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={survivalData} margin={{ top: 5, right: 20, bottom: 30, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis domain={[0, 61]} tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Alive at t=300", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(2), "neurons alive"]} />
              <ReferenceLine y={61} stroke="#374151" strokeDasharray="3 3"
                label={{ value: "Max (61)", fill: "#6b7280", fontSize: 9 }} />
              <Bar dataKey="alive" radius={[3, 3, 0, 0]}>
                {survivalData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-gray-500">Baseline</div>
              <div className="font-mono text-white">18.68</div>
            </div>
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-cyan-400">TWE gain</div>
              <div className="font-mono text-white">+{tweGain.toFixed(2)}</div>
            </div>
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-red-400">Regret</div>
              <div className="font-mono text-white">{regret.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Strategy distribution */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Strategy Distribution (N=247)</h3>
          <p className="text-xs text-gray-500 mb-3">
            Strategy B never assigned — success_prob threshold too high for tested therapy regime
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={STRATEGIES.map(s => ({ id: s.id, pct: s.pct, n: s.n, color: s.color }))}
              margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="id" tick={{ fontSize: 12, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} unit="%" />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(1) + "%", "configs"]} />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                {STRATEGIES.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {STRATEGIES.map(s => (
              <div key={s.id} className="flex items-start gap-2 text-xs">
                <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: s.color, color: "#000" }}>{s.id}</span>
                <span className={`flex-1 ${s.n === 0 ? "text-gray-500" : "text-gray-400"}`}>
                  {s.label}: <span className="font-mono">{s.n} configs ({s.pct}%)</span>
                  {s.n === 0 && <span className="text-orange-500 ml-1">(unassigned — success_prob threshold too high for tested therapy regime)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Uncertainty decomposition */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">Uncertainty Decomposition (tipping_step)</h3>
        <p className="text-xs text-gray-500 mb-3">RMSE = 53.3 steps — decomposed into 3 sources</p>
        <div className="space-y-3">
          {UNCERTAINTY.map(u => (
            <div key={u.source} className="p-3 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-200">{u.source}</span>
                <span className="text-xs font-mono font-bold" style={{ color: u.color }}>{u.pct}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded mb-1">
                <div className="h-2 rounded" style={{ width: `${u.pct}%`, background: u.color }} />
              </div>
              <p className="text-xs text-gray-400">{u.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Model accuracy + calibration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">TWE Model Accuracy Summary</h3>
          <div className="space-y-2">
            {MODEL_METRICS.map(m => (
              <div key={m.target} className="flex items-center gap-3 p-2 bg-gray-800 rounded">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                <span className="text-xs text-gray-300 w-28 flex-shrink-0">{m.target}</span>
                <span className="font-mono text-xs font-bold flex-shrink-0" style={{ color: m.color }}>
                  {m.target === "Subtype" ? `${m.value}%` : m.value.toFixed(3)}
                </span>
                {m.rmse && (
                  <span className="text-xs text-gray-500 ml-auto">RMSE: {m.rmse} {m.rmse_unit}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Confidence Calibration</h3>
          <p className="text-xs text-gray-500 mb-3">
            5/5 bins calibrated — high-confidence predictions are actually more accurate
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={CALIBRATION} margin={{ top: 5, right: 20, bottom: 20, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="conf" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-10} textAnchor="end" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} unit="%" />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(1) + "%", "accuracy"]} />
              <ReferenceLine y={80} stroke="#4b5563" strokeDasharray="3 3"
                label={{ value: "80%", fill: "#6b7280", fontSize: 9 }} />
              <Bar dataKey="acc" fill="#00e5ff" radius={[3, 3, 0, 0]} name="Accuracy" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Honest limitations:</strong> (1) Simulation-only — no human ALS data. (2) Strategy B never assigned —
        classifier needs recalibration (success_prob threshold too high). (3) 37.2% of patients fall in borderline
        strategy D (unresolvable uncertainty at t=50). (4) All 4 strategies modelled as agg_sup variants only.
        (5) Single seed per feature extraction underestimates biological stochasticity.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding:</strong> The TWE framework achieves <strong>86.8% of the oracle-defined benefit within this simulation framework</strong>
        (+30.31 neurons vs +34.93 oracle) using only 3 pre-symptomatic simulated early-warning proxies at t=50.
        Despite only 44.1% exact strategy match, the framework is highly efficient because strategy misassignments
        often cause minimal survival loss. Simulated subtype classification (87.0%) and confidence calibration (5/5 bins)
        are strong enough for decision support in familial ALS surveillance program simulations.
      </div>
    </div>
  );
}




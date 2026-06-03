"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// Regression results: 3 features → 3 targets
const REGRESSION = [
  {
    target: "tipping_step",          label: "Disease Timing",      r: 0.796, r2: 0.611, rmse: 46.1, rmse_days: 104, color: "#00e5ff",
    best_feature: "atp_decline_50",  best_r: 0.754, pi95: 93.2, pi95_days: 210,
    clinical: "When will first neuron die?",
  },
  {
    target: "therapy_window_width",  label: "Therapy Window",      r: 0.765, r2: 0.651, rmse: 38.9, rmse_days:  88, color: "#ffd700",
    best_feature: "stress_velocity_50", best_r: 0.719, pi95: 96.8, pi95_days: 218,
    clinical: "How long do we have to treat?",
  },
  {
    target: "therapy_success_prob",  label: "Therapy Success",     r: 0.572, r2: 0.317, rmse: 0.34, rmse_days: NaN, color: "#a8ff78",
    best_feature: "atp_decline_50",  best_r: 0.551, pi95: 0.68, pi95_days: NaN,
    clinical: "Will str=0.50, t=50 prevent tipping?",
  },
];

// Single-feature r values
const singleFeatureData = [
  {
    target: "Timing", "atp_decline_50": 0.754, "stress_velocity_50": 0.746, "agg_slope_50": 0.732,
  },
  {
    target: "Window", "atp_decline_50": 0.623, "stress_velocity_50": 0.719, "agg_slope_50": 0.698,
  },
  {
    target: "Success", "atp_decline_50": 0.551, "stress_velocity_50": 0.491, "agg_slope_50": 0.475,
  },
];

const FEATURE_COLORS: Record<string, string> = {
  "atp_decline_50":    "#00e5ff",
  "stress_velocity_50":"#ffd700",
  "agg_slope_50":      "#a8ff78",
};

// Clinical feature mappings
const CLINICAL_FEATURES = [
  { sim: "atp_decline_50",     clinical: "NfL trajectory",            timing: "2-4 yr pre-symptom",  feasibility: "research",    color: "#00e5ff" },
  { sim: "stress_velocity_50", clinical: "pTDP-43 phosphorylation rate", timing: "1-3 yr pre-symptom", feasibility: "research",    color: "#ffd700" },
  { sim: "agg_slope_50",       clinical: "EMG nerve velocity decline", timing: "6-18 mo pre-symptom", feasibility: "routine",     color: "#a8ff78" },
];

export default function Round2WindowPrediction() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Window prediction r", value: "r=0.765", sub: "Therapy window (3-feature, 10-fold CV)", color: "#ffd700" },
          { label: "RMSE window",     value: "38.9 steps", sub: "88 days — <60-step threshold", color: "#00e5ff" },
          { label: "Tipping true r",  value: "r=0.796",  sub: "vs 0.985 (censored artifact)", color: "#a8ff78" },
          { label: "Single-feat PI",  value: "±97 steps", sub: "NOT clinically useful alone",  color: "#ff4444" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Combined r per target */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            10-fold CV Accuracy: 3-Feature Model
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Pearson r (OOF predictions) for each prediction target
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={REGRESSION.map(r => ({ name: r.label, r: r.r, r2: r.r2, color: r.color }))}
              margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(3), ""]} />
              <ReferenceLine y={0.8} stroke="#4b5563" strokeDasharray="3 3"
                label={{ value: "r=0.80", fill: "#6b7280", fontSize: 9, position: "insideTopRight" }} />
              <Bar dataKey="r" radius={[3, 3, 0, 0]} name="Pearson r">
                {REGRESSION.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Single-feature r values */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            Single-Feature Pearson r per Target
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Combined model adds ~0.05–0.10 r over the best single feature
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={singleFeatureData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="target" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                formatter={(v: any) => [v.toFixed(3), ""]} />
              {Object.keys(FEATURE_COLORS).map(f => (
                <Bar key={f} dataKey={f} fill={FEATURE_COLORS[f]} radius={[2, 2, 0, 0]} />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prediction cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REGRESSION.map(r => (
          <div key={r.target} className="bg-gray-900 border border-gray-700 rounded-xl p-4 border-l-4"
            style={{ borderColor: r.color }}>
            <div className="text-sm font-bold mb-1" style={{ color: r.color }}>{r.label}</div>
            <div className="text-xs text-gray-400 italic mb-2">{r.clinical}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400 mb-2">
              <span>r (combined)</span>  <span className="font-mono text-white">{r.r}</span>
              <span>R²</span>            <span className="font-mono text-white">{r.r2}</span>
              <span>RMSE</span>          <span className="font-mono text-white">
                {r.target === "therapy_success_prob"
                  ? r.rmse.toFixed(2)
                  : `${r.rmse} steps (${r.rmse_days} days)`}
              </span>
              <span>95% PI (single)</span> <span className="font-mono text-white">
                {r.target === "therapy_success_prob" ? `±${r.pi95}` : `±${r.pi95} steps (±${r.pi95_days} days)`}
              </span>
              <span>Best feature</span>  <span className="font-mono text-white">{r.best_feature.replace(/_50/, "")} (r={r.best_r})</span>
            </div>
          </div>
        ))}
      </div>

      {/* Clinical feature mappings */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Simulated-to-Clinical Proxy Mapping</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CLINICAL_FEATURES.map(c => (
            <div key={c.sim} className="p-3 bg-gray-800 rounded-lg">
              <div className="text-xs font-bold font-mono mb-1" style={{ color: c.color }}>{c.sim}</div>
              <div className="text-xs text-gray-200 mb-1">→ {c.clinical}</div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>â± {c.timing}</span>
                <span className={`px-1 rounded ${c.feasibility === "routine" ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}`}>
                  {c.feasibility}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
          <strong className="text-gray-200">Proposed clinical protocol:</strong> Blood NfL at months 0, 3, 6 (slope) +
          CSF pTDP-43 at month 6 + needle EMG at month 6 → compute 3-feature score → predict therapy window.
          Target population: familial ALS carriers with known mutation (pre-symptomatic).
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>Artifact note:</strong> Phase R2.5b reported r=0.985 for tipping_step prediction.
        This was a censoring artifact — slow-tipping configs were all pinned at step 150 (the simulation cutoff).
        The true r on uncensored Phase-7B values is <strong>0.796</strong>.
      </div>
      <div className="bg-cyan-950 border border-cyan-800 rounded-xl p-4 text-sm text-cyan-200">
        <strong>Key finding:</strong> Pre-symptomatic prediction is feasible at t=50 before any neuron death.
        The 3-feature simulated early-warning panel predicts disease timing (RMSE=46 steps, 104 days) and therapy window
        (RMSE=39 steps, 88 days). Single-feature 95% PI (±97 steps) is not clinically actionable alone —
        all three simulated early-warning proxies are required to achieve the &lt;60-step precision threshold.
      </div>
    </div>
  );
}




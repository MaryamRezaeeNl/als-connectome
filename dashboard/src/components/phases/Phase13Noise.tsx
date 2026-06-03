"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

// Pre-computed Phase 13 + Phase 14 data
const NOISE_RESULTS = [
  {
    category: "Synaptic Weight Noise",
    shortName: "Weight",
    levels: ["Ïƒ=5%", "Ïƒ=10%", "Ïƒ=20%"],
    tippingDrift: [0.1, 0.1, 0.2],
    coherenceChange: [0.3, 0.5, 0.7],
    genuineRate: [1.0, 1.0, 1.0],
    verdict: "ROBUST",
    color: "#a8ff78",
  },
  {
    category: "Vulnerability Score Noise",
    shortName: "Vuln",
    levels: ["Ïƒ=0.05", "Ïƒ=0.10", "Ïƒ=0.20"],
    tippingDrift: [0.2, 0.3, 0.6],
    coherenceChange: [1.1, 2.1, 3.5],
    genuineRate: [1.0, 1.0, 1.0],
    verdict: "ROBUST",
    color: "#a8ff78",
  },
  {
    category: "Connectome Edge Dropout",
    shortName: "Dropout",
    levels: ["2%", "5%", "10%"],
    tippingDrift: [0.5, 1.0, 1.9],
    coherenceChange: [0.6, 1.2, 2.1],
    genuineRate: [1.0, 1.0, 1.0],
    verdict: "ROBUST",
    color: "#a8ff78",
  },
  {
    category: "Per-Neuron Amp Heterogeneity",
    shortName: "Heterog.",
    levels: ["±20%"],
    tippingDrift: [0.9],
    coherenceChange: [1.0],
    genuineRate: [1.0],
    verdict: "ROBUST",
    color: "#a8ff78",
    spearmanR: 0.976,
  },
];

// Phase 14: breaking point data
const BREAKING_DATA = [
  { metric: "Genuine tipping rate", dropout30: 0.45, dropout50: 0.30, dropout70: 0.10, vuln050: 0.42, vuln100: 0.20, threshold: 0.5 },
  { metric: "Spatial coherence r", dropout30: 0.22, dropout50: 0.15, dropout70: 0.08, vuln050: 0.21, vuln100: 0.12, threshold: 0.3 },
  { metric: "Subtype rank (Spearman r)", dropout30: 1.00, dropout50: 0.95, dropout70: 0.90, vuln050: 1.00, vuln100: 1.00, threshold: 0.5 },
];

const BREAKING_POINTS = [
  { property: "Genuine tipping rate", dropout: "30%", noise: "Ïƒ=0.50", color: "#ff4444" },
  { property: "Spatial coherence r", dropout: "30%", noise: "Ïƒ=0.50", color: "#ff9944" },
  { property: "Subtype rank order", dropout: "NOT REACHED", noise: "NOT REACHED", color: "#a8ff78" },
];

const RADAR_DATA = [
  { property: "Weight noise", robust: 95 },
  { property: "Vuln noise", robust: 88 },
  { property: "Dropout 10%", robust: 90 },
  { property: "Heterogeneity", robust: 96 },
  { property: "Dropout 30%", robust: 30 },
  { property: "Dropout 70%", robust: 8 },
  { property: "Vuln Ïƒ=1.0", robust: 15 },
];

export default function Phase13Noise() {
  return (
    <div className="space-y-6">
      {/* Robustness overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Max metric change", value: "<4%", sub: "across all plausible noise", color: "#a8ff78" },
          { label: "Genuine rate at all levels", value: "1.000", sub: "Phase 13", color: "#a8ff78" },
          { label: "Subtype rank (heterog.)", value: "r=0.976", sub: "Spearman, ±20% heterog.", color: "#00e5ff" },
          { label: "Breaking point (dropout)", value: "30%", sub: "genuine rate + coherence", color: "#ff9944" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Phase 13 table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Phase 13: Biological Noise Robustness (Top-10 configs, 20 seeds each)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Perturbation</th>
                <th className="text-center py-2">Max Level</th>
                <th className="text-center py-2">Tipping drift</th>
                <th className="text-center py-2">Coherence Î"</th>
                <th className="text-center py-2">Genuine rate</th>
                <th className="text-center py-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {NOISE_RESULTS.map(r => (
                <tr key={r.category} className="border-b border-gray-800">
                  <td className="py-2 pr-4">{r.category}</td>
                  <td className="text-center">{r.levels[r.levels.length - 1]}</td>
                  <td className="text-center font-mono">{r.tippingDrift[r.tippingDrift.length - 1].toFixed(1)}%</td>
                  <td className="text-center font-mono">{r.coherenceChange[r.coherenceChange.length - 1].toFixed(1)}%</td>
                  <td className="text-center font-mono">{r.genuineRate[r.genuineRate.length - 1].toFixed(3)}</td>
                  <td className="text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: r.color, color: "#000" }}>
                      {r.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">Robustness threshold: relative change &lt;10%. Largest observed: 3.5% (coherence r under max vulnerability noise).</p>
      </div>

      {/* Phase 14: Breaking points */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Phase 14: Hierarchy of Dynamical Robustness</h3>
        <p className="text-xs text-gray-500 mb-4">Extreme perturbation (top-5 configs, 10 seeds, 300 steps). Breaking point = first level where metric crosses threshold.</p>

        {/* Breaking bar chart */}
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={BREAKING_DATA} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#9ca3af" }} angle={-10} textAnchor="end" height={50} />
            <YAxis domain={[0, 1.1]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="dropout30" name="Dropout 30%" fill="#ff6b6b" />
            <Bar dataKey="dropout70" name="Dropout 70%" fill="#7f1d1d" />
            <Bar dataKey="vuln050" name="Vuln Ïƒ=0.50" fill="#fbbf24" />
            <Bar dataKey="vuln100" name="Vuln Ïƒ=1.00" fill="#78350f" />
          </BarChart>
        </ResponsiveContainer>

        {/* Breaking points summary */}
        <div className="mt-4 space-y-2">
          <p className="text-xs text-gray-400 font-semibold">Breaking points:</p>
          {BREAKING_POINTS.map(bp => (
            <div key={bp.property} className="flex items-center gap-3 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: bp.color }} />
              <span className="text-gray-200 w-44">{bp.property}</span>
              <span className="text-gray-400">Edge dropout: <span className="font-mono text-white">{bp.dropout}</span></span>
              <span className="text-gray-400">Vuln noise: <span className="font-mono text-white">{bp.noise}</span></span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
          <strong className="text-gray-200">Key insight:</strong> Subtype rank ordering NEVER breaks within tested range —
          even at 70% edge dropout (largest component ≈20 nodes) and Ïƒ=1.00 vulnerability noise (near-complete randomisation).
          <strong className="text-green-400"> Within the tested perturbation range, the relative ordering of degeneration aggressiveness behaved as a dynamical invariant.</strong>
        </div>
      </div>

      {/* Robustness radar */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Robustness Profile</h3>
        <p className="text-xs text-gray-500 mb-3">Composite robustness score (100 = fully robust, 0 = broken) across all perturbation types</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={RADAR_DATA} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="#1e2a3a" />
            <PolarAngleAxis dataKey="property" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#6b7280" }} />
            <Radar name="Robustness %" dataKey="robust" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.25} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

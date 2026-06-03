"use client";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

// Pre-computed subtype data (Phase 11 + Phase 12)
// Phase 11: top-20 configs, 3 subtypes
const PHASE11_SUBTYPES = [
  { name: "Aggressive (n=3)", aggAmp: 1.64, tippingStep: 190, plateauSurvivors: 11, windowClosesT: 108, minStrength: 0.67, color: "#ff4444" },
  { name: "Moderate (n=13)", aggAmp: 1.39, tippingStep: 210, plateauSurvivors: 12, windowClosesT: 115, minStrength: 0.46, color: "#ffd700" },
  { name: "Mild (n=4)", aggAmp: 0.86, tippingStep: 240, plateauSurvivors: 15, windowClosesT: 200, minStrength: 0.10, color: "#a8ff78" },
];

// Phase 12: all 247 configs, 2 subtypes
const PHASE12_SUBTYPES = [
  { name: "Slow-tipping (n=110)", aggAmp: 1.36, tippingStep: 224, plateauSurvivors: 13.1, color: "#00e5ff" },
  { name: "Fast-tipping (n=137)", aggAmp: 5.86, tippingStep: 107, plateauSurvivors: 5.3, color: "#ff4444" },
];

// Simulated scatter data for Phase 12 (aggAmp vs tipping step, N~247)
// Two clusters: slow (aggAmp 0.1-2, tip 160-300) and fast (aggAmp 2-20, tip 40-160)
function makeClusterPoints(
  n: number,
  aggAmpMean: number,
  aggAmpSd: number,
  tipMean: number,
  tipSd: number,
  color: string,
  seed: number
) {
  let s = seed;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const box = () => {
    const u = Math.max(1e-12, rng()); const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return Array.from({ length: n }, () => ({
    aggAmp: Math.max(0.05, Math.exp(Math.log(aggAmpMean) + aggAmpSd * box())),
    tippingStep: Math.max(20, Math.min(400, tipMean + tipSd * box())),
    color,
  }));
}

const SCATTER_SLOW = makeClusterPoints(110, 1.36, 0.4, 224, 35, "#00e5ff", 42);
const SCATTER_FAST = makeClusterPoints(137, 5.86, 0.8, 107, 30, "#ff4444", 99);

const PCA_DATA = [
  { component: "PC1 (69.7%)", tippingStep: 0.44, silentLen: 0.44, plateau: 0.43, peakRate: 0.42, aggAmp: 0.41, mitFrag: 0.08 },
  { component: "PC2 (19.1%)", tippingStep: 0.08, silentLen: 0.07, plateau: 0.06, peakRate: 0.05, aggAmp: 0.12, mitFrag: 0.81 },
];

const PCA_FEATURES = ["tippingStep", "silentLen", "plateau", "peakRate", "aggAmp", "mitFrag"];
const PCA_FEATURE_LABELS: Record<string, string> = {
  tippingStep: "Tipping step",
  silentLen: "Silent length",
  plateau: "Plateau",
  peakRate: "Peak rate",
  aggAmp: "aggAmp",
  mitFrag: "mitFrag",
};

export default function Phase12Subtypes() {
  return (
    <div className="space-y-6">
      {/* Key findings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Genuine configs", value: "247", sub: "Phase 7B", color: "#00e5ff" },
          { label: "Optimal clusters", value: "K=2", sub: "Silhouette 0.41", color: "#ffd700" },
          { label: "aggAmp classification", value: "84.6%", sub: "single-param accuracy", color: "#a8ff78" },
          { label: "PC1 variance", value: "69.7%", sub: "disease-severity axis", color: "#a855f7" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Phase 12 scatter: aggAmp vs tipping step */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Phase 12: Disease Subtypes (N=247)</h3>
          <p className="text-xs text-gray-500 mb-3">
            Aggregation amplitude vs. tipping step — two clusters on simulation-only features (no therapy data)
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis type="number" dataKey="aggAmp" name="aggAmp" domain={[0.05, 20]} scale="log"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                label={{ value: "Aggregation Amplitude (log)", position: "insideBottom", offset: -10, fill: "#9ca3af", fontSize: 10 }} />
              <YAxis type="number" dataKey="tippingStep" name="Tipping step" domain={[0, 400]}
                tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 11 }}
                formatter={(v: any, name: any) => [name === "aggAmp" ? (v ?? 0).toFixed(2) : Math.round(v ?? 0), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Scatter name="Slow-tipping (n=110)" data={SCATTER_SLOW} fill="#00e5ff" opacity={0.6} />
              <Scatter name="Fast-tipping (n=137)" data={SCATTER_FAST} fill="#ff4444" opacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Phase 11 subtype comparison */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">Phase 11: Top-20 Config Subtypes</h3>
          <p className="text-xs text-gray-500 mb-3">
            K=3 optimal for top-20 — fine-grained variation within slow-tipping cluster at full scale
          </p>
          <div className="space-y-3">
            {PHASE11_SUBTYPES.map(st => (
              <div key={st.name} className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} />
                  <span className="text-xs font-semibold text-gray-200">{st.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-x-4 text-xs text-gray-400">
                  <span>aggAmp: <strong className="text-gray-200">{st.aggAmp}</strong></span>
                  <span>Window closes: <strong className="text-gray-200">t≈{st.windowClosesT}</strong></span>
                  <span>Min strength: <strong className="text-gray-200">{st.minStrength}</strong></span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
            <strong className="text-gray-300">Scale-shift note:</strong> Phase 11 top-20 all have aggAmp&lt;2, placing them
            entirely within the slow-tipping cluster at full population scale. The Aggressive/Moderate/Mild distinctions are
            fine-grained variations within one cluster.
          </div>
        </div>
      </div>

      {/* PCA loadings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">PCA Loadings — Disease-Severity Axis</h3>
          <p className="text-xs text-gray-500 mb-3">PC1 captures 69.7% of variance — a single disease-severity axis</p>
          <div className="space-y-2">
            {PCA_FEATURES.map(f => (
              <div key={f}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-300">{PCA_FEATURE_LABELS[f]}</span>
                  <span className="text-cyan-300">{((PCA_DATA[0] as unknown as Record<string, number>)[f] ?? 0).toFixed(2)} | <span className="text-purple-400">{((PCA_DATA[1] as unknown as Record<string, number>)[f] ?? 0).toFixed(2)}</span></span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded flex gap-0.5 overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded" style={{ width: `${((PCA_DATA[0] as unknown as Record<string, number>)[f] ?? 0) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <span className="text-cyan-400">Cyan</span> = PC1 loading | <span className="text-purple-400">Purple</span> = PC2 (mitFrag dominant)
          </p>
        </div>

        {/* Two-subtype summary */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Two-Subtype Characteristics</h3>
          <div className="space-y-4">
            {PHASE12_SUBTYPES.map(st => (
              <div key={st.name} className="p-4 bg-gray-800 rounded-lg border-l-4" style={{ borderColor: st.color }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold" style={{ color: st.color }}>{st.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div>aggAmp: <span className="text-white font-mono">{st.aggAmp}</span></div>
                  <div>Tipping step: <span className="text-white font-mono">{st.tippingStep}</span></div>
                  <div>Plateau: <span className="text-white font-mono">{st.plateauSurvivors.toFixed(1)}/61</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
            <strong className="text-gray-300">Clinical analogy (hypothetical):</strong> Fast-tipping (aggAmp ~5.9) may correspond to
            rapid progressors (mean survival 1.4 years from diagnosis); slow-tipping (aggAmp ~1.4) to typical progressors (2–3 years).
            These are model predictions requiring experimental validation.
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";
import { useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { runSimulation, ConnectomeSimulator, DEFAULT_PARAMS } from "@/lib/simulation";

// Pre-computed Phase 8 data (from paper / phase8_two_tier_report.md)
const PROTECTION_GROUPS = [
  { group: "Baseline", neurons: "—", plateau: 11.0, tier2Step: 220, aboveRandom: false, color: "#6b7280" },
  { group: "Group A (1st death)", neurons: "DD1", plateau: 12.0, tier2Step: 220, aboveRandom: false, color: "#60a5fa" },
  { group: "Group B (1st 3)", neurons: "DD1, DA2, DB1", plateau: 14.0, tier2Step: 220, aboveRandom: true, color: "#a8ff78" },
  { group: "Group C (1st 5)", neurons: "DD1—DD3", plateau: 16.0, tier2Step: 226, aboveRandom: true, color: "#a8ff78" },
  { group: "Group D (hubs)", neurons: "DA6, AVDL", plateau: 13.0, tier2Step: 220, aboveRandom: false, color: "#ffd700" },
  { group: "Group E (vuln)", neurons: "DA1–DA3", plateau: 14.0, tier2Step: 221, aboveRandom: true, color: "#a8ff78" },
  { group: "Group F (degree)", neurons: "AVAL, AVAR, AVBL", plateau: 14.0, tier2Step: 220, aboveRandom: true, color: "#a8ff78" },
  { group: "Full Therapy", neurons: "Agg suppression", plateau: 53.0, tier2Step: 485, aboveRandom: true, color: "#00e5ff" },
];

const TIER1_STEPS = 220;   // Tier 2 activation in baseline
const FIRST_DEATH = 201;   // First neuron dies
const THERAPY_FIRST_DEATH = 385; // With full therapy

export default function Phase8TwoTier() {
  const [baseHist, setBaseHist] = useState<Array<{step: number; alive: number}>>([]);
  const [therapyHist, setTherapyHist] = useState<Array<{step: number; alive: number}>>([]);
  const [ran, setRan] = useState(false);

  const run = useCallback(() => {
    // Baseline
    const baseH = runSimulation(DEFAULT_PARAMS, 400, 134);
    setBaseHist(baseH.map(h => ({ step: h.step, alive: h.alive })));

    // Full therapy at t=13
    const sim = new ConnectomeSimulator(134, DEFAULT_PARAMS);
    for (let i = 0; i < 400; i++) {
      if (i === 13) {
        (sim as any).p = { ...(sim as any).p, aggregationAmplification: DEFAULT_PARAMS.aggregationAmplification * 0.145 };
      }
      sim.step();
    }
    setTherapyHist(sim.history.map((h: {step: number; alive: number}) => ({ step: h.step, alive: h.alive })));
    setRan(true);
  }, []);

  const combinedData = baseHist.filter((_, i) => i % 2 === 0).map((bh, i) => {
    const th = therapyHist[i * 2] ?? therapyHist[therapyHist.length - 1];
    return {
      step: bh.step,
      baseline: bh.alive,
      therapy: th?.alive ?? null,
    };
  });

  return (
    <div className="space-y-6">
      {/* Two-tier model diagram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-cyan-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-cyan-900 text-cyan-300 text-xs font-bold rounded">TIER 1</span>
            <span className="text-sm font-semibold text-gray-200">Biochemical Cascade</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Aggregation seeding → ATP collapse → Excitotoxicity
          </p>
          <div className="text-xs space-y-1 font-mono bg-gray-800 rounded p-3">
            <div className="text-purple-300">aggregation ↑</div>
            <div className="text-gray-500 pl-4">→ ATP ↓</div>
            <div className="text-gray-500 pl-4">→ glutamate ↑ (EAAT2 failure)</div>
            <div className="text-gray-500 pl-4">→ Ca²âº ↑ (NMDA)</div>
            <div className="text-gray-500 pl-4">→ ROS ↑</div>
            <div className="text-purple-300 pl-4">→ aggregation ↑ (closes loop)</div>
          </div>
          <div className="mt-3 text-xs text-green-400 font-semibold">✓ Therapy-sensitive — aggregation suppression blocks Tier 1</div>
          <div className="text-xs text-gray-400">First death: step {FIRST_DEATH} (default seed)</div>
        </div>

        <div className="bg-gray-900 border border-red-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-red-900 text-red-300 text-xs font-bold rounded">TIER 2</span>
            <span className="text-sm font-semibold text-gray-200">Topological Cascade</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Load redistribution — autonomous once activated
          </p>
          <div className="text-xs space-y-1 font-mono bg-gray-800 rounded p-3">
            <div className="text-red-300">neuron deaths ≥ threshold</div>
            <div className="text-gray-500 pl-4">→ downstream load ↑</div>
            <div className="text-gray-500 pl-4">→ more neurons overloaded</div>
            <div className="text-gray-500 pl-4">→ deaths amplify further</div>
            <div className="text-red-300 pl-4">→ self-sustaining cascade</div>
          </div>
          <div className="mt-3 text-xs text-red-400 font-semibold">✗ Therapy-insensitive — biochemistry independent</div>
          <div className="text-xs text-gray-400">Activates: step {TIER1_STEPS} | Rate: +32 deaths/100 steps</div>
        </div>
      </div>

      {/* Live simulation */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Baseline vs. Full Therapy (agg_sup, start t=13)</h3>
          <button onClick={run} className="py-1.5 px-4 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded">
            Run Simulation
          </button>
        </div>
        {!ran ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">Click Run to see the two-tier transition</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={combinedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="step" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis domain={[0, 61]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={TIER1_STEPS} stroke="#ff4444" strokeDasharray="4 2" label={{ value: "Tier 2", fill: "#ff4444", fontSize: 10 }} />
              <ReferenceLine x={FIRST_DEATH} stroke="#ffd700" strokeDasharray="4 2" label={{ value: "1st death", fill: "#ffd700", fontSize: 10 }} />
              <Line type="monotone" dataKey="baseline" stroke="#ff6b6b" dot={false} name="No therapy" strokeWidth={2} />
              <Line type="monotone" dataKey="therapy" stroke="#00e5ff" dot={false} name="Full therapy (t=13)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Surgical protection */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Surgical Protection vs. Full Therapy</h3>
        <p className="text-xs text-gray-500 mb-4">
          Protecting specific neurons (10× capacity boost) vs. full aggregation suppression. Random control baseline: plateau = 12.6 ± 0.5
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={PROTECTION_GROUPS} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis dataKey="group" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-20} textAnchor="end" height={50} />
            <YAxis domain={[0, 61]} tick={{ fontSize: 11, fill: "#9ca3af" }} label={{ value: "Survivors", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
              formatter={(v: any, name: any) => [`${v ?? 0} neurons`, name]} />
            <ReferenceLine y={12.6} stroke="#ffd700" strokeDasharray="4 2" label={{ value: "Random threshold", fill: "#ffd700", fontSize: 9, position: "right" }} />
            <ReferenceLine y={11} stroke="#6b7280" strokeDasharray="4 2" />
            <Bar dataKey="plateau" name="Plateau survivors">
              {PROTECTION_GROUPS.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-2">
          Groups B, C, E, F exceed random threshold — but no surgical group approaches full therapy (53 vs ~14 survivors).
          Cascade amplification is too powerful once initiated. <strong className="text-gray-300">Only blocking Tier 1 works.</strong>
        </p>
      </div>
    </div>
  );
}


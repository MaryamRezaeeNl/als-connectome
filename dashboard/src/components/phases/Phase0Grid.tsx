"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// Simulated alive-neuron counts for a 30x30 grid, damage_rate=8, 60 steps
// Cascade spreads in diamond rings from centre.
// Wave 1 (ring 1, 4 neurons) dies at t≈13; each subsequent ring ~6–13 steps later.
const ALIVE_DATA = [
  {t:0,alive:899},{t:1,alive:899},{t:2,alive:899},{t:3,alive:899},{t:4,alive:899},
  {t:5,alive:899},{t:6,alive:899},{t:7,alive:899},{t:8,alive:899},{t:9,alive:899},
  {t:10,alive:899},{t:11,alive:899},{t:12,alive:899},{t:13,alive:895},
  {t:14,alive:895},{t:15,alive:895},{t:16,alive:895},{t:17,alive:895},
  {t:18,alive:895},{t:19,alive:891},{t:20,alive:891},{t:21,alive:891},
  {t:22,alive:891},{t:23,alive:891},{t:24,alive:891},{t:25,alive:887},
  {t:26,alive:887},{t:27,alive:887},{t:28,alive:887},{t:29,alive:879},
  {t:30,alive:875},{t:31,alive:871},{t:32,alive:867},{t:33,alive:863},
  {t:34,alive:863},{t:35,alive:863},{t:36,alive:859},{t:37,alive:855},
  {t:38,alive:851},{t:39,alive:847},{t:40,alive:847},{t:41,alive:847},
  {t:42,alive:843},{t:43,alive:839},{t:44,alive:835},{t:45,alive:831},
  {t:46,alive:831},{t:47,alive:831},{t:48,alive:827},{t:49,alive:823},
  {t:50,alive:819},{t:51,alive:815},{t:52,alive:815},{t:53,alive:815},
  {t:54,alive:811},{t:55,alive:807},{t:56,alive:803},{t:57,alive:799},
  {t:58,alive:799},{t:59,alive:797},
];

const DEAD_FINAL = 900 - 797;

export default function Phase0Grid() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🟫</span>
          <div>
            <h2 className="text-base font-bold text-white mb-1">Phase 0A — Grid Cascade Prototype</h2>
            <p className="text-xs text-gray-400 max-w-2xl">
              Earliest ALS neurodegeneration model (May 2026). A 30×30 grid of neurons, each starting at
              100% health. One central neuron is dead. Damage spreads to 4-connected neighbours at
              8 HP per dead neighbour per step. The same two-tier insight — seeding from a focal point,
              then cascade spreading — is the ancestor of the full C. elegans model.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 text-xs text-gray-500">
              🕐 Origin prototype · May 2026 · Persian comments · No network topology
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Grid neurons",    value: "900",    sub: "30 × 30",            color: "#ffd700" },
          { label: "Damage rate",     value: "8 HP",   sub: "per dead neighbour", color: "#ff9944" },
          { label: "Dead at t=59",    value: String(DEAD_FINAL), sub: "in 60 steps (%.1f%%)".replace("%.1f", (DEAD_FINAL/9).toFixed(1)), color: "#ff4444" },
          { label: "First wave dies", value: "t = 13", sub: "ring-1 (4 neurons)",  color: "#00e5ff" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">Alive Neurons Over 60 Steps</h3>
        <p className="text-xs text-gray-500 mb-3">
          Cascade spreads as concentric diamond rings. Each wave takes 6–13 steps to die
          depending on the number of dead neighbours. At step 60, roughly 103 neurons (11%) have died.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={ALIVE_DATA} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#9ca3af" }}
              label={{ value: "Simulation step", position: "insideBottom", offset: -10, fill: "#9ca3af", fontSize: 10 }} />
            <YAxis domain={[780, 905]} tick={{ fontSize: 10, fill: "#9ca3af" }}
              label={{ value: "Alive neurons", angle: -90, position: "insideLeft", fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
              formatter={(v: any) => [v, "alive"]} />
            <ReferenceLine x={13} stroke="#ffd700" strokeDasharray="4 2"
              label={{ value: "Ring 1", fill: "#ffd700", fontSize: 9 }} />
            <ReferenceLine x={19} stroke="#fb923c" strokeDasharray="4 2"
              label={{ value: "Ring 2a", fill: "#fb923c", fontSize: 9 }} />
            <ReferenceLine x={25} stroke="#f87171" strokeDasharray="4 2"
              label={{ value: "Ring 2b", fill: "#f87171", fontSize: 9 }} />
            <ReferenceLine y={900} stroke="#374151" strokeDasharray="3 3" />
            <Line type="stepAfter" dataKey="alive" stroke="#00e5ff" dot={false} strokeWidth={2} name="Alive neurons" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Mechanism */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Cascade Mechanism</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-red-900 text-red-400 flex items-center justify-center font-bold">0</span>
              <span>Centre neuron seeded dead (health = 0)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">→</span>
              <span>4-connected neighbours lose <strong className="text-white">8 HP/step</strong> per dead neighbour</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-400">→</span>
              <span>Neuron dies when health ≤ 0 (takes ≈13 steps with 1 dead neighbour)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">→</span>
              <span>Dead neuron becomes a new damage source for its neighbours</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">⟳</span>
              <span><strong className="text-white">Self-amplifying cascade</strong> — same logic as the full C. elegans model</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Connection to Full Model</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-cyan-400 font-semibold mb-0.5">Phase 0A (this)</div>
              <div>2D grid · no network topology · pure damage spread</div>
            </div>
            <div className="text-gray-600 text-center">↓ add graph topology (Phase 0B)</div>
            <div className="p-2 bg-gray-800 rounded">
              <div className="text-fuchsia-400 font-semibold mb-0.5">Phase 5 (full model)</div>
              <div>C. elegans connectome · biophysical cascade · aggAmp bifurcation</div>
            </div>
            <div className="p-2 bg-amber-950 border border-amber-800 rounded text-amber-200">
              The key addition: <strong>vulnerability ordering</strong> — not all neurons are equally at risk.
              High-vulnerability neurons (aggAmp × VULN) die first in a predictable spatial pattern.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

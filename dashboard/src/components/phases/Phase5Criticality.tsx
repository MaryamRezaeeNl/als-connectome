"use client";
import { useState, useCallback, useTransition } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { runSimulation, classifyRegime, DEFAULT_PARAMS, PARAM_RANGES, PARAM_LABELS, LOG_PARAMS, SimParams, StepHistory } from "@/lib/simulation";

const REGIME_COLOR = { stable: "#a8ff78", critical: "#ffd700", runaway: "#ff4444" } as const;

function SliderParam({
  name, value, onChange,
}: {
  name: keyof SimParams;
  value: number;
  onChange: (v: number) => void;
}) {
  const [lo, hi] = PARAM_RANGES[name];
  const isLog = LOG_PARAMS.has(name);
  const toSlider = (v: number) => isLog ? Math.log(v) : v;
  const fromSlider = (s: number) => isLog ? Math.exp(s) : s;
  const sLo = toSlider(lo), sHi = toSlider(hi);

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{PARAM_LABELS[name]}</span>
        <span className="text-cyan-300 font-mono">{value.toFixed(4)}</span>
      </div>
      <input
        type="range"
        min={sLo} max={sHi} step={(sHi - sLo) / 200}
        value={toSlider(value)}
        onChange={e => onChange(fromSlider(parseFloat(e.target.value)))}
        className="w-full h-1.5 accent-cyan-400 bg-gray-700 rounded"
      />
    </div>
  );
}

function regimeBadge(r: string) {
  const c = REGIME_COLOR[r as keyof typeof REGIME_COLOR] ?? "#6688cc";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ml-2"
      style={{ background: c, color: "#000" }}
    >{r}</span>
  );
}

export default function Phase5Criticality() {
  const [params, setParams] = useState<SimParams>({ ...DEFAULT_PARAMS });
  const [hist, setHist] = useState<StepHistory[]>([]);
  const [regime, setRegime] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const runSim = useCallback(() => {
    setRunning(true);
    startTransition(() => {
      const h = runSimulation(params, 500, 134);
      const r = classifyRegime(h);
      setHist(h);
      setRegime(r);
      setRunning(false);
    });
  }, [params]);

  const setParam = (key: keyof SimParams) => (v: number) =>
    setParams(p => ({ ...p, [key]: v }));

  const chartData = hist.filter((_, i) => i % 2 === 0).map(h => ({
    step: h.step,
    alive: h.alive,
    agg: parseFloat((h.meanAgg * 100).toFixed(1)),
    atp: parseFloat((h.meanAtp * 100).toFixed(1)),
    irrev: h.nIrrev,
  }));

  const tipping = hist.reduce<number | null>((found, h, i) => {
    if (found !== null) return found;
    if (i >= 10 && hist[i - 10].alive - h.alive > 4) return h.step;
    return null;
  }, null);

  const finalAlive = hist.length ? hist[hist.length - 1].alive : null;
  const silentLen = tipping ? tipping - 1 : (hist.length ? hist.length : null);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
      {/* Controls */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Parameters</h3>
        {(Object.keys(PARAM_LABELS) as (keyof SimParams)[]).map(k => (
          <SliderParam key={k} name={k} value={params[k]} onChange={setParam(k)} />
        ))}
        <button
          onClick={runSim}
          disabled={running}
          className="w-full mt-4 py-2 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-white font-bold rounded-lg text-sm transition-colors"
        >
          {running ? "Simulating…" : "Run 500 Steps"}
        </button>

        {regime && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Regime</span>
              {regimeBadge(regime)}
            </div>
            {finalAlive !== null && (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>Survivors (t=500)</span><span className="text-white font-mono">{finalAlive}/61</span>
                <span>Tipping step</span><span className="text-white font-mono">{tipping ?? "—"}</span>
                <span>Silent phase</span><span className="text-white font-mono">{tipping ? `${tipping} steps` : "none"}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
          <p className="font-semibold text-gray-300 mb-1">Regime definitions</p>
          <p><span style={{color:"#a8ff78"}}>■</span> Stable: &gt;50 alive at t=500</p>
          <p><span style={{color:"#ffd700"}}>■</span> Critical: 10–50 alive at t=500</p>
          <p><span style={{color:"#ff4444"}}>■</span> Runaway: &lt;10 alive by t=200</p>
          <p className="mt-2 text-gray-500">Config #334 (default): aggAmp=1.50, mitFrag=0.83 — index critical config</p>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Survival curve */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Neuron Survival</h3>
          {chartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-600 text-sm">
              Set parameters and click Run
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: "#9ca3af" }} label={{ value: "Step", position: "insideBottom", offset: -2, fill: "#9ca3af", fontSize: 11 }} />
                <YAxis domain={[0, 61]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {tipping && <ReferenceLine x={tipping} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Tipping", fill: "#f59e0b", fontSize: 10 }} />}
                <Line type="monotone" dataKey="alive" stroke="#00e5ff" dot={false} name="Alive neurons" strokeWidth={2} />
                <Line type="monotone" dataKey="irrev" stroke="#ff4444" dot={false} name="Irreversible" strokeWidth={1.5} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Biochemical state */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Biochemical State (alive neurons, %)</h3>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">
              Run simulation first
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="agg" stroke="#a855f7" dot={false} name="Aggregation %" strokeWidth={1.5} />
                <Line type="monotone" dataKey="atp" stroke="#a8ff78" dot={false} name="ATP %" strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

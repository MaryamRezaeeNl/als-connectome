"use client";
import { useEffect, useRef, useState } from "react";
import { NEURON_NAMES, SYNAPSES, VULNERABILITY, NODE_TYPES, NEURON_IDX } from "@/lib/connectome";

const TYPE_COLOR: Record<string, string> = {
  sensory: "#a8ff78",
  interneuron: "#00e5ff",
  motor: "#ff4444",
};

interface NeuronHealth {
  health: number[];
  aggregation: number[];
}

interface Props {
  state?: NeuronHealth;
  width?: number;
  height?: number;
  step?: number;
}

// Pre-compute circular layout positions per neuron type
function computeLayout(w: number, h: number) {
  const cx = w / 2, cy = h / 2;
  const typeGroups: Record<string, number[]> = { sensory: [], interneuron: [], motor: [] };
  NEURON_NAMES.forEach((name, i) => {
    const t = NODE_TYPES[name] ?? "interneuron";
    typeGroups[t].push(i);
  });

  const pos: [number, number][] = new Array(NEURON_NAMES.length);
  const radii = { sensory: Math.min(w, h) * 0.45, interneuron: Math.min(w, h) * 0.30, motor: Math.min(w, h) * 0.15 };

  for (const [type, ids] of Object.entries(typeGroups)) {
    const r = radii[type as keyof typeof radii];
    ids.forEach((idx, k) => {
      const angle = (k / ids.length) * 2 * Math.PI - Math.PI / 2;
      pos[idx] = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });
  }
  return pos;
}

export default function NetworkGraph({ state, width = 440, height = 420, step }: Props) {
  const W = width, H = height;
  const pos = computeLayout(W, H);

  const health = state?.health;
  const agg = state?.aggregation;

  // Color neuron by health (alive=type color, dead=dark gray, irreversible=orange)
  const neuronColor = (i: number) => {
    const h = health?.[i] ?? 1;
    const a = agg?.[i] ?? 0;
    if (h < 0.15) return "#1a1a2e";
    const base = TYPE_COLOR[NODE_TYPES[NEURON_NAMES[i]] ?? "interneuron"];
    // Tint toward red as aggregation rises
    if (a > 0.5) return "#ff6b35";
    if (a > 0.3) return "#ffd700";
    return base;
  };

  const neuronRadius = (i: number) => {
    const v = VULNERABILITY[NEURON_NAMES[i]] ?? 0.15;
    return 3 + v * 5;
  };

  const neuronOpacity = (i: number) => {
    const h = health?.[i] ?? 1;
    return Math.max(0.15, h);
  };

  return (
    <svg width={W} height={H} style={{ background: "#020c18", borderRadius: 12, display: "block" }}>
      {/* Edges */}
      {SYNAPSES.slice(0, 60).map(([pre, post, w, type], idx) => {
        const i = NEURON_IDX[pre], j = NEURON_IDX[post];
        if (i === undefined || j === undefined) return null;
        const [x1, y1] = pos[i], [x2, y2] = pos[j];
        const alive_i = (health?.[i] ?? 1) > 0.15;
        const alive_j = (health?.[j] ?? 1) > 0.15;
        return (
          <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={type === "excitatory" ? "#1a4060" : "#2a1040"}
            strokeWidth={w * 1.5}
            opacity={alive_i && alive_j ? 0.4 : 0.1} />
        );
      })}
      {/* Neurons */}
      {NEURON_NAMES.map((name, i) => {
        const [x, y] = pos[i];
        const r = neuronRadius(i);
        const color = neuronColor(i);
        const op = neuronOpacity(i);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={color} opacity={op} />
            {r > 5 && (
              <text x={x} y={y - r - 2} textAnchor="middle" fontSize={7} fill="#9ca3af" opacity={0.7}>
                {name}
              </text>
            )}
          </g>
        );
      })}
      {/* Legend */}
      {[
        { label: "Sensory", color: TYPE_COLOR.sensory },
        { label: "Interneuron", color: TYPE_COLOR.interneuron },
        { label: "Motor", color: TYPE_COLOR.motor },
      ].map(({ label, color }, k) => (
        <g key={k} transform={`translate(8,${H - 52 + k * 16})`}>
          <circle r={4} fill={color} cx={4} cy={4} />
          <text x={12} y={8} fontSize={9} fill="#9ca3af">{label}</text>
        </g>
      ))}
      {step !== undefined && (
        <text x={W - 8} y={H - 8} textAnchor="end" fontSize={10} fill="#4b5563">Step {step}</text>
      )}
    </svg>
  );
}

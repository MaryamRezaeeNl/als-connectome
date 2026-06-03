"use client";
import { useState } from "react";

// â"€â"€â"€ PRE-COMPUTED DATA â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Source: results/phase10_boundary_robustness.json
// 8100 simulation runs: 9 strengths × 9 start_ts × 20 configs × 3 seeds/point

interface P10ConfigFit {
  configId: number;
  slope: number;
  intercept: number;
  r2: number;
  nPoints: number;
  baselineTip: number;
  minStrengthPrev: number;
  maxStartTAny: number;
  pts: [number, number][];   // [strength, max_start_t]
  valid: boolean;            // false = flat/NaN boundary (~0 slope)
}

const P10_DATA: P10ConfigFit[] = [
  { configId: 334, slope: 350.0, intercept: -187.5,  r2: 0.980, nPoints: 4, baselineTip: 251, minStrengthPrev: 0.6, maxStartTAny: 125, valid: true,
    pts: [[0.6,25],[0.7,50],[0.8,100],[0.9,125]] },
  { configId: 235, slope:  83.3, intercept:  144.4,  r2: 0.300, nPoints: 9, baselineTip: 325, minStrengthPrev: 0.1, maxStartTAny: 200, valid: true,
    pts: [[0.1,75],[0.2,200],[0.3,200],[0.4,200],[0.5,200],[0.6,200],[0.7,200],[0.8,200],[0.9,200]] },
  { configId: 382, slope: 125.0, intercept:  -58.3,  r2: 0.750, nPoints: 3, baselineTip: 199, minStrengthPrev: 0.7, maxStartTAny:  50, valid: true,
    pts: [[0.7,25],[0.8,50],[0.9,50]] },
  { configId: 391, slope: 192.9, intercept:  -37.9,  r2: 0.906, nPoints: 6, baselineTip: 238, minStrengthPrev: 0.4, maxStartTAny: 125, valid: true,
    pts: [[0.4,25],[0.5,75],[0.6,75],[0.7,100],[0.8,125],[0.9,125]] },
  { configId:  21, slope: 207.1, intercept:  -38.8,  r2: 0.936, nPoints: 6, baselineTip: 241, minStrengthPrev: 0.4, maxStartTAny: 150, valid: true,
    pts: [[0.4,50],[0.5,50],[0.6,100],[0.7,100],[0.8,125],[0.9,150]] },
  { configId:  37, slope: 250.0, intercept: -125.0,  r2: 0.556, nPoints: 4, baselineTip: 226, minStrengthPrev: 0.6, maxStartTAny: 100, valid: true,
    pts: [[0.6,0],[0.7,75],[0.8,100],[0.9,75]] },
  { configId: 118, slope: 250.0, intercept: -175.0,  r2: 1.000, nPoints: 2, baselineTip: 209, minStrengthPrev: 0.8, maxStartTAny:  50, valid: true,
    pts: [[0.8,25],[0.9,50]] },
  { configId: 178, slope: 500.0, intercept: -358.3,  r2: 0.923, nPoints: 3, baselineTip: 203, minStrengthPrev: 0.7, maxStartTAny: 100, valid: true,
    pts: [[0.7,0],[0.8,25],[0.9,100]] },
  { configId: 188, slope: 250.0, intercept: -100.0,  r2: 1.000, nPoints: 6, baselineTip: 239, minStrengthPrev: 0.4, maxStartTAny: 125, valid: true,
    pts: [[0.4,0],[0.5,25],[0.6,50],[0.7,75],[0.8,100],[0.9,125]] },
  { configId: 224, slope: 221.8, intercept:  -38.0,  r2: 0.946, nPoints: 8, baselineTip: 265, minStrengthPrev: 0.1, maxStartTAny: 150, valid: true,
    pts: [[0.1,0],[0.3,0],[0.4,50],[0.5,75],[0.6,100],[0.7,125],[0.8,150],[0.9,150]] },
  { configId: 241, slope:   0.0, intercept:  200.0,  r2: NaN,   nPoints: 9, baselineTip: 231, minStrengthPrev: 0.1, maxStartTAny: 200, valid: false,
    pts: [[0.1,200],[0.9,200]] },
  { configId: 263, slope: 175.0, intercept:  -87.5,  r2: 0.891, nPoints: 4, baselineTip: 234, minStrengthPrev: 0.6, maxStartTAny:  75, valid: true,
    pts: [[0.6,25],[0.7,25],[0.8,50],[0.9,75]] },
  { configId: 312, slope: 178.6, intercept:  -21.4,  r2: 0.909, nPoints: 7, baselineTip: 265, minStrengthPrev: 0.3, maxStartTAny: 150, valid: true,
    pts: [[0.3,50],[0.4,50],[0.5,50],[0.6,75],[0.7,100],[0.8,125],[0.9,150]] },
  { configId: 329, slope:   0.0, intercept:  200.0,  r2: NaN,   nPoints: 9, baselineTip: 294, minStrengthPrev: 0.1, maxStartTAny: 200, valid: false,
    pts: [[0.1,200],[0.9,200]] },
  { configId: 424, slope: 325.0, intercept: -175.0,  r2: 0.966, nPoints: 4, baselineTip: 215, minStrengthPrev: 0.6, maxStartTAny: 125, valid: true,
    pts: [[0.6,25],[0.7,50],[0.8,75],[0.9,125]] },
  { configId: 493, slope: 300.0, intercept: -115.0,  r2: 0.973, nPoints: 5, baselineTip: 244, minStrengthPrev: 0.5, maxStartTAny: 150, valid: true,
    pts: [[0.5,25],[0.6,75],[0.7,100],[0.8,125],[0.9,150]] },
  { configId: 496, slope:  59.4, intercept:   -2.7,  r2: 0.363, nPoints: 7, baselineTip: 231, minStrengthPrev: 0.2, maxStartTAny:  75, valid: true,
    pts: [[0.2,25],[0.4,25],[0.5,25],[0.6,0],[0.7,25],[0.8,50],[0.9,75]] },
  { configId: 497, slope: 500.0, intercept: -341.7,  r2: 0.923, nPoints: 3, baselineTip: 224, minStrengthPrev: 0.7, maxStartTAny: 100, valid: true,
    pts: [[0.7,0],[0.8,75],[0.9,100]] },
  { configId:  83, slope: 314.3, intercept:  -96.0,  r2: 0.830, nPoints: 6, baselineTip: 280, minStrengthPrev: 0.4, maxStartTAny: 175, valid: true,
    pts: [[0.4,50],[0.5,50],[0.6,50],[0.7,150],[0.8,175],[0.9,175]] },
  { configId:  87, slope:   0.0, intercept:  200.0,  r2: NaN,   nPoints: 9, baselineTip: 249, minStrengthPrev: 0.1, maxStartTAny: 200, valid: false,
    pts: [[0.1,200],[0.9,200]] },
];

const P10_AGGREGATE = {
  nWithBoundary: 17,
  totalConfigs: 20,
  slopeMean: 251.9,
  slopeStd: 119.7,
  slopeMin: 59.4,
  slopeMax: 500.0,
  interceptMean: -106.7,
  interceptStd: 117.0,
  r2Mean: 0.832,
  r2FracGt090: 0.647,
  verdict: "Two distinct boundary classes exist",
};

const P10_CORRELATIONS = [
  { param: "aggAmp",    label: "Aggregation Amplitude", rSlope:  0.645, rIntercept: -0.811 },
  { param: "calcGain",  label: "Calcium Stress Gain",   rSlope: -0.497, rIntercept:  0.503 },
  { param: "mitFrag",   label: "Mito Fragility",        rSlope: -0.472, rIntercept:  0.451 },
  { param: "recovIrr",  label: "Recovery Irrevers.",    rSlope: -0.321, rIntercept:  0.257 },
  { param: "oxFb",      label: "Oxidative Feedback",    rSlope:  0.091, rIntercept: -0.133 },
  { param: "gluSens",   label: "Glutamate Sensitivity", rSlope:  0.123, rIntercept:  0.035 },
  { param: "atpThr",    label: "ATP Collapse Thr.",     rSlope:  0.078, rIntercept: -0.182 },
];

// â"€â"€â"€ HELPERS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function slopeColor(slope: number): string {
  // red = high slope (aggressive), blue = low slope (wide window)
  if (slope >= 400) return "#ff4444";
  if (slope >= 300) return "#ff9944";
  if (slope >= 200) return "#ffd700";
  if (slope >= 100) return "#a8ff78";
  return "#00e5ff";
}

// â"€â"€â"€ CHARTS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function P10SpaghettiChart({ width = 500, height = 240 }: { width?: number; height?: number }) {
  const pad = { t: 24, r: 20, b: 36, l: 44 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;

  const xMin = 0.0, xMax = 1.0;
  const yMin = -50, yMax = 220;

  const tx = (s: number) => ((s - xMin) / (xMax - xMin)) * W;
  const ty = (t: number) => H - ((t - yMin) / (yMax - yMin)) * H;

  const validCfgs = P10_DATA.filter(c => c.valid);

  // Boundary line at two x values
  const linePoints = (cfg: P10ConfigFit) => {
    const x0 = Math.max(xMin, (0 - cfg.intercept) / cfg.slope);
    const x1 = xMax;
    const y0 = Math.max(yMin, cfg.slope * x0 + cfg.intercept);
    const y1 = Math.min(yMax, cfg.slope * x1 + cfg.intercept);
    return `M${tx(x0).toFixed(1)},${ty(y0).toFixed(1)} L${tx(x1).toFixed(1)},${ty(y1).toFixed(1)}`;
  };

  // Mean line
  const meanPath = (() => {
    const m = P10_AGGREGATE;
    const x0 = Math.max(xMin, (0 - m.interceptMean) / m.slopeMean);
    const x1 = xMax;
    const y0 = Math.max(yMin, m.slopeMean * x0 + m.interceptMean);
    const y1 = Math.min(yMax, m.slopeMean * x1 + m.interceptMean);
    return `M${tx(x0).toFixed(1)},${ty(y0).toFixed(1)} L${tx(x1).toFixed(1)},${ty(y1).toFixed(1)}`;
  })();

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        BOUNDARY LINES — ALL 17 VALID CONFIGS
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {/* zero line */}
        <line x1={0} x2={W} y1={ty(0)} y2={ty(0)} stroke="#1e3a50" strokeWidth={1} strokeDasharray="4,3" />
        {/* grid */}
        {[0, 50, 100, 150, 200].map(v => (
          <g key={v}>
            <line x1={0} x2={W} y1={ty(v)} y2={ty(v)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-4} y={ty(v) + 4} textAnchor="end" fontSize={8} fill="#3a5570">{v}</text>
          </g>
        ))}
        {/* individual config lines */}
        {validCfgs.map(cfg => (
          <path key={cfg.configId} d={linePoints(cfg)} fill="none"
            stroke={slopeColor(cfg.slope)} strokeWidth={cfg.configId === 334 ? 2.5 : 1.2}
            opacity={cfg.configId === 334 ? 1 : 0.5} />
        ))}
        {/* mean line */}
        <path d={meanPath} fill="none" stroke="#ffffff" strokeWidth={2}
          strokeDasharray="8,4" opacity={0.7} />
        {/* x axis labels */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
          <text key={v} x={tx(v)} y={H + 14} textAnchor="middle" fontSize={8} fill="#3a5570">{v.toFixed(1)}</text>
        ))}
        <text x={W / 2} y={H + 28} textAnchor="middle" fontSize={9} fill="#3a5570">therapy strength</text>
        <text x={-36} y={H / 2} textAnchor="middle" fontSize={9} fill="#3a5570"
          transform={`rotate(-90, -36, ${H / 2})`}>max start step</text>
        {/* legend */}
        <g transform={`translate(${W - 120}, 4)`}>
          {[["#ff4444","slope >400"],["#ff9944","300-400"],["#ffd700","200-300"],["#a8ff78","100-200"],["#00e5ff","<100"]].map(([col, lbl], i) => (
            <g key={i} transform={`translate(0,${i * 14})`}>
              <line x1={0} x2={16} y1={5} y2={5} stroke={col} strokeWidth={1.5} />
              <text x={20} y={9} fontSize={8} fill={col}>{lbl}</text>
            </g>
          ))}
          <g transform={`translate(0,${5 * 14})`}>
            <line x1={0} x2={16} y1={5} y2={5} stroke="#fff" strokeWidth={2} strokeDasharray="6,3" />
            <text x={20} y={9} fontSize={8} fill="#ccc">mean</text>
          </g>
          <g transform={`translate(0,${6 * 14})`}>
            <line x1={0} x2={16} y1={5} y2={5} stroke="#ff4444" strokeWidth={2.5} />
            <text x={20} y={9} fontSize={8} fill="#ff4444">#334</text>
          </g>
        </g>
      </g>
    </svg>
  );
}

function P10SlopeHistogram({ width = 300, height = 160 }: { width?: number; height?: number }) {
  const pad = { t: 22, r: 12, b: 28, l: 36 };
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;

  const slopes = P10_DATA.filter(c => c.valid).map(c => c.slope);
  const bins = [
    { lo: 0,   hi: 100, count: 0, color: "#00e5ff" },
    { lo: 100, hi: 200, count: 0, color: "#a8ff78" },
    { lo: 200, hi: 300, count: 0, color: "#ffd700" },
    { lo: 300, hi: 400, count: 0, color: "#ff9944" },
    { lo: 400, hi: 550, count: 0, color: "#ff4444" },
  ];
  for (const s of slopes) {
    const b = bins.find(b => s >= b.lo && s < b.hi);
    if (b) b.count++;
  }
  const maxCount = Math.max(...bins.map(b => b.count), 1);
  const bw = W / bins.length;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        SLOPE DISTRIBUTION (n=17)
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0, 1, 2, 3].map(v => (
          <g key={v}>
            <line x1={0} x2={W} y1={H - (v / maxCount) * H} y2={H - (v / maxCount) * H}
              stroke="#0f1e30" strokeWidth={1} />
            <text x={-3} y={H - (v / maxCount) * H + 4} textAnchor="end" fontSize={7} fill="#3a5570">{v}</text>
          </g>
        ))}
        {bins.map((b, i) => {
          const bh = (b.count / maxCount) * H;
          return (
            <g key={i}>
              <rect x={i * bw + 2} y={H - bh} width={bw - 4} height={bh}
                fill={b.color} rx={2} opacity={0.85} />
              {b.count > 0 && (
                <text x={i * bw + bw / 2} y={H - bh - 4} textAnchor="middle"
                  fontSize={10} fill={b.color} fontWeight="bold">{b.count}</text>
              )}
              <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize={7} fill="#3a5570">
                {b.lo}-{b.hi}
              </text>
            </g>
          );
        })}
        <text x={W / 2} y={H + 26} textAnchor="middle" fontSize={8} fill="#3a5570">slope range</text>
      </g>
    </svg>
  );
}

function P10ConfigDetail({ cfg }: { cfg: P10ConfigFit }) {
  const pad = { t: 24, r: 16, b: 36, l: 44 };
  const width = 380, height = 200;
  const W = width - pad.l - pad.r, H = height - pad.t - pad.b;

  const xMin = 0.0, xMax = 1.0;
  const yMin = -30, yMax = 220;

  const tx = (s: number) => ((s - xMin) / (xMax - xMin)) * W;
  const ty = (t: number) => H - ((t - yMin) / (yMax - yMin)) * H;

  // Fitted line
  const x0 = Math.max(xMin, (0 - cfg.intercept) / Math.max(cfg.slope, 0.01));
  const x1 = xMax;
  const linePath = cfg.valid
    ? `M${tx(x0).toFixed(1)},${ty(cfg.slope * x0 + cfg.intercept).toFixed(1)} L${tx(x1).toFixed(1)},${ty(cfg.slope * x1 + cfg.intercept).toFixed(1)}`
    : "";

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <text x={pad.l + W / 2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>
        CONFIG #{cfg.configId} — BOUNDARY SCATTER
      </text>
      <g transform={`translate(${pad.l},${pad.t})`}>
        <line x1={0} x2={W} y1={ty(0)} y2={ty(0)} stroke="#1e3a50" strokeWidth={1} strokeDasharray="3,3" />
        {[0, 50, 100, 150, 200].map(v => (
          <g key={v}>
            <line x1={0} x2={W} y1={ty(v)} y2={ty(v)} stroke="#0f1e30" strokeWidth={1} />
            <text x={-4} y={ty(v) + 4} textAnchor="end" fontSize={8} fill="#3a5570">{v}</text>
          </g>
        ))}
        {/* therapy success region */}
        {cfg.valid && (
          <path
            d={`M${tx(x0).toFixed(1)},${ty(cfg.slope * x0 + cfg.intercept).toFixed(1)} L${tx(x1).toFixed(1)},${ty(cfg.slope * x1 + cfg.intercept).toFixed(1)} L${tx(x1).toFixed(1)},${ty(yMax).toFixed(1)} L${tx(x0).toFixed(1)},${ty(yMax).toFixed(1)} Z`}
            fill="#00e5ff" opacity={0.04} />
        )}
        {cfg.valid && (
          <path d={linePath} fill="none"
            stroke={slopeColor(cfg.slope)} strokeWidth={2} />
        )}
        {/* data points */}
        {cfg.pts.map(([s, t], i) => (
          <g key={i}>
            <circle cx={tx(s)} cy={ty(t)} r={5}
              fill={slopeColor(cfg.slope)} opacity={0.9} />
            <circle cx={tx(s)} cy={ty(t)} r={5}
              fill="none" stroke="#fff" strokeWidth={0.8} opacity={0.5} />
          </g>
        ))}
        {/* x axis */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
          <text key={v} x={tx(v)} y={H + 14} textAnchor="middle" fontSize={8} fill="#3a5570">{v.toFixed(1)}</text>
        ))}
        <text x={W / 2} y={H + 28} textAnchor="middle" fontSize={9} fill="#3a5570">therapy strength</text>
        {/* annotation */}
        {cfg.valid && (
          <text x={W - 4} y={8} textAnchor="end" fontSize={8} fill={slopeColor(cfg.slope)}>
            {`y = ${cfg.slope.toFixed(0)}x ${cfg.intercept >= 0 ? "+" : ""}${cfg.intercept.toFixed(0)}  R²=${cfg.r2.toFixed(2)}`}
          </text>
        )}
        {!cfg.valid && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="#3a5570">
            Flat boundary (therapy effective at all start times)
          </text>
        )}
      </g>
    </svg>
  );
}

// â"€â"€â"€ UI ATOMS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function P10Stat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#3a5570" }}>{sub}</div>}
    </div>
  );
}

// â"€â"€â"€ MAIN COMPONENT â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function Phase10BoundaryRobustness() {
  const [selectedId, setSelectedId] = useState<number>(334);
  const selectedCfg = P10_DATA.find(c => c.configId === selectedId) ?? P10_DATA[0];
  const agg = P10_AGGREGATE;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-yellow-950 border border-gray-700 rounded-2xl p-5">
        <div className="text-xs tracking-widest mb-1" style={{ color: "#ffd700" }}>
          PHASE 10 — THERAPEUTIC BOUNDARY ROBUSTNESS
        </div>
        <h2 className="text-xl font-black mb-2" style={{
          background: "linear-gradient(100deg,#ffd700,#ff9944 50%,#a8ff78)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Is the Linear Boundary Universal?
        </h2>
        <p className="text-xs max-w-2xl text-gray-400">
          Phase 9 established a sharp linear therapeutic boundary for config #334:
          {" "}<strong className="text-yellow-300">max_start_t = 425 × strength − 237</strong> (R²=0.98, Phase 9 fine grid).
          Phase 10 tests whether this holds across the top 20 genuine critical configurations.
          Grid: 9 strengths × 9 start_ts × 20 configs × 3 seeds = 4860 simulation runs.
        </p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <P10Stat label="Configs with boundary" value={`${agg.nWithBoundary}/${agg.totalConfigs}`}
          color="#00e5ff" sub="3 flat (always treatable)" />
        <P10Stat label="Mean slope ± std" value={`${agg.slopeMean.toFixed(0)} ± ${agg.slopeStd.toFixed(0)}`}
          color="#ffd700" sub="max_start_t / unit strength" />
        <P10Stat label="Mean R²" value={agg.r2Mean.toFixed(3)}
          color="#a8ff78" sub={`${(agg.r2FracGt090 * 100).toFixed(0)}% above 0.90`} />
        <P10Stat label="Verdict" value="2 Classes"
          color="#ff9944" sub={agg.verdict} />
      </div>

      {/* Spaghetti chart + slope histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-700 rounded-xl p-4 overflow-x-auto">
          <P10SpaghettiChart width={500} height={240} />
          <p className="text-xs text-gray-500 mt-2">
            Each line = one config&apos;s linear boundary. Above the line = therapy succeeds.
            Below = insufficient time for therapy to prevent Tier-2 cascade.
            Config #334 (bold red) sits in the high-slope class.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <P10SlopeHistogram width={280} height={170} />
          <div className="mt-3 space-y-1 text-xs" style={{ color: "#3a5570" }}>
            <div className="flex justify-between">
              <span>Min slope</span>
              <span className="font-mono" style={{ color: "#00e5ff" }}>{agg.slopeMin.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Max slope</span>
              <span className="font-mono" style={{ color: "#ff4444" }}>{agg.slopeMax.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Mean intercept</span>
              <span className="font-mono text-gray-400">{agg.interceptMean.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Std intercept</span>
              <span className="font-mono text-gray-400">±{agg.interceptStd.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-config detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Config Detail</h3>
            <select
              value={selectedId}
              onChange={e => setSelectedId(parseInt(e.target.value))}
              className="text-xs rounded px-2 py-1 font-mono"
              style={{ background: "#111827", border: "1px solid #374151", color: "#9ca3af" }}>
              {P10_DATA.map(c => (
                <option key={c.configId} value={c.configId}>
                  #{c.configId} — slope {c.valid ? `${c.slope.toFixed(0)}` : "flat"}
                  {c.configId === 334 ? " (reference)" : ""}
                </option>
              ))}
            </select>
          </div>
          <P10ConfigDetail cfg={selectedCfg} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {[
              ["Baseline tip", `step ${selectedCfg.baselineTip}`,         "#00e5ff"],
              ["Min strength", `${selectedCfg.minStrengthPrev.toFixed(1)}`, "#ffd700"],
              ["Max window",   selectedCfg.valid ? `t=${selectedCfg.maxStartTAny}` : "all t", "#a8ff78"],
            ].map(([l, v, col]) => (
              <div key={l} className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="font-bold font-mono" style={{ color: col }}>{v}</div>
                <div className="text-gray-500 mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Correlation table */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Parameter Correlations with Boundary
          </h3>
          <table className="w-full text-xs font-mono" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Parameter", "r(slope)", "r(intercept)"].map(h => (
                  <th key={h} className="text-left px-2 py-1 text-xs tracking-wide"
                    style={{ color: "#3a5570", borderBottom: "1px solid #1e2a3a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {P10_CORRELATIONS.sort((a, b) => Math.abs(b.rIntercept) - Math.abs(a.rIntercept))
                .map(c => {
                  const absI = Math.abs(c.rIntercept);
                  const rowColor = absI >= 0.7 ? "#ff9944" : absI >= 0.4 ? "#ffd700" : "#4b5563";
                  return (
                    <tr key={c.param}>
                      <td className="px-2 py-1.5" style={{ color: rowColor }}>{c.label}</td>
                      <td className="px-2 py-1.5 text-center"
                        style={{ color: Math.abs(c.rSlope) >= 0.4 ? "#a8ff78" : "#4b5563" }}>
                        {c.rSlope >= 0 ? "+" : ""}{c.rSlope.toFixed(3)}
                      </td>
                      <td className="px-2 py-1.5 text-center"
                        style={{ color: absI >= 0.5 ? "#ff9944" : "#4b5563" }}>
                        {c.rIntercept >= 0 ? "+" : ""}{c.rIntercept.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-3">
            <strong className="text-orange-400">aggAmp</strong> is the dominant predictor
            (r=-0.811 for intercept): higher aggregation amplitude forces earlier intervention.
          </p>
        </div>
      </div>

      {/* Per-config table */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">All 20 Configs — Boundary Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Config", "Base tip", "Slope", "Intercept", "R²", "Min str", "Max t", "Class"].map(h => (
                  <th key={h} className="text-left px-2 py-1.5 text-xs tracking-wide"
                    style={{ color: "#3a5570", borderBottom: "1px solid #1e2a3a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {P10_DATA.map(c => {
                const col = c.valid ? slopeColor(c.slope) : "#4b5563";
                const cls = !c.valid ? "Flat" :
                  c.slope >= 400 ? "Aggressive" :
                  c.slope >= 250 ? "Moderate" : "Wide";
                return (
                  <tr key={c.configId}
                    className={c.configId === selectedId ? "bg-gray-800" : ""}
                    onClick={() => setSelectedId(c.configId)}
                    style={{ cursor: "pointer" }}>
                    <td className="px-2 py-1 font-bold" style={{ color: c.configId === 334 ? "#ff4444" : col }}>
                      #{c.configId}{c.configId === 334 ? " *" : ""}
                    </td>
                    <td className="px-2 py-1 text-gray-400">{c.baselineTip}</td>
                    <td className="px-2 py-1" style={{ color: col }}>
                      {c.valid ? c.slope.toFixed(0) : "—"}
                    </td>
                    <td className="px-2 py-1 text-gray-400">
                      {c.valid ? c.intercept.toFixed(0) : "—"}
                    </td>
                    <td className="px-2 py-1" style={{ color: c.valid && c.r2 >= 0.9 ? "#a8ff78" : "#4b5563" }}>
                      {c.valid && !isNaN(c.r2) ? c.r2.toFixed(2) : "—"}
                    </td>
                    <td className="px-2 py-1 text-gray-400">{c.minStrengthPrev.toFixed(1)}</td>
                    <td className="px-2 py-1 text-gray-400">{c.maxStartTAny}</td>
                    <td className="px-2 py-1" style={{ color: col }}>{cls}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-2">* Reference config from Phase 9. Click any row to view detail chart.</p>
      </div>

      {/* Research finding */}
      <div className="rounded-2xl p-5"
        style={{ background: "rgba(255,217,0,0.04)", border: "1px solid #ffd70044" }}>
        <div className="text-xs tracking-widest mb-4" style={{ color: "#ffd700" }}>
          PHASE 10 — RESEARCH FINDING
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {[
            { label: "Boundary universal?", value: "Partially", color: "#ff9944",
              sub: "Two classes: steep (aggAmp-driven) vs. shallow (wide window)" },
            { label: "Linear fit quality",  value: `R² = ${agg.r2Mean.toFixed(2)}`, color: "#a8ff78",
              sub: `64.7% of configs exceed R²=0.90` },
            { label: "Key predictor",       value: "aggAmp", color: "#00e5ff",
              sub: "r=-0.81 for intercept — higher aggAmp forces earlier therapy" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              <div className="text-xs mt-1" style={{ color: "#3a5570" }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-gray-400 mb-3">
          The linear therapeutic boundary is real but{" "}
          <strong className="text-yellow-300">config-dependent</strong>.
          17/20 genuine critical configs show a measurable boundary (mean R²=0.83).
          The population splits into two classes: <strong className="text-red-400">steep-boundary configs</strong>
          {" "}(slope 300-500, driven by high aggAmp — narrow windows requiring early, strong therapy) and{" "}
          <strong className="text-green-400">shallow-boundary configs</strong>
          {" "}(slope 60-200, wider windows). The mean equation across all configs is{" "}
          <strong className="text-cyan-300">max_start_t = 252 × strength − 107</strong>{" "}
          (vs. #334: 425 × strength − 237, Phase 9). The 3 flat configs (always treatable at any start time)
          represent a third class where the cascade is reversible throughout.
        </p>
        <div className="rounded-lg px-4 py-3 text-xs leading-relaxed"
          style={{ background: "rgba(0,0,0,0.3)", color: "#3a5570" }}>
          <span style={{ color: "#00e5ff" }}>Limitation:</span>{" "}
          Boundary fits use discrete strength/time grids (9×9), limiting resolution.
          The reported slopes are linear approximations; true boundaries may be non-linear.
          Config #334 is an outlier (high slope, high aggAmp) — not representative of the full population.
        </div>
      </div>
    </div>
  );
}

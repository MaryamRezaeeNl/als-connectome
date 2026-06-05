"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamic imports — avoid SSR issues with recharts / SVG animations
const Ph0Grid     = dynamic(() => import("@/components/phases/Phase0Grid"),            { ssr: false });
const Ph0Magic    = dynamic(() => import("@/components/phases/Phase0Magic"),           { ssr: false });
const Ph0Topology = dynamic(() => import("@/components/phases/Phase0Topology"),        { ssr: false });
const Phase1A     = dynamic(() => import("@/components/phases/Phase1ACascade"),        { ssr: false });
const Phase1B     = dynamic(() => import("@/components/phases/Phase1BKnockout"),       { ssr: false });
const Phase1C     = dynamic(() => import("@/components/phases/Phase8ProtectiveNodes"), { ssr: false });
const Phase2      = dynamic(() => import("@/components/phases/Phase2MagicBalancing"),  { ssr: false });
const Phase3      = dynamic(() => import("@/components/phases/Phase3Degeneration"),    { ssr: false });
const Phase4      = dynamic(() => import("@/components/phases/Phase4Intervention"),    { ssr: false });
const Phase5      = dynamic(() => import("@/components/phases/Phase5Criticality"),     { ssr: false });
const Phase6      = dynamic(() => import("@/components/phases/Phase6Therapy"),         { ssr: false });
const Phase7      = dynamic(() => import("@/components/phases/Phase7Tipping"),         { ssr: false });
const Phase8      = dynamic(() => import("@/components/phases/Phase8TwoTier"),         { ssr: false });
const Phase9      = dynamic(() => import("@/components/phases/Phase9PhaseDiagram"),    { ssr: false });
const Phase10     = dynamic(() => import("@/components/phases/Phase10BoundaryRobustness"), { ssr: false });
const Phase12     = dynamic(() => import("@/components/phases/Phase12Subtypes"),       { ssr: false });
const Phase13     = dynamic(() => import("@/components/phases/Phase13Noise"),          { ssr: false });
const ExplPhaseTransition = dynamic(() => import("@/components/phases/ExplorationPhaseTransition"), { ssr: false });
const ExplMultiseed       = dynamic(() => import("@/components/phases/ExplorationMultiseed"),        { ssr: false });
const ExplTopologySA      = dynamic(() => import("@/components/phases/ExplorationTopologySA"),       { ssr: false });
const R2Motif    = dynamic(() => import("@/components/phases/Round2Motif"),             { ssr: false });
const R2Effic    = dynamic(() => import("@/components/phases/Round2Efficiency"),        { ssr: false });
const R2Therapy  = dynamic(() => import("@/components/phases/Round2TherapyBoundary"),  { ssr: false });
const R2Subtype  = dynamic(() => import("@/components/phases/Round2SubtypeTopology"),  { ssr: false });
const R2Biomark  = dynamic(() => import("@/components/phases/Round2Biomarkers"),       { ssr: false });
const R2Window   = dynamic(() => import("@/components/phases/Round2WindowPrediction"), { ssr: false });
const R2TWE      = dynamic(() => import("@/components/phases/Round2TWE"),              { ssr: false });
const R3Decoupled  = dynamic(() => import("@/components/phases/Round3Decoupled"),      { ssr: false });
const R3Downstream = dynamic(() => import("@/components/phases/Round3Downstream"),     { ssr: false });
const R3MitoThresh = dynamic(() => import("@/components/phases/Round3MitoThreshold"),  { ssr: false });
const R3MitoValid  = dynamic(() => import("@/components/phases/Round3MitoValidation"), { ssr: false });
const R3Topology   = dynamic(() => import("@/components/phases/Round3Topology"),       { ssr: false });
const R3Seed       = dynamic(() => import("@/components/phases/Round3SeedLocation"),   { ssr: false });
const R3VulnAlign  = dynamic(() => import("@/components/phases/Round3VulnAlignment"),  { ssr: false });

// ── Tab registry ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",     label: "Overview",                            icon: "🧠", short: "Overview"     },
  // Origin
  { id: "phase0a",      label: "Ph0A: Grid Prototype",                icon: "🟫", short: "Ph0A Grid"    },
  { id: "phase0b",      label: "Ph0B: Magic Graph",                   icon: "🔷", short: "Ph0B Magic"   },
  { id: "phase0c",      label: "Ph0C: Topology Search",               icon: "🔺", short: "Ph0C Topo"    },
  // Explorations
  { id: "expl3",        label: "Exploration: Topology SA",            icon: "🕸️", short: "Topology SA"  },
  { id: "expl1",        label: "Exploration: Phase Transition",       icon: "🔀", short: "Phase Trans." },
  { id: "expl2",        label: "Exploration: Multi-seed",             icon: "🎲", short: "Multi-seed"   },
  // Early Phases
  { id: "phase1a",      label: "Ph1A: Network Cascade",               icon: "🔴", short: "Ph1A Cascade" },
  { id: "phase1b",      label: "Ph1B: Knockout",                      icon: "🔬", short: "Ph1B Knockout"},
  { id: "phase1c",      label: "Ph1C: Protective Nodes",              icon: "✨", short: "1C Protect"  },
  { id: "phase2",       label: "Ph2: Magic Balancing",                icon: "⚖️", short: "Ph2 Magic"   },
  { id: "phase3",       label: "Ph3: Degeneration",                   icon: "🌡️", short: "Ph3 Degen"   },
  { id: "phase4",       label: "Ph4: Interventions",                  icon: "🔧", short: "Ph4 Interv."  },
  // Core Findings
  { id: "phase5",       label: "Ph5: Criticality",                    icon: "⚡", short: "Ph5 Critical" },
  { id: "phase6",       label: "Ph6: Therapy",                        icon: "💊", short: "Ph6 Therapy"  },
  { id: "phase7",       label: "Ph7: Falsification",                  icon: "🔬", short: "Ph7 Falsif."  },
  { id: "phase8",       label: "Ph8: Two-Tier",                       icon: "🏗️", short: "Ph8 Two-Tier" },
  { id: "phase9",       label: "Ph9: Phase Diagram",                  icon: "📐", short: "Ph9 Diagram"  },
  { id: "phase10",      label: "Ph10: Boundary Robustness",           icon: "📏", short: "Ph10 Boundary"},
  { id: "phase12",      label: "Ph11/12: Subtypes",                   icon: "🔵", short: "Ph12 Subtypes"},
  { id: "phase13",      label: "Ph13/14: Robustness",                 icon: "🛡️", short: "Ph14 Robust." },
  // Round 2
  { id: "r2motif",      label: "R2.1: Motif Resilience",              icon: "🌐", short: "R2.1 Motif"   },
  { id: "r2efficiency", label: "R2.2: Efficiency Tradeoff",           icon: "📊", short: "R2.2 Effic."  },
  { id: "r2therapy",    label: "R2.3: Topology Therapy Boundary",     icon: "💊", short: "R2.3 T.Bnd"   },
  { id: "r2subtype",    label: "R2.4: Subtype x Topology",            icon: "🧬", short: "R2.4 S×T"     },
  { id: "r2biomarker",  label: "R2.5: Early-Warning",                  icon: "🔬", short: "R2.5 EW"     },
  { id: "r2window",     label: "R2.7: Window Prediction",             icon: "⏱️", short: "R2.7 W.Pred"  },
  { id: "r2twe",        label: "R2.8: Therapeutic Window Estimator",  icon: "🤖", short: "R2.8 TWE"     },
  // Round 3
  { id: "r3decoupled",  label: "R3.1: Decoupled Aggregation",         icon: "🔬", short: "R3.1 Decoupled" },
  { id: "r3downstream", label: "R3.2: Downstream Causal Power",        icon: "⚗️", short: "R3.2 Downstream"},
  { id: "r3mitothresh", label: "R3.3: Mito Threshold",                 icon: "🔋", short: "R3.3 Mito Thr." },
  { id: "r3mitovalid",  label: "R3.4: Mito Validation",                icon: "✅", short: "R3.4 Mito Val." },
  { id: "r3topology",   label: "R3.5: Topological Necessity",          icon: "🕸️", short: "R3.5 Topology"  },
  { id: "r3seed",       label: "R3.6: Seed Location",                  icon: "🌱", short: "R3.6 Seed Loc." },
  { id: "r3vulnalign",  label: "R3.7: Vuln Alignment",                 icon: "🎯", short: "R3.7 Alignment" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Navigation section structure ──────────────────────────────────────────────
const NAV_SECTIONS: { label: string | null; ids: TabId[] }[] = [
  { label: null,            ids: ["overview"] },
  { label: "── Origin ──",  ids: ["phase0a", "phase0b", "phase0c"] },
  { label: "── Explorations ──", ids: ["expl3", "expl1", "expl2"] },
  { label: "── Early Phases ──", ids: ["phase1a", "phase1b", "phase1c", "phase2", "phase3", "phase4"] },
  { label: "── Core Findings ──", ids: ["phase5", "phase6", "phase7", "phase8", "phase9", "phase10", "phase12", "phase13"] },
  { label: "── Round 2 ──", ids: ["r2motif", "r2efficiency", "r2therapy", "r2subtype", "r2biomarker", "r2window", "r2twe"] },
  { label: "── Round 3 ──", ids: ["r3decoupled", "r3downstream", "r3mitothresh", "r3mitovalid", "r3topology", "r3seed", "r3vulnalign"] },
];

const TAB_MAP = Object.fromEntries(TABS.map(t => [t.id, t])) as Record<TabId, typeof TABS[number]>;

// ── Overview panel ────────────────────────────────────────────────────────────
const FINDINGS = [
  { n: "1", title: "Triphasic degeneration",         desc: "64.7% of parameter space shows genuine tipping points: silent phase → collapse → plateau. Falsified against null model at 0% FPR.",                                        color: "#00e5ff" },
  { n: "2", title: "Aggregation amplitude dominant", desc: "aggAmp spans 160-fold across regimes, predicts 84.6% of disease subtype membership. Separation Cohen d = 51.5.",                                                          color: "#a855f7" },
  { n: "3", title: "Two-tier disease model",         desc: "Tier 1: biochemical cascade (therapy-sensitive). Tier 2: topological cascade (insensitive). Early therapy delays Tier 2 by 265 steps.",                                   color: "#ffd700" },
  { n: "4", title: "Sharp linear therapy boundary",  desc: "max_start_t = 425 × strength − 237 (R²=0.98, config #334). Mean: 252 × strength − 107 across 17 configs.",                                                              color: "#a8ff78" },
  { n: "5", title: "Two disease subtypes",           desc: "Slow-tipping (aggAmp ~1.4, step 224) vs fast-tipping (aggAmp ~5.9, step 107). Qualitatively different therapy windows.",                                                  color: "#ff9944" },
  { n: "6", title: "Subtype rank invariant",         desc: "Relative ordering of degeneration aggressiveness never breaks under extreme perturbation (70% dropout, σ=1.0 noise).",                                                     color: "#ff4444" },
];

const R3_FINDINGS = [
  {
    n: "R3.1", title: "Decoupled Aggregation",
    desc: "aggAmp dominance is genuine, not a coupling artifact. ISR and TSSE are independently load-bearing (r=0.586 vs 0.463). Medium context (ISR=TSSE=2) → 100% genuine tipping.",
    color: "#00e5ff",
  },
  {
    n: "R3.2", title: "Downstream Causal Power",
    desc: "Mitochondria becomes load-bearing only at extreme fragility (mitFrag≥4, low-aggregation context). Glutamate, Ca²⁺, and irreversibility remain negligible across all regimes.",
    color: "#f97316",
  },
  {
    n: "R3.3", title: "Mitochondrial Threshold",
    desc: "Near-takeover onset at mitFrag=4.0 in low-aggregation context only. High aggregation contexts saturate the mito→ATP pathway, making mitFrag irrelevant as an independent driver.",
    color: "#ffd700",
  },
  {
    n: "R3.4", title: "Threshold Validation",
    desc: "R3.3 mitFrag=0.3 takeover confirmed artifact (1/3 criteria at n=15 seeds). With n=50: 0/3 criteria at mitFrag=0.3. Clean near-takeover boundary at mitFrag=4.0 (tight bootstrap CIs).",
    color: "#a8ff78",
  },
  {
    n: "R3.5", title: "Topological Necessity",
    desc: "TSSE is topology-sensitive; ISR is topology-invariant. ISR-dominant: ALL 5 topologies tip (100%). TSSE-dominant: only C. elegans tips. BA hub structure destroys coherence (r=0.073).",
    color: "#a855f7",
  },
  {
    n: "R3.6", title: "Seed Location Sensitivity",
    desc: "Seed location affects WHEN (88-step range: 77→165), not WHETHER tipping occurs (genuine=1.000 for 59/61 neurons). AVAL ranks 9th fastest — network hubs outpace vulnerability alone.",
    color: "#4ade80",
  },
  {
    n: "R3.7", title: "Vulnerability-Hub Alignment",
    desc: "BA rescued from 0%→80% genuine tipping by degree-correlated vulnerability. Same assignment destroys C. elegans (100%→0%). TSSE requires hub-vulnerability alignment, not specific architecture. Degree-death corr ≈0.41 is stable — hubs always die first; coherence only follows when alignment is correct.",
    color: "#f97316",
  },
];

const R2_FINDINGS = [
  {
    n: "R2.1", title: "Motif Resilience",
    desc: "Sparse chain most resilient (RES=0.815); triangle-rich worst (RES=0.738, −29% plateau survivors). Fewer spreading paths = slower cascade.",
    color: "#00e5ff",
  },
  {
    n: "R2.2", title: "Efficiency vs Resilience",
    desc: "Efficiency-resilience tradeoff is topology-specific. Triangle-rich has safe zone ≤60% strength (DEI=32.2). No universal tradeoff rule.",
    color: "#a8ff78",
  },
  {
    n: "R2.3", title: "Topology Therapy Boundary",
    desc: "Topology does NOT extend the therapeutic window timing. But sparse chain improves within-window prevention rate by +16pp (92% vs 76%).",
    color: "#ffd700",
  },
  {
    n: "R2.4", title: "Subtype × Topology",
    desc: "Slow-tipping disease (C0) is more topology-sensitive. Fast-tipping patients lose 3× more neurons under recurrent loop interventions.",
    color: "#a855f7",
  },
  {
    n: "R2.5", title: "Early-Warning Signals",
    desc: "aggAmp alone separates subtypes with Cohen d=51.5, r=0.999. Conceptual analogy: TDP-43 phosphorylation rate or NfL trajectory (unvalidated mapping).",
    color: "#fb923c",
  },
  {
    n: "R2.7", title: "Window Prediction",
    desc: "3 simulated early-warning proxies at t=50 predict therapy window width: r=0.765, RMSE=38.9 steps (88 days). Prediction feasible before any neuron death.",
    color: "#60a5fa",
  },
  {
    n: "R2.8", title: "Therapeutic Window Estimator",
    desc: "TWE achieves 86.8% oracle efficiency from t=50 signals. Decision regret: 4.6 neurons (13.2% of oracle gain). Dominant uncertainty: parameter variance 71.7%.",
    color: "#4ade80",
  },
];

function OverviewPanel() {
  const stats = [
    { label: "Neurons",         value: "61"      },
    { label: "Synapses",        value: "127"      },
    { label: "Configs tested",  value: "500"      },
    { label: "Critical regime", value: "76.4%"    },
    { label: "Genuine tipping", value: "247/382"  },
    { label: "Null FPR",        value: "0%"       },
    { label: "Therapy R²",      value: "0.98"     },
    { label: "TWE efficiency",  value: "86.8%"    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-5xl">🧬</div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">ALS-Inspired C. elegans Connectome Degeneration Model</h2>
            <p className="text-sm text-gray-400 max-w-3xl">
              Multi-phase computational study modelling ALS-relevant dynamics on the empirical 61-neuron{" "}
              <em>C. elegans</em> motor circuit. Nonlinear biophysical cascade (aggregation → mito damage →
              ATP collapse → excitotoxicity) on 127 directed synapses. All results are model-specific and
              hypothesis-generating only.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-gray-800 bg-opacity-60 rounded-lg px-3 py-2 text-center min-w-[72px]">
              <div className="text-lg font-bold text-cyan-300">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-200">
        <strong>⚠️ Disclaimer:</strong> This is a computational modelling study. It is{" "}
        <strong>not a clinical model of ALS</strong>, does not use human neural circuitry, and cannot
        make predictions about human patients. All results are hypothesis-generating only.
      </div>

      {/* Principal findings */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Principal Findings (Phases 5–14)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FINDINGS.map(f => (
            <div key={f.n} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: f.color, color: "#000" }}>{f.n}</span>
              <div>
                <div className="text-sm font-semibold text-gray-200 mb-0.5">{f.title}</div>
                <div className="text-xs text-gray-400">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Round 2 findings */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Round 2 — Computational Extension</h3>
        <p className="text-xs text-gray-500 mb-3">
          Round 2 tested whether topology shapes degeneration resilience and whether pre-symptomatic
          simulated early-warning proxies can guide therapeutic triage decisions.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {R2_FINDINGS.map(f => (
            <div key={f.n} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: f.color, color: "#000" }}>{f.n}</span>
              <div>
                <div className="text-sm font-semibold text-gray-200 mb-1">{f.title}</div>
                <div className="text-xs text-gray-400">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Round 3 findings */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Round 3 — Decoupled Aggregation &amp; Mechanism Dissection</h3>
        <p className="text-xs text-gray-500 mb-3">
          Round 3 decouples aggregation into ISR + TSSE, validates downstream causal roles, maps the
          mitochondrial takeover threshold, and tests topology and seed-location sensitivity under the
          v2.0 model.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {R3_FINDINGS.map(f => (
            <div key={f.n} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: f.color, color: "#000" }}>{f.n}</span>
              <div>
                <div className="text-sm font-semibold text-gray-200 mb-1">{f.title}</div>
                <div className="text-xs text-gray-400">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cascade diagram */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Excitotoxic Feedback Cascade</h3>
        <div className="flex flex-wrap items-center gap-1 text-sm font-mono">
          {([
            ["Aggregation ↑","#a855f7"],["→","#4b5563"],["Mito damage ↑","#ff6b35"],["→","#4b5563"],
            ["ATP ↓","#ff4444"],["→","#4b5563"],["Glutamate ↑","#ffd700"],["→","#4b5563"],
            ["Ca²⁺ ↑","#00e5ff"],["→","#4b5563"],["ROS ↑","#ff9944"],["→","#4b5563"],
            ["Aggregation ↑ ⟳","#a855f7"],
          ] as [string, string][]).map(([label, color], i) => (
            <span key={i} style={{ color }}>{label} </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          The glutamate/calcium pathway is{" "}
          <strong className="text-gray-300">aggregation-gated</strong> — requires ATP depletion to activate.
          This is why aggregation suppression dominates all other therapies.
        </p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const activeTabData = TAB_MAP[activeTab];

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">🧬</span>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">ALS Connectome Dashboard</h1>
              <p className="text-xs text-gray-500">C. elegans · 61 neurons · 127 synapses · Phase 0 → Phase 14 + Round 2 + Round 3</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400">
            <span className="text-cyan-500">✦</span> Maryam Rezaee
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">

        {/* Sidebar — sectioned navigation */}
        <aside className="lg:w-56 lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-800 bg-gray-950">
          <nav className="flex lg:flex-col gap-0 p-2 overflow-x-auto lg:overflow-x-visible lg:pb-8">
            {NAV_SECTIONS.map((section, si) => (
              <div key={si} className="flex lg:flex-col gap-1 lg:gap-0">
                {/* Section header — desktop only */}
                {section.label && (
                  <div className="hidden lg:flex items-center gap-1 px-2 pt-3 pb-1">
                    <div className="h-px flex-1 bg-gray-800" />
                    <span className="text-gray-600 text-xs font-semibold tracking-widest uppercase whitespace-nowrap px-1">
                      {section.label.replace(/──\s?/g, "").replace(/\s?──/g, "")}
                    </span>
                    <div className="h-px flex-1 bg-gray-800" />
                  </div>
                )}
                {/* Tab buttons */}
                {section.ids.map(id => {
                  const tab = TAB_MAP[id];
                  return (
                    <button key={id} onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs font-medium transition-colors whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-shrink w-auto lg:w-full
                        ${activeTab === id
                          ? "bg-cyan-900 text-cyan-200"
                          : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"}`}>
                      <span className="flex-shrink-0">{tab.icon}</span>
                      <span>{tab.short}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6">
          {/* Page title */}
          {activeTabData && (
            <div className="flex items-center gap-2 mb-5">
              <span className="text-2xl">{activeTabData.icon}</span>
              <h2 className="text-lg font-bold text-white">{activeTabData.label}</h2>
            </div>
          )}

          {activeTab === "overview"     && <OverviewPanel />}
          {activeTab === "phase0a"      && <Ph0Grid />}
          {activeTab === "phase0b"      && <Ph0Magic />}
          {activeTab === "phase0c"      && <Ph0Topology />}
          {activeTab === "phase1a"      && <Phase1A />}
          {activeTab === "phase1b"      && <Phase1B />}
          {activeTab === "phase1c"      && <Phase1C />}
          {activeTab === "phase2"       && <Phase2 />}
          {activeTab === "phase3"       && <Phase3 />}
          {activeTab === "phase4"       && <Phase4 />}
          {activeTab === "phase5"       && <Phase5 />}
          {activeTab === "phase6"       && <Phase6 />}
          {activeTab === "phase7"       && <Phase7 />}
          {activeTab === "phase8"       && <Phase8 />}
          {activeTab === "phase9"       && <Phase9 />}
          {activeTab === "phase10"      && <Phase10 />}
          {activeTab === "phase12"      && <Phase12 />}
          {activeTab === "phase13"      && <Phase13 />}
          {activeTab === "expl1"        && <ExplPhaseTransition />}
          {activeTab === "expl2"        && <ExplMultiseed />}
          {activeTab === "expl3"        && <ExplTopologySA />}
          {activeTab === "r2motif"      && <R2Motif />}
          {activeTab === "r2efficiency" && <R2Effic />}
          {activeTab === "r2therapy"    && <R2Therapy />}
          {activeTab === "r2subtype"    && <R2Subtype />}
          {activeTab === "r2biomarker"  && <R2Biomark />}
          {activeTab === "r2window"     && <R2Window />}
          {activeTab === "r2twe"        && <R2TWE />}
          {activeTab === "r3decoupled"  && <R3Decoupled />}
          {activeTab === "r3downstream" && <R3Downstream />}
          {activeTab === "r3mitothresh" && <R3MitoThresh />}
          {activeTab === "r3mitovalid"  && <R3MitoValid />}
          {activeTab === "r3topology"   && <R3Topology />}
          {activeTab === "r3seed"       && <R3Seed />}
          {activeTab === "r3vulnalign"  && <R3VulnAlign />}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-8 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <span>© 2026 Maryam Rezaee · ALS Connectome Degeneration Project</span>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <a href="https://doi.org/10.5281/zenodo.20528826" target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-400 transition-colors">
                📄 Zenodo DOI
              </a>
              <span className="text-gray-800">·</span>
              <a href="https://github.com/MaryamRezaeeNl/als-connectome" target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-400 transition-colors">GitHub</a>
              <span className="text-gray-800">·</span>
              <a href="https://linkedin.com/in/maryam-rezaee" target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-400 transition-colors">LinkedIn</a>
            </div>
          </div>
          <div className="text-center text-gray-700 leading-relaxed max-w-xs">
            <span className="text-amber-700">⚠</span> Computational modelling study · Not peer-reviewed
            <br />Not a clinical model · All results hypothesis-generating only
          </div>
          <div className="flex flex-col items-center sm:items-end gap-1.5">
            <a href="mailto:maryamrezaeenl@gmail.com"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors text-xs">
              💬 Feedback
            </a>
            <a href="https://github.com/MaryamRezaeeNl/als-connectome/issues" target="_blank" rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-500 transition-colors">
              Open a GitHub Issue
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

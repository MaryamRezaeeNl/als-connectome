# ALS Connectome Degeneration Project

A computational study of ALS-like cascade dynamics  
on the *C. elegans* motor connectome (61 neurons, 127 synapses).

> ⚠️ **Disclaimer:** This is a hypothesis-generating computational model.  
> It is **NOT a clinical ALS model** and cannot predict human treatment outcomes.  
> The *C. elegans* motor circuit is used as a tractable graph substrate for  
> studying abstract cascade dynamics. All results are model-specific.

## 🔗 Live Dashboard

**[als-connectome-dashboard.vercel.app](https://als-connectome-dashboard.vercel.app)**

Interactive visualization of all phases — from the origin prototypes (Phase 0) through
Phase 14 and the full Round 2 + Round 3 extensions.

---

## What This Project Does

Models nonlinear degeneration dynamics on the empirical *C. elegans* motor circuit
using a biophysical cascade:

```
Aggregation → Mitochondrial damage → ATP collapse → Excitotoxicity → Neuronal death
                                                              ↑_____________________|
                                         (prion-like spreading closes the feedback loop)
```

Across **Phase 0 (prototypes) + Phases 1–14 + Round 2 + Round 3**, the model:

- Discovers genuine tipping points (triphasic collapse) in 64.7% of parameter space
- Maps a sharp linear therapeutic boundary (R²=0.98)
- Identifies two robust disease subtypes (slow-tipping vs fast-tipping)
- Tests pre-symptomatic early-warning signal prediction (87% simulated subtype classification accuracy at t=50)
- Builds a Therapeutic Window Estimator achieving 86.8% oracle efficiency

---

## Key Findings

| # | Finding | Value |
|---|---------|-------|
| 1 | **Triphasic degeneration** — silent → collapse → plateau | 64.7% of configs are genuine |
| 2 | **Single control parameter** — aggAmp explains subtype membership | Cohen d = 51.5, r = 0.999 |
| 3 | **Therapy window closes before symptom onset** | max_start_t = 252×strength − 107 (mean) |
| 1C | **Protective nodes** — DA6 is the strongest protector; absorb-ratio predicts protection | 549 cascade simulations across all 61 neurons |
| 4 | **Two-tier cascade** — biochemical seeds topological amplification | Tier 2 delay: 265 steps |
| 5 | **Two disease subtypes** — slow (tip=224) vs fast (tip=107) | Bootstrap stable, rank invariant |
| 6 | **Pre-symptomatic prediction feasible** | 87% simulated accuracy at t=50, before first neuron death |
| 7 | **Sparse connectivity = more resilient** | sparse chain RES=0.815 vs triangle-rich RES=0.738 |
| 8 | **86.8% oracle efficiency from 3 biomarkers** | Decision regret: 4.6 neurons (13.2%) |
| R3.1 | **Decoupled aggregation** — ISR and TSSE are independently load-bearing | ISR more predictive (r=0.586 vs 0.463); medium context (ISR=TSSE=2) → 100% genuine |
| R3.2 | **Downstream causality** — mitochondria becomes load-bearing only under extreme stress | Mito load-bearing at mitFrag≥4 in low-aggregation context; glutamate/calcium negligible |
| R3.3 | **Mitochondrial threshold** — near-takeover onset at mitFrag=4.0 | 2/3 strict criteria met (shift+gain); rdrop structurally constrained by low genuine_rate |
| R3.4 | **Threshold validation** — Phase 16B mitFrag=0.3 signal confirmed artifact | With n=50 seeds: 0/3 criteria at mitFrag=0.3; near-takeover confirmed at mitFrag=4.0 |
| R3.5 | **Topological necessity** — TSSE is topology-sensitive, ISR is topology-invariant | ISR-dominant: 100% genuine on all 5 topologies; TSSE-dominant: only C. elegans tips |
| R3.6 | **Seed location** — timing modulator, not tipping determinant | 59/61 neurons fragile; onset range 77–165 steps; AVAL ranks 9th fastest cascade |

---

## Project Structure

```
als_connectome/
├── src/                            Core library (importable from any phase script)
│   ├── connectome.py               # C. elegans wiring data (61 neurons, 127 synapses)
│   ├── simulator.py                # Core cascade simulator
│   ├── metrics.py                  # Analysis metrics
│   ├── main.py                     # Entry point / orchestration
│   └── generate_figures.py         # Figure generation pipeline
│
├── phases/                         All simulation phase scripts (run from project root)
│   │
│   ├── phase0a_grid_prototype.py   Phase 0A: 30×30 grid cellular automaton (origin)
│   ├── phase0b_magic_graph.py      Phase 0B: magic graph optimizer (NetworkX + gradient descent)
│   ├── phase0c_topology_search.py  Phase 0C: 30-graph topology search (AI-learned topology)
│   │
│   ├── phase1_knockout.py          Phase 1B: hub neuron knockout analysis
│   ├── phase1_protective.py        Phase 1C: protective node analysis (DA6 strongest protector)
│   ├── phase2_magic.py             Phase 2: JSX network visualisation baseline
│   ├── phase4_intervention.py      Phase 4: intervention parameter sweep
│   ├── phase5_criticality.py       Phase 5 ★: 500-config sweep; CriticalitySimulator
│   ├── phase6_therapy.py           Phase 6: 5 therapy classes × 500 configs × 10 envs
│   ├── phase7a_validation.py       Phase 7A: ablation + null-model falsification
│   ├── phase7b_tipping_criterion.py Phase 7B ★: strict 3-part tipping criterion
│   ├── phase7c_topology.py         Phase 7C: genuine tipping rate across 5 topologies
│   ├── phase7d_escape.py           Phase 7D: disease escape mechanisms
│   ├── phase8_two_tier.py          Phase 8: two-tier cascade initiation
│   ├── phase9_phase_diagram.py     Phase 9: therapeutic boundary grid
│   ├── phase10_boundary_robustness.py  Phase 10: boundary for top-20 configs
│   ├── phase11_subtypes.py         Phase 11: PCA + K-means subtype analysis
│   ├── phase12_validation.py       Phase 12: subtype validation on 247 configs
│   ├── phase13_noise.py            Phase 13: biological noise robustness
│   ├── phase14_breaking.py         Phase 14: breaking threshold probe
│   │
│   ├── phase_r2_1_motif_resilience.py     R2.1: topology motif resilience (9 variants)
│   ├── phase_r2_2_efficiency_boundary.py  R2.2: efficiency vs resilience tradeoff
│   ├── phase_r2_3_therapy_boundary.py     R2.3: topology-dependent therapeutic boundary
│   ├── phase_r2_4_subtype_topology.py     R2.4: subtype × topology interaction
│   ├── phase_r2_5_biomarkers.py           R2.5: topology-sensitive biomarker discovery
│   ├── phase_r2_5b_early_prediction.py    R2.5b: pre-symptomatic subtype classification
│   ├── phase_r2_7_window_prediction.py    R2.7: therapeutic window prediction from t=50
│   └── phase_r2_8_twe.py                 R2.8: Therapeutic Window Estimator (TWE)
│
│   ├── phase_r3_1_decoupled_aggregation.py  R3.1: ISR + TSSE replace aggAmp; decoupled model
│   ├── phase_r3_2_downstream_causality.py   R3.2: downstream causal power (ablation × 3 regimes)
│   ├── phase_r3_3_mito_threshold.py         R3.3: mitochondrial takeover threshold grid sweep
│   ├── phase_r3_4_mito_validation.py        R3.4: validated threshold with strict dual-criterion
│   ├── phase_r3_5_topology_necessity.py     R3.5: topology necessity test (v2.0 decoupled model)
│   └── phase_r3_6_seed_location.py          R3.6: seed location sensitivity (all 61 neurons)
│
├── explore/                        Standalone exploration scripts (no ALS prerequisites)
│   ├── explore_multiseed.py        # Multi-seed exploration
│   ├── explore_phase_transition.py # Phase transition analysis
│   ├── explore_topology_v3a.py     # Topology ablation variant A
│   └── explore_topology_v3b.py     # Topology ablation variant B
│
├── paper/                          Final manuscript PDF
│   └── rezaee_2026_als_connectome.pdf  Published preprint PDF
│
├── manuscript/                        Manuscript submission package
│   ├── main.tex                    LaTeX source (compiled with pdflatex, TeX Live 2026)
│   ├── references.bib              BibTeX bibliography (14 entries)
│   ├── rezaee_2026_als_connectome.pdf  Compiled PDF (39 pages)
│   └── figures/                    16 PNG figures (fig1–fig16)
│
├── dashboard/                      Next.js 16 interactive dashboard (Vercel-deployed)
├── figures/                        16 static PNG figures for the manuscript (fig1–fig16)
│                                   Note: the dashboard uses independent Recharts
│                                   visualizations — the two figure systems show the
│                                   same findings but are not linked.
├── results/                        Phase output JSON files and Markdown reports
├── .gitignore
└── README.md
```

★ Phase 5 and Phase 7B must run before any later phase (they produce prerequisite JSON files).

---

## How to Run

### Requirements

```
pip install numpy
```

No other external dependencies. Clustering, PCA, and regression are implemented in pure numpy.  
Round 2 phases additionally import from `phase5_criticality.py` and `phase6_therapy.py` (already in `phases/`).

### Quick start

```bash
# Run core simulation
python src/main.py

# Generate all figures
python src/generate_figures.py
```

`src/main.py` runs a single simulation with default parameters (config #334) and prints a step-by-step snapshot. `src/generate_figures.py` regenerates all 16 paper figures from the JSON files in `results/`.

### Recommended execution order

Run all commands from the project root. Each script writes to `results/` automatically.

**Step 1 — Generate the parameter sweep (required for all later phases)**
```bash
python phases/phase5_criticality.py        # ~3–5 min → results/regime_map.json
```

**Step 2 — Apply the strict tipping criterion (required for Phases 10–14 and Round 2)**
```bash
python phases/phase7b_tipping_criterion.py # ~2 min → results/phase7b_strict_criterion.json
```

**Step 3 — Phases 12 prerequisite (required for Round 2)**
```bash
python phases/phase12_validation.py        # ~15 min → results/phase12_validation.json
```

**Step 4 — Remaining phases in any order**
```bash
python phases/phase6_therapy.py                    # ~10–15 min
python phases/phase7a_validation.py                # ~2 min
python phases/phase7c_topology.py                  # ~5 min
python phases/phase7d_escape.py                    # ~3 min
python phases/phase8_two_tier.py                   # ~3 min
python phases/phase9_phase_diagram.py              # ~8 min
python phases/phase10_boundary_robustness.py       # ~20 min
python phases/phase11_subtypes.py                  # ~5 min
python phases/phase13_noise.py                     # ~3–4 min
python phases/phase14_breaking.py                  # ~20 sec
```

**Step 5 — Round 2 (requires Steps 1–3)**
```bash
python phases/phase_r2_1_motif_resilience.py       # ~5 min
python phases/phase_r2_2_efficiency_boundary.py    # ~8 min
python phases/phase_r2_3_therapy_boundary.py       # ~10 min
python phases/phase_r2_4_subtype_topology.py       # ~15 min
python phases/phase_r2_5_biomarkers.py             # ~5 min
python phases/phase_r2_5b_early_prediction.py      # ~2 min  (requires r2_5)
python phases/phase_r2_7_window_prediction.py      # ~11 min (requires r2_5b)
python phases/phase_r2_8_twe.py                   # ~3 min  (requires r2_7)
```

**Step 6 — Round 3 (requires Steps 1–2; ISR/TSSE decoupled model)**
```bash
python phases/phase_r3_1_decoupled_aggregation.py  # ~8 min  → results/r3_1_decoupled_aggregation/
python phases/phase_r3_2_downstream_causality.py   # ~15 min → results/r3_2_downstream_causality/
python phases/phase_r3_3_mito_threshold.py         # ~2 min  → results/r3_2_downstream_causality/
python phases/phase_r3_4_mito_validation.py        # ~2 min  → results/r3_2_downstream_causality/
python phases/phase_r3_5_topology_necessity.py     # ~11 min → results/r3_5_topology_necessity/
python phases/phase_r3_6_seed_location.py          # ~9 min  → results/r3_6_seed_location/
```

### Phase prerequisites

| Script | Requires |
|--------|----------|
| `phase5_criticality.py` | none |
| `phase6_therapy.py` – `phase9_phase_diagram.py` | `regime_map.json` |
| `phase10_boundary_robustness.py` | `regime_map.json`, `phase7b_strict_criterion.json` |
| `phase11_subtypes.py` | `phase10_boundary_robustness.json` |
| `phase12_validation.py` | `regime_map.json`, `phase7b_strict_criterion.json` |
| `phase13_noise.py`, `phase14_breaking.py` | `regime_map.json`, `phase7b_strict_criterion.json` |
| `phase_r2_*.py` | `regime_map.json`, `phase7b_strict_criterion.json`, `phase12_validation.json` |
| `phase_r2_7_window_prediction.py` | above + `r2_early_prediction.json` |
| `phase_r2_8_twe.py` | above + `r2_window_prediction.json` |
| `phase_r3_1_decoupled_aggregation.py` | `regime_map.json`, `phase7b_strict_criterion.json` |
| `phase_r3_2_downstream_causality.py` | `critical_configs.json`, `r3_1_decoupled_aggregation/` |
| `phase_r3_3_mito_threshold.py` | `critical_configs.json`, `r3_1_decoupled_aggregation/` |
| `phase_r3_4_mito_validation.py` | `r3_2_downstream_causality/r3_3_results.json` |
| `phase_r3_5_topology_necessity.py` | `phase7c_topology.json`, `r3_1_decoupled_aggregation/` |
| `phase_r3_6_seed_location.py` | `critical_configs.json`, `r3_1_decoupled_aggregation/` |

---

## Parameter Space

Seven free parameters swept in Phase 5 (500 Latin-hypercube-like samples):

| Parameter | Range | Sampling |
|-----------|-------|----------|
| aggregationAmplification | [0.05, 20.0] | log-uniform |
| mitochondrialFragility | [0.3, 8.0] | uniform |
| atpCollapseThreshold | [0.05, 0.7] | uniform |
| glutamateSensitivity | [0.0005, 0.1] | log-uniform |
| calciumStressGain | [0.02, 5.0] | uniform |
| oxidativeFeedback | [0.0005, 0.5] | log-uniform |
| recoveryIrreversibility | [0.2, 0.99] | uniform |

Log-uniform sampling is used for parameters spanning >10× range.

---

## Connectome

Defined in `src/connectome.py` based on White et al. (1986) and Cook et al. (2019).

| Type | Count | Vulnerability |
|------|-------|---------------|
| Sensory | 6 | 0.05 |
| Forward/backward command interneurons | 10 | 0.15 |
| Premotor interneurons | 8 | 0.30 |
| DA motor neurons (backward dorsal) | 9 | 1.00 |
| DB motor neurons (forward dorsal) | 7 | 0.90 |
| DD inhibitory dorsal | 6 | 0.70 |
| VA motor neurons (backward ventral) | 5 | 0.95 |
| VB motor neurons (forward ventral) | 5 | 0.85 |
| VD inhibitory ventral | 5 | 0.65 |

Total: 61 neurons, 127 directed chemical synapses.

---

## Results Files

All outputs are written to `results/`. Each phase produces a JSON data file and a Markdown report.

| File | Phase | Contents |
|------|-------|----------|
| `regime_map.json` | 5 | 500-config sweep with regime labels and parameters |
| `critical_configs.json` | 5 | Top-20 critical configurations |
| `phase6_therapy_results.json` | 6 | 500 therapy configs × 10 environments |
| `phase7b_strict_criterion.json` | 7B | Genuine/not classification for 382 critical configs |
| `phase7c_topology.json` | 7C | Genuine tipping rates by topology type |
| `phase9_phase_diagram.json` | 9 | 99-point (strength, start_t) boundary grid |
| `phase10_boundary_robustness.json` | 10 | Boundary slope, intercept, R² for top-20 configs |
| `phase12_validation.json` | 12 | K-means clusters + bootstrap stability for 247 configs |
| `r2_motif_resilience.json` | R2.1 | Resilience scores for 9 topology variants |
| `r2_efficiency_boundary.json` | R2.2 | DEI (efficiency-resilience index) per topology |
| `r2_therapy_boundary.json` | R2.3 | Therapeutic boundary per topology |
| `r2_subtype_topology.json` | R2.4 | Subtype × topology interaction effects |
| `r2_biomarkers.json` | R2.5 | Feature separation (Cohen d, Pearson r) |
| `r2_early_prediction.json` | R2.5b | Pre-symptomatic subtype classification (t=50/100) |
| `r2_window_prediction.json` | R2.7 | Therapy window regression from t=50 features |
| `r2_therapeutic_window_estimator.json` | R2.8 | TWE model per-config predictions |
| `r2_triage_simulation.json` | R2.8 | Virtual triage outcomes |
| `r2_decision_quality.json` | R2.8 | Uncertainty decomposition + calibration |
| `r3_1_decoupled_aggregation/` | R3.1 | ISR × TSSE 5×5 grid; 25 cells × 20 seeds |
| `r3_2_downstream_causality/` | R3.2–R3.4 | Downstream causal power + mito threshold validation |
| `r3_5_topology_necessity/` | R3.5 | Genuine tipping rates across 5 topologies (v2.0) |
| `r3_6_seed_location/` | R3.6 | Seed fragility for all 61 neurons |

---

## Dashboard

Built with Next.js 16, TypeScript, Recharts, and Tailwind CSS 4.  
Deployed on Vercel. Source in `dashboard/`.

> **Note:** `figures/` contains 16 static PNG files generated for the manuscript submission.
> The dashboard uses independent interactive Recharts visualizations — the two systems show
> the same findings but are not linked. PNGs were generated from the `results/` JSON files
> using matplotlib. The generation script is not included in this repository but all
> source data is available in `results/`.

```bash
cd dashboard
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

---

## Data Availability

All simulation outputs are committed to `results/`. No external datasets are required —
the connectome topology is fully defined in `src/connectome.py`. All random seeds are
deterministic and specified within each phase script.

---

## Citation

If you use this code or data, please cite:

> Rezaee, M. (2026). ALS Connectome Degeneration Project.
> Zenodo. https://doi.org/10.5281/zenodo.20528826

---

## References

- White JG, Southgate E, Thomson JN, Brenner S (1986). The structure of the nervous system  
  of the nematode *Caenorhabditis elegans*. *Phil Trans R Soc B* 314:1–340.
- Cook SJ et al. (2019). Whole-animal connectomes of both *C. elegans* sexes.  
  *Nature* 571:63–71.
- Al-Chalabi A et al. (2017). ALS disease progression: a systematic review.  
  *J Neurol Neurosurg Psychiatry* 88:461–469.

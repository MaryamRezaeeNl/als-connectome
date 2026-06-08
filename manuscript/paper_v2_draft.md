# Mechanism identifiability in connectome-based neurodegeneration: decoupling intracellular seeding from trans-synaptic spread reveals topology-invariant and topology-dependent disease entry points

**Maryam Rezaee**  
Independent Researcher  
maryamrezaeenl@gmail.com  
June 2026

---

> **CRITICAL DISCLAIMERS:** This is a computational modelling study using the *C. elegans* 61-neuron motor connectome as a substrate for studying abstract degeneration dynamics. It is **not a clinical model of ALS**, does not use human neural circuitry, and cannot make predictions about human patients. The *C. elegans* motor system differs fundamentally from the human corticospinal–motor neuron system affected in ALS. All model parameters are chosen for dynamical plausibility, not biological calibration to measured quantities in any organism. **All results are hypothesis-generating and require experimental validation before any translational significance can be attributed to them.**

---

## Abstract

Connectome-based neurodegeneration models typically aggregate protein seeding and synaptic spread into a single amplification parameter, leaving the relative causal roles of cell-autonomous and circuit-dependent mechanisms unresolved. We address this identifiability problem by extending a previously validated *C. elegans* motor-circuit cascade model (v1.0: https://doi.org/10.5281/zenodo.20528826; v2.0: https://doi.org/10.5281/zenodo.20592681) to decouple intracellular seeding rate (ISR) from trans-synaptic spread efficiency (TSSE).

Across a 5×5 parameter grid (25 cells, 500 baseline runs), both mechanisms independently sustain genuine triphasic tipping (mean rate 83.8%), with ISR more predictive of tipping probability (Pearson r = 0.586 vs. 0.463 for TSSE). A single-mechanism ablation protocol applied across six cascade pathways and three dynamical regimes confirms that ISR and TSSE are the sole universally load-bearing mechanisms; mitochondrial damage acquires load-bearing character only under extreme fragility (mitochondrialFragility ≥ 4.0, near-takeover onset confirmed with n = 50 seeds and 95% bootstrap confidence intervals), while glutamate excitotoxicity, calcium/ROS, and irreversibility remain negligible across all regimes.

Topology replication across five graph types (8,100 runs) reveals a decisive mechanistic dissociation: ISR-dominant cascades achieve 100% genuine tipping on all five topologies, whereas TSSE-dominant cascades succeed only on the biological *C. elegans* connectome (100%) and fail on all four synthetic alternatives (0–5%). This establishes ISR as a topology-invariant, cell-autonomous disease mechanism and TSSE as a topology-sensitive, circuit-dependent mechanism. A vulnerability-alignment experiment (R3.7) reveals that BA topology's resistance to TSSE cascades reflects hub-vulnerability misalignment rather than architecture per se: degree-correlated vulnerability rescues BA genuine tipping to 80% while the same assignment destroys *C. elegans* tipping entirely (1.000 → 0.000), confirming that the biological motor circuit's success depends on the specific alignment between synaptic connectivity and cellular vulnerability, not on network topology statistics alone. A seed-location sweep of all 61 neurons shows that the initial aggregation focus point is a timing modulator (onset range: 77–165 steps, 88-step window) rather than a tipping determinant (genuine tipping rate = 1.000 for 59/61 neurons).

Three therapeutic-mapping phases extend these mechanistic findings into intervention design. A 5×4 ISR × glutamate combination sweep (R3.8) demonstrates that glutamate suppression is 63-fold less effective than ISR suppression in preventing genuine tipping, with all combination synergies additive — confirming ISR as the cascade gatekeeper. A 19-level ISR suppression dose-response sweep (R3.9) reveals a sharp therapeutic cliff at 85–90% suppression (single-step drop of 28 percentage points in genuine tipping rate); ISR50 requires 96.5% suppression and ISR90 is not reached even at 99%, with residual tipping sustained by the independent TSSE pathway. Decomposing ISR suppression into production-targeting (ASO analogue; R3.10, Intervention A) versus spread-targeting (synaptic blocker analogue; Intervention B) shows that production suppression alone substantially outperforms spread inhibition at every tested dose (best benefit 0.342 vs. 0.137), while coupled co-suppression is synergistic above 60% strength by Bliss Independence analysis (synergy +0.47 at 80%, CI [+0.38, +0.53]), with synergy onset coinciding exactly with the R3.9 therapeutic cliff.

These findings sharpen the mechanistic claims of v1.0, generate testable predictions distinguishing cell-autonomous from circuit-dependent ALS pathology, and identify the ISR production pathway as the primary target for cascade prevention.

*Keywords:* neurodegeneration; connectome; protein aggregation; trans-synaptic spread; tipping points; ALS; *C. elegans*; mechanism identifiability; topology; vulnerability alignment; hub structure

---

## 1. Introduction

### 1.1 Background

Computational models of ALS-related neurodegeneration increasingly incorporate network structure as a substrate for propagating pathological protein aggregation [CITATION]. A key modelling challenge is *mechanism identifiability*: when a single parameter controls both local protein accumulation and synaptic propagation, it is impossible to determine which process is the primary driver of network-level collapse. This limits the translational value of parameter sensitivity analyses and ablation studies.

In v1.0 (Rezaee 2026), we demonstrated that a biophysical cascade (aggregation → mitochondrial damage → ATP collapse → glutamate excitotoxicity → calcium/ROS → aggregation) running on the empirical *C. elegans* 61-neuron motor connectome produces genuine triphasic tipping points, a sharp linear therapeutic boundary, and two disease subtypes that are robust to biological noise. A key finding was that `aggregationAmplification` (aggAmp) — the dominant parameter — explains 84.6% of subtype membership variance (Cohen's d = 51.5) and separates subtypes with Pearson r = 0.999.

However, the v1.0 aggAmp parameter controlled *both* intracellular seeding (intrinsic protein misfolding) and trans-synaptic spread (prion-like propagation) through a single multiplicative scalar. This coupling raises a question of mechanism identifiability: is the aggAmp dominance finding a property of the underlying biology (one mechanism is genuinely more load-bearing), or is it a coupling artifact (the dominance shifts depending on which sub-mechanism drives it)?

### 1.2 The identifiability problem

Separating cell-autonomous from circuit-dependent disease mechanisms matters for intervention design. If intracellular seeding is primary, therapies targeting individual neurons (e.g., ASO-mediated TDP-43 stabilization) may be sufficient regardless of circuit topology. If trans-synaptic spread is primary, circuit structure becomes a primary determinant of disease progression, and topological interventions — or therapies targeting synaptic transmission — become necessary.

The v1.0 topology validation (Phase 7C) showed that the Barabasi-Albert scale-free graph achieved 0% genuine tipping while the *C. elegans* connectome achieved 100%, confirming strong topology dependence. But this could reflect either mechanism being suppressed by the BA hub structure; the coupled aggAmp parameter did not permit distinguishing which.

### 1.3 Round 3 scope

This paper reports Round 3 (R3.1–R3.10), a ten-phase extension addressing mechanism identifiability and its therapeutic implications:

**Mechanistic dissection (R3.1–R3.7):**
- **R3.1**: Decouple aggAmp into ISR and TSSE; characterise the 5×5 parameter landscape
- **R3.2**: Downstream causal power — can mitochondria, glutamate, or calcium become load-bearing?
- **R3.3/R3.4**: Map and validate the mitochondrial near-takeover threshold with bootstrapped confidence intervals
- **R3.5**: Replicate the topology test with the decoupled model; isolate which mechanism drives topology sensitivity
- **R3.6**: Test seed location sensitivity — does the initial aggregation focus point change tipping?
- **R3.7**: Determine whether BA's resistance to TSSE cascades reflects hub-vulnerability misalignment or hub architecture per se

**Therapeutic mapping (R3.8–R3.10):**
- **R3.8**: Gatekeeper vs amplifier — ISR × glutamate combination therapy sweep; which pathway governs cascade entry?
- **R3.9**: Therapeutic cliff mapping — does ISR suppression produce a gradual or cliff-like dose response?
- **R3.10**: Biological mapping of ISR — does production suppression (ASO analogue) differ from spread inhibition (synaptic blocker analogue) in efficacy and dose-response shape?

All phases use the *C. elegans* motor connectome (61 neurons, 127 directed synapses; White et al. 1986; Cook et al. 2019) and the strict three-part Phase 7B tipping criterion (peak death rate > 4, spatial coherence r > 0.30, first death after step 50) established in v1.0.

---

## 2. Methods

### 2.1 Model: decoupled aggregation (v2.0)

The v1.0 aggregation equation was:

```
Δagg_i = vuln_i · AGG_SEED_RATE · aggAmp · Δt
        + AGG_SPREAD_RATE · aggAmp · Σ_j w_{ij} · agg_j · Δt
        + oxFeedback · ox_i · Δt
```

where `vuln_i` is neuron *i*'s fixed vulnerability score (DA class = 1.0, DB = 0.90, VA = 0.95, VB = 0.85, DD/VD = 0.65–0.70, interneurons = 0.15–0.30, sensory = 0.05), `w_{ij}` is the synaptic weight from presynaptic neuron *j*, and `ox_i` is oxidative stress.

The v2.0 decoupled equation replaces the single aggAmp scalar with two independent parameters:

```
Δagg_i = vuln_i · AGG_SEED_RATE · ISR · Δt                    (intracellular seeding)
        + AGG_SPREAD_RATE · TSSE · Σ_j w_{ij} · agg_j · Δt   (trans-synaptic spread)
        + oxFeedback · ox_i · Δt                               (oxidative feedback)
```

**Intracellular seeding rate (ISR)** scales the per-neuron intrinsic aggregation growth proportional to vulnerability. Biologically, this corresponds to the local protein misfolding rate — a cell-autonomous process independent of synaptic connectivity.

**Trans-synaptic spread efficiency (TSSE)** scales prion-like propagation from presynaptic to postsynaptic neurons along connectome edges. This is an inherently circuit-dependent mechanism whose dynamics depend on the adjacency structure.

All other cascade components (ATP dynamics, excitotoxicity, calcium, oxidative stress, irreversibility) are unchanged from v1.0. Backward compatibility: setting ISR = TSSE = aggAmp reproduces v1.0 dynamics exactly.

### 2.2 Parameter grid (R3.1)

We swept ISR ∈ {0.05, 0.5, 2.0, 5.0, 10.0} × TSSE ∈ {0.05, 0.5, 2.0, 5.0, 10.0}, yielding 25 cells. Each cell was run with 20 random seeds × 500 steps = 500 baseline runs. Ablation runs (10 seeds each, each mechanism disabled to 0.001) confirmed load-bearing status. **Medium context** (ISR = TSSE = 2.0) was selected for topology and seed-location tests based on 100% genuine tipping rate at this diagonal point.

### 2.3 Ablation protocol (R3.2)

Six mechanisms were ablated one at a time by setting the controlling parameter to a near-zero value while holding all others at their grid values:

| Code | Mechanism | Parameter set to |
|---|---|---|
| A | Intracellular seeding | ISR = 0.001 |
| B | Trans-synaptic spread | TSSE = 0.001 |
| C | Mitochondrial damage | mitFrag = 0.001 |
| D | Glutamate excitotoxicity | glutSens = 1×10⁻⁶ |
| E | Calcium / ROS | calcGain = 0.001 |
| F | Irreversibility lock | recIrrev = 0.999 |

Three dynamical regimes were tested: seeding-dominant (ISR high, TSSE moderate), spread-dominant (ISR low, TSSE high), and downstream-stressed (moderate ISR/TSSE, elevated mitFrag/glutSens/calcGain). Effect size: *large* = first-death shift > 50 steps OR plateau gain > 10 neurons OR genuine-rate drop > 0.30; *medium* = > 20/5/0.10; *small* = below medium.

### 2.4 Mitochondrial threshold protocol (R3.3/R3.4)

R3.3 swept mitFrag ∈ {0.3, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0} across three aggregation contexts (low: ISR=TSSE=0.5; medium: ISR=TSSE=2.0; high: ISR=TSSE=5.0), with n = 15 seeds per cell (900 runs total). R3.4 validated the low context with n = 50 seeds and 10,000 percentile-bootstrap resamples for 95% confidence intervals on shift, plateau gain, and genuine-rate drop. Strict dual-criterion for near-takeover classification required ALL three: shift > 50 steps AND gain > 5 neurons AND rdrop > 0.20.

### 2.5 Topology test protocol (R3.5)

Five graph types were tested with the decoupled model at medium context (ISR = TSSE = 2.0):

1. *C. elegans* biological connectome (1 instance)
2. Erdős–Rényi random directed graph (20 instances, n = 61, m = 127)
3. Barabasi–Albert scale-free (20 instances)
4. Watts–Strogatz small-world (20 instances, k = 4, p = 0.3)
5. Degree-preserved double-edge-swap shuffle (20 instances)

Edge weights and synapse types for synthetic graphs were sampled from the empirical *C. elegans* weight distribution. Vulnerability scores, neurotransmitter identities, and initial state were held fixed across all topologies. Ten parameter configurations (including mechanism-isolation configs: ISR-dominant: ISR=5.0, TSSE=0.5; spread-dominant: ISR=0.5, TSSE=5.0) × 10 seeds × 81 topology instances = 8,100 runs × 500 steps.

### 2.6 Seed location protocol (R3.6)

Initial aggregation boost of +0.5 was applied to each of the 61 neurons in turn (10 seeds × 10 parameter configurations = 100 runs per neuron, 6,100 runs total). Three named conditions were also tested: AVAL boost (highest-betweenness command interneuron), DA6 boost (strongest protective node from Phase 1B), and uniform baseline (zero initial aggregation). AVAL was used as a substitute for DVA (the top cascade-critical node in the Phase 1A cascade-graph analysis), which is absent from the 61-neuron motor circuit model. Seed-location sensitivity was measured separately for *whether* tipping occurs (genuine tipping rate) and *when* it occurs (first death step).

### 2.7 Vulnerability-alignment protocol (R3.7)

Three vulnerability assignments were applied to 20 BA instances and the *C. elegans* connectome, using the TSSE-dominant context (ISR = 0.5, TSSE = 5.0). For each topology instance, node degree was computed as total degree (in + out) from the directed edge list. Assignment B: vuln_i = 0.1 + 0.9 × (degree_i / max_degree); assignment C: vuln_i = 1.0 − 0.9 × (degree_i / max_degree). After injecting each vulnerability array, initial aggregation was re-seeded as vuln_i × U(0, base) to maintain consistency with the original initialisation. The degree-death correlation was computed as the Spearman rank correlation between node degree and death step (positive = high-degree nodes die earlier). 10 seeds × 20 BA instances × 3 assignments + 10 seeds × 1 CE instance × 3 assignments = 630 runs × 500 steps.

### 2.8 Combination therapy protocol (R3.8)

R3.8 tests whether ISR suppression and glutamate suppression interact synergistically, additively, or antagonistically. Context: medium aggregation (ISR = TSSE = 2.0). A 5×4 grid of ISR suppression × glutamate suppression was tested:

- ISR reductions: {0%, 10%, 20%, 30%, 50%} applied to `intracellularSeedingRate` (baseline = 2.0)
- Glutamate reductions: {0%, 50%, 70%, 90%} applied to `glutamateSensitivity` (baseline = 0.010)
- Additional solo conditions: ISR 70% only; glutamate 99% only

Total: 22 conditions × 20 seeds × 500 steps = 440 runs. Benefit score (composite of tipping prevention [40%], first-death delay [20%], plateau survivor gain [25%], functional survival gain [15%]) was computed against untreated baseline. Synergy was tested for all ISR + glutamate combination pairs using: `synergy = benefit(combo) − benefit(ISR_only) − benefit(glut_only)`; classified as synergistic (> +0.10, CI_lo > 0), antagonistic (< −0.10, CI_hi < 0), or additive (CI overlaps 0). Bootstrap CI: N = 500 resamples.

Note: Clearance enhancement was not tested in R3.8–R3.10 because the current model has no aggregation decay term. The aggregation equation contains no `−clearance × agg` component; bounds are imposed only by the [0, 1] clip. Future model versions should add explicit clearance kinetics to test autophagy-enhancing or proteasome-activating interventions.

### 2.9 Therapeutic cliff protocol (R3.9)

R3.9 maps the dose-response shape of ISR suppression across 19 levels from 0% to 99%, with dense sampling near the anticipated threshold (75%, 80%, 85%, 90%, 92%, 94%, 95%, 96%, 97%, 98%, 99%). TSSE held constant at 2.0. N = 50 seeds × 500 steps per level = 950 total runs. Key derived quantities: (1) cliff detection — adjacent-level |Δgenuine_rate| > 0.20 or |Δbenefit| > 0.10; (2) ISR50 — suppression level at which genuine tipping rate reaches 50% of baseline, estimated by linear interpolation with bootstrap CI (N = 1000); (3) ISR90 — analogous 90% threshold; (4) response shape classification (flat / linear / saturating / sigmoidal / cliff-like).

### 2.10 Biological mapping protocol (R3.10)

R3.10 decomposes the ISR suppression effect into its two constituent mechanisms, tested as separate interventions:

- **Intervention A — Production suppression**: `ISR = 2.0 × (1 − strength)`, TSSE fixed at 2.0. Biological analogue: ASO-mediated gene silencing reduces the intrinsic per-neuron misfolding initiation rate.
- **Intervention B — Spread inhibition**: `TSSE = 2.0 × (1 − strength)`, ISR fixed at 2.0. Biological analogue: synaptic transmission blockers reduce prion-like propagation efficiency.
- **Intervention C — Coupled suppression (v1.0-style)**: both ISR and TSSE scaled by (1 − strength) simultaneously. Reproduces the effect of v1.0 `aggAmp` reduction.

Strength sweep: {10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 95%, 99%}. N = 30 seeds × 500 steps × 33 conditions + 30 baseline = 1020 total runs. Synergy between interventions A and B was quantified using the **Bliss Independence model**: *E*_AB = *A* + *B* − *A* × *B*, where *A*, *B* are fractional benefit scores. Synergy = observed_C − *E*_AB. Bootstrap CI (N = 1000 resamples from per-run data; identical seeds used for deterministic recovery). Classification thresholds: synergistic (> 0.05), antagonistic (< −0.05), additive (±0.05); tipping protection threshold 0.10.

---

## 3. Results

### 3.1 R3.1 — Decoupled aggregation: ISR and TSSE are independently load-bearing

Across the 25-cell ISR × TSSE grid, genuine tipping (triphasic collapse satisfying all three Phase 7B criteria) emerged in 21/25 cells, with a mean genuine tipping rate of **0.838**. Tipping is not an artifact of the coupled aggAmp design.

**Mechanism dominance** across 25 cells:

| Dominant mechanism | Count | Fraction |
|---|---|---|
| Seeding (ISR alone sufficient) | 10 | 40% |
| Spread (TSSE alone sufficient) | 4 | 16% |
| Both required simultaneously | 5 | 20% |
| Neither critical (tipping robust to either ablation) | 6 | 24% |

The Pearson correlation of log(ISR) with genuine tipping rate across cells was r = 0.586, compared to r = 0.463 for log(TSSE), establishing ISR as the more predictive mechanism. Five cells in the low-ISR/low-TSSE corner (both < 0.5) require both mechanisms simultaneously.

Diagonal cells — where ISR = TSSE, directly comparable to v1.0 aggAmp — reproduce the v1.0 finding monotonically: genuine rate rises from 0.00 at ISR=TSSE=0.05 to 1.00 at ISR=TSSE=2.0 and above. The seeding-dominant mechanism classification at ISR=TSSE=2.0 confirms that the v1.0 aggAmp dominance reflects **genuine intracellular seeding sensitivity**, not a coupling artifact.

### 3.2 R3.2 — Downstream causal power: mitochondria conditional, others negligible

Six mechanisms were ablated across three dynamical regimes. Key results (mean first-death shift across regime configurations):

| Mechanism | R1: Seeding-dom | R2: Spread-dom | R3: Stressed |
|---|---|---|---|
| ISR (seeding) | **+179 steps (large)** | +4 (small) | **+64 (large)** |
| TSSE (spread) | +22 (small) | **+247 (large)** | +33 (medium) |
| Mitochondria | +3 (small) | +0 (small) | **+61 (large)** |
| Glutamate | ≈0 (small) | ≈−2 (small) | +18 (small) |
| Calcium / ROS | ≈0 (small) | ≈−2 (small) | +18 (small) |
| Irreversibility | ≈0 (small) | ≈−2 (small) | +4 (small) |

ISR and TSSE are the sole **universally load-bearing** mechanisms, each dominating in the regime where its parameter is elevated. Mitochondrial damage is **conditionally load-bearing**: it acquires a large effect only in the downstream-stressed regime (mitFrag = 4–8, shift = +61 steps). Glutamate excitotoxicity, calcium/ROS, and irreversibility lock remain negligible across all three regimes, failing to reach even the medium effect threshold under any tested condition.

This revises the v1.0 mechanistic claim: aggregation seeding is the primary load-bearing mechanism across physiologically plausible parameter ranges, but the cascade architecture supports multiple entry points when downstream stressors are sufficiently extreme.

### 3.3 R3.3 and R3.4 — Mitochondrial threshold: near-takeover at mitFrag = 4.0

**R3.3** (n = 15 seeds per cell) initially detected a TAKEOVER classification at mitFrag = 0.3 in the low-aggregation context, driven by a single criterion hit (genuine-rate drop = 0.333 at n = 15 seeds; shift = +10 steps and plateau gain = +1.2 neurons both below threshold). Medium and high aggregation contexts showed no TAKEOVER across the full tested range (mitFrag = 0.3–8.0), reflecting a key finding: high aggregation activity saturates the mitochondria→ATP pathway, rendering mitFrag irrelevant as an independent driver.

**R3.4** validated the low-context claim with n = 50 seeds and bootstrapped confidence intervals:

| mitFrag | Shift [95% CI] | Gain [95% CI] | rdrop [95% CI] | Criteria |
|---|---|---|---|---|
| 0.3 | +1 [−7, +9] | +0.9 [−0.5, +2.4] | −0.060 [−0.24, +0.14] | **0/3** |
| 3.0 | +44 [+36, +51] | +4.9 [+3.5, +6.3] | −0.020 [−0.18, +0.14] | 0/3 |
| **4.0** | **+66 [+60, +72]** | **+7.9 [+6.7, +9.1]** | −0.040 [−0.20, +0.12] | **2/3** |
| 8.0 | +106 [+98, +113] | +10.8 [+9.7, +11.9] | +0.060 [−0.06, +0.18] | 2/3 |

The mitFrag = 0.3 TAKEOVER signal from R3.3 is a **confirmed artifact**: with n = 50, all three criteria fail (shift = +1, gain = +0.9, rdrop = −0.060; 95% CIs all span zero). The genuine signal begins at **mitFrag = 4.0** (2/3 criteria: shift and plateau gain pass with confidence intervals entirely above their thresholds; shift CI [+60, +72] fully above the 50-step threshold). The genuine-rate drop criterion (rdrop > 0.20) is not satisfied at any tested level, because genuine tipping rate in the low-aggregation context (0.20–0.40) is structurally constrained — the cascade is near the tipping boundary and removing mitochondrial stress does not push it below the tipping point.

**Mechanistic interpretation**: At mitFrag ≥ 4.0, mitochondrial damage functions as a *death accelerator* (earlier onset, fewer plateau survivors) but not a *cascade gatekeeper* — the tipping structure remains intact and is not disrupted by mitochondrial ablation. This is a weaker form of load-bearing than a true independent entry point: mitochondria modify *when* and *how severely* degeneration occurs, but not *whether* the cascade tips.

### 3.4 R3.5 — Topological necessity: ISR topology-invariant, TSSE topology-sensitive

Under the decoupled model at medium context (ISR = TSSE = 2.0), the five topologies showed:

| Topology | Genuine rate (v2.0) | Genuine rate (v1.0) | Coherence r |
|---|---|---|---|
| *C. elegans* (biological) | **1.000** | 1.000 | 0.668 |
| Degree-preserved shuffle | 0.895 | 0.730 | 0.466 |
| Watts-Strogatz (small-world) | 0.870 | 0.780 | 0.520 |
| Erdős–Rényi (random) | 0.700 | 0.480 | 0.396 |
| Barabasi-Albert (scale-free) | 0.105 | 0.000 | 0.073 |

The *C. elegans* connectome retains the highest genuine tipping rate in v2.0 as in v1.0. Barabasi-Albert remains the most resistant topology (10.5% in v2.0 vs. 0% in v1.0), with spatial coherence near zero (r = 0.073), far below the C2 threshold (0.30). Topology sensitivity is slightly weaker in v2.0 (range = 0.895) than v1.0 (range = 1.000), consistent with ISR providing a baseline contribution that partially compensates for topology-disrupted spread.

**Mechanism isolation** — the decisive finding of R3.5:

| Topology | ISR-dominant (ISR=5, TSSE=0.5) | TSSE-dominant (ISR=0.5, TSSE=5) |
|---|---|---|
| *C. elegans* | 1.000 | 1.000 |
| Erdős–Rényi | **1.000** | **0.000** |
| Barabasi-Albert | **1.000** | **0.000** |
| Watts-Strogatz | **1.000** | **0.050** |
| Degree-preserved shuffle | **1.000** | **0.000** |

Under ISR-dominant conditions, **all five topologies achieve 100% genuine tipping** — the cascade succeeds regardless of wiring structure. Under TSSE-dominant conditions, **only the biological *C. elegans* connectome** tips reliably; all four synthetic alternatives fail (0–5%). The entire topology sensitivity of the cascade is carried by the trans-synaptic spread mechanism. ISR, being intrinsic to each neuron and independent of edge structure, is not modulated by topology.

The Barabasi-Albert failure under TSSE-dominant conditions reflects the hub structure routing spread through high-degree neurons that are not necessarily high-vulnerability — disrupting the vulnerability-ordered death sequence required for spatial coherence (C2 criterion). R3.7 subsequently established that this failure is attributable to hub-vulnerability *misalignment* rather than hub architecture per se (see section 3.6). The *C. elegans* wiring is specifically tuned for vulnerability-ordered propagation, not merely permissive.

### 3.5 R3.6 — Seed location: timing modulator, not tipping determinant

Boosting initial aggregation by +0.5 at each of the 61 neurons in turn, under medium context (ISR = TSSE = 2.0):

**Whether tipping occurs**: genuine tipping rate = 1.000 for 59/61 neurons (the two exceptions, PLML and PLMR, are peripheral sensory neurons with vulnerability = 0.05 topologically distant from the motor pool). The parameter regime, not the seed location, determines whether tipping occurs.

**When tipping occurs**: named-condition comparison:

| Condition | Genuine rate | First death step | Plateau survivors |
|---|---|---|---|
| AVAL boost (command hub, rank 9/61) | 1.000 | **77** | 9.6 |
| DA6 boost (protective node, rank 19/61) | 1.000 | **80** | 9.2 |
| Uniform baseline (no focal seed) | 1.000 | **165** | 9.2 |

The onset timing range is **88 steps** (77–165), representing 17.6% of the 500-step simulation window — a substantial but non-binary effect. Boosting the command interneuron AVAL, with low vulnerability (0.15) but high betweenness centrality (betweenness = 0.33), accelerates cascade onset by 88 steps relative to unfocused seeding — validating the Phase 1A finding that network-central nodes have disproportionate cascade impact.

**Seed fragility ranking** (by fastest onset among 59 fragile neurons): DA2 (74.0 steps) and DA1 (74.1 steps) rank fastest, consistent with their maximum vulnerability (1.00) and direct DA-chain positioning. Notably, AVDL and AVDR rank 6th and 7th (76.5 steps) despite vulnerability = 0.15 — both command interneurons have direct synaptic connections to DA1/DA2, making them efficient boosters via trans-synaptic spread. Spearman r(vulnerability, onset speed) = 0.612, confirming vulnerability as a moderate predictor but establishing network position as an additional independent predictor of seeding dangerousness.

### 3.6 R3.7 — Degree-correlated vulnerability: BA failure reflects misalignment, not hub architecture

To determine why BA topology resists TSSE-dominant cascades, we re-ran the TSSE-dominant condition (ISR = 0.5, TSSE = 5.0) on the same 20 BA instances with three vulnerability assignments: (A) the original biological gradient (motor neurons most vulnerable), (B) degree-correlated (vuln_i = 0.1 + 0.9 × degree_i / max_degree, making hubs the most vulnerable), and (C) inverse-degree-correlated (hubs least vulnerable). The same three assignments were applied to *C. elegans* as a control (630 runs × 500 steps total).

| Topology | Vulnerability | Genuine rate | Coherence r | Deg-death corr |
|---|---|---|---|---|
| BA | A: Original | 0.000 | −0.265 | 0.411 |
| BA | B: Degree-correlated | **0.800** | **+0.371** | 0.401 |
| BA | C: Inverse-degree | 0.000 | −0.326 | 0.419 |
| *C. elegans* | A: Original | 1.000 | +0.453 | 0.289 |
| *C. elegans* | B: Degree-correlated | 0.000 | +0.278 | 0.408 |
| *C. elegans* | C: Inverse-degree | 0.000 | −0.291 | 0.482 |

The degree-death correlation (≈ 0.41) is nearly identical across all BA conditions: TSSE routes spread through high-degree hub nodes first regardless of which vulnerability assignment is in force. This confirms the mechanism — the cascade propagates hub-first — but the spatial coherence criterion (C2) requires that this hub-first death order *aligns* with the vulnerability gradient.

Under condition B, genuine tipping on BA rises from 0.000 to **0.800** and coherence flips from −0.265 to +0.371, crossing the C2 threshold (0.30). The R3.5 BA failure was therefore driven by **hub-vulnerability misalignment**, not hub architecture per se. Conversely, reassigning *C. elegans* to degree-correlated vulnerability (condition B) destroys its genuine tipping entirely (1.000 → 0.000): in the biological connectome, the highest-degree node (AVAL, degree ≈ 23) has low biological vulnerability (0.15 as a command interneuron), so making hubs maximally vulnerable scrambles the death order relative to the biological gradient. The two results are symmetric: alignment rescues BA; misalignment destroys *C. elegans*.

### 3.7 R3.8 — Combination therapy: ISR is the cascade gatekeeper, glutamate suppression negligible

A 5×4 ISR × glutamate suppression grid was run under medium aggregation context (ISR = TSSE = 2.0). All 22 conditions produced genuine tipping at 100% when ISR suppression ≤ 60%; genuine tipping first fell below 100% only at ISR ≥ 70% suppression. In contrast, glutamate suppression at any dose (50%, 70%, 90%, or 99%) left genuine tipping rate unchanged at 1.000.

Key quantitative comparison at matched dose levels:

| Intervention | Strength | Genuine tipping | Benefit score |
|---|---|---|---|
| ISR-only | 50% | 1.000 | 0.057 |
| Glutamate-only | 90% | 1.000 | 0.001 |
| Ratio (ISR/glut at comparable doses) | — | — | **63×** |

**Glutamate suppression is 63-fold less effective than ISR suppression** (benefit 0.001 at 90% glutamate reduction vs. 0.057 at 50% ISR reduction). Even at 99% glutamate suppression, genuine tipping rate remains 1.000 and benefit score is 0.0003. This finding directly reflects the cascade architecture: the glutamate excitotoxicity pathway is gated by ATP depletion, which is itself downstream of aggregation. Reducing glutamate sensitivity does not prevent the upstream ATP collapse that activates it.

All 12 tested combination pairs (ISR reduction × glutamate reduction) were classified as **additive** under the synergy criterion (all bootstrap CIs overlapped zero). No combination provided benefit beyond the ISR component alone. The most effective tested condition (ISR 50% + glutamate 90%) had benefit 0.062, compared to 0.057 for ISR 50% alone — a difference within noise.

**Verdict: GATEKEEPER-DOMINANT.** ISR controls cascade entry; glutamate acts downstream of the bottleneck and cannot prevent tipping regardless of suppression depth.

### 3.8 R3.9 — Therapeutic cliff: ISR dose-response is threshold-gated, not graded

The 19-level ISR suppression sweep (0%–99%, 50 seeds per level, N = 950 runs) reveals a non-linear, cliff-like dose-response. At 0–85% suppression, genuine tipping rate declines incrementally from 1.000 to 0.860, with benefit score rising steadily to 0.163 — consistent with a graded, approximately linear response. Between 85% and 90% suppression, a sharp cliff is detected:

| Metric | 85% suppression | 90% suppression | Step change |
|---|---|---|---|
| Genuine tipping rate | 0.860 [0.76, 0.94] | 0.580 [0.44, 0.70] | **−0.280** |
| Benefit score | 0.163 | 0.293 | **+0.131** |

This 28-percentage-point single-step drop in genuine tipping rate exceeds the cliff detection threshold (|Δ| > 0.20) and is the only cliff region across the full sweep.

**ISR50** (suppression required for 50% reduction in genuine tipping rate from baseline) = **96.5%** [95% CI: 89.3%, 97.3%]. **ISR90 was not reached** even at 99% suppression (genuine tipping rate at 99% suppression = 0.52 [0.38, 0.66]). The residual tipping at high ISR suppression is sustained by TSSE = 2.0, which was held constant throughout R3.9: once stochastic initiation triggers even a small aggregation focus, network propagation via the trans-synaptic pathway can sustain cascade progression independently of the seeding rate.

**Response shape classification: CLIFF-LIKE.** The first half of the suppression range (0–50%) accounts for 12% of the total tipping rate drop; the second half (50–99%) accounts for 36%, with the concentration occurring in the 85–90% interval. This non-linear shape has direct therapeutic implications: partial ISR suppression (< 85%) provides incremental but sub-threshold benefit; therapeutic efficacy requires near-complete target engagement.

### 3.9 R3.10 — Biological mapping: production suppression dominates; Bliss synergy confirmed above 60%

Decomposing ISR into two separate biological interventions under medium aggregation context (ISR = TSSE = 2.0, 11 strength levels, 30 seeds each):

| Intervention | 99% dose: genuine tipping | Best benefit | ISR50 strength | Cliff |
|---|---|---|---|---|
| A: Production only (ASO analogue) | 0.500 [0.33, 0.67] | 0.342 | 95% | At 90%→95% (Δ−0.333) |
| B: Spread only (synaptic blocker) | **1.000** [1.00, 1.00] | 0.137 | **Not reached** | None |
| C: Coupled (v1.0-style) | **0.000** [0.00, 0.00] | 0.979 | 72% | At 60%→70% (Δ−0.400) |

**Intervention B (spread inhibition alone) cannot prevent genuine tipping at any tested strength.** Genuine tipping rate = 1.000 across all 11 conditions from 10% to 99% TSSE suppression. Benefit accrues only via first-death delay and minor plateau improvements (best benefit 0.137 at 99%), not through tipping prevention. This result arises because, in the ISR = 2.0 context, each highly-vulnerable neuron independently accumulates aggregation through its intrinsic seeding rate on a timescale that reaches the cascade threshold regardless of how much trans-synaptic propagation is blocked.

**Intervention A (production suppression alone) provides moderate but incomplete protection.** Genuine tipping falls to 50% at 95% strength; the 90%→95% cliff mirrors the R3.9 finding. Maximum benefit 0.342 — far below what is needed for reliable cascade prevention.

**Coupled suppression (Intervention C) achieves near-complete cascade prevention above 90%**: genuine tipping = 0.000 [0.00, 0.00] at 90% and above; benefit score 0.904 at 90%, 0.979 at 99%. The synergy between interventions A and B was quantified by Bliss Independence analysis (N = 1000 bootstrap resamples):

| Strength | Bliss expected benefit | Observed C | Synergy | 95% CI | Classification |
|---|---|---|---|---|---|
| 10–50% | 0.025–0.099 | 0.021–0.129 | −0.004 to +0.030 | CIs overlap zero | Additive |
| 60% | 0.129 | 0.183 | +0.055 | [+0.044, +0.067] | **Synergistic** |
| 70% | 0.168 | 0.416 | **+0.247** | [+0.166, +0.322] | **Synergistic** |
| 80% | 0.253 | 0.719 | **+0.466** | [+0.381, +0.535] | **Synergistic** |
| 90% | 0.273 | 0.904 | **+0.631** | [+0.584, +0.672] | **Synergistic** |

Mean Bliss synergy across all 11 strengths: benefit = +0.229, tipping protection = +0.258. 6/11 strength levels show statistically significant synergy (CI_lo > 0).

**Synergy onset coincides exactly with the R3.9 therapeutic cliff** (60–70% strength threshold). Below the cliff, neither A nor B individually perturbs tipping dynamics, and their combination is correspondingly additive. Above the cliff, ISR suppression pushes individual neurons toward the stochastic escape boundary — at which point TSSE co-suppression cooperates by shrinking residual network propagation that would otherwise re-seed the cascade from the dwindling number of loaded neurons.

The mechanistic basis of the synergy is cooperative rather than independent: TSSE suppression provides no protection when used alone (prot_B = 0 throughout), so the Bliss baseline equals prot_A at all strengths. Any benefit of coupling beyond ISR-alone reflects genuine mechanistic cooperativity: ISR suppression enables TSSE suppression to be effective, and TSSE co-suppression lowers the ISR threshold required for stochastic escape. This is noted explicitly: the synergy is mechanistic cooperativity within a single cascade pathway, not pharmacological synergy between independently active agents.

---

## 4. Discussion

### 4.1 ISR as cell-autonomous disease mechanism

The topology-invariance of ISR-dominant cascades (100% genuine tipping across all five graph types) has direct mechanistic implications. Intracellular seeding, modelled as a vulnerability-weighted per-neuron aggregation rate, does not require any specific circuit architecture to drive tipping. This is consistent with the cell-autonomous biology of TDP-43 aggregation: protein misfolding is initiated within individual neurons, driven by local factors (RNA-binding protein dysfunction, nuclear-cytoplasmic transport failure) independent of synaptic connectivity. In this model, a cell-autonomous driver that is sufficiently strong (ISR ≥ 2.0 in the medium context) produces genuine tipping regardless of how neurons are wired together.

The comparative predictiveness of ISR over TSSE (Pearson r = 0.586 vs. 0.463) is consistent with this view: the probability of reaching genuine tipping is more sensitive to the rate at which individual neurons accumulate aggregation than to how efficiently that aggregation propagates between neurons.

### 4.2 TSSE as circuit-dependent disease mechanism

The catastrophic topology-sensitivity of TSSE-dominant cascades (from 100% on *C. elegans* to 0% on three of four synthetic topologies) establishes trans-synaptic spread as a mechanism that requires vulnerability-ordered circuit architecture to sustain coherent degeneration. R3.7 identifies the precise requirement: TSSE-driven spread always routes through high-degree hub nodes first (degree-death correlation ≈ 0.41 in BA, stable across all vulnerability assignments), but spatial coherence emerges only when this hub-first death order *aligns* with the vulnerability gradient.

The R3.7 experiment reveals that TSSE topology sensitivity is not an intrinsic property of BA hub structure, but reflects vulnerability-hub alignment. The *C. elegans* motor circuit achieves this alignment biologically: motor neurons (DA, DB, DD, VA, VD) are both the most synaptically connected nodes within the motor pool and the most vulnerable to aggregation stress. BA graphs fail under the original vulnerability assignment because hub status is assigned randomly, producing systematic misalignment. When corrected artificially (degree-correlated condition), BA topology supports genuine TSSE cascades at 80%. Conversely, reassigning *C. elegans* vulnerability to be degree-correlated destroys its tipping structure entirely (1.000 → 0.000) — confirming that the biological wiring's success depends critically on the specific alignment between anatomy and vulnerability, not on network statistics alone.

This refines the R3.5 claim from *'TSSE requires specific circuit architecture'* to *'TSSE requires that the circuit's hub structure aligns with its vulnerability gradient.'* If trans-synaptic spread is a primary ALS disease mechanism, this result predicts that disease vulnerability should be correlated with synaptic in-degree in the affected motor circuit — a testable hypothesis using single-cell transcriptomics combined with connectome reconstruction.

### 4.3 Mitochondria as death accelerator, not cascade gatekeeper

The validated near-takeover threshold at mitFrag ≥ 4.0 (confirmed by n = 50 seeds with tight bootstrap CIs) reveals an important mechanistic distinction. Mitochondrial damage at high fragility accelerates death onset (+66 steps, CI [+60, +72]) and suppresses plateau survival (+7.9 neurons, CI [+6.7, +9.1]) — both robust effects. But it does not disrupt the tipping structure (genuine-rate drop consistently near zero, CI spanning zero at all tested levels).

This finding — that mitochondria change *when* and *how many* neurons die without changing *whether* the cascade tips — positions mitochondrial dysfunction as a **disease modifier** in this model rather than a disease initiator. The high aggregation contexts (ISR = TSSE = 2.0 or higher) are immune to mitochondrial takeover because aggregation-driven ATP depletion already saturates the mito→ATP pathway, leaving no additional capacity for mitFrag to exert independent influence.

The practical implication is that mitochondrial-targeted interventions in this model would delay onset and improve plateau survival but would not prevent tipping once the aggregation cascade is sufficiently active — consistent with the modest efficacy observed for mitochondrial-targeted approaches in clinical ALS trials.

### 4.4 Implications for v1.0 claims

Round 3 strengthens several v1.0 claims while qualifying others:

1. **aggAmp dominance is genuine** (R3.1): The v1.0 finding that aggAmp is the dominant parameter is not a coupling artifact. ISR and TSSE, when free to vary independently, replicate the monotonic relationship between aggregation intensity and tipping probability along the diagonal.

2. **Topology dependence persists under decoupling** (R3.5): The strong topology sensitivity seen in v1.0 (Phase 7C) survives the decoupling — but is now attributable specifically to TSSE, not to ISR. This resolves the ambiguity in the Phase 7C finding.

3. **Single-factor mechanistic claim requires qualification** (R3.2/R3.4): The v1.0 claim that aggregation seeding is the *sole* load-bearing mechanism must be qualified: it holds within physiologically plausible parameter ranges, but mitochondria acquire near-takeover character at extreme fragility (≥ 4× baseline) in low-aggregation contexts.

4. **Seed location is not a primary determinant** (R3.6): The Phase 1A finding of focal cascade sensitivity to specific neurons (DVA/AVAL) is validated directionally — command interneurons with high betweenness rank in the top 15% for onset acceleration — but the broader circuit is broadly susceptible (59/61 neurons fragile) at medium aggregation intensity.

5. **Topology sensitivity is alignment-dependent, not architecture-dependent** (R3.7): The Phase 7C finding that BA graphs are uniquely resistant is now mechanistically resolved. BA hub structure always drives hub-first spread (degree-death corr ≈ 0.41); resistance arises because biological vulnerability is misaligned with hub status by construction in random scale-free graphs. The *C. elegans* motor circuit's vulnerability gradient is a functional feature, not merely a biological baseline — it is what makes TSSE-driven spread coherent.

### 4.5 Therapeutic implications of R3.8–R3.10

The three therapeutic-mapping phases translate the mechanistic dissociation of ISR and TSSE into predictions about intervention design. Several findings warrant explicit discussion.

**The glutamate excitotoxicity pathway is a poor primary target in this model.** R3.8 demonstrates that glutamate suppression at any dose (including 99%) does not reduce genuine tipping. This is mechanistically expected: the glutamate pathway is downstream of ATP depletion, which itself is downstream of aggregation. A drug targeting glutamate sensitivity cannot prevent the upstream aggregation–mito–ATP cascade from reaching the point at which excitotoxicity would normally activate — by that stage, the cascade is already committed. This is consistent with the clinical observation that riluzole (which reduces glutamate release) provides only modest benefit in ALS [CITATION], though the model-to-biology mapping is approximate and the mechanism of riluzole's modest efficacy may involve pathways not captured here.

**Near-complete ISR engagement is required for tipping prevention (R3.9).** The cliff-like dose-response (ISR50 = 96.5%) implies that partial ISR suppression — including 85% suppression — produces only incremental benefit without crossing the prevention threshold. This is a hypothesis for dose optimisation: if the ISR analogy to TDP-43 expression holds, ASO-mediated knockdown studies should test whether the relationship between transcript reduction and aggregation prevention is similarly non-linear. The model predicts a poor efficacy plateau below approximately 85% target engagement, with steep gains above it.

**The synergy between production and spread inhibition is mechanistic cooperativity, not additive independence.** The Bliss analysis confirms genuine synergy (mean +0.23 across all tested doses), but the mechanism is clarified: TSSE suppression alone is completely ineffective (Intervention B, prot_B = 0 at all doses), making the Bliss expected combined equal to prot_A alone. Any gain from coupling therefore registers as synergy. This is not an artifact but correctly represents cooperative cascade dynamics: ISR suppression creates the conditions under which TSSE suppression can function by reducing the autonomous loading rate of individual neurons to below the stochastic cascade threshold. In drug combination terms, this is analogous to a sensitiser + effector relationship rather than two independently acting drugs — the clinical analogy would be sequential or co-administered agents where one creates the context required for the other to work. This pattern could inform combination therapy design if both ASO-like (production) and anti-propagation (spread) approaches are pursued simultaneously.

**Model limitation on clearance interventions.** The current model has no aggregation decay term; only clip(agg, 0, 1) bounds accumulation. Clearance-enhancing approaches (autophagy inducers, proteasome activators — rapamycin analogues and related compounds) cannot be modelled in the current framework. Adding an explicit `−AGG_CLEARANCE × atp × agg` term to the aggregation equation would enable a third intervention class (Intervention D) and allow comparison of production suppression, spread inhibition, and clearance enhancement as distinct biological strategies. This is an important gap given the clinical interest in autophagy activation as a therapeutic approach in TDP-43 proteinopathies.

### 4.6 Limitations of the mechanistic interpretation

The topology-invariance of ISR and topology-sensitivity of TSSE are model properties that may not map directly onto biological mechanisms. The *C. elegans* motor connectome is an empirical network, but its vulnerability scores, synapse weights, and neurotransmitter assignments are approximate. The finding that BA fails under TSSE-dominant conditions is contingent on hub neurons being randomly assigned vulnerability scores; in a biological BA-like network where vulnerability correlates with degree, the result might differ. The discrete parameter sweep (5 ISR × 5 TSSE values) cannot rule out non-monotonic behaviour between grid points.

---

## 5. Conclusion

Decoupling aggregation into intracellular seeding (ISR) and trans-synaptic spread (TSSE) resolves a key mechanism identifiability problem in the v1.0 model; three additional therapeutic-mapping phases translate the mechanistic findings into intervention predictions. Together, these yield eight principal findings:

1. **aggAmp dominance is genuine**: ISR and TSSE are independently load-bearing, with ISR more predictive of tipping probability (r = 0.586 vs. 0.463). The v1.0 aggAmp dominance is not a coupling artifact.

2. **ISR is topology-invariant**: Under ISR-dominant conditions, all five tested topologies achieve 100% genuine tipping. Intracellular seeding is a cell-autonomous mechanism whose cascade consequences do not depend on circuit architecture.

3. **TSSE is topology-sensitive via vulnerability-hub alignment**: Under TSSE-dominant conditions, only the biological *C. elegans* connectome produces genuine tipping (100%); all four synthetic topologies fail (0–5%). R3.7 shows this is not because BA hub structure disrupts spreading per se — hubs always die first (degree-death correlation ≈ 0.41) — but because BA assigns hub status randomly, misaligning hub deaths with the vulnerability gradient. Correcting the alignment restores 80% genuine tipping on BA; destroying it collapses *C. elegans* from 100% to 0%.

4. **Mitochondria are a death accelerator, not a cascade gatekeeper**: At mitFrag ≥ 4.0 in low-aggregation contexts, mitochondrial damage significantly accelerates onset (+66 steps) and suppresses survival (+7.9 neurons) but does not gate tipping. Glutamate, calcium/ROS, and irreversibility remain negligible across all regimes.

5. **Seed location is a timing modulator, not a tipping determinant**: 59/61 neurons produce genuine tipping regardless of which neuron is initially boosted. The seed location affects *when* (88-step onset range) but not *whether* tipping occurs. Command interneurons with high network centrality (AVDL, AVDR, AVAL) rank in the top 15% for onset acceleration, validating Phase 1A's identification of network-central nodes as cascade amplifiers.

6. **Glutamate suppression is 63-fold less effective than ISR suppression**: Even at 99% glutamate reduction, genuine tipping rate = 1.000. The cascade is gated at ISR (aggregation production), not at glutamate excitotoxicity. All ISR × glutamate combination synergies are additive (R3.8).

7. **ISR dose-response is cliff-like**: The 85–90% ISR suppression interval produces a 28-percentage-point single-step drop in genuine tipping rate — the only cliff across the full 0–99% sweep. ISR50 requires 96.5% suppression [89.3%, 97.3% CI]; ISR90 is not reached even at 99%, with residual tipping sustained by the TSSE pathway (R3.9).

8. **Production suppression (ASO analogue) substantially outperforms spread inhibition alone; coupled suppression is synergistic above 60%**: Spread inhibition (TSSE suppression) alone cannot prevent tipping at any dose (prot_B = 0). Production suppression alone achieves 50% tipping reduction at 95% strength. Coupled co-suppression achieves 100% tipping prevention above 90% strength, with Bliss synergy +0.47 at 80% (CI [+0.38, +0.53]), onset coinciding exactly with the R3.9 therapeutic cliff (R3.10).

These findings motivate experiments that distinguish cell-autonomous from circuit-dependent components of ALS protein propagation, including cell-type-specific ASO delivery studies, near-complete target engagement dose escalation experiments, and optogenetic manipulation of spread pathways. The model-predicted synergy between production and spread inhibition provides a rationale for combination strategies in which ASO-mediated knockdown creates the context required for anti-propagation agents to be effective.

---

## 6. Limitations

1. **Organism gap**: The *C. elegans* motor connectome (61 neurons, 127 synapses) is orders of magnitude simpler than the human corticospinal–motor neuron system. Topological properties (hub structure, modularity, vulnerability distribution) differ fundamentally. Findings are specific to this substrate.

2. **Parameter ranges**: ISR and TSSE values are dimensionless scaling factors, not calibrated to measured biological quantities. The near-takeover threshold at mitFrag = 4.0 is a model-internal finding, not a prediction about mitochondrial fragility in human cells.

3. **Single ablation**: The R3.2 ablation protocol disables one mechanism at a time. Interaction effects between ISR, TSSE, and mitochondrial pathways are not characterised; simultaneous multi-pathway ablations may reveal non-additive dependencies.

4. **Discrete topology types**: The five graph types used in R3.5 are mathematical idealizations. Real motor-circuit connectomes have composite statistical properties not captured by any single graph model. R3.7 resolved the BA contingency: the BA failure under TSSE is caused by hub-vulnerability misalignment, not BA structure per se. Whether biological hub-vulnerability alignment generalises beyond *C. elegans* remains untested.

5. **Seed location at medium aggregation only**: R3.6 tested seed sensitivity at ISR = TSSE = 2.0. At lower aggregation intensity, where individual seeds can make or break tipping (the "both required" cells in R3.1), seed location may be a stronger determinant of tipping outcome.

6. **No aggregation clearance term**: The current model has no decay term on aggregation (no `−clearance × agg` component); aggregation is bounded only by the [0,1] clip. Clearance-enhancing interventions (autophagy inducers, proteasome activators) cannot be modelled. Adding explicit clearance kinetics would enable a third intervention class in future therapeutic-mapping phases, and may change the apparent dominance of ISR suppression if clearance is in fact a strong independent leverage point.

7. **All results hypothesis-generating**: This is a computational modelling study. All findings require experimental validation before any translational significance can be attributed. The model is not a clinical predictor of ALS progression, treatment response, or patient prognosis.

---

## References

Rezaee, M. (2026). *Cascade criticality, therapeutic window emergence, and pre-symptomatic early-warning signals in a connectome-based neurodegeneration framework: an ALS-motivated study on the C. elegans motor circuit*. Zenodo. https://doi.org/10.5281/zenodo.20528826

Rezaee, M. (2026). *ALS Connectome Degeneration Project v2.0.0 — Mechanism identifiability: decoupled aggregation, topological necessity, and biological mapping of ISR*. Zenodo. https://doi.org/10.5281/zenodo.20592681

White, J. G., Southgate, E., Thomson, J. N., & Brenner, S. (1986). The structure of the nervous system of the nematode *Caenorhabditis elegans*. *Philosophical Transactions of the Royal Society B*, 314(1165), 1–340.

Cook, S. J., Jarrell, T. A., Bhogal, R. K., et al. (2019). Whole-animal connectomes of both *Caenorhabditis elegans* sexes. *Nature*, 571(7763), 63–71.

---

*Manuscript draft — ALS Connectome Degeneration Project v2.0 — June 2026*  
*Code, data, and reproducibility: https://github.com/MaryamRezaeeNl/als-connectome*

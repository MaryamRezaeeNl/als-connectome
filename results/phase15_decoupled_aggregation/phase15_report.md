# Phase 15 -- Decoupled Aggregation Mechanism

## Overview

This phase decouples `aggregationAmplification` (v1.0) into two independent parameters:

- **`intracellularSeedingRate` (ISR)**: intrinsic per-neuron protein misfolding rate
- **`transSynapticSpreadEfficiency` (TSSE)**: prion-like synaptic spreading rate

**Grid**: 5 ISR x 5 TSSE values = 25 cells
**Baseline runs**: 20 seeds per cell (500 total)
**Ablation runs**: 10 seeds per mechanism per cell
**Steps per run**: 500

---

## Q1: Does genuine tipping still emerge with decoupled parameters?

**Yes.** Mean genuine tipping rate across all 25 grid cells: **0.838**
(21/25 cells show genuine tipping in the majority of seeds).

Tipping is not an artifact of the coupled parameter design. When ISR and TSSE
are free to vary independently, the same triphasic collapse structure
(silent phase -> rapid cascade -> plateau) emerges wherever either
parameter is sufficiently large.

---

## Q2: Which mechanism is more load-bearing: seeding or spread?

**Correlation with genuine_rate** (log-scale parameter):
- log(ISR)  vs genuine_rate: r = 0.586
- log(TSSE) vs genuine_rate: r = 0.463
- **More predictive: ISR**

**Dominant mechanism classification** (25 cells):

| Mechanism | Count | % of cells |
|-----------|------:|----------:|
| Seeding dominant  | 10 | 40% |
| Spread dominant   | 4  | 16%  |
| Both required     | 5    | 20%    |
| Neither critical  | 6 | 24% |

---

## Q3: Is there a region where both mechanisms are required?

20% of grid cells (5/25) show **both** mechanisms as load-bearing
(disabling either one collapses genuine tipping rate below 50% of baseline).

---

## Q4: Comparison with v1.0 aggregationAmplification dominance

**Diagonal cells (ISR == TSSE, equivalent to v1.0 aggAmp)**:

| aggAmp (ISR=TSSE) | Genuine rate | Dominant mechanism |
|:-:|:-:|:-:|
| 0.05 | 0.00 | both |
| 0.50 | 0.40 | both |
| 2.00 | 1.00 | seeding |
| 5.00 | 1.00 | neither |
| 10.00 | 1.00 | neither |

Genuine rate increases monotonically with aggAmp along the diagonal,
confirming the v1.0 finding. The decoupled framework shows this is driven
by whichever mechanism is dominant at each intensity level.

---

## Q5: Is v1.0 dominance genuine or a coupling artifact?

GENUINE: Intracellular seeding is more often load-bearing than spread (10 seeding-dominant cells vs 4 spread-dominant). The v1.0 aggregationAmplification dominance reflects true seeding-rate sensitivity, not a coupling artifact.

---

## Genuine-rate heat map (5x5 grid)

(*) marks cells where both mechanisms are required.

| ISR \ TSSE |  0.05 |  0.50 |  2.00 |  5.00 | 10.00 |
|---|---|---|---|---|---|
|  0.05 | 0.00*| 0.00*| 0.50*| 1.00 | 1.00 |
|  0.50 | 0.05 | 0.40*| 1.00*| 1.00 | 1.00 |
|  2.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
|  5.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| 10.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |


---

## Dominant mechanism map (5x5 grid)

| ISR \ TSSE |  0.05  |  0.50  |  2.00  |  5.00  | 10.00  |
|---|--------|--------|--------|--------|--------|
|  0.05 | both    | both    | both    | spread  | spread  |
|  0.50 | seeding | both    | both    | spread  | spread  |
|  2.00 | seeding | seeding | seeding | neither | neither |
|  5.00 | seeding | seeding | seeding | neither | neither |
| 10.00 | seeding | seeding | seeding | neither | neither |


---

## Methodology

**Aggregation equation change:**

v1.0:
```
d_agg = vulnerability * AGG_SEED_RATE * aggAmp * dt
      + AGG_SPREAD_RATE * aggAmp * agg_spread * dt
      + oxidativeFeedback * ox * dt
```

v1.5 (Phase 15):
```
d_agg = vulnerability * AGG_SEED_RATE * ISR * dt
      + AGG_SPREAD_RATE * TSSE * agg_spread * dt
      + oxidativeFeedback * ox * dt
```

**Strict tipping criterion (Phase 7B):**
- C1: peak 10-step neuron death rate > 4
- C2: Pearson r(vulnerability, -death_step) > 0.3
- C3: first death after step 50

**Ablation threshold**: mechanism called load-bearing if disabling it
(setting to 0.001) reduces genuine tipping rate below
50% of the baseline rate for that grid cell.

**Fixed cascade parameters** (all other params held at baseline):
- mitochondrialFragility: 1.0
- atpCollapseThreshold: 0.3
- glutamateSensitivity: 0.01
- calciumStressGain: 0.5
- oxidativeFeedback: 0.02
- recoveryIrreversibility: 0.8

---

*Phase 15 -- ALS Connectome Degeneration Project*

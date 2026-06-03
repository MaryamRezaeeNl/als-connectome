# Phase 7B -- Strict Tipping Point Criterion

## Overview

Phase 7A reported a **44% false-positive rate** for tipping-point detection using the single condition `alive < TIPPING_THR`.

### Why timing variance (the originally-proposed c2) was abandoned

Running the null model with 5 seeds of the *same* configuration (fixed `mean_loss`) gives std ~ 10-20 steps, below the 30-step threshold.  The 57-step spread seen in Phase 7A came from 100 *different* configurations with different `mean_loss` values -- within a fixed null config the collapse timing is similarly consistent to the mechanistic model.  The criterion would have passed nearly all null runs, worsening the FPR to ~82%.

### Replacement criterion -- spatial coherence

The mechanistic cascade propagates via synaptic connections: neurons with high vulnerability scores (motor neurons: 0.65-1.0) die first because they receive the highest aggregation seeding rate.  The null model has no such structure -- deaths are independent and random.

**Criterion 2 (revised):** Pearson r between each neuron's vulnerability score and how early it died > 0.3.

The strict criterion requires ALL THREE:

| # | Condition | Threshold |
|---|-----------|-----------|
| 1 | Peak 10-step decline (slope) | > 4 neurons/10 steps |
| 2 | Spatial coherence: r(vulnerability, death order) | > 0.3 |
| 3 | Pre-symptomatic silent phase | first death at step > 50 |

## A. Phase 5 Critical-Regime Configs

Re-ran all 382 critical-regime configs with 5 seeds each.
(1910 total runs, 500 steps each.)

| Condition | Passing | Failing |
|-----------|---------|---------|
| 1. Slope > 4                    | 338 | 44 |
| 2. Coherence r > 0.3               | 248 | 134 |
| 3. Silent phase > 50 steps       | 382 | 0 |
| **All 3 (genuine tipping point)**        | **247** | **135** |

**247 / 382 (64.7%) critical configs have a GENUINE tipping point under the strict criterion.**

Previous criterion (alive < 55 at any step): all 382 qualified by definition.

### Spatial coherence scores

| Subset | Mean r | P25 | P75 |
|--------|--------|-----|-----|
| Genuine configs (247) | 0.56 | 0.51 | 0.62 |
| All critical (382) | 0.39 | 0.17 | 0.6 |

### Why configs fail each condition

- **Fail c1 (44 configs)**: no sudden acceleration -- neurons die gradually with peak 10-step decline <= 4. Low `aggregationAmplification` configs show this.

- **Fail c2 (134 configs)**: death order is not correlated with vulnerability (r <= 0.3). Configs where the glutamate/Ca/ROS cascade dominates can kill low-vulnerability neurons first via excitotoxic spread from highly-connected interneurons.

- **Fail c3 (0 configs)**: first neuron dies before step 50 -- no clinically meaningful pre-symptomatic window. Very high `aggregationAmplification` causes immediate onset.

## B. Phase 6 Therapy Re-Analysis

Best therapy: `agg_sup` strength=0.855, start_t=13 (Phase 6 rank-1).
Re-ran each of 10 environments with 5 seeds for baseline and therapy.

A **genuine delay** is confirmed when:
  - The baseline has a genuine tipping point (all 3 conditions pass), AND
  - The therapy either delays it > 10 steps within the window, OR
  - The therapy pushes the tipping point entirely beyond 300 steps (prevents tipping).

| Env | Env ID | Base genuine | Ther genuine | Base tip | Ther tip | Delay | Delay genuine |
|-----|--------|-------------|-------------|---------|----------|-------|--------------|
| 1 | 334 | No | -(prev) | 222 +/-3.5 | 300 +/-0.0 | (prevented) | No |
| 2 | 235 | No | -(prev) | 279 +/-10.8 | 300 +/-0.0 | (prevented) | No |
| 3 | 382 | Yes | -(prev) | 193 +/-5.8 | 300 +/-0.0 | (prevented) | Yes |
| 4 | 391 | No | -(prev) | 215 +/-6.7 | 300 +/-0.0 | (prevented) | No |
| 5 | 21 | Yes | -(prev) | 231 +/-8.7 | 300 +/-0.0 | (prevented) | Yes |
| 6 | 37 | Yes | -(prev) | 200 +/-5.7 | 300 +/-0.0 | (prevented) | Yes |
| 7 | 118 | Yes | -(prev) | 198 +/-7.3 | 300 +/-0.0 | (prevented) | Yes |
| 8 | 178 | Yes | -(prev) | 184 +/-1.7 | 300 +/-0.0 | (prevented) | Yes |
| 9 | 188 | Yes | -(prev) | 223 +/-5.5 | 300 +/-0.0 | (prevented) | Yes |
| 10 | 224 | Yes | -(prev) | 252 +/-12.0 | 300 +/-0.0 | (prevented) | Yes |

**Genuine baseline tipping points: 7 / 10**
**Therapy prevents tipping (tip=300): 10 / 10**
**Genuine therapy delay confirmed: 7 / 10**

Where therapy shows `tip_median=300` the cascade is fully suppressed within the 300-step observation window.  The strict criterion correctly labels these as 'no tipping point' (c1 fails -- no slope > 4) which is the optimal outcome.

## C. Null Model Re-Analysis

Re-ran 100 null model configs with 5 seeds each.

| Condition | Null runs passing |
|-----------|------------------|
| 1. Slope > 4              | 82 / 100 |
| 2. Coherence r > 0.3         | 0 / 100 |
| 3. Silent > 50 steps       | 100 / 100 |
| **All 3 (false positive)**         | **0 / 100** |

**New false-positive rate: 0% (was 44% in Phase 7A).**

### Spatial coherence distribution (null model)

| Metric | Null coherence r |
|--------|-----------------|
| Mean   | -0.01 |
| P10    | -0.15 |
| P50    | -0.02 |
| P90    | 0.11 |

The null model's death order has near-zero correlation with vulnerability (expected r ~ 0 for uncoupled random walk), well below the 0.3 threshold.  Spatial coherence is the primary discriminator.

## Overall Verdict

### Tipping point survival rate

| Dataset | Old criterion | Strict criterion | Survival |
|---------|-------------|-----------------|----------|
| Phase 5 critical (382 configs) | 382/382 (100%) | 247/382 (65%) | 65% |
| Phase 6 baseline tipping points (10) | 10/10 | 7/10 | 70% |
| Phase 6 therapy delays (10) | 10/10 | 7/10 | 70% |
| Null model false positives (100) | 44/100 (44%) | 0/100 (0%) | -- |

### Key findings

1. **247/382 Phase 5 critical configs** (65%) represent robust triphasic ALS-like degeneration with a sharp, vulnerability-ordered collapse preceded by a clear pre-symptomatic window.

2. **All 7 confirmed Phase 6 therapy delays** represent environments where the best therapy (`agg_sup` strength=0.855) genuinely prevents or delays mechanistic collapse -- not a stochastic artifact.

3. **The null model FPR drops from 44% to 0%.**  Spatial coherence (vulnerability-ordered death) is the criterion that cleanly separates mechanistic cascade from uncoupled random walk: null model coherence r ~ -0.01 vs mechanistic r > 0.3.

---
_Generated by `phase7b_tipping_criterion.py` -- ALS connectome project Phase 7B_
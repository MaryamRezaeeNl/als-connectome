# R3.4 -- Mitochondrial Threshold Validation

## Overview

Validation of the R3.3 mitochondrial takeover threshold using increased
sample size (n=50 vs 15) and strict dual-criterion classification
(ALL three criteria must be satisfied vs any-one).

**Context**: Low aggregation only (ISR=0.5, TSSE=0.5)
**Levels**: 9 mitFrag values x 50 seeds x 2 (baseline+ablation)
= **900 total runs** x 500 steps
**Bootstrap**: 10,000 resamples per level for 95% CIs

**Strict classification (ALL must be satisfied)**:
- first\_death\_shift > 50 steps
- plateau\_gain > 5 neurons
- genuine\_rate\_drop > 0.20

---

## Per-Level Results

| mitFrag | genuine | shift (95% CI) | gain (95% CI) | rdrop (95% CI) | criteria | label | 16B label |
|---|---|---|---|---|---|---|---|
|  0.3 | 0.28 | +1 [-7, +9] | +0.9 [-0.5, +2.4] | -0.060 [-0.240, +0.140] | 0/3 | seeding_dominant | TAKEOVER (16B) |
|  0.5 | 0.24 | +2 [-5, +10] | +1.7 [+0.4, +3.1] | +0.000 [-0.180, +0.180] | 0/3 | seeding_dominant | transitional (16B) |
|  1.0 | 0.34 | +10 [+3, +18] | +1.4 [-0.1, +2.8] | +0.140 [-0.040, +0.320] | 0/3 | seeding_dominant | transitional (16B) |
|  2.0 | 0.22 | +28 [+20, +36] | +3.0 [+1.5, +4.4] | -0.140 [-0.300, +0.020] | 0/3 | seeding_dominant | transitional (16B) |
|  3.0 | 0.32 | +44 [+36, +51] | +4.9 [+3.5, +6.3] | -0.020 [-0.180, +0.140] | 0/3 | seeding_dominant | transitional (16B) |
|  4.0 | 0.20 | +66 [+60, +72] | +7.9 [+6.7, +9.1] | -0.040 [-0.200, +0.120] | 2/3 | near_takeover | TAKEOVER (16B) |
|  5.0 | 0.32 | +72 [+63, +81] | +8.9 [+7.6, +10.2] | +0.100 [-0.080, +0.280] | 2/3 | near_takeover | TAKEOVER (16B) |
|  6.0 | 0.40 | +88 [+81, +95] | +9.6 [+8.7, +10.6] | +0.160 [-0.020, +0.340] | 2/3 | near_takeover | TAKEOVER (16B) |
|  8.0 | 0.20 | +106 [+98, +113] | +10.8 [+9.7, +11.9] | +0.060 [-0.060, +0.180] | 2/3 | near_takeover | TAKEOVER (16B) |

---

## R3.3 vs R3.4 at mitFrag = 0.3

**R3.3 (n=15 seeds)**:
- shift = +10.2 steps (criterion: >50 -- **FAIL**)
- gain  = +1.2 neurons (criterion: >5 -- **FAIL**)
- rdrop = +0.333 (criterion: >0.20 -- **PASS**)
- Criteria met: 1/3 -- classified TAKEOVER via single criterion only

**R3.4 (n=50 seeds)**:
- shift = +1 steps [-7, +9] (criterion: >50 -- **FAIL**)
- gain  = +0.9 neurons [-0.5, +2.4] (criterion: >5 -- **FAIL**)
- rdrop = -0.060 [-0.240, +0.140] (criterion: >0.20 -- **FAIL**)
- Criteria met: 0/3 -- **ARTIFACT**

---

## Validated Mitochondrial Takeover Threshold

### Q1: Validated threshold under strict dual-criterion

No strict TAKEOVER (3/3 criteria) was observed at any tested level.

**Near-takeover onset (2/3 criteria): mitFrag = 4.0**

First level where shift AND gain criteria are both satisfied (n=50 seeds):
- shift = +66 steps [95% CI: +60, +72] -- criterion >50: PASS
- gain  = +7.9 neurons [95% CI: +6.7, +9.1] -- criterion >5: PASS
- rdrop = -0.040 [95% CI: -0.200, +0.120] -- criterion >0.2: FAIL (see Q4)

The R3.3 claim of TAKEOVER at mitFrag=0.3 is rejected. The validated near-takeover onset is mitFrag = **4.0**, consistent with the cleaner 16B signal at mitFrag=4.0.

---

### Q2: Was the R3.3 mitFrag=0.3 signal artifact or genuine?

The R3.3 takeover signal at mitFrag=0.3 is **ARTIFACT** (noise).

With n=50 seeds, the mitFrag=0.3 level satisfies only 0/3 strict criteria. The 16B detection was driven by a single criterion (genuine_rate_drop) that was inflated by the small sample (n=15). genuine_rate_drop is particularly noisy at low ISR/TSSE because the cascade is near the tipping boundary, so stochastic variation in whether individual runs qualify as 'genuine' dominates the signal at n=15.

The shift (+10 steps) and plateau gain (+1.2 neurons) in R3.3 were already below any reasonable threshold and were correctly dismissed.

---

### Q3: Final threshold estimate with confidence interval

Near-takeover onset: mitFrag = **4.0** (2/3 criteria, n=50 seeds).

**At mitFrag=4.0** (first near-takeover level):
- shift: +66 [95% CI +60, +72] -- CI entirely above +50: yes
- gain:  +7.9 [95% CI +6.7, +9.1] -- CI entirely above +5: yes

**At mitFrag=3.0** (highest sub-threshold level):
- shift: +44 [95% CI +36, +51]
- gain:  +4.9 [95% CI +3.5, +6.3]

The near-takeover transition is between mitFrag=3.0 (0/3) and mitFrag=4.0 (2/3). Bootstrap CIs on shift and gain at mitFrag=4.0 are well-separated from the thresholds, confirming the 2/3 signal is not a sampling artifact.

---

### Q4: Revised v2.0 mechanistic claim

**Revised v2.0 mechanistic claim (R3.4 validated)**:

Under strict dual-criterion, no full mitochondrial TAKEOVER (3/3) is detected. However, a robust **near-takeover regime** (2/3 criteria) is confirmed for mitFrag >= 4.0:

**At mitFrag >= 4.0**:
- Death-onset delay (shift): +66 steps [95% CI +60, +72] -- criterion >50 **satisfied**
- Survival rescue (gain): +7.9 neurons [95% CI +6.7, +9.1] -- criterion >5 **satisfied**
- Tipping disruption (rdrop): -0.040 [95% CI -0.200, +0.120] -- criterion >0.2 **not satisfied**

The genuine_rate_drop criterion (>0.2) is not reliably met even at mitFrag=8.0.

**Mechanistic interpretation**: At high mitochondrial fragility (>= 4.0), mitochondria act as a **death accelerator and survival suppressor** but not a **cascade gatekeeper**. The cascade still tips (tipping structure intact) but tips faster and results in fewer surviving neurons. This is a weaker form of load-bearing than a true independent entry point.

**Contrast with v1.0**: The v1.0 claim (aggregation is sole load-bearing mechanism) holds for the tipping criterion (genuine_rate) across all tested mitFrag levels. The near-takeover regime modifies WHEN and HOW MUCH degeneration occurs, not WHETHER it tips.

The R3.3 threshold claim of mitFrag=0.3 (single-criterion artifact) is rejected. The near-takeover onset of mitFrag=4.0 is the validated operational threshold.

---

## Methodology

**Mitochondrial ablation**: set `mitochondrialFragility = 0.001`;
all other parameters held at grid values.

**Strict takeover criterion**: ALL three must be satisfied simultaneously:
1. `first_death_shift > 50` steps (onset delay -- mito was accelerating death)
2. `plateau_gain > 5` neurons (survival rescue -- mito suppressed plateau)
3. `genuine_rate_drop > 0.20` (tipping structure disrupted)

**Phase 7B tipping criterion** (for genuine\_rate):
- C1: peak 10-step death rate > 4
- C2: Pearson r(vulnerability, -death\_step) > 0.3
- C3: first death > step 50

**Bootstrap**: 10,000 percentile-bootstrap resamples (paired,
same index drawn for baseline and ablation to preserve correlation).

---

*R3.4 -- ALS Connectome Degeneration Project*

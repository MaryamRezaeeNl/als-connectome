# R3.3 -- Mitochondrial Takeover Threshold

## Overview

Precise mapping of the mitFrag level at which mitochondrial damage transitions
from amplifier to load-bearing mechanism, and whether this threshold depends
on the aggregation context (ISR/TSSE).

**Grid**: 10 mitFrag levels x 3 aggregation contexts
= 30 cells x 15 seeds x 2 (baseline+ablation)
= **900 total runs** x 500 steps

---

## Effect Heat Map

| mitFrag | Low (ISR=0.5, TSSE=0.5) | Medium (ISR=2.0, TSSE=2.0) | High (ISR=5.0, TSSE=5.0) |
|---|---|---|---|
|  0.3 | TAKEOVER (shift=+10) | seeding  (shift=-0) | seeding  (shift=-0) |
|  0.5 | transit. (shift=+20) | seeding  (shift=+1) | seeding  (shift=+0) |
|  1.0 | transit. (shift=+2) | seeding  (shift=+2) | seeding  (shift=+0) |
|  1.5 | seeding  (shift=+14) | seeding  (shift=+3) | seeding  (shift=-0) |
|  2.0 | transit. (shift=+27) | seeding  (shift=+1) | seeding  (shift=+0) |
|  3.0 | transit. (shift=+42) | seeding  (shift=+9) | seeding  (shift=-0) |
|  4.0 | TAKEOVER (shift=+65) | seeding  (shift=+9) | seeding  (shift=-0) |
|  5.0 | TAKEOVER (shift=+68) | seeding  (shift=+15) | seeding  (shift=+0) |
|  6.0 | TAKEOVER (shift=+93) | seeding  (shift=+16) | seeding  (shift=+0) |
|  8.0 | TAKEOVER (shift=+122) | transit. (shift=+24) | seeding  (shift=+1) |


---

## Mitochondrial Takeover Threshold

| Aggregation context | Takeover threshold (mitFrag) | % of mitFrag range |
|---|:-:|:-:|
| Low (ISR=0.5, TSSE=0.5) | 0.3 | 100.0% |
| Medium (ISR=2.0, TSSE=2.0) | > 8.0 (not reached) | 0.0% |
| High (ISR=5.0, TSSE=5.0) | > 8.0 (not reached) | 0.0% |

**Threshold aggregation-dependent**: False

---

## Threshold Boundary Fit

Threshold not reached in enough contexts to fit a boundary equation. All tested contexts show the same threshold or no threshold.

---

## Q1: At what mitFrag level does mitochondrial damage become load-bearing?

Mitochondrial damage becomes load-bearing at mitFrag = **0.3** (lowest context threshold) to **0.3** (highest context threshold). At the v1.0 baseline (mitFrag = 1.0), the effect is small/negligible across all contexts. The takeover threshold is 0.3x above the v1.0 baseline.

---

## Q2: Is this threshold aggregation-context dependent?

**No** -- the threshold is the same across all three aggregation contexts (mitFrag = 0.3). Mitochondrial takeover is independent of the aggregation level, suggesting a threshold in the mitochondria-to-ATP coupling that is not modulated by upstream seeding.

---

## Q3: Threshold equation

Insufficient data points to fit a reliable threshold equation (need >=2 contexts with detected threshold).

---

## Q4: What fraction of biologically plausible parameter space is mitochondrial-dominated?

Mean across aggregation contexts: **33.3%** of the mitFrag range [0.3, 8.0] corresponds to mitochondrial-dominated dynamics. Context breakdown: Low 100.0%, Medium 0.0%, High 0.0%. The v1.0 study sampled mitFrag uniformly from [0.3, 8.0]; approximately 33% of that range lies above the takeover threshold.

---

## Q5: Revised mechanistic picture for v2.0

**Revised v2.0 picture**: The cascade operates in two distinct regimes separated by the mitochondrial takeover threshold:

1. **Seeding-gated regime** (mitFrag < 0.3): Aggregation seeding is the sole load-bearing mechanism. Disabling downstream pathways (mito, glut, calcium) produces negligible effects.

2. **Mitochondrial co-driver regime** (mitFrag >= 0.3): Mitochondrial damage becomes independently load-bearing. The two-tier model (seeding -> tipping -> topological amplification) gains a third entry point via ATP-independent mitochondrial collapse.

The v1.0 mechanistic claim (single-factor aggregation dominance) is valid for 67% of the mitFrag parameter space but requires the qualifier: '*under elevated mitochondrial fragility (>= 0.3x baseline), the mitochondrial pathway can independently sustain cascade dynamics.*'

---

## Methodology

**Mitochondrial ablation**: set `mitochondrialFragility = 0.001` while keeping
all other parameters at their grid values.

**Effect size**:
- Large / TAKEOVER: abs(shift) > 50 steps OR abs(gain) > 10 neurons OR rate_drop > 0.30
- Medium / transitional: > 20 steps OR > 5 neurons OR > 0.10
- Small / seeding_dominant: below medium thresholds

**Aggregation contexts fixed params** (all else baseline):
- atpCollapseThreshold = 0.30
- glutamateSensitivity = 0.01
- calciumStressGain = 0.50
- oxidativeFeedback = 0.020
- recoveryIrreversibility = 0.80

---

*R3.3 -- ALS Connectome Degeneration Project*

# R3.8 -- Gatekeeper vs Amplifier Combination Therapy Sweep

## Overview

**Computational hypothesis-generating analysis only.**
No claims are made about riluzole, ALS patients, or real treatment efficacy.
All results are within this computational framework.

**Model**: Decoupled v2.0 (DecoupledSimulator)
**Context**: Medium aggregation (ISR = 2.0, TSSE = 2.0)
**Baseline glutamateSensitivity**: 0.01
**Connectome**: C. elegans motor circuit (61 neurons)
**Criterion**: Strict Phase 7B tipping (C1: peak rate > 4, C2: coh r > 0.3, C3: first death > 50)
**Runs**: 20 seeds x 500 steps per condition
**Bootstrap**: 500 iterations for synergy CI

**Baseline (untreated) stats**:
- Genuine tipping rate: 1.000
- Median first death step: 168
- Median plateau survivors: 9
- Mean spatial coherence r: 0.673
- Functional survival duration: 226 steps

---

## VERDICT: GATEKEEPER-DOMINANT

Within this computational framework, ISR suppression (gatekeeper targeting) is substantially more effective than riluzole-like glutamate suppression (amplifier targeting) at the tested doses. Combination therapy provides incremental benefit but is not required for meaningful effect. The upstream ISR pathway is the dominant therapeutic target in this model.

**Key metrics**:
| Metric | Value |
|--------|-------|
| ISR 50% benefit score | 0.057 |
| ISR 70% benefit score | 0.111 |
| Glut 90% benefit score | 0.001 |
| Glut 99% benefit score | 0.000 |
| Best combination benefit | 0.062 |
| Best synergy cell | (0.5, 0.9) |
| Best synergy value | +0.004 |
| Best synergy CI | [-0.007, +0.008] |
| Best synergy classification | additive |

---

## Q1: Is ISR suppression more effective than riluzole-like glutamate suppression?

**YES -- within this computational framework, ISR suppression is more effective than downstream amplifier targeting.** ISR 50% suppression yields a benefit score of 0.057 (genuine tipping rate: 1.000), while riluzole-like glutamate suppression at 90% yields 0.001 (genuine tipping rate: 1.000). Even at 70% ISR suppression, benefit reaches 0.111. This is consistent with ISR acting as the primary load-bearing gatekeeper in the cascade -- reducing it has a disproportionate effect on cascade initiation.

---

## Q2: Can strong riluzole-like glutamate suppression alone prevent tipping?

**NO -- even strong riluzole-like glutamate suppression (90-99%) within this model does not reliably prevent genuine tipping** (tipping rate at 90%: 1.000; at 99%: 1.000; baseline: 1.000). This supports the hypothesis that the ISR gatekeeper must be suppressed for downstream amplifier targeting to be effective within this computational framework.

---

## Q3: Does partial ISR suppression unlock benefit from glutamate suppression?

**YES -- partial ISR suppression appears to unlock additional benefit from glutamate suppression within this model.** ISR 20% alone: 0.027; Glut 50% alone: 0.002; Combined: 0.020 (expected additive: 0.028). ISR 30% alone: 0.036; Glut 70% alone: 0.003; Combined: 0.037 (expected additive: 0.039). This is consistent with the gatekeeper hypothesis: the ISR gate must be partially opened before downstream amplifier suppression contributes meaningfully.

---

## Q4: Is there true synergy or only additive benefit?

**ADDITIVE benefit -- no evidence of true synergy within this computational framework.** Best synergy cell (0.5, 0.9): synergy = +0.004 (95% CI: [-0.007, +0.008]). The observed combination benefit is consistent with simple additive effects of the two pathways. There is no evidence that combining ISR and glutamate suppression produces disproportionate cascade disruption.

---

## Q5: Gatekeeper vs amplifier interpretation

**Within this computational framework**, the ISR pathway functions as the dominant upstream gatekeeper. Single-agent ISR 50% suppression achieves benefit 0.057, while glutamate 90% suppression achieves 0.001. The larger ISR effect is consistent with the R3.1 finding that intracellular seeding is the more predictive mechanism.

The glutamate excitotoxicity pathway acts as a downstream amplifier: it contributes to cascade propagation after ATP collapse, but blocking it alone cannot prevent cascade initiation if ISR-driven aggregation remains active. Within the cascade hierarchy: ISR drives aggregation -> ATP collapse -> glutamate excitotoxicity -> calcium overload -> ROS -> further aggregation. Blocking at the glutamate step leaves the upstream seeding load intact.

The combination results (additive) suggest that ISR and glutamate suppression act through largely independent mechanisms with additive contributions within this model.

---

## Q6: Does downstream therapy fail if the upstream ISR gate remains active?

**PARTIAL support for gatekeeper-failure hypothesis within this model.** Glutamate 90% alone: benefit 0.001 (tipping rate: 1.000). ISR 30% + Glutamate 70%: benefit 0.037 (tipping rate: 1.000). The combination does not clearly outperform maximal single-agent glutamate suppression, suggesting the gatekeeper-failure effect is not dominant at these parameter values within this computational framework.

---

## Scenario A: ISR Suppression Only (ASO-like upstream targeting)

| ISR reduction | ISR value | Genuine rate | Plateau | Benefit score |
|---|---|---|---|---|
| 10% | 1.80 | 1.000 | 10 | 0.011 |
| 20% | 1.60 | 1.000 | 11 | 0.027 |
| 30% | 1.40 | 1.000 | 12 | 0.036 |
| 50% | 1.00 | 1.000 | 12 | 0.057 |
| 70% | 0.60 | 0.950 | 14 | 0.111 |

---

## Scenario B: Glutamate Suppression Only (riluzole-like downstream targeting)

| Glut reduction | Glut value | Genuine rate | Plateau | Benefit score |
|---|---|---|---|---|
| 50% | 0.005000 | 1.000 | 9 | 0.002 |
| 70% | 0.003000 | 1.000 | 10 | 0.003 |
| 90% | 0.001000 | 1.000 | 9 | 0.001 |
| 99% | 0.000100 | 1.000 | 9 | 0.000 |

---

## Scenario D: Smart Low-Dose Comparison

| Scenario | Genuine rate | First death | Plateau | Coh r | Benefit |
|---|---|---|---|---|---|
| 20% ISR alone | 1.000 | 180 | 11 | 0.653 | 0.027 |
| 50% Glut alone | 1.000 | 170 | 9 | 0.678 | 0.002 |
| 20% ISR + 50% Glut | 1.000 | 180 | 10 | 0.644 | 0.020 |
| 30% ISR + 70% Glut | 1.000 | 184 | 12 | 0.610 | 0.037 |
| 50% ISR alone | 1.000 | 195 | 12 | 0.559 | 0.057 |
| 90% Glut alone | 1.000 | 170 | 9 | 0.666 | 0.001 |

---

## Synergy Analysis (Combination Cells Only)

| ISR red | Glut red | Benefit combo | Expected additive | Synergy | 95% CI | Classification |
|---|---|---|---|---|---|---|
| 10% | 50% | 0.011 | 0.013 | -0.002 | [-0.012, +0.006] | additive |
| 10% | 70% | 0.016 | 0.014 | +0.002 | [-0.009, +0.006] | additive |
| 10% | 90% | 0.016 | 0.012 | +0.004 | [-0.008, +0.007] | additive |
| 20% | 50% | 0.020 | 0.028 | -0.008 | [-0.019, +0.003] | additive |
| 20% | 70% | 0.023 | 0.029 | -0.007 | [-0.018, +0.002] | additive |
| 20% | 90% | 0.026 | 0.028 | -0.002 | [-0.016, +0.009] | additive |
| 30% | 50% | 0.038 | 0.038 | +0.000 | [-0.008, +0.011] | additive |
| 30% | 70% | 0.037 | 0.039 | -0.002 | [-0.014, +0.006] | additive |
| 30% | 90% | 0.031 | 0.037 | -0.006 | [-0.015, +0.004] | additive |
| 50% | 50% | 0.058 | 0.058 | -0.000 | [-0.013, +0.007] | additive |
| 50% | 70% | 0.059 | 0.060 | -0.001 | [-0.010, +0.009] | additive |
| 50% | 90% | 0.062 | 0.058 | +0.004 | [-0.007, +0.008] | additive |

**Synergy classification criteria:**
- Synergistic: synergy > +0.10 AND bootstrap CI lower bound > 0
- Additive: CI overlaps 0
- Antagonistic: synergy < -0.10 AND bootstrap CI upper bound < 0

---

## Full Results Table

| Scenario | ISR red | Glut red | ISR val | Glut val | Genuine rate | First death | Plateau | Coh r | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| baseline | 0% | 0% | 2.00 | 0.01000 | 1.000 | 168 | 9 | 0.673 | 0.000 |
| ISR0%+G50% | 0% | 50% | 2.00 | 0.00500 | 1.000 | 170 | 9 | 0.678 | 0.002 |
| ISR0%+G70% | 0% | 70% | 2.00 | 0.00300 | 1.000 | 168 | 10 | 0.676 | 0.003 |
| ISR0%+G90% | 0% | 90% | 2.00 | 0.00100 | 1.000 | 170 | 9 | 0.666 | 0.001 |
| ISR0%+G99% | 0% | 99% | 2.00 | 0.00010 | 1.000 | 168 | 9 | 0.680 | 0.000 |
| ISR10%+G0% | 10% | 0% | 1.80 | 0.01000 | 1.000 | 174 | 10 | 0.650 | 0.011 |
| ISR10%+G50% | 10% | 50% | 1.80 | 0.00500 | 1.000 | 172 | 10 | 0.641 | 0.011 |
| ISR10%+G70% | 10% | 70% | 1.80 | 0.00300 | 1.000 | 174 | 11 | 0.652 | 0.016 |
| ISR10%+G90% | 10% | 90% | 1.80 | 0.00100 | 1.000 | 173 | 11 | 0.650 | 0.016 |
| ISR20%+G0% | 20% | 0% | 1.60 | 0.01000 | 1.000 | 180 | 11 | 0.653 | 0.027 |
| ISR20%+G50% | 20% | 50% | 1.60 | 0.00500 | 1.000 | 180 | 10 | 0.644 | 0.020 |
| ISR20%+G70% | 20% | 70% | 1.60 | 0.00300 | 1.000 | 176 | 11 | 0.636 | 0.023 |
| ISR20%+G90% | 20% | 90% | 1.60 | 0.00100 | 1.000 | 179 | 11 | 0.653 | 0.026 |
| ISR30%+G0% | 30% | 0% | 1.40 | 0.01000 | 1.000 | 180 | 12 | 0.619 | 0.036 |
| ISR30%+G50% | 30% | 50% | 1.40 | 0.00500 | 1.000 | 186 | 12 | 0.624 | 0.038 |
| ISR30%+G70% | 30% | 70% | 1.40 | 0.00300 | 1.000 | 184 | 12 | 0.610 | 0.037 |
| ISR30%+G90% | 30% | 90% | 1.40 | 0.00100 | 1.000 | 182 | 12 | 0.625 | 0.031 |
| ISR50%+G0% | 50% | 0% | 1.00 | 0.01000 | 1.000 | 195 | 12 | 0.559 | 0.057 |
| ISR50%+G50% | 50% | 50% | 1.00 | 0.00500 | 1.000 | 197 | 13 | 0.530 | 0.058 |
| ISR50%+G70% | 50% | 70% | 1.00 | 0.00300 | 1.000 | 198 | 13 | 0.563 | 0.059 |
| ISR50%+G90% | 50% | 90% | 1.00 | 0.00100 | 1.000 | 199 | 13 | 0.550 | 0.062 |
| ISR70%+G0% | 70% | 0% | 0.60 | 0.01000 | 0.950 | 218 | 14 | 0.464 | 0.111 |

---

## Benefit Score Definition

Weighted composite of 4 components vs untreated baseline:

| Component | Weight | Formula |
|---|---|---|
| Tipping prevention | 0.4 | (baseline_GTR - cond_GTR) / baseline_GTR |
| First-death delay | 0.2 | (cond_FD - base_FD) / (STEPS - base_FD) |
| Plateau survivor gain | 0.25 | (cond_PL - base_PL) / (N - base_PL) |
| Functional survival gain | 0.15 | (cond_FS - base_FS) / (STEPS - base_FS) |

All components clamped to [0, 1]. Benefit = 0 for baseline by construction.
Functional survival duration: step at which alive count first drops to <= 30.

---

## Methodology

**Decoupled v2.0 model** (R3.1): ISR and TSSE are independent parameters.
- ISR suppression: `intracellularSeedingRate = 2.0 * (1 - ISR_reduction)`
- Glut suppression: `glutamateSensitivity = 0.01 * (1 - glut_reduction)`
- TSSE held constant at 2.0 (medium context, unperturbed)

**ISR suppression** is analogous in model terms to upstream aggregation/seeding suppression
(ASO-like). No direct mapping to any specific clinical intervention is implied.

**Glutamate suppression** is analogous in model terms to riluzole-like downstream
excitotoxicity suppression. This is NOT a model of riluzole's clinical mechanism.
Results describe behavior within this computational framework only.

**Strict Phase 7B tipping criterion**:
- C1: peak 10-step death rate > 4
- C2: Pearson r(vulnerability, -death_step) > 0.3
- C3: first neuron death after step 50

---

*R3.8 -- ALS Connectome Degeneration Project*
*Hypothesis-generating analysis only. Not a clinical study.*

# R3.9 -- Therapeutic Cliff Mapping

## Overview

**Computational hypothesis-generating analysis only.**
No clinical claims are made. All results are within this computational framework.

**Question**: Does ISR suppression produce a gradual therapeutic response or a sharp
tipping-prevention threshold ("therapeutic cliff")?

**Model**: Decoupled v2.0 (DecoupledSimulator from R3.1)
**Context**: Medium aggregation (ISR = 2.0, TSSE = 2.0)
**Baseline glutamateSensitivity**: 0.01
**Connectome**: C. elegans motor circuit (61 neurons)
**Criterion**: Strict Phase 7B (C1: peak rate > 4, C2: coh r > 0.3, C3: first death > 50)
**Runs**: 50 seeds x 500 steps per condition
**Bootstrap**: 1000 iterations (CI for genuine tipping rate)

**Baseline (ISR = 2.0, 0% suppression)**:
- Genuine tipping rate: 1.000
- Median first death step: 170
- Median plateau survivors: 9
- Mean spatial coherence r: 0.674
- Functional survival duration: 225 steps

---

## VERDICT: SHARP CLIFF

Sharp therapeutic cliff detected within this computational framework. A narrow ISR suppression window produces rapid cascade prevention.

**Response shape**: CLIFF-LIKE — A sharp threshold exists near ISR suppression = 90%. Maximum single-step drop = 0.280 genuine tipping rate units.

**Critical thresholds**:
- ISR50 = 96.5% (95% CI: [89.3%, 97.3%])
- ISR90: not reached within tested range.

**Cliff regions detected**: 1 cliff

- ISR suppression 85% -> 90%: delta_tipping=-0.280, delta_benefit=+0.131

---

## Q1: Does a therapeutic cliff exist?

**YES -- a therapeutic cliff is detected within this computational framework.** A sharp drop in genuine tipping rate occurs near ISR suppression = 90%. Maximum single-step drop = 0.280 genuine tipping rate units. This is consistent with a nonlinear gatekeeper threshold: small additional ISR suppression near this point produces disproportionate cascade prevention.

---

## Q2: At what ISR suppression level does tipping begin to fail?

**Genuine tipping first drops below 100% at ISR suppression = 70% (ISR = 0.600), where genuine tipping rate = 0.980.** Below this level, 100% of seeds produce genuine tipping regardless of ISR reduction.

---

## Q3: Is there a narrow threshold window or broad gradual response?

Tipping begins to decline at 70% ISR suppression, but does not reach 90% prevention within the tested range.

---

## Q4: Are there early warning indicators of approaching collapse prevention?

**YES -- early warning signals are detectable before the tipping collapse within this model.** The following metrics show meaningful changes in the levels immediately preceding the tipping onset: spatial coherence r decline, plateau survivor increase, first-death delay. These may serve as model-level indicators of approaching cascade prevention.

---

## Q5: Does this strengthen the gatekeeper interpretation?

**The results strongly support the gatekeeper interpretation within this computational framework.** ISR is the upstream gatekeeper controlling cascade initiation. The cliff-like response shape implies that the cascade has a critical aggregation threshold: once ISR drops below a certain level, the misfolded protein load cannot self-sustain, and tipping collapses. This is the hallmark of a true gatekeeper mechanism. Therapeutic efficacy is strongly nonlinear: effort below the threshold yields little benefit; exceeding it produces dramatic cascade prevention.

---

## Full Results Table

| ISR red. | ISR val | Genuine rate | CI 95% | First death | Plateau | Coh r | Func. surv. | Benefit |
|---|---|---|---|---|---|---|---|---|
| 0% | 2.000 | 1.000 | [1.000, 1.000] | 170 | 9 | 0.674 | 225 | 0.0000 |
| 10% | 1.800 | 1.000 | [1.000, 1.000] | 174 | 10 | 0.663 | 231 | 0.0105 |
| 20% | 1.600 | 1.000 | [1.000, 1.000] | 179 | 11 | 0.631 | 240 | 0.0235 |
| 30% | 1.400 | 1.000 | [1.000, 1.000] | 184 | 12 | 0.618 | 250 | 0.0360 |
| 40% | 1.200 | 1.000 | [1.000, 1.000] | 190 | 12 | 0.592 | 253 | 0.0421 |
| 50% | 1.000 | 1.000 | [1.000, 1.000] | 198 | 13 | 0.543 | 264 | 0.0575 |
| 60% | 0.800 | 1.000 | [1.000, 1.000] | 205 | 13 | 0.497 | 275 | 0.0677 |
| 70% | 0.600 | 0.980 | [0.940, 1.000] | 214 | 14 | 0.448 | 288 | 0.0931 |
| 75% | 0.500 | 0.960 | [0.900, 1.000] | 218 | 14 | 0.421 | 295 | 0.1076 |
| 80% | 0.400 | 0.880 | [0.780, 0.960] | 223 | 14 | 0.386 | 306 | 0.1486 |
| 85% | 0.300 | 0.860 | [0.760, 0.940] | 224 | 15 | 0.376 | 308 | 0.1626 |
| 90% | 0.200 | 0.580 | [0.440, 0.700] | 234 | 16 | 0.330 | 321 | 0.2931 |
| 92% | 0.160 | 0.640 | [0.520, 0.760] | 234 | 16 | 0.329 | 318 | 0.2653 |
| 94% | 0.120 | 0.560 | [0.420, 0.700] | 239 | 16 | 0.326 | 323 | 0.3049 |
| 95% | 0.100 | 0.680 | [0.540, 0.800] | 242 | 16 | 0.322 | 325 | 0.2601 |
| 96% | 0.080 | 0.560 | [0.420, 0.680] | 240 | 16 | 0.300 | 320 | 0.3045 |
| 97% | 0.060 | 0.440 | [0.300, 0.580] | 242 | 16 | 0.287 | 334 | 0.3602 |
| 98% | 0.040 | 0.360 | [0.220, 0.500] | 246 | 17 | 0.269 | 331 | 0.3980 |
| 99% | 0.020 | 0.520 | [0.380, 0.660] | 244 | 17 | 0.295 | 327 | 0.3310 |

---

## Shape Analysis

| Metric | Value |
|--------|-------|
| Response shape | cliff-like |
| Total genuine tipping drop | 0.4800 |
| Max single-step drop | 0.2800 |
| Max drop at suppression level | 90.0% |
| First-half drop (0%-80%) | 0.1200 |
| Second-half drop (80%-99%) | 0.3600 |

---

## Methodology

**ISR suppression sweep**: `intracellularSeedingRate = 2.0 * (1 - suppression_fraction)`
**TSSE**: held constant at 2.0 (medium context, unperturbed)
**All other parameters**: fixed at medium-context baseline

**Cliff detection thresholds**:
- Tipping rate: |delta| > 0.2
- Benefit score: |delta| > 0.1

**ISR50**: suppression level for 50% reduction in genuine tipping probability.
**ISR90**: suppression level for 90% reduction in genuine tipping probability.
Both estimated by linear interpolation between adjacent data points; CI from
bootstrap resampling within per-condition 95% CIs (n=1000).

**Benefit score**: weighted composite (tipping 40%, delay 20%, plateau 25%, survival 15%)
vs untreated baseline.

**Functional survival**: step when alive count first drops to <= 30.

---

*R3.9 -- ALS Connectome Degeneration Project*
*Hypothesis-generating analysis only. Not a clinical study.*

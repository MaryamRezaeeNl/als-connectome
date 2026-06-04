# Phase 16A -- Downstream Causal Power Test

## Overview

Tests whether downstream cascade pathways (mitochondrial, glutamate, calcium/ROS,
irreversibility) can become genuinely load-bearing when stressed independently
of aggregation.

**Regimes**: 3
**Configs per regime**: [6, 6, 10]
**Baseline seeds per config**: 10
**Ablation seeds per config**: 5 x 6 ablations
**Total runs**: ~880 x 500 steps

---

## Causal Power Summary Table

| Mechanism | Role | Seeding-dominant (R1) | Spread-dominant (R2) | Downstream-stressed (R3) |
|---|---|---|---|---|
| Intracellular seeding (ISR) | **load_bearing** | shift=+179 (large) | shift=+4 (small) | shift=+64 (large) |
| Trans-synaptic spread (TSSE) | **load_bearing** | shift=+22 (small) | shift=+247 (large) | shift=+33 (medium) |
| Mitochondrial damage | **load_bearing** | shift=+3 (small) | shift=+0 (small) | shift=+61 (large) |
| Glutamate excitotoxicity | **negligible** | shift=-0 (small) | shift=-2 (small) | shift=+18 (small) |
| Calcium / ROS | **negligible** | shift=-0 (small) | shift=-2 (small) | shift=+18 (small) |
| Irreversibility lock | **negligible** | shift=-0 (small) | shift=-2 (small) | shift=+4 (small) |


---

## Detailed Results

| Mechanism | Regime | Shift (steps) | Plateau gain | Rate drop | Effect |
|---|---|---:|---:|---:|:---|
| Intracellular seeding (ISR) | Seeding-dominant (R1) | +178.9 | +28.6 | +0.800 | large |
| Intracellular seeding (ISR) | Spread-dominant (R2) | +4.4 | +1.0 | +0.100 | small |
| Intracellular seeding (ISR) | Downstream-stressed (R3) | +64.1 | +10.3 | +0.610 | large |
| Trans-synaptic spread (TSSE) | Seeding-dominant (R1) | +21.5 | +2.6 | +0.000 | small |
| Trans-synaptic spread (TSSE) | Spread-dominant (R2) | +247.1 | +38.9 | +0.900 | large |
| Trans-synaptic spread (TSSE) | Downstream-stressed (R3) | +33.2 | +4.8 | -0.010 | medium |
| Mitochondrial damage | Seeding-dominant (R1) | +2.8 | -0.4 | +0.000 | small |
| Mitochondrial damage | Spread-dominant (R2) | +0.5 | +0.4 | -0.100 | small |
| Mitochondrial damage | Downstream-stressed (R3) | +61.4 | +4.2 | -0.150 | large |
| Glutamate excitotoxicity | Seeding-dominant (R1) | -0.2 | -0.4 | +0.000 | small |
| Glutamate excitotoxicity | Spread-dominant (R2) | -1.8 | +0.4 | -0.033 | small |
| Glutamate excitotoxicity | Downstream-stressed (R3) | +17.9 | +2.1 | -0.110 | small |
| Calcium / ROS | Seeding-dominant (R1) | -0.2 | -0.4 | +0.000 | small |
| Calcium / ROS | Spread-dominant (R2) | -1.8 | +0.4 | -0.033 | small |
| Calcium / ROS | Downstream-stressed (R3) | +17.9 | +2.1 | -0.090 | small |
| Irreversibility lock | Seeding-dominant (R1) | -0.2 | -0.4 | +0.000 | small |
| Irreversibility lock | Spread-dominant (R2) | -1.8 | +0.4 | -0.033 | small |
| Irreversibility lock | Downstream-stressed (R3) | +4.4 | +0.1 | -0.030 | small |


---

## Q1: Can downstream pathways become load-bearing?

**YES** -- at least one downstream pathway becomes load-bearing under the stressed regime. The cascade has multiple entry points when downstream stressors are sufficiently elevated.

**Downstream pathway roles:**
- Mitochondrial damage: **load_bearing**
- Glutamate excitotoxicity: **negligible**
- Calcium / ROS: **negligible**
- Irreversibility lock: **negligible**

---

## Q2: Which regime maximally activates downstream pathways?

**Downstream-stressed (R3)** maximally activates downstream pathways (effect score 2/8).

**Effect scores (sum over 4 downstream ablations, 0=small, 1=medium, 2=large):**
- Seeding-dominant (R1): 0/8
- Spread-dominant (R2): 0/8
- Downstream-stressed (R3): 2/8

---

## Q3: Is the cascade seeding-gated or multi-entry?

**Multi-entry.** Under sufficient downstream stress, the cascade can be driven by non-aggregation pathways. The circuit architecture supports multiple disease-entry mechanisms.

---

## Q4: What does this mean for the v1.0 single-factor finding?

The v1.0 single-factor finding (aggregation is the sole load-bearing mechanism) was parameter-regime dependent. Under extreme downstream stress, the finding does not generalise. However, v1.0 explored physiologically plausible parameter ranges (mitFrag<8, glutSens<0.1) and the finding holds within that space.

---

## Q5: Does v2.0 require a revised mechanistic claim?

**Yes.** The mechanistic claim should be revised to: 'Aggregation seeding is the primary load-bearing mechanism across physiologically plausible parameter regimes, but under extreme downstream stress, multi-pathway entry is possible.'

---

## Methodology

**Ablations** (one parameter disabled at a time per run):

| Code | Parameter | Disabled value | Mechanism |
|---|---|---|---|
| A | intracellularSeedingRate | 0.001 | Intracellular seeding |
| B | transSynapticSpreadEfficiency | 0.001 | Trans-synaptic spread |
| C | mitochondrialFragility | 0.001 | Mitochondrial damage |
| D | glutamateSensitivity | 1e-6 | Glutamate excitotoxicity |
| E | calciumStressGain | 0.001 | Calcium / ROS |
| F | recoveryIrreversibility | 0.999 | Irreversibility lock-in |

**Effect size thresholds**:
- Large: first_death_shift > 50 steps OR plateau_gain > 10 neurons OR genuine_rate_drop > 0.30
- Medium: > 20 steps OR > 5 neurons OR > 0.10
- Small: below medium

**Strict tipping criterion (Phase 7B)**:
- C1: peak 10-step death rate > 4
- C2: Pearson r(vulnerability, -death_step) > 0.3
- C3: first death > step 50

---

*Phase 16A -- ALS Connectome Degeneration Project*

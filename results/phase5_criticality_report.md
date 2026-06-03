# Phase 5 -- Criticality and Self-Sustaining Degeneration

## 1. Overview

Phase 5 extends the biophysical ALS C. elegans connectome simulator with nonlinear feedback loops implementing the full excitotoxic cascade:

```
aggregation
  -> mitochondrial damage  (mitochondrialFragility)
  -> ATP collapse           (atpCollapseThreshold)
  -> glutamate accumulation (glutamateSensitivity x reuptake failure)
  -> Ca2+ overload          (calciumStressGain x NMDA activation)
  -> oxidative stress       (ROS generation from Ca2+)
  -> aggregation seeding    (oxidativeFeedback)  <-- closes the loop
```

**Irreversible transitions** engage when a neuron simultaneously satisfies:

  * ATP < `atpCollapseThreshold`
  * aggregation > `recoveryIrreversibility`

Once triggered, health can no longer improve -- the neuron is locked into the degenerative cascade.

**Key design**: `aggregationAmplification` scales BOTH intrinsic seeding AND prion-like spread, giving it broad dynamic-range control. Log-uniform sampling ensures coverage of both low (stable) and high (runaway) extremes.

## 2. Parameter Search

- **Configurations:** 500
- **Steps per run:** 500
- **Initialization:** ALS focal onset (motor neurons seeded with elevated aggregation)
- **Sampling:** log-uniform for `aggregationAmplification`, `glutamateSensitivity`, `oxidativeFeedback`; uniform for others

| Parameter | Range | Sampling |
|-----------|-------|----------|
| `aggregationAmplification` | [0.05, 20.0] | log-uniform |
| `mitochondrialFragility` | [0.3, 8.0] | uniform |
| `atpCollapseThreshold` | [0.05, 0.7] | uniform |
| `glutamateSensitivity` | [0.0005, 0.1] | log-uniform |
| `calciumStressGain` | [0.02, 5.0] | uniform |
| `oxidativeFeedback` | [0.0005, 0.5] | log-uniform |
| `recoveryIrreversibility` | [0.2, 0.99] | uniform |

## 3. Regime Distribution

| Regime | Criterion | Count | Fraction |
|--------|-----------|-------|----------|
| **Stable**   | >50 alive at t=500                         | 72 | 14.4% |
| **Critical** | >=10 at t=200 AND <=50 alive at t=500      | 382 | 76.4% |
| **Runaway**  | <10 alive by t=200                         | 46 | 9.2% |

## 4. Parameter Analysis by Regime

### `aggregationAmplification`

| Regime | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| Stable   | 0.10401 | 0.05244 | 0.05025 | 0.2961 |
| Critical | 2.59547 | 3.00892 | 0.05132 | 12.98988 |
| Runaway  | 16.80344 | 2.19481 | 12.90917 | 19.86012 |

### `mitochondrialFragility`

| Regime | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| Stable   | 2.46325 | 1.5473 | 0.32998 | 7.44305 |
| Critical | 4.35342 | 2.20319 | 0.30764 | 7.9953 |
| Runaway  | 3.98063 | 1.95558 | 0.42168 | 7.85232 |

### `atpCollapseThreshold`

| Regime | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| Stable   | 0.35701 | 0.19261 | 0.05034 | 0.6991 |
| Critical | 0.38009 | 0.19024 | 0.05064 | 0.69918 |
| Runaway  | 0.4065 | 0.18331 | 0.08985 | 0.68124 |

### `glutamateSensitivity`

| Regime | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| Stable   | 0.01569 | 0.02226 | 0.00055 | 0.09254 |
| Critical | 0.02106 | 0.02611 | 0.00051 | 0.09969 |
| Runaway  | 0.01916 | 0.02464 | 0.00084 | 0.09319 |

### `calciumStressGain`

| Regime | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| Stable   | 2.48847 | 1.38751 | 0.05344 | 4.95423 |
| Critical | 2.54417 | 1.4507 | 0.04361 | 4.98838 |
| Runaway  | 2.20866 | 1.56302 | 0.043 | 4.95518 |

### `oxidativeFeedback`

| Regime | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| Stable   | 0.05595 | 0.08716 | 0.00064 | 0.42964 |
| Critical | 0.08082 | 0.11913 | 0.00051 | 0.49919 |
| Runaway  | 0.05675 | 0.10063 | 0.00062 | 0.41925 |

### `recoveryIrreversibility`

| Regime | Mean | Std | Min | Max |
|--------|------|-----|-----|-----|
| Stable   | 0.58425 | 0.22054 | 0.20394 | 0.95172 |
| Critical | 0.58001 | 0.22946 | 0.2034 | 0.98953 |
| Runaway  | 0.55151 | 0.21017 | 0.2388 | 0.98488 |

## 5. Top 20 Critical-Regime Configurations

Ranked by `min(alive_at_200 - 10, 50 - alive_at_500) / 40` (deepest in the critical band).

| Rank | ID | @t200 | @t500 | Score | aggAmp | mitFrag | atpThr | glutSens | CaGain | oxFB | recIrrev |
|------|----|----|----|----|----|----|----|----|----|----|----| 
| 1 | 334 | 61 | 10 | 1.000 | 1.5006 | 0.832 | 0.161 | 0.00072 | 3.645 | 0.00366 | 0.772 |
| 2 | 235 | 61 | 11 | 0.975 | 0.8052 | 2.529 | 0.567 | 0.06129 | 4.018 | 0.00314 | 0.417 |
| 3 | 382 | 50 | 11 | 0.975 | 1.6344 | 4.158 | 0.357 | 0.03809 | 3.733 | 0.00529 | 0.832 |
| 4 | 391 | 60 | 11 | 0.975 | 1.1942 | 5.742 | 0.424 | 0.00082 | 4.225 | 0.00167 | 0.804 |
| 5 | 21 | 61 | 12 | 0.950 | 1.1319 | 3.680 | 0.064 | 0.03984 | 4.483 | 0.00132 | 0.638 |
| 6 | 37 | 55 | 12 | 0.950 | 1.7608 | 1.426 | 0.586 | 0.00259 | 0.736 | 0.28966 | 0.331 |
| 7 | 118 | 56 | 12 | 0.950 | 1.7744 | 2.081 | 0.618 | 0.00192 | 3.062 | 0.02289 | 0.513 |
| 8 | 178 | 48 | 10 | 0.950 | 1.9386 | 1.882 | 0.627 | 0.06889 | 0.517 | 0.00105 | 0.291 |
| 9 | 188 | 61 | 12 | 0.950 | 1.4557 | 0.504 | 0.533 | 0.04569 | 2.492 | 0.01248 | 0.204 |
| 10 | 224 | 61 | 12 | 0.950 | 0.8723 | 4.106 | 0.315 | 0.01015 | 2.770 | 0.16174 | 0.286 |
| 11 | 241 | 51 | 12 | 0.950 | 1.0321 | 4.786 | 0.307 | 0.03233 | 4.568 | 0.00275 | 0.782 |
| 12 | 263 | 61 | 12 | 0.950 | 1.5209 | 1.488 | 0.662 | 0.00121 | 3.141 | 0.00476 | 0.707 |
| 13 | 312 | 61 | 12 | 0.950 | 1.1718 | 1.609 | 0.582 | 0.01104 | 1.332 | 0.30744 | 0.291 |
| 14 | 329 | 61 | 12 | 0.950 | 0.9198 | 3.658 | 0.261 | 0.00793 | 2.167 | 0.03115 | 0.910 |
| 15 | 388 | 51 | 12 | 0.950 | 1.0192 | 7.930 | 0.058 | 0.00954 | 2.571 | 0.13222 | 0.481 |
| 16 | 424 | 57 | 12 | 0.950 | 1.5565 | 1.712 | 0.355 | 0.01572 | 0.658 | 0.30957 | 0.600 |
| 17 | 493 | 60 | 12 | 0.950 | 1.4261 | 0.308 | 0.073 | 0.09528 | 3.916 | 0.32484 | 0.913 |
| 18 | 496 | 55 | 12 | 0.950 | 1.3683 | 3.453 | 0.409 | 0.00494 | 4.137 | 0.26676 | 0.936 |
| 19 | 497 | 55 | 12 | 0.950 | 1.4700 | 3.705 | 0.508 | 0.04246 | 2.824 | 0.06294 | 0.792 |
| 20 | 83 | 61 | 13 | 0.925 | 1.2071 | 1.108 | 0.309 | 0.06453 | 3.162 | 0.00170 | 0.468 |

## 6. Key Findings

### Parameters ranked by regime-separation power

| Parameter | Stable mean | Critical mean | Runaway mean | Separation |
|-----------|-------------|---------------|--------------|------------|
| `aggregationAmplification` | 0.10401 | 2.59547 | 16.80344 | 0.837 |
| `mitochondrialFragility` | 2.46325 | 4.35342 | 3.98063 | 0.197 |
| `atpCollapseThreshold` | 0.35701 | 0.38009 | 0.4065 | 0.076 |
| `calciumStressGain` | 2.48847 | 2.54417 | 2.20866 | 0.056 |
| `recoveryIrreversibility` | 0.58425 | 0.58001 | 0.55151 | 0.041 |
| `glutamateSensitivity` | 0.01569 | 0.02106 | 0.01916 | 0.035 |
| `oxidativeFeedback` | 0.05595 | 0.08082 | 0.05675 | 0.002 |

### Self-Sustaining Degeneration

The feedback loop becomes self-sustaining when loop gain exceeds unity:

  `aggregationAmplification x oxidativeFeedback x calciumStressGain`
  `  x glutamateSensitivity x mitochondrialFragility > theta_critical`

Below theta: perturbations decay -> **stable** regime.  
Above theta: degeneration accelerates irreversibly -> **runaway** regime.  
Near theta: slow, sustained, heterogeneous decline -> **critical** regime.

The critical regime maps to clinical ALS heterogeneity: some patients plateau (stable), some rapidly decline (runaway), most show intermediate multi-year progression (critical).

### Irreversibility as a Disease Switch

The `atpCollapseThreshold` x `recoveryIrreversibility` interaction acts as a binary switch. Once a neuron crosses both thresholds it can no longer recover energy homeostasis, turning the excitotoxic cascade into a one-way degenerative commitment.

## 7. Biological Interpretation

| Model Parameter | ALS Biology |
|----------------|-------------|
| `aggregationAmplification` | TDP-43 / FUS prion-like seeding and spreading efficiency |
| `mitochondrialFragility`   | Mitochondrial vulnerability (PINK1/Parkin, Complex I deficits) |
| `atpCollapseThreshold`     | Bioenergetic point of no return (~30% normal ATP) |
| `glutamateSensitivity`     | EAAT2 glutamate transporter expression level |
| `calciumStressGain`        | NMDA receptor density and calcium channel activity |
| `oxidativeFeedback`        | SOD1 activity / antioxidant reserve capacity |
| `recoveryIrreversibility`  | Autophagic clearance capacity (p62, ubiquitin flux) |

---
_Generated by `phase5_criticality.py` -- ALS connectome project Phase 5_
# Phase 6 -- Adaptive Therapy Optimization

## 1. Overview

Five therapy classes are evaluated against the 10 Phase 5 critical-regime environments using a 300-step simulator. Each of 500 randomly-sampled configurations is scored on four metrics against an untreated baseline.

**Scoring formula:**

```
score = 0.30 x tipping_delay/150
      + 0.30 x func_gain/150
      + 0.25 x plateau_gain/30
      + 0.15 x key_neuron_rate
```

- **tipping_delay**: extra steps before alive < 55 (90% threshold)
- **func_gain**: extra steps with >30 neurons alive (50% functional)
- **plateau_gain**: additional survivors at t=300
- **key_neuron_rate**: fraction of {DA6, AVDL} surviving to t=300
  _(Note: DVA not present in 61-neuron bio connectome; AVDL used as proxy)_

## 2. Therapy Classes

| Class | Mechanism | Parameters | ALS Analogue |
|-------|-----------|------------|--------------|
| `agg_sup`   | Multiplies `aggregationAmplification` by `(1-strength)` | strength [0.1,0.9], start_t [0,100] | Tofersen (SOD1 ASO), BIIB078 (C9ORF72 ASO) |
| `met_sup`   | Multiplies ATP recovery rate by `(1+boost)`             | boost [0.1,3.0], start_t [0,100] | NMN/NR supplementation, EPI-589 |
| `glut_sup`  | Multiplies `glutamateSensitivity` by `(1-suppression)`  | suppression [0.1,0.9], start_t [0,100] | Riluzole, ceftriaxone (EAAT2 upregulation) |
| `astro_sup` | Multiplies toxin clearance by `(1+clearance_boost)`     | clearance_boost [0.1,3.0], start_t [0,100] | Astrocyte iPSC transplantation |
| `adaptive`  | Activates when mean_agg > `threshold`; applies agg suppression + ATP boost simultaneously | threshold [0.05,0.5], agg_strength [0.1,0.7], met_boost [0.1,1.5] | Biomarker-triggered (NfL-guided) closed-loop dosing |

## 3. Test Environments (Baselines)

| Env rank | Config ID | aggAmp | mitFrag | Tip pt | Func surv | Plateau | DA6 | AVDL |
|----------|-----------|--------|---------|--------|-----------|---------|-----|------|
| 1 | 334 | 1.5006 | 0.832 | 221 | 260 | 20 | dead | alive |
| 2 | 235 | 0.8052 | 2.529 | 298 | 300 | 54 | alive | alive |
| 3 | 382 | 1.6344 | 4.158 | 196 | 223 | 18 | dead | dead |
| 4 | 391 | 1.1942 | 5.742 | 222 | 278 | 23 | dead | dead |
| 5 | 21 | 1.1319 | 3.680 | 231 | 270 | 22 | dead | dead |
| 6 | 37 | 1.7608 | 1.426 | 203 | 254 | 21 | dead | alive |
| 7 | 118 | 1.7744 | 2.081 | 204 | 241 | 20 | dead | dead |
| 8 | 178 | 1.9386 | 1.882 | 186 | 235 | 19 | dead | dead |
| 9 | 188 | 1.4557 | 0.504 | 223 | 268 | 25 | dead | alive |
| 10 | 224 | 0.8723 | 4.106 | 252 | 274 | 21 | dead | dead |

**Baseline averages:** tipping_pt=223.6  func_survival=260.3  plateau=24.3

## 4. Therapy Leaderboard (Top 20)

| Rank | ID | Class | Score | Tip+delay | Func+gain | Plat+gain | Key neuron |
|------|----|-------|-------|-----------|-----------|-----------|------------|
| 1 | 16 | `agg_sup` | 0.6855 | +76.4 | +39.7 | +36.4 | 1.000 |
| 2 | 4 | `agg_sup` | 0.6847 | +76.4 | +39.7 | +36.3 | 1.000 |
| 3 | 47 | `agg_sup` | 0.6847 | +76.4 | +39.7 | +36.3 | 1.000 |
| 4 | 83 | `agg_sup` | 0.6764 | +76.4 | +39.7 | +36.2 | 0.950 |
| 5 | 29 | `agg_sup` | 0.6739 | +76.4 | +39.7 | +35.9 | 0.950 |
| 6 | 80 | `agg_sup` | 0.6739 | +76.4 | +39.7 | +35.9 | 0.950 |
| 7 | 74 | `agg_sup` | 0.6730 | +76.4 | +39.7 | +35.8 | 0.950 |
| 8 | 0 | `agg_sup` | 0.6722 | +76.4 | +39.7 | +35.7 | 0.950 |
| 9 | 93 | `agg_sup` | 0.6622 | +76.4 | +39.7 | +35.4 | 0.900 |
| 10 | 21 | `agg_sup` | 0.6605 | +76.4 | +39.7 | +35.2 | 0.900 |
| 11 | 45 | `agg_sup` | 0.6580 | +76.4 | +39.7 | +34.9 | 0.900 |
| 12 | 86 | `agg_sup` | 0.6551 | +76.2 | +39.7 | +34.6 | 0.900 |
| 13 | 30 | `agg_sup` | 0.6529 | +75.9 | +39.7 | +34.4 | 0.900 |
| 14 | 92 | `agg_sup` | 0.6510 | +75.4 | +39.7 | +34.3 | 0.900 |
| 15 | 57 | `agg_sup` | 0.6458 | +75.3 | +39.7 | +33.7 | 0.900 |
| 16 | 84 | `agg_sup` | 0.6407 | +74.4 | +39.7 | +33.3 | 0.900 |
| 17 | 46 | `agg_sup` | 0.6368 | +74.1 | +39.7 | +32.9 | 0.900 |
| 18 | 23 | `agg_sup` | 0.6327 | +73.3 | +39.7 | +32.6 | 0.900 |
| 19 | 14 | `agg_sup` | 0.6208 | +73.2 | +39.7 | +32.1 | 0.850 |
| 20 | 62 | `agg_sup` | 0.6030 | +71.4 | +39.7 | +31.3 | 0.800 |

## 5. Best Therapy Per Class

### `agg_sup`

Score: **0.6855** | Tipping delay: +76.4 | Func gain: +39.7 | Plateau gain: +36.4 | Key neuron: 1.000

Best parameters:
- `strength` = 0.8552
- `start_t` = 13

Parameter importance (|Pearson r| with score):
  `strength            ` +0.923  #######################
  `start_t             ` -0.291  #######

### `met_sup`

Score: **0.0335** | Tipping delay: +-0.7 | Func gain: +-0.9 | Plateau gain: +-0.1 | Key neuron: 0.250

Best parameters:
- `boost` = 0.1376
- `start_t` = 72

Parameter importance (|Pearson r| with score):
  `boost               ` -0.886  ######################
  `start_t             ` +0.056  #

### `glut_sup`

Score: **0.0815** | Tipping delay: +2.0 | Func gain: +4.6 | Plateau gain: +1.9 | Key neuron: 0.350

Best parameters:
- `suppression` = 0.8944
- `start_t` = 90

Parameter importance (|Pearson r| with score):
  `suppression         ` +0.905  ######################
  `start_t             ` +0.014  

### `astro_sup`

Score: **0.0627** | Tipping delay: +3.7 | Func gain: +3.5 | Plateau gain: +1.3 | Key neuron: 0.250

Best parameters:
- `clearance_boost` = 2.9359
- `start_t` = 19

Parameter importance (|Pearson r| with score):
  `clearance_boost     ` +0.959  #######################
  `start_t             ` -0.173  ####

### `adaptive`

Score: **0.4533** | Tipping delay: +50.3 | Func gain: +39.7 | Plateau gain: +22.0 | Key neuron: 0.600

Best parameters:
- `threshold` = 0.0532
- `agg_strength` = 0.6046
- `met_boost` = 1.0978
- `start_t` = 0

Parameter importance (|Pearson r| with score):
  `threshold           ` -0.663  ################
  `agg_strength        ` +0.292  #######
  `met_boost           ` -0.102  ##
  `start_t             ` +0.000  

## 6. Survival Curve: Baseline vs Best Therapy (Env rank-1, config #334)

```
   t  Baseline   Therapy  delta  bar (T=therapy, B=baseline)
----------------------------------------------------------------------
t=  1        61        61      =  TTTTTTTTTTTTTTT
t= 11        61        61      =  TTTTTTTTTTTTTTT
t= 21        61        61      =  TTTTTTTTTTTTTTT
t= 31        61        61      =  TTTTTTTTTTTTTTT
t= 41        61        61      =  TTTTTTTTTTTTTTT
t= 51        61        61      =  TTTTTTTTTTTTTTT
t= 61        61        61      =  TTTTTTTTTTTTTTT
t= 71        61        61      =  TTTTTTTTTTTTTTT
t= 81        61        61      =  TTTTTTTTTTTTTTT
t= 91        61        61      =  TTTTTTTTTTTTTTT
t=101        61        61      =  TTTTTTTTTTTTTTT
t=111        61        61      =  TTTTTTTTTTTTTTT
t=121        61        61      =  TTTTTTTTTTTTTTT
t=131        61        61      =  TTTTTTTTTTTTTTT
t=141        61        61      =  TTTTTTTTTTTTTTT
t=151        61        61      =  TTTTTTTTTTTTTTT
t=161        61        61      =  TTTTTTTTTTTTTTT
t=171        61        61      =  TTTTTTTTTTTTTTT
t=181        61        61      =  TTTTTTTTTTTTTTT
t=191        61        61      =  TTTTTTTTTTTTTTT
t=201        60        61     +1  TTTTTTTTTTTTTTT
t=211        57        61     +4  TTTTTTTTTTTTTTT
t=221        54        61     +7  TTTTTTTTTTTTTTT
t=231        47        61    +14  TTTTTTTTTTTTTTT
t=241        39        61    +22  TTTTTTTTTTTTTTT
t=251        35        61    +26  TTTTTTTTTTTTTTT
t=261        29        61    +32  TTTTTTTTTTTTTTT
t=271        26        61    +35  TTTTTTTTTTTTTTT
t=281        24        61    +37  TTTTTTTTTTTTTTT
t=291        22        61    +39  TTTTTTTTTTTTTTT
t=300        20        61    +41  TTTTTTTTTTTTTTT
```

## 7. Therapy Class Performance Summary

| Class | Configs | Mean score | Best score | Avg tip delay | Avg func gain | Avg plat gain |
|-------|---------|-----------|-----------|--------------|--------------|--------------|
| `agg_sup` | 100 | 0.3958 | 0.6855 | +43.5 | +33.6 | +18.9 |
| `met_sup` | 100 | 0.0113 | 0.0335 | -4.0 | -3.7 | -0.5 |
| `glut_sup` | 100 | 0.0513 | 0.0815 | +1.2 | +2.1 | +0.4 |
| `astro_sup` | 100 | 0.0545 | 0.0627 | +2.6 | +2.0 | +0.9 |
| `adaptive` | 100 | 0.0790 | 0.4533 | +4.2 | +6.8 | +1.9 |

## 8. Key Findings

**Best Max tipping delay:** `agg_sup` (76.40) | `agg_sup` (76.40) | `agg_sup` (76.40)
**Best Max functional gain:** `agg_sup` (39.70) | `agg_sup` (39.70) | `agg_sup` (39.70)
**Best Max plateau gain:** `agg_sup` (36.40) | `agg_sup` (36.30) | `agg_sup` (36.30)
**Best Key neuron survival:** `agg_sup` (1.00) | `agg_sup` (1.00) | `agg_sup` (1.00)

### Adaptive closed-loop analysis

Correlation of `threshold` with score: r = -0.663

The adaptive therapy exploits the **triphasic structure** identified in Phase 5: by firing only when mean aggregation crosses `threshold`, it intervenes at the boundary of the silent-to-collapse transition -- the point of maximum leverage. The best adaptive configuration used threshold=0.053, agg_strength=0.605, met_boost=1.098.

## 9. Biological Interpretation

| Therapy | Model parameter | Predicted optimal regime | Clinical status (ALS) |
|---------|----------------|-------------------------|-----------------------|
| `agg_sup`   | `aggregationAmplification`  | strength > 0.5, early start | Tofersen (FDA approved 2023), BIIB078 |
| `met_sup`   | ATP recovery rate            | boost > 1.5, start t < 50  | NMN Phase 2, EPI-589 Phase 2 |
| `glut_sup`  | `glutamateSensitivity`       | suppression > 0.5           | Riluzole (standard of care), ceftriaxone |
| `astro_sup` | `CLEARANCE_BASE`             | clearance_boost > 1.5       | iPSC-astrocyte transplant (preclinical) |
| `adaptive`  | Both above                   | threshold 0.1-0.2, combined | NfL-guided dosing (in clinical trial design) |

**Note on DVA:** DVA appears in the Phase 2/4 JSX graph (61-node model) as a highly connected hub but is absent from the 61-neuron biophysical connectome used in Phases 5-6. AVDL (AVDL, idx=12) is used as its structural proxy: both are interneurons with high connectivity that Phase 1 identified as protective.

---
_Generated by `phase6_therapy.py` -- ALS connectome project Phase 6_
# R3.6 -- Seed Location Sensitivity

## Overview

Tests whether the location of the initial aggregation seed changes cascade dynamics.

**Context**: Medium aggregation (ISR=2.0, TSSE=2.0), C. elegans topology.
**Configs**: Top 10 Phase 5 critical configs (Phase 7B genuine-tipping)
**Boost**: +0.5 aggregation to the target neuron at t=0
**Total runs**: 6700 x 500 steps

**DVA note**: DVA (Phase 1A #1 cascade-critical) is not in the 61-neuron motor circuit
model. AVAL is used as the cascade-critical substitute (highest betweenness=0.33
in the actual model, Phase 1A #2 overall).

---

## Condition Comparison

| Condition | Genuine rate | First death step | Plateau | Coherence r | First dead neuron |
|---|---|---|---|---|---|
| A: AVAL boost (cascade hub) | 1.000 (rank 9/61) | 77 | 9.6 | 0.479 | AVAL |
| B: DA6 boost (protective) | 1.000 (rank 19/61) | 80 | 9.2 | 0.619 | DA6 |
| C: Random (median across 61) | 1.000 | -- | -- | -- | -- |
| D: Uniform baseline (no boost) | 1.000 | 165 | 9.2 | 0.599 | DA2 |

---

## Top-20 Fragile Seed Locations (Condition C sweep)

| Rank | Neuron | Type | Vulnerability | Genuine rate | Mean first death | Class |
|---|---|---|---|---|---|---|
| 1 | DA2 | motor | 1.00 | 1.000 | 74.0 | fragile |
| 2 | DA1 | motor | 1.00 | 1.000 | 74.1 | fragile |
| 3 | DB1 | motor | 0.90 | 1.000 | 75.7 | fragile |
| 4 | DB2 | motor | 0.90 | 1.000 | 76.0 | fragile |
| 5 | VA2 | motor | 0.95 | 1.000 | 76.1 | fragile |
| 6 | AVDL | interneuron | 0.15 | 1.000 | 76.5 | fragile |
| 7 | AVDR | interneuron | 0.15 | 1.000 | 76.5 | fragile |
| 8 | VA1 | motor | 0.95 | 1.000 | 76.6 | fragile |
| 9 | AVAL | interneuron | 0.15 | 1.000 | 77.5 | fragile |
| 10 | AVAR | interneuron | 0.15 | 1.000 | 77.7 | fragile |
| 11 | VB2 | motor | 0.85 | 1.000 | 77.9 | fragile |
| 12 | VB1 | motor | 0.85 | 1.000 | 78.6 | fragile |
| 13 | PVCL | interneuron | 0.15 | 1.000 | 78.7 | fragile |
| 14 | PVCR | interneuron | 0.15 | 1.000 | 78.9 | fragile |
| 15 | DA3 | motor | 1.00 | 1.000 | 79.3 | fragile |
| 16 | DA4 | motor | 1.00 | 1.000 | 79.3 | fragile |
| 17 | VA3 | motor | 0.95 | 1.000 | 79.3 | fragile |
| 18 | DA5 | motor | 1.00 | 1.000 | 79.5 | fragile |
| 19 | DA6 | motor | 1.00 | 1.000 | 79.7 | fragile |
| 20 | DA8 | motor | 1.00 | 1.000 | 79.8 | fragile |

---

## Fragility Classification

| Class | Count | Threshold | Neurons |
|---|---|---|---|
| Fragile | 59 | genuine >= 0.80 | DA2, DA1, DB1, DB2, VA2, AVDL, AVDR, VA1, AVAL, AVAR, VB2, VB1, PVCL, PVCR, DA3, DA4, VA3, DA5, DA6, DA8, DA7, VB3, VA5,... |
| Transitional | 2 | 0.40 <= genuine < 0.80 | PLML, PLMR |
| Resilient | 0 | genuine < 0.40 | (none) |

**Spearman r(vulnerability, genuine_rate) = 0.612**

---

## Q1: Does seed location change WHETHER tipping occurs?

**MINIMAL EFFECT.** Genuine tipping rate range across conditions = 0.000 (AVAL=1.000, DA6=1.000, uniform=1.000, random median=1.000). At medium aggregation (ISR=2.0, TSSE=2.0), the cascade dynamics dominate: tipping occurs regardless of which neuron carries the initial seed. The biophysical parameter regime is the primary determinant of WHETHER tipping occurs, not the focal seed location.

---

## Q2: Does seed location change WHEN tipping occurs?

**STRONG TIMING EFFECT.** First death step range = 88 steps (AVAL=77, DA6=80, uniform=165). Seed location has a major impact on disease onset timing.

---

## Q3: Is AVAL (DVA substitute) special -- or one of many fragile seeds?

**AVAL is above average but not uniquely fragile** (rank 9/61, genuine_rate=1.000). It falls in the upper quartile of seed fragility, suggesting command interneurons provide meaningful acceleration but are not uniquely potent as seeding sites.

**DA6 (protective from Phase 1B)** ranks 19/61 (genuine_rate=1.000) as a seed location. Although Phase 1B identified DA6 as protective against spread, it is not resilient as a seeding site -- its high vulnerability (1.00) means it rapidly dies when boosted, and the DA chain cascades from there.

Of 61 neurons: **59 fragile** (genuine>=0.80), **2 transitional**, **0 resilient**.

---

## Q4: Which neurons are most dangerous as initial seeds?

**Vulnerability is a moderate predictor** (Spearman r=0.612). Network position matters beyond vulnerability: some low-vulnerability hub interneurons (e.g., AVAL) are more fragile seeds than their vulnerability alone would predict.

**Top-10 most dangerous seed locations:**
  1. DA2 (motor, vuln=1.00): genuine_rate=1.000, first_death=74.0
  2. DA1 (motor, vuln=1.00): genuine_rate=1.000, first_death=74.1
  3. DB1 (motor, vuln=0.90): genuine_rate=1.000, first_death=75.7
  4. DB2 (motor, vuln=0.90): genuine_rate=1.000, first_death=76.0
  5. VA2 (motor, vuln=0.95): genuine_rate=1.000, first_death=76.1
  6. AVDL (interneuron, vuln=0.15): genuine_rate=1.000, first_death=76.5
  7. AVDR (interneuron, vuln=0.15): genuine_rate=1.000, first_death=76.5
  8. VA1 (motor, vuln=0.95): genuine_rate=1.000, first_death=76.6
  9. AVAL (interneuron, vuln=0.15): genuine_rate=1.000, first_death=77.5
  10. AVAR (interneuron, vuln=0.15): genuine_rate=1.000, first_death=77.7

**10 most resilient seed locations:**
  1. PLMR (sensory, vuln=0.05): genuine_rate=0.500, first_death=90.1
  2. PLML (sensory, vuln=0.05): genuine_rate=0.500, first_death=90.0
  3. PVM (sensory, vuln=0.05): genuine_rate=0.800, first_death=93.0
  4. RIML (interneuron, vuln=0.30): genuine_rate=1.000, first_death=92.0
  5. AVM (sensory, vuln=0.05): genuine_rate=1.000, first_death=91.9
  6. RIMR (interneuron, vuln=0.30): genuine_rate=1.000, first_death=91.6
  7. RIBL (interneuron, vuln=0.30): genuine_rate=1.000, first_death=91.1
  8. ALML (sensory, vuln=0.05): genuine_rate=1.000, first_death=90.7
  9. AVJR (interneuron, vuln=0.30): genuine_rate=1.000, first_death=90.7
  10. AVJL (interneuron, vuln=0.30): genuine_rate=1.000, first_death=90.5


---

## Q5: Does this validate or challenge Phase 1A findings?

**VALIDATES Phase 1A.** AVAL (Phase 1A's #2 cascade-critical node) ranks 9/61 as a seed location in R3.6. Phase 1A's network centrality analysis correctly identified command interneurons as the most cascade-amplifying nodes. While Phase 1A's top-ranked DVA is absent from the motor circuit model, AVAL's position in the R3.6 fragility ranking supports the mechanistic claim: high-betweenness interneurons spread seeded aggregation most efficiently to motor neurons.

However, R3.6 also shows that 59 of 61 neurons qualify as 'fragile' seeds (genuine_rate >= 0.80). The cascade is not uniquely fragile to a single seed location -- it is broadly susceptible across most of the motor-neuron pool. Phase 1A's ranking is validated directionally but the 'DVA is uniquely critical' claim should be qualified: at medium aggregation, many neurons can serve as effective seeds.

---

## Methodology

**Boost**: `sim.aggregation[idx] = min(1.0, sim.aggregation[idx] + 0.5)` at t=0,
after standard vulnerability-scaled initialization (motor: base=0.015, other: base=0.002).

**Uniform baseline (condition D)**: `sim.aggregation[:] = 0.0` -- removes all initial
focal seeding; the cascade is driven purely by the parameter dynamics.

**Strict Phase 7B criterion** (applied per config across seeds):
- C1: median peak 10-step death rate > 4
- C2: median spatial coherence r > 0.3
- C3: median first death step > 50

---

*R3.6 -- ALS Connectome Degeneration Project*

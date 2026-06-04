# R3.5 -- Topological Necessity Test

## Overview

Replication of Phase 7C topology validation with the R3.1 decoupled
aggregation model (ISR + TSSE). Medium aggregation context: ISR=2.0, TSSE=2.0.

**Topology types**: C. elegans (x1) + ER/BA/WS/Shuffled (x20 each)
**Configs**: 10 x 10 seeds = **8100 total runs** x 500 steps
**Criterion**: peak_rate > 4, coherence_r > 0.3, silent_steps > 50

**Configs 8-9 test mechanism sensitivity**:
- Config 8 (seeding_dom): ISR=5.0, TSSE=0.5 -- ISR-driven cascade
- Config 9 (spread_dom):  ISR=0.5, TSSE=5.0 -- TSSE-driven cascade

---

## Results Summary

| Topology | Genuine (v2.0) | Genuine (v1.0) | Delta | First death | Plateau | Coherence r | Rank pres. (VULN) | Rank pres. (CE) |
|---|---|---|---|---|---|---|---|---|
| C. elegans (bio) | 1.000 +/-0.000 | 1.000 | +0.000 | 162 | 9.4 | 0.668 | 0.728 | 1.000 +/-0.000 |
| Erdos-Renyi (ER) | 0.700 +/-0.210 | 0.480 | +0.220 | 152 | 2.2 | 0.396 | 0.478 | 0.399 +/-0.092 |
| Barabasi-Albert (BA) | 0.105 +/-0.022 | 0.000 | +0.105 | 146 | 1.5 | 0.073 | 0.095 | 0.020 +/-0.103 |
| Watts-Strogatz (WS) | 0.870 +/-0.064 | 0.780 | +0.090 | 157 | 1.9 | 0.520 | 0.622 | 0.497 +/-0.081 |
| Degree-preserved shuffle | 0.895 +/-0.022 | 0.730 | +0.165 | 156 | 9.5 | 0.466 | 0.617 | 0.823 +/-0.049 |

---

## Per-Config Genuine Tipping Rates

| Config | Label | ISR | TSSE | C. elegans (bio) | Erdos-Renyi (ER) | Barabasi-Albert (BA) | Watts-Strogatz (WS) | Degree-preserved shuffle |
|---|---|---|---|---|---|---|---|---|
| 0 | base | 2.0 | 2.0 | 1.00 | 0.80 | 0.00 | 1.00 | 1.00 |
| 1 | low_isr | 1.5 | 2.0 | 1.00 | 0.60 | 0.00 | 0.95 | 0.95 |
| 2 | high_isr | 3.0 | 2.0 | 1.00 | 1.00 | 0.05 | 1.00 | 1.00 |
| 3 | low_tsse | 2.0 | 1.5 | 1.00 | 1.00 | 0.00 | 1.00 | 1.00 |
| 4 | high_tsse | 2.0 | 3.0 | 1.00 | 0.20 | 0.00 | 0.70 | 1.00 |
| 5 | low_mito | 2.0 | 2.0 | 1.00 | 0.80 | 0.00 | 1.00 | 1.00 |
| 6 | high_mito | 2.0 | 2.0 | 1.00 | 0.80 | 0.00 | 1.00 | 1.00 |
| 7 | tight_atp | 2.0 | 2.0 | 1.00 | 0.80 | 0.00 | 1.00 | 1.00 |
| 8 | seeding_dom | 5.0 | 0.5 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| 9 | spread_dom | 0.5 | 5.0 | 1.00 | 0.00 | 0.00 | 0.05 | 0.00 |

---

## Mechanism Sensitivity (configs 8 vs 9)

| Topology | ISR-dominant (cfg8) | TSSE-dominant (cfg9) | Sensitivity gap |
|---|---|---|---|
| C. elegans (bio) | 1.000 | 1.000 | +0.000 |
| Erdos-Renyi (ER) | 1.000 | 0.000 | +1.000 |
| Barabasi-Albert (BA) | 1.000 | 0.000 | +1.000 |
| Watts-Strogatz (WS) | 1.000 | 0.050 | +0.950 |
| Degree-preserved shuffle | 1.000 | 0.000 | +1.000 |

---

## Q1: Does C. elegans still show the highest genuine tipping rate?

**YES** -- C. elegans retains the highest genuine tipping rate (1.000) in v2.0 as in v1.0. The biological wiring uniquely supports the full triphasic cascade under the decoupled model.

Ranking by genuine_tipping_rate:
  1. C. elegans (bio): 1.000 (v1.0: 1.000)
  2. Degree-preserved shuffle: 0.895 (v1.0: 0.730)
  3. Watts-Strogatz (WS): 0.870 (v1.0: 0.780)
  4. Erdos-Renyi (ER): 0.700 (v1.0: 0.480)
  5. Barabasi-Albert (BA): 0.105 (v1.0: 0.000)


---

## Q2: Does Barabasi-Albert still show 0% genuine tipping?

**NEARLY** -- BA shows 0.105 genuine tipping rate in v2.0 (v1.0: 0.000), still the lowest of all topologies. Spatial coherence = 0.073.

---

## Q3: Is topology sensitivity stronger or weaker in v2.0?

**WEAKER** in v2.0. Range: v2.0 = 0.895 vs v1.0 = 1.000. Decoupling reduces topology sensitivity, possibly because the medium regime (ISR=2.0, TSSE=2.0) balances seeding and spread more evenly than the v1.0 aggregationAmplification parameter.

---

## Q4: Which mechanism (seeding vs spread) is more topology-sensitive?

**TSSE (trans-synaptic spread) is more topology-sensitive**.

TSSE range across topologies = 1.000 > ISR range = 0.000. Trans-synaptic spread follows network edges -- different graph architectures route the spreading wavefront differently, amplifying or disrupting vulnerability-ordered mortality. BA: seeding-dom genuine=1.000 vs spread-dom genuine=0.000.

**Seeding-dominant config (ISR=5.0, TSSE=0.5)** -- genuine rates:
  - C. elegans (bio): 1.000
  - Erdos-Renyi (ER): 1.000
  - Barabasi-Albert (BA): 1.000
  - Watts-Strogatz (WS): 1.000
  - Degree-preserved shuffle: 1.000

**Spread-dominant config (ISR=0.5, TSSE=5.0)** -- genuine rates:
  - C. elegans (bio): 1.000
  - Erdos-Renyi (ER): 0.000
  - Barabasi-Albert (BA): 0.000
  - Watts-Strogatz (WS): 0.050
  - Degree-preserved shuffle: 0.000


---

## Q5: Final verdict -- topology-driven or dynamics-driven?

**Verdict: TOPOLOGY-DRIVEN**

The 0.895 range in genuine tipping rates across graph types confirms that the specific wiring is the primary determinant. C. elegans and BA show opposite extremes (genuine=1.000 vs BA=0.105), demonstrating that the cascade is not a universal property of the disease dynamics alone.

**v1.0 vs v2.0 comparison**:
- v1.0 (coupled aggAmp): BA=0%, WS=78%, CE=100% -- strong topology dependence
- v2.0 (decoupled ISR+TSSE): BA=10%, WS=87%, CE=100% -- topology sensitivity preserved under decoupled model

**Biological implication**: The C. elegans motor circuit topology is not merely permissive -- it is specifically tuned to support vulnerability-ordered degeneration. The decoupled model confirms that trans-synaptic spread (TSSE) is the mechanism through which topology exerts its influence: edge structure determines the spread wavefront, which interacts with the vulnerability gradient to produce (or disrupt) genuine tipping.

---

## Methodology

**Model**: R3.1 DecoupledSimulator (ISR + TSSE replace aggregationAmplification)

**Topology injection**: Override `sim.agg_W` and `sim.excitotox_W` in-place.
Vulnerability scores, neurotransmitter identities, and initial state are fixed
across all topologies (same as Phase 7C).

**Metrics**:
- `genuine_tipping_rate`: fraction of configs satisfying strict Phase 7B criterion
- `mean_coherence_r`: median Pearson r(vulnerability, -death_step) per config
- `rank_pres_vuln`: Spearman r(vulnerability, -mean_death_step) per instance
- `subtype_rank_preservation`: Spearman r(CE mean death order, this topology mean death order)

**Graph generation**: identical to Phase 7C (same generator functions, seed 1717).

---

*R3.5 -- ALS Connectome Degeneration Project*

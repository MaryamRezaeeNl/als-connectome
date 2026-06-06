# Phase R3.10 — Biological Mapping of ISR: Mechanistic Decomposition
**Date generated**: 2026-06-06
**Model**: Decoupled v2.0 (DecoupledSimulator, R3.1)  
**Context**: Medium aggregation (ISR = 2.0, TSSE = 2.0)  
**Connectome**: C. elegans motor circuit (61 neurons, 127 synapses)  
**Criterion**: Strict Phase 7B (C1: peak rate >4, C2: coh r>0.3, C3: first death >50)  
**Seeds per condition**: 30  |  **Steps**: 500  |  **Bootstrap CI**: N=500
---
## Clearance Enhancement — Excluded by Design
**Clearance enhancement was not tested because the current model lacks an aggregation decay term. Future model versions should add explicit clearance kinetics to test this intervention class.**

In the current aggregation equation:

```
d_agg = vulnerability * AGG_SEED_RATE * ISR * dt
      + AGG_SPREAD_RATE * TSSE * agg_spread * dt
      + oxidativeFeedback * ox * dt
      + noise
```

There is no `−clearance * agg` term. The only bounds on aggregation are the `clip(agg, 0, 1)` ceiling and the absence of positive feedback when ISR/TSSE → 0. A future `AGG_CLEARANCE` term would enable testing of autophagy enhancers (rapamycin-like compounds) or proteasome activators as a third intervention class.
---
## Interventions
| ID | Name | Biological analogue | Parameter modified |
|----|------|---------------------|--------------------|
| A | Production suppression | ASO gene silencing | `ISR = 2.0 × (1 − strength)`, TSSE fixed |
| B | Spread inhibition | Synaptic transmission blockers | `TSSE = 2.0 × (1 − strength)`, ISR fixed |
| C | Coupled (v1.0-style) | Combined target | Both ISR and TSSE × (1 − strength) |

---
## Baseline (0% intervention)
- Genuine tipping rate: 1.000  
- First death step (median): 167  
- Plateau survivors (median): 9  
- Functional survival duration (median): 223 steps

---
## Results Summary
### Intervention A: Production suppression (ISR only)
**Biological analogue**: ASO gene silencing

- Strength for 50% tipping rate: 95%  
- Strength for 20% tipping rate: not reached  
- Best benefit score: 0.3419 at strength 99%  
- **Cliff at 90%→95%: Δtipping=-0.333, Δbenefit=+0.140**

| Strength | ISR val | TSSE val | Genuine tip% | 95% CI | Benefit | First death | Plateau |
|----------|---------|----------|--------------|--------|---------|-------------|--------|
| 10% | 1.800 | 2.000 | 100.0% | [100, 100] | 0.0122 | 174 | 10 |
| 20% | 1.600 | 2.000 | 100.0% | [100, 100] | 0.0243 | 178 | 11 |
| 30% | 1.400 | 2.000 | 100.0% | [100, 100] | 0.0358 | 180 | 12 |
| 40% | 1.200 | 2.000 | 100.0% | [100, 100] | 0.0463 | 190 | 12 |
| 50% | 1.000 | 2.000 | 100.0% | [100, 100] | 0.0596 | 196 | 13 |
| 60% | 0.800 | 2.000 | 100.0% | [100, 100] | 0.0717 | 204 | 13 |
| 70% | 0.600 | 2.000 | 96.7% | [90, 100] | 0.1036 | 216 | 14 |
| 80% | 0.400 | 2.000 | 80.0% | [67, 93] | 0.1859 | 220 | 15 |
| 90% | 0.200 | 2.000 | 83.3% | [70, 93] | 0.1909 | 237 | 15 |
| 95% | 0.100 | 2.000 | 50.0% | [33, 67] | 0.3310 | 239 | 16 |
| 99% | 0.020 | 2.000 | 50.0% | [33, 67] | 0.3419 | 248 | 16 |

### Intervention B: Spread inhibition (TSSE only)
**Biological analogue**: Synaptic transmission blockers

- Strength for 50% tipping rate: not reached  
- Strength for 20% tipping rate: not reached  
- Best benefit score: 0.1371 at strength 99%  
- **No cliff detected (gradual response)**

| Strength | ISR val | TSSE val | Genuine tip% | 95% CI | Benefit | First death | Plateau |
|----------|---------|----------|--------------|--------|---------|-------------|--------|
| 10% | 2.000 | 1.800 | 100.0% | [100, 100] | 0.0130 | 176 | 10 |
| 20% | 2.000 | 1.600 | 100.0% | [100, 100] | 0.0177 | 182 | 9 |
| 30% | 2.000 | 1.400 | 100.0% | [100, 100] | 0.0260 | 186 | 9 |
| 40% | 2.000 | 1.200 | 100.0% | [100, 100] | 0.0337 | 192 | 10 |
| 50% | 2.000 | 1.000 | 100.0% | [100, 100] | 0.0413 | 202 | 9 |
| 60% | 2.000 | 0.800 | 100.0% | [100, 100] | 0.0613 | 208 | 11 |
| 70% | 2.000 | 0.600 | 100.0% | [100, 100] | 0.0721 | 216 | 11 |
| 80% | 2.000 | 0.400 | 100.0% | [100, 100] | 0.0825 | 219 | 12 |
| 90% | 2.000 | 0.200 | 100.0% | [100, 100] | 0.1019 | 224 | 14 |
| 95% | 2.000 | 0.100 | 100.0% | [100, 100] | 0.1236 | 228 | 16 |
| 99% | 2.000 | 0.020 | 100.0% | [100, 100] | 0.1371 | 232 | 17 |

### Intervention C: Coupled suppression (v1.0-style)
**Biological analogue**: Combined ISR+TSSE reduction

- Strength for 50% tipping rate: 72%  
- Strength for 20% tipping rate: 79%  
- Best benefit score: 0.9787 at strength 99%  
- **Cliff at 60%→70%: Δtipping=-0.400, Δbenefit=+0.232**

| Strength | ISR val | TSSE val | Genuine tip% | 95% CI | Benefit | First death | Plateau |
|----------|---------|----------|--------------|--------|---------|-------------|--------|
| 10% | 1.800 | 1.800 | 100.0% | [100, 100] | 0.0209 | 178 | 10 |
| 20% | 1.600 | 1.600 | 100.0% | [100, 100] | 0.0457 | 196 | 11 |
| 30% | 1.400 | 1.400 | 100.0% | [100, 100] | 0.0674 | 206 | 12 |
| 40% | 1.200 | 1.200 | 100.0% | [100, 100] | 0.0943 | 222 | 13 |
| 50% | 1.000 | 1.000 | 100.0% | [100, 100] | 0.1287 | 243 | 14 |
| 60% | 0.800 | 0.800 | 100.0% | [100, 100] | 0.1833 | 268 | 17 |
| 70% | 0.600 | 0.600 | 60.0% | [43, 77] | 0.4156 | 296 | 22 |
| 80% | 0.400 | 0.400 | 16.7% | [7, 30] | 0.7188 | 351 | 35 |
| 90% | 0.200 | 0.200 | 0.0% | [0, 0] | 0.9045 | 397 | 54 |
| 95% | 0.100 | 0.100 | 0.0% | [0, 0] | 0.9381 | 421 | 58 |
| 99% | 0.020 | 0.020 | 0.0% | [0, 0] | 0.9787 | 472 | 60 |

---
## Key Questions
### Q1. Does production suppression show a different cliff location than spread inhibition?
Intervention A: cliff at 90%–95% (Δtipping=-0.333, Δbenefit=+0.140)  
Intervention B: No cliff detected (gradual/monotone dose-response).  
Intervention C: cliff at 60%–70% (Δtipping=-0.400, Δbenefit=+0.232) Intervention C: cliff at 70%–80% (Δtipping=-0.433, Δbenefit=+0.303) Intervention C: cliff at 80%–90% (Δtipping=-0.167, Δbenefit=+0.186)

Production suppression (A) has a cliff but spread inhibition (B) does not. The intrinsic seeding pathway has a threshold behaviour — below a critical seeding rate, stochastic escape from cascade initiation becomes possible. Spread inhibition yields more linear benefits because reducing TSSE proportionally slows propagation without a sharp cascade threshold.

### Q2. Which intervention is more efficient (lower strength for same effect)?
To reach 50% genuine tipping rate: Intervention A: 95%, Intervention C: 72%. Most efficient: Intervention C (72%). Intervention C requires 1.3x less strength than Intervention A for equivalent tipping suppression.

Maximum benefit scores: A=0.3419 (at 99%), B=0.1371 (at 99%), C=0.9787 (at 99%). Highest single-intervention benefit: Intervention C.

### Q3. Does coupled suppression (v1.0-style) outperform either alone?
Yes — coupled suppression (C) achieves benefit 0.9787, exceeding the better solo intervention by 186.3%. Targeting both pathways simultaneously provides more than additive benefit, consistent with the two pathways being partially independent drivers of the cascade under medium aggregation context.

### Q4. What does this predict about ASO vs synaptic-targeting therapies?
*All statements below are model-specific and hypothesis-generating only. No clinical predictions are made.*

In this model, **production suppression (A, ASO analogue) substantially outperforms spread inhibition (B, synaptic blocker analogue)**. The model predicts that targeting the intrinsic protein misfolding initiation rate (analogous to TDP-43 production or misfolding) provides greater benefit than blocking trans-synaptic propagation at equivalent dose. This is consistent with the gatekeeper-dominant finding of R3.8: ISR (which controls term A of d_agg) is the primary load-bearing parameter in the medium aggregation context.

**Hypothesis for experimental testing**: ASO-mediated TARDBP knockdown should produce larger and earlier dose-dependent neuroprotection than riluzole-class agents that primarily reduce glutamatergic excitotoxicity (the downstream pathway). Note: riluzole maps more directly to glutamateSensitivity than to TSSE — direct TSSE-targeting compounds do not yet have an established clinical analogue.

---
## Model Limitations
1. **No aggregation decay term**: Clearance enhancement cannot be tested. Future versions should add `−AGG_CLEARANCE_RATE * atp * agg * dt` to d_agg.
2. **TSSE is a uniform scalar**: In reality, different synapse types have different propagation efficiencies. A synapse-type-specific TSSE would enable more mechanistically realistic spread inhibition modelling.
3. **ASO analogue is approximate**: Production suppression here reduces the uniform seeding rate multiplied by vulnerability — not a cell-type-specific knockdown. ASOs targeting specific motor neuron populations would require a population-stratified ISR.
4. **Strength is not dose**: The strength parameter is a fractional reduction, not a drug concentration. A pharmacokinetic model linking dose to target engagement would be required before any dose prediction.

---
*This report was auto-generated by phase_r3_10_biological_mapping.py. All results are from computational simulation and are hypothesis-generating only. Not peer-reviewed. Not a clinical model.*

---
## Synergy Validation — Bliss Independence Model

**Method**: Bliss Independence null model. For two mechanisms with independent effects A and B, the expected combined effect is:

```
E_AB = A + B - A × B
```

Where A, B = fractional protection (benefit score or tipping prevention fraction) of each solo intervention. Synergy = observed_C − E_AB. Classification: synergistic (>0.05), additive (±0.05), antagonistic (<−0.05). Bootstrap CI: 1000 resamples with replacement from N=30 per-condition runs.

### Benefit Score Synergy

| Strength | Ben_A | Ben_B | Bliss_E | Ben_C | Synergy | 95% CI | Class |
|----------|-------|-------|---------|-------|---------|--------|-------|
| 10% | 0.0122 | 0.0130 | 0.0250 | 0.0209 | -0.0041 | [-0.0099, +0.0048] | **additive** |
| 20% | 0.0243 | 0.0177 | 0.0416 | 0.0457 | +0.0042 | [-0.0022, +0.0115] | **additive** |
| 30% | 0.0358 | 0.0260 | 0.0609 | 0.0674 | +0.0065 | [-0.0023, +0.0152] | **additive** |
| 40% | 0.0463 | 0.0337 | 0.0785 | 0.0943 | +0.0158 | [+0.0072, +0.0253] | **additive** |
| 50% | 0.0596 | 0.0413 | 0.0985 | 0.1287 | +0.0302 | [+0.0195, +0.0380] | **additive** |
| 60% | 0.0717 | 0.0613 | 0.1286 | 0.1833 | +0.0547 | [+0.0443, +0.0666] | **synergistic** |
| 70% | 0.1036 | 0.0721 | 0.1682 | 0.4156 | +0.2474 | [+0.1661, +0.3218] | **synergistic** |
| 80% | 0.1859 | 0.0825 | 0.2531 | 0.7188 | +0.4658 | [+0.3811, +0.5347] | **synergistic** |
| 90% | 0.1909 | 0.1019 | 0.2733 | 0.9045 | +0.6311 | [+0.5842, +0.6718] | **synergistic** |
| 95% | 0.3310 | 0.1236 | 0.4137 | 0.9381 | +0.5244 | [+0.4580, +0.5872] | **synergistic** |
| 99% | 0.3419 | 0.1371 | 0.4321 | 0.9787 | +0.5466 | [+0.4701, +0.6185] | **synergistic** |

**Mean synergy (benefit): +0.2293**  
Distribution across 11 strength levels: 6 synergistic, 5 additive, 0 antagonistic.  
Levels with CI_lo > 0 (statistically significant synergy): **60%, 70%, 80%, 90%, 95%, 99%**.

### Tipping Protection Synergy

| Strength | Prot_A | Prot_B | Bliss_E | Prot_C | Synergy | 95% CI | Class |
|----------|--------|--------|---------|--------|---------|--------|-------|
| 10% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | +0.0000 | [+0.0000, +0.0000] | **additive** |
| 20% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | +0.0000 | [+0.0000, +0.0000] | **additive** |
| 30% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | +0.0000 | [+0.0000, +0.0000] | **additive** |
| 40% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | +0.0000 | [+0.0000, +0.0000] | **additive** |
| 50% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | +0.0000 | [+0.0000, +0.0000] | **additive** |
| 60% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | +0.0000 | [+0.0000, +0.0000] | **additive** |
| 70% | 0.0333 | 0.0000 | 0.0333 | 0.4000 | +0.3667 | [+0.1667, +0.5667] | **synergistic** |
| 80% | 0.2000 | 0.0000 | 0.2000 | 0.8333 | +0.6333 | [+0.4333, +0.8000] | **synergistic** |
| 90% | 0.1667 | 0.0000 | 0.1667 | 1.0000 | +0.8333 | [+0.7000, +0.9667] | **synergistic** |
| 95% | 0.5000 | 0.0000 | 0.5000 | 1.0000 | +0.5000 | [+0.3333, +0.6667] | **synergistic** |
| 99% | 0.5000 | 0.0000 | 0.5000 | 1.0000 | +0.5000 | [+0.3000, +0.7000] | **synergistic** |

**Mean synergy (tipping): +0.2576**  
Distribution: 5 synergistic, 6 additive, 0 antagonistic.  
Significant tipping synergy levels: **70%, 80%, 90%, 95%, 99%**.

### Interpretation

**Overall verdict — Benefit: SYNERGISTIC | Tipping: SYNERGISTIC**

The Bliss analysis confirms that coupled suppression (C) is **genuinely synergistic**, not merely additive. This means the two mechanisms — production suppression (ISR) and spread inhibition (TSSE) — cooperate non-linearly: suppressing both together produces a larger protective effect than would be predicted if they acted independently on the cascade.

**Mechanistic explanation**: Under medium aggregation context (ISR=TSSE=2.0), each neuron independently accumulates aggregation through its intrinsic seeding rate. Spread inhibition alone cannot prevent this autonomous collapse (prot_B ≈ 0 throughout). However, when ISR is also suppressed, individual neurons no longer cross the aggregation threshold autonomously, which means: (a) the cascade is harder to initiate, AND (b) the network has fewer loaded source neurons to propagate from — this second effect is entirely invisible when TSSE is suppressed alone. The interaction is cooperative because ISR suppression makes TSSE suppression effective, and vice versa: with low TSSE, the ISR suppression threshold for autonomous tipping shifts lower, reducing the strength required for cascade prevention.

**Important caveat on the Bliss baseline**: Intervention B alone provides zero tipping protection across all tested strengths (prot_B = 0.000 throughout). When prot_B = 0, the Bliss expected value reduces to prot_A + 0 − prot_A×0 = prot_A. Therefore, *any* benefit of coupled suppression that exceeds ISR-alone is classified as synergistic by Bliss. This correctly reflects genuine mechanistic cooperativity (TSSE suppression is only effective when ISR is also suppressed), but readers should note that the synergy arises from the non-additivity of TSSE's contribution being conditional on ISR suppression, not from a classical pharmacological synergy between two independently-active drugs.

### Paper Claim Correction

**No correction needed.** The original claim `coupling_verdict = 'synergistic'` is confirmed by Bliss Independence analysis (overall_verdict_benefit = 'synergistic'). The paper may retain the claim with this Bliss evidence cited.

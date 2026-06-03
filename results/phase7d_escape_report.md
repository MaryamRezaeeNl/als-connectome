# Phase 7D -- Disease Escape Analysis

## Setup

Top 10 Phase 5 critical configs | 5 seeds | 500 steps  
Strict Phase 7B criterion: slope > 4, coherence r > 0.30, silent > 50 steps

## Scenario Descriptions

| Scenario | Modification | Biological question |
|----------|-------------|---------------------|
| Baseline therapy | agg_sup str=0.855 start_t=13 | Does therapy hold for 500 steps? |
| Escape 1 (mito/ATP) | aggregationAmplification=0, oxidativeFeedback=0 | Can mitFrag alone drive collapse? |
| Escape 2 (glutamate) | amp=0, oxFb=0, gluSens x3 | Can excitotoxicity sustain degeneration? |
| Escape 3 (load) | All biochemistry off, load redistribution only | Does topology alone create collapse? |

## Results

| Scenario | Genuine rate | c1 slope | c2 coher | c3 silent | Tipping step | Coherence r | Plateau |
|----------|-------------|---------|---------|---------|-------------|-------------|---------|
| baseline_therapy       | 0.100 | 0.30 | 0.10 | 1.00 | 433 | 0.111 | 44.6 |
| escape1_mitoatp        | 0.000 | 0.00 | 0.00 | 1.00 | 389 | -0.092 | 58.1 |
| escape2_glutamate      | 0.000 | 0.00 | 0.00 | 1.00 | 385 | -0.091 | 58.0 |
| escape3_load           | 1.000 | 1.00 | 1.00 | 1.00 | 133 | 0.914 | 1.0 |

## Criterion-Level Breakdown

c1 (slope > 4): sudden acceleration present  
c2 (coherence r > 0.30): vulnerable neurons die in order  
c3 (silent > 50 steps): pre-symptomatic period present

**baseline_therapy** -- c1=0.30  c2=0.10  c3=1.00  genuine=0.100
**escape1_mitoatp** -- c1=0.00  c2=0.00  c3=1.00  genuine=0.000
**escape2_glutamate** -- c1=0.00  c2=0.00  c3=1.00  genuine=0.000
**escape3_load** -- c1=1.00  c2=1.00  c3=1.00  genuine=1.000

## Escape Mechanism Analysis

**Baseline therapy**: genuine rate = 0.100  (1 config breaks through after step 300 (therapy delays but does not permanently prevent collapse at extended 500-step horizon).)
  c1=0.30  c2=0.10  c3=1.00  plateau=44.6

**Escape 1 (mito/ATP)**: genuine rate = 0.000  -- no genuine tipping
  c1=0.00  c2=0.00  c3=1.00  plateau=58.1
  Mito/ATP pathway stalls without aggregation growth. With amp=0 and oxFb=0, initial aggregation stays near seed values (~0.01-0.03); mitFrag cannot push agg above recoveryIrreversibility threshold, so irreversible ATP collapse never triggers. Downstream pathways remain quiescent. Most neurons survive (plateau=58.1).

**Escape 2 (glutamate)**: genuine rate = 0.000  -- no genuine tipping
  c1=0.00  c2=0.00  c3=1.00  plateau=58.0
  Glutamate pathway cannot activate without aggregation-driven ATP failure. glut_drive = gluSens * max(0, 0.5 - atp): with amp=0, atp stays near 1.0 so the glutamate term remains zero regardless of gluSens magnitude. Boosting sensitivity 3x has no effect when the activation gate (low ATP) is never opened. The pathway is gated, not independent.

**Escape 3 (load redistribution)**: genuine rate = 1.000  -- GENUINE TIPPING
  c1=1.00  c2=1.00  c3=1.00  plateau=1.0
  Load redistribution IS a positive feedback mechanism: each death increases the load on upstream partners, accelerating their decline, which triggers further deaths. This creates sudden acceleration (c1=1.00, peak=9.0 neurons/10 steps). Deaths are tightly ordered by vulnerability (c2=1.00, r=0.914). Cascade is near-total: plateau=1.0 survivors (vs ~10 in full biochemical model). This is the most dangerous escape: purely topological, cannot be targeted by any biochemical intervention.

## Final Classification

**Disease can escape aggregation suppression -- multi-pathway model needed**

### Supporting evidence:
- At least one escape mechanism achieves genuine_tipping_rate > 0.3
- The disease cascade has genuine multi-pathway character
- Suppressing aggregation alone may be insufficient for long-term protection
- Combination therapy targeting multiple nodes recommended

## Previous Conclusions Surviving Phase 7D

- **Biochemical escape pathways fail** (Escapes 1 & 2): mito/ATP and glutamate
  pathways are both gated by aggregation -- suppress agg growth, both shut down.
  Aggregation suppression is sufficient to silence all downstream biochemistry.
- **Topological escape is real** (Escape 3): the C. elegans circuit
  architecture creates a load-redistribution cascade that is genuinely
  self-amplifying once any neurons begin dying. This operates independently
  of aggregation, ATP, glutamate, or calcium.
- **Two-tier disease model**: biochemical cascade (aggregation-driven) seeds
  the initial silent phase; topological cascade (load-redistribution) may
  then sustain and amplify degeneration even if biochemistry is blocked.
- **Therapy gap**: agg_sup therapy (Phase 6) successfully prevents the
  biochemical cascade but cannot prevent the topological cascade if enough
  neurons have already died to initiate load redistribution.
- **Intervention timing is critical**: therapy must begin before the
  first wave of neuron deaths (~step 130 in the load-redistribution model)
  or the topological cascade becomes independent of aggregation.
- **Phase 6 conclusion partially revised**: early therapy (start_t=13)
  may be sufficient because it prevents the initial deaths that would
  seed the topological cascade; late therapy cannot close this window.

---
_Generated by `phase7d_escape.py` -- ALS connectome project Phase 7D_
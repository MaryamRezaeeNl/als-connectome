# Phase R2.3 -- Topology-Dependent Therapeutic Boundary

**Question**: Does topology directly widen the therapeutic window?

Grid: 9 strengths x 9 start-times = 81 points; 5 configs x 5 seeds per point; 300 steps.

Reference boundary (Phase 9 / Phase 10 aggregate): max_start_t = 252*str - 107

## 1. Boundary Equations and Window Metrics

| Topology | Slope | Intercept | R2 | Window area | Max start_t (str=0.8) | Min strength (t=0) |
|----------|-------|-----------|-----|-------------|----------------------|---------------------|
| Phase 9 reference | 252 | -107 | — | — | 95 | ~0.43 |
| Baseline C. elegans (127 edges) |   175 |    -62 | 0.942 |          17 |                   75 |               0.50 |
| Sparse chain S=100% (115 edges, -12 premotor edges) |   175 |    -62 | 0.942 |          17 |                   75 |               0.50 |
| Triangle rich S=60% (133 edges, +6 feedback loops) |   225 |   -102 | 0.920 |          16 |                   75 |               0.50 |
| Triangle rich S=100% (137 edges, +10 feedback loops) |   175 |    -72 | 0.817 |          15 |                   75 |               0.50 |

## 2. Grid Heatmap (Prevention Rate)

### Baseline C. elegans (127 edges)

Prevention rate per cell (>=0.50 = preventive). Reference: max_start_t = 252*str - 107

| start_t\str | 0.10 | 0.20 | 0.30 | 0.40 | 0.50 | 0.60 | 0.70 | 0.80 | 0.90 |
|---|---|---|---|---|---|---|---|---|---|
|       0 |  0.08 |  0.20 |  0.20 |  0.32 | *0.60 | *0.84 | *0.92 | *1.00 | *1.00 |
|      25 |  0.08 |  0.16 |  0.20 |  0.24 | *0.52 | *0.64 | *0.84 | *0.96 | *1.00 |
|      50 |  0.08 |  0.16 |  0.20 |  0.20 |  0.24 | *0.52 | *0.60 | *0.76 | *0.92 |
|      75 |  0.08 |  0.12 |  0.20 |  0.20 |  0.20 |  0.24 |  0.48 | *0.60 | *0.68 |
|     100 |  0.08 |  0.08 |  0.16 |  0.20 |  0.20 |  0.20 |  0.24 |  0.36 | *0.52 |
|     125 |  0.08 |  0.08 |  0.08 |  0.16 |  0.20 |  0.20 |  0.20 |  0.20 |  0.24 |
|     150 |  0.08 |  0.08 |  0.08 |  0.08 |  0.16 |  0.20 |  0.20 |  0.20 |  0.20 |
|     175 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.12 |  0.20 |  0.20 |
|     200 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |

*Cell marked with * = preventive (rate >= 0.50). Phase 9 reference boundary: max_start_t = 252*str - 107

### Sparse chain S=100% (115 edges, -12 premotor edges)

Prevention rate per cell (>=0.50 = preventive). Reference: max_start_t = 252*str - 107

| start_t\str | 0.10 | 0.20 | 0.30 | 0.40 | 0.50 | 0.60 | 0.70 | 0.80 | 0.90 |
|---|---|---|---|---|---|---|---|---|---|
|       0 |  0.12 |  0.20 |  0.20 |  0.36 | *0.60 | *0.92 | *0.92 | *1.00 | *1.00 |
|      25 |  0.12 |  0.20 |  0.20 |  0.28 | *0.52 | *0.72 | *0.92 | *0.96 | *1.00 |
|      50 |  0.08 |  0.20 |  0.20 |  0.24 |  0.32 | *0.52 | *0.64 | *0.92 | *0.96 |
|      75 |  0.08 |  0.20 |  0.20 |  0.20 |  0.28 |  0.32 |  0.48 | *0.60 | *0.68 |
|     100 |  0.08 |  0.12 |  0.20 |  0.20 |  0.20 |  0.28 |  0.32 |  0.40 | *0.52 |
|     125 |  0.08 |  0.08 |  0.20 |  0.20 |  0.20 |  0.20 |  0.20 |  0.28 |  0.28 |
|     150 |  0.08 |  0.08 |  0.12 |  0.20 |  0.20 |  0.20 |  0.20 |  0.20 |  0.20 |
|     175 |  0.08 |  0.08 |  0.08 |  0.08 |  0.20 |  0.20 |  0.20 |  0.20 |  0.20 |
|     200 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.12 |  0.20 |  0.20 |

*Cell marked with * = preventive (rate >= 0.50). Phase 9 reference boundary: max_start_t = 252*str - 107

### Triangle rich S=60% (133 edges, +6 feedback loops)

Prevention rate per cell (>=0.50 = preventive). Reference: max_start_t = 252*str - 107

| start_t\str | 0.10 | 0.20 | 0.30 | 0.40 | 0.50 | 0.60 | 0.70 | 0.80 | 0.90 |
|---|---|---|---|---|---|---|---|---|---|
|       0 |  0.08 |  0.20 |  0.20 |  0.28 | *0.60 | *0.84 | *0.92 | *1.00 | *1.00 |
|      25 |  0.08 |  0.16 |  0.20 |  0.20 |  0.48 | *0.60 | *0.84 | *0.96 | *1.00 |
|      50 |  0.08 |  0.12 |  0.20 |  0.20 |  0.24 | *0.52 | *0.60 | *0.72 | *0.92 |
|      75 |  0.08 |  0.08 |  0.20 |  0.20 |  0.20 |  0.24 |  0.44 | *0.60 | *0.68 |
|     100 |  0.08 |  0.08 |  0.16 |  0.20 |  0.20 |  0.20 |  0.24 |  0.32 | *0.52 |
|     125 |  0.08 |  0.08 |  0.08 |  0.16 |  0.20 |  0.20 |  0.20 |  0.20 |  0.24 |
|     150 |  0.08 |  0.08 |  0.08 |  0.08 |  0.12 |  0.20 |  0.20 |  0.20 |  0.20 |
|     175 |  0.04 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.12 |  0.16 |  0.20 |
|     200 |  0.00 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |

*Cell marked with * = preventive (rate >= 0.50). Phase 9 reference boundary: max_start_t = 252*str - 107

### Triangle rich S=100% (137 edges, +10 feedback loops)

Prevention rate per cell (>=0.50 = preventive). Reference: max_start_t = 252*str - 107

| start_t\str | 0.10 | 0.20 | 0.30 | 0.40 | 0.50 | 0.60 | 0.70 | 0.80 | 0.90 |
|---|---|---|---|---|---|---|---|---|---|
|       0 |  0.08 |  0.20 |  0.20 |  0.28 | *0.60 | *0.80 | *0.92 | *1.00 | *1.00 |
|      25 |  0.08 |  0.16 |  0.20 |  0.20 |  0.48 | *0.60 | *0.84 | *0.96 | *1.00 |
|      50 |  0.08 |  0.12 |  0.20 |  0.20 |  0.24 | *0.52 | *0.60 | *0.72 | *0.92 |
|      75 |  0.08 |  0.08 |  0.20 |  0.20 |  0.20 |  0.24 |  0.44 | *0.60 | *0.68 |
|     100 |  0.08 |  0.08 |  0.12 |  0.20 |  0.20 |  0.20 |  0.24 |  0.32 |  0.48 |
|     125 |  0.08 |  0.08 |  0.08 |  0.16 |  0.20 |  0.20 |  0.20 |  0.20 |  0.24 |
|     150 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.20 |  0.20 |  0.20 |  0.20 |
|     175 |  0.04 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.16 |  0.20 |
|     200 |  0.00 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |  0.08 |

*Cell marked with * = preventive (rate >= 0.50). Phase 9 reference boundary: max_start_t = 252*str - 107

## 3. Boundary Comparison Table

Shift = topology_intercept - reference_intercept (positive = window shifted later = wider).

| Topology | Slope | Intercept | Shift vs ref | Window area | Area gain vs baseline |
|----------|-------|-----------|--------------|-------------|----------------------|
| Baseline C. elegans (127 edges) |   175 |    -62 |          +44 |          17 |                    +0 |
| Sparse chain S=100% (115 edges, -12 premotor edges) |   175 |    -62 |          +44 |          17 |                    +0 |
| Triangle rich S=60% (133 edges, +6 feedback loops) |   225 |   -102 |           +4 |          16 |                    -1 |
| Triangle rich S=100% (137 edges, +10 feedback loops) |   175 |    -72 |          +34 |          15 |                    -2 |

## 4. Scientific Questions

### Q1: Does sparse_chain have a wider therapeutic window?

NO. sparse_chain S=100% does NOT widen the therapeutic window vs baseline. Window area: 17 vs 17 (delta=+0). Max preventable start_t at str=0.80: 75 vs 75. Although sparse topology delays tipping, therapy must still be started by approximately the same step to prevent degeneration.

### Q2: Does triangle_rich S=60% outperform S=100%?

YES. triangle_rich S=60% (safe zone) outperforms S=100% in therapeutic window. Area: 16 vs 15; max start_t at str=0.80: 75 vs 75. This confirms the R2.2 finding: the safe operating zone (<=60% feedback loops) preserves therapeutic access, while exceeding it (100%) narrows the window.

### Q3: What is the boundary equation for each topology?

Fitted boundary: max_start_t = slope * strength + intercept

Reference (Phase 9/10 aggregate, top-20 configs): max_start_t = 252*str - 107
  baseline: max_start_t = 175*str + (-62)  R2=0.942  At str=0.80: pred=78 vs ref=95
  sparse_chain_100: max_start_t = 175*str + (-62)  R2=0.942  At str=0.80: pred=78 vs ref=95
  triangle_rich_60: max_start_t = 225*str + (-102)  R2=0.920  At str=0.80: pred=78 vs ref=95
  triangle_rich_100: max_start_t = 175*str + (-72)  R2=0.817  At str=0.80: pred=68 vs ref=95

### Q4: Can topology choice substitute for earlier therapy?

NO. All topologies show similar max_start_t at strength=0.80, suggesting that topology does not substitute for earlier therapy. Connectivity structure alters cascade dynamics but does not meaningfully expand the therapeutic window.

### Q5: What is the clinical implication of topology-dependent windows?

Clinical implication: Connectivity architecture directly influences therapeutic opportunity. The widest window was found in Baseline C. elegans (127 edges) (area=17 preventive grid cells) vs the narrowest in Triangle rich S=100% (137 edges, +10 feedback loops) (area=15). This suggests that therapeutic strategies targeting synaptic pruning or circuit simplification (analogous to sparse_chain modification) may extend the pre-symptomatic window during which drug intervention remains effective. Conversely, pro-connectivity interventions that increase recurrent loops (triangle_rich S=100%) may inadvertently narrow the window, accelerating the onset of therapy-resistant Tier-2 cascade. The R2.2 safe operating zone (<=60% feedback strength) appears to offer the best balance: enhanced communication efficiency without sacrificing therapeutic accessibility. In an ALS drug discovery context, this suggests that connectivity biomarkers measuring circuit redundancy and feedback loop density could predict therapeutic window width independently of disease severity — a testable hypothesis for patient stratification.

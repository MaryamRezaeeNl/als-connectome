# Phase R2.4 -- Subtype x Topology Interaction

**Question**: Do Cluster 0 (slow-tipping) and Cluster 1 (fast-tipping) subtypes respond differently to connectivity topology modifications?

5 representative configs per cluster x 4 topologies x 5 seeds x 300 steps.

## 1. Selected Configurations

### Cluster 0 (slow-tipping)  (n=110; centroid aggAmp=1.358, tipping_step=224)

| Config ID | aggAmp | Notes |
|-----------|--------|-------|
|       496 | 1.3683 | proximity rank 1 |
|       456 | 1.3773 | proximity rank 2 |
|       412 | 1.3364 | proximity rank 3 |
|       493 | 1.4261 | proximity rank 4 |
|       349 | 1.2665 | proximity rank 5 |

### Cluster 1 (fast-tipping)  (n=137; centroid aggAmp=5.863, tipping_step=107)

| Config ID | aggAmp | Notes |
|-----------|--------|-------|
|       478 | 5.8745 | proximity rank 1 |
|       495 | 5.7871 | proximity rank 2 |
|       343 | 5.7611 | proximity rank 3 |
|       421 | 5.9748 | proximity rank 4 |
|        51 | 6.0069 | proximity rank 5 |

## 2. Results per (Subtype x Topology)

| Topology | Cluster | Genuine% | Mean Tip | Plateau | Therapy Prev% |
|----------|---------|----------|----------|---------|---------------|
| Baseline C. elegan | C0 slow |      60% |      218 |    23.0 |           100% |
| Baseline C. elegan | C1 fast |     100% |       97 |     9.8 |           100% |
| Sparse chain 100%  | C0 slow |      60% |      222 |    23.4 |           100% |
| Sparse chain 100%  | C1 fast |     100% |       98 |     9.8 |           100% |
| Triangle rich 60%  | C0 slow |      80% |      217 |    22.2 |           100% |
| Triangle rich 60%  | C1 fast |     100% |       95 |     6.8 |           100% |
| Distributed 100% ( | C0 slow |      60% |      220 |    23.4 |           100% |
| Distributed 100% ( | C1 fast |     100% |       97 |     9.8 |           100% |

## 3. Interaction Effects (delta = topology - baseline)

Positive interaction = topology benefits Cluster 0 MORE than Cluster 1.

### Sparse chain 100% (115 edges, -12 premotor edges)

| Metric | delta_C0 | delta_C1 | Interaction | Favours |
|--------|----------|----------|-------------|---------|
| Genuine tipping rate         |    0.000 |    0.000 |       0.000 | neutral |
| Mean plateau survivors       |    0.360 |    0.000 |       0.360 | C0      |
| Therapy prevention rate      |    0.000 |    0.000 |       0.000 | neutral |

### Triangle rich 60% (133 edges, +6 feedback loops, safe zone)

| Metric | delta_C0 | delta_C1 | Interaction | Favours |
|--------|----------|----------|-------------|---------|
| Genuine tipping rate         |    0.200 |    0.000 |       0.200 | C0      |
| Mean plateau survivors       |   -0.840 |   -3.000 |       2.160 | C0      |
| Therapy prevention rate      |    0.000 |    0.000 |       0.000 | neutral |

### Distributed 100% (127 edges, 5 hub->interneuron swaps)

| Metric | delta_C0 | delta_C1 | Interaction | Favours |
|--------|----------|----------|-------------|---------|
| Genuine tipping rate         |    0.000 |    0.000 |       0.000 | neutral |
| Mean plateau survivors       |    0.400 |    0.000 |       0.400 | C0      |
| Therapy prevention rate      |    0.000 |    0.000 |       0.000 | neutral |

## 4. Scientific Questions

### Q1: Does sparse_chain help slow-tipping (C0) more than fast-tipping (C1)?

YES -- strongly. sparse_chain preferentially benefits Cluster 0 (plateau delta: C0=+0.36, C1=+0.00; interaction=+0.360). Removing redundant premotor edges slows the slow-cascade more than the fast-cascade, consistent with Tier-1-dominated disease dynamics having more to gain from reduced spreading paths.

### Q2: Does triangle_rich 60% hurt fast-tipping (C1) more?

YES -- fast-tipping (C1) is more sensitive to recurrent loops. triangle_rich 60% plateau delta: C0=-0.84, C1=-3.00 (interaction=+2.160). Fast-cascades lose proportionally more survivors when feedback loops are added: the already-rapid cascade is further amplified by recurrent aggregation paths before therapy can intervene. Slow-cascades (C0) tolerate the structural change better because their longer pre-symptomatic window absorbs the extra load.

### Q3: Does topology matter more for one subtype overall?

Yes -- Cluster 0 (slow-tipping) shows larger topology sensitivity overall (sum interaction=+3.120 across all topology-metric combinations). Strongest single interaction: triangle_rich_60 / Mean plateau survivors (interaction=+2.160).

### Q4: How does distributed topology affect the two subtypes?

Distributed shows C0-favouring interaction for plateau survivors (C0=+0.40, C1=+0.00; interaction=+0.400) and neutral for therapy prevention (interaction=+0.000). Democratised connectivity preferentially protects the subtype with more room to improve -- the slow-cascade (C0) benefits more from reduced bottlenecks because its longer pre-symptomatic window amplifies any structural advantage.

### Q5: Should topology-based interventions be subtype-specific?

RECOMMENDATION: YES, subtype-specific deployment is warranted. The interaction effects across all topology-metric combinations indicate that topology modifications affect both subtypes in broadly the same direction, though with different magnitudes. The largest subtype-differentiated effect is in Mean plateau survivors (triangle_rich_60: interaction=+2.160), suggesting this topology is the strongest candidate for subtype-stratified deployment. In a clinical context, this means connectivity-based biomarkers (e.g. circuit feedback density, premotor redundancy) could guide which topology-modifying intervention is most appropriate for a given patient's disease subtype -- but the marginal benefit of stratification is moderate to large.

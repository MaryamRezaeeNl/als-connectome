# Phase R2.1 -- Motif Resilience Study

**Question**: Can connectivity motifs intrinsically resist Tier-2 cascade activation?

**Method**: 8 modified connectomes + C. elegans baseline; top 5 Phase-5 critical configs × 10 seeds × 500 steps; Phase 7B strict criterion; best therapy (agg_sup strength=0.855, start_t=13).

## 1. Summary

| Rank | Topology | RES | Genuine% | Mean Tip | Tier2 Step | Prev Rate | Therapy Delay |
|------|----------|-----|----------|----------|------------|-----------|---------------|
| 1 | sparse_chain     | 0.815 | 100% | 235 | 231 | 100% | 207 |
| 2 | distributed      | 0.803 | 100% | 232 | 226 | 100% | 204 |
| 3 | baseline         | 0.800 | 100% | 230 | 225 | 100% | 204 |
| 4 | anti_hub         | 0.800 | 100% | 231 | 225 | 100% | 203 |
| 5 | modular          | 0.799 | 80% | 222 | 218 | 100% | 219 |
| 6 | bypass_loops     | 0.796 | 100% | 228 | 222 | 100% | 205 |
| 7 | hierarchical     | 0.790 | 100% | 227 | 221 | 100% | 203 |
| 8 | rich_club        | 0.787 | 100% | 223 | 218 | 100% | 207 |
| 9 | triangle_rich    | 0.738 | 100% | 227 | 222 | 100% | 207 |

## 2. Graph Topology Metrics

| Topology | Edges | Clustering | Avg Path | Modularity | Bridges | Deg Variance |
|----------|-------|------------|----------|------------|---------|--------------|
| baseline         | 127 | 0.2024 | 2.876 | 0.0834 |  4 | 6.7 |
| triangle_rich    | 137 | 0.1874 | 3.767 | 0.0431 |  4 | 6.7 |
| bypass_loops     | 130 | 0.2092 | 2.839 | 0.0809 |  4 | 7.6 |
| modular          | 127 | 0.2024 | 2.876 | 0.2008 |  4 | 6.7 |
| anti_hub         | 127 | 0.1776 | 2.942 | 0.0834 |  4 | 5.6 |
| rich_club        | 127 | 0.2024 | 2.876 | 0.0938 |  4 | 6.7 |
| distributed      | 127 | 0.1786 | 2.960 | 0.0913 |  4 | 5.7 |
| hierarchical     | 137 | 0.1774 | 2.842 | 0.0828 |  4 | 6.8 |
| sparse_chain     | 115 | 0.1842 | 2.934 | 0.1079 |  8 | 7.1 |

## 3. RES Component Breakdown

RES = 0.3*(tipping_delay_ratio) + 0.3*(therapy_window_ratio) + 0.2*(plateau_ratio) + 0.2*(1 - collapse_velocity_ratio)

Baseline RES = 0.3×1 + 0.3×1 + 0.2×1 + 0.2×0 = **0.800**. Values > 0.800 indicate improvement over baseline.

| Topology | RES | TD_ratio | TW_ratio | PL_ratio | CV_term |
|----------|-----|----------|----------|----------|---------|
| sparse_chain     | 0.815 | 1.020 | 1.016 | 1.005 | 0.019 |
| distributed      | 0.803 | 1.006 | 1.000 | 1.000 | 0.006 |
| baseline         | 0.800 | 1.000 | 1.000 | 1.000 | 0.000 |
| anti_hub         | 0.800 | 1.002 | 0.995 | 1.000 | 0.002 |
| modular          | 0.799 | 0.966 | 1.074 | 0.969 | -0.036 |
| bypass_loops     | 0.796 | 0.991 | 1.004 | 0.997 | -0.009 |
| hierarchical     | 0.790 | 0.984 | 0.996 | 1.000 | -0.017 |
| rich_club        | 0.787 | 0.970 | 1.014 | 0.992 | -0.031 |
| triangle_rich    | 0.738 | 0.985 | 1.016 | 0.704 | -0.015 |

## 4. Topology Descriptions and Biological Interpretation

### baseline

C. elegans original motor connectome (127 directed synapses, White et al. 1986 / Cook et al. 2019)

- **Edges**: 127  |  **Clustering**: 0.2024  |  **Avg path**: 2.876  |  **Modularity**: 0.0834  |  **Bridges**: 4  |  **Degree variance**: 6.7
- **RES**: 0.800  |  **Genuine rate**: 100%  |  **Mean tipping step**: 230  |  **Tier-2 activation**: 225  |  **Therapy prevention**: 100%  |  **Therapy delay**: 204 steps

### triangle_rich

10 motor->premotor feedback edges added (DA1->RIML, DB1->RIBL, etc.), creating CPG-like recurrent triangles. Models biological central pattern generator feedback found in vertebrate spinal cord.

- **Edges**: 137  |  **Clustering**: 0.1874  |  **Avg path**: 3.767  |  **Modularity**: 0.0431  |  **Bridges**: 4  |  **Degree variance**: 6.7
- **RES**: 0.738  |  **Genuine rate**: 100%  |  **Mean tipping step**: 227  |  **Tier-2 activation**: 222  |  **Therapy prevention**: 100%  |  **Therapy delay**: 207 steps

### bypass_loops

3 cross-hemisphere backup edges for highest-weight bottleneck projections (PVCR->AVBL, AVAR->DA1, AVBR->DB1). Models bilateral redundancy that C. elegans uses for robust locomotion.

- **Edges**: 130  |  **Clustering**: 0.2092  |  **Avg path**: 2.839  |  **Modularity**: 0.0809  |  **Bridges**: 4  |  **Degree variance**: 7.6
- **RES**: 0.796  |  **Genuine rate**: 100%  |  **Mean tipping step**: 228  |  **Tier-2 activation**: 222  |  **Therapy prevention**: 100%  |  **Therapy delay**: 205 steps

### modular

Intra-community weights x1.5, inter-community x0.7 (3 communities: sensory, interneuron, motor). Strengthens local circuits while reducing cross-layer prion-like spreading pathways.

- **Edges**: 127  |  **Clustering**: 0.2024  |  **Avg path**: 2.876  |  **Modularity**: 0.2008  |  **Bridges**: 4  |  **Degree variance**: 6.7
- **RES**: 0.799  |  **Genuine rate**: 80%  |  **Mean tipping step**: 222  |  **Tier-2 activation**: 218  |  **Therapy prevention**: 100%  |  **Therapy delay**: 219 steps

### anti_hub

3 distal hub edges (AVAL->DA9, AVAR->DA8, AVAL->VA5) redistributed to underused interneurons (AIBL, AIBR). Reduces super-spreader influence of the two main backward command neurons.

- **Edges**: 127  |  **Clustering**: 0.1776  |  **Avg path**: 2.942  |  **Modularity**: 0.0834  |  **Bridges**: 4  |  **Degree variance**: 5.6
- **RES**: 0.800  |  **Genuine rate**: 100%  |  **Mean tipping step**: 231  |  **Tier-2 activation**: 225  |  **Therapy prevention**: 100%  |  **Therapy delay**: 203 steps

### rich_club

Edges between top-20%-degree nodes scaled x1.5. Strengthens backbone connectivity between hubs. Models ALS-resistant highly-connected circuits proposed in scale-free network resilience studies.

- **Edges**: 127  |  **Clustering**: 0.2024  |  **Avg path**: 2.876  |  **Modularity**: 0.0938  |  **Bridges**: 4  |  **Degree variance**: 6.7
- **RES**: 0.787  |  **Genuine rate**: 100%  |  **Mean tipping step**: 223  |  **Tier-2 activation**: 218  |  **Therapy prevention**: 100%  |  **Therapy delay**: 207 steps

### distributed

5 hub->distal edges replaced by equivalent connections from underutilized interneurons (AVDL, AVDR, PVCL, AVEL, AVER). Democratises input to distal motor neurons, reducing cascade bottlenecks.

- **Edges**: 127  |  **Clustering**: 0.1786  |  **Avg path**: 2.960  |  **Modularity**: 0.0913  |  **Bridges**: 4  |  **Degree variance**: 5.7
- **RES**: 0.803  |  **Genuine rate**: 100%  |  **Mean tipping step**: 232  |  **Tier-2 activation**: 226  |  **Therapy prevention**: 100%  |  **Therapy delay**: 204 steps

### hierarchical

10 sensory->motor skip-level edges added (PLML->DA1, ALML->DB1, AVM->VA1, etc.). Creates explicit hierarchical shortcuts bypassing interneuron layer, mimicking fast reflex arcs in vertebrate spinal circuits.

- **Edges**: 137  |  **Clustering**: 0.1774  |  **Avg path**: 2.842  |  **Modularity**: 0.0828  |  **Bridges**: 4  |  **Degree variance**: 6.8
- **RES**: 0.790  |  **Genuine rate**: 100%  |  **Mean tipping step**: 227  |  **Tier-2 activation**: 221  |  **Therapy prevention**: 100%  |  **Therapy delay**: 203 steps

### sparse_chain

12 redundant premotor->motor edges removed. Preserves only core chains and primary command->motor paths. Negative control: maximally fragile topology with minimal redundancy.

- **Edges**: 115  |  **Clustering**: 0.1842  |  **Avg path**: 2.934  |  **Modularity**: 0.1079  |  **Bridges**: 8  |  **Degree variance**: 7.1
- **RES**: 0.815  |  **Genuine rate**: 100%  |  **Mean tipping step**: 235  |  **Tier-2 activation**: 231  |  **Therapy prevention**: 100%  |  **Therapy delay**: 207 steps

## 5. Key Findings

1. **Best motif**: sparse_chain (RES=0.815), 235 steps mean tipping delay vs 230 baseline.
2. **Worst motif**: triangle_rich (RES=0.738); 227 steps mean tipping delay.
3. **Tier-2 resistance**: topology with latest Tier-2 activation: sparse_chain (step 231 vs 225 baseline).
4. **Therapy amplification**: topology with highest therapy prevention rate: baseline (100%).
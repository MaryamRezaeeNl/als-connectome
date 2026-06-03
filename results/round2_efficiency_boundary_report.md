# Phase R2.2 -- Efficiency vs Resilience Boundary

6 topology families × 7 strength levels × 5 configs × 5 seeds × 300 steps.

## 1. Sweep Summary

| Topology | Safe zone (%) | Critical threshold | Transition | Best DEI | Best DEI strength |
|----------|---------------|--------------------|-----------|---------|--------------------|
| sparse_chain   | 0-0           | 100%               | sharp     | 0.010   | 80                 |
| triangle_rich  | 0-60          | 80%                | gradual   | 32.200  | 60                 |
| modular        | 0-100         | none               | gradual   | 0.000   | 0                  |
| rich_club      | 0-100         | 60%                | gradual   | 0.000   | 0                  |
| distributed    | 0-100         | none               | gradual   | 1.800   | 60                 |
| bypass_loops   | 0-100         | none               | flat      | 3.100   | 100                |

## 2. Efficiency vs Resilience Profiles

### sparse_chain

| Strength | GlobalEff | Clustering | Modularity | Genuine% | Tipping | Plateau | Vel | DEI |
|----------|-----------|------------|------------|----------|---------|---------|-----|-----|
|   0% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  10% | 0.1108 | 0.2022 | 0.0851 |    40% |   229 |  27.8 | 8.68 | -0.200 |
|  20% | 0.1106 | 0.2020 | 0.0868 |    40% |   229 |  27.8 | 8.68 | -0.400 |
|  40% | 0.1102 | 0.1891 | 0.0904 |    40% |   230 |  28.0 | 8.68 | -0.800 |
|  60% | 0.1095 | 0.1844 | 0.0960 |    20% |   231 |  28.2 | 8.88 |  0.007 |
|  80% | 0.1090 | 0.1750 | 0.1004 |    20% |   232 |  28.3 | 8.92 |  0.010 |
| 100% | 0.1079 | 0.1842 | 0.1079 |    60% |   233 |  28.6 | 9.24 | -0.015 |

*Peak DEI: 0.010 at 80% strength.*

### triangle_rich

| Strength | GlobalEff | Clustering | Modularity | Genuine% | Tipping | Plateau | Vel | DEI |
|----------|-----------|------------|------------|----------|---------|---------|-----|-----|
|   0% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  10% | 0.1192 | 0.2024 | 0.0791 |    40% |   228 |  27.7 | 8.64 |  8.200 |
|  20% | 0.1262 | 0.2024 | 0.0748 |    40% |   228 |  27.6 | 8.76 | 15.200 |
|  40% | 0.1376 | 0.1960 | 0.0665 |    40% |   227 |  27.4 | 9.04 | 26.600 |
|  60% | 0.1432 | 0.1960 | 0.0584 |    40% |   227 |  27.2 | 9.04 | 32.200 |
|  80% | 0.1538 | 0.1908 | 0.0506 |    60% |   226 |  26.9 | 9.24 |  0.213 |
| 100% | 0.1677 | 0.1874 | 0.0431 |    60% |   226 |  26.6 | 9.28 |  0.282 |

*Peak DEI: 32.200 at 60% strength.*

### modular

| Strength | GlobalEff | Clustering | Modularity | Genuine% | Tipping | Plateau | Vel | DEI |
|----------|-----------|------------|------------|----------|---------|---------|-----|-----|
|   0% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  10% | 0.1110 | 0.2024 | 0.0956 |    40% |   228 |  27.6 | 8.76 |  0.000 |
|  20% | 0.1110 | 0.2024 | 0.1077 |    40% |   228 |  27.1 | 9.08 |  0.000 |
|  40% | 0.1110 | 0.2024 | 0.1317 |    20% |   227 |  26.6 | 9.64 | -0.000 |
|  60% | 0.1110 | 0.2024 | 0.1554 |    20% |   225 |  26.1 | 9.80 | -0.000 |
|  80% | 0.1110 | 0.2024 | 0.1789 |    20% |   223 |  25.5 | 9.88 | -0.000 |
| 100% | 0.1110 | 0.2024 | 0.2008 |    20% |   222 |  25.0 | 10.20 | -0.000 |

*Peak DEI: 0.000 at 0% strength.*

### rich_club

| Strength | GlobalEff | Clustering | Modularity | Genuine% | Tipping | Plateau | Vel | DEI |
|----------|-----------|------------|------------|----------|---------|---------|-----|-----|
|   0% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  10% | 0.1110 | 0.2024 | 0.0836 |    40% |   228 |  27.7 | 8.76 |  0.000 |
|  20% | 0.1110 | 0.2024 | 0.0838 |    40% |   226 |  27.4 | 8.80 |  0.000 |
|  40% | 0.1110 | 0.2024 | 0.0863 |    40% |   225 |  27.0 | 8.72 |  0.000 |
|  60% | 0.1110 | 0.2024 | 0.0891 |    60% |   224 |  26.9 | 8.80 |  0.000 |
|  80% | 0.1110 | 0.2024 | 0.0918 |    40% |   223 |  26.8 | 9.08 |  0.000 |
| 100% | 0.1110 | 0.2024 | 0.0938 |    40% |   222 |  26.6 | 9.00 |  0.000 |

*Peak DEI: 0.000 at 0% strength.*

### distributed

| Strength | GlobalEff | Clustering | Modularity | Genuine% | Tipping | Plateau | Vel | DEI |
|----------|-----------|------------|------------|----------|---------|---------|-----|-----|
|   0% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  10% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  20% | 0.1123 | 0.2014 | 0.0847 |    40% |   229 |  27.9 | 8.60 |  1.300 |
|  40% | 0.1126 | 0.2005 | 0.0859 |    20% |   229 |  28.0 | 8.56 | -0.008 |
|  60% | 0.1128 | 0.2007 | 0.0877 |    40% |   229 |  28.2 | 8.48 |  1.800 |
|  80% | 0.1131 | 0.1896 | 0.0895 |    20% |   230 |  28.3 | 8.28 | -0.011 |
| 100% | 0.1131 | 0.1786 | 0.0913 |    20% |   230 |  28.4 | 8.28 | -0.011 |

*Peak DEI: 1.800 at 60% strength.*

### bypass_loops

| Strength | GlobalEff | Clustering | Modularity | Genuine% | Tipping | Plateau | Vel | DEI |
|----------|-----------|------------|------------|----------|---------|---------|-----|-----|
|   0% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  10% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  20% | 0.1110 | 0.2024 | 0.0834 |    40% |   229 |  27.8 | 8.72 |  0.000 |
|  40% | 0.1124 | 0.2041 | 0.0866 |    40% |   228 |  27.5 | 9.04 |  1.400 |
|  60% | 0.1124 | 0.2041 | 0.0866 |    40% |   228 |  27.5 | 9.04 |  1.400 |
|  80% | 0.1136 | 0.2063 | 0.0837 |    40% |   228 |  27.5 | 8.96 |  2.600 |
| 100% | 0.1141 | 0.2092 | 0.0809 |    40% |   227 |  27.4 | 8.88 |  3.100 |

*Peak DEI: 3.100 at 100% strength.*

## 3. DEI Landscape

DEI = delta_global_efficiency / (delta_genuine_tipping_rate + 0.001)

Positive DEI: efficiency improves without proportional vulnerability increase.

| Topology | S=10 | S=20 | S=40 | S=60 | S=80 | S=100 | Best DEI | at S |
|----------|------|------|------|------|------|-------|----------|------|
| sparse_chain   | -0.200 | -0.400 | -0.800 | 0.007 | 0.010 | -0.015 |    0.010 |   80 |
| triangle_rich  | 8.200 | 15.200 | 26.600 | 32.200 | 0.213 | 0.282 |   32.200 |   60 |
| modular        | 0.000 | 0.000 | -0.000 | -0.000 | -0.000 | -0.000 |    0.000 |    0 |
| rich_club      | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |    0.000 |    0 |
| distributed    | 0.000 | 1.300 | -0.008 | 1.800 | -0.011 | -0.011 |    1.800 |   60 |
| bypass_loops   | 0.000 | 0.000 | 1.400 | 1.400 | 2.600 | 3.100 |    3.100 |  100 |

## 4. Scientific Questions

### Q1: Is there a universal efficiency-resilience tradeoff?

Correlation across all (topology, strength) pairs: **r = 0.439**

Partial tradeoff (r=0.439); depends on topology type.

### Q2: Which topology has the best DEI?

**triangle_rich** at 60% strength: DEI = 32.2000

At 60% strength, triangle_rich achieves the best efficiency gain relative to vulnerability increase.

### Q3: Are recurrent loops always harmful or threshold-dependent?

Threshold-dependent: recurrent loops are neutral below 60% strength, harmful above.

Plateau trajectory for triangle_rich:

| Strength | Plateau survivors |
|----------|------------------|
|   0% | 27.8 |
|  10% | 27.7 |
|  20% | 27.6 |
|  40% | 27.4 |
|  60% | 27.2 |
|  80% | 26.9 |
| 100% | 26.6 |

### Q4: Is sparse topology protective via fewer paths or reduced synchronization?

r(tipping_step, global_efficiency) = **-0.996**

r(tipping_step, clustering_coeff)  = **-0.855**

Sparse topology protects primarily via reduced path count (r_efficiency=-0.996 > r_clustering=-0.855).

### Q5: Does any topology show an optimal intermediate regime?

No topology shows a clear intermediate optimum across all three metrics (plateau, efficiency, and genuine rate simultaneously).

## 5. 2D Landscape Summary

Each point: (global_efficiency, plateau_survivors, collapse_velocity)

| Topology | Strength | Efficiency | Plateau | Velocity | Genuine% |
|----------|----------|------------|---------|----------|----------|
| sparse_chain   |   0% | 0.1110 |  27.8 | 8.72 |    40% |
| sparse_chain   |  10% | 0.1108 |  27.8 | 8.68 |    40% |
| sparse_chain   |  20% | 0.1106 |  27.8 | 8.68 |    40% |
| sparse_chain   |  40% | 0.1102 |  28.0 | 8.68 |    40% |
| sparse_chain   |  60% | 0.1095 |  28.2 | 8.88 |    20% |
| sparse_chain   |  80% | 0.1090 |  28.3 | 8.92 |    20% |
| sparse_chain   | 100% | 0.1079 |  28.6 | 9.24 |    60% |
| triangle_rich  |   0% | 0.1110 |  27.8 | 8.72 |    40% |
| triangle_rich  |  10% | 0.1192 |  27.7 | 8.64 |    40% |
| triangle_rich  |  20% | 0.1262 |  27.6 | 8.76 |    40% |
| triangle_rich  |  40% | 0.1376 |  27.4 | 9.04 |    40% |
| triangle_rich  |  60% | 0.1432 |  27.2 | 9.04 |    40% |
| triangle_rich  |  80% | 0.1538 |  26.9 | 9.24 |    60% |
| triangle_rich  | 100% | 0.1677 |  26.6 | 9.28 |    60% |
| modular        |   0% | 0.1110 |  27.8 | 8.72 |    40% |
| modular        |  10% | 0.1110 |  27.6 | 8.76 |    40% |
| modular        |  20% | 0.1110 |  27.1 | 9.08 |    40% |
| modular        |  40% | 0.1110 |  26.6 | 9.64 |    20% |
| modular        |  60% | 0.1110 |  26.1 | 9.80 |    20% |
| modular        |  80% | 0.1110 |  25.5 | 9.88 |    20% |
| modular        | 100% | 0.1110 |  25.0 | 10.20 |    20% |
| rich_club      |   0% | 0.1110 |  27.8 | 8.72 |    40% |
| rich_club      |  10% | 0.1110 |  27.7 | 8.76 |    40% |
| rich_club      |  20% | 0.1110 |  27.4 | 8.80 |    40% |
| rich_club      |  40% | 0.1110 |  27.0 | 8.72 |    40% |
| rich_club      |  60% | 0.1110 |  26.9 | 8.80 |    60% |
| rich_club      |  80% | 0.1110 |  26.8 | 9.08 |    40% |
| rich_club      | 100% | 0.1110 |  26.6 | 9.00 |    40% |
| distributed    |   0% | 0.1110 |  27.8 | 8.72 |    40% |
| distributed    |  10% | 0.1110 |  27.8 | 8.72 |    40% |
| distributed    |  20% | 0.1123 |  27.9 | 8.60 |    40% |
| distributed    |  40% | 0.1126 |  28.0 | 8.56 |    20% |
| distributed    |  60% | 0.1128 |  28.2 | 8.48 |    40% |
| distributed    |  80% | 0.1131 |  28.3 | 8.28 |    20% |
| distributed    | 100% | 0.1131 |  28.4 | 8.28 |    20% |
| bypass_loops   |   0% | 0.1110 |  27.8 | 8.72 |    40% |
| bypass_loops   |  10% | 0.1110 |  27.8 | 8.72 |    40% |
| bypass_loops   |  20% | 0.1110 |  27.8 | 8.72 |    40% |
| bypass_loops   |  40% | 0.1124 |  27.5 | 9.04 |    40% |
| bypass_loops   |  60% | 0.1124 |  27.5 | 9.04 |    40% |
| bypass_loops   |  80% | 0.1136 |  27.5 | 8.96 |    40% |
| bypass_loops   | 100% | 0.1141 |  27.4 | 8.88 |    40% |
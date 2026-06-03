"""Phase 7C -- Topology Validation.

Are genuine tipping points and therapy windows specific to the C. elegans
connectome topology, or do they emerge on any graph with similar
size and density (61 nodes, ~127 directed edges)?

Five graph types are tested:
  celegans  -- White/Cook et al. biological connectome  (1 topology instance)
  er        -- Erdos-Renyi uniform random directed graph (10 instances)
  ba        -- Barabasi-Albert scale-free               (10 instances)
  ws        -- Watts-Strogatz small-world               (10 instances)
  shuffled  -- Degree-preserved double-edge-swap shuffle(10 instances)

Fixed across ALL graph types:
  - Per-neuron vulnerability scores (VULNERABILITY dict)
  - Neurotransmitter identities  (NEUROTRANSMITTER dict)
  - Initial aggregation seeding  (motor neurons seeded, same RNG state)
  - Phase 5 disease parameters   (top 10 critical configs)
  - Phase 7B strict criterion    (slope>4, coherence r>0.30, silent>50)
  - Phase 6 best therapy         (agg_sup strength=0.855, start_t=13)

Output:
  results/phase7c_topology.json
  results/phase7c_topology_report.md
"""

import json
import time
import numpy as np
from collections import defaultdict
from pathlib import Path

import networkx as nx

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES, NEUROTRANSMITTER, VULNERABILITY, SYNAPSES
from phase5_criticality import CriticalitySimulator
from phase6_therapy import TherapySimulator, _P5_KEYS

# ---- Simulation / criterion constants ---------------------------------------
N         = 61
N_EDGES   = 127      # target edge count for all graph types
N_CONFIGS = 10       # top Phase 5 critical configs to test
N_SEEDS   = 3        # simulation seeds per (topology_instance, config)
N_TOPO    = 10       # topology instances for synthetic graph types
STEPS     = 500      # baseline steps
STEPS_TH  = 300      # therapy steps

TIPPING_THR = 55     # alive < this -> tipping zone
SLOPE_THR   = 4      # peak 10-step decline (c1)
COH_THR     = 0.30   # spatial coherence r (c2)
SILENT_MIN  = 50     # first death must be at step > this (c3)

BEST_THERAPY = {"type": "agg_sup", "strength": 0.855, "start_t": 13}
NO_THERAPY   = {"type": "none",    "start_t": 0}

# ---- Fixed per-neuron arrays (kept identical across all graph types) ---------
VULN    = np.array([VULNERABILITY[n]                     for n in NEURON_NAMES])
IS_GLUT = [NEUROTRANSMITTER[n] == "glutamate"            for n in NEURON_NAMES]

# Empirical weight distribution from C. elegans SYNAPSES
REAL_WEIGHTS = [s[2] for s in SYNAPSES]
P_EXC        = sum(1 for s in SYNAPSES if s[3] == "excitatory") / len(SYNAPSES)


# ============================================================
# Topology injection
# ============================================================

def inject_topology(sim, edge_list):
    """
    Override sim adjacency matrices in-place with a synthetic edge list.
    edge_list : list of (pre_idx, post_idx, weight, syn_type)
    Vulnerability, neurotransmitter identity, and initial state are unchanged.
    """
    n = sim.n
    in_edges    = defaultdict(list)
    out_edges   = defaultdict(list)
    excitotox_W = np.zeros((n, n))
    agg_W       = np.zeros((n, n))

    for pre, post, w, syn_type in edge_list:
        in_edges[post].append((pre, w, syn_type))
        out_edges[pre].append((post, w, syn_type))
        agg_W[post, pre] = w                           # all synapses spread aggregation
        if IS_GLUT[pre] and syn_type == "excitatory":  # only glutamate pre -> excitotox
            excitotox_W[post, pre] = w

    sim.in_edges    = in_edges
    sim.out_edges   = out_edges
    sim.excitotox_W = excitotox_W
    sim.agg_W       = agg_W


# ============================================================
# Edge-list generators
# ============================================================

def celegan_edges():
    """Convert SYNAPSES to index-based edge list (pre_idx, post_idx, w, syn_type)."""
    idx = {n: i for i, n in enumerate(NEURON_NAMES)}
    return [(idx[pre], idx[post], w, t) for pre, post, w, t in SYNAPSES]


def _assign_weights_types(raw_pairs, rng):
    """
    Assign weights (sampled from real C. elegans distribution) and synapse types
    to a list of (pre_idx, post_idx) pairs.
    """
    result = []
    for pre, post in raw_pairs:
        w = float(rng.choice(REAL_WEIGHTS))
        t = "excitatory" if rng.random() < P_EXC else "inhibitory"
        result.append((pre, post, w, t))
    return result


def _spanning_tree_edges(n, rng):
    """Random directed spanning tree on n nodes (n-1 edges) -- guarantees connectivity."""
    perm     = rng.permutation(n).tolist()
    edge_set = set()
    for k in range(1, n):
        u = perm[int(rng.integers(k))]
        v = perm[k]
        if rng.random() < 0.5:
            edge_set.add((u, v))
        else:
            edge_set.add((v, u))
    return edge_set


def gen_er(n, m, rng):
    """Erdos-Renyi: connected directed graph with exactly m edges."""
    tree    = _spanning_tree_edges(n, rng)
    extra   = m - len(tree)
    all_pos = [(i, j) for i in range(n) for j in range(n)
               if i != j and (i, j) not in tree]
    chosen  = rng.choice(len(all_pos), size=extra, replace=False)
    pairs   = list(tree) + [all_pos[k] for k in chosen]
    return _assign_weights_types(pairs, rng)


def _orient_and_adjust(G_undir, n, m_target, rng):
    """
    Orient an undirected NetworkX graph randomly; adjust edge count to m_target;
    patch weak connectivity if needed.
    """
    pairs = set()
    for u, v in G_undir.edges():
        if rng.random() < 0.5:
            pairs.add((int(u), int(v)))
        else:
            pairs.add((int(v), int(u)))

    pairs = list(pairs)
    if len(pairs) > m_target:
        idx   = rng.choice(len(pairs), size=m_target, replace=False)
        pairs = [pairs[i] for i in sorted(idx)]
    elif len(pairs) < m_target:
        need     = m_target - len(pairs)
        pair_set = set(pairs)
        all_pos  = [(i, j) for i in range(n) for j in range(n)
                    if i != j and (i, j) not in pair_set]
        chosen   = rng.choice(len(all_pos), size=min(need, len(all_pos)), replace=False)
        for ci in chosen:
            pairs.append(all_pos[ci])

    # Ensure weak connectivity
    G2 = nx.DiGraph(pairs)
    G2.add_nodes_from(range(n))
    if not nx.is_weakly_connected(G2):
        pair_set = set(pairs)
        for comp in list(nx.weakly_connected_components(G2))[1:]:
            u = next(iter(list(nx.weakly_connected_components(G2))[0]))
            v = next(iter(comp))
            if (u, v) not in pair_set:
                pairs.append((u, v))
                pair_set.add((u, v))
            elif (v, u) not in pair_set:
                pairs.append((v, u))
                pair_set.add((v, u))

    return _assign_weights_types(pairs, rng)


def gen_ba(n, m_target, rng):
    """Barabasi-Albert scale-free directed graph with ~m_target edges."""
    seed_val = int(rng.integers(2**31 - 1))
    G_undir  = nx.barabasi_albert_graph(n, 2, seed=seed_val)
    return _orient_and_adjust(G_undir, n, m_target, rng)


def gen_ws(n, m_target, rng):
    """Watts-Strogatz small-world directed graph with ~m_target edges."""
    seed_val = int(rng.integers(2**31 - 1))
    G_undir  = nx.watts_strogatz_graph(n, 4, 0.3, seed=seed_val)
    return _orient_and_adjust(G_undir, n, m_target, rng)


def gen_shuffled(base_edges, n_swaps, rng):
    """
    Degree-preserved double-edge-swap shuffle of a directed edge list.
    Preserves every node's in-degree and out-degree exactly.
    Swaps edge weights/types with the connections, preserving pre-node weight identity.
    """
    edges     = [(pre, post) for pre, post, w, t in base_edges]
    edge_info = {(pre, post): (w, t) for pre, post, w, t in base_edges}
    edge_set  = set(edges)
    m         = len(edges)

    done = 0
    for _ in range(n_swaps * 4):
        if done >= n_swaps:
            break
        i = int(rng.integers(m))
        j = int(rng.integers(m))
        if i == j:
            continue
        a, b = edges[i]
        c, d = edges[j]
        # Swap: a->d, c->b  (each node's in- and out-degree unchanged)
        if (a != d and c != b
                and (a, d) not in edge_set
                and (c, b) not in edge_set):
            edge_set.discard((a, b))
            edge_set.discard((c, d))
            edge_set.add((a, d))
            edge_set.add((c, b))
            edge_info[(a, d)] = edge_info.pop((a, b))
            edge_info[(c, b)] = edge_info.pop((c, d))
            edges[i] = (a, d)
            edges[j] = (c, b)
            done += 1

    return [(pre, post, w, t) for (pre, post), (w, t) in edge_info.items()]


# ============================================================
# Topology metrics
# ============================================================

def compute_topo_metrics(edge_list, n):
    """Compute structural properties of a directed graph given its edge list."""
    G     = nx.DiGraph([(pre, post) for pre, post, w, t in edge_list])
    G.add_nodes_from(range(n))
    G_und = G.to_undirected()

    degs    = [G.in_degree(v) + G.out_degree(v) for v in range(n)]
    deg_var = float(np.var(degs))
    avg_cl  = float(nx.average_clustering(G))

    if nx.is_connected(G_und):
        try:
            avg_path = float(nx.average_shortest_path_length(G_und))
        except Exception:
            avg_path = None
    else:
        lcc      = max(nx.connected_components(G_und), key=len)
        try:
            avg_path = float(nx.average_shortest_path_length(G_und.subgraph(lcc)))
        except Exception:
            avg_path = None

    try:
        comms  = list(nx.community.greedy_modularity_communities(G_und))
        modq   = float(nx.community.modularity(G_und, comms))
    except Exception:
        modq   = None

    try:
        n_brid = len(list(nx.bridges(G_und)))
    except Exception:
        n_brid = None

    return {
        "n_edges":           len(edge_list),
        "degree_variance":   round(deg_var, 3),
        "avg_clustering":    round(avg_cl,  4),
        "avg_shortest_path": round(avg_path, 4) if avg_path is not None else None,
        "modularity":        round(modq, 4)      if modq     is not None else None,
        "n_bridges":         n_brid,
    }


def _avg_metrics(metrics_list):
    keys = ["n_edges", "degree_variance", "avg_clustering",
            "avg_shortest_path", "modularity", "n_bridges"]
    out = {}
    for k in keys:
        vals = [m[k] for m in metrics_list if m.get(k) is not None]
        out[k] = round(float(np.mean(vals)), 4) if vals else None
    return out


# ============================================================
# Simulation runner and strict criterion
# ============================================================

def _pearson_r(x, y):
    n = len(x)
    if n < 3:
        return 0.0
    mx, my = np.mean(x), np.mean(y)
    num = np.sum((x - mx) * (y - my))
    den = np.sqrt(np.sum((x - mx)**2) * np.sum((y - my)**2))
    return float(num / den) if den > 1e-12 else 0.0


def _run_one(sim, steps):
    """Run sim for `steps` steps; return (hist_alive, death_step_per_neuron)."""
    n          = sim.n
    death_step = np.full(n, steps, dtype=int)
    prev_alive = np.ones(n, dtype=bool)
    hist       = []
    for t in range(steps):
        sim.step()
        curr_alive = sim.health > sim.DEAD_THRESHOLD
        newly_dead = prev_alive & ~curr_alive
        death_step[newly_dead] = t + 1
        prev_alive = curr_alive
        hist.append(int(curr_alive.sum()))
    return hist, death_step


def _row_stats(hist, death_step, steps):
    """Per-run stats for strict criterion."""
    n_h        = len(hist)
    tipping_pt = next((t + 1 for t, a in enumerate(hist) if a < TIPPING_THR), steps)
    silent_end = next((t + 1 for t, a in enumerate(hist) if a < N),           steps)
    rates      = [hist[t] - hist[t + 10] for t in range(n_h - 10)]
    peak_rate  = max(rates) if rates else 0
    died_mask  = death_step < steps
    coh_r      = (_pearson_r(VULN[died_mask], -death_step[died_mask].astype(float))
                  if died_mask.sum() >= 3 else 0.0)
    return {
        "tip":     tipping_pt,
        "silent":  silent_end,
        "peak":    peak_rate,
        "coh_r":   coh_r,
        "plateau": hist[-1],
    }


def _strict(seed_rows, steps):
    """Apply the Phase 7B strict three-part criterion to multi-seed results."""
    tips    = [r["tip"]     for r in seed_rows]
    silents = [r["silent"]  for r in seed_rows]
    peaks   = [r["peak"]    for r in seed_rows]
    cohs    = [r["coh_r"]   for r in seed_rows]
    plats   = [r["plateau"] for r in seed_rows]

    tip_med    = float(np.median(tips))
    silent_med = float(np.median(silents))
    peak_med   = float(np.median(peaks))
    coh_med    = float(np.median(cohs))
    plat_med   = float(np.median(plats))

    c1 = peak_med  > SLOPE_THR
    c2 = coh_med   > COH_THR
    c3 = silent_med > SILENT_MIN

    return {
        "is_genuine":    bool(c1 and c2 and c3),
        "c1_slope":      bool(c1),
        "c2_coherence":  bool(c2),
        "c3_silent":     bool(c3),
        "tip_median":    int(round(tip_med)),
        "silent_median": int(round(silent_med)),
        "peak_median":   round(peak_med, 1),
        "coh_r_median":  round(coh_med, 3),
        "plateau_median":int(round(plat_med)),
    }


def run_config(params, config_id, edge_list, therapy):
    """
    Run one (config, topology) pair with N_SEEDS seeds.
    Returns strict criterion dict.
    """
    base_seed = config_id + 100
    steps_use = STEPS_TH if therapy is not None else STEPS
    rows      = []
    for k in range(N_SEEDS):
        seed = base_seed + k * 1000
        if therapy is None:
            sim = CriticalitySimulator(seed=seed, params=params)
        else:
            sim = TherapySimulator(seed=seed,
                                   disease_params=params,
                                   therapy_config=therapy)
        inject_topology(sim, edge_list)
        hist, death_step = _run_one(sim, steps_use)
        rows.append(_row_stats(hist, death_step, steps_use))
    return _strict(rows, steps_use)


# ============================================================
# Topology-level aggregation
# ============================================================

def analyse_topo(tname, edge_lists, top_configs, therapy):
    """
    Run all configs across all instances of one graph type.
    Returns summary dict for report and JSON.
    """
    per_instance = []
    all_genuine  = []
    all_tip      = []
    all_coh      = []
    all_plateau  = []
    all_prevented = []

    steps_use = STEPS_TH if therapy is not None else STEPS

    for topo_idx, edge_list in enumerate(edge_lists):
        n_gen = 0
        n_prev = 0
        tips, cohs, plateaus = [], [], []
        for cfg in top_configs:
            r = run_config(cfg["params"], cfg["id"], edge_list, therapy)
            if r["is_genuine"]:
                n_gen += 1
            # "prevented" = therapy pushes tipping past window end
            if therapy is not None and r["tip_median"] >= steps_use:
                n_prev += 1
            tips.append(r["tip_median"])
            cohs.append(r["coh_r_median"])
            plateaus.append(r["plateau_median"])

        per_instance.append({
            "topo_idx":      topo_idx,
            "genuine_rate":  round(n_gen / N_CONFIGS, 3),
            "prevented_rate":round(n_prev / N_CONFIGS, 3) if therapy else None,
            "mean_tip":      round(float(np.mean(tips)), 1),
            "mean_coh_r":    round(float(np.mean(cohs)), 3),
            "mean_plateau":  round(float(np.mean(plateaus)), 1),
        })
        all_genuine.append(n_gen / N_CONFIGS)
        all_prevented.append(n_prev / N_CONFIGS)
        all_tip.extend(tips)
        all_coh.extend(cohs)
        all_plateau.extend(plateaus)

    result = {
        "topo_name":            tname,
        "n_instances":          len(edge_lists),
        "genuine_tipping_rate": round(float(np.mean(all_genuine)), 3),
        "genuine_rate_std":     round(float(np.std(all_genuine)),  3),
        "mean_tipping_step":    round(float(np.mean(all_tip)),     1),
        "mean_spatial_coh":     round(float(np.mean(all_coh)),     3),
        "mean_plateau":         round(float(np.mean(all_plateau)),  1),
        "per_instance":         per_instance,
    }
    if therapy is not None:
        result["therapy_prevention_rate"] = round(float(np.mean(all_prevented)), 3)
    return result


# ============================================================
# Report builder
# ============================================================

TOPO_ORDER = ["celegans", "er", "ba", "ws", "shuffled"]
TOPO_LABEL = {
    "celegans": "C. elegans (bio)",
    "er":       "Erdos-Renyi (ER)",
    "ba":       "Barabasi-Albert (BA)",
    "ws":       "Watts-Strogatz (WS)",
    "shuffled": "Degree-preserved shuffle",
}


def build_report(base_results, ther_results, topo_metrics) -> str:
    lines = []

    ce_base = base_results["celegans"]
    ce_ther = ther_results["celegans"]

    lines += [
        "# Phase 7C -- Topology Validation",
        "",
        "## Overview",
        "",
        "Five graph types (61 nodes, ~127 directed edges) are tested with the same "
        "disease parameters (top 10 Phase 5 critical configs), vulnerability scores, "
        "and Phase 7B strict criterion (slope > 4, coherence r > 0.30, silent > 50 steps).",
        "",
        "**C. elegans**: 1 biological topology.  "
        "**ER / BA / WS / Shuffled**: 10 random instances each, results averaged.",
        "",
    ]

    # ---- 1. Structural properties
    lines += [
        "## 1. Graph Structural Properties",
        "",
        "| Graph type | Edges | Degree var | Clustering | Avg path | Modularity | Bridges |",
        "|------------|-------|------------|------------|---------|------------|---------|",
    ]
    for t in TOPO_ORDER:
        m = topo_metrics.get(t, {})
        lines.append(
            f"| {TOPO_LABEL[t]} "
            f"| {m.get('n_edges', '?')} "
            f"| {m.get('degree_variance', '?')} "
            f"| {m.get('avg_clustering', '?')} "
            f"| {m.get('avg_shortest_path', '?')} "
            f"| {m.get('modularity', '?')} "
            f"| {m.get('n_bridges', '?')} |"
        )
    lines.append("")

    # ---- 2. Baseline
    lines += [
        "## 2. Baseline Degeneration (No Therapy, 500 steps)",
        "",
        "| Graph type | Genuine rate | +/-std | Mean tipping step | "
        "Mean coherence r | Mean plateau |",
        "|------------|-------------|-------|------------------|"
        "----------------|-------------|",
    ]
    for t in TOPO_ORDER:
        r = base_results.get(t, {})
        lines.append(
            f"| {TOPO_LABEL[t]} "
            f"| {r.get('genuine_tipping_rate', '?')} "
            f"| {r.get('genuine_rate_std', '?')} "
            f"| {r.get('mean_tipping_step', '?')} "
            f"| {r.get('mean_spatial_coh', '?')} "
            f"| {r.get('mean_plateau', '?')} |"
        )
    lines.append("")

    # Comparison: C. elegans vs others
    ce_gen = ce_base.get("genuine_tipping_rate", 0)
    lines += ["### C. elegans vs synthetic comparison (genuine tipping rate)", ""]
    for t in ["er", "ba", "ws", "shuffled"]:
        r    = base_results.get(t, {})
        ogen = r.get("genuine_tipping_rate", 0)
        diff = ce_gen - ogen
        dirn = "higher" if diff > 0.1 else ("lower" if diff < -0.1 else "similar")
        lines.append(
            f"- **{TOPO_LABEL[t]}**: {ogen:.3f}  "
            f"(C. elegans = {ce_gen:.3f}, diff = {diff:+.3f}, C. elegans is **{dirn}**)"
        )
    lines.append("")

    # ---- 3. Therapy
    lines += [
        "## 3. Therapy Response (agg_sup str=0.855 start_t=13, 300 steps)",
        "",
        "Therapy prevention rate = fraction of configs where tipping pushed past step 300.",
        "",
        "| Graph type | Genuine (therapy) | Prevention rate | Mean therapy step | "
        "Therapy plateau | Baseline plateau |",
        "|------------|-----------------|----------------|------------------|"
        "----------------|-----------------|",
    ]
    for t in TOPO_ORDER:
        r = ther_results.get(t, {})
        b = base_results.get(t, {})
        lines.append(
            f"| {TOPO_LABEL[t]} "
            f"| {r.get('genuine_tipping_rate', '?')} "
            f"| {r.get('therapy_prevention_rate', '?')} "
            f"| {r.get('mean_tipping_step', '?')} "
            f"| {r.get('mean_plateau', '?')} "
            f"| {b.get('mean_plateau', '?')} |"
        )
    lines.append("")

    # ---- 4. Interpretation
    lines += ["## 4. Key Questions", ""]

    # Q1: topology dependent?
    all_rates  = {t: base_results.get(t, {}).get("genuine_tipping_rate", 0) for t in TOPO_ORDER}
    rate_range = max(all_rates.values()) - min(all_rates.values())
    if rate_range > 0.35:
        q1 = (f"**YES** -- genuine_tipping_rate spans {rate_range:.3f} across graph types "
              f"(range: {min(all_rates.values()):.3f} to {max(all_rates.values()):.3f}). "
              "The specific wiring strongly influences whether a triphasic collapse emerges.")
    elif rate_range > 0.15:
        q1 = (f"**PARTLY** -- genuine_tipping_rate varies moderately across graph types "
              f"(range: {rate_range:.3f}). Topology matters but is not the sole determinant.")
    else:
        q1 = (f"**NO** -- genuine_tipping_rate is similar across all graph types "
              f"(range: {rate_range:.3f}). The biophysical cascade dominates over wiring.")
    lines += [
        "### Q1: Are genuine tipping points topology-dependent?",
        "",
        q1, "",
    ]

    # Q2: C. elegans coherence advantage?
    ce_coh       = ce_base.get("mean_spatial_coh", 0)
    other_cohs   = [base_results.get(t, {}).get("mean_spatial_coh", 0)
                    for t in ["er", "ba", "ws", "shuffled"]]
    mean_oth_coh = float(np.mean(other_cohs))
    if ce_coh > mean_oth_coh + 0.08:
        q2 = (f"**YES** -- C. elegans coherence r = {ce_coh:.3f} exceeds synthetic mean = "
              f"{mean_oth_coh:.3f} by >{0.08:.2f}. The biological wiring channels aggregation "
              "spread preferentially through high-vulnerability motor neurons.")
    elif ce_coh < mean_oth_coh - 0.08:
        q2 = (f"**NO** -- C. elegans coherence r = {ce_coh:.3f} is BELOW synthetic mean = "
              f"{mean_oth_coh:.3f}. Some random topologies produce stronger vulnerability-ordered "
              "spreading by chance.")
    else:
        q2 = (f"**SIMILAR** -- C. elegans coherence r = {ce_coh:.3f} vs synthetic mean = "
              f"{mean_oth_coh:.3f}. Spatial coherence arises primarily from the vulnerability "
              "gradient, not from the specific C. elegans wiring.")
    lines += [
        "### Q2: Does C. elegans topology produce stronger spatial coherence?",
        "",
        q2, "",
    ]

    # Q3: therapy -- topology or dynamics?
    ce_th_prev   = ce_ther.get("therapy_prevention_rate", 0)
    oth_th_prevs = [ther_results.get(t, {}).get("therapy_prevention_rate", 0)
                    for t in ["er", "ba", "ws", "shuffled"]]
    mean_oth_prev = float(np.mean(oth_th_prevs))
    th_diff = abs(ce_th_prev - mean_oth_prev)
    if th_diff < 0.20:
        q3 = (f"**DYNAMICS DOMINATE** -- therapy prevention rate is similar across all topologies "
              f"(C. elegans = {ce_th_prev:.3f}, synthetic mean = {mean_oth_prev:.3f}, "
              f"diff = {th_diff:.3f}). Aggregation suppression works regardless of wiring.")
    else:
        q3 = (f"**TOPOLOGY CONTRIBUTES** -- therapy effectiveness differs across topologies "
              f"(C. elegans = {ce_th_prev:.3f}, synthetic mean = {mean_oth_prev:.3f}, "
              f"diff = {th_diff:.3f}). Wiring modulates how well aggregation suppression "
              "can prevent cascade spread.")
    lines += [
        "### Q3: Does therapy work because of topology or because aggregation dynamics dominate?",
        "",
        q3, "",
    ]

    # Q4: best/worst topology for degeneration
    sorted_rates = sorted(all_rates.items(), key=lambda x: x[1], reverse=True)
    lines += [
        "### Q4: Which topology best supports or resists runaway degeneration?",
        "",
        "Ranked by genuine_tipping_rate (higher = more susceptible):",
        "",
    ]
    for rank, (t, rate) in enumerate(sorted_rates, 1):
        lines.append(f"  {rank}. **{TOPO_LABEL[t]}**: {rate:.3f}")
    most_susc   = sorted_rates[0]
    most_resist = sorted_rates[-1]
    lines += [
        "",
        f"**Most susceptible:** {TOPO_LABEL[most_susc[0]]} (rate = {most_susc[1]:.3f})",
        f"**Most resistant:**   {TOPO_LABEL[most_resist[0]]} (rate = {most_resist[1]:.3f})",
        "",
    ]

    # Q5: which Phase 5/6 conclusions survive?
    lines += [
        "### Q5: Which previous conclusions survive topology validation?",
        "",
    ]
    if rate_range < 0.30:
        lines.append(
            "- **Triphasic degeneration is robust**: the pattern emerges across all graph types, "
            "not just C. elegans. The biophysical cascade (aggregation -> ATP -> health loss) "
            "is the primary driver, not the specific wiring."
        )
    else:
        lines.append(
            "- **Triphasic degeneration is topology-sensitive**: the C. elegans wiring "
            "specifically enables the degeneration pattern seen in Phases 5-7B."
        )
    if th_diff < 0.20:
        lines.append(
            "- **Therapy recommendations are topology-independent**: Phase 6 conclusions "
            "about early aggregation suppression (start_t=13, strength=0.855) should "
            "generalize across different network architectures."
        )
    else:
        lines.append(
            "- **Therapy recommendations may be topology-specific**: Phase 6 conclusions "
            "should be validated for any new connectome topology before applying."
        )
    if abs(ce_coh - mean_oth_coh) < 0.10:
        lines.append(
            "- **Spatial coherence (Phase 7B criterion) is driven by vulnerability, not wiring**: "
            "the coherence criterion is valid for null-model discrimination regardless of "
            "graph type."
        )
    lines += ["",
              "---",
              "_Generated by `phase7c_topology.py` -- ALS connectome project Phase 7C_"]

    return "\n".join(lines)


# ============================================================
# Main
# ============================================================

def main():
    t0 = time.time()

    print("=" * 70)
    print("Phase 7C -- Topology Validation")
    print("=" * 70)
    print(f"Graph types : C.elegans(x1) + ER/BA/WS/Shuffled(x{N_TOPO})")
    print(f"Configs     : {N_CONFIGS}  Seeds: {N_SEEDS}  "
          f"Steps(base): {STEPS}  Steps(ther): {STEPS_TH}")
    total_runs = (1 + 4 * N_TOPO) * N_CONFIGS * N_SEEDS * 2
    print(f"Total runs  : ~{total_runs}")
    print()

    # Load top-10 Phase 5 critical configs
    with open("results/critical_configs.json") as f:
        crit_data = json.load(f)
    top_cfgs = crit_data["configs"][:N_CONFIGS]
    print(f"Loaded top-{N_CONFIGS} Phase 5 critical configs")
    print()

    # ---- Generate topology instances ----------------------------------------
    rng_gen  = np.random.default_rng(7654)
    ce_edges = celegan_edges()

    print("Generating topology instances ...")
    topo_edges = {
        "celegans": [ce_edges],
        "er":       [gen_er(N, N_EDGES, rng_gen)           for _ in range(N_TOPO)],
        "ba":       [gen_ba(N, N_EDGES, rng_gen)           for _ in range(N_TOPO)],
        "ws":       [gen_ws(N, N_EDGES, rng_gen)           for _ in range(N_TOPO)],
        "shuffled": [gen_shuffled(ce_edges, 1000, rng_gen) for _ in range(N_TOPO)],
    }
    print(f"  Done ({time.time()-t0:.0f}s)")
    print()

    # ---- Topology metrics ----------------------------------------------------
    print("Computing topology metrics ...")
    topo_metrics = {}
    for t, el_list in topo_edges.items():
        all_m = [compute_topo_metrics(el, N) for el in el_list]
        topo_metrics[t] = _avg_metrics(all_m)
        m = topo_metrics[t]
        print(f"  {t:<12}  edges={m.get('n_edges','?')}  "
              f"deg_var={m.get('degree_variance','?')}  "
              f"clust={m.get('avg_clustering','?')}  "
              f"path={m.get('avg_shortest_path','?')}  "
              f"bridges={m.get('n_bridges','?')}")
    print()

    # ---- Baseline runs -------------------------------------------------------
    print("BASELINE simulations ...")
    base_results = {}
    for t, el_list in topo_edges.items():
        n_inst = len(el_list)
        n_runs = n_inst * N_CONFIGS * N_SEEDS
        print(f"  {t:<12} ({n_inst} instance(s), {n_runs} runs) ... ",
              end="", flush=True)
        r = analyse_topo(t, el_list, top_cfgs, therapy=None)
        base_results[t] = r
        print(f"genuine={r['genuine_tipping_rate']:.3f}  "
              f"coh={r['mean_spatial_coh']:.3f}  "
              f"tip={r['mean_tipping_step']:.0f}  "
              f"({time.time()-t0:.0f}s)")
    print()

    # ---- Therapy runs --------------------------------------------------------
    print("THERAPY simulations (agg_sup str=0.855 start_t=13) ...")
    ther_results = {}
    for t, el_list in topo_edges.items():
        n_inst = len(el_list)
        n_runs = n_inst * N_CONFIGS * N_SEEDS
        print(f"  {t:<12} ({n_inst} instance(s), {n_runs} runs) ... ",
              end="", flush=True)
        r = analyse_topo(t, el_list, top_cfgs, therapy=BEST_THERAPY)
        ther_results[t] = r
        print(f"genuine={r['genuine_tipping_rate']:.3f}  "
              f"prev={r['therapy_prevention_rate']:.3f}  "
              f"plateau={r['mean_plateau']:.1f}  "
              f"({time.time()-t0:.0f}s)")

    elapsed = time.time() - t0
    print(f"\nTotal runtime: {elapsed:.1f}s")
    print()

    # ---- Save JSON -----------------------------------------------------------
    Path("results").mkdir(exist_ok=True)

    output = {
        "experiment": {
            "n_configs":     N_CONFIGS,
            "n_seeds":       N_SEEDS,
            "n_topo":        N_TOPO,
            "steps_base":    STEPS,
            "steps_therapy": STEPS_TH,
            "criterion":     {"slope_thr": SLOPE_THR, "coh_thr": COH_THR,
                              "silent_min": SILENT_MIN, "tipping_thr": TIPPING_THR},
            "best_therapy":  BEST_THERAPY,
        },
        "topology_metrics":  topo_metrics,
        "baseline_results":  base_results,
        "therapy_results":   ther_results,
    }

    with open("results/phase7c_topology.json", "w") as f:
        json.dump(output, f, indent=2)
    print("Saved -> results/phase7c_topology.json")

    report = build_report(base_results, ther_results, topo_metrics)
    with open("results/phase7c_topology_report.md", "w", encoding="utf-8") as f:
        f.write(report)
    print("Saved -> results/phase7c_topology_report.md")


if __name__ == "__main__":
    main()

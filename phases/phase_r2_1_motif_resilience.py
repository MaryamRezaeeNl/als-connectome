"""Phase R2.1 -- Motif Resilience Study.

Question: Can certain connectivity motifs intrinsically resist Tier-2 cascade?

Eight modified connectomes are tested against the C. elegans baseline.
For each topology:
  - top 5 Phase-5 critical configs x 10 seeds x 500 steps
  - Phase 7B strict tipping criterion
  - best therapy: agg_sup strength=0.855, start_t=13
  - graph topology metrics

Outputs:
  results/r2_motif_resilience.json
  results/r2_motif_resilience_report.md
"""

import json
import math
import sys
import os
import time
import numpy as np
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'phases'))

from connectome import (NEURON_NAMES, NODE_TYPES, VULNERABILITY,
                         SYNAPSES, NEUROTRANSMITTER)
from phase5_criticality import CriticalitySimulator

# ── Constants ──────────────────────────────────────────────────────────────────
N              = 61
STEPS          = 500
N_SEEDS        = 10
TIPPING_THR    = 55      # alive < 55 → tipping zone (90% of 61)
SLOPE_THR      = 4.0     # Phase 7B c1: peak 10-step decline
COH_THR        = 0.30    # Phase 7B c2: Pearson r(death order, vulnerability)
SILENT_MIN     = 50      # Phase 7B c3: steps before first death
DEAD_THR       = 0.15    # health threshold for dead
TIER2_WINDOW   = 20      # window for Tier-2 rate detection
TIER2_RATE     = 3.0     # deaths in window to flag Tier-2 activation
BASE_EDGES     = len(SYNAPSES)   # 127
EDGE_TOLERANCE = 0.10            # ±10%

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES], dtype=float)
IDX  = {name: i for i, name in enumerate(NEURON_NAMES)}

BEST_THERAPY = {"strength": 0.855, "start_t": 13}

_P5_KEYS = [
    "aggregationAmplification", "mitochondrialFragility",
    "atpCollapseThreshold", "glutamateSensitivity",
    "calciumStressGain", "oxidativeFeedback", "recoveryIrreversibility",
]


# ── MotifSimulator: CriticalitySimulator with injected synapses ────────────────

class MotifSimulator(CriticalitySimulator):
    """CriticalitySimulator with a custom synapse list replacing SYNAPSES."""

    def __init__(self, seed=42, noise_scale=0.003, params=None, custom_synapses=None):
        # Must be set BEFORE super().__init__, which chains to ConnectomeSimulator
        # and calls self._build_adjacency() via Python's MRO.
        self._custom_synapses = custom_synapses if custom_synapses is not None else SYNAPSES
        super().__init__(seed=seed, noise_scale=noise_scale, params=params)

    def _build_adjacency(self):
        n = self.n
        idx = self.idx
        self.in_edges   = defaultdict(list)
        self.out_edges  = defaultdict(list)
        self.excitotox_W = np.zeros((n, n))

        for pre, post, weight, syn_type in self._custom_synapses:
            if pre not in idx or post not in idx:
                continue
            i, j = idx[pre], idx[post]
            self.in_edges[j].append((i, weight, syn_type))
            self.out_edges[i].append((j, weight, syn_type))
            if NEUROTRANSMITTER.get(pre) == "glutamate" and syn_type == "excitatory":
                self.excitotox_W[j, i] = weight
        # CriticalitySimulator.__init__ rebuilds agg_W from self.in_edges after this.


class MotifTherapySimulator(MotifSimulator):
    """MotifSimulator + aggregation-suppression therapy."""

    def __init__(self, seed, params, custom_synapses, therapy):
        super().__init__(seed=seed, params=params, custom_synapses=custom_synapses)
        self._therapy  = therapy   # {"strength": float, "start_t": int}
        self._step_idx = 0

    def step(self, dt=1.0):
        orig_amp = self.p["aggregationAmplification"]
        if self._step_idx >= self._therapy["start_t"]:
            self.p["aggregationAmplification"] = orig_amp * max(
                0.0, 1.0 - self._therapy["strength"]
            )
        n_alive = super().step(dt)          # CriticalitySimulator.step via MRO
        self.p["aggregationAmplification"] = orig_amp   # restore each step
        self._step_idx += 1
        return n_alive


# ── Motif generators ───────────────────────────────────────────────────────────

def _edge_set(syns):
    return {(p, q) for p, q, _, _ in syns}


def gen_baseline():
    """C. elegans original: 127 directed synapses."""
    return list(SYNAPSES)


def gen_triangle_rich():
    """Add 10 motor→premotor feedback edges, creating CPG-like recurrent triangles."""
    syns     = list(SYNAPSES)
    existing = _edge_set(syns)
    # Closes RIML→AVAL→DA1→RIML and similar loops, modeling CPG feedback circuits
    candidates = [
        ("DA1", "RIML", 0.30, "excitatory"),
        ("DA2", "RIMR", 0.30, "excitatory"),
        ("DA3", "AIBL", 0.30, "excitatory"),
        ("DA4", "AIBR", 0.30, "excitatory"),
        ("DB1", "RIBL", 0.30, "excitatory"),
        ("DB2", "RIBR", 0.30, "excitatory"),
        ("VA1", "AIBL", 0.30, "excitatory"),
        ("VA2", "AIBR", 0.30, "excitatory"),
        ("VB1", "AVJL", 0.30, "excitatory"),
        ("VB2", "AVJR", 0.30, "excitatory"),
    ]
    for c in candidates:
        if (c[0], c[1]) not in existing:
            syns.append(c)
            existing.add((c[0], c[1]))
    return syns   # 137 edges


def gen_bypass_loops():
    """Add 3 cross-hemisphere backup edges for highest-weight bottleneck projections."""
    syns     = list(SYNAPSES)
    existing = _edge_set(syns)
    bypasses = [
        ("PVCR", "AVBL", 0.50, "excitatory"),  # backup of PVCL→AVBL (0.7)
        ("AVAR", "DA1",  0.70, "excitatory"),  # backup of AVAL→DA1  (0.9)
        ("AVBR", "DB1",  0.70, "excitatory"),  # backup of AVBL→DB1  (0.9)
    ]
    for b in bypasses:
        if (b[0], b[1]) not in existing:
            syns.append(b)
            existing.add((b[0], b[1]))
    return syns   # 130 edges


def gen_modular():
    """Scale weights: intra-community ×1.5, inter-community ×0.7."""
    sensory = set(NEURON_NAMES[:6])
    inter   = set(NEURON_NAMES[6:24])

    def community(n):
        if n in sensory: return 0
        if n in inter:   return 1
        return 2

    return [
        (pre, post, min(1.0, w * (1.5 if community(pre) == community(post) else 0.7)), stype)
        for pre, post, w, stype in SYNAPSES
    ]   # 127 edges, weight-modified


def gen_anti_hub():
    """Redistribute 3 distal hub edges (AVAL/AVAR) to underutilized interneurons."""
    to_remove = {("AVAL", "DA9"), ("AVAR", "DA8"), ("AVAL", "VA5")}
    new_syns  = [s for s in SYNAPSES if (s[0], s[1]) not in to_remove]
    existing  = _edge_set(new_syns)
    for a in [("AIBL", "DA9", 0.70, "excitatory"),
              ("AIBR", "DA8", 0.70, "excitatory"),
              ("AIBL", "VA5", 0.70, "excitatory")]:
        if (a[0], a[1]) not in existing:
            new_syns.append(a)
    return new_syns   # 127 edges


def gen_rich_club():
    """Scale edges between top-20%-degree nodes ×1.5."""
    deg = defaultdict(int)
    for pre, post, _, _ in SYNAPSES:
        deg[pre] += 1; deg[post] += 1
    sorted_d = sorted(deg.values(), reverse=True)
    cutoff = sorted_d[max(0, int(N * 0.20) - 1)]   # top ~12 nodes
    rich = {n for n, d in deg.items() if d >= cutoff}
    return [
        (pre, post, min(1.0, w * (1.5 if pre in rich and post in rich else 1.0)), stype)
        for pre, post, w, stype in SYNAPSES
    ]   # 127 edges, weight-modified


def gen_distributed():
    """Swap 5 hub→distal edges for equivalent connections from underused interneurons."""
    to_remove = {("AVBL", "DB5"), ("AVBR", "DB6"),
                 ("AVBL", "VB3"), ("AVAL", "DA5"), ("AVAR", "DA6")}
    new_syns = [s for s in SYNAPSES if (s[0], s[1]) not in to_remove]
    existing = _edge_set(new_syns)
    for a in [("AVDL", "DB5", 0.50, "excitatory"),
              ("AVDR", "DB6", 0.50, "excitatory"),
              ("PVCL", "VB3", 0.40, "excitatory"),
              ("AVEL", "DA5", 0.40, "excitatory"),
              ("AVER", "DA6", 0.40, "excitatory")]:
        if (a[0], a[1]) not in existing:
            new_syns.append(a)
    return new_syns   # 127 edges


def gen_hierarchical():
    """Add 10 sensory→motor skip edges, creating explicit sensorimotor shortcuts."""
    syns     = list(SYNAPSES)
    existing = _edge_set(syns)
    for a in [
        ("PLML", "DA1", 0.40, "excitatory"),
        ("PLMR", "DA2", 0.40, "excitatory"),
        ("ALML", "DB1", 0.40, "excitatory"),
        ("ALMR", "DB2", 0.40, "excitatory"),
        ("AVM",  "VA1", 0.40, "excitatory"),
        ("PVM",  "VA2", 0.40, "excitatory"),
        ("PLML", "DD1", 0.30, "excitatory"),
        ("PLMR", "DD2", 0.30, "excitatory"),
        ("ALML", "VD1", 0.30, "excitatory"),
        ("ALMR", "VD2", 0.30, "excitatory"),
    ]:
        if (a[0], a[1]) not in existing:
            syns.append(a)
            existing.add((a[0], a[1]))
    return syns   # 137 edges


def gen_sparse_chain():
    """Remove 12 redundant premotor→motor edges; preserve chains and primary paths."""
    to_remove = {
        ("RIML", "DA1"), ("RIMR", "DA2"),
        ("RIML", "VA1"), ("RIMR", "VA2"),
        ("RIBL", "DB1"), ("RIBR", "DB2"),
        ("RIBL", "VB1"), ("RIBR", "VB2"),
        ("AVJL", "DB1"), ("AVJR", "DB2"),
        ("PLML", "AVDL"), ("PLMR", "AVDR"),
    }
    return [s for s in SYNAPSES if (s[0], s[1]) not in to_remove]   # 115 edges


MOTIFS = {
    "baseline":      gen_baseline,
    "triangle_rich": gen_triangle_rich,
    "bypass_loops":  gen_bypass_loops,
    "modular":       gen_modular,
    "anti_hub":      gen_anti_hub,
    "rich_club":     gen_rich_club,
    "distributed":   gen_distributed,
    "hierarchical":  gen_hierarchical,
    "sparse_chain":  gen_sparse_chain,
}

BIO_NOTES = {
    "baseline":
        "C. elegans original motor connectome (127 directed synapses, "
        "White et al. 1986 / Cook et al. 2019)",
    "triangle_rich":
        "10 motor->premotor feedback edges added (DA1->RIML, DB1->RIBL, etc.), "
        "creating CPG-like recurrent triangles. Models biological central pattern "
        "generator feedback found in vertebrate spinal cord.",
    "bypass_loops":
        "3 cross-hemisphere backup edges for highest-weight bottleneck projections "
        "(PVCR->AVBL, AVAR->DA1, AVBR->DB1). Models bilateral redundancy that C. elegans "
        "uses for robust locomotion.",
    "modular":
        "Intra-community weights x1.5, inter-community x0.7 (3 communities: sensory, "
        "interneuron, motor). Strengthens local circuits while reducing cross-layer "
        "prion-like spreading pathways.",
    "anti_hub":
        "3 distal hub edges (AVAL->DA9, AVAR->DA8, AVAL->VA5) redistributed to "
        "underused interneurons (AIBL, AIBR). Reduces super-spreader influence of "
        "the two main backward command neurons.",
    "rich_club":
        "Edges between top-20%-degree nodes scaled x1.5. Strengthens backbone "
        "connectivity between hubs. Models ALS-resistant highly-connected circuits "
        "proposed in scale-free network resilience studies.",
    "distributed":
        "5 hub->distal edges replaced by equivalent connections from underutilized "
        "interneurons (AVDL, AVDR, PVCL, AVEL, AVER). Democratises input to distal "
        "motor neurons, reducing cascade bottlenecks.",
    "hierarchical":
        "10 sensory->motor skip-level edges added (PLML->DA1, ALML->DB1, AVM->VA1, "
        "etc.). Creates explicit hierarchical shortcuts bypassing interneuron layer, "
        "mimicking fast reflex arcs in vertebrate spinal circuits.",
    "sparse_chain":
        "12 redundant premotor->motor edges removed. Preserves only core chains and "
        "primary command->motor paths. Negative control: maximally fragile topology "
        "with minimal redundancy.",
}


# ── Graph metrics ──────────────────────────────────────────────────────────────

def _undirected_adj(syns):
    adj = [set() for _ in range(N)]
    for pre, post, _, _ in syns:
        if pre in IDX and post in IDX:
            i, j = IDX[pre], IDX[post]
            adj[i].add(j); adj[j].add(i)
    return adj


def is_weakly_connected(syns):
    adj = _undirected_adj(syns)
    vis = [False] * N
    q = [0]; vis[0] = True; cnt = 1
    while q:
        u = q.pop()
        for v in adj[u]:
            if not vis[v]:
                vis[v] = True; cnt += 1; q.append(v)
    return cnt == N


def clustering_coefficient(syns):
    adj = _undirected_adj(syns)
    total, count = 0.0, 0
    for u in range(N):
        nbrs = adj[u]
        d = len(nbrs)
        if d < 2:
            continue
        triangles = sum(1 for v in nbrs for w in nbrs if v < w and w in adj[v])
        total += triangles / (d * (d - 1) / 2)
        count += 1
    return total / count if count else 0.0


def avg_path_length(syns):
    adj = [[] for _ in range(N)]
    for pre, post, _, _ in syns:
        if pre in IDX and post in IDX:
            adj[IDX[pre]].append(IDX[post])
    total_d = total_p = 0
    for src in range(N):
        dist = [-1] * N
        dist[src] = 0
        q = [src]; head = 0
        while head < len(q):
            u = q[head]; head += 1
            for v in adj[u]:
                if dist[v] == -1:
                    dist[v] = dist[u] + 1; q.append(v)
        for d in dist:
            if d > 0:
                total_d += d; total_p += 1
    return total_d / total_p if total_p else float("inf")


def compute_modularity(syns):
    """Newman modularity for 3 predefined communities."""
    comm = [0]*6 + [1]*18 + [2]*37
    W = np.zeros((N, N))
    for pre, post, w, _ in syns:
        if pre in IDX and post in IDX:
            W[IDX[pre], IDX[post]] = w
    m = W.sum()
    if m == 0:
        return 0.0
    k_out = W.sum(axis=1)
    k_in  = W.sum(axis=0)
    Q = sum(
        W[i, j] - k_out[i] * k_in[j] / m
        for i in range(N) for j in range(N)
        if comm[i] == comm[j]
    )
    return float(Q / m)


def count_bridges(syns):
    """Tarjan bridge detection on undirected projection."""
    adj = _undirected_adj(syns)
    disc = [-1] * N; low = [-1] * N
    timer = [0]; bridges = [0]

    def dfs(u, parent):
        disc[u] = low[u] = timer[0]; timer[0] += 1
        for v in sorted(adj[u]):
            if disc[v] == -1:
                dfs(v, u)
                low[u] = min(low[u], low[v])
                if low[v] > disc[u]:
                    bridges[0] += 1
            elif v != parent:
                low[u] = min(low[u], disc[v])

    for i in range(N):
        if disc[i] == -1:
            dfs(i, -1)
    return bridges[0]


def degree_variance(syns):
    deg = np.zeros(N)
    for pre, post, _, _ in syns:
        if pre in IDX and post in IDX:
            deg[IDX[pre]] += 1; deg[IDX[post]] += 1
    return float(np.var(deg))


def graph_metrics(syns):
    return {
        "n_edges":          len(syns),
        "clustering_coeff": round(clustering_coefficient(syns), 4),
        "avg_path_length":  round(avg_path_length(syns), 3),
        "modularity":       round(compute_modularity(syns), 4),
        "n_bridges":        count_bridges(syns),
        "degree_variance":  round(degree_variance(syns), 2),
    }


# ── Simulation helpers ─────────────────────────────────────────────────────────

def _pearson_r(x, y):
    if len(x) < 3:
        return 0.0
    mx, my = np.mean(x), np.mean(y)
    num = np.sum((x - mx) * (y - my))
    den = np.sqrt(np.sum((x - mx)**2) * np.sum((y - my)**2))
    return float(num / den) if den > 1e-12 else 0.0


def detect_tier2(hist):
    """First step where 20-step death rate > TIER2_RATE after >= 5 total deaths."""
    for t in range(TIER2_WINDOW, len(hist)):
        if N - hist[t] >= 5 and hist[t - TIER2_WINDOW] - hist[t] > TIER2_RATE:
            return t + 1
    return STEPS


def run_one(params, seed, syns, with_therapy=False):
    if with_therapy:
        sim = MotifTherapySimulator(seed=seed, params=params,
                                     custom_synapses=syns, therapy=BEST_THERAPY)
    else:
        sim = MotifSimulator(seed=seed, params=params, custom_synapses=syns)

    death_step = np.full(N, STEPS, dtype=int)
    hist = []
    for t in range(STEPS):
        n_alive = sim.step()
        hist.append(n_alive)
        newly_dead = (sim.health <= DEAD_THR) & (death_step == STEPS)
        death_step[newly_dead] = t + 1

    tipping   = next((t + 1 for t, a in enumerate(hist) if a < TIPPING_THR), STEPS)
    silent    = next((t + 1 for t, a in enumerate(hist) if a < N),           STEPS)
    rates     = [hist[t] - hist[t + 10] for t in range(len(hist) - 10)]
    peak_rate = float(max(rates)) if rates else 0.0
    plateau   = int(hist[-1])

    died = death_step < STEPS
    coh_r = _pearson_r(VULN[died], -death_step[died].astype(float)) if died.sum() >= 3 else 0.0

    return {
        "tipping_step": tipping,
        "silent_end":   silent,
        "peak_rate":    peak_rate,
        "plateau":      plateau,
        "coh_r":        float(coh_r),
        "tier2_step":   detect_tier2(hist),
    }


def strict_criterion(rows):
    tips  = [r["tipping_step"] for r in rows]
    sils  = [r["silent_end"]   for r in rows]
    peaks = [r["peak_rate"]    for r in rows]
    crs   = [r["coh_r"]        for r in rows]
    c1 = float(np.median(peaks)) > SLOPE_THR
    c2 = float(np.median(crs))   > COH_THR
    c3 = float(np.median(sils))  > SILENT_MIN
    return {
        "is_genuine":    bool(c1 and c2 and c3),
        "c1_slope":      bool(c1),
        "c2_coherence":  bool(c2),
        "c3_silent":     bool(c3),
        "tip_median":    round(float(np.median(tips)), 1),
        "silent_median": round(float(np.median(sils)),  1),
        "peak_median":   round(float(np.median(peaks)), 2),
        "coh_r_median":  round(float(np.median(crs)),   3),
    }


# ── Per-topology runner ────────────────────────────────────────────────────────

def run_topology(name, syns, top5):
    t0 = time.time()

    # Validate edge count and connectivity
    ne = len(syns)
    assert int(BASE_EDGES * 0.90) <= ne <= int(BASE_EDGES * 1.10), \
        f"{name}: {ne} edges outside tolerance"
    assert is_weakly_connected(syns), f"{name}: graph disconnected"

    gm = graph_metrics(syns)
    config_results = []

    for cfg in top5:
        cid    = cfg["id"]
        params = {k: cfg["params"][k] for k in _P5_KEYS}

        base_rows    = []
        therapy_rows = []
        for k in range(N_SEEDS):
            seed = cid + 100 + k * 1000
            base_rows.append(   run_one(params, seed, syns, with_therapy=False))
            therapy_rows.append(run_one(params, seed, syns, with_therapy=True))

        crit = strict_criterion(base_rows)

        base_tips    = [r["tipping_step"] for r in base_rows]
        ther_tips    = [r["tipping_step"] for r in therapy_rows]
        base_plats   = [r["plateau"]      for r in base_rows]
        ther_plats   = [r["plateau"]      for r in therapy_rows]
        tier2s       = [r["tier2_step"]   for r in base_rows]
        coh_rs       = [r["coh_r"]        for r in base_rows]

        therapy_delays = [ther_tips[k] - base_tips[k] for k in range(N_SEEDS)]
        prevented = [
            int(ther_tips[k] - base_tips[k] > 50 or ther_plats[k] > 20)
            for k in range(N_SEEDS)
        ]

        config_results.append({
            "config_id":              cid,
            "criterion":              crit,
            "mean_tipping_step":      round(float(np.mean(base_tips)),    1),
            "mean_coherence_r":       round(float(np.mean(coh_rs)),        3),
            "mean_tier2_step":        round(float(np.mean(tier2s)),        1),
            "mean_plateau":           round(float(np.mean(base_plats)),    2),
            "therapy_prevention_rate":round(float(np.mean(prevented)),    3),
            "mean_therapy_delay":     round(float(np.mean(therapy_delays)),1),
            "mean_therapy_plateau":   round(float(np.mean(ther_plats)),    2),
        })

    # Aggregate over 5 configs
    agg = lambda key: float(np.mean([c[key] for c in config_results]))

    return {
        "motif_name":              name,
        "biological_note":         BIO_NOTES[name],
        "graph_metrics":           gm,
        "config_results":          config_results,
        "genuine_tipping_rate":    round(float(np.mean([c["criterion"]["is_genuine"] for c in config_results])), 3),
        "mean_tipping_step":       round(agg("mean_tipping_step"),       1),
        "mean_coherence_r":        round(agg("mean_coherence_r"),        3),
        "tier2_activation_step":   round(agg("mean_tier2_step"),         1),
        "plateau_survivors":       round(agg("mean_plateau"),            2),
        "therapy_prevention_rate": round(agg("therapy_prevention_rate"), 3),
        "mean_therapy_delay":      round(agg("mean_therapy_delay"),      1),
        "runtime_s":               round(time.time() - t0, 1),
    }


# ── RES score ──────────────────────────────────────────────────────────────────

def compute_res(all_results):
    """
    RES = 0.3*(tipping_delay/baseline)
        + 0.3*(therapy_window/baseline)
        + 0.2*(plateau/baseline)
        + 0.2*(1 - collapse_velocity/baseline)

    collapse_velocity = 1/mean_tipping_step
    therapy_window    = mean_therapy_delay
    """
    b = next(r for r in all_results if r["motif_name"] == "baseline")
    b_tip  = b["mean_tipping_step"]
    b_tw   = b["mean_therapy_delay"]
    b_plat = b["plateau_survivors"]

    scores = []
    for r in all_results:
        tip  = r["mean_tipping_step"]
        tw   = r["mean_therapy_delay"]
        plat = r["plateau_survivors"]

        td_ratio = tip / b_tip if b_tip > 0 else 1.0
        tw_ratio = (tw + 1.0) / (b_tw + 1.0)
        pl_ratio = (plat + 0.1) / (b_plat + 0.1)
        cv_term  = (1.0 - b_tip / tip) if tip > 0 else 0.0   # >0 if motif slower

        res = 0.3*td_ratio + 0.3*tw_ratio + 0.2*pl_ratio + 0.2*cv_term
        scores.append({
            "motif_name": r["motif_name"],
            "RES":        round(res,      4),
            "td_ratio":   round(td_ratio, 3),
            "tw_ratio":   round(tw_ratio, 3),
            "pl_ratio":   round(pl_ratio, 3),
            "cv_term":    round(cv_term,  3),
        })

    return sorted(scores, key=lambda x: -x["RES"])


# ── Markdown report ────────────────────────────────────────────────────────────

def write_report(all_results, res_scores, path):
    lines = []
    A = lines.append

    A("# Phase R2.1 -- Motif Resilience Study\n")
    A("**Question**: Can connectivity motifs intrinsically resist Tier-2 cascade activation?\n")
    A("**Method**: 8 modified connectomes + C. elegans baseline; top 5 Phase-5 critical "
      "configs × 10 seeds × 500 steps; Phase 7B strict criterion; best therapy "
      "(agg_sup strength=0.855, start_t=13).\n")

    A("## 1. Summary\n")
    A("| Rank | Topology | RES | Genuine% | Mean Tip | Tier2 Step | Prev Rate | Therapy Delay |")
    A("|------|----------|-----|----------|----------|------------|-----------|---------------|")
    for i, rs in enumerate(res_scores, 1):
        r = next(x for x in all_results if x["motif_name"] == rs["motif_name"])
        A("| %d | %-16s | %.3f | %.0f%% | %.0f | %.0f | %.0f%% | %.0f |" % (
            i, rs["motif_name"], rs["RES"],
            r["genuine_tipping_rate"] * 100,
            r["mean_tipping_step"],
            r["tier2_activation_step"],
            r["therapy_prevention_rate"] * 100,
            r["mean_therapy_delay"],
        ))

    A("\n## 2. Graph Topology Metrics\n")
    A("| Topology | Edges | Clustering | Avg Path | Modularity | Bridges | Deg Variance |")
    A("|----------|-------|------------|----------|------------|---------|--------------|")
    for r in all_results:
        gm = r["graph_metrics"]
        A("| %-16s | %3d | %.4f | %.3f | %.4f | %2d | %.1f |" % (
            r["motif_name"], gm["n_edges"], gm["clustering_coeff"],
            gm["avg_path_length"], gm["modularity"],
            gm["n_bridges"], gm["degree_variance"],
        ))

    A("\n## 3. RES Component Breakdown\n")
    A("RES = 0.3*(tipping_delay_ratio) + 0.3*(therapy_window_ratio) "
      "+ 0.2*(plateau_ratio) + 0.2*(1 - collapse_velocity_ratio)\n")
    A("Baseline RES = 0.3×1 + 0.3×1 + 0.2×1 + 0.2×0 = **0.800**. "
      "Values > 0.800 indicate improvement over baseline.\n")
    A("| Topology | RES | TD_ratio | TW_ratio | PL_ratio | CV_term |")
    A("|----------|-----|----------|----------|----------|---------|")
    for rs in res_scores:
        A("| %-16s | %.3f | %.3f | %.3f | %.3f | %.3f |" % (
            rs["motif_name"], rs["RES"],
            rs["td_ratio"], rs["tw_ratio"], rs["pl_ratio"], rs["cv_term"],
        ))

    A("\n## 4. Topology Descriptions and Biological Interpretation\n")
    for r in all_results:
        A("### %s\n" % r["motif_name"])
        A(r["biological_note"] + "\n")
        gm = r["graph_metrics"]
        A("- **Edges**: %d  |  **Clustering**: %.4f  |  **Avg path**: %.3f  "
          "|  **Modularity**: %.4f  |  **Bridges**: %d  |  **Degree variance**: %.1f" % (
              gm["n_edges"], gm["clustering_coeff"], gm["avg_path_length"],
              gm["modularity"], gm["n_bridges"], gm["degree_variance"]))
        rs = next(x for x in res_scores if x["motif_name"] == r["motif_name"])
        A("- **RES**: %.3f  |  **Genuine rate**: %.0f%%  |  "
          "**Mean tipping step**: %.0f  |  **Tier-2 activation**: %.0f  |  "
          "**Therapy prevention**: %.0f%%  |  **Therapy delay**: %.0f steps\n" % (
              rs["RES"],
              r["genuine_tipping_rate"] * 100,
              r["mean_tipping_step"],
              r["tier2_activation_step"],
              r["therapy_prevention_rate"] * 100,
              r["mean_therapy_delay"],
          ))

    A("## 5. Key Findings\n")
    best  = res_scores[0]
    worst = res_scores[-1]
    best_r  = next(x for x in all_results if x["motif_name"] == best["motif_name"])
    worst_r = next(x for x in all_results if x["motif_name"] == worst["motif_name"])
    base_r  = next(x for x in all_results if x["motif_name"] == "baseline")

    A("1. **Best motif**: %s (RES=%.3f), %.0f steps mean tipping delay vs %.0f baseline." % (
        best["motif_name"], best["RES"],
        best_r["mean_tipping_step"], base_r["mean_tipping_step"]))
    A("2. **Worst motif**: %s (RES=%.3f); "
      "%.0f steps mean tipping delay." % (
          worst["motif_name"], worst["RES"], worst_r["mean_tipping_step"]))
    A("3. **Tier-2 resistance**: topology with latest Tier-2 activation: %s (step %.0f vs %.0f baseline)." % (
        max(all_results, key=lambda x: x["tier2_activation_step"])["motif_name"],
        max(all_results, key=lambda x: x["tier2_activation_step"])["tier2_activation_step"],
        base_r["tier2_activation_step"]))
    A("4. **Therapy amplification**: topology with highest therapy prevention rate: %s (%.0f%%)." % (
        max(all_results, key=lambda x: x["therapy_prevention_rate"])["motif_name"],
        max(all_results, key=lambda x: x["therapy_prevention_rate"])["therapy_prevention_rate"] * 100))

    path.write_text("\n".join(lines), encoding="utf-8")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    with open("results/critical_configs.json", encoding="utf-8") as f:
        top5 = json.load(f)["configs"][:5]

    print("Phase R2.1 -- Motif Resilience Study")
    print("%d topologies x %d configs x %d seeds x 2 runs = %d simulations" % (
        len(MOTIFS), len(top5), N_SEEDS, len(MOTIFS) * len(top5) * N_SEEDS * 2))
    print()

    all_results = []
    for name, gen_fn in MOTIFS.items():
        print("[%s]" % name, end=" ", flush=True)
        syns = gen_fn()
        result = run_topology(name, syns, top5)
        all_results.append(result)
        print("genuine=%.0f%% tip=%.0f tier2=%.0f prev=%.0f%% RES=? (%.1fs)" % (
            result["genuine_tipping_rate"] * 100,
            result["mean_tipping_step"],
            result["tier2_activation_step"],
            result["therapy_prevention_rate"] * 100,
            result["runtime_s"],
        ))

    res_scores = compute_res(all_results)

    print()
    print("RES RANKING:")
    for rs in res_scores:
        print("  %-16s  RES=%.3f" % (rs["motif_name"], rs["RES"]))

    Path("results").mkdir(exist_ok=True)

    out = {
        "description":  "Phase R2.1 Motif Resilience Study",
        "n_topologies": len(MOTIFS),
        "n_configs":    len(top5),
        "n_seeds":      N_SEEDS,
        "steps":        STEPS,
        "therapy":      BEST_THERAPY,
        "res_scores":   res_scores,
        "topologies":   all_results,
    }
    with open("results/r2_motif_resilience.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("\nSaved -> results/r2_motif_resilience.json")

    write_report(all_results, res_scores, Path("results/r2_motif_resilience_report.md"))
    print("Saved -> results/r2_motif_resilience_report.md")


if __name__ == "__main__":
    main()

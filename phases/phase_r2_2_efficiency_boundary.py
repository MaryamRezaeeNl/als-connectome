"""Phase R2.2 -- Efficiency vs Resilience Boundary.

For 6 topology families, sweeps motif_strength in [0,10,20,40,60,80,100]%
where 0% = C. elegans baseline and 100% = full R2.1 implementation.

Measures at each (topology, strength) point:
  Degeneration: genuine_tipping_rate, tipping_step, plateau_survivors,
                collapse_velocity, tier2_activation_step
  Communication: global_efficiency, clustering_coefficient, modularity
  Therapy:       therapy_window_width, prevention_rate

Computes DEI (Degeneration Efficiency Index):
  DEI = delta_efficiency / (delta_vulnerability + eps)

Detects per topology:
  safe_zone            -- strengths where efficiency up, vulnerability stable
  critical_threshold   -- strength where tipping_rate jumps >10pp above baseline
  transition_type      -- gradual vs sharp

Answers 5 scientific questions in the report.

Outputs:
  results/r2_efficiency_boundary.json
  results/r2_tradeoff_landscape.json
  results/round2_efficiency_boundary_report.md
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
N            = 61
STEPS        = 300
N_SEEDS      = 5
TIPPING_THR  = 55
SLOPE_THR    = 4.0
COH_THR      = 0.30
SILENT_MIN   = 50
DEAD_THR     = 0.15
TIER2_WINDOW = 20
TIER2_RATE   = 3.0
DEI_EPS      = 0.001    # floor for DEI denominator
CRITICAL_JUMP = 0.10   # genuine_rate must exceed baseline + this to flag "critical"

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES], dtype=float)
IDX  = {name: i for i, name in enumerate(NEURON_NAMES)}

BEST_THERAPY = {"strength": 0.855, "start_t": 13}

_P5_KEYS = [
    "aggregationAmplification", "mitochondrialFragility",
    "atpCollapseThreshold", "glutamateSensitivity",
    "calciumStressGain", "oxidativeFeedback", "recoveryIrreversibility",
]

STRENGTHS = [0, 10, 20, 40, 60, 80, 100]


# ── MotifSimulator ─────────────────────────────────────────────────────────────

class MotifSimulator(CriticalitySimulator):
    def __init__(self, seed=42, noise_scale=0.003, params=None, custom_synapses=None):
        self._custom_synapses = custom_synapses if custom_synapses is not None else SYNAPSES
        super().__init__(seed=seed, noise_scale=noise_scale, params=params)

    def _build_adjacency(self):
        n, idx = self.n, self.idx
        self.in_edges    = defaultdict(list)
        self.out_edges   = defaultdict(list)
        self.excitotox_W = np.zeros((n, n))
        for pre, post, weight, syn_type in self._custom_synapses:
            if pre not in idx or post not in idx:
                continue
            i, j = idx[pre], idx[post]
            self.in_edges[j].append((i, weight, syn_type))
            self.out_edges[i].append((j, weight, syn_type))
            if NEUROTRANSMITTER.get(pre) == "glutamate" and syn_type == "excitatory":
                self.excitotox_W[j, i] = weight


class MotifTherapySimulator(MotifSimulator):
    def __init__(self, seed, params, custom_synapses, therapy):
        super().__init__(seed=seed, params=params, custom_synapses=custom_synapses)
        self._therapy  = therapy
        self._step_idx = 0

    def step(self, dt=1.0):
        orig = self.p["aggregationAmplification"]
        if self._step_idx >= self._therapy["start_t"]:
            self.p["aggregationAmplification"] = orig * max(
                0.0, 1.0 - self._therapy["strength"])
        n_alive = super().step(dt)
        self.p["aggregationAmplification"] = orig
        self._step_idx += 1
        return n_alive


# ── Strength-parameterised motif generators ────────────────────────────────────

def _edge_set(syns):
    return {(p, q) for p, q, _, _ in syns}

# ordered removal / addition lists (same as R2.1, now with explicit priority)
_SC_REMOVE = [
    ("RIML", "DA1"), ("RIMR", "DA2"),
    ("RIML", "VA1"), ("RIMR", "VA2"),
    ("RIBL", "DB1"), ("RIBR", "DB2"),
    ("RIBL", "VB1"), ("RIBR", "VB2"),
    ("AVJL", "DB1"), ("AVJR", "DB2"),
    ("PLML", "AVDL"), ("PLMR", "AVDR"),
]   # 12 target edges

_TR_ADD = [
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
]   # 10 feedback edges

_BP_ADD = [
    ("PVCR", "AVBL", 0.50, "excitatory"),
    ("AVAR", "DA1",  0.70, "excitatory"),
    ("AVBR", "DB1",  0.70, "excitatory"),
]   # 3 bypass edges

_DI_REMOVE = [
    ("AVBL", "DB5"), ("AVBR", "DB6"),
    ("AVBL", "VB3"), ("AVAL", "DA5"), ("AVAR", "DA6"),
]
_DI_ADD = [
    ("AVDL", "DB5", 0.50, "excitatory"),
    ("AVDR", "DB6", 0.50, "excitatory"),
    ("PVCL", "VB3", 0.40, "excitatory"),
    ("AVEL", "DA5", 0.40, "excitatory"),
    ("AVER", "DA6", 0.40, "excitatory"),
]   # 5 swaps

# Identify rich-club nodes once (same as R2.1)
def _rich_club_nodes():
    deg = defaultdict(int)
    for pre, post, _, _ in SYNAPSES:
        deg[pre] += 1; deg[post] += 1
    sorted_d = sorted(deg.values(), reverse=True)
    cutoff = sorted_d[max(0, int(N * 0.20) - 1)]
    return {n for n, d in deg.items() if d >= cutoff}

_RICH = _rich_club_nodes()

# Sensory / interneuron community membership (for modular)
_SENSORY = set(NEURON_NAMES[:6])
_INTER   = set(NEURON_NAMES[6:24])
def _community(name):
    if name in _SENSORY: return 0
    if name in _INTER:   return 1
    return 2


def _make_sparse_chain(s):
    """Remove floor(12*s/100) edges in priority order."""
    n = int(len(_SC_REMOVE) * s / 100)
    drop = set(_SC_REMOVE[:n])
    return [e for e in SYNAPSES if (e[0], e[1]) not in drop]

def _make_triangle_rich(s):
    """Add floor(10*s/100) feedback edges in priority order."""
    n    = int(len(_TR_ADD) * s / 100)
    syns = list(SYNAPSES)
    ex   = _edge_set(syns)
    for e in _TR_ADD[:n]:
        if (e[0], e[1]) not in ex:
            syns.append(e); ex.add((e[0], e[1]))
    return syns

def _make_modular(s):
    """Interpolate intra/inter weights by strength fraction."""
    f = s / 100.0
    intra = 1.0 + 0.5 * f
    inter = 1.0 - 0.3 * f
    return [
        (pre, post, min(1.0, w * (intra if _community(pre) == _community(post) else inter)), t)
        for pre, post, w, t in SYNAPSES
    ]

def _make_rich_club(s):
    """Interpolate rich-club edge weight boost by strength fraction."""
    f     = s / 100.0
    scale = 1.0 + 0.5 * f
    return [
        (pre, post, min(1.0, w * (scale if pre in _RICH and post in _RICH else 1.0)), t)
        for pre, post, w, t in SYNAPSES
    ]

def _make_distributed(s):
    """Swap floor(5*s/100) hub→distal edges for distributed equivalents."""
    n    = int(len(_DI_REMOVE) * s / 100)
    drop = set(_DI_REMOVE[:n])
    syns = [e for e in SYNAPSES if (e[0], e[1]) not in drop]
    ex   = _edge_set(syns)
    for a in _DI_ADD[:n]:
        if (a[0], a[1]) not in ex:
            syns.append(a)
    return syns

def _make_bypass_loops(s):
    """Add floor(3*s/100) bypass edges in priority order."""
    n    = int(len(_BP_ADD) * s / 100)
    syns = list(SYNAPSES)
    ex   = _edge_set(syns)
    for e in _BP_ADD[:n]:
        if (e[0], e[1]) not in ex:
            syns.append(e); ex.add((e[0], e[1]))
    return syns


FAMILIES = {
    "sparse_chain":  _make_sparse_chain,
    "triangle_rich": _make_triangle_rich,
    "modular":       _make_modular,
    "rich_club":     _make_rich_club,
    "distributed":   _make_distributed,
    "bypass_loops":  _make_bypass_loops,
}


# ── Graph metrics ──────────────────────────────────────────────────────────────

def _undirected_adj(syns):
    adj = [set() for _ in range(N)]
    for pre, post, _, _ in syns:
        if pre in IDX and post in IDX:
            i, j = IDX[pre], IDX[post]
            adj[i].add(j); adj[j].add(i)
    return adj

def _directed_adj(syns):
    adj = [[] for _ in range(N)]
    for pre, post, _, _ in syns:
        if pre in IDX and post in IDX:
            adj[IDX[pre]].append(IDX[post])
    return adj

def _bfs_distances(adj, src):
    dist = [-1] * N
    dist[src] = 0
    q = [src]; head = 0
    while head < len(q):
        u = q[head]; head += 1
        for v in adj[u]:
            if dist[v] == -1:
                dist[v] = dist[u] + 1; q.append(v)
    return dist

def global_efficiency(syns):
    """Mean of 1/d_ij over all ordered pairs i!=j (harmonic mean of distances)."""
    adj = _directed_adj(syns)
    total = 0.0
    pairs = N * (N - 1)
    for src in range(N):
        dist = _bfs_distances(adj, src)
        total += sum(1.0 / d for d in dist if d > 0)
    return total / pairs if pairs else 0.0

def clustering_coefficient(syns):
    adj = _undirected_adj(syns)
    total, count = 0.0, 0
    for u in range(N):
        nbrs = adj[u]; d = len(nbrs)
        if d < 2: continue
        t = sum(1 for v in nbrs for w in nbrs if v < w and w in adj[v])
        total += t / (d * (d - 1) / 2); count += 1
    return total / count if count else 0.0

def compute_modularity(syns):
    comm = [0]*6 + [1]*18 + [2]*37
    W = np.zeros((N, N))
    for pre, post, w, _ in syns:
        if pre in IDX and post in IDX:
            W[IDX[pre], IDX[post]] = w
    m = W.sum()
    if m == 0: return 0.0
    k_out = W.sum(axis=1); k_in = W.sum(axis=0)
    Q = sum(
        W[i, j] - k_out[i] * k_in[j] / m
        for i in range(N) for j in range(N) if comm[i] == comm[j]
    )
    return float(Q / m)

def avg_path_length(syns):
    adj = _directed_adj(syns)
    total_d = total_p = 0
    for src in range(N):
        dist = _bfs_distances(adj, src)
        for d in dist:
            if d > 0: total_d += d; total_p += 1
    return total_d / total_p if total_p else float("inf")

def comm_metrics(syns):
    return {
        "global_efficiency":  round(global_efficiency(syns),       4),
        "clustering_coeff":   round(clustering_coefficient(syns),   4),
        "modularity":         round(compute_modularity(syns),       4),
        "avg_path_length":    round(avg_path_length(syns),          3),
    }


# ── Simulation helpers ─────────────────────────────────────────────────────────

def _pearson_r(x, y):
    if len(x) < 3: return 0.0
    mx, my = np.mean(x), np.mean(y)
    num = np.sum((x - mx) * (y - my))
    den = np.sqrt(np.sum((x - mx)**2) * np.sum((y - my)**2))
    return float(num / den) if den > 1e-12 else 0.0

def detect_tier2(hist):
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
        "tip_median":    round(float(np.median(tips)), 1),
        "silent_median": round(float(np.median(sils)),  1),
        "peak_median":   round(float(np.median(peaks)), 2),
        "coh_r_median":  round(float(np.median(crs)),   3),
    }


# ── Point runner ───────────────────────────────────────────────────────────────

def run_point(syns, top5):
    """Return aggregated metrics for one (topology, strength) point."""
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

        crit  = strict_criterion(base_rows)
        b_tips  = [r["tipping_step"] for r in base_rows]
        t_tips  = [r["tipping_step"] for r in therapy_rows]
        b_plats = [r["plateau"]      for r in base_rows]
        t_plats = [r["plateau"]      for r in therapy_rows]
        tier2s  = [r["tier2_step"]   for r in base_rows]
        coh_rs  = [r["coh_r"]        for r in base_rows]
        peaks   = [r["peak_rate"]    for r in base_rows]

        delays   = [t_tips[k] - b_tips[k] for k in range(N_SEEDS)]
        prev_ok  = [int(delays[k] > 50 or t_plats[k] > 20) for k in range(N_SEEDS)]

        config_results.append({
            "is_genuine":         crit["is_genuine"],
            "mean_tipping_step":  float(np.mean(b_tips)),
            "mean_plateau":       float(np.mean(b_plats)),
            "mean_coh_r":         float(np.mean(coh_rs)),
            "mean_tier2_step":    float(np.mean(tier2s)),
            "mean_peak_rate":     float(np.mean(peaks)),
            "prevention_rate":    float(np.mean(prev_ok)),
            "mean_therapy_delay": float(np.mean(delays)),
        })

    def _agg(k): return float(np.mean([c[k] for c in config_results]))

    return {
        "genuine_tipping_rate": round(float(np.mean([c["is_genuine"] for c in config_results])), 3),
        "mean_tipping_step":    round(_agg("mean_tipping_step"),  1),
        "plateau_survivors":    round(_agg("mean_plateau"),       2),
        "collapse_velocity":    round(_agg("mean_peak_rate"),     3),
        "tier2_activation":     round(_agg("mean_tier2_step"),    1),
        "prevention_rate":      round(_agg("prevention_rate"),    3),
        "therapy_window_width": round(_agg("mean_therapy_delay"), 1),
    }


# ── DEI and boundary analysis ──────────────────────────────────────────────────

def compute_dei(sweep_data):
    """Attach DEI and delta fields; baseline is the S=0 entry."""
    b = sweep_data[0]  # strength=0 always first
    b_eff  = b["global_efficiency"]
    b_rate = b["genuine_tipping_rate"]

    for pt in sweep_data:
        delta_eff  = pt["global_efficiency"] - b_eff
        delta_vuln = pt["genuine_tipping_rate"] - b_rate
        denom      = delta_vuln + DEI_EPS
        dei        = float(np.clip(delta_eff / denom, -100, 100))
        pt["delta_efficiency"]  = round(delta_eff,  4)
        pt["delta_vulnerability"] = round(delta_vuln, 3)
        pt["DEI"]               = round(dei,        4)
    return sweep_data


def find_safe_zone(sweep_data):
    """Strengths where delta_eff >= 0 AND genuine_rate <= baseline + CRITICAL_JUMP/2."""
    b_rate = sweep_data[0]["genuine_tipping_rate"]
    safe = [pt["strength"] for pt in sweep_data
            if pt["delta_efficiency"] >= 0 and
               pt["genuine_tipping_rate"] <= b_rate + CRITICAL_JUMP / 2]
    return safe if safe else []


def find_critical_threshold(sweep_data):
    """Lowest strength where genuine_rate > baseline_rate + CRITICAL_JUMP."""
    b_rate = sweep_data[0]["genuine_tipping_rate"]
    for pt in sweep_data[1:]:
        if pt["genuine_tipping_rate"] > b_rate + CRITICAL_JUMP:
            return pt["strength"]
    return None


def transition_type(sweep_data):
    """Classify how genuine_tipping_rate changes across strengths."""
    rates = [pt["genuine_tipping_rate"] for pt in sweep_data]
    diffs = [abs(rates[i + 1] - rates[i]) for i in range(len(rates) - 1)]
    if not diffs:
        return "flat"
    max_jump = max(diffs)
    mean_ch  = np.mean(diffs)
    if max_jump >= 0.30:
        return "sharp"
    if mean_ch <= 0.03:
        return "flat"
    return "gradual"


def has_optimal_intermediate(sweep_data):
    """True if any S in (0,100) has better plateau AND better efficiency than both 0% and 100%."""
    b  = sweep_data[0]
    hi = sweep_data[-1]
    for pt in sweep_data[1:-1]:
        if (pt["plateau_survivors"] > b["plateau_survivors"] and
                pt["plateau_survivors"] > hi["plateau_survivors"] and
                pt["global_efficiency"] > b["global_efficiency"]):
            return True, pt["strength"]
    return False, None


# ── 5 scientific questions ─────────────────────────────────────────────────────

def answer_questions(all_topology_data, baseline_eff):
    answers = {}

    # Q1: Universal efficiency-resilience tradeoff?
    delta_effs   = []
    delta_vulns  = []
    for td in all_topology_data:
        for pt in td["sweep_data"][1:]:
            delta_effs.append(pt["delta_efficiency"])
            delta_vulns.append(pt["delta_vulnerability"])
    de = np.array(delta_effs)
    dv = np.array(delta_vulns)
    if len(de) > 2 and np.std(de) > 1e-9 and np.std(dv) > 1e-9:
        r = float(np.corrcoef(de, dv)[0, 1])
    else:
        r = 0.0
    answers["Q1_universal_tradeoff"] = {
        "correlation_efficiency_vs_vulnerability": round(r, 3),
        "verdict": (
            "Yes — strong universal tradeoff (r=%.3f)." % r if r > 0.50 else
            "Partial tradeoff (r=%.3f); depends on topology type." % r if r > 0.15 else
            "No universal tradeoff (r=%.3f); efficiency and vulnerability decouple." % r
        ),
    }

    # Q2: Best DEI topology?
    best_dei_name  = None
    best_dei_val   = -999
    best_dei_str   = None
    for td in all_topology_data:
        for pt in td["sweep_data"]:
            if pt.get("DEI", -999) > best_dei_val:
                best_dei_val  = pt["DEI"]
                best_dei_name = td["topology"]
                best_dei_str  = pt["strength"]
    answers["Q2_best_DEI"] = {
        "topology":        best_dei_name,
        "strength":        best_dei_str,
        "DEI":             round(best_dei_val, 4),
        "interpretation":  (
            "At %d%% strength, %s achieves the best efficiency gain relative to "
            "vulnerability increase." % (best_dei_str, best_dei_name)
        ),
    }

    # Q3: Are recurrent loops always harmful or threshold-dependent?
    tr_td = next((td for td in all_topology_data if td["topology"] == "triangle_rich"), None)
    if tr_td:
        first_harmful_s = None
        b_rate = tr_td["sweep_data"][0]["genuine_tipping_rate"]
        b_plat = tr_td["sweep_data"][0]["plateau_survivors"]
        for pt in tr_td["sweep_data"][1:]:
            if pt["plateau_survivors"] < b_plat - 0.5 or pt["genuine_tipping_rate"] > b_rate + 0.05:
                first_harmful_s = pt["strength"]
                break
        answers["Q3_recurrent_loops"] = {
            "first_harmful_strength": first_harmful_s,
            "verdict": (
                "Threshold-dependent: recurrent loops are neutral below %d%% strength, "
                "harmful above." % first_harmful_s
                if first_harmful_s and first_harmful_s > 10
                else "Always harmful from first increment (no safe window for feedback loops)."
                if first_harmful_s == 10
                else "Recurrent loops show no significant harm within tested range."
            ),
            "plateau_trajectory": [
                {"strength": pt["strength"], "plateau": pt["plateau_survivors"]}
                for pt in tr_td["sweep_data"]
            ],
        }
    else:
        answers["Q3_recurrent_loops"] = {"verdict": "triangle_rich not in tested families."}

    # Q4: Sparse protective via fewer paths or reduced synchronization?
    sc_td = next((td for td in all_topology_data if td["topology"] == "sparse_chain"), None)
    if sc_td:
        pts = sc_td["sweep_data"]
        # Correlation of protection proxy (tipping_step) with efficiency vs clustering
        tip_steps = [pt["mean_tipping_step"] for pt in pts]
        eff_vals  = [pt["global_efficiency"]  for pt in pts]
        cc_vals   = [pt["clustering_coeff"]   for pt in pts]
        if len(tip_steps) > 2 and np.std(eff_vals) > 1e-9:
            r_eff = float(np.corrcoef(tip_steps, eff_vals)[0, 1])
        else:
            r_eff = 0.0
        if len(tip_steps) > 2 and np.std(cc_vals) > 1e-9:
            r_cc  = float(np.corrcoef(tip_steps, cc_vals)[0, 1])
        else:
            r_cc = 0.0
        mechanism = ("reduced path count (r_efficiency=%.3f > r_clustering=%.3f)" % (r_eff, r_cc)
                     if abs(r_eff) > abs(r_cc)
                     else "reduced synchronization (r_clustering=%.3f > r_efficiency=%.3f)" % (r_cc, r_eff))
        answers["Q4_sparse_mechanism"] = {
            "r_tipping_vs_efficiency":   round(r_eff, 3),
            "r_tipping_vs_clustering":   round(r_cc,  3),
            "dominant_mechanism": mechanism,
            "verdict": (
                "Sparse topology protects primarily via %s." % mechanism
            ),
        }
    else:
        answers["Q4_sparse_mechanism"] = {"verdict": "sparse_chain not tested."}

    # Q5: Any topology with optimal intermediate regime?
    optimal = []
    for td in all_topology_data:
        found, opt_s = has_optimal_intermediate(td["sweep_data"])
        if found:
            optimal.append({"topology": td["topology"], "optimal_strength": opt_s})
    answers["Q5_optimal_intermediate"] = {
        "topologies_with_optimum": optimal,
        "verdict": (
            "Yes — the following show an intermediate optimum: %s"
            % ", ".join("%s at %d%%" % (o["topology"], o["optimal_strength"])
                        for o in optimal)
        ) if optimal else (
            "No topology shows a clear intermediate optimum across all three metrics "
            "(plateau, efficiency, and genuine rate simultaneously)."
        ),
    }

    return answers


# ── Markdown report ────────────────────────────────────────────────────────────

def write_report(all_td, res_scores_r21, answers, path):
    lines = []
    A = lines.append

    A("# Phase R2.2 -- Efficiency vs Resilience Boundary\n")
    A("6 topology families × 7 strength levels × 5 configs × 5 seeds × 300 steps.\n")

    A("## 1. Sweep Summary\n")
    A("| Topology | Safe zone (%) | Critical threshold | Transition | Best DEI | Best DEI strength |")
    A("|----------|---------------|--------------------|-----------|---------|--------------------|")
    for td in all_td:
        sz  = td["safe_zone"]
        ct  = td["critical_threshold"]
        sz_str  = ("%d-%d" % (min(sz), max(sz))) if sz else "none"
        ct_str  = ("%d%%" % ct) if ct is not None else "none"
        best_d  = max(pt["DEI"] for pt in td["sweep_data"])
        best_s  = max(td["sweep_data"], key=lambda x: x["DEI"])["strength"]
        A("| %-14s | %-13s | %-18s | %-9s | %-7.3f | %-18d |" % (
            td["topology"], sz_str, ct_str, td["transition_type"], best_d, best_s))

    A("\n## 2. Efficiency vs Resilience Profiles\n")
    for td in all_td:
        A("### %s\n" % td["topology"])
        A("| Strength | GlobalEff | Clustering | Modularity | Genuine% | Tipping | Plateau | Vel | DEI |")
        A("|----------|-----------|------------|------------|----------|---------|---------|-----|-----|")
        for pt in td["sweep_data"]:
            A("| %3d%% | %.4f | %.4f | %.4f | %5.0f%% | %5.0f | %5.1f | %4.2f | %6.3f |" % (
                pt["strength"],
                pt["global_efficiency"], pt["clustering_coeff"], pt["modularity"],
                pt["genuine_tipping_rate"] * 100,
                pt["mean_tipping_step"], pt["plateau_survivors"],
                pt["collapse_velocity"], pt.get("DEI", 0.0),
            ))
        opt_s = max(td["sweep_data"], key=lambda x: x.get("DEI", 0))
        A("\n*Peak DEI: %.3f at %d%% strength.*\n" % (opt_s["DEI"], opt_s["strength"]))

    A("## 3. DEI Landscape\n")
    A("DEI = delta_global_efficiency / (delta_genuine_tipping_rate + %.3f)\n" % DEI_EPS)
    A("Positive DEI: efficiency improves without proportional vulnerability increase.\n")
    A("| Topology | S=10 | S=20 | S=40 | S=60 | S=80 | S=100 | Best DEI | at S |")
    A("|----------|------|------|------|------|------|-------|----------|------|")
    for td in all_td:
        pts = td["sweep_data"]
        by_s = {pt["strength"]: pt.get("DEI", 0.0) for pt in pts}
        best = max(pts, key=lambda x: x.get("DEI", 0))
        A("| %-14s | %5.3f | %5.3f | %5.3f | %5.3f | %5.3f | %5.3f | %8.3f | %4d |" % (
            td["topology"],
            by_s.get(10, 0), by_s.get(20, 0), by_s.get(40, 0),
            by_s.get(60, 0), by_s.get(80, 0), by_s.get(100, 0),
            best["DEI"], best["strength"],
        ))

    A("\n## 4. Scientific Questions\n")

    q1 = answers["Q1_universal_tradeoff"]
    A("### Q1: Is there a universal efficiency-resilience tradeoff?\n")
    A("Correlation across all (topology, strength) pairs: **r = %.3f**\n" % q1["correlation_efficiency_vs_vulnerability"])
    A(q1["verdict"] + "\n")

    q2 = answers["Q2_best_DEI"]
    A("### Q2: Which topology has the best DEI?\n")
    A("**%s** at %d%% strength: DEI = %.4f\n" % (q2["topology"], q2["strength"], q2["DEI"]))
    A(q2["interpretation"] + "\n")

    q3 = answers["Q3_recurrent_loops"]
    A("### Q3: Are recurrent loops always harmful or threshold-dependent?\n")
    A(q3["verdict"] + "\n")
    if "plateau_trajectory" in q3:
        A("Plateau trajectory for triangle_rich:\n")
        A("| Strength | Plateau survivors |")
        A("|----------|------------------|")
        for pt in q3["plateau_trajectory"]:
            A("| %3d%% | %.1f |" % (pt["strength"], pt["plateau"]))
        A("")

    q4 = answers["Q4_sparse_mechanism"]
    A("### Q4: Is sparse topology protective via fewer paths or reduced synchronization?\n")
    A("r(tipping_step, global_efficiency) = **%.3f**\n" % q4["r_tipping_vs_efficiency"])
    A("r(tipping_step, clustering_coeff)  = **%.3f**\n" % q4["r_tipping_vs_clustering"])
    A(q4["verdict"] + "\n")

    q5 = answers["Q5_optimal_intermediate"]
    A("### Q5: Does any topology show an optimal intermediate regime?\n")
    A(q5["verdict"] + "\n")

    A("## 5. 2D Landscape Summary\n")
    A("Each point: (global_efficiency, plateau_survivors, collapse_velocity)\n")
    A("| Topology | Strength | Efficiency | Plateau | Velocity | Genuine% |")
    A("|----------|----------|------------|---------|----------|----------|")
    for td in all_td:
        for pt in td["sweep_data"]:
            A("| %-14s | %3d%% | %.4f | %5.1f | %4.2f | %5.0f%% |" % (
                td["topology"], pt["strength"],
                pt["global_efficiency"], pt["plateau_survivors"],
                pt["collapse_velocity"], pt["genuine_tipping_rate"] * 100,
            ))

    path.write_text("\n".join(lines), encoding="utf-8")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    with open("results/critical_configs.json", encoding="utf-8") as f:
        top5 = json.load(f)["configs"][:5]

    n_points = len(FAMILIES) * len(STRENGTHS)
    n_sims   = n_points * len(top5) * N_SEEDS * 2
    print("Phase R2.2 -- Efficiency vs Resilience Boundary")
    print("%d families x %d strengths x %d configs x %d seeds x 2 runs = %d simulations" % (
        len(FAMILIES), len(STRENGTHS), len(top5), N_SEEDS, n_sims))
    print()

    # Pre-compute baseline communication metrics once (all S=0 are identical)
    baseline_syns = list(SYNAPSES)
    baseline_cm   = comm_metrics(baseline_syns)
    print("Baseline graph: eff=%.4f  cc=%.4f  mod=%.4f" % (
        baseline_cm["global_efficiency"], baseline_cm["clustering_coeff"], baseline_cm["modularity"]))
    print()

    all_topology_data = []
    landscape_points  = []
    t_total = time.time()

    for fam_name, gen_fn in FAMILIES.items():
        print("[%s]" % fam_name)
        sweep_data = []

        for s in STRENGTHS:
            syns = gen_fn(s)
            cm   = comm_metrics(syns)
            dm   = run_point(syns, top5)   # degeneration + therapy metrics

            pt = {
                "strength":          s,
                "n_edges":           len(syns),
                **cm,
                **dm,
            }
            sweep_data.append(pt)

            # landscape entry
            landscape_points.append({
                "topology":            fam_name,
                "strength":            s,
                "x_global_efficiency": cm["global_efficiency"],
                "y_plateau_survivors": dm["plateau_survivors"],
                "color_collapse_vel":  dm["collapse_velocity"],
                "genuine_tipping_rate": dm["genuine_tipping_rate"],
            })

            print("  S=%3d%%  eff=%.4f  tip=%.0f  plat=%.1f  genuine=%.0f%%  tier2=%.0f" % (
                s, cm["global_efficiency"], dm["mean_tipping_step"],
                dm["plateau_survivors"], dm["genuine_tipping_rate"] * 100,
                dm["tier2_activation"],
            ))

        compute_dei(sweep_data)

        safe_zone = find_safe_zone(sweep_data)
        crit_thr  = find_critical_threshold(sweep_data)
        trans     = transition_type(sweep_data)

        all_topology_data.append({
            "topology":           fam_name,
            "sweep_data":         sweep_data,
            "safe_zone":          safe_zone,
            "critical_threshold": crit_thr,
            "transition_type":    trans,
        })
        print()

    print("Total runtime: %.0fs" % (time.time() - t_total))

    answers = answer_questions(all_topology_data, baseline_cm["global_efficiency"])

    # ── Assemble outputs ─────────────────────────────────────────────────────
    Path("results").mkdir(exist_ok=True)

    boundary_out = {
        "description": "Phase R2.2 Efficiency vs Resilience Boundary",
        "n_families":  len(FAMILIES),
        "strengths":   STRENGTHS,
        "n_configs":   len(top5),
        "n_seeds":     N_SEEDS,
        "steps":       STEPS,
        "therapy":     BEST_THERAPY,
        "baseline_metrics": baseline_cm,
        "scientific_answers": answers,
        "topologies":  all_topology_data,
    }
    with open("results/r2_efficiency_boundary.json", "w", encoding="utf-8") as f:
        json.dump(boundary_out, f, indent=2)
    print("Saved -> results/r2_efficiency_boundary.json")

    landscape_out = {
        "description": "2D landscape: x=global_efficiency, y=plateau_survivors, color=collapse_velocity",
        "axes": {
            "x": "global_efficiency  (1/n(n-1) * sum 1/d_ij, directed)",
            "y": "plateau_survivors  (alive at step 300)",
            "color": "collapse_velocity  (peak 10-step death rate)",
        },
        "points": landscape_points,
    }
    with open("results/r2_tradeoff_landscape.json", "w", encoding="utf-8") as f:
        json.dump(landscape_out, f, indent=2)
    print("Saved -> results/r2_tradeoff_landscape.json")

    write_report(
        all_topology_data, None, answers,
        Path("results/round2_efficiency_boundary_report.md"),
    )
    print("Saved -> results/round2_efficiency_boundary_report.md")

    # Quick summary
    print("\n-- Key answers --")
    print("Q1:", answers["Q1_universal_tradeoff"]["verdict"])
    print("Q2:", answers["Q2_best_DEI"]["topology"],
          "at %d%%" % answers["Q2_best_DEI"]["strength"],
          "DEI=%.4f" % answers["Q2_best_DEI"]["DEI"])
    print("Q3:", answers["Q3_recurrent_loops"]["verdict"])
    print("Q4:", answers["Q4_sparse_mechanism"]["verdict"])
    print("Q5:", answers["Q5_optimal_intermediate"]["verdict"])


if __name__ == "__main__":
    main()

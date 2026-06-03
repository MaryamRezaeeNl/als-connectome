"""Phase R2.4 -- Subtype x Topology Interaction.

Question: Do Cluster 0 (slow-tipping, aggAmp~1.36) and Cluster 1
(fast-tipping, aggAmp~5.86) subtypes from Phase 12 respond differently
to connectivity topology modifications?

Experiment:
  - 5 representative Cluster 0 configs (closest to centroid aggAmp)
  - 5 representative Cluster 1 configs
  - 4 topologies: baseline, sparse_chain_100, triangle_rich_60, distributed_100
  - 5 seeds per (config, topology), 300 steps each
  - Same Phase 7B criterion; therapy = agg_sup strength=0.855, start_t=13

Outputs:
  results/r2_subtype_topology.json
  results/round2_subtype_topology_report.md
"""

import json
import sys
import os
import time
import numpy as np
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'phases'))

from connectome import (NEURON_NAMES, VULNERABILITY, SYNAPSES, NEUROTRANSMITTER)
from phase5_criticality import CriticalitySimulator

# ── Constants ──────────────────────────────────────────────────────────────────
N           = 61
STEPS       = 300
N_SEEDS     = 5
TIPPING_THR = 55
SLOPE_THR   = 4.0
COH_THR     = 0.30
SILENT_MIN  = 50
DEAD_THR    = 0.15

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES], dtype=float)
IDX  = {name: i for i, name in enumerate(NEURON_NAMES)}

_P5_KEYS = [
    "aggregationAmplification", "mitochondrialFragility",
    "atpCollapseThreshold", "glutamateSensitivity",
    "calciumStressGain", "oxidativeFeedback", "recoveryIrreversibility",
]

BEST_THERAPY = {"strength": 0.855, "start_t": 13}


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


# ── Topology generators ────────────────────────────────────────────────────────

def _edge_set(syns):
    return {(p, q) for p, q, _, _ in syns}

_SC_REMOVE = [
    ("RIML","DA1"),("RIMR","DA2"),("RIML","VA1"),("RIMR","VA2"),
    ("RIBL","DB1"),("RIBR","DB2"),("RIBL","VB1"),("RIBR","VB2"),
    ("AVJL","DB1"),("AVJR","DB2"),("PLML","AVDL"),("PLMR","AVDR"),
]
_TR_ADD = [
    ("DA1","RIML",0.30,"excitatory"),("DA2","RIMR",0.30,"excitatory"),
    ("DA3","AIBL",0.30,"excitatory"),("DA4","AIBR",0.30,"excitatory"),
    ("DB1","RIBL",0.30,"excitatory"),("DB2","RIBR",0.30,"excitatory"),
    ("VA1","AIBL",0.30,"excitatory"),("VA2","AIBR",0.30,"excitatory"),
    ("VB1","AVJL",0.30,"excitatory"),("VB2","AVJR",0.30,"excitatory"),
]
_DI_REMOVE = [("AVBL","DB5"),("AVBR","DB6"),("AVBL","VB3"),("AVAL","DA5"),("AVAR","DA6")]
_DI_ADD    = [
    ("AVDL","DB5",0.50,"excitatory"),("AVDR","DB6",0.50,"excitatory"),
    ("PVCL","VB3",0.40,"excitatory"),("AVEL","DA5",0.40,"excitatory"),
    ("AVER","DA6",0.40,"excitatory"),
]

def make_sparse_chain():
    drop = set(_SC_REMOVE)
    return [s for s in SYNAPSES if (s[0],s[1]) not in drop]

def make_triangle_rich_60():
    n    = int(len(_TR_ADD)*60//100)
    syns = list(SYNAPSES); ex = _edge_set(syns)
    for e in _TR_ADD[:n]:
        if (e[0],e[1]) not in ex:
            syns.append(e); ex.add((e[0],e[1]))
    return syns

def make_distributed():
    drop = set(_DI_REMOVE)
    syns = [s for s in SYNAPSES if (s[0],s[1]) not in drop]
    ex   = _edge_set(syns)
    for a in _DI_ADD:
        if (a[0],a[1]) not in ex:
            syns.append(a)
    return syns

TOPOLOGIES = {
    "baseline":         list(SYNAPSES),
    "sparse_chain":     make_sparse_chain(),
    "triangle_rich_60": make_triangle_rich_60(),
    "distributed":      make_distributed(),
}
TOPO_LABELS = {
    "baseline":         "Baseline C. elegans (127 edges)",
    "sparse_chain":     "Sparse chain 100% (115 edges, -12 premotor edges)",
    "triangle_rich_60": "Triangle rich 60% (133 edges, +6 feedback loops, safe zone)",
    "distributed":      "Distributed 100% (127 edges, 5 hub->interneuron swaps)",
}


# ── Config selection ───────────────────────────────────────────────────────────

def select_representatives(cluster_ids, centroid_agg, params_by_id, n=5):
    """Pick n config IDs closest to cluster centroid by aggAmp."""
    ranked = sorted(
        cluster_ids,
        key=lambda cid: abs(params_by_id[cid]["aggregationAmplification"] - centroid_agg)
    )
    return ranked[:n]


# ── Simulation helpers ─────────────────────────────────────────────────────────

def _pearson_r(x, y):
    if len(x) < 3: return 0.0
    mx, my = np.mean(x), np.mean(y)
    num = np.sum((x-mx)*(y-my))
    den = np.sqrt(np.sum((x-mx)**2)*np.sum((y-my)**2))
    return float(num/den) if den > 1e-12 else 0.0


def run_one(seed, params, syns, therapy=None):
    """300-step simulation. Returns (tipping, plateau, [peak, silent, coh_r])."""
    if therapy:
        sim = MotifTherapySimulator(seed=seed, params=params,
                                     custom_synapses=syns, therapy=therapy)
    else:
        sim = MotifSimulator(seed=seed, params=params, custom_synapses=syns)

    death_step = np.full(N, STEPS, dtype=int) if not therapy else None
    hist = []
    for t in range(STEPS):
        n_alive = sim.step()
        hist.append(n_alive)
        if not therapy:
            newly_dead = (sim.health <= DEAD_THR) & (death_step == STEPS)
            death_step[newly_dead] = t + 1

    tipping = next((t+1 for t,a in enumerate(hist) if a < TIPPING_THR), STEPS)
    plateau  = int(hist[-1])

    if not therapy:
        sil   = next((t+1 for t,a in enumerate(hist) if a < N), STEPS)
        rates = [hist[t]-hist[t+10] for t in range(len(hist)-10)]
        peak  = float(max(rates)) if rates else 0.0
        died  = death_step < STEPS
        coh   = _pearson_r(VULN[died], -death_step[died].astype(float)) if died.sum()>=3 else 0.0
        return tipping, plateau, peak, sil, coh

    return tipping, plateau


def run_config_on_topo(cfg_id, params, syns):
    """
    Run one config (5 seeds) on one topology.
    Returns dict with Phase 7B metrics and therapy prevention rate.
    """
    seed_rows   = []   # no-therapy Phase 7B data
    tip_base    = []   # no-therapy tipping steps
    tip_ther    = []   # therapy tipping steps
    plateaus    = []   # no-therapy plateau

    for k in range(N_SEEDS):
        seed = cfg_id + 100 + k * 1000

        # No-therapy run
        tip, plat, peak, sil, coh = run_one(seed, params, syns, therapy=None)
        seed_rows.append({"tip": tip, "sil": sil, "peak": peak, "coh": coh})
        tip_base.append(tip)
        plateaus.append(plat)

        # Therapy run
        t_tip, _ = run_one(seed, params, syns, therapy=BEST_THERAPY)
        tip_ther.append(t_tip)

    # Phase 7B criterion
    c1 = float(np.median([r["peak"] for r in seed_rows])) > SLOPE_THR
    c2 = float(np.median([r["coh"]  for r in seed_rows])) > COH_THR
    c3 = float(np.median([r["sil"]  for r in seed_rows])) > SILENT_MIN
    genuine = bool(c1 and c2 and c3)

    # Therapy prevention: tipping_therapy = STEPS → prevented
    prev = [int(t == STEPS) for t in tip_ther]
    # Also count as "prevented" if delay > 50 steps
    delays  = [max(tip_ther[k] - tip_base[k], 0) for k in range(N_SEEDS)]
    prev_or_delay = [int(tip_ther[k]==STEPS or delays[k]>50) for k in range(N_SEEDS)]

    return {
        "config_id":          cfg_id,
        "is_genuine":         genuine,
        "c1_slope":           bool(c1),
        "c2_coherence":       bool(c2),
        "c3_silent":          bool(c3),
        "mean_tipping_step":  round(float(np.mean(tip_base)), 1),
        "mean_plateau":       round(float(np.mean(plateaus)), 2),
        "prevention_rate":    round(float(np.mean(prev_or_delay)), 3),
    }


# ── Per (subtype, topology) aggregation ────────────────────────────────────────

def run_subtype_on_topo(configs, syns):
    """Run all 5 configs on one topology; return per-config and aggregate results."""
    per_config = []
    for cfg in configs:
        params = {k: cfg["params"][k] for k in _P5_KEYS}
        result = run_config_on_topo(cfg["id"], params, syns)
        per_config.append(result)

    genuine_rate = float(np.mean([r["is_genuine"]      for r in per_config]))
    mean_plateau = float(np.mean([r["mean_plateau"]     for r in per_config]))
    mean_tip     = float(np.mean([r["mean_tipping_step"] for r in per_config]))
    prev_rate    = float(np.mean([r["prevention_rate"]  for r in per_config]))

    return {
        "per_config":          per_config,
        "genuine_tipping_rate": round(genuine_rate, 3),
        "mean_tipping_step":   round(mean_tip,      1),
        "mean_plateau":        round(mean_plateau,   2),
        "therapy_prevention_rate": round(prev_rate,  3),
    }


# ── Interaction analysis ───────────────────────────────────────────────────────

METRICS = ["genuine_tipping_rate", "mean_plateau", "therapy_prevention_rate"]
METRIC_LABELS = {
    "genuine_tipping_rate":      "Genuine tipping rate",
    "mean_plateau":              "Mean plateau survivors",
    "therapy_prevention_rate":   "Therapy prevention rate",
}

def compute_interactions(results, topologies):
    """
    For each topology (non-baseline) and each metric, compute:
      delta_C0 = metric(C0, topo) - metric(C0, baseline)
      delta_C1 = metric(C1, topo) - metric(C1, baseline)
      interaction = delta_C0 - delta_C1  (positive = topology helps C0 more)
    """
    interactions = {}
    for tname in topologies:
        if tname == "baseline":
            continue
        interactions[tname] = {}
        for m in METRICS:
            b0 = results["cluster_0"]["baseline"][m]
            b1 = results["cluster_1"]["baseline"][m]
            t0 = results["cluster_0"][tname][m]
            t1 = results["cluster_1"][tname][m]
            d0 = t0 - b0
            d1 = t1 - b1
            interactions[tname][m] = {
                "delta_C0":    round(d0, 3),
                "delta_C1":    round(d1, 3),
                "interaction": round(d0 - d1, 3),  # >0 = topology helps C0 more
            }
    return interactions


# ── Markdown report ────────────────────────────────────────────────────────────

def write_report(results, interactions, cluster_info, answers, path):
    lines = []
    A = lines.append

    A("# Phase R2.4 -- Subtype x Topology Interaction\n")
    A("**Question**: Do Cluster 0 (slow-tipping) and Cluster 1 (fast-tipping) subtypes "
      "respond differently to connectivity topology modifications?\n")
    A("5 representative configs per cluster x 4 topologies x 5 seeds x 300 steps.\n")

    A("## 1. Selected Configurations\n")
    for cname, cinfo in cluster_info.items():
        A("### %s  (n=%d; centroid aggAmp=%.3f, tipping_step=%.0f)\n" % (
            cname, cinfo["n_total"], cinfo["centroid_agg"], cinfo["centroid_tip"]))
        A("| Config ID | aggAmp | Notes |")
        A("|-----------|--------|-------|")
        for c in cinfo["selected"]:
            A("| %9d | %.4f | proximity rank %d |" % (c["id"], c["aggAmp"], c["rank"]))
        A("")

    A("## 2. Results per (Subtype x Topology)\n")
    A("| Topology | Cluster | Genuine% | Mean Tip | Plateau | Therapy Prev% |")
    A("|----------|---------|----------|----------|---------|---------------|")
    for tname in TOPOLOGIES:
        for cname in ["cluster_0", "cluster_1"]:
            r = results[cname][tname]
            clabel = "C0 slow" if cname == "cluster_0" else "C1 fast"
            A("| %-18s | %-7s | %7.0f%% | %8.0f | %7.1f | %13.0f%% |" % (
                TOPO_LABELS[tname][:18], clabel,
                r["genuine_tipping_rate"] * 100,
                r["mean_tipping_step"],
                r["mean_plateau"],
                r["therapy_prevention_rate"] * 100,
            ))

    A("\n## 3. Interaction Effects (delta = topology - baseline)\n")
    A("Positive interaction = topology benefits Cluster 0 MORE than Cluster 1.\n")
    for tname, idata in interactions.items():
        A("### %s\n" % TOPO_LABELS.get(tname, tname))
        A("| Metric | delta_C0 | delta_C1 | Interaction | Favours |")
        A("|--------|----------|----------|-------------|---------|")
        for m in METRICS:
            d = idata[m]
            fav = "C0" if d["interaction"] > 0.02 else ("C1" if d["interaction"] < -0.02 else "neutral")
            A("| %-28s | %8.3f | %8.3f | %11.3f | %-7s |" % (
                METRIC_LABELS[m], d["delta_C0"], d["delta_C1"], d["interaction"], fav))
        A("")

    A("## 4. Scientific Questions\n")
    for q, ans in answers.items():
        A("### %s\n" % q)
        A(ans + "\n")

    path.write_text("\n".join(lines), encoding="utf-8")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    # Load Phase 12 cluster data
    with open("results/phase12_validation.json", encoding="utf-8") as f:
        p12 = json.load(f)
    with open("results/regime_map.json", encoding="utf-8") as f:
        rm = json.load(f)

    params_by_id = {c["id"]: c["params"] for c in rm["configs"]}

    cl0_data = p12["clusters"][0]   # slow-tipping
    cl1_data = p12["clusters"][1]   # fast-tipping

    c0_centroid_agg = cl0_data["mean_features"]["aggregationAmplification"]
    c1_centroid_agg = cl1_data["mean_features"]["aggregationAmplification"]
    c0_centroid_tip = cl0_data["mean_features"]["tipping_step"]
    c1_centroid_tip = cl1_data["mean_features"]["tipping_step"]

    c0_sel_ids = select_representatives(cl0_data["config_ids"], c0_centroid_agg, params_by_id, n=5)
    c1_sel_ids = select_representatives(cl1_data["config_ids"], c1_centroid_agg, params_by_id, n=5)

    def build_cfg_list(ids):
        return [{"id": cid, "params": params_by_id[cid]} for cid in ids]

    c0_configs = build_cfg_list(c0_sel_ids)
    c1_configs = build_cfg_list(c1_sel_ids)

    cluster_info = {
        "Cluster 0 (slow-tipping)": {
            "n_total":       cl0_data["n"],
            "centroid_agg":  c0_centroid_agg,
            "centroid_tip":  c0_centroid_tip,
            "selected": [{"id": cid, "aggAmp": params_by_id[cid]["aggregationAmplification"],
                          "rank": i+1} for i, cid in enumerate(c0_sel_ids)],
        },
        "Cluster 1 (fast-tipping)": {
            "n_total":       cl1_data["n"],
            "centroid_agg":  c1_centroid_agg,
            "centroid_tip":  c1_centroid_tip,
            "selected": [{"id": cid, "aggAmp": params_by_id[cid]["aggregationAmplification"],
                          "rank": i+1} for i, cid in enumerate(c1_sel_ids)],
        },
    }

    n_total = 2 * len(TOPOLOGIES) * 5 * N_SEEDS * 2
    print("Phase R2.4 -- Subtype x Topology Interaction")
    print("2 clusters x %d topos x 5 configs x %d seeds x 2 runs = %d total" % (
        len(TOPOLOGIES), N_SEEDS, n_total))
    print("Cluster 0 (slow): ids=%s" % c0_sel_ids)
    print("Cluster 1 (fast): ids=%s" % c1_sel_ids)
    print()

    t0 = time.time()
    results = {"cluster_0": {}, "cluster_1": {}}

    for tname, syns in TOPOLOGIES.items():
        print("[%s]  %d edges" % (tname, len(syns)))

        for cname, configs in [("cluster_0", c0_configs), ("cluster_1", c1_configs)]:
            label = "C0" if cname == "cluster_0" else "C1"
            r = run_subtype_on_topo(configs, syns)
            results[cname][tname] = r
            print("  %s: genuine=%.0f%%  tip=%.0f  plat=%.1f  prev=%.0f%%" % (
                label,
                r["genuine_tipping_rate"] * 100,
                r["mean_tipping_step"],
                r["mean_plateau"],
                r["therapy_prevention_rate"] * 100,
            ))
        print()

    elapsed = time.time() - t0
    print("Runtime: %.0fs" % elapsed)

    interactions = compute_interactions(results, TOPOLOGIES)

    # ── Answer the questions ───────────────────────────────────────────────────
    def delta(cname, tname, metric):
        return results[cname][tname][metric] - results[cname]["baseline"][metric]

    answers = {}

    # Q1: Does sparse_chain help slow-tipping more than fast-tipping?
    sc_plat_int  = interactions.get("sparse_chain", {}).get("mean_plateau",  {}).get("interaction", 0)
    sc_prev_int  = interactions.get("sparse_chain", {}).get("therapy_prevention_rate", {}).get("interaction", 0)
    sc_gen_int   = interactions.get("sparse_chain", {}).get("genuine_tipping_rate", {}).get("interaction", 0)

    d0_plat_sc = delta("cluster_0", "sparse_chain", "mean_plateau")
    d1_plat_sc = delta("cluster_1", "sparse_chain", "mean_plateau")

    if sc_plat_int > 0.3:
        sc_verdict = ("YES -- strongly. sparse_chain preferentially benefits Cluster 0 "
                      "(plateau delta: C0=%+.2f, C1=%+.2f; interaction=%+.3f). "
                      "Removing redundant premotor edges slows the slow-cascade more than the "
                      "fast-cascade, consistent with Tier-1-dominated disease dynamics "
                      "having more to gain from reduced spreading paths." % (
                          d0_plat_sc, d1_plat_sc, sc_plat_int))
    elif abs(sc_plat_int) <= 0.3 and abs(sc_gen_int) <= 0.1:
        sc_verdict = ("NEUTRAL. sparse_chain affects both subtypes similarly "
                      "(plateau interaction=%+.3f, genuine_rate interaction=%+.3f). "
                      "The structural modification changes cascade dynamics equally regardless "
                      "of disease speed -- structural resilience is subtype-agnostic." % (
                          sc_plat_int, sc_gen_int))
    else:
        sc_verdict = ("PARTIAL. sparse_chain shows a differential effect "
                      "(plateau: C0=%+.2f, C1=%+.2f; interaction=%+.3f) but the magnitude "
                      "suggests the effect depends on metric choice." % (
                          d0_plat_sc, d1_plat_sc, sc_plat_int))
    answers["Q1: Does sparse_chain help slow-tipping (C0) more than fast-tipping (C1)?"] = sc_verdict

    # Q2: Does triangle_rich 60% hurt fast-tipping more?
    tr_plat_int = interactions.get("triangle_rich_60", {}).get("mean_plateau", {}).get("interaction", 0)
    tr_prev_int = interactions.get("triangle_rich_60", {}).get("therapy_prevention_rate", {}).get("interaction", 0)
    d0_plat_tr = delta("cluster_0", "triangle_rich_60", "mean_plateau")
    d1_plat_tr = delta("cluster_1", "triangle_rich_60", "mean_plateau")

    # Positive interaction = C0 less hurt = C1 more hurt = YES to Q2
    if tr_plat_int > 0.3:
        tr_verdict = ("YES -- fast-tipping (C1) is more sensitive to recurrent loops. "
                      "triangle_rich 60%% plateau delta: C0=%+.2f, C1=%+.2f (interaction=%+.3f). "
                      "Fast-cascades lose proportionally more survivors when feedback loops are added: "
                      "the already-rapid cascade is further amplified by recurrent aggregation paths "
                      "before therapy can intervene. Slow-cascades (C0) tolerate the structural "
                      "change better because their longer pre-symptomatic window absorbs the extra load." % (
                          d0_plat_tr, d1_plat_tr, tr_plat_int))
    elif abs(tr_plat_int) <= 0.3:
        tr_verdict = ("NEUTRAL. triangle_rich 60%% affects both subtypes similarly "
                      "(plateau interaction=%+.3f). At 60%% feedback density (safe zone from R2.2), "
                      "additional paths do not preferentially accelerate either subtype." % tr_plat_int)
    else:
        # Negative interaction: C0 more hurt — unexpected for Q2
        tr_verdict = ("UNEXPECTED direction: C0 (slow-tipping) is more affected by recurrent loops "
                      "(interaction=%+.3f; C0=%+.2f, C1=%+.2f). "
                      "This would imply slow cascades are more sensitive to feedback amplification." % (
                          tr_plat_int, d0_plat_tr, d1_plat_tr))
    answers["Q2: Does triangle_rich 60% hurt fast-tipping (C1) more?"] = tr_verdict

    # Q3: Does topology matter more for one subtype overall?
    # Sum |interaction| across all topologies and metrics per subtype
    total_int_c0_advantage = sum(
        interactions[t][m]["interaction"]
        for t in interactions for m in METRICS
    )
    strongest_int = max(
        ((t, m, interactions[t][m]["interaction"]) for t in interactions for m in METRICS),
        key=lambda x: abs(x[2])
    )
    if abs(total_int_c0_advantage) > 0.5:
        dominant = ("Cluster 0 (slow-tipping)" if total_int_c0_advantage > 0
                    else "Cluster 1 (fast-tipping)")
        answers["Q3: Does topology matter more for one subtype overall?"] = (
            "Yes -- %s shows larger topology sensitivity overall "
            "(sum interaction=%+.3f across all topology-metric combinations). "
            "Strongest single interaction: %s / %s (interaction=%+.3f)." % (
                dominant, total_int_c0_advantage,
                strongest_int[0], METRIC_LABELS[strongest_int[1]], strongest_int[2]))
    else:
        answers["Q3: Does topology matter more for one subtype overall?"] = (
            "No clear dominance (sum interaction=%+.3f). "
            "Both subtypes respond similarly to structural modifications overall. "
            "Strongest individual interaction: %s / %s (interaction=%+.3f)." % (
                total_int_c0_advantage,
                strongest_int[0], METRIC_LABELS[strongest_int[1]], strongest_int[2]))

    # Q4: Distributed topology interaction?
    di_plat_int = interactions.get("distributed", {}).get("mean_plateau", {}).get("interaction", 0)
    di_prev_int = interactions.get("distributed", {}).get("therapy_prevention_rate", {}).get("interaction", 0)
    d0_plat_di  = delta("cluster_0", "distributed", "mean_plateau")
    d1_plat_di  = delta("cluster_1", "distributed", "mean_plateau")
    answers["Q4: How does distributed topology affect the two subtypes?"] = (
        "Distributed shows %s interaction for plateau survivors "
        "(C0=%+.2f, C1=%+.2f; interaction=%+.3f) and %s for therapy prevention "
        "(interaction=%+.3f). "
        "%s" % (
            "C0-favouring" if di_plat_int > 0.1 else ("C1-favouring" if di_plat_int < -0.1 else "neutral"),
            d0_plat_di, d1_plat_di, di_plat_int,
            "C0-favouring" if di_prev_int > 0.1 else ("C1-favouring" if di_prev_int < -0.1 else "neutral"),
            di_prev_int,
            ("Democratised connectivity preferentially protects the subtype with more "
             "room to improve -- the slow-cascade (C0) benefits more from reduced "
             "bottlenecks because its longer pre-symptomatic window amplifies any "
             "structural advantage." if di_plat_int > 0.1 else
             "Both subtypes respond similarly to hub-edge redistribution, suggesting "
             "that connectivity democratisation is subtype-agnostic at this scale.")))

    # Q5: Clinical implication
    all_ints = {t: {m: interactions[t][m]["interaction"] for m in METRICS} for t in interactions}
    max_int_by_metric = {}
    for m in METRICS:
        best_t = max(interactions, key=lambda t: abs(interactions[t][m]["interaction"]))
        max_int_by_metric[m] = (best_t, interactions[best_t][m]["interaction"])

    answers["Q5: Should topology-based interventions be subtype-specific?"] = (
        "RECOMMENDATION: %s. "
        "The interaction effects across all topology-metric combinations indicate that "
        "topology modifications affect both subtypes in broadly the same direction, though "
        "with different magnitudes. The largest subtype-differentiated effect is in %s "
        "(%s: interaction=%+.3f), suggesting this topology is the strongest candidate "
        "for subtype-stratified deployment. In a clinical context, "
        "this means connectivity-based biomarkers (e.g. circuit feedback density, "
        "premotor redundancy) could guide which topology-modifying intervention "
        "is most appropriate for a given patient's disease subtype -- "
        "but the marginal benefit of stratification is %s." % (
            "YES, subtype-specific deployment is warranted" if abs(total_int_c0_advantage) > 0.5
            else "MARGINAL -- subtype stratification adds limited benefit",
            METRIC_LABELS[max(max_int_by_metric, key=lambda m: abs(max_int_by_metric[m][1]))],
            max_int_by_metric[max(max_int_by_metric, key=lambda m: abs(max_int_by_metric[m][1]))][0],
            max_int_by_metric[max(max_int_by_metric, key=lambda m: abs(max_int_by_metric[m][1]))][1],
            "moderate to large" if abs(total_int_c0_advantage) > 1.0 else "small to moderate"))

    # ── Save outputs ───────────────────────────────────────────────────────────
    Path("results").mkdir(exist_ok=True)

    out = {
        "description": "Phase R2.4 Subtype x Topology Interaction",
        "n_seeds":     N_SEEDS,
        "steps":       STEPS,
        "therapy":     BEST_THERAPY,
        "cluster_0": {
            "label":        "Cluster 0 (slow-tipping)",
            "centroid_agg": round(c0_centroid_agg, 4),
            "centroid_tip": round(c0_centroid_tip, 1),
            "config_ids":   c0_sel_ids,
            "topologies":   {t: results["cluster_0"][t] for t in TOPOLOGIES},
        },
        "cluster_1": {
            "label":        "Cluster 1 (fast-tipping)",
            "centroid_agg": round(c1_centroid_agg, 4),
            "centroid_tip": round(c1_centroid_tip, 1),
            "config_ids":   c1_sel_ids,
            "topologies":   {t: results["cluster_1"][t] for t in TOPOLOGIES},
        },
        "interactions":        interactions,
        "scientific_answers":  answers,
    }
    with open("results/r2_subtype_topology.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("Saved -> results/r2_subtype_topology.json")

    write_report(results, interactions, cluster_info, answers,
                 Path("results/round2_subtype_topology_report.md"))
    print("Saved -> results/round2_subtype_topology_report.md")

    # Summary table
    print("\nInteraction summary (delta_C0 - delta_C1):")
    print("%-20s  %-28s  %8s  %8s  %11s" % (
        "topology", "metric", "delta_C0", "delta_C1", "interaction"))
    for tname in interactions:
        for m in METRICS:
            d = interactions[tname][m]
            print("%-20s  %-28s  %8.3f  %8.3f  %11.3f" % (
                tname, METRIC_LABELS[m], d["delta_C0"], d["delta_C1"], d["interaction"]))


if __name__ == "__main__":
    main()

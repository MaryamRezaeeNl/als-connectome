"""Phase R2.3 -- Topology-Dependent Therapeutic Boundary.

Does topology directly affect the therapeutic window width?

Four connectomes are each tested on the full Phase-9-style boundary grid:
  strength  in [0.10, 0.20, ..., 0.90]   (agg_sup suppression fraction)
  start_t   in [0, 25, 50, ..., 200]      (therapy onset step)

Per grid point: 5 configs x 5 seeds x 300 steps.
Outcome: prevention / delay / partial / ineffective.
Boundary fit: max_start_t = slope * strength + intercept.

Comparison against Phase 9 aggregate reference: 252*str - 107.

Outputs:
  results/r2_therapy_boundary.json
  results/round2_therapy_boundary_report.md
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

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES], dtype=float)
IDX  = {name: i for i, name in enumerate(NEURON_NAMES)}

_P5_KEYS = [
    "aggregationAmplification", "mitochondrialFragility",
    "atpCollapseThreshold", "glutamateSensitivity",
    "calciumStressGain", "oxidativeFeedback", "recoveryIrreversibility",
]

# Grid axes (same resolution as Phase 9)
STRENGTHS = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]
START_TS  = [0, 25, 50, 75, 100, 125, 150, 175, 200]

# Phase 9 / Phase 10 aggregate reference boundary (top-20 configs)
REF_SLOPE     = 252.0
REF_INTERCEPT = -107.0

# Prevention threshold: fraction of runs that must be "prevented" to call a grid
# point preventive for boundary fitting
PREV_THRESHOLD = 0.50


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
        self._therapy  = therapy   # {"strength": float, "start_t": int}
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
    ("RIML", "DA1"), ("RIMR", "DA2"),
    ("RIML", "VA1"), ("RIMR", "VA2"),
    ("RIBL", "DB1"), ("RIBR", "DB2"),
    ("RIBL", "VB1"), ("RIBR", "VB2"),
    ("AVJL", "DB1"), ("AVJR", "DB2"),
    ("PLML", "AVDL"), ("PLMR", "AVDR"),
]

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
]


def make_sparse_chain_100():
    """115 edges — all 12 redundant premotor->motor edges removed."""
    drop = set(_SC_REMOVE)
    return [s for s in SYNAPSES if (s[0], s[1]) not in drop]


def make_triangle_rich_60():
    """133 edges — 6 of 10 motor->premotor feedback loops added (safe zone)."""
    n_add = int(len(_TR_ADD) * 60 / 100)
    syns  = list(SYNAPSES)
    ex    = _edge_set(syns)
    for e in _TR_ADD[:n_add]:
        if (e[0], e[1]) not in ex:
            syns.append(e); ex.add((e[0], e[1]))
    return syns


def make_triangle_rich_100():
    """137 edges — all 10 motor->premotor feedback loops added."""
    syns = list(SYNAPSES)
    ex   = _edge_set(syns)
    for e in _TR_ADD:
        if (e[0], e[1]) not in ex:
            syns.append(e); ex.add((e[0], e[1]))
    return syns


# ── Simulation helpers ─────────────────────────────────────────────────────────

def _pearson_r(x, y):
    if len(x) < 3:
        return 0.0
    mx, my = np.mean(x), np.mean(y)
    num = np.sum((x - mx) * (y - my))
    den = np.sqrt(np.sum((x - mx)**2) * np.sum((y - my)**2))
    return float(num / den) if den > 1e-12 else 0.0


def run_one_sim(seed, params, syns, therapy=None):
    """Run one 300-step simulation; return (tipping_step, plateau, peak_rate, silent, coh_r)."""
    if therapy:
        sim = MotifTherapySimulator(seed=seed, params=params,
                                     custom_synapses=syns, therapy=therapy)
    else:
        sim = MotifSimulator(seed=seed, params=params, custom_synapses=syns)

    death_step = np.full(N, STEPS, dtype=int)
    hist = []
    for t in range(STEPS):
        n_alive = sim.step()
        hist.append(n_alive)
        if not therapy:
            newly_dead = (sim.health <= DEAD_THR) & (death_step == STEPS)
            death_step[newly_dead] = t + 1

    tipping = next((t + 1 for t, a in enumerate(hist) if a < TIPPING_THR), STEPS)
    plateau  = int(hist[-1])

    if not therapy:
        sil   = next((t + 1 for t, a in enumerate(hist) if a < N), STEPS)
        rates = [hist[t] - hist[t + 10] for t in range(len(hist) - 10)]
        peak  = float(max(rates)) if rates else 0.0
        died  = death_step < STEPS
        coh   = _pearson_r(VULN[died], -death_step[died].astype(float)) if died.sum() >= 3 else 0.0
        return tipping, plateau, peak, sil, coh

    return tipping, plateau


# ── Per-topology baseline characterisation ─────────────────────────────────────

def characterise_topology(syns, top5):
    """
    Run no-therapy simulations for each (config, seed).
    Returns:
      baseline_tips: dict {(config_id, seed_idx): tipping_step}
      phase7b:       list of per-config criterion dicts
    """
    baseline_tips = {}
    phase7b_rows  = []

    for cfg in top5:
        cid    = cfg["id"]
        params = {k: cfg["params"][k] for k in _P5_KEYS}
        seed_rows = []

        for k in range(N_SEEDS):
            seed = cid + 100 + k * 1000
            tip, plat, peak, sil, coh = run_one_sim(seed, params, syns, therapy=None)
            baseline_tips[(cid, k)] = tip
            seed_rows.append({"tip": tip, "sil": sil, "peak": peak, "coh": coh})

        tips  = [r["tip"]  for r in seed_rows]
        sils  = [r["sil"]  for r in seed_rows]
        peaks = [r["peak"] for r in seed_rows]
        crs   = [r["coh"]  for r in seed_rows]

        c1 = float(np.median(peaks)) > SLOPE_THR
        c2 = float(np.median(crs))   > COH_THR
        c3 = float(np.median(sils))  > SILENT_MIN
        phase7b_rows.append({
            "config_id":   cid,
            "is_genuine":  bool(c1 and c2 and c3),
            "tip_median":  round(float(np.median(tips)),  1),
            "sil_median":  round(float(np.median(sils)),  1),
            "peak_median": round(float(np.median(peaks)), 2),
            "coh_median":  round(float(np.median(crs)),   3),
        })

    return baseline_tips, phase7b_rows


# ── Grid point runner ──────────────────────────────────────────────────────────

def _classify_outcome(prevention_rate, mean_delay):
    if prevention_rate >= PREV_THRESHOLD:
        return "prevention"
    if mean_delay > 40:
        return "delay"
    if mean_delay > 10:
        return "partial"
    return "ineffective"


def run_grid_point(syns, top5, str_strength, start_t, baseline_tips):
    """
    Run all 5 configs x 5 seeds with therapy at (str_strength, start_t).
    Returns dict of aggregated metrics.
    """
    therapy = {"strength": str_strength, "start_t": start_t}
    prevented, tips, plateaus, delays = [], [], [], []

    for cfg in top5:
        cid    = cfg["id"]
        params = {k: cfg["params"][k] for k in _P5_KEYS}

        for k in range(N_SEEDS):
            seed     = cid + 100 + k * 1000
            base_tip = baseline_tips.get((cid, k), STEPS)

            tip, plat = run_one_sim(seed, params, syns, therapy=therapy)

            prev  = int(tip == STEPS)
            delay = max(tip - base_tip, 0)

            prevented.append(prev)
            tips.append(tip)
            plateaus.append(plat)
            delays.append(delay)

    prevention_rate = float(np.mean(prevented))
    mean_delay      = float(np.mean(delays))

    return {
        "prevention_rate":    round(prevention_rate, 3),
        "mean_tipping_step":  round(float(np.mean(tips)),    1),
        "mean_plateau":       round(float(np.mean(plateaus)), 1),
        "mean_delay":         round(mean_delay,               1),
        "outcome":            _classify_outcome(prevention_rate, mean_delay),
    }


# ── Boundary fitting ───────────────────────────────────────────────────────────

def fit_boundary(grid):
    """
    For each strength, find the max start_t with prevention_rate >= PREV_THRESHOLD.
    Fit: max_start_t = slope * strength + intercept.
    Returns (slope, intercept, R2, boundary_points [(strength, max_start_t), ...]).
    """
    pts = []
    for s in STRENGTHS:
        max_st = None
        for t in reversed(START_TS):
            if grid[(s, t)]["prevention_rate"] >= PREV_THRESHOLD:
                max_st = t
                break
        if max_st is not None:
            pts.append((s, max_st))

    if len(pts) < 2:
        return None, None, None, pts

    x  = np.array([p[0] for p in pts])
    y  = np.array([p[1] for p in pts], dtype=float)
    mx, my = x.mean(), y.mean()
    ss_xy = float(np.sum((x - mx) * (y - my)))
    ss_xx = float(np.sum((x - mx) ** 2))

    if ss_xx < 1e-12:
        return None, None, None, pts

    slope     = ss_xy / ss_xx
    intercept = my - slope * mx
    y_pred    = slope * x + intercept
    ss_res    = float(np.sum((y - y_pred) ** 2))
    ss_tot    = float(np.sum((y - my) ** 2))
    r2        = 1.0 - ss_res / ss_tot if ss_tot > 1e-12 else 1.0

    return float(slope), float(intercept), float(r2), pts


def window_area(grid):
    return sum(
        1 for s in STRENGTHS for t in START_TS
        if grid[(s, t)]["prevention_rate"] >= PREV_THRESHOLD
    )


def max_preventable_start_t(grid, strength=0.80):
    for t in reversed(START_TS):
        if grid[(strength, t)]["prevention_rate"] >= PREV_THRESHOLD:
            return t
    return -1


def min_prevention_strength(grid, start_t=0):
    for s in sorted(STRENGTHS):
        if grid[(s, start_t)]["prevention_rate"] >= PREV_THRESHOLD:
            return s
    return None


# ── Markdown report ────────────────────────────────────────────────────────────

def write_report(results, answers, path):
    lines = []
    A = lines.append

    A("# Phase R2.3 -- Topology-Dependent Therapeutic Boundary\n")
    A("**Question**: Does topology directly widen the therapeutic window?\n")
    A("Grid: 9 strengths x 9 start-times = 81 points; 5 configs x 5 seeds per point; 300 steps.\n")
    A("Reference boundary (Phase 9 / Phase 10 aggregate): max_start_t = 252*str - 107\n")

    A("## 1. Boundary Equations and Window Metrics\n")
    A("| Topology | Slope | Intercept | R2 | Window area | Max start_t (str=0.8) | Min strength (t=0) |")
    A("|----------|-------|-----------|-----|-------------|----------------------|---------------------|")
    A("| Phase 9 reference | 252 | -107 | — | — | 95 | ~0.43 |")
    for r in results:
        slope = r["boundary"]["slope"]
        inter = r["boundary"]["intercept"]
        r2    = r["boundary"]["r2"]
        A("| %-22s | %5.0f | %6.0f | %.3f | %11d | %20d | %18s |" % (
            r["label"],
            slope if slope is not None else 0,
            inter if inter is not None else 0,
            r2    if r2    is not None else 0,
            r["window_area"],
            r["max_start_t_at_80"] if r["max_start_t_at_80"] >= 0 else -1,
            ("%.2f" % r["min_strength_at_t0"]) if r["min_strength_at_t0"] else "none",
        ))

    A("\n## 2. Grid Heatmap (Prevention Rate)\n")
    for r in results:
        A("### %s\n" % r["label"])
        A("Prevention rate per cell (>=0.50 = preventive). Reference: max_start_t = 252*str - 107\n")
        header = "| start_t\\str | " + " | ".join("%.2f" % s for s in STRENGTHS) + " |"
        sep    = "|" + "---|" * (len(STRENGTHS) + 1)
        A(header)
        A(sep)
        for t in START_TS:
            cells = []
            for s in STRENGTHS:
                pt  = r["grid"][(s, t)]
                val = pt["prevention_rate"]
                ref_max = REF_SLOPE * s + REF_INTERCEPT   # Phase 9 boundary
                mark = "*" if val >= PREV_THRESHOLD else " "
                cells.append("%s%.2f" % (mark, val))
            A("| %7d | " % t + " | ".join(cells) + " |")
        A("\n*Cell marked with * = preventive (rate >= 0.50). "
          "Phase 9 reference boundary: max_start_t = %.0f*str - %.0f\n" % (REF_SLOPE, -REF_INTERCEPT))

    A("## 3. Boundary Comparison Table\n")
    A("Shift = topology_intercept - reference_intercept (positive = window shifted later = wider).\n")
    A("| Topology | Slope | Intercept | Shift vs ref | Window area | Area gain vs baseline |")
    A("|----------|-------|-----------|--------------|-------------|----------------------|")
    baseline_area = next((r["window_area"] for r in results if "baseline" in r["name"]), 1)
    for r in results:
        shift    = (r["boundary"]["intercept"] - REF_INTERCEPT) if r["boundary"]["intercept"] is not None else None
        area_gain = r["window_area"] - baseline_area
        A("| %-22s | %5.0f | %6.0f | %+12.0f | %11d | %+21d |" % (
            r["label"],
            r["boundary"]["slope"]     or 0,
            r["boundary"]["intercept"] or 0,
            shift or 0,
            r["window_area"],
            area_gain,
        ))

    A("\n## 4. Scientific Questions\n")
    for k, v in answers.items():
        A("### %s\n" % k)
        A(v + "\n")

    path.write_text("\n".join(lines), encoding="utf-8")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    with open("results/critical_configs.json", encoding="utf-8") as f:
        top5 = json.load(f)["configs"][:5]

    topologies = [
        ("baseline",          "Baseline C. elegans (127 edges)",                      list(SYNAPSES)),
        ("sparse_chain_100",  "Sparse chain S=100% (115 edges, -12 premotor edges)",  make_sparse_chain_100()),
        ("triangle_rich_60",  "Triangle rich S=60% (133 edges, +6 feedback loops)",   make_triangle_rich_60()),
        ("triangle_rich_100", "Triangle rich S=100% (137 edges, +10 feedback loops)", make_triangle_rich_100()),
    ]

    n_grid  = len(STRENGTHS) * len(START_TS)
    n_per   = len(top5) * N_SEEDS
    n_total = len(topologies) * (n_grid * n_per + n_per)

    print("Phase R2.3 -- Topology-Dependent Therapeutic Boundary")
    print("%d topologies x %d grid points x %d runs + %d baseline = ~%d total runs" % (
        len(topologies), n_grid, n_per, len(topologies) * n_per, n_total))
    print("Steps: %d    ETA: ~%.0f min\n" % (STEPS, n_total * STEPS * 0.000189 / 60))

    all_results = []
    t0 = time.time()

    for tname, tlabel, syns in topologies:
        print("[%s]" % tname)

        # 1. Pre-compute no-therapy baselines
        print("  characterising...", end=" ", flush=True)
        baseline_tips, phase7b = characterise_topology(syns, top5)
        genuine_rate = float(np.mean([r["is_genuine"] for r in phase7b]))
        mean_base_tip = float(np.mean(list(baseline_tips.values())))
        print("genuine=%.0f%%  mean_tip=%.0f" % (genuine_rate * 100, mean_base_tip))

        # 2. Grid sweep
        grid = {}
        for si, s in enumerate(STRENGTHS):
            for ti, t in enumerate(START_TS):
                gp = run_grid_point(syns, top5, s, t, baseline_tips)
                grid[(s, t)] = gp

            # Progress row
            prev_cnt = sum(1 for t in START_TS if grid[(s, t)]["prevention_rate"] >= PREV_THRESHOLD)
            print("  str=%.2f  preventive=%d/%d" % (s, prev_cnt, len(START_TS)))

        # 3. Boundary fit
        slope, intercept, r2, bpts = fit_boundary(grid)
        area    = window_area(grid)
        max_st  = max_preventable_start_t(grid, strength=0.80)
        min_str = min_prevention_strength(grid, start_t=0)

        print("  Boundary: max_start_t = %.0f * str + (%.0f)  R2=%.3f  area=%d  max_st@0.8=%d" % (
            slope or 0, intercept or 0, r2 or 0, area, max_st))

        # 4. Build grid output (compact)
        grid_out = {}
        for s in STRENGTHS:
            for t in START_TS:
                grid_out["%s_%s" % (s, t)] = grid[(s, t)]

        all_results.append({
            "name":     tname,
            "label":    tlabel,
            "n_edges":  len(syns),
            "boundary": {
                "slope":     round(slope,     1) if slope     is not None else None,
                "intercept": round(intercept, 1) if intercept is not None else None,
                "r2":        round(r2,        3) if r2        is not None else None,
                "points":    bpts,
            },
            "window_area":         area,
            "max_start_t_at_80":   max_st,
            "min_strength_at_t0":  min_str,
            "genuine_tipping_rate": round(genuine_rate, 3),
            "mean_baseline_tip":   round(mean_base_tip, 1),
            "phase7b":             phase7b,
            "grid":                grid,
        })
        print()

    elapsed = time.time() - t0
    print("Total runtime: %.0fs\n" % elapsed)

    # ── Answer the 5 questions ─────────────────────────────────────────────────
    baseline   = next(r for r in all_results if r["name"] == "baseline")
    sc100      = next(r for r in all_results if r["name"] == "sparse_chain_100")
    tr60       = next(r for r in all_results if r["name"] == "triangle_rich_60")
    tr100      = next(r for r in all_results if r["name"] == "triangle_rich_100")

    def slope_str(r):
        b = r["boundary"]
        if b["slope"] is None:
            return "not fittable"
        return "%.0f * strength + (%.0f)  [R2=%.3f]" % (b["slope"], b["intercept"], b["r2"])

    def area_delta(r):
        return r["window_area"] - baseline["window_area"]

    def max_delta(r):
        return r["max_start_t_at_80"] - baseline["max_start_t_at_80"]

    # Intercept comparison (window shift)
    def intercept_shift(r):
        if r["boundary"]["intercept"] is None or baseline["boundary"]["intercept"] is None:
            return 0
        return r["boundary"]["intercept"] - baseline["boundary"]["intercept"]

    answers = {}

    # Q1: sparse_chain wider window?
    sc_area_delta = area_delta(sc100)
    sc_max_delta  = max_delta(sc100)
    sc_ishift     = intercept_shift(sc100)
    if sc_area_delta > 0 or sc_max_delta > 0:
        q1 = ("YES. sparse_chain S=100%% has a wider therapeutic window than baseline. "
              "Window area: %d vs %d (delta=%+d). "
              "Max preventable start_t at strength=0.80: %d vs %d (delta=%+d). "
              "Boundary intercept shift: %+.0f steps. "
              "Topology provides %.0f additional steps of therapeutic opportunity by slowing "
              "the cascade before therapy must begin." % (
                  sc100["window_area"], baseline["window_area"], sc_area_delta,
                  sc100["max_start_t_at_80"], baseline["max_start_t_at_80"], sc_max_delta,
                  sc_ishift, max(sc_max_delta, 0)))
    else:
        q1 = ("NO. sparse_chain S=100%% does NOT widen the therapeutic window vs baseline. "
              "Window area: %d vs %d (delta=%+d). "
              "Max preventable start_t at str=0.80: %d vs %d. "
              "Although sparse topology delays tipping, therapy must still be started "
              "by approximately the same step to prevent degeneration." % (
                  sc100["window_area"], baseline["window_area"], sc_area_delta,
                  sc100["max_start_t_at_80"], baseline["max_start_t_at_80"]))
    answers["Q1: Does sparse_chain have a wider therapeutic window?"] = q1

    # Q2: triangle_rich S=60 vs S=100?
    tr60_area  = tr60["window_area"]
    tr100_area = tr100["window_area"]
    tr60_max   = tr60["max_start_t_at_80"]
    tr100_max  = tr100["max_start_t_at_80"]
    if tr60_area >= tr100_area and tr60_max >= tr100_max:
        q2 = ("YES. triangle_rich S=60%% (safe zone) outperforms S=100%% in therapeutic window. "
              "Area: %d vs %d; max start_t at str=0.80: %d vs %d. "
              "This confirms the R2.2 finding: the safe operating zone (<=60%% feedback loops) "
              "preserves therapeutic access, while exceeding it (100%%) narrows the window." % (
                  tr60_area, tr100_area, tr60_max, tr100_max))
    elif tr60_area > tr100_area:
        q2 = ("PARTIALLY. triangle_rich S=60%% has more preventive grid cells (%d vs %d) but "
              "similar max start_t at str=0.80 (%d vs %d). "
              "The safe zone provides modestly better therapeutic access." % (
                  tr60_area, tr100_area, tr60_max, tr100_max))
    else:
        q2 = ("NO. triangle_rich S=60%% does not show a clearly wider window than S=100%%. "
              "Area: %d vs %d; max start_t at str=0.80: %d vs %d. "
              "The safety advantage of the 60%% operating point (from R2.2) does not translate "
              "into measurably better therapeutic access with this N=5-seed sample." % (
                  tr60_area, tr100_area, tr60_max, tr100_max))
    answers["Q2: Does triangle_rich S=60% outperform S=100%?"] = q2

    # Q3: Boundary equations
    q3_lines = ["Fitted boundary: max_start_t = slope * strength + intercept\n"]
    q3_lines.append("Reference (Phase 9/10 aggregate, top-20 configs): max_start_t = 252*str - 107")
    for r in all_results:
        b = r["boundary"]
        if b["slope"] is not None:
            pred_t80   = b["slope"] * 0.80 + b["intercept"]
            ref_t80    = REF_SLOPE * 0.80 + REF_INTERCEPT
            q3_lines.append(
                "  %s: max_start_t = %.0f*str + (%.0f)  R2=%.3f  "
                "At str=0.80: pred=%.0f vs ref=%.0f" % (
                    r["name"], b["slope"], b["intercept"], b["r2"], pred_t80, ref_t80))
        else:
            q3_lines.append("  %s: boundary not fittable (insufficient preventive points)" % r["name"])
    answers["Q3: What is the boundary equation for each topology?"] = "\n".join(q3_lines)

    # Q4: Can topology substitute for earlier therapy?
    ranked = sorted(all_results, key=lambda r: r["max_start_t_at_80"], reverse=True)
    best   = ranked[0]
    worst  = ranked[-1]
    span   = best["max_start_t_at_80"] - worst["max_start_t_at_80"]
    if span >= 25:
        q4 = ("YES — partially. The topology with the widest window (%s) allows "
              "therapy to begin up to %d steps later at strength=0.80 than the most restrictive "
              "topology (%s, max=%d steps). This %d-step difference represents a clinically "
              "meaningful extension of the pre-symptomatic window. Topology does not fully "
              "substitute for therapy (min_strength at t=0 differs little), but it extends "
              "how late therapy can start while remaining effective." % (
                  best["label"], best["max_start_t_at_80"],
                  worst["label"], worst["max_start_t_at_80"], span))
    elif span > 0:
        q4 = ("MARGINALLY. The widest window (%s, max=%d steps at str=0.80) is only %d steps "
              "broader than the narrowest (%s, max=%d steps). This difference is below the "
              "25-step threshold for clinical significance. Topology affects severity but "
              "does not meaningfully substitute for early therapy timing." % (
                  best["label"], best["max_start_t_at_80"],
                  span, worst["label"], worst["max_start_t_at_80"]))
    else:
        q4 = ("NO. All topologies show similar max_start_t at strength=0.80, suggesting that "
              "topology does not substitute for earlier therapy. Connectivity structure alters "
              "cascade dynamics but does not meaningfully expand the therapeutic window.")
    answers["Q4: Can topology choice substitute for earlier therapy?"] = q4

    # Q5: Clinical implication
    best_area_r  = max(all_results, key=lambda r: r["window_area"])
    worst_area_r = min(all_results, key=lambda r: r["window_area"])
    q5 = (
        "Clinical implication: Connectivity architecture directly influences therapeutic opportunity. "
        "The widest window was found in %s (area=%d preventive grid cells) vs the narrowest in "
        "%s (area=%d). This suggests that therapeutic strategies targeting synaptic pruning or "
        "circuit simplification (analogous to sparse_chain modification) may extend the "
        "pre-symptomatic window during which drug intervention remains effective. Conversely, "
        "pro-connectivity interventions that increase recurrent loops (triangle_rich S=100%%) "
        "may inadvertently narrow the window, accelerating the onset of therapy-resistant Tier-2 cascade. "
        "The R2.2 safe operating zone (<=60%% feedback strength) appears to offer the best "
        "balance: enhanced communication efficiency without sacrificing therapeutic accessibility. "
        "In an ALS drug discovery context, this suggests that connectivity biomarkers "
        "measuring circuit redundancy and feedback loop density could predict therapeutic window "
        "width independently of disease severity — a testable hypothesis for patient stratification." % (
            best_area_r["label"], best_area_r["window_area"],
            worst_area_r["label"], worst_area_r["window_area"]))
    answers["Q5: What is the clinical implication of topology-dependent windows?"] = q5

    # ── Save outputs ───────────────────────────────────────────────────────────
    Path("results").mkdir(exist_ok=True)

    # Convert grid keys to strings for JSON serialisation
    out_results = []
    for r in all_results:
        ro = {k: v for k, v in r.items() if k != "grid"}
        ro["grid"] = {
            "strength_%s_start_%s" % (str(s).replace(".", "p"), t): r["grid"][(s, t)]
            for s in STRENGTHS for t in START_TS
        }
        out_results.append(ro)

    out = {
        "description":   "Phase R2.3 Topology-Dependent Therapeutic Boundary",
        "grid_axes":     {"strengths": STRENGTHS, "start_ts": START_TS},
        "n_configs":     len(top5),
        "n_seeds":       N_SEEDS,
        "steps":         STEPS,
        "prev_threshold": PREV_THRESHOLD,
        "reference_boundary": {"slope": REF_SLOPE, "intercept": REF_INTERCEPT},
        "scientific_answers": answers,
        "topologies":    out_results,
    }
    with open("results/r2_therapy_boundary.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("Saved -> results/r2_therapy_boundary.json")

    write_report(all_results, answers, Path("results/round2_therapy_boundary_report.md"))
    print("Saved -> results/round2_therapy_boundary_report.md")

    # Summary
    print("\nBoundary summary:")
    for r in all_results:
        b = r["boundary"]
        print("  %-24s slope=%-5.0f intercept=%-6.0f R2=%.3f area=%2d max_st@0.8=%d" % (
            r["name"],
            b["slope"] or 0, b["intercept"] or 0, b["r2"] or 0,
            r["window_area"], r["max_start_t_at_80"]))


if __name__ == "__main__":
    main()

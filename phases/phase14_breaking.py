"""
Phase 14 -- Breaking Threshold Probe
Edge dropout (30/50/70%) and vulnerability noise (sigma=0.50/1.00)
applied to top-5 genuine critical configs from Phase 7B.
10 seeds per condition, 300 steps.
Finds breaking points: genuine_rate<0.5, coherence_r<0.3, subtype_rank_r<0.5.
"""

import json, math, time
import numpy as np

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES, VULNERABILITY
from phase5_criticality import CriticalitySimulator

N            = 61
STEPS        = 300
N_SEEDS      = 10
DEAD_THR     = 0.15
TIPPING_THR  = 55
SLOPE_THR    = 4
COH_THR_CRIT = 0.30
SILENT_MIN   = 50

BRK_GENUINE = 0.5
BRK_COH     = 0.3
BRK_SPEAR   = 0.5

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES], dtype=float)

# ── helpers ───────────────────────────────────────────────────────────────────

def _to_py(obj):
    if isinstance(obj, dict):  return {k: _to_py(v) for k, v in obj.items()}
    if isinstance(obj, list):  return [_to_py(v) for v in obj]
    if isinstance(obj, (np.integer,)):  return int(obj)
    if isinstance(obj, (np.floating,)): return float(obj)
    if isinstance(obj, (np.bool_,)):    return bool(obj)
    if isinstance(obj, float) and math.isnan(obj): return None
    return obj

def _pearson_r(x, y):
    n = len(x)
    if n < 3:
        return 0.0
    mx, my = x.mean(), y.mean()
    num = ((x - mx) * (y - my)).sum()
    den = math.sqrt(((x - mx)**2).sum() * ((y - my)**2).sum())
    return float(num / den) if den > 1e-12 else 0.0

def _spearman_r(a, b):
    if len(a) < 3:
        return 0.0
    ra = np.argsort(np.argsort(a)).astype(float)
    rb = np.argsort(np.argsort(b)).astype(float)
    return _pearson_r(ra, rb)

# ── simulation ────────────────────────────────────────────────────────────────

def make_sim(params, seed):
    return CriticalitySimulator(seed=seed, params=params)

def run_sim(sim):
    death_step = np.full(N, STEPS, dtype=int)
    hist = []
    for t in range(STEPS):
        sim.step()
        alive_count = int((sim.health > DEAD_THR).sum())
        hist.append(alive_count)
        newly_dead = (sim.health <= DEAD_THR) & (death_step == STEPS)
        death_step[newly_dead] = t + 1

    tipping   = next((t + 1 for t, a in enumerate(hist) if a < TIPPING_THR), STEPS)
    silent    = next((t + 1 for t, a in enumerate(hist) if a < N),           STEPS)
    rates     = [hist[t] - hist[t + 10] for t in range(len(hist) - 10)]
    peak_rate = max(rates) if rates else 0

    died_mask = death_step < STEPS
    coh_r = (_pearson_r(VULN[died_mask], -death_step[died_mask].astype(float))
             if died_mask.sum() >= 3 else 0.0)

    return tipping, coh_r, silent, peak_rate

def eval_runs(rows):
    tips    = [r[0] for r in rows]
    cohrs   = [r[1] for r in rows]
    silents = [r[2] for r in rows]
    peaks   = [r[3] for r in rows]
    tip_med  = float(np.median(tips))
    coh_med  = float(np.median(cohrs))
    sil_med  = float(np.median(silents))
    peak_med = float(np.median(peaks))
    genuine  = bool(peak_med > SLOPE_THR and coh_med > COH_THR_CRIT and sil_med > SILENT_MIN)
    return tip_med, coh_med, genuine

# ── connectivity ──────────────────────────────────────────────────────────────

def _largest_component_mask(W):
    """DFS on undirected adjacency; returns bool mask of largest connected component."""
    n   = W.shape[0]
    adj = (W > 0) | (W.T > 0)
    visited = np.zeros(n, dtype=bool)
    best = []
    for start in range(n):
        if visited[start]:
            continue
        comp  = []
        stack = [start]
        visited[start] = True
        while stack:
            node = stack.pop()
            comp.append(node)
            for nbr in np.where(adj[node])[0]:
                if not visited[nbr]:
                    visited[nbr] = True
                    stack.append(nbr)
        if len(comp) > len(best):
            best = comp
    mask = np.zeros(n, dtype=bool)
    mask[best] = True
    return mask

# ── perturbation functions ────────────────────────────────────────────────────

def apply_edge_dropout(sim, frac, rng):
    """
    Drop frac of directed edges. If graph disconnects, restrict to largest component.
    Returns size of retained component.
    """
    positions = np.argwhere(sim.agg_W > 0)
    n_edges   = len(positions)
    n_drop    = max(1, int(n_edges * frac))
    n_drop    = min(n_drop, n_edges)
    chosen    = rng.choice(n_edges, n_drop, replace=False)
    for idx in chosen:
        i, j = positions[idx]
        sim.agg_W[i, j]       = 0.0
        sim.excitotox_W[i, j] = 0.0

    mask    = _largest_component_mask(sim.agg_W)
    n_comp  = int(mask.sum())
    if n_comp < N:
        outside = np.where(~mask)[0]
        sim.agg_W[outside, :]       = 0.0
        sim.agg_W[:, outside]       = 0.0
        sim.excitotox_W[outside, :] = 0.0
        sim.excitotox_W[:, outside] = 0.0
    return n_comp

def apply_vuln_noise(sim, sigma, rng):
    """Additive Gaussian noise on vulnerability, clipped to [0.01, 1.0]."""
    noise = rng.normal(0.0, sigma, sim.vulnerability.shape)
    sim.vulnerability = np.clip(sim.vulnerability + noise, 0.01, 1.0)
    return None

# ── load data ─────────────────────────────────────────────────────────────────

print("Phase 14 -- Breaking Threshold Probe")
print("=" * 60)
t0 = time.time()

rm  = json.load(open("results/regime_map.json",               encoding="utf-8"))
p7b = json.load(open("results/phase7b_strict_criterion.json", encoding="utf-8"))

rm_by_id    = {c["id"]: c for c in rm["configs"]}
p7b_genuine = {c["config_id"]: c
               for c in p7b["phase5_critical"]["configs"] if c["is_genuine"]}

scored = []
for c in rm["configs"]:
    if c["id"] in p7b_genuine:
        s = min(c["alive_at_200"] - 10, 50 - c["alive_at_500"]) / 40.0
        scored.append((s, c["id"]))
scored.sort(reverse=True)

top5_ids  = [cid for _, cid in scored[:5]]
top5_cfgs = [{"id": cid, "params": rm_by_id[cid]["params"]} for cid in top5_ids]
N_CFGS    = len(top5_ids)

print(f"Top-5 genuine critical configs: {top5_ids}")

# ── baseline (300 steps, 10 seeds) ────────────────────────────────────────────

print("\nBaseline (10 seeds, 300 steps, no perturbation):")
baseline = {}
for cfg in top5_cfgs:
    cid, params = cfg["id"], cfg["params"]
    rows = []
    for k in range(N_SEEDS):
        rows.append(run_sim(make_sim(params, cid + 100 + k * 1000)))
    tip_med, coh_med, genuine = eval_runs(rows)
    baseline[cid] = (tip_med, coh_med, genuine)
    print(f"  id={cid:4d}  tip={tip_med:5.1f}  coh_r={coh_med:.3f}  "
          f"genuine={'Y' if genuine else 'N'}")

base_tip_arr  = np.array([baseline[cid][0] for cid in top5_ids])
base_coh_arr  = np.array([baseline[cid][1] for cid in top5_ids])
base_gen_arr  = np.array([1.0 if baseline[cid][2] else 0.0 for cid in top5_ids])
base_tip_mean = float(base_tip_arr.mean())
base_coh_mean = float(base_coh_arr.mean())
base_gen_mean = float(base_gen_arr.mean())
print(f"\n  Mean: tip={base_tip_mean:.1f}  coh_r={base_coh_mean:.3f}  "
      f"genuine_rate={base_gen_mean:.2f}")

# ── generic runner ────────────────────────────────────────────────────────────

def run_levels(pert_name, levels, apply_fn):
    """
    apply_fn(sim, level, rng) -> int or None (int used as component size)
    Returns list of per-level result dicts.
    """
    results = []
    for lvl_idx, level in enumerate(levels):
        tip_arr   = np.zeros(N_CFGS)
        coh_arr   = np.zeros(N_CFGS)
        gen_arr   = np.zeros(N_CFGS)
        comp_list = []
        per_cfg   = []

        for cfg_idx, cfg in enumerate(top5_cfgs):
            cid, params = cfg["id"], cfg["params"]
            rows      = []
            cfg_comps = []
            for k in range(N_SEEDS):
                sim_seed  = cid + 100 + k * 1000
                pert_seed = abs(hash(pert_name)) % 10**6 + lvl_idx * 100_000 + k
                sim = make_sim(params, sim_seed)
                rng = np.random.default_rng(pert_seed)
                ret = apply_fn(sim, level, rng)
                if ret is not None:
                    cfg_comps.append(ret)
                rows.append(run_sim(sim))

            tip_med, coh_med, genuine = eval_runs(rows)
            tip_arr[cfg_idx] = tip_med
            coh_arr[cfg_idx] = coh_med
            gen_arr[cfg_idx] = 1.0 if genuine else 0.0
            comp_list.extend(cfg_comps)

            entry = {
                "config_id": cid,
                "tip_med":   tip_med,
                "coh_r_med": coh_med,
                "genuine":   genuine,
            }
            if cfg_comps:
                entry["mean_component_size"] = float(np.mean(cfg_comps))
            per_cfg.append(entry)

        tip_mean = float(tip_arr.mean())
        coh_mean = float(coh_arr.mean())
        gen_mean = float(gen_arr.mean())
        spear_r  = _spearman_r(base_tip_arr, tip_arr)

        level_result = {
            "level":              level,
            "tip_mean":           tip_mean,
            "coh_r_mean":         coh_mean,
            "genuine_rate":       gen_mean,
            "subtype_spearman_r": spear_r,
            "per_config":         per_cfg,
        }
        if comp_list:
            level_result["mean_component_size"] = float(np.mean(comp_list))

        results.append(level_result)

        comp_str = (f"  comp={level_result['mean_component_size']:.1f}"
                    if "mean_component_size" in level_result else "")
        print(f"  {pert_name} level={level}  "
              f"tip={tip_mean:.1f}  coh={coh_mean:.3f}  "
              f"gen={gen_mean:.2f}  rank_r={spear_r:.3f}{comp_str}")

    return results

# ── breaking point detection ──────────────────────────────────────────────────

def find_breaking_points(results):
    """First level where each metric drops below its threshold; else 'not_reached'."""
    checks = [
        ("genuine_rate_below_0.5",   "genuine_rate",       BRK_GENUINE),
        ("coherence_r_below_0.3",    "coh_r_mean",         BRK_COH),
        ("subtype_rank_r_below_0.5", "subtype_spearman_r", BRK_SPEAR),
    ]
    out = {}
    for name, key, threshold in checks:
        found = None
        for r in results:
            if r[key] < threshold:
                found = r["level"]
                break
        out[name] = found if found is not None else "not_reached"
    return out

# ── run perturbations ─────────────────────────────────────────────────────────

print("\nPerturbation 1: Edge dropout (30%, 50%, 70%)")
print("  (disconnected graphs restricted to largest component)")
p1_results = run_levels("edge_dropout", [0.30, 0.50, 0.70], apply_edge_dropout)
p1_brk     = find_breaking_points(p1_results)

print("\nPerturbation 2: Vulnerability noise (sigma=0.50, 1.00)")
p2_results = run_levels("vuln_noise",   [0.50, 1.00],        apply_vuln_noise)
p2_brk     = find_breaking_points(p2_results)

runtime = time.time() - t0
print(f"\nTotal runtime: {runtime:.1f}s")

print("\nBreaking points -- edge_dropout:")
for k, v in p1_brk.items():
    print(f"  {k}: {v}")
print("Breaking points -- vuln_noise:")
for k, v in p2_brk.items():
    print(f"  {k}: {v}")

# ── save JSON ─────────────────────────────────────────────────────────────────

result = {
    "description":  "Phase 14 breaking threshold probe",
    "n_configs":    N_CFGS,
    "config_ids":   top5_ids,
    "n_seeds":      N_SEEDS,
    "steps":        STEPS,
    "baseline": {
        "tip_mean":     base_tip_mean,
        "coh_r_mean":   base_coh_mean,
        "genuine_rate": base_gen_mean,
        "per_config": [
            {
                "config_id": cid,
                "tip_med":   baseline[cid][0],
                "coh_r_med": baseline[cid][1],
                "genuine":   baseline[cid][2],
            }
            for cid in top5_ids
        ],
    },
    "breaking_thresholds": {
        "genuine_rate":   BRK_GENUINE,
        "coherence_r":    BRK_COH,
        "subtype_rank_r": BRK_SPEAR,
    },
    "perturbations": {
        "edge_dropout": {
            "levels":          [0.30, 0.50, 0.70],
            "results":         p1_results,
            "breaking_points": p1_brk,
        },
        "vuln_noise": {
            "levels":          [0.50, 1.00],
            "results":         p2_results,
            "breaking_points": p2_brk,
        },
    },
    "runtime_s": round(runtime, 1),
}
result = _to_py(result)

with open("results/phase14_breaking.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2)
print("Saved -> results/phase14_breaking.json")

# ── report ────────────────────────────────────────────────────────────────────

def build_report(res):
    b  = res["baseline"]
    ps = res["perturbations"]
    bt = res["breaking_thresholds"]

    lines = [
        "# Phase 14 -- Breaking Threshold Probe",
        "",
        "## Setup",
        f"  Top-5 genuine critical configs (Phase 7B)",
        f"  Config IDs: {', '.join(str(c) for c in res['config_ids'])}",
        f"  Seeds per level: {res['n_seeds']}  |  Steps: {res['steps']}",
        "",
        "## Baseline (no perturbation, 10 seeds, 300 steps)",
        f"  Mean tipping step:  {b['tip_mean']:.1f}",
        f"  Mean coherence r:   {b['coh_r_mean']:.3f}",
        f"  Genuine rate:       {b['genuine_rate']:.2f}",
        "",
        "  Per-config breakdown:",
    ]
    for pc in b["per_config"]:
        lines.append(
            f"    id={pc['config_id']:4d}  tip={pc['tip_med']:5.1f}  "
            f"coh_r={pc['coh_r_med']:.3f}  genuine={'Y' if pc['genuine'] else 'N'}"
        )
    lines.append("")

    # ── Perturbation 1: Edge dropout ─────────────────────────────────────────
    p1 = ps["edge_dropout"]
    lines += [
        "## Perturbation 1: Edge Dropout (30%, 50%, 70%)",
        "  Edges dropped uniformly at random from agg_W and excitotox_W.",
        "  If graph disconnects, edges outside largest component are zeroed.",
        "",
        f"  Baseline: tip={b['tip_mean']:.1f}  coh_r={b['coh_r_mean']:.3f}  "
        f"genuine_rate={b['genuine_rate']:.2f}",
        "",
        f"  {'Level':<8} {'Tip':>6} {'Coh_r':>6} {'Gen':>5} {'Rank_r':>7} {'Comp_sz':>8}",
        f"  {'-----':<8} {'---':>6} {'-----':>6} {'---':>5} {'------':>7} {'-------':>8}",
    ]
    for r in p1["results"]:
        comp_str = (f"{r['mean_component_size']:>8.1f}"
                    if "mean_component_size" in r else f"{'N/A':>8}")
        lines.append(
            f"  {r['level']:.0%}     "
            f"{r['tip_mean']:>6.1f} "
            f"{r['coh_r_mean']:>6.3f} "
            f"{r['genuine_rate']:>5.2f} "
            f"{r['subtype_spearman_r']:>7.3f} "
            f"{comp_str}"
        )
    lines += [
        "",
        "  Breaking points (edge_dropout):",
    ]
    for k, v in p1["breaking_points"].items():
        lines.append(f"    {k}: {v}")
    lines.append("")

    # ── Perturbation 2: Vulnerability noise ───────────────────────────────────
    p2 = ps["vuln_noise"]
    lines += [
        "## Perturbation 2: Vulnerability Noise (sigma=0.50, 1.00)",
        "  Additive Gaussian noise clipped to [0.01, 1.0].",
        "",
        f"  Baseline: tip={b['tip_mean']:.1f}  coh_r={b['coh_r_mean']:.3f}  "
        f"genuine_rate={b['genuine_rate']:.2f}",
        "",
        f"  {'Sigma':<8} {'Tip':>6} {'Coh_r':>6} {'Gen':>5} {'Rank_r':>7}",
        f"  {'-----':<8} {'---':>6} {'-----':>6} {'---':>5} {'------':>7}",
    ]
    for r in p2["results"]:
        lines.append(
            f"  {r['level']:<8.2f} "
            f"{r['tip_mean']:>6.1f} "
            f"{r['coh_r_mean']:>6.3f} "
            f"{r['genuine_rate']:>5.2f} "
            f"{r['subtype_spearman_r']:>7.3f}"
        )
    lines += [
        "",
        "  Breaking points (vuln_noise):",
    ]
    for k, v in p2["breaking_points"].items():
        lines.append(f"    {k}: {v}")
    lines.append("")

    # ── Summary ───────────────────────────────────────────────────────────────
    lines += [
        "## Breaking Point Summary",
        "",
        f"  Thresholds:  genuine_rate < {bt['genuine_rate']}  |  "
        f"coherence_r < {bt['coherence_r']}  |  "
        f"subtype_rank_r < {bt['subtype_rank_r']}",
        "",
        f"  {'Criterion':<32} {'edge_dropout':<18} {'vuln_noise'}",
        f"  {'---':<32} {'------------':<18} {'----------'}",
    ]
    for k in ["genuine_rate_below_0.5",
              "coherence_r_below_0.3",
              "subtype_rank_r_below_0.5"]:
        v1 = str(p1["breaking_points"].get(k, "not_reached"))
        v2 = str(p2["breaking_points"].get(k, "not_reached"))
        lines.append(f"  {k:<32} {v1:<18} {v2}")

    lines += [
        "",
        "## Interpretation",
        "",
        "  Breaking threshold definitions:",
        f"    genuine_rate < {bt['genuine_rate']}   : fewer than half of configs show genuine tipping",
        f"    coherence_r  < {bt['coherence_r']}   : spatial death-order coherence is lost",
        f"    subtype_rank_r < {bt['subtype_rank_r']} : relative tipping-speed ordering is scrambled",
        "",
        "  Note: 5-config Spearman r has high variance; rank_r results are indicative only.",
        "  Note: config #235 baseline tip (~291) approaches the 300-step limit;",
        "        some seeds may not tip within window, underestimating robustness.",
        "",
        f"  Total runtime: {res['runtime_s']:.1f}s",
        "",
        "---",
        "_Generated by `phase14_breaking.py` -- ALS connectome project Phase 14_",
    ]
    return "\n".join(lines)


report = build_report(result)
with open("results/phase14_breaking_report.md", "w", encoding="utf-8") as f:
    f.write(report)
print("Saved -> results/phase14_breaking_report.md")
print()
print("Done.")

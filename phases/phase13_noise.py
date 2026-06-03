"""
Phase 13 -- Biological Noise Robustness
Four perturbation types applied independently to the top-10 genuine
critical configs from Phase 7B.  20 seeds per (config x perturbation level).
Verdict: robust (<10% change), moderate (10-30%), fragile (>30%).
"""

import json, math, sys, time
import numpy as np

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES, VULNERABILITY, SYNAPSES
from phase5_criticality import CriticalitySimulator

# ── constants ─────────────────────────────────────────────────────────────────

N          = 61
STEPS      = 500
N_SEEDS    = 20
DEAD_THR   = 0.15
TIPPING_THR = 55   # alive < this -> tipping zone
SLOPE_THR  = 4     # c1: peak 10-step decline
COH_THR    = 0.30  # c2: spatial coherence
SILENT_MIN = 50    # c3: first death step

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
    """Rank correlation between two arrays of equal length."""
    n = len(a)
    if n < 3:
        return 0.0
    ra = np.argsort(np.argsort(a)).astype(float)
    rb = np.argsort(np.argsort(b)).astype(float)
    return _pearson_r(ra, rb)

def verdict(rel_change):
    if rel_change < 0.10: return "robust"
    if rel_change < 0.30: return "moderate"
    return "fragile"

# ── run one simulation; return tipping metrics ─────────────────────────────────

def run_sim(sim):
    death_step = np.full(N, STEPS, dtype=int)
    hist       = []
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
    if died_mask.sum() >= 3:
        coh_r = _pearson_r(VULN[died_mask], -death_step[died_mask].astype(float))
    else:
        coh_r = 0.0

    return tipping, coh_r, silent, peak_rate

def eval_runs(rows):
    """
    rows: list of (tipping, coh_r, silent, peak_rate).
    Returns (tip_med, coh_med, genuine).
    """
    tips   = [r[0] for r in rows]
    cohrs  = [r[1] for r in rows]
    silents= [r[2] for r in rows]
    peaks  = [r[3] for r in rows]
    tip_med  = float(np.median(tips))
    coh_med  = float(np.median(cohrs))
    sil_med  = float(np.median(silents))
    peak_med = float(np.median(peaks))
    genuine  = bool(peak_med > SLOPE_THR and coh_med > COH_THR and sil_med > SILENT_MIN)
    return tip_med, coh_med, genuine

# ── perturbation functions ────────────────────────────────────────────────────

def make_sim(params, seed):
    """Create a fresh CriticalitySimulator with given params and seed."""
    return CriticalitySimulator(seed=seed, params=params)

def apply_weight_noise(sim, sigma, rng):
    """Multiplicative Gaussian noise on non-zero edge weights."""
    mask = sim.agg_W > 0
    noise = rng.normal(0.0, sigma, sim.agg_W.shape)
    sim.agg_W[mask] = np.clip(sim.agg_W[mask] * (1.0 + noise[mask]), 0.0, None)

    mask_e = sim.excitotox_W > 0
    noise_e = rng.normal(0.0, sigma, sim.excitotox_W.shape)
    sim.excitotox_W[mask_e] = np.clip(
        sim.excitotox_W[mask_e] * (1.0 + noise_e[mask_e]), 0.0, None
    )

def apply_vuln_noise(sim, sigma, rng):
    """Additive Gaussian noise on vulnerability scores, clipped to [0, 1]."""
    noise = rng.normal(0.0, sigma, sim.vulnerability.shape)
    sim.vulnerability = np.clip(sim.vulnerability + noise, 0.0, 1.0)

def apply_edge_dropout(sim, frac, rng):
    """Zero out a fraction of non-zero entries in agg_W and excitotox_W."""
    positions = np.argwhere(sim.agg_W > 0)
    n_drop    = max(1, int(len(positions) * frac))
    n_drop    = min(n_drop, len(positions))
    chosen    = rng.choice(len(positions), n_drop, replace=False)
    for idx in chosen:
        i, j = positions[idx]
        sim.agg_W[i, j]        = 0.0
        sim.excitotox_W[i, j]  = 0.0

def apply_hetero_amp(sim, variation, rng):
    """
    Give each neuron a distinct aggAmp drawn from
    Uniform(base*(1-variation), base*(1+variation)).
    Implemented by scaling vulnerability (intrinsic seeding) and
    each row of agg_W (received spread) by the relative factor.
    """
    base = sim.p["aggregationAmplification"]
    lo   = max(0.0, base * (1.0 - variation))
    hi   = base * (1.0 + variation)
    per_neuron = rng.uniform(lo, hi, sim.n)
    scale = per_neuron / base          # relative deviation from mean
    sim.vulnerability = sim.vulnerability * scale
    for j in range(sim.n):
        sim.agg_W[j, :] *= scale[j]   # row j receives proportional spread

# ── load data ─────────────────────────────────────────────────────────────────

print("Phase 13 -- Biological Noise Robustness")
print("=" * 60)
t0 = time.time()

rm  = json.load(open("results/regime_map.json", encoding="utf-8"))
p7b = json.load(open("results/phase7b_strict_criterion.json", encoding="utf-8"))

rm_by_id   = {c["id"]: c for c in rm["configs"]}
p7b_genuine = {c["config_id"]: c
               for c in p7b["phase5_critical"]["configs"] if c["is_genuine"]}

# Select top 10 by Phase-5 score: min(alive@200-10, 50-alive@500)/40
scored = []
for c in rm["configs"]:
    if c["id"] in p7b_genuine:
        s = min(c["alive_at_200"] - 10, 50 - c["alive_at_500"]) / 40.0
        scored.append((s, c["id"]))
scored.sort(reverse=True)
top10_ids  = [cid for _, cid in scored[:10]]
top10_cfgs = [{"id": cid, "params": rm_by_id[cid]["params"]} for cid in top10_ids]

print(f"Top-10 genuine critical configs: {top10_ids}")

# ── baseline ──────────────────────────────────────────────────────────────────

print("\nBaseline runs (no perturbation):")
baseline = {}          # config_id -> (tip_med, coh_med, genuine)
for cfg in top10_cfgs:
    cid    = cfg["id"]
    params = cfg["params"]
    rows   = []
    for k in range(N_SEEDS):
        seed = cid + 100 + k * 1000
        sim  = make_sim(params, seed)
        rows.append(run_sim(sim))
    tip_med, coh_med, genuine = eval_runs(rows)
    baseline[cid] = (tip_med, coh_med, genuine)
    print(f"  id={cid:4d}  tip={tip_med:5.1f}  coh_r={coh_med:.3f}  "
          f"genuine={'Y' if genuine else 'N'}")

base_tip_arr  = np.array([baseline[cid][0] for cid in top10_ids])
base_coh_arr  = np.array([baseline[cid][1] for cid in top10_ids])
base_gen_arr  = np.array([1.0 if baseline[cid][2] else 0.0 for cid in top10_ids])
base_tip_mean = float(base_tip_arr.mean())
base_coh_mean = float(base_coh_arr.mean())
base_gen_mean = float(base_gen_arr.mean())
print(f"\n  Baseline mean: tip={base_tip_mean:.1f}  "
      f"coh_r={base_coh_mean:.3f}  genuine_rate={base_gen_mean:.2f}")

# ── perturbation experiment runner ────────────────────────────────────────────

def run_perturbation(pert_type, levels, apply_fn, extra_fn=None):
    """
    pert_type  : str label
    levels     : list of noise levels
    apply_fn   : function(sim, level, rng) -> None
    extra_fn   : optional function(level_results) -> dict of extra metrics
    Returns list of level-result dicts.
    """
    results = []
    for lvl_idx, level in enumerate(levels):
        tip_arr  = np.zeros(len(top10_ids))
        coh_arr  = np.zeros(len(top10_ids))
        gen_arr  = np.zeros(len(top10_ids))
        per_cfg  = []

        for cfg_idx, cfg in enumerate(top10_cfgs):
            cid    = cfg["id"]
            params = cfg["params"]
            rows   = []
            for k in range(N_SEEDS):
                sim_seed  = cid + 100 + k * 1000
                pert_seed = (abs(hash(pert_type)) % 10**6 +
                             lvl_idx * 100_000 + k)
                sim  = make_sim(params, sim_seed)
                rng  = np.random.default_rng(pert_seed)
                apply_fn(sim, level, rng)
                rows.append(run_sim(sim))

            tip_med, coh_med, genuine = eval_runs(rows)
            tip_arr[cfg_idx]  = tip_med
            coh_arr[cfg_idx]  = coh_med
            gen_arr[cfg_idx]  = 1.0 if genuine else 0.0
            per_cfg.append({
                "config_id":    cid,
                "tip_med":      tip_med,
                "coh_r_med":    coh_med,
                "genuine":      genuine,
            })

        tip_mean  = float(tip_arr.mean())
        coh_mean  = float(coh_arr.mean())
        gen_mean  = float(gen_arr.mean())

        rel_tip   = abs(tip_mean - base_tip_mean) / max(base_tip_mean, 1e-6)
        rel_coh   = abs(coh_mean - base_coh_mean) / max(base_coh_mean, 1e-6)
        rel_gen   = (abs(gen_mean - base_gen_mean) / max(base_gen_mean, 1e-6)
                     if base_gen_mean > 0 else 0.0)

        extra = {}
        if extra_fn is not None:
            extra = extra_fn(tip_arr, coh_arr, gen_arr)

        level_result = {
            "level":         level,
            "tip_mean":      tip_mean,
            "coh_r_mean":    coh_mean,
            "genuine_mean":  gen_mean,
            "rel_change_tip": rel_tip,
            "rel_change_coh": rel_coh,
            "rel_change_gen": rel_gen,
            "verdict_tip":   verdict(rel_tip),
            "verdict_coh":   verdict(rel_coh),
            "verdict_gen":   verdict(rel_gen),
            "per_config":    per_cfg,
            **extra,
        }
        results.append(level_result)
        print(f"  {pert_type} level={level}  "
              f"tip={tip_mean:.1f}(rel={rel_tip:.1%})  "
              f"coh={coh_mean:.3f}(rel={rel_coh:.1%})  "
              f"gen={gen_mean:.2f}  "
              f"verdict: tip={verdict(rel_tip)} "
              f"coh={verdict(rel_coh)} "
              f"gen={verdict(rel_gen)}")
    return results


# ── Perturbation 1: Synaptic weight noise ─────────────────────────────────────

print("\nPerturbation 1: Synaptic weight noise (sigma = 5%, 10%, 20%)")
p1_results = run_perturbation(
    "weight_noise",
    [0.05, 0.10, 0.20],
    apply_weight_noise,
)

# ── Perturbation 2: Vulnerability score noise ─────────────────────────────────

print("\nPerturbation 2: Vulnerability score noise (sigma = 0.05, 0.10, 0.20)")
p2_results = run_perturbation(
    "vuln_noise",
    [0.05, 0.10, 0.20],
    apply_vuln_noise,
)

# ── Perturbation 3: Edge dropout ──────────────────────────────────────────────

print("\nPerturbation 3: Edge dropout (frac = 2%, 5%, 10%)")
p3_results = run_perturbation(
    "edge_dropout",
    [0.02, 0.05, 0.10],
    apply_edge_dropout,
)

# ── Perturbation 4: Heterogeneous aggAmp ──────────────────────────────────────

print("\nPerturbation 4: Heterogeneous aggAmp (+/-20% per neuron)")

def subtype_extra(tip_arr, coh_arr, gen_arr):
    """Check if subtype ordering (tipping step rank) is preserved."""
    # Spearman r between baseline tipping ranks and perturbed tipping ranks
    spear = _spearman_r(base_tip_arr, tip_arr)
    tip_cv_base = float(np.std(base_tip_arr) / np.mean(base_tip_arr))
    tip_cv_pert = float(np.std(tip_arr) / np.mean(tip_arr))
    return {
        "subtype_spearman_r": spear,
        "tip_cv_baseline":    tip_cv_base,
        "tip_cv_perturbed":   tip_cv_pert,
        "subtypes_separate":  spear > 0.6,
    }

p4_results = run_perturbation(
    "hetero_amp",
    [0.20],
    lambda sim, level, rng: apply_hetero_amp(sim, level, rng),
    extra_fn=subtype_extra,
)

# ── Compile overall verdicts ──────────────────────────────────────────────────

def overall_verdict_for(results):
    """Strictest verdict across all levels and metrics (fragile > moderate > robust)."""
    ORDER = {"robust": 0, "moderate": 1, "fragile": 2}
    worst = "robust"
    for r in results:
        for k in ("verdict_tip", "verdict_coh", "verdict_gen"):
            if ORDER[r[k]] > ORDER[worst]:
                worst = r[k]
    return worst

verdicts = {
    "weight_noise":  overall_verdict_for(p1_results),
    "vuln_noise":    overall_verdict_for(p2_results),
    "edge_dropout":  overall_verdict_for(p3_results),
    "hetero_amp":    overall_verdict_for(p4_results),
}

print("\nOverall verdicts:")
for k, v in verdicts.items():
    print(f"  {k:20s} -> {v.upper()}")

runtime = time.time() - t0
print(f"\nTotal runtime: {runtime:.1f}s")

# ── Save JSON ─────────────────────────────────────────────────────────────────

result = {
    "description": "Phase 13 biological noise robustness",
    "n_configs":   len(top10_ids),
    "config_ids":  top10_ids,
    "n_seeds":     N_SEEDS,
    "steps":       STEPS,
    "baseline": {
        "tip_mean":     base_tip_mean,
        "coh_r_mean":   base_coh_mean,
        "genuine_rate": base_gen_mean,
        "per_config":   [
            {"config_id": cid,
             "tip_med":   baseline[cid][0],
             "coh_r_med": baseline[cid][1],
             "genuine":   baseline[cid][2]}
            for cid in top10_ids
        ],
    },
    "perturbations": {
        "weight_noise":  {"levels": [0.05, 0.10, 0.20], "results": p1_results, "verdict": verdicts["weight_noise"]},
        "vuln_noise":    {"levels": [0.05, 0.10, 0.20], "results": p2_results, "verdict": verdicts["vuln_noise"]},
        "edge_dropout":  {"levels": [0.02, 0.05, 0.10], "results": p3_results, "verdict": verdicts["edge_dropout"]},
        "hetero_amp":    {"levels": [0.20],              "results": p4_results, "verdict": verdicts["hetero_amp"]},
    },
    "runtime_s": round(runtime, 1),
}
result = _to_py(result)

with open("results/phase13_noise.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2)
print("Saved -> results/phase13_noise.json")

# ── Report ────────────────────────────────────────────────────────────────────

def build_report(res):
    b  = res["baseline"]
    ps = res["perturbations"]

    def prow(label, levels, results, key):
        """One row per level for a given metric key."""
        rows = []
        for r in results:
            lvl   = r["level"]
            val   = r[f"{key}_mean"] if f"{key}_mean" in r else r.get(key)
            rel   = r[f"rel_change_{key}"] if f"rel_change_{key}" in r else None
            verd  = r[f"verdict_{key}"]    if f"verdict_{key}"    in r else None
            if rel is not None:
                rows.append(
                    f"    {label} sigma/frac={lvl:<6}  "
                    f"mean={val:.3f}  delta={rel:+.1%}  [{verd}]"
                )
            else:
                rows.append(f"    {label} level={lvl:<6}  mean={val:.3f}")
        return "\n".join(rows)

    def section(pert_name, label, q, levels, results):
        lines = [
            f"## Perturbation {label}: {pert_name}",
            f"  Question: {q}",
            "",
            f"  Baseline: tip={b['tip_mean']:.1f}  "
            f"coh_r={b['coh_r_mean']:.3f}  "
            f"genuine_rate={b['genuine_rate']:.2f}",
            "",
            "  tipping_step:",
        ]
        for r in results:
            lines.append(
                f"    level={r['level']:<6}  "
                f"mean={r['tip_mean']:.1f}  "
                f"rel={r['rel_change_tip']:+.1%}  "
                f"[{r['verdict_tip']}]"
            )
        lines += ["", "  coherence_r:"]
        for r in results:
            lines.append(
                f"    level={r['level']:<6}  "
                f"mean={r['coh_r_mean']:.3f}  "
                f"rel={r['rel_change_coh']:+.1%}  "
                f"[{r['verdict_coh']}]"
            )
        lines += ["", "  genuine_rate:"]
        for r in results:
            lines.append(
                f"    level={r['level']:<6}  "
                f"mean={r['genuine_mean']:.2f}  "
                f"rel={r['rel_change_gen']:+.1%}  "
                f"[{r['verdict_gen']}]"
            )
        # extra for hetero_amp
        for r in results:
            if "subtype_spearman_r" in r:
                lines += [
                    "",
                    "  Subtype separation (tipping-step rank preserved?):",
                    f"    Spearman r(baseline tip, perturbed tip) = "
                    f"{r['subtype_spearman_r']:.3f}",
                    f"    CV(tipping step) baseline = {r['tip_cv_baseline']:.3f}  "
                    f"perturbed = {r['tip_cv_perturbed']:.3f}",
                    f"    Subtypes still separate: "
                    f"{'YES (r>0.6)' if r['subtypes_separate'] else 'NO (r<=0.6)'}",
                ]
        worst = ps[pert_name.lower().replace(" ", "_").replace("-","_").replace("/","_")]["verdict"]
        lines += [
            "",
            f"  Overall verdict: {worst.upper()}",
            "",
        ]
        return "\n".join(lines)

    # Map pert_name key to dict key
    pnames = {
        "weight_noise": ("Synaptic weight noise",
                         "1",
                         "Does tipping step drift >20 steps?"),
        "vuln_noise":   ("Vulnerability score noise",
                         "2",
                         "Does spatial coherence r drop below 0.3?"),
        "edge_dropout": ("Connectome edge dropout",
                         "3",
                         "Does genuine_tipping_rate change?"),
        "hetero_amp":   ("Heterogeneous aggAmp per neuron",
                         "4",
                         "Do two disease subtypes still separate?"),
    }

    lines = [
        "# Phase 13 -- Biological Noise Robustness",
        "",
        "## Setup",
        f"  Top-10 genuine critical configs (Phase 7B)",
        f"  Config IDs: {', '.join(str(c) for c in res['config_ids'])}",
        f"  Seeds per level: {res['n_seeds']}  |  Steps: {res['steps']}",
        "",
        "## Baseline (no perturbation)",
        f"  Mean tipping step:  {b['tip_mean']:.1f}",
        f"  Mean coherence r:   {b['coh_r_mean']:.3f}",
        f"  Genuine rate:       {b['genuine_rate']:.2f}",
        "",
        "  Per-config breakdown:",
    ]
    for pc in b["per_config"]:
        lines.append(
            f"    id={pc['config_id']:4d}  tip={pc['tip_med']:5.1f}  "
            f"coh_r={pc['coh_r_med']:.3f}  "
            f"genuine={'Y' if pc['genuine'] else 'N'}"
        )
    lines.append("")

    for pkey, (pname, label, q) in pnames.items():
        p_data = ps[pkey]
        lines.append(section(pkey, label, q, p_data["levels"], p_data["results"]))

    # Summary table
    lines += [
        "## Summary Table",
        "",
        "  Perturbation             | Metric      | Max level | Rel change | Verdict",
        "  -------------------------|-------------|-----------|------------|--------",
    ]
    for pkey in ["weight_noise", "vuln_noise", "edge_dropout", "hetero_amp"]:
        p_data    = ps[pkey]
        worst_r   = p_data["results"][-1]  # highest level
        max_chg   = max(worst_r["rel_change_tip"], worst_r["rel_change_coh"], worst_r["rel_change_gen"])
        worst_m   = "tip" if worst_r["rel_change_tip"] == max_chg else (
                    "coh" if worst_r["rel_change_coh"] == max_chg else "gen")
        lines.append(
            f"  {pkey:<25s}| {worst_m:<11} | {p_data['levels'][-1]:<9} | "
            f"{max_chg:+.1%}     | {p_data['verdict'].upper()}"
        )

    lines += [
        "",
        "## Interpretation",
        "",
        "  Change thresholds: robust <10%  |  moderate 10-30%  |  fragile >30%",
        "  Metrics: tipping_step drift, coherence_r drop, genuine_rate change",
        "",
        f"  Total runtime: {res['runtime_s']:.1f}s",
        "",
        "---",
        "_Generated by `phase13_noise.py` -- ALS connectome project Phase 13_",
    ]
    return "\n".join(lines)

report = build_report(result)
with open("results/phase13_noise_report.md", "w", encoding="utf-8") as f:
    f.write(report)
print("Saved -> results/phase13_noise_report.md")
print()
print("Done.")

"""R3.6 -- Seed Location Sensitivity.

Tests whether the initial aggregation seed location changes cascade dynamics.

Context: Medium aggregation (ISR=2.0, TSSE=2.0) with the R3.1 decoupled model.
Configs: Top 10 Phase 5 critical configs (genuine-tipping per Phase 7B) with
         aggregationAmplification replaced by ISR=2.0, TSSE=2.0.

NOTE: DVA (top node in Phase 1A) is NOT in the 61-neuron motor circuit model.
      Phase 1A used a separate graph. AVAL is used as the cascade-critical
      substitute: it has the highest betweenness centrality (0.33) and degree (23)
      in the actual motor circuit and is ranked #2 overall in Phase 1A analysis
      among nodes that exist in the simulator.

4 seed conditions:
  A. AVAL (cascade hub):  AVAL gets +0.5 aggregation boost at t=0
  B. DA6  (protective):   DA6  gets +0.5 aggregation boost at t=0
  C. All 61 neurons:      each neuron tested with +0.5 boost
                          (10 seeds x 10 configs per neuron = 100 runs each)
  D. Uniform baseline:    no boost; aggregation initialized to zero
                          (pure parameter-driven cascade, no focal seed)

Per condition metrics:
  genuine_tipping_rate, mean_first_death_step, mean_plateau_survivors,
  mean_coherence_r, most_common_first_dead_neuron

Condition C rankings:
  fragile:      genuine_rate >= 0.80
  transitional: 0.40 <= genuine_rate < 0.80
  resilient:    genuine_rate < 0.40

Total: ~6700 runs x 500 steps.

Outputs:
  results/r3_6_seed_location/phase18_results.json
  results/r3_6_seed_location/phase18_report.md
"""

import json
import time
import sys
import os
from collections import Counter
import numpy as np
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from connectome import NEURON_NAMES, VULNERABILITY, NODE_TYPES, SYNAPSES
from phase_r3_1_decoupled_aggregation import DecoupledSimulator, _pearson_r

# ── Constants ─────────────────────────────────────────────────────────────────

N          = len(NEURON_NAMES)         # 61
STEPS      = 500
SLOPE_THR  = 4
COH_THR    = 0.30
SILENT_MIN = 50

BOOST_AMOUNT = 0.5

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES])

# Substitute for DVA (not in motor circuit model): AVAL is the highest-
# betweenness command interneuron (Phase 1A #2 among in-model neurons)
AVAL_IDX = NEURON_NAMES.index("AVAL")   # 10
DA6_IDX  = NEURON_NAMES.index("DA6")    # 29

# N seeds per condition (conditions A, B, D use N_SEEDS_NAMED;
# condition C uses N_SEEDS_ALL per neuron)
N_SEEDS_NAMED = 20   # conditions A, B, D
N_SEEDS_ALL   = 10   # condition C -- all 61 neurons

N_CONFIGS = 10


# ── Load top-10 Phase 5 critical configs + medium context ────────────────────

def _load_configs():
    """Top 10 Phase 5 configs with ISR=TSSE=2.0 overriding aggregationAmplification."""
    p = Path(__file__).parent.parent / "results" / "critical_configs.json"
    with open(p, encoding="utf-8") as f:
        raw = json.load(f)
    configs = []
    for entry in raw["configs"][:N_CONFIGS]:
        params = dict(entry["params"])
        params["intracellularSeedingRate"]     = 2.0
        params["transSynapticSpreadEfficiency"] = 2.0
        configs.append({"id": entry["id"], "rank": entry["rank"], "params": params})
    return configs


# ── Simulation helpers ────────────────────────────────────────────────────────

def _run_one(params, seed, boost_idx=None, zero_init=False):
    """Run STEPS steps; return (hist_alive, death_step_arr[N])."""
    sim = DecoupledSimulator(seed=seed, noise_scale=0.003, params=params)

    if zero_init:
        sim.aggregation[:] = 0.0
    elif boost_idx is not None:
        sim.aggregation[boost_idx] = min(
            1.0, sim.aggregation[boost_idx] + BOOST_AMOUNT
        )

    n          = sim.n
    death_step = np.full(n, STEPS + 1, dtype=float)
    prev_alive = np.ones(n, dtype=bool)
    hist       = []

    for t in range(STEPS):
        sim.step()
        curr_alive = sim.health > sim.DEAD_THRESHOLD
        newly_dead = prev_alive & ~curr_alive & (death_step == STEPS + 1)
        death_step[newly_dead] = float(t + 1)
        prev_alive = curr_alive
        hist.append(int(curr_alive.sum()))

    return hist, death_step


def _row_stats(hist, death_step):
    rates     = [hist[t] - hist[t + 10] for t in range(len(hist) - 10)]
    peak_rate = max(rates) if rates else 0
    died_mask = death_step < STEPS + 1
    first_d   = int(death_step[died_mask].min()) if died_mask.any() else STEPS + 1
    coh_r     = (_pearson_r(VULN[died_mask], -death_step[died_mask])
                 if died_mask.sum() >= 4 else 0.0)
    return {
        "peak_rate":   float(peak_rate),
        "first_death": first_d,
        "coh_r":       float(coh_r),
        "plateau":     hist[-1],
    }


def _is_genuine(rows):
    peaks  = [r["peak_rate"]   for r in rows]
    firsts = [r["first_death"] for r in rows]
    cohs   = [r["coh_r"]       for r in rows]
    c1 = float(np.median(peaks))  > SLOPE_THR
    c2 = float(np.median(cohs))   > COH_THR
    c3 = float(np.median(firsts)) > SILENT_MIN
    return bool(c1 and c2 and c3)


# ── Condition runner ──────────────────────────────────────────────────────────

def _run_condition(label, configs, n_seeds, seed_offset,
                   boost_idx=None, zero_init=False):
    """
    Run all configs x n_seeds for one (label, boost_idx) pair.
    Returns summary dict + per_config list.
    """
    per_cfg   = []
    all_first_dead = []

    for ci, cfg in enumerate(configs):
        rows       = []
        first_dead = []

        for s in range(n_seeds):
            seed = seed_offset + ci * 10000 + s
            hist, ds = _run_one(cfg["params"], seed, boost_idx, zero_init)
            rows.append(_row_stats(hist, ds))
            died = ds < STEPS + 1
            if died.any():
                t_min = ds[died].min()
                for idx in np.where(ds == t_min)[0]:
                    first_dead.append(int(idx))
                all_first_dead.extend(np.where(ds == t_min)[0].tolist())

        genuine = _is_genuine(rows)
        most_fd = (NEURON_NAMES[Counter(first_dead).most_common(1)[0][0]]
                   if first_dead else None)
        per_cfg.append({
            "cfg_id":           cfg["id"],
            "is_genuine":       int(genuine),
            "median_first_death": round(float(np.median([r["first_death"] for r in rows])), 1),
            "median_plateau":   round(float(np.median([r["plateau"]      for r in rows])), 1),
            "median_coh_r":     round(float(np.median([r["coh_r"]        for r in rows])), 3),
            "most_common_first_dead": most_fd,
        })

    genuine_rate   = round(float(np.mean([r["is_genuine"] for r in per_cfg])),    3)
    mean_first     = round(float(np.mean([r["median_first_death"] for r in per_cfg])), 1)
    mean_plateau   = round(float(np.mean([r["median_plateau"] for r in per_cfg])), 1)
    mean_coh       = round(float(np.mean([r["median_coh_r"]    for r in per_cfg])), 3)
    overall_fd     = (NEURON_NAMES[Counter(all_first_dead).most_common(1)[0][0]]
                      if all_first_dead else None)

    return {
        "condition":              label,
        "boost_neuron":           (NEURON_NAMES[boost_idx] if boost_idx is not None else None),
        "zero_init":              zero_init,
        "genuine_tipping_rate":   genuine_rate,
        "mean_first_death_step":  mean_first,
        "mean_plateau_survivors": mean_plateau,
        "mean_coherence_r":       mean_coh,
        "most_common_first_dead": overall_fd,
        "per_config":             per_cfg,
    }


# ── All-61-neuron sweep ───────────────────────────────────────────────────────

def _run_all_neurons(configs, seed_offset, t0):
    """
    Boost each of the 61 neurons in turn and measure genuine_tipping_rate.
    Returns list of 61 dicts sorted by genuine_tipping_rate (desc).
    """
    results = []
    for nidx, nname in enumerate(NEURON_NAMES):
        per_cfg_genuine  = []
        per_cfg_first    = []
        per_cfg_coh      = []
        per_cfg_plateau  = []
        first_dead_all   = []

        for ci, cfg in enumerate(configs):
            rows      = []
            first_local = []
            for s in range(N_SEEDS_ALL):
                seed = seed_offset + nidx * 100000 + ci * 1000 + s
                hist, ds = _run_one(cfg["params"], seed, boost_idx=nidx)
                rows.append(_row_stats(hist, ds))
                died = ds < STEPS + 1
                if died.any():
                    t_min = ds[died].min()
                    first_local.extend(np.where(ds == t_min)[0].tolist())

            genuine = _is_genuine(rows)
            per_cfg_genuine.append(int(genuine))
            per_cfg_first.append(float(np.median([r["first_death"] for r in rows])))
            per_cfg_coh.append(  float(np.median([r["coh_r"]       for r in rows])))
            per_cfg_plateau.append(float(np.median([r["plateau"]   for r in rows])))
            first_dead_all.extend(first_local)

        gen_rate = round(float(np.mean(per_cfg_genuine)), 3)
        results.append({
            "neuron_idx":             nidx,
            "neuron_name":            nname,
            "neuron_type":            NODE_TYPES[nname],
            "vulnerability":          float(VULNERABILITY[nname]),
            "genuine_tipping_rate":   gen_rate,
            "mean_first_death_step":  round(float(np.mean(per_cfg_first)),   1),
            "mean_plateau_survivors": round(float(np.mean(per_cfg_plateau)), 1),
            "mean_coherence_r":       round(float(np.mean(per_cfg_coh)),     3),
            "most_common_first_dead": (NEURON_NAMES[Counter(first_dead_all).most_common(1)[0][0]]
                                       if first_dead_all else None),
        })

        elapsed = time.time() - t0
        if (nidx + 1) % 5 == 0 or nidx == 0:
            print(
                f"    [{nidx+1:2d}/61] {nname:<6}  vuln={VULNERABILITY[nname]:.2f} "
                f" genuine={gen_rate:.2f}  ({elapsed:.0f}s)"
            )

    # Primary: highest genuine_rate; secondary: earliest onset (most dangerous timing)
    results.sort(key=lambda x: (-x["genuine_tipping_rate"], x["mean_first_death_step"]))
    return results


# ── Fragility classification ──────────────────────────────────────────────────

def _classify(genuine_rate):
    if genuine_rate >= 0.80:
        return "fragile"
    if genuine_rate >= 0.40:
        return "transitional"
    return "resilient"


# ── Main ──────────────────────────────────────────────────────────────────────

def run_phase18():
    t0      = time.time()
    out_dir = Path(__file__).parent.parent / "results" / "r3_6_seed_location"
    out_dir.mkdir(parents=True, exist_ok=True)

    configs = _load_configs()
    n_named_runs = 3 * N_CONFIGS * N_SEEDS_NAMED       # conditions A, B, D
    n_all_runs   = N * N_CONFIGS * N_SEEDS_ALL          # condition C
    total_runs   = n_named_runs + n_all_runs

    print("R3.6: Seed Location Sensitivity")
    print(f"  Configs: top-{N_CONFIGS} Phase-5 critical + ISR=2.0 TSSE=2.0")
    print(f"  Named conditions (A/B/D): {N_SEEDS_NAMED} seeds x {N_CONFIGS} configs each")
    print(f"  All-neuron sweep (C):    {N_SEEDS_ALL} seeds x {N_CONFIGS} configs x 61 neurons")
    print(f"  Total runs: {total_runs}  (est. ~{total_runs*0.08/60:.0f} min)")
    print()

    # ── Condition A: AVAL boost (DVA substitute) ──────────────────────────────
    print(f"Condition A: AVAL boost (DVA substitute, idx={AVAL_IDX}) ...")
    cond_aval = _run_condition(
        "A_cascade_hub_AVAL", configs, N_SEEDS_NAMED,
        seed_offset=180000, boost_idx=AVAL_IDX
    )
    print(
        f"  -> genuine={cond_aval['genuine_tipping_rate']:.3f}  "
        f"first_death={cond_aval['mean_first_death_step']:.0f}  "
        f"plateau={cond_aval['mean_plateau_survivors']:.1f}  "
        f"first_dead={cond_aval['most_common_first_dead']}  "
        f"({time.time()-t0:.0f}s)"
    )

    # ── Condition B: DA6 boost ────────────────────────────────────────────────
    print(f"Condition B: DA6 boost (protective, idx={DA6_IDX}) ...")
    cond_da6 = _run_condition(
        "B_protective_DA6", configs, N_SEEDS_NAMED,
        seed_offset=181000, boost_idx=DA6_IDX
    )
    print(
        f"  -> genuine={cond_da6['genuine_tipping_rate']:.3f}  "
        f"first_death={cond_da6['mean_first_death_step']:.0f}  "
        f"plateau={cond_da6['mean_plateau_survivors']:.1f}  "
        f"first_dead={cond_da6['most_common_first_dead']}  "
        f"({time.time()-t0:.0f}s)"
    )

    # ── Condition D: Uniform baseline (zero aggregation init) ────────────────
    print("Condition D: Uniform baseline (zero initial aggregation) ...")
    cond_uniform = _run_condition(
        "D_uniform_baseline", configs, N_SEEDS_NAMED,
        seed_offset=183000, boost_idx=None, zero_init=True
    )
    print(
        f"  -> genuine={cond_uniform['genuine_tipping_rate']:.3f}  "
        f"first_death={cond_uniform['mean_first_death_step']:.0f}  "
        f"plateau={cond_uniform['mean_plateau_survivors']:.1f}  "
        f"first_dead={cond_uniform['most_common_first_dead']}  "
        f"({time.time()-t0:.0f}s)"
    )

    # ── Condition C: all 61 neurons ───────────────────────────────────────────
    print("Condition C: All-61-neuron sweep ...")
    all_neuron_results = _run_all_neurons(configs, seed_offset=184000, t0=t0)
    print(f"  Done ({time.time()-t0:.0f}s)")
    print()

    # ── Classification and ranking ────────────────────────────────────────────
    for r in all_neuron_results:
        r["fragility_class"] = _classify(r["genuine_tipping_rate"])

    fragile     = [r for r in all_neuron_results if r["fragility_class"] == "fragile"]
    transitional = [r for r in all_neuron_results if r["fragility_class"] == "transitional"]
    resilient   = [r for r in all_neuron_results if r["fragility_class"] == "resilient"]

    aval_rank = next((i+1 for i, r in enumerate(all_neuron_results)
                      if r["neuron_name"] == "AVAL"), None)
    da6_rank  = next((i+1 for i, r in enumerate(all_neuron_results)
                      if r["neuron_name"] == "DA6"),  None)
    aval_rate = next((r["genuine_tipping_rate"] for r in all_neuron_results
                      if r["neuron_name"] == "AVAL"), None)
    da6_rate  = next((r["genuine_tipping_rate"] for r in all_neuron_results
                      if r["neuron_name"] == "DA6"),  None)

    # Spearman r between vulnerability and genuine_tipping_rate (all 61)
    vuln_arr    = np.array([r["vulnerability"]         for r in all_neuron_results])
    genuine_arr = np.array([r["genuine_tipping_rate"]  for r in all_neuron_results])
    # back to original order for Spearman
    orig_order = sorted(all_neuron_results, key=lambda x: x["neuron_idx"])
    v_orig = np.array([r["vulnerability"]        for r in orig_order])
    g_orig = np.array([r["genuine_tipping_rate"] for r in orig_order])
    rv = np.argsort(np.argsort(v_orig)).astype(float)
    rg = np.argsort(np.argsort(g_orig)).astype(float)
    spearman_vuln_genuine = round(float(_pearson_r(rv, rg)), 3)

    # Range across conditions A, B, D + median of C
    median_c_rate = round(float(np.median([r["genuine_tipping_rate"]
                                           for r in all_neuron_results])), 3)
    rates_named = {
        "AVAL":    cond_aval["genuine_tipping_rate"],
        "DA6":     cond_da6["genuine_tipping_rate"],
        "uniform": cond_uniform["genuine_tipping_rate"],
        "random_median": median_c_rate,
    }

    # Whether: range across named conditions + median C
    all_rates_for_range = list(rates_named.values())
    whether_range = round(max(all_rates_for_range) - min(all_rates_for_range), 3)

    # When: range of mean_first_death_step across named conditions
    when_vals = [
        cond_aval["mean_first_death_step"],
        cond_da6["mean_first_death_step"],
        cond_uniform["mean_first_death_step"],
    ]
    when_range = round(max(when_vals) - min(when_vals), 1)

    print(f"AVAL rank={aval_rank}/61  rate={aval_rate:.3f}")
    print(f"DA6  rank={da6_rank}/61  rate={da6_rate:.3f}")
    print(f"Fragile: {len(fragile)}  Transitional: {len(transitional)}  Resilient: {len(resilient)}")
    print(f"Whether-range={whether_range:.3f}  When-range={when_range:.1f} steps")
    print(f"Spearman r(vuln, genuine_rate) = {spearman_vuln_genuine:.3f}")
    print()

    # ── Save JSON ─────────────────────────────────────────────────────────────
    output = {
        "phase": "R3.6 -- Seed Location Sensitivity",
        "params": {
            "context":     "medium (ISR=2.0, TSSE=2.0)",
            "n_configs":   N_CONFIGS,
            "steps":       STEPS,
            "boost_amount": BOOST_AMOUNT,
            "n_seeds_named": N_SEEDS_NAMED,
            "n_seeds_all":   N_SEEDS_ALL,
            "note_dva":    (
                "DVA (Phase 1A #1) not in 61-neuron motor circuit model. "
                "AVAL used as cascade-critical substitute (Phase 1A #2, highest "
                "betweenness in actual model)."
            ),
        },
        "summary": {
            "genuine_rates": rates_named,
            "mean_first_death_steps": {
                "AVAL":    cond_aval["mean_first_death_step"],
                "DA6":     cond_da6["mean_first_death_step"],
                "uniform": cond_uniform["mean_first_death_step"],
            },
            "whether_range":        whether_range,
            "when_range_steps":     when_range,
            "aval_rank_in_c":       aval_rank,
            "da6_rank_in_c":        da6_rank,
            "aval_rate_in_c":       aval_rate,
            "da6_rate_in_c":        da6_rate,
            "n_fragile":            len(fragile),
            "n_transitional":       len(transitional),
            "n_resilient":          len(resilient),
            "spearman_vuln_genuine": spearman_vuln_genuine,
        },
        "conditions": {
            "A_cascade_hub": {k: v for k, v in cond_aval.items() if k != "per_config"},
            "B_protective":  {k: v for k, v in cond_da6.items()  if k != "per_config"},
            "D_uniform":     {k: v for k, v in cond_uniform.items() if k != "per_config"},
        },
        "all_neuron_sweep": all_neuron_results,
    }

    json_path = out_dir / "phase18_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Results saved: {json_path}")

    report = _build_report(output)
    rpt_path = out_dir / "phase18_report.md"
    with open(rpt_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"Report  saved: {rpt_path}")
    print(f"Total runtime: {time.time()-t0:.1f}s")
    return output


# ── Report builder ────────────────────────────────────────────────────────────

def _build_report(data):
    s    = data["summary"]
    cond = data["conditions"]
    anr  = data["all_neuron_sweep"]   # sorted by genuine_rate desc
    p    = data["params"]

    # ── Condition comparison table ────────────────────────────────────────────
    def _cond_row(label, cdata, rate_in_c=None):
        rank_note = f" (rank {rate_in_c[0]}/61)" if rate_in_c else ""
        return (
            f"| {label} "
            f"| {cdata['genuine_tipping_rate']:.3f}{rank_note} "
            f"| {cdata['mean_first_death_step']:.0f} "
            f"| {cdata['mean_plateau_survivors']:.1f} "
            f"| {cdata['mean_coherence_r']:.3f} "
            f"| {cdata['most_common_first_dead'] or '--'} |\n"
        )

    cond_hdr = (
        "| Condition | Genuine rate | First death step "
        "| Plateau | Coherence r | First dead neuron |\n"
        "|---|---|---|---|---|---|\n"
    )
    cond_rows = (
        _cond_row("A: AVAL boost (cascade hub)", cond["A_cascade_hub"],
                  (s["aval_rank_in_c"], s["aval_rate_in_c"]))
        + _cond_row("B: DA6 boost (protective)", cond["B_protective"],
                    (s["da6_rank_in_c"], s["da6_rate_in_c"]))
        + f"| C: Random (median across 61) "
          f"| {s['genuine_rates']['random_median']:.3f} "
          f"| -- | -- | -- | -- |\n"
        + _cond_row("D: Uniform baseline (no boost)", cond["D_uniform"])
    )

    # ── Top-20 fragile neurons table ──────────────────────────────────────────
    top20 = anr[:20]
    top20_hdr = "| Rank | Neuron | Type | Vulnerability | Genuine rate | Mean first death | Class |\n|---|---|---|---|---|---|---|\n"
    top20_rows = ""
    for rank, r in enumerate(top20, 1):
        top20_rows += (
            f"| {rank} | {r['neuron_name']} "
            f"| {r['neuron_type']} "
            f"| {r['vulnerability']:.2f} "
            f"| {r['genuine_tipping_rate']:.3f} "
            f"| {r['mean_first_death_step']:.1f} "
            f"| {r['fragility_class']} |\n"
        )

    # ── Fragility class summary ───────────────────────────────────────────────
    fragile_names     = [r["neuron_name"] for r in anr if r["fragility_class"] == "fragile"]
    transitional_names = [r["neuron_name"] for r in anr if r["fragility_class"] == "transitional"]
    resilient_names   = [r["neuron_name"] for r in anr if r["fragility_class"] == "resilient"]

    frag_str  = ", ".join(fragile_names)     if fragile_names     else "(none)"
    trans_str = ", ".join(transitional_names) if transitional_names else "(none)"
    resi_str  = ", ".join(resilient_names)   if resilient_names   else "(none)"

    # ── Q1: Does seed location change WHETHER? ────────────────────────────────
    wr = s["whether_range"]
    gr = s["genuine_rates"]
    if wr < 0.10:
        q1 = (
            f"**MINIMAL EFFECT.** Genuine tipping rate range across conditions = {wr:.3f} "
            f"(AVAL={gr['AVAL']:.3f}, DA6={gr['DA6']:.3f}, uniform={gr['uniform']:.3f}, "
            f"random median={gr['random_median']:.3f}). "
            f"At medium aggregation (ISR=2.0, TSSE=2.0), the cascade dynamics dominate: "
            f"tipping occurs regardless of which neuron carries the initial seed. "
            f"The biophysical parameter regime is the primary determinant of WHETHER "
            f"tipping occurs, not the focal seed location."
        )
    elif wr < 0.30:
        q1 = (
            f"**MODERATE EFFECT.** Range = {wr:.3f}. Seed location modulates but does not "
            f"determine tipping. Some neuron positions are robustly fragile "
            f"(genuine rate ~{max(gr.values()):.2f}) while others are less so "
            f"(~{min(gr.values()):.2f})."
        )
    else:
        q1 = (
            f"**STRONG EFFECT.** Range = {wr:.3f}. Seed location substantially changes "
            f"whether tipping occurs. The choice of initial aggregation focus point "
            f"can push the cascade across or away from the tipping boundary."
        )

    # ── Q2: Does seed location change WHEN? ──────────────────────────────────
    wr2 = s["when_range_steps"]
    fd  = s["mean_first_death_steps"]
    if wr2 < 20:
        q2 = (
            f"**MINIMAL TIMING EFFECT.** First death step range = {wr2:.0f} steps "
            f"(AVAL={fd['AVAL']:.0f}, DA6={fd['DA6']:.0f}, uniform={fd['uniform']:.0f}). "
            f"Onset timing is not strongly influenced by seed location at medium aggregation."
        )
    elif wr2 < 60:
        q2 = (
            f"**MODERATE TIMING EFFECT.** First death step range = {wr2:.0f} steps. "
            f"AVAL boost: first death at step ~{fd['AVAL']:.0f}. "
            f"DA6 boost: step ~{fd['DA6']:.0f}. "
            f"Uniform (no boost): step ~{fd['uniform']:.0f}. "
            f"Seed location shifts onset by {wr2:.0f} steps -- roughly "
            f"{wr2/STEPS*100:.0f}% of the simulation window."
        )
    else:
        q2 = (
            f"**STRONG TIMING EFFECT.** First death step range = {wr2:.0f} steps "
            f"(AVAL={fd['AVAL']:.0f}, DA6={fd['DA6']:.0f}, uniform={fd['uniform']:.0f}). "
            f"Seed location has a major impact on disease onset timing."
        )

    # ── Q3: Is AVAL special? ─────────────────────────────────────────────────
    aval_rank = s["aval_rank_in_c"]
    aval_rate = s["aval_rate_in_c"]
    da6_rank  = s["da6_rank_in_c"]
    da6_rate  = s["da6_rate_in_c"]
    n_frag    = s["n_fragile"]

    if aval_rank == 1:
        q3_aval = (
            f"**YES -- AVAL is the single most dangerous seed location** (rank 1/61, "
            f"genuine_rate={aval_rate:.3f}). As the main command interneuron with "
            f"highest betweenness, seeding aggregation in AVAL maximally accelerates "
            f"motor neuron collapse via trans-synaptic spread. This validates Phase 1A's "
            f"finding that DVA-class command interneurons are the most cascade-critical."
        )
    elif aval_rank <= 5:
        q3_aval = (
            f"**AVAL is among the most dangerous seeds** (rank {aval_rank}/61, "
            f"genuine_rate={aval_rate:.3f}). It is more fragile than {61-aval_rank} other "
            f"neurons, but {aval_rank-1} neuron(s) are equally or more fragile. "
            f"AVAL is special but not uniquely so."
        )
    elif aval_rank <= 15:
        q3_aval = (
            f"**AVAL is above average but not uniquely fragile** (rank {aval_rank}/61, "
            f"genuine_rate={aval_rate:.3f}). It falls in the upper quartile of seed "
            f"fragility, suggesting command interneurons provide meaningful acceleration "
            f"but are not uniquely potent as seeding sites."
        )
    else:
        q3_aval = (
            f"**AVAL is NOT specially fragile as a seed location** (rank {aval_rank}/61, "
            f"genuine_rate={aval_rate:.3f}). Its low vulnerability (0.15) means a +0.5 "
            f"boost does not translate into early death, so it cannot drive the cascade "
            f"more than typical motor neurons."
        )

    q3_da6 = (
        f"**DA6 (protective from Phase 1B)** ranks {da6_rank}/61 "
        f"(genuine_rate={da6_rate:.3f}) as a seed location. "
    )
    if da6_rank > 30:
        q3_da6 += (
            f"Despite having vulnerability=1.00, seeding DA6 is relatively safe -- "
            f"consistent with Phase 1B finding that DA6 serves as an aggregate absorber "
            f"that protects the broader circuit."
        )
    else:
        q3_da6 += (
            f"Although Phase 1B identified DA6 as protective against spread, "
            f"it is not resilient as a seeding site -- its high vulnerability (1.00) "
            f"means it rapidly dies when boosted, and the DA chain cascades from there."
        )

    q3_n = (
        f"\n\nOf 61 neurons: **{n_frag} fragile** (genuine>=0.80), "
        f"**{s['n_transitional']} transitional**, **{s['n_resilient']} resilient**."
    )

    q3 = q3_aval + "\n\n" + q3_da6 + q3_n

    # ── Q4: Most dangerous seeds ──────────────────────────────────────────────
    spearman = s["spearman_vuln_genuine"]
    if abs(spearman) > 0.70:
        vuln_predict = (
            f"**Vulnerability is a strong predictor of seed fragility** "
            f"(Spearman r={spearman:.3f}): high-vulnerability motor neurons (DA, VA "
            f"classes) are the most dangerous seeds. Network position adds limited "
            f"information beyond the vulnerability gradient."
        )
    elif abs(spearman) > 0.40:
        vuln_predict = (
            f"**Vulnerability is a moderate predictor** (Spearman r={spearman:.3f}). "
            f"Network position matters beyond vulnerability: some low-vulnerability "
            f"hub interneurons (e.g., AVAL) are more fragile seeds than their "
            f"vulnerability alone would predict."
        )
    else:
        vuln_predict = (
            f"**Vulnerability is a WEAK predictor** (Spearman r={spearman:.3f}). "
            f"Network topology drives seed fragility more than intrinsic vulnerability. "
            f"Seeding a hub node produces more cascade than seeding a highly-vulnerable "
            f"but poorly-connected node."
        )

    q4 = (
        f"{vuln_predict}\n\n"
        f"**Top-10 most dangerous seed locations:**\n"
        + "".join(
            f"  {i+1}. {r['neuron_name']} ({r['neuron_type']}, vuln={r['vulnerability']:.2f}): "
            f"genuine_rate={r['genuine_tipping_rate']:.3f}, first_death={r['mean_first_death_step']:.1f}\n"
            for i, r in enumerate(anr[:10])
        )
        + f"\n**10 most resilient seed locations:**\n"
        + "".join(
            f"  {i+1}. {r['neuron_name']} ({r['neuron_type']}, vuln={r['vulnerability']:.2f}): "
            f"genuine_rate={r['genuine_tipping_rate']:.3f}, first_death={r['mean_first_death_step']:.1f}\n"
            for i, r in enumerate(reversed(anr[-10:]))
        )
    )

    # ── Q5: Validate or challenge Phase 1A? ──────────────────────────────────
    # Phase 1A found DVA (not in model) as #1, AVAL as #2 in cascade criticality
    p1a_consistent = aval_rank <= 10
    if p1a_consistent:
        q5 = (
            f"**VALIDATES Phase 1A.** AVAL (Phase 1A's #2 cascade-critical node) "
            f"ranks {aval_rank}/61 as a seed location in R3.6. Phase 1A's "
            f"network centrality analysis correctly identified command interneurons "
            f"as the most cascade-amplifying nodes. While Phase 1A's top-ranked DVA "
            f"is absent from the motor circuit model, AVAL's position in the R3.6 "
            f"fragility ranking supports the mechanistic claim: high-betweenness "
            f"interneurons spread seeded aggregation most efficiently to motor neurons.\n\n"
            f"However, R3.6 also shows that {n_frag} of 61 neurons qualify as "
            f"'fragile' seeds (genuine_rate >= 0.80). The cascade is not uniquely "
            f"fragile to a single seed location -- it is broadly susceptible across "
            f"most of the motor-neuron pool. Phase 1A's ranking is validated directionally "
            f"but the 'DVA is uniquely critical' claim should be qualified: "
            f"at medium aggregation, many neurons can serve as effective seeds."
        )
    else:
        q5 = (
            f"**CHALLENGES Phase 1A.** AVAL (Phase 1A's #2 cascade-critical node) "
            f"ranks {aval_rank}/61 in R3.6 -- outside the top decile. "
            f"Phase 1A's network centrality ranking does not strongly predict seed "
            f"fragility in the decoupled biophysics model. High-vulnerability motor "
            f"neurons (DA, VA classes) dominate the fragility ranking, suggesting that "
            f"intrinsic vulnerability rather than network centrality drives cascade "
            f"susceptibility. Phase 1A's finding may reflect the properties of its "
            f"simplified cascade graph rather than the full biophysics model."
        )

    # ── Assemble ──────────────────────────────────────────────────────────────
    total_runs = (3 * N_CONFIGS * N_SEEDS_NAMED) + (N * N_CONFIGS * N_SEEDS_ALL)
    report = f"""# R3.6 -- Seed Location Sensitivity

## Overview

Tests whether the location of the initial aggregation seed changes cascade dynamics.

**Context**: Medium aggregation (ISR=2.0, TSSE=2.0), C. elegans topology.
**Configs**: Top {p['n_configs']} Phase 5 critical configs (Phase 7B genuine-tipping)
**Boost**: +{p['boost_amount']} aggregation to the target neuron at t=0
**Total runs**: {total_runs} x {p['steps']} steps

**DVA note**: DVA (Phase 1A #1 cascade-critical) is not in the 61-neuron motor circuit
model. AVAL is used as the cascade-critical substitute (highest betweenness=0.33
in the actual model, Phase 1A #2 overall).

---

## Condition Comparison

{cond_hdr}{cond_rows}
---

## Top-20 Fragile Seed Locations (Condition C sweep)

{top20_hdr}{top20_rows}
---

## Fragility Classification

| Class | Count | Threshold | Neurons |
|---|---|---|---|
| Fragile | {s['n_fragile']} | genuine >= 0.80 | {frag_str[:120]}{'...' if len(frag_str)>120 else ''} |
| Transitional | {s['n_transitional']} | 0.40 <= genuine < 0.80 | {trans_str[:120]}{'...' if len(trans_str)>120 else ''} |
| Resilient | {s['n_resilient']} | genuine < 0.40 | {resi_str[:120]}{'...' if len(resi_str)>120 else ''} |

**Spearman r(vulnerability, genuine_rate) = {s['spearman_vuln_genuine']:.3f}**

---

## Q1: Does seed location change WHETHER tipping occurs?

{q1}

---

## Q2: Does seed location change WHEN tipping occurs?

{q2}

---

## Q3: Is AVAL (DVA substitute) special -- or one of many fragile seeds?

{q3}

---

## Q4: Which neurons are most dangerous as initial seeds?

{q4}

---

## Q5: Does this validate or challenge Phase 1A findings?

{q5}

---

## Methodology

**Boost**: `sim.aggregation[idx] = min(1.0, sim.aggregation[idx] + {p['boost_amount']})` at t=0,
after standard vulnerability-scaled initialization (motor: base=0.015, other: base=0.002).

**Uniform baseline (condition D)**: `sim.aggregation[:] = 0.0` -- removes all initial
focal seeding; the cascade is driven purely by the parameter dynamics.

**Strict Phase 7B criterion** (applied per config across seeds):
- C1: median peak 10-step death rate > {SLOPE_THR}
- C2: median spatial coherence r > {COH_THR}
- C3: median first death step > {SILENT_MIN}

---

*R3.6 -- ALS Connectome Degeneration Project*
"""
    return report


if __name__ == "__main__":
    run_phase18()

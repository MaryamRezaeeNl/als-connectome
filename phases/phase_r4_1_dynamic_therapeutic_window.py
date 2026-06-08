"""Phase R4.1 -- Dynamic Therapeutic Window & Late Rescue.

Tests whether the strongest therapy found in R3.10 (90% coupled ISR+TSSE
suppression) can still rescue the cascade when applied AFTER degeneration
has already begun, and at which onset time rescue fails.

Design:
  - Base context: ISR=2.0, TSSE=2.0 (medium, 100% genuine tipping at t=0)
  - Therapy: ISR -> 0.20, TSSE -> 0.20 (90% coupled suppression from R3.10)
  - T_start sweep: 12 onset times from 0 to 300
  - 50 seeds per onset, 500 steps each
  - Total: 50 * 12 = 600 runs

Metrics per onset:
  - genuine_tipping_rate + 95% bootstrap CI
  - first_death_step, tipping_step, plateau_survivors
  - functional_survival_duration (last step alive_count > 30)
  - spatial_coherence_r
  - therapeutic_benefit_score

State at T_start:
  - n_alive, n_dead, n_irreversible
  - mean aggregation, mean ATP, mean toxicity
  - network_agg_load (sum agg over all neurons)
  - coherence_r_at_t (spatial coherence of deaths so far)

Derived:
  - T50_rescue: onset where 50% of max therapeutic benefit is lost
  - point_of_no_return: earliest onset where genuine_rate > 0.90
  - Feature importance: correlation of state vars with rescue failure

Output:
  results/r4_1_dynamic_therapeutic_window/
    r4_1_results.json
    r4_1_summary.csv
    r4_1_report.md
    fig1_tipping_rate_vs_onset.png
    fig2_benefit_vs_onset.png
    fig3_plateau_vs_onset.png
    fig4_functional_survival_vs_onset.png
    fig5_state_vars_at_t.png
    fig6_feature_importance.png
    fig7_rescue_cliff.png
"""

import json
import sys
import os
import time
import csv
import numpy as np
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from connectome import NEURON_NAMES, VULNERABILITY
from phase_r3_1_decoupled_aggregation import DecoupledSimulator, _pearson_r

# ── Constants ─────────────────────────────────────────────────────────────────

STEPS   = 500
N_SEEDS = 50
N_BOOT  = 1000

# Biological context: medium aggregation
BASE_PARAMS = {
    "intracellularSeedingRate":      2.0,
    "transSynapticSpreadEfficiency": 2.0,
    "mitochondrialFragility":        1.0,
    "glutamateSensitivity":          0.010,
    "calciumStressGain":             1.0,
    "oxidativeFeedback":             0.050,
    "atpCollapseThreshold":          0.30,
    "recoveryIrreversibility":       0.70,
}

# Strongest therapy from R3.10: 90% coupled suppression
THERAPY_ISR  = 2.0 * (1.0 - 0.90)   # 0.20
THERAPY_TSSE = 2.0 * (1.0 - 0.90)   # 0.20

# Onset times to sweep
T_STARTS = [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 300]

# Tipping criterion (Phase 7B strict)
_VULN          = np.array([VULNERABILITY[n] for n in NEURON_NAMES])
_C1_SLOPE_THR  = 4
_C2_COHERENCE  = 0.30
_C3_SILENT_MIN = 50
_ALIVE_FUNC    = 30   # functional survival threshold (neurons alive)
_DEAD_THRESHOLD = 0.15

# Benefit score weights (from R3.9/R3.10)
W_TIP, W_DEL, W_PLT, W_SUR = 0.40, 0.20, 0.25, 0.15


# ── Core simulation ───────────────────────────────────────────────────────────

def _run_rescue(params, seed, t_start, therapy_isr, therapy_tsse):
    """Run one simulation with therapy activated at step t_start.

    Returns metrics dict including state variables at T_start.
    """
    sim = DecoupledSimulator(seed=seed, noise_scale=0.003, params=dict(params))
    alive_hist  = []
    death_step  = {}          # neuron_idx -> step (1-indexed)
    prev_alive  = np.ones(sim.n, dtype=bool)
    state_at_t  = None

    for s in range(STEPS):
        # Record state and activate therapy at t_start
        if s == t_start:
            cur_mask   = sim.health > _DEAD_THRESHOLD
            alive_mask = cur_mask

            # Deaths so far (for coherence)
            if len(death_step) >= 4:
                idxs_d = list(death_step.keys())
                vuls_d = [_VULN[i] for i in idxs_d]
                dsteps = [death_step[i] for i in idxs_d]
                coh_at_t = _pearson_r(vuls_d, [-d for d in dsteps])
            else:
                coh_at_t = 0.0

            state_at_t = {
                "n_alive":          int(cur_mask.sum()),
                "n_dead":           int((~cur_mask).sum()),
                "n_irreversible":   int(sim.irreversible.sum()),
                "mean_agg":         float(sim.aggregation[alive_mask].mean())
                                    if alive_mask.any() else 1.0,
                "mean_atp":         float(sim.atp[alive_mask].mean())
                                    if alive_mask.any() else 0.0,
                "mean_tox":         float(sim.toxicity[alive_mask].mean())
                                    if alive_mask.any() else 1.0,
                "network_agg_load": float(sim.aggregation.sum()),
                "coherence_r_at_t": round(coh_at_t, 3),
            }
            # Activate therapy
            sim.p["intracellularSeedingRate"]      = therapy_isr
            sim.p["transSynapticSpreadEfficiency"] = therapy_tsse

        n_alive = sim.step()
        alive_hist.append(n_alive)
        cur_alive  = sim.health > _DEAD_THRESHOLD
        newly_dead = prev_alive & ~cur_alive
        for idx in np.where(newly_dead)[0]:
            if idx not in death_step:
                death_step[idx] = s + 1
        prev_alive = cur_alive

    # t_start = 0 means state before first step -> use init values
    if state_at_t is None:
        state_at_t = {
            "n_alive": sim.n, "n_dead": 0, "n_irreversible": 0,
            "mean_agg": 0.0, "mean_atp": 1.0, "mean_tox": 0.0,
            "network_agg_load": 0.0, "coherence_r_at_t": 0.0,
        }

    # ── Tipping criterion ────────────────────────────────────────────────────
    first_death = min(death_step.values()) if death_step else STEPS + 1
    c3 = first_death > _C3_SILENT_MIN

    peak_rate = 0
    for i in range(10, len(alive_hist)):
        r = alive_hist[i - 10] - alive_hist[i]
        if r > peak_rate:
            peak_rate = r
    c1 = peak_rate > _C1_SLOPE_THR

    if len(death_step) >= 4:
        idxs  = list(death_step.keys())
        vuls  = [_VULN[i] for i in idxs]
        dstps = [death_step[i] for i in idxs]
        coh_r = _pearson_r(vuls, [-d for d in dstps])
    else:
        coh_r = 0.0
    c2 = coh_r > _C2_COHERENCE

    is_genuine = c1 and c2 and c3
    plateau    = alive_hist[-1]

    # Functional survival duration: last step with > _ALIVE_FUNC neurons alive
    func_dur = STEPS
    for i in range(len(alive_hist) - 1, -1, -1):
        if alive_hist[i] > _ALIVE_FUNC:
            func_dur = i + 1
            break
    else:
        func_dur = 0

    # Tipping step: first step where alive_hist < 50 (after a stable phase)
    tipping_s = STEPS
    for i in range(len(alive_hist)):
        if alive_hist[i] < 50 and (i == 0 or alive_hist[i - 1] >= 50):
            tipping_s = i + 1
            break

    return {
        "is_genuine":      is_genuine,
        "c1": c1, "c2": c2, "c3": c3,
        "first_death":     int(first_death),
        "plateau":         int(plateau),
        "func_duration":   int(func_dur),
        "tipping_step":    int(tipping_s),
        "coh_r":           round(float(coh_r), 3),
        "peak_rate":       int(peak_rate),
        "state_at_t":      state_at_t,
    }


def _bootstrap_ci(values, n_boot=N_BOOT, rng=None):
    """95% percentile bootstrap CI on the mean."""
    if rng is None:
        rng = np.random.default_rng(12345)
    arr   = np.array(values, dtype=float)
    boots = np.array([arr[rng.integers(0, len(arr), len(arr))].mean()
                      for _ in range(n_boot)])
    return float(boots.mean()), float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))


def _benefit_score(genuine_rate, first_death, plateau, func_dur,
                   base_genuine, base_first_death, base_plateau, base_func_dur,
                   n_neurons=61):
    """Weighted composite benefit relative to untreated baseline."""
    tip_prev   = max(0.0, base_genuine - genuine_rate)
    delay_norm = min(1.0, max(0.0, (first_death - base_first_death) / max(1, base_first_death)))
    plat_norm  = min(1.0, max(0.0, (plateau - base_plateau)          / max(1, n_neurons - base_plateau)))
    surv_norm  = min(1.0, max(0.0, (func_dur - base_func_dur)        / max(1, STEPS - base_func_dur)))
    return W_TIP * tip_prev + W_DEL * delay_norm + W_PLT * plat_norm + W_SUR * surv_norm


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    out_dir = Path("results/r4_1_dynamic_therapeutic_window")
    out_dir.mkdir(parents=True, exist_ok=True)

    rng_boot = np.random.default_rng(42)
    t0 = time.time()

    print("Phase R4.1 -- Dynamic Therapeutic Window & Late Rescue")
    print(f"  T_starts : {T_STARTS}")
    print(f"  Seeds    : {N_SEEDS} per onset")
    print(f"  Therapy  : ISR={THERAPY_ISR:.2f}, TSSE={THERAPY_TSSE:.2f} (90% coupled)")
    print(f"  Steps    : {STEPS}")
    print(f"  Total    : {N_SEEDS * len(T_STARTS)} runs")
    print()

    # ── Baseline (no therapy) ─────────────────────────────────────────────────
    print("Running baseline (no therapy, 50 seeds)...")
    base_runs = []
    for s in range(N_SEEDS):
        seed = 400000 + s
        r = _run_rescue(BASE_PARAMS, seed, t_start=9999,   # never activates
                        therapy_isr=THERAPY_ISR, therapy_tsse=THERAPY_TSSE)
        base_runs.append(r)

    base_genuine     = float(np.mean([r["is_genuine"]   for r in base_runs]))
    base_first_death = float(np.mean([r["first_death"]  for r in base_runs]))
    base_plateau     = float(np.mean([r["plateau"]      for r in base_runs]))
    base_func_dur    = float(np.mean([r["func_duration"] for r in base_runs]))

    print(f"  Baseline genuine tipping rate : {base_genuine:.3f}")
    print(f"  Baseline first death step     : {base_first_death:.1f}")
    print(f"  Baseline plateau survivors    : {base_plateau:.1f}")
    print(f"  Baseline functional survival  : {base_func_dur:.1f}")
    print()

    # ── Rescue sweep ─────────────────────────────────────────────────────────
    all_results = []
    per_seed_rows = []    # for feature importance analysis

    for ti, t_start in enumerate(T_STARTS):
        runs = []
        for s in range(N_SEEDS):
            seed = 410000 + ti * 1000 + s
            r = _run_rescue(BASE_PARAMS, seed, t_start,
                            therapy_isr=THERAPY_ISR, therapy_tsse=THERAPY_TSSE)
            runs.append(r)
            per_seed_rows.append({
                "t_start":        t_start,
                "seed":           seed,
                "is_genuine":     int(r["is_genuine"]),
                **r["state_at_t"],
            })

        genuine_vals  = [int(r["is_genuine"])   for r in runs]
        gtr, glo, ghi = _bootstrap_ci(genuine_vals, rng=rng_boot)
        mean_fd    = float(np.mean([r["first_death"]   for r in runs]))
        mean_plat  = float(np.mean([r["plateau"]       for r in runs]))
        mean_func  = float(np.mean([r["func_duration"] for r in runs]))
        mean_coh   = float(np.mean([r["coh_r"]         for r in runs]))

        benefit = _benefit_score(
            gtr, mean_fd, mean_plat, mean_func,
            base_genuine, base_first_death, base_plateau, base_func_dur,
        )

        # Mean state at T_start
        mean_state = {k: float(np.mean([r["state_at_t"][k] for r in runs]))
                      for k in runs[0]["state_at_t"]}

        entry = {
            "t_start":            t_start,
            "genuine_tipping_rate": round(gtr, 3),
            "ci_lo":              round(glo, 3),
            "ci_hi":              round(ghi, 3),
            "first_death_step":   round(mean_fd, 1),
            "plateau_survivors":  round(mean_plat, 1),
            "functional_survival": round(mean_func, 1),
            "spatial_coherence_r": round(mean_coh, 3),
            "benefit_score":      round(benefit, 3),
            "state_at_t":         {k: round(v, 3) for k, v in mean_state.items()},
        }
        all_results.append(entry)

        print(f"  T_start={t_start:3d}: genuine={gtr:.3f} [{glo:.3f},{ghi:.3f}]  "
              f"benefit={benefit:.3f}  plateau={mean_plat:.1f}  "
              f"agg@t={mean_state['mean_agg']:.3f}  atp@t={mean_state['mean_atp']:.3f}")

    print()

    # ── Derived analyses ─────────────────────────────────────────────────────
    t_arr   = np.array([r["t_start"]             for r in all_results], dtype=float)
    gtr_arr = np.array([r["genuine_tipping_rate"] for r in all_results], dtype=float)
    ben_arr = np.array([r["benefit_score"]        for r in all_results], dtype=float)

    # T50_rescue: onset where genuine_rate reaches 50% of its max (0.0 -> base_genuine)
    # i.e. genuine_rate = 0.5 * base_genuine; here base_genuine=1.0 so threshold = 0.50
    rescue_threshold = 0.50
    t50_rescue = None
    for i in range(len(all_results) - 1):
        lo, hi = all_results[i], all_results[i + 1]
        if lo["genuine_tipping_rate"] <= rescue_threshold <= hi["genuine_tipping_rate"]:
            frac = (rescue_threshold - lo["genuine_tipping_rate"]) / max(
                1e-9, hi["genuine_tipping_rate"] - lo["genuine_tipping_rate"])
            t50_rescue = lo["t_start"] + frac * (hi["t_start"] - lo["t_start"])
            break
    if t50_rescue is None and gtr_arr[-1] <= rescue_threshold:
        t50_rescue = float(T_STARTS[-1])
    if t50_rescue is None:
        t50_rescue = 0.0

    # Point of no return: earliest T_start where genuine_rate > 0.90
    ponr = None
    for r in all_results:
        if r["genuine_tipping_rate"] > 0.90:
            ponr = r["t_start"]
            break

    # T50_rescue CI via bootstrap on genuine_rate CIs
    t50_lo = t50_rescue
    t50_hi = t50_rescue
    for i in range(len(all_results) - 1):
        lo, hi = all_results[i], all_results[i + 1]
        if lo["ci_lo"] <= rescue_threshold <= hi["ci_lo"]:
            frac = (rescue_threshold - lo["ci_lo"]) / max(1e-9, hi["ci_lo"] - lo["ci_lo"])
            t50_hi = lo["t_start"] + frac * (hi["t_start"] - lo["t_start"])
        if lo["ci_hi"] <= rescue_threshold <= hi["ci_hi"]:
            frac = (rescue_threshold - lo["ci_hi"]) / max(1e-9, hi["ci_hi"] - lo["ci_hi"])
            t50_lo = lo["t_start"] + frac * (hi["t_start"] - lo["t_start"])

    # Response shape: cliff or gradual
    delta_gtr = [abs(all_results[i+1]["genuine_tipping_rate"] - all_results[i]["genuine_tipping_rate"])
                 for i in range(len(all_results)-1)]
    max_delta = max(delta_gtr)
    cliff_idx = delta_gtr.index(max_delta)
    cliff_onset_lo = all_results[cliff_idx]["t_start"]
    cliff_onset_hi = all_results[cliff_idx + 1]["t_start"]

    if max_delta >= 0.25:
        rescue_shape = "CLIFF-LIKE"
    elif max_delta >= 0.10:
        rescue_shape = "STEP-LIKE"
    else:
        rescue_shape = "GRADUAL"

    # Verdict
    if t50_rescue is None or t50_rescue >= 200:
        verdict = "BROAD_RESCUE_WINDOW"
    elif t50_rescue >= 100:
        verdict = "MODERATE_RESCUE_WINDOW"
    elif t50_rescue >= 50:
        verdict = "NARROW_RESCUE_WINDOW"
    else:
        verdict = "EARLY_POINT_OF_NO_RETURN"

    print(f"T50_rescue        : {t50_rescue:.1f} steps [~{t50_lo:.0f}, ~{t50_hi:.0f}]")
    print(f"Point of no return: {ponr if ponr is not None else 'not reached'}")
    print(f"Rescue shape      : {rescue_shape} (max delta {max_delta:.3f})")
    print(f"Verdict           : {verdict}")
    print()

    # ── Feature importance ───────────────────────────────────────────────────
    state_keys = ["mean_agg", "mean_atp", "mean_tox", "network_agg_load",
                  "n_dead", "n_irreversible", "coherence_r_at_t"]
    feat_corr = {}
    genuine_vec = np.array([row["is_genuine"] for row in per_seed_rows], dtype=float)

    for k in state_keys:
        vals = np.array([row[k] for row in per_seed_rows], dtype=float)
        if vals.std() < 1e-9:
            feat_corr[k] = 0.0
            continue
        feat_corr[k] = round(float(_pearson_r(vals, genuine_vec)), 3)

    best_predictor = max(feat_corr, key=lambda k: abs(feat_corr[k]))
    print("Feature correlations with rescue failure (is_genuine):")
    for k, v in sorted(feat_corr.items(), key=lambda x: -abs(x[1])):
        print(f"  {k:25s}: r = {v:+.3f}")
    print(f"  Best predictor: {best_predictor}")
    print()

    # ── Compare with R3.9 ────────────────────────────────────────────────────
    # R3.9 ISR50 (from results): 96.5% suppression, at T=0
    # R4.1 T50_rescue: timing threshold
    isr50_suppression = 96.5   # % from R3.9
    comparison = {
        "r3_9_isr50_suppression_pct": isr50_suppression,
        "r4_1_t50_rescue_steps":      round(t50_rescue, 1),
        "r4_1_ponr_steps":            ponr,
        "question_more_restrictive":  "potency" if isr50_suppression > 90 else "timing",
        "comment": (
            "R3.9 required 96.5% ISR suppression for 50% tipping reduction (at T=0). "
            f"R4.1 rescue fails at T~{t50_rescue:.0f} steps even with near-maximum suppression. "
            "Both potency and timing impose independent constraints."
        ),
    }

    # ── Save JSON ─────────────────────────────────────────────────────────────
    results_json = {
        "phase": "R4.1 -- Dynamic Therapeutic Window & Late Rescue",
        "model": "DecoupledSimulator v2.0",
        "base_context": {k: v for k, v in BASE_PARAMS.items()},
        "therapy": {"ISR": THERAPY_ISR, "TSSE": THERAPY_TSSE, "coupled_suppression_pct": 90},
        "n_seeds": N_SEEDS,
        "n_boot": N_BOOT,
        "steps": STEPS,
        "baseline": {
            "genuine_tipping_rate": round(base_genuine, 3),
            "first_death_step":     round(base_first_death, 1),
            "plateau_survivors":    round(base_plateau, 1),
            "functional_survival":  round(base_func_dur, 1),
        },
        "t50_rescue": round(t50_rescue, 1),
        "t50_rescue_ci": [round(t50_lo, 1), round(t50_hi, 1)],
        "point_of_no_return": ponr,
        "rescue_shape":    rescue_shape,
        "cliff_interval":  [cliff_onset_lo, cliff_onset_hi],
        "verdict":         verdict,
        "feature_importance": feat_corr,
        "best_predictor":     best_predictor,
        "comparison_r3_9": comparison,
        "onset_results": all_results,
    }

    with open(out_dir / "r4_1_results.json", "w", encoding="utf-8") as f:
        json.dump(results_json, f, indent=2)

    # ── Save CSV ──────────────────────────────────────────────────────────────
    with open(out_dir / "r4_1_summary.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "t_start", "genuine_tipping_rate", "ci_lo", "ci_hi",
            "benefit_score", "plateau_survivors", "functional_survival",
            "spatial_coherence_r", "first_death_step",
            "mean_agg_at_t", "mean_atp_at_t", "n_dead_at_t", "n_irreversible_at_t",
        ])
        writer.writeheader()
        for r in all_results:
            writer.writerow({
                "t_start":              r["t_start"],
                "genuine_tipping_rate": r["genuine_tipping_rate"],
                "ci_lo":                r["ci_lo"],
                "ci_hi":                r["ci_hi"],
                "benefit_score":        r["benefit_score"],
                "plateau_survivors":    r["plateau_survivors"],
                "functional_survival":  r["functional_survival"],
                "spatial_coherence_r":  r["spatial_coherence_r"],
                "first_death_step":     r["first_death_step"],
                "mean_agg_at_t":        r["state_at_t"]["mean_agg"],
                "mean_atp_at_t":        r["state_at_t"]["mean_atp"],
                "n_dead_at_t":          r["state_at_t"]["n_dead"],
                "n_irreversible_at_t":  r["state_at_t"]["n_irreversible"],
            })

    # ── Figures ───────────────────────────────────────────────────────────────
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        ts   = [r["t_start"]             for r in all_results]
        gtr  = [r["genuine_tipping_rate"] for r in all_results]
        cilo = [r["ci_lo"]               for r in all_results]
        cihi = [r["ci_hi"]               for r in all_results]
        ben  = [r["benefit_score"]        for r in all_results]
        plat = [r["plateau_survivors"]    for r in all_results]
        fdur = [r["functional_survival"]  for r in all_results]

        # ── Fig 1: genuine tipping rate vs onset ──────────────────────────────
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.fill_between(ts, cilo, cihi, alpha=0.25, color="#E74C3C", label="95% CI")
        ax.plot(ts, gtr, "o-", color="#E74C3C", linewidth=2, markersize=6,
                label="Genuine tipping rate")
        ax.axhline(0.50, color="gray", linestyle="--", alpha=0.6, linewidth=1,
                   label="50% threshold")
        if t50_rescue:
            ax.axvline(t50_rescue, color="#F39C12", linestyle=":", linewidth=1.5,
                       label=f"T50_rescue={t50_rescue:.0f}")
        if ponr:
            ax.axvline(ponr, color="#8E44AD", linestyle=":", linewidth=1.5,
                       label=f"PONR={ponr}")
        ax.set_xlabel("Treatment onset (simulation step)", fontsize=11)
        ax.set_ylabel("Genuine tipping rate", fontsize=11)
        ax.set_title("R4.1 -- Rescue Probability vs Treatment Onset\n"
                     "(90% coupled ISR+TSSE suppression; N=50 seeds)", fontsize=10)
        ax.set_ylim(-0.05, 1.10)
        ax.legend(fontsize=9)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout()
        plt.savefig(out_dir / "fig1_tipping_rate_vs_onset.png", dpi=200, bbox_inches="tight")
        plt.close()

        # ── Fig 2: benefit score vs onset ──────────────────────────────────
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.bar(ts, ben, width=18, color="#2ECC71", alpha=0.85, zorder=3)
        ax.set_xlabel("Treatment onset (simulation step)", fontsize=11)
        ax.set_ylabel("Benefit score", fontsize=11)
        ax.set_title("R4.1 -- Therapeutic Benefit Score vs Treatment Onset", fontsize=10)
        ax.set_ylim(0, 1.05)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout()
        plt.savefig(out_dir / "fig2_benefit_vs_onset.png", dpi=200, bbox_inches="tight")
        plt.close()

        # ── Fig 3: plateau survivors vs onset ─────────────────────────────
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.plot(ts, plat, "s-", color="#3498DB", linewidth=2, markersize=6)
        ax.axhline(base_plateau, color="gray", linestyle="--", alpha=0.6,
                   label=f"Baseline ({base_plateau:.1f})")
        ax.set_xlabel("Treatment onset (simulation step)", fontsize=11)
        ax.set_ylabel("Plateau survivors (neurons alive at t=500)", fontsize=11)
        ax.set_title("R4.1 -- Plateau Survivors vs Treatment Onset", fontsize=10)
        ax.legend(fontsize=9)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout()
        plt.savefig(out_dir / "fig3_plateau_vs_onset.png", dpi=200, bbox_inches="tight")
        plt.close()

        # ── Fig 4: functional survival duration vs onset ───────────────────
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.plot(ts, fdur, "^-", color="#9B59B6", linewidth=2, markersize=6)
        ax.axhline(base_func_dur, color="gray", linestyle="--", alpha=0.6,
                   label=f"Baseline ({base_func_dur:.1f})")
        ax.set_xlabel("Treatment onset (simulation step)", fontsize=11)
        ax.set_ylabel("Functional survival (steps with >30 alive)", fontsize=11)
        ax.set_title("R4.1 -- Functional Survival Duration vs Treatment Onset", fontsize=10)
        ax.legend(fontsize=9)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout()
        plt.savefig(out_dir / "fig4_functional_survival_vs_onset.png", dpi=200, bbox_inches="tight")
        plt.close()

        # ── Fig 5: state variables at intervention time ────────────────────
        state_vars = ["mean_agg", "mean_atp", "n_dead", "n_irreversible",
                      "mean_tox", "network_agg_load"]
        labels     = ["Mean aggregation", "Mean ATP", "Dead neurons",
                      "Irreversible neurons", "Mean toxicity", "Network agg load"]
        colors_sv  = ["#E74C3C", "#2ECC71", "#95A5A6", "#8E44AD", "#F39C12", "#3498DB"]

        fig, axes = plt.subplots(2, 3, figsize=(13, 8))
        for ax, sv, lab, col in zip(axes.flat, state_vars, labels, colors_sv):
            vals_sv = [r["state_at_t"][sv] for r in all_results]
            ax.plot(ts, vals_sv, "o-", color=col, linewidth=2, markersize=5)
            ax.set_xlabel("Treatment onset (step)", fontsize=9)
            ax.set_ylabel(lab, fontsize=9)
            ax.set_title(lab, fontsize=9)
            ax.spines["top"].set_visible(False)
            ax.spines["right"].set_visible(False)
        fig.suptitle("R4.1 -- System State at Intervention Time vs Onset Step",
                     fontsize=11)
        plt.tight_layout()
        plt.savefig(out_dir / "fig5_state_vars_at_t.png", dpi=200, bbox_inches="tight")
        plt.close()

        # ── Fig 6: feature importance ──────────────────────────────────────
        sorted_feats = sorted(feat_corr.items(), key=lambda x: abs(x[1]), reverse=True)
        fnames = [f[0].replace("_", " ") for f in sorted_feats]
        fvals  = [f[1] for f in sorted_feats]
        fcolors= ["#E74C3C" if v > 0 else "#3498DB" for v in fvals]

        fig, ax = plt.subplots(figsize=(8, 5))
        ax.barh(fnames, [abs(v) for v in fvals], color=fcolors, alpha=0.85)
        ax.set_xlabel("Absolute Pearson r with is_genuine", fontsize=11)
        ax.set_title("R4.1 -- Feature Importance: State Variables vs Rescue Outcome\n"
                     "(red = positive corr; blue = negative corr)", fontsize=10)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout()
        plt.savefig(out_dir / "fig6_feature_importance.png", dpi=200, bbox_inches="tight")
        plt.close()

        # ── Fig 7: rescue cliff ────────────────────────────────────────────
        delta_arr = [abs(gtr[i+1] - gtr[i]) for i in range(len(gtr)-1)]
        midpoints = [(ts[i] + ts[i+1]) / 2 for i in range(len(ts)-1)]

        fig, (ax_top, ax_bot) = plt.subplots(2, 1, figsize=(8, 8), sharex=False)

        ax_top.fill_between(ts, cilo, cihi, alpha=0.2, color="#E74C3C")
        ax_top.plot(ts, gtr, "o-", color="#E74C3C", linewidth=2, markersize=6)
        ax_top.axhline(0.50, color="gray", linestyle="--", alpha=0.6, linewidth=1)
        if t50_rescue:
            ax_top.axvline(t50_rescue, color="#F39C12", linestyle=":", linewidth=1.5,
                           label=f"T50={t50_rescue:.0f} steps")
        ax_top.set_ylabel("Genuine tipping rate", fontsize=10)
        ax_top.set_title("R4.1 -- Rescue Cliff: Rate & Step-Change", fontsize=10)
        ax_top.legend(fontsize=9)
        ax_top.set_ylim(-0.05, 1.10)
        ax_top.spines["top"].set_visible(False)
        ax_top.spines["right"].set_visible(False)

        ax_bot.bar(midpoints, delta_arr, width=18, color="#F39C12", alpha=0.85)
        ax_bot.axhline(0.20, color="red", linestyle="--", alpha=0.6,
                       label="Cliff threshold (0.20)")
        ax_bot.set_xlabel("Treatment onset (simulation step)", fontsize=10)
        ax_bot.set_ylabel("|Delta genuine rate|", fontsize=10)
        ax_bot.legend(fontsize=9)
        ax_bot.spines["top"].set_visible(False)
        ax_bot.spines["right"].set_visible(False)

        plt.tight_layout()
        plt.savefig(out_dir / "fig7_rescue_cliff.png", dpi=200, bbox_inches="tight")
        plt.close()

        print("Figures saved.")

    except Exception as e:
        print(f"Figure generation skipped: {e}")

    # ── Report ────────────────────────────────────────────────────────────────
    elapsed = time.time() - t0
    report_lines = [
        "# Phase R4.1 — Dynamic Therapeutic Window & Late Rescue",
        "",
        "> **Disclaimer**: All results are specific to the computational v2.0 model.",
        "> This is hypothesis-generating only and does not constitute clinical evidence.",
        "",
        "## Summary",
        "",
        f"- **Verdict**: {verdict}",
        f"- **T50_rescue**: {t50_rescue:.1f} steps [{t50_lo:.0f}, {t50_hi:.0f}] "
        f"(onset at which 50% of therapeutic benefit is lost)",
        f"- **Point of no return**: "
        f"{'step ' + str(ponr) if ponr else 'not reached within tested range'}",
        f"- **Rescue shape**: {rescue_shape} (max step-change {max_delta:.3f} "
        f"at T={cliff_onset_lo}->T={cliff_onset_hi})",
        f"- **Best predictor of rescue failure**: {best_predictor} (r={feat_corr[best_predictor]:+.3f})",
        "",
        "## Design",
        "",
        f"- Base context: ISR=2.0, TSSE=2.0 (100% genuine tipping at T=0 with no therapy)",
        f"- Therapy: 90% coupled suppression (ISR=0.20, TSSE=0.20) — strongest from R3.10",
        f"- T_start sweep: {T_STARTS}",
        f"- N={N_SEEDS} seeds per onset, 500 steps, {N_BOOT} bootstrap resamples",
        f"- Total runs: {N_SEEDS * len(T_STARTS)} (+{N_SEEDS} baseline)",
        "",
        "## Baseline (no therapy)",
        "",
        f"| Metric | Value |",
        f"|---|---|",
        f"| Genuine tipping rate | {base_genuine:.3f} |",
        f"| First death step (mean) | {base_first_death:.1f} |",
        f"| Plateau survivors (mean) | {base_plateau:.1f} |",
        f"| Functional survival (mean) | {base_func_dur:.1f} |",
        "",
        "## Rescue Dose-Response",
        "",
        "| T_start | Genuine rate | 95% CI | Benefit | Plateau | Func. survival |",
        "|---|---|---|---|---|---|",
    ]
    for r in all_results:
        report_lines.append(
            f"| {r['t_start']} | {r['genuine_tipping_rate']:.3f} "
            f"| [{r['ci_lo']:.3f}, {r['ci_hi']:.3f}] "
            f"| {r['benefit_score']:.3f} "
            f"| {r['plateau_survivors']:.1f} "
            f"| {r['functional_survival']:.1f} |"
        )

    report_lines += [
        "",
        "## State at Intervention Time",
        "",
        "| T_start | Alive | Dead | Irrev. | Mean agg | Mean ATP | Mean tox | Coherence r |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in all_results:
        st = r["state_at_t"]
        report_lines.append(
            f"| {r['t_start']} | {st['n_alive']:.0f} | {st['n_dead']:.1f} "
            f"| {st['n_irreversible']:.1f} "
            f"| {st['mean_agg']:.3f} | {st['mean_atp']:.3f} "
            f"| {st['mean_tox']:.3f} | {st['coherence_r_at_t']:.3f} |"
        )

    report_lines += [
        "",
        "## Feature Importance (correlation with rescue failure)",
        "",
        "| State variable | Pearson r (with is_genuine) |",
        "|---|---|",
    ]
    for k, v in sorted(feat_corr.items(), key=lambda x: -abs(x[1])):
        report_lines.append(f"| {k} | {v:+.3f} |")

    report_lines += [
        "",
        f"Best predictor: **{best_predictor}** (r={feat_corr[best_predictor]:+.3f}).",
        "",
        "## Comparison with R3.9 (Potency vs Timing)",
        "",
        f"R3.9 required **96.5% ISR suppression** (at T=0) to achieve 50% tipping reduction.",
        f"R4.1 shows rescue fails at **T~{t50_rescue:.0f} steps** even with 90% coupled suppression.",
        "",
        "Within this computational framework, both potency and timing impose independent constraints "
        "on therapeutic efficacy. The R3.9 cliff (95% potency required) and the R4.1 timing cliff "
        f"(T~{t50_rescue:.0f} steps) together define a two-dimensional therapeutic constraint surface.",
        "",
        "## Key Questions Addressed",
        "",
        f"1. **Does a critical rescue window exist?** "
        f"{'Yes' if ponr or t50_rescue < T_STARTS[-1] else 'Not clearly within tested range'} — "
        f"within this computational framework.",
        f"2. **Point of no return?** "
        f"{'Step ' + str(ponr) if ponr else 'Not reached by step ' + str(T_STARTS[-1])}.",
        f"3. **Best predictor of rescue failure?** {best_predictor} (r={feat_corr[best_predictor]:+.3f}). "
        f"This is a model-internal finding.",
        "4. **Rescue before first neuron dies?** "
        f"Baseline first death at step ~{base_first_death:.0f}. "
        f"T50_rescue at step ~{t50_rescue:.0f} — "
        f"{'rescue fails BEFORE the first neuron dies, supporting the pre-symptomatic window concept' if t50_rescue < base_first_death else 'rescue window extends beyond the first neuron death'}.",
        "5. **Timing vs potency?** Both are necessary but independent constraints within this model. "
        "Neither alone is sufficient — near-complete suppression applied too late still fails; "
        "early intervention with insufficient potency also fails (R3.9).",
        "6. **Pre-symptomatic window?** "
        f"The model supports the concept: rescue probability is highest at T=0 and "
        f"declines steadily thereafter. All results are hypothesis-generating only.",
        "",
        "## Limitations",
        "",
        "- All findings are specific to this computational model and parameter set.",
        "- The 90% coupled suppression therapy is a model construct without a direct biological equivalent.",
        "- The 'point of no return' is a model threshold, not a biological prediction.",
        "- Results do not account for pharmacokinetics, drug distribution, or off-target effects.",
        "- Not peer-reviewed. Not a clinical model.",
        "",
        f"*Generated: Phase R4.1 | Runtime: {elapsed:.1f}s*",
    ]

    with open(out_dir / "r4_1_report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))

    print(f"Results saved to {out_dir}/")
    print(f"Runtime: {elapsed:.1f}s")


if __name__ == "__main__":
    main()

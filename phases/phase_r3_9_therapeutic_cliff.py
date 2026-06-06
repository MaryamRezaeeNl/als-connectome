"""Phase R3.9 -- Therapeutic Cliff Mapping.

Question:
Does ISR suppression produce a gradual therapeutic response or a sharp
tipping-prevention threshold ("therapeutic cliff")?

Scientific motivation:
R3.8 showed ISR suppression is the dominant therapeutic lever (63x more effective
than glutamate suppression at comparable doses) but even 70% ISR reduction only
dropped genuine tipping from 100% to 95%. This suggests a possible nonlinear
gatekeeper threshold. R3.9 maps the full ISR dose-response curve with dense
sampling near the suspected threshold region.

IMPORTANT: Computational hypothesis-generating analysis only.
No clinical claims are made. All results are within this computational framework.

Model: Decoupled v2.0 (DecoupledSimulator from R3.1)
Context: Medium aggregation (ISR=2.0, TSSE=2.0)
Connectome: C. elegans motor circuit (61 neurons)
Criterion: Strict Phase 7B tipping (C1 + C2 + C3)

Sweep:
  ISR suppression: 0-99% (19 levels, dense near threshold)
  50 seeds x 500 steps per level

Analyses:
  1. Cliff detection (adjacent delta > 0.20 in tipping rate or > 0.10 in benefit)
  2. Critical threshold estimates (ISR50, ISR90)
  3. Response shape classification (linear/saturating/sigmoidal/cliff-like)
  4. Early-warning behavior of leading indicators

Outputs: results/phase_r3_9_therapeutic_cliff/
"""

import json
import time
import sys
import os
import csv
import numpy as np
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from connectome import NEURON_NAMES, VULNERABILITY
from phase_r3_1_decoupled_aggregation import DecoupledSimulator, _pearson_r

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

# ── Constants ──────────────────────────────────────────────────────────────────

N          = len(NEURON_NAMES)   # 61
N_SEEDS    = 50
STEPS      = 500
SLOPE_THR  = 4
COH_THR    = 0.30
SILENT_MIN = 50
N_BOOT     = 1000

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES])

# ── Baseline parameters ───────────────────────────────────────────────────────

BASELINE_ISR   = 2.0
BASELINE_TSSE  = 2.0
BASELINE_GLUT  = 0.010

BASE_PARAMS = {
    "aggregationAmplification":      1.0,
    "intracellularSeedingRate":      BASELINE_ISR,
    "transSynapticSpreadEfficiency": BASELINE_TSSE,
    "mitochondrialFragility":        1.0,
    "atpCollapseThreshold":          0.30,
    "glutamateSensitivity":          BASELINE_GLUT,
    "calciumStressGain":             0.50,
    "oxidativeFeedback":             0.020,
    "recoveryIrreversibility":       0.80,
}

# ISR suppression levels (fraction, 0-1)
ISR_SUPPRESSION_LEVELS = [
    0.00, 0.10, 0.20, 0.30, 0.40, 0.50,
    0.60, 0.70, 0.75, 0.80, 0.85,
    0.90, 0.92, 0.94, 0.95,
    0.96, 0.97, 0.98, 0.99,
]

# Benefit score weights (same as R3.8)
W_TIP = 0.40
W_DEL = 0.20
W_PLT = 0.25
W_SUR = 0.15

# Cliff detection thresholds
CLIFF_TIPPING_DELTA  = 0.20   # |delta genuine_rate| between adjacent levels
CLIFF_BENEFIT_DELTA  = 0.10   # |delta benefit_score| between adjacent levels

# ── Simulation core ───────────────────────────────────────────────────────────

def _make_params(isr_red):
    p = dict(BASE_PARAMS)
    p["intracellularSeedingRate"] = BASELINE_ISR * (1.0 - isr_red)
    return p


def _run_single(params, seed):
    """Run one simulation; return per-run metrics."""
    sim        = DecoupledSimulator(seed=seed, noise_scale=0.003, params=params)
    alive_hist = []
    death_step = np.full(sim.n, STEPS + 1, dtype=float)
    prev_alive = np.ones(sim.n, dtype=bool)

    for s in range(STEPS):
        sim.step()
        curr  = sim.health > sim.DEAD_THRESHOLD
        newly = prev_alive & ~curr & (death_step == STEPS + 1)
        death_step[newly] = float(s + 1)
        prev_alive = curr
        alive_hist.append(int(curr.sum()))

    # C1: peak 10-step death rate
    rates     = [alive_hist[t] - alive_hist[t + 10] for t in range(len(alive_hist) - 10)]
    peak_rate = int(max(rates)) if rates else 0

    # C2: spatial coherence
    died  = death_step < STEPS + 1
    coh_r = float(_pearson_r(VULN[died], -death_step[died])) if died.sum() >= 4 else 0.0

    # C3: first death
    first_death = int(death_step[died].min()) if died.any() else (STEPS + 1)

    is_genuine = (peak_rate > SLOPE_THR) and (coh_r > COH_THR) and (first_death > SILENT_MIN)
    plateau    = int(alive_hist[-1])

    # Tipping step: step where death rate first exceeds SLOPE_THR
    tip_step = STEPS + 1
    for t in range(len(alive_hist) - 10):
        if alive_hist[t] - alive_hist[t + 10] > SLOPE_THR:
            tip_step = t + 1
            break

    # Functional survival: step when alive_count first drops to <= N//2 (30)
    func_surv = STEPS
    half_N    = N // 2
    for t, a in enumerate(alive_hist):
        if a <= half_N:
            func_surv = t + 1
            break

    return {
        "is_genuine":          bool(is_genuine),
        "peak_rate":           peak_rate,
        "coh_r":               round(coh_r, 4),
        "first_death":         first_death,
        "tipping_step":        tip_step,
        "plateau":             plateau,
        "functional_survival": func_surv,
    }


def _aggregate(runs):
    """Aggregate N per-run dicts into condition-level stats with bootstrap CI."""
    n = len(runs)
    genuine_arr = np.array([r["is_genuine"] for r in runs], dtype=float)
    # Bootstrap 95% CI for genuine_tipping_rate
    rng_b = np.random.default_rng(39001)
    boot  = [float(np.mean(genuine_arr[rng_b.integers(0, n, size=n)])) for _ in range(N_BOOT)]
    gtr_ci_lo = round(float(np.percentile(boot,  2.5)), 3)
    gtr_ci_hi = round(float(np.percentile(boot, 97.5)), 3)

    first_deaths = np.array([r["first_death"] for r in runs], dtype=float)
    tip_steps    = np.array([r["tipping_step"] for r in runs], dtype=float)
    plateaus     = np.array([r["plateau"]       for r in runs], dtype=float)
    coh_rs       = np.array([r["coh_r"]         for r in runs], dtype=float)
    func_survs   = np.array([r["functional_survival"] for r in runs], dtype=float)
    peak_rates   = np.array([r["peak_rate"]     for r in runs], dtype=float)

    return {
        "genuine_tipping_rate":         round(float(genuine_arr.mean()), 4),
        "genuine_tipping_rate_ci_lo":   gtr_ci_lo,
        "genuine_tipping_rate_ci_hi":   gtr_ci_hi,
        "first_death_step":             round(float(np.median(first_deaths)), 1),
        "tipping_step":                 round(float(np.median(tip_steps[tip_steps < STEPS + 1])), 1)
                                         if (tip_steps < STEPS + 1).any() else float(STEPS + 1),
        "plateau_survivors":            round(float(np.median(plateaus)), 1),
        "plateau_mean":                 round(float(plateaus.mean()), 2),
        "spatial_coherence_r":          round(float(coh_rs.mean()), 4),
        "functional_survival_duration": round(float(np.median(func_survs)), 1),
        "peak_death_slope":             round(float(np.median(peak_rates)), 1),
    }


# ── Benefit score ─────────────────────────────────────────────────────────────

def _benefit_score(cond, base):
    tip_denom = max(base["genuine_tipping_rate"],                   0.01)
    del_range = max(STEPS  - base["first_death_step"],              1.0)
    plt_range = max(float(N) - base["plateau_survivors"],           1.0)
    sur_range = max(STEPS  - base["functional_survival_duration"],  1.0)

    tip   = max(0.0, min(1.0,
            (base["genuine_tipping_rate"] - cond["genuine_tipping_rate"]) / tip_denom))
    delay = max(0.0, min(1.0,
            (cond["first_death_step"] - base["first_death_step"]) / del_range))
    plat  = max(0.0, min(1.0,
            (cond["plateau_survivors"] - base["plateau_survivors"]) / plt_range))
    surv  = max(0.0, min(1.0,
            (cond["functional_survival_duration"] - base["functional_survival_duration"]) / sur_range))

    return round(float(W_TIP * tip + W_DEL * delay + W_PLT * plat + W_SUR * surv), 5)


# ── Cliff detection ───────────────────────────────────────────────────────────

def _detect_cliffs(levels_data):
    """Identify adjacent-level jumps in tipping rate and benefit score."""
    cliffs = []
    n = len(levels_data)
    for i in range(1, n):
        prev = levels_data[i - 1]
        curr = levels_data[i]
        delta_tip = curr["genuine_tipping_rate"] - prev["genuine_tipping_rate"]
        delta_ben = curr["benefit_score"]        - prev["benefit_score"]
        if abs(delta_tip) > CLIFF_TIPPING_DELTA or abs(delta_ben) > CLIFF_BENEFIT_DELTA:
            cliffs.append({
                "from_suppression": prev["isr_suppression"],
                "to_suppression":   curr["isr_suppression"],
                "delta_tipping":    round(float(delta_tip), 4),
                "delta_benefit":    round(float(delta_ben), 4),
                "is_cliff":         True,
            })
    return cliffs


# ── Critical threshold interpolation ─────────────────────────────────────────

def _interpolate_threshold(x_arr, y_arr, target_y):
    """Linear interpolation between adjacent points to find x where y = target_y."""
    for i in range(1, len(x_arr)):
        y0, y1 = y_arr[i - 1], y_arr[i]
        if (y0 >= target_y >= y1) or (y0 <= target_y <= y1):
            if abs(y1 - y0) < 1e-9:
                return float(x_arr[i])
            t = (target_y - y0) / (y1 - y0)
            return round(float(x_arr[i - 1] + t * (x_arr[i] - x_arr[i - 1])), 4)
    return None   # target not reached in range


def _threshold_ci_bootstrap(levels_data, target_frac, n_boot=1000):
    """Bootstrap CI for the critical ISR suppression threshold."""
    x_arr   = np.array([d["isr_suppression"] for d in levels_data])
    gtr_arr = np.array([d["genuine_tipping_rate"] for d in levels_data])
    gtr_lo  = np.array([d["genuine_tipping_rate_ci_lo"] for d in levels_data])
    gtr_hi  = np.array([d["genuine_tipping_rate_ci_hi"] for d in levels_data])
    base_gtr = gtr_arr[0]
    target   = base_gtr * (1.0 - target_frac)

    rng_b = np.random.default_rng(39011)
    thresholds = []
    for _ in range(n_boot):
        # Resample within CI bounds (treat CI as uniform range for simplicity)
        gtr_sample = np.array([
            rng_b.uniform(lo, hi) for lo, hi in zip(gtr_lo, gtr_hi)
        ])
        thr = _interpolate_threshold(x_arr, gtr_sample, target)
        if thr is not None:
            thresholds.append(thr)
    if len(thresholds) < 10:
        return None, None, None
    thresholds = np.array(thresholds)
    return (round(float(np.median(thresholds)),              4),
            round(float(np.percentile(thresholds,  2.5)),   4),
            round(float(np.percentile(thresholds, 97.5)),   4))


# ── Response shape classification ─────────────────────────────────────────────

def _classify_response_shape(levels_data):
    """Classify tipping-rate vs ISR-suppression curve shape."""
    x   = np.array([d["isr_suppression"] for d in levels_data])
    y   = np.array([d["genuine_tipping_rate"] for d in levels_data])
    n   = len(x)

    # Metrics
    total_drop    = float(y[0] - y[-1])
    first_half_drop  = float(y[0] - y[n // 2])
    second_half_drop = float(y[n // 2] - y[-1])

    # Max single-step delta
    deltas     = np.abs(np.diff(y))
    max_delta  = float(deltas.max())
    max_idx    = int(deltas.argmax())
    max_at_sup = float(x[max_idx + 1])  # suppression level where cliff occurs

    # Cliff detection: max single-step > 0.30 of total drop -> cliff-like
    if total_drop < 0.05:
        shape = "flat"
        desc  = ("Genuine tipping rate does not decrease substantially across the "
                 "tested range; the cascade is robust to ISR suppression in this model.")
    elif max_delta > 0.30 * max(total_drop, 0.01) and max_delta > 0.25:
        shape = "cliff-like"
        desc  = (f"A sharp threshold exists near ISR suppression = {max_at_sup:.0%}. "
                 f"Maximum single-step drop = {max_delta:.3f} genuine tipping rate units.")
    elif second_half_drop > 2.0 * first_half_drop:
        shape = "sigmoidal"
        desc  = ("Response is sigmoidal: slow initial decline, then accelerating drop "
                 "at high suppression levels. Implies a critical threshold in the upper range.")
    elif first_half_drop > 2.0 * second_half_drop:
        shape = "saturating"
        desc  = ("Response is saturating: rapid initial benefit that plateaus. "
                 "Diminishing returns at high suppression levels.")
    else:
        shape = "linear"
        desc  = "Response decreases approximately linearly with ISR suppression level."

    return {
        "shape":              shape,
        "description":        desc,
        "total_drop":         round(total_drop, 4),
        "max_single_step_drop": round(max_delta, 4),
        "max_drop_at_suppression": round(max_at_sup, 4),
        "first_half_drop":    round(first_half_drop, 4),
        "second_half_drop":   round(second_half_drop, 4),
    }


# ── Plots ─────────────────────────────────────────────────────────────────────

def _plot_all(levels_data, cliffs, shape_info, threshold_50, threshold_90, out_dir):
    x    = [d["isr_suppression"] * 100 for d in levels_data]
    gtr  = [d["genuine_tipping_rate"]         for d in levels_data]
    ben  = [d["benefit_score"]                for d in levels_data]
    plat = [d["plateau_survivors"]            for d in levels_data]
    fd   = [d["first_death_step"]             for d in levels_data]
    coh  = [d["spatial_coherence_r"]          for d in levels_data]
    fs   = [d["functional_survival_duration"] for d in levels_data]
    ci_lo = [d["genuine_tipping_rate_ci_lo"]  for d in levels_data]
    ci_hi = [d["genuine_tipping_rate_ci_hi"]  for d in levels_data]

    x_arr  = np.array(x)
    gtr_lo = np.array(ci_lo)
    gtr_hi = np.array(ci_hi)

    # ── Figure 1: genuine tipping rate + CI ──────────────────────────────────
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.fill_between(x_arr, gtr_lo, gtr_hi, alpha=0.25, color="#00e5ff", label="95% CI")
    ax.plot(x_arr, gtr, "o-", color="#00e5ff", linewidth=2, markersize=5, label="Genuine tipping rate")
    ax.axhline(0.50, color="#ffd700", linestyle="--", linewidth=1, label="50% tipping threshold")
    ax.axhline(0.10, color="#ff4444", linestyle="--", linewidth=1, label="10% tipping threshold")
    if threshold_50 is not None:
        ax.axvline(threshold_50[0] * 100, color="#ffd700", linestyle=":", linewidth=1.5,
                   label=f"ISR50 = {threshold_50[0]*100:.1f}%")
    if threshold_90 is not None:
        ax.axvline(threshold_90[0] * 100, color="#ff4444", linestyle=":", linewidth=1.5,
                   label=f"ISR90 = {threshold_90[0]*100:.1f}%")
    for c in cliffs:
        ax.axvspan(c["from_suppression"] * 100, c["to_suppression"] * 100,
                   alpha=0.15, color="#ff6b00", label="_nolegend_")
    ax.set_xlabel("ISR suppression (%)", fontsize=11)
    ax.set_ylabel("Genuine tipping rate", fontsize=11)
    ax.set_title(f"R3.9 -- Genuine Tipping Rate vs ISR Suppression\n({shape_info['shape'].upper()})", fontsize=11, fontweight='bold')
    ax.set_ylim(-0.05, 1.05)
    ax.set_xlim(-2, 102)
    ax.legend(fontsize=8, loc="upper right")
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_dir / "fig1_tipping_rate.png", dpi=150, bbox_inches='tight')
    plt.close()

    # ── Figure 2: benefit score ───────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(x_arr, ben, "s-", color="#a855f7", linewidth=2, markersize=5)
    ax.fill_between(x_arr, ben, alpha=0.2, color="#a855f7")
    for c in cliffs:
        ax.axvspan(c["from_suppression"] * 100, c["to_suppression"] * 100,
                   alpha=0.15, color="#ff6b00", label="_nolegend_")
    ax.set_xlabel("ISR suppression (%)", fontsize=11)
    ax.set_ylabel("Therapeutic benefit score", fontsize=11)
    ax.set_title("R3.9 -- Benefit Score vs ISR Suppression", fontsize=11, fontweight='bold')
    ax.set_ylim(-0.02, max(ben) * 1.15 + 0.05)
    ax.set_xlim(-2, 102)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_dir / "fig2_benefit_score.png", dpi=150, bbox_inches='tight')
    plt.close()

    # ── Figure 3: plateau survivors ───────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(x_arr, plat, "D-", color="#ffd700", linewidth=2, markersize=5)
    ax.axhline(levels_data[0]["plateau_survivors"], color="#888", linestyle="--",
               linewidth=1, label=f"Baseline plateau ({levels_data[0]['plateau_survivors']:.0f})")
    ax.set_xlabel("ISR suppression (%)", fontsize=11)
    ax.set_ylabel("Median plateau survivors", fontsize=11)
    ax.set_title("R3.9 -- Plateau Survivors vs ISR Suppression", fontsize=11, fontweight='bold')
    ax.set_ylim(0, N + 2)
    ax.set_xlim(-2, 102)
    ax.legend(fontsize=9)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_dir / "fig3_plateau_survivors.png", dpi=150, bbox_inches='tight')
    plt.close()

    # ── Figure 4: first death step ────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(x_arr, fd, "^-", color="#4ade80", linewidth=2, markersize=5)
    ax.axhline(levels_data[0]["first_death_step"], color="#888", linestyle="--",
               linewidth=1, label=f"Baseline ({levels_data[0]['first_death_step']:.0f})")
    ax.set_xlabel("ISR suppression (%)", fontsize=11)
    ax.set_ylabel("Median first death step", fontsize=11)
    ax.set_title("R3.9 -- First Death Step vs ISR Suppression", fontsize=11, fontweight='bold')
    ax.set_xlim(-2, 102)
    ax.legend(fontsize=9)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_dir / "fig4_first_death_step.png", dpi=150, bbox_inches='tight')
    plt.close()

    # ── Figure 5: cliff detection (delta genuine_rate) ────────────────────────
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
    x_mid   = [(x[i] + x[i + 1]) / 2 for i in range(len(x) - 1)]
    d_gtr   = [gtr[i + 1] - gtr[i]   for i in range(len(gtr) - 1)]
    d_ben   = [ben[i + 1] - ben[i]   for i in range(len(ben) - 1)]
    bar_cols_gtr = ["#ff4444" if abs(d) > CLIFF_TIPPING_DELTA else "#374151" for d in d_gtr]
    bar_cols_ben = ["#ff4444" if abs(d) > CLIFF_BENEFIT_DELTA else "#374151" for d in d_ben]

    ax1.bar(x_mid, d_gtr, width=np.diff(x) * 0.6, color=bar_cols_gtr, edgecolor="#555")
    ax1.axhline(-CLIFF_TIPPING_DELTA, color="#ff4444", linestyle="--", linewidth=1,
                label=f"Cliff threshold ({-CLIFF_TIPPING_DELTA})")
    ax1.set_ylabel("Delta genuine tipping rate", fontsize=10)
    ax1.set_title("R3.9 -- Cliff Detection (Adjacent-Level Deltas)", fontsize=11, fontweight='bold')
    ax1.legend(fontsize=8)
    ax1.grid(alpha=0.3)

    ax2.bar(x_mid, d_ben, width=np.diff(x) * 0.6, color=bar_cols_ben, edgecolor="#555")
    ax2.axhline(CLIFF_BENEFIT_DELTA, color="#ff4444", linestyle="--", linewidth=1,
                label=f"Cliff threshold ({CLIFF_BENEFIT_DELTA})")
    ax2.set_ylabel("Delta benefit score", fontsize=10)
    ax2.set_xlabel("ISR suppression (%)", fontsize=11)
    ax2.legend(fontsize=8)
    ax2.grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(out_dir / "fig5_cliff_detection.png", dpi=150, bbox_inches='tight')
    plt.close()

    # ── Figure 6: multi-panel overview ───────────────────────────────────────
    fig = plt.figure(figsize=(12, 8))
    gs  = gridspec.GridSpec(2, 3, figure=fig, hspace=0.45, wspace=0.4)

    ax_gtr  = fig.add_subplot(gs[0, :2])
    ax_coh  = fig.add_subplot(gs[0, 2])
    ax_ben  = fig.add_subplot(gs[1, 0])
    ax_plat = fig.add_subplot(gs[1, 1])
    ax_fd   = fig.add_subplot(gs[1, 2])

    # Genuine tipping rate
    ax_gtr.fill_between(x_arr, gtr_lo, gtr_hi, alpha=0.2, color="#00e5ff")
    ax_gtr.plot(x_arr, gtr, "o-", color="#00e5ff", lw=2, ms=4)
    if threshold_50 is not None:
        ax_gtr.axvline(threshold_50[0] * 100, color="#ffd700", ls=":", lw=1.5,
                       label=f"ISR50 = {threshold_50[0]*100:.1f}%")
    if threshold_90 is not None:
        ax_gtr.axvline(threshold_90[0] * 100, color="#ff4444", ls=":", lw=1.5,
                       label=f"ISR90 = {threshold_90[0]*100:.1f}%")
    ax_gtr.set_title("Genuine Tipping Rate", fontsize=10)
    ax_gtr.set_ylabel("Rate", fontsize=9)
    ax_gtr.set_ylim(-0.05, 1.05)
    ax_gtr.legend(fontsize=7)
    ax_gtr.grid(alpha=0.3)

    # Coherence r
    ax_coh.plot(x_arr, coh, "s-", color="#a855f7", lw=1.5, ms=4)
    ax_coh.axhline(COH_THR, color="#aaa", ls="--", lw=1, label=f"C2 thr ({COH_THR})")
    ax_coh.set_title("Spatial Coherence r", fontsize=10)
    ax_coh.set_ylabel("Pearson r", fontsize=9)
    ax_coh.legend(fontsize=7)
    ax_coh.grid(alpha=0.3)

    # Benefit score
    ax_ben.plot(x_arr, ben, "D-", color="#a855f7", lw=1.5, ms=4)
    ax_ben.fill_between(x_arr, ben, alpha=0.15, color="#a855f7")
    ax_ben.set_title("Benefit Score", fontsize=10)
    ax_ben.set_ylabel("Score", fontsize=9)
    ax_ben.grid(alpha=0.3)

    # Plateau
    ax_plat.plot(x_arr, plat, "^-", color="#ffd700", lw=1.5, ms=4)
    ax_plat.set_title("Plateau Survivors", fontsize=10)
    ax_plat.set_ylabel("Neurons", fontsize=9)
    ax_plat.set_ylim(0, N + 2)
    ax_plat.grid(alpha=0.3)

    # First death
    ax_fd.plot(x_arr, fd, "v-", color="#4ade80", lw=1.5, ms=4)
    ax_fd.set_title("First Death Step", fontsize=10)
    ax_fd.set_ylabel("Step", fontsize=9)
    ax_fd.grid(alpha=0.3)

    for ax in [ax_gtr, ax_coh, ax_ben, ax_plat, ax_fd]:
        ax.set_xlabel("ISR suppression (%)", fontsize=9)
        ax.set_xlim(-2, 102)

    fig.suptitle(f"R3.9 -- Therapeutic Cliff Mapping (Response: {shape_info['shape'].upper()})",
                 fontsize=12, fontweight='bold')
    plt.savefig(out_dir / "fig6_overview_panel.png", dpi=150, bbox_inches='tight')
    plt.close()

    print("  Plots saved (fig1-fig6)")


# ── Report ────────────────────────────────────────────────────────────────────

def _build_report(data):
    p      = data["params"]
    shape  = data["shape_analysis"]
    cliffs = data["cliff_detection"]
    t50    = data["threshold_isr50"]
    t90    = data["threshold_isr90"]
    verd   = data["verdict"]
    levs   = data["levels"]
    base   = levs[0]

    # Results table
    tbl = ("| ISR red. | ISR val | Genuine rate | CI 95% | First death | "
           "Plateau | Coh r | Func. surv. | Benefit |\n"
           "|---|---|---|---|---|---|---|---|---|\n")
    for d in levs:
        isr_pct = int(d["isr_suppression"] * 100)
        isr_val = round(BASELINE_ISR * (1 - d["isr_suppression"]), 3)
        tbl += (
            f"| {isr_pct}% | {isr_val:.3f} "
            f"| {d['genuine_tipping_rate']:.3f} "
            f"| [{d['genuine_tipping_rate_ci_lo']:.3f}, {d['genuine_tipping_rate_ci_hi']:.3f}] "
            f"| {d['first_death_step']:.0f} "
            f"| {d['plateau_survivors']:.0f} "
            f"| {d['spatial_coherence_r']:.3f} "
            f"| {d['functional_survival_duration']:.0f} "
            f"| {d['benefit_score']:.4f} |\n"
        )

    # Cliff section
    if cliffs:
        cliff_text = "\n".join(
            f"- ISR suppression {c['from_suppression']:.0%} -> {c['to_suppression']:.0%}: "
            f"delta_tipping={c['delta_tipping']:+.3f}, delta_benefit={c['delta_benefit']:+.3f}"
            for c in cliffs
        )
    else:
        cliff_text = "No cliff regions detected (all adjacent deltas below thresholds)."

    # Threshold text
    if t50 and t50[0] is not None:
        t50_text = (f"ISR50 = {t50[0]*100:.1f}% (95% CI: [{t50[1]*100:.1f}%, {t50[2]*100:.1f}%])")
    else:
        t50_text = "ISR50: not reached within tested range."
    if t90 and t90[0] is not None:
        t90_text = (f"ISR90 = {t90[0]*100:.1f}% (95% CI: [{t90[1]*100:.1f}%, {t90[2]*100:.1f}%])")
    else:
        t90_text = "ISR90: not reached within tested range."

    # Q&A
    # Q1: Does a therapeutic cliff exist?
    if shape["shape"] == "cliff-like":
        q1 = (
            f"**YES -- a therapeutic cliff is detected within this computational framework.** "
            f"A sharp drop in genuine tipping rate occurs near ISR suppression "
            f"= {shape['max_drop_at_suppression']:.0%}. "
            f"Maximum single-step drop = {shape['max_single_step_drop']:.3f} genuine tipping "
            f"rate units. This is consistent with a nonlinear gatekeeper threshold: "
            f"small additional ISR suppression near this point produces disproportionate "
            f"cascade prevention."
        )
    elif shape["shape"] == "sigmoidal":
        q1 = (
            f"**PARTIAL -- the response is sigmoidal, suggesting a critical threshold "
            f"in the upper suppression range.** Genuine tipping drops slowly for low-moderate "
            f"suppression, then falls more rapidly above ~{shape['max_drop_at_suppression']:.0%}. "
            f"This is a soft version of a therapeutic cliff."
        )
    elif shape["shape"] == "flat":
        q1 = (
            f"**NO -- the therapeutic response is flat across the tested range.** "
            f"Genuine tipping rate does not drop substantially even at 99% ISR suppression. "
            f"The cascade is robust to ISR reduction in this model context. "
            f"This may indicate that at medium aggregation context (ISR=2.0), other cascade "
            f"pathways sustain tipping."
        )
    else:
        q1 = (
            f"**NO clear cliff -- the response is {shape['shape']}.** "
            f"Total genuine tipping drop = {shape['total_drop']:.3f} across all tested levels. "
            f"No sharp threshold is detected. Benefit increases {shape['shape']}ly with ISR suppression."
        )

    # Q2: At what level does tipping begin to fail?
    # Find first level where genuine_tipping_rate < 1.0
    onset_level = next((d for d in levs if d["genuine_tipping_rate"] < 1.0), None)
    if onset_level:
        q2 = (
            f"**Genuine tipping first drops below 100% at ISR suppression = "
            f"{int(onset_level['isr_suppression']*100)}% "
            f"(ISR = {BASELINE_ISR*(1-onset_level['isr_suppression']):.3f}), "
            f"where genuine tipping rate = {onset_level['genuine_tipping_rate']:.3f}.** "
            f"Below this level, 100% of seeds produce genuine tipping regardless of ISR reduction."
        )
    else:
        q2 = (
            f"**Genuine tipping rate remains at 100% across all tested ISR suppression levels.** "
            f"Even 99% ISR suppression (ISR = {BASELINE_ISR*0.01:.4f}) does not prevent any "
            f"seed from producing a genuine cascade."
        )

    # Q3: Narrow window or broad gradual response?
    window_width = None
    gtr_arr = np.array([d["genuine_tipping_rate"] for d in levs])
    x_arr   = np.array([d["isr_suppression"] for d in levs])
    idx_onset = next((i for i, g in enumerate(gtr_arr) if g < 0.99), None)
    idx_floor = next((i for i, g in enumerate(gtr_arr) if g < 0.10), None)
    if idx_onset is not None and idx_floor is not None:
        window_width = round(float(x_arr[idx_floor] - x_arr[idx_onset]), 4)
        q3 = (
            f"**The transition window spans approximately "
            f"{window_width*100:.1f} percentage points** "
            f"(from first tipping drop at {x_arr[idx_onset]*100:.0f}% suppression to "
            f"90% prevention at {x_arr[idx_floor]*100:.0f}% suppression). "
            + ("A narrow window (< 20 pp) indicates a sharp threshold;"
               if window_width < 0.20 else
               "A broad window (> 20 pp) indicates a gradual response.")
        )
    elif idx_onset is not None:
        q3 = (
            f"Tipping begins to decline at {x_arr[idx_onset]*100:.0f}% ISR suppression, "
            f"but does not reach 90% prevention within the tested range."
        )
    else:
        q3 = (
            "Genuine tipping rate does not drop below 99% within the tested range. "
            "No transition window is identifiable."
        )

    # Q4: Early warning indicators
    # Check if coherence drops before tipping rate drops
    coh_arr = np.array([d["spatial_coherence_r"] for d in levs])
    plat_arr = np.array([d["plateau_survivors"]  for d in levs])
    fd_arr   = np.array([d["first_death_step"]   for d in levs])
    # Check if these metrics change significantly before tipping drops
    if onset_level is not None:
        onset_idx = levs.index(onset_level)
        # Look at metrics in the 3 levels before onset
        pre_onset_coh_trend  = coh_arr[max(0, onset_idx-3):onset_idx]
        pre_onset_plat_trend = plat_arr[max(0, onset_idx-3):onset_idx]
        pre_onset_fd_trend   = fd_arr[max(0, onset_idx-3):onset_idx]
        base_coh  = coh_arr[0]
        base_plat = plat_arr[0]
        base_fd   = fd_arr[0]
        coh_early  = float(base_coh  - pre_onset_coh_trend.mean()) > 0.03 if len(pre_onset_coh_trend) > 0 else False
        plat_early = float(pre_onset_plat_trend.mean() - base_plat) > 0.5  if len(pre_onset_plat_trend) > 0 else False
        fd_early   = float(pre_onset_fd_trend.mean() - base_fd) > 5         if len(pre_onset_fd_trend) > 0 else False
        early_warnings = []
        if coh_early:  early_warnings.append("spatial coherence r decline")
        if plat_early: early_warnings.append("plateau survivor increase")
        if fd_early:   early_warnings.append("first-death delay")
        if early_warnings:
            q4 = (
                f"**YES -- early warning signals are detectable before the tipping collapse within "
                f"this model.** The following metrics show meaningful changes in the levels "
                f"immediately preceding the tipping onset: {', '.join(early_warnings)}. "
                f"These may serve as model-level indicators of approaching cascade prevention."
            )
        else:
            q4 = (
                f"**Weak early warning signals.** Metrics (coherence, plateau, first death) "
                f"do not show strong pre-onset changes within this model. "
                f"The transition may be abrupt rather than presaged by continuous indicator changes."
            )
    else:
        q4 = (
            "No tipping onset was detected within the tested range, so early warning analysis "
            "is not applicable."
        )

    # Q5: Gatekeeper interpretation
    q5 = (
        f"**The results {('strongly support' if shape['shape'] in ('cliff-like','sigmoidal') else 'partially support')} "
        f"the gatekeeper interpretation within this computational framework.** "
        f"ISR is the upstream gatekeeper controlling cascade initiation. "
        f"The {shape['shape']} response shape implies "
    )
    if shape["shape"] == "cliff-like":
        q5 += (
            f"that the cascade has a critical aggregation threshold: once ISR drops below "
            f"a certain level, the misfolded protein load cannot self-sustain, and tipping "
            f"collapses. This is the hallmark of a true gatekeeper mechanism. "
            f"Therapeutic efficacy is strongly nonlinear: effort below the threshold yields "
            f"little benefit; exceeding it produces dramatic cascade prevention."
        )
    elif shape["shape"] == "sigmoidal":
        q5 += (
            f"that the gatekeeper has a soft threshold region. The cascade shows some "
            f"resistance to moderate ISR suppression (the upper sigmoidal region), "
            f"followed by rapid collapse near the critical suppression level. "
            f"This is consistent with a nonlinear positive-feedback loop within the cascade."
        )
    else:
        q5 += (
            f"a {shape['shape']} gatekeeper response. The cascade responds proportionally "
            f"to ISR suppression without a sharp threshold. This may indicate that at "
            f"medium aggregation context (ISR=2.0), the cascade is not near a bifurcation point."
        )

    # Verdict text
    verdict_text = {
        "no_cliff":           "No cliff detected within this computational framework. Response is gradual/flat.",
        "moderate_threshold": "Moderate threshold detected. The cascade shows a sigmoidal or saturating response with an identifiable inflection point but no sharp single-step drop.",
        "sharp_cliff":        "Sharp therapeutic cliff detected within this computational framework. A narrow ISR suppression window produces rapid cascade prevention.",
    }.get(verd, verd)

    report = f"""# R3.9 -- Therapeutic Cliff Mapping

## Overview

**Computational hypothesis-generating analysis only.**
No clinical claims are made. All results are within this computational framework.

**Question**: Does ISR suppression produce a gradual therapeutic response or a sharp
tipping-prevention threshold ("therapeutic cliff")?

**Model**: Decoupled v2.0 (DecoupledSimulator from R3.1)
**Context**: Medium aggregation (ISR = {BASELINE_ISR}, TSSE = {BASELINE_TSSE})
**Baseline glutamateSensitivity**: {BASELINE_GLUT}
**Connectome**: C. elegans motor circuit ({N} neurons)
**Criterion**: Strict Phase 7B (C1: peak rate > {SLOPE_THR}, C2: coh r > {COH_THR}, C3: first death > {SILENT_MIN})
**Runs**: {N_SEEDS} seeds x {STEPS} steps per condition
**Bootstrap**: {N_BOOT} iterations (CI for genuine tipping rate)

**Baseline (ISR = {BASELINE_ISR}, 0% suppression)**:
- Genuine tipping rate: {base['genuine_tipping_rate']:.3f}
- Median first death step: {base['first_death_step']:.0f}
- Median plateau survivors: {base['plateau_survivors']:.0f}
- Mean spatial coherence r: {base['spatial_coherence_r']:.3f}
- Functional survival duration: {base['functional_survival_duration']:.0f} steps

---

## VERDICT: {verd.upper().replace("_", " ")}

{verdict_text}

**Response shape**: {shape['shape'].upper()} — {shape['description']}

**Critical thresholds**:
- {t50_text}
- {t90_text}

**Cliff regions detected**: {len(cliffs)} {'cliff' if len(cliffs) == 1 else 'cliffs'}

{cliff_text}

---

## Q1: Does a therapeutic cliff exist?

{q1}

---

## Q2: At what ISR suppression level does tipping begin to fail?

{q2}

---

## Q3: Is there a narrow threshold window or broad gradual response?

{q3}

---

## Q4: Are there early warning indicators of approaching collapse prevention?

{q4}

---

## Q5: Does this strengthen the gatekeeper interpretation?

{q5}

---

## Full Results Table

{tbl}
---

## Shape Analysis

| Metric | Value |
|--------|-------|
| Response shape | {shape['shape']} |
| Total genuine tipping drop | {shape['total_drop']:.4f} |
| Max single-step drop | {shape['max_single_step_drop']:.4f} |
| Max drop at suppression level | {shape['max_drop_at_suppression']*100:.1f}% |
| First-half drop (0%-{int(ISR_SUPPRESSION_LEVELS[len(ISR_SUPPRESSION_LEVELS)//2]*100)}%) | {shape['first_half_drop']:.4f} |
| Second-half drop ({int(ISR_SUPPRESSION_LEVELS[len(ISR_SUPPRESSION_LEVELS)//2]*100)}%-99%) | {shape['second_half_drop']:.4f} |

---

## Methodology

**ISR suppression sweep**: `intracellularSeedingRate = {BASELINE_ISR} * (1 - suppression_fraction)`
**TSSE**: held constant at {BASELINE_TSSE} (medium context, unperturbed)
**All other parameters**: fixed at medium-context baseline

**Cliff detection thresholds**:
- Tipping rate: |delta| > {CLIFF_TIPPING_DELTA}
- Benefit score: |delta| > {CLIFF_BENEFIT_DELTA}

**ISR50**: suppression level for 50% reduction in genuine tipping probability.
**ISR90**: suppression level for 90% reduction in genuine tipping probability.
Both estimated by linear interpolation between adjacent data points; CI from
bootstrap resampling within per-condition 95% CIs (n={N_BOOT}).

**Benefit score**: weighted composite (tipping 40%, delay 20%, plateau 25%, survival 15%)
vs untreated baseline.

**Functional survival**: step when alive count first drops to <= {N//2}.

---

*R3.9 -- ALS Connectome Degeneration Project*
*Hypothesis-generating analysis only. Not a clinical study.*
"""
    return report


# ── Main ──────────────────────────────────────────────────────────────────────

def run_r3_9():
    t0      = time.time()
    out_dir = Path(__file__).parent.parent / "results" / "phase_r3_9_therapeutic_cliff"
    out_dir.mkdir(parents=True, exist_ok=True)

    n_total = len(ISR_SUPPRESSION_LEVELS) * N_SEEDS
    print("Phase R3.9: Therapeutic Cliff Mapping")
    print(f"  Decoupled v2.0, ISR baseline={BASELINE_ISR}, TSSE={BASELINE_TSSE}")
    print(f"  Levels: {len(ISR_SUPPRESSION_LEVELS)}, seeds: {N_SEEDS}, steps: {STEPS}")
    print(f"  Total runs: {n_total}")
    print()

    # ── Run sweep ─────────────────────────────────────────────────────────────
    raw_by_level   = {}   # suppression_frac -> list of per-run dicts
    stats_by_level = {}   # suppression_frac -> aggregated stats

    for li, isr_red in enumerate(ISR_SUPPRESSION_LEVELS):
        params = _make_params(isr_red)
        runs   = []
        for s in range(N_SEEDS):
            seed = 390000 + li * 1000 + s
            runs.append(_run_single(params, seed))
        raw_by_level[isr_red]   = runs
        stats_by_level[isr_red] = _aggregate(runs)
        st = stats_by_level[isr_red]
        elapsed = time.time() - t0
        print(
            f"  [{li+1:2d}/{len(ISR_SUPPRESSION_LEVELS)}] "
            f"ISR-{int(isr_red*100):2d}%  ISR={BASELINE_ISR*(1-isr_red):.3f} | "
            f"genuine={st['genuine_tipping_rate']:.3f} "
            f"[{st['genuine_tipping_rate_ci_lo']:.3f},{st['genuine_tipping_rate_ci_hi']:.3f}] "
            f"fd={st['first_death_step']:5.0f}  "
            f"plat={st['plateau_survivors']:4.0f}  "
            f"coh={st['spatial_coherence_r']:.3f}  ({elapsed:.0f}s)"
        )

    # ── Benefit scores ────────────────────────────────────────────────────────
    base_stats = stats_by_level[0.0]
    for key, stats in stats_by_level.items():
        stats["benefit_score"] = _benefit_score(stats, base_stats)

    # ── Build ordered levels list ──────────────────────────────────────────────
    levels_data = []
    for isr_red in ISR_SUPPRESSION_LEVELS:
        d = {"isr_suppression": round(float(isr_red), 4)}
        d.update(stats_by_level[isr_red])
        levels_data.append(d)

    # ── Cliff detection ───────────────────────────────────────────────────────
    cliffs = _detect_cliffs(levels_data)
    print()
    if cliffs:
        print(f"Cliff regions detected ({len(cliffs)}):")
        for c in cliffs:
            print(f"  {c['from_suppression']:.0%} -> {c['to_suppression']:.0%}: "
                  f"delta_tipping={c['delta_tipping']:+.3f}  delta_benefit={c['delta_benefit']:+.3f}")
    else:
        print("No cliff regions detected.")

    # ── Critical thresholds ───────────────────────────────────────────────────
    x_arr   = np.array([d["isr_suppression"]      for d in levels_data])
    gtr_arr = np.array([d["genuine_tipping_rate"]  for d in levels_data])
    base_gtr = float(gtr_arr[0])
    target50 = base_gtr * 0.50
    target90 = base_gtr * 0.10

    thr50_pt  = _interpolate_threshold(x_arr, gtr_arr, target50)
    thr90_pt  = _interpolate_threshold(x_arr, gtr_arr, target90)
    thr50_med, thr50_lo, thr50_hi = _threshold_ci_bootstrap(levels_data, 0.50)
    thr90_med, thr90_lo, thr90_hi = _threshold_ci_bootstrap(levels_data, 0.90)

    threshold_isr50 = None
    threshold_isr90 = None
    if thr50_pt is not None:
        threshold_isr50 = [round(thr50_pt, 4), round(float(thr50_lo or thr50_pt), 4),
                           round(float(thr50_hi or thr50_pt), 4)]
        print(f"ISR50 (50% tipping reduction): {thr50_pt*100:.1f}% "
              f"[{(thr50_lo or 0)*100:.1f}%, {(thr50_hi or 0)*100:.1f}%]")
    else:
        print("ISR50: not reached")
    if thr90_pt is not None:
        threshold_isr90 = [round(thr90_pt, 4), round(float(thr90_lo or thr90_pt), 4),
                           round(float(thr90_hi or thr90_pt), 4)]
        print(f"ISR90 (90% tipping reduction): {thr90_pt*100:.1f}% "
              f"[{(thr90_lo or 0)*100:.1f}%, {(thr90_hi or 0)*100:.1f}%]")
    else:
        print("ISR90: not reached")

    # ── Response shape ────────────────────────────────────────────────────────
    shape_info = _classify_response_shape(levels_data)
    print(f"Response shape: {shape_info['shape'].upper()}")
    print(f"  {shape_info['description']}")

    # ── Verdict ───────────────────────────────────────────────────────────────
    if shape_info["shape"] == "cliff-like":
        verdict = "sharp_cliff"
    elif shape_info["shape"] in ("sigmoidal",):
        verdict = "moderate_threshold"
    elif shape_info["shape"] in ("flat",):
        verdict = "no_cliff"
    else:
        verdict = "no_cliff"   # linear or saturating

    print()
    print(f"VERDICT: {verdict.upper()}")
    print()

    # ── Save JSON ──────────────────────────────────────────────────────────────
    output = {
        "phase":   "R3.9 -- Therapeutic Cliff Mapping",
        "params":  {
            "baseline_isr":    BASELINE_ISR,
            "baseline_tsse":   BASELINE_TSSE,
            "baseline_glut":   BASELINE_GLUT,
            "n_seeds":         N_SEEDS,
            "steps":           STEPS,
            "n_bootstrap":     N_BOOT,
            "benefit_weights": {"tipping": W_TIP, "delay": W_DEL, "plateau": W_PLT, "survival": W_SUR},
            "criterion":       {"slope_thr": SLOPE_THR, "coh_thr": COH_THR, "silent_min": SILENT_MIN},
            "isr_suppression_levels": ISR_SUPPRESSION_LEVELS,
            "cliff_thresholds": {
                "tipping_delta": CLIFF_TIPPING_DELTA,
                "benefit_delta": CLIFF_BENEFIT_DELTA,
            },
        },
        "verdict":          verdict,
        "shape_analysis":   shape_info,
        "cliff_detection":  cliffs,
        "threshold_isr50":  threshold_isr50,
        "threshold_isr90":  threshold_isr90,
        "baseline_stats":   base_stats,
        "levels":           levels_data,
    }

    json_path = out_dir / "phase_r3_9_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Results saved: {json_path}")

    # ── Save CSV ───────────────────────────────────────────────────────────────
    csv_path = out_dir / "phase_r3_9_summary.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "isr_suppression_pct", "isr_value",
            "genuine_tipping_rate", "gtr_ci_lo", "gtr_ci_hi",
            "first_death_step", "tipping_step", "plateau_survivors",
            "spatial_coherence_r", "functional_survival_duration",
            "peak_death_slope", "benefit_score",
        ])
        for d in levels_data:
            w.writerow([
                int(d["isr_suppression"] * 100),
                round(BASELINE_ISR * (1 - d["isr_suppression"]), 4),
                d["genuine_tipping_rate"],
                d["genuine_tipping_rate_ci_lo"],
                d["genuine_tipping_rate_ci_hi"],
                d["first_death_step"],
                d["tipping_step"],
                d["plateau_survivors"],
                d["spatial_coherence_r"],
                d["functional_survival_duration"],
                d["peak_death_slope"],
                d["benefit_score"],
            ])
    print(f"CSV saved:     {csv_path}")

    # ── Plots ──────────────────────────────────────────────────────────────────
    print("Generating plots ...")
    _plot_all(levels_data, cliffs, shape_info, threshold_isr50, threshold_isr90, out_dir)

    # ── Report ──────────────────────────────────────────────────────────────────
    report   = _build_report(output)
    rpt_path = out_dir / "phase_r3_9_report.md"
    with open(rpt_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"Report  saved: {rpt_path}")
    print(f"Total runtime: {time.time()-t0:.1f}s")
    return output


if __name__ == "__main__":
    run_r3_9()

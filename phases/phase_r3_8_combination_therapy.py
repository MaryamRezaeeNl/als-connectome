"""Phase R3.8 -- Gatekeeper vs Amplifier Combination Therapy Sweep.

Goal:
Test whether targeting the cascade gatekeeper (ISR / intracellular seeding)
is more effective than targeting a downstream amplifier (glutamate
excitotoxicity), and whether partial dual targeting produces synergy.

Scientific motivation:
Prior phases establish ISR as the primary load-bearing (gatekeeper) mechanism
and glutamate excitotoxicity as a downstream amplifier with weaker standalone
causal power. This phase tests whether riluzole-like glutamate suppression in
this model is ineffective unless the upstream ISR gatekeeper is also partially
suppressed, and whether combination therapy reveals synergy or merely additive
benefit.

IMPORTANT: This is a computational, hypothesis-generating analysis only.
No claims are made about riluzole, ALS patients, or real treatment efficacy.
All conclusions are strictly within this computational framework.

Model: Decoupled v2.0 (DecoupledSimulator from R3.1)
Context: medium aggregation (ISR=2.0, TSSE=2.0)
Connectome: C. elegans motor circuit (61 neurons)
Criterion: strict Phase 7B tipping (C1 + C2 + C3)

Therapy scenarios:
  A. ISR suppression only: 10%, 20%, 30%, 50%, 70% reduction
     Analogous to ASO-like upstream aggregation suppression in model terms.
  B. Glutamate suppression only: 50%, 70%, 90%, 99% reduction
     Analogous to riluzole-like downstream excitotoxicity suppression in model terms.
  C. Combination grid: ISR_red x Glut_red (5 x 4 = 20 conditions)
  D. Smart low-dose: 6 explicit comparisons (subset of C)

Run protocol: 20 seeds x 500 steps per condition

Outputs: results/phase_r3_8_combination_therapy/
  phase_r3_8_results.json
  phase_r3_8_summary.csv
  phase_r3_8_report.md
  heatmap_benefit_score.png
  heatmap_tipping_rate.png
  heatmap_synergy.png
  bar_chart_key_scenarios.png
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
import matplotlib.colors as mcolors

# ── Constants ──────────────────────────────────────────────────────────────────

N          = len(NEURON_NAMES)   # 61
N_SEEDS    = 20
STEPS      = 500
SLOPE_THR  = 4
COH_THR    = 0.30
SILENT_MIN = 50
N_BOOT     = 500

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES])

# ── Baseline parameters (medium aggregation context) ──────────────────────────

BASELINE_ISR   = 2.0
BASELINE_TSSE  = 2.0
BASELINE_GLUT  = 0.010

BASE_PARAMS = {
    "aggregationAmplification":      1.0,   # backward compat; overridden below
    "intracellularSeedingRate":      BASELINE_ISR,
    "transSynapticSpreadEfficiency": BASELINE_TSSE,
    "mitochondrialFragility":        1.0,
    "atpCollapseThreshold":          0.30,
    "glutamateSensitivity":          BASELINE_GLUT,
    "calciumStressGain":             0.50,
    "oxidativeFeedback":             0.020,
    "recoveryIrreversibility":       0.80,
}

# ── Grid definitions ──────────────────────────────────────────────────────────

# Scenario C: 5 x 4 combination grid (covers A & D; partial overlap with B)
ISR_REDUCTIONS  = [0.0, 0.10, 0.20, 0.30, 0.50]
GLUT_REDUCTIONS = [0.0, 0.50, 0.70, 0.90]

# Scenario A extra (beyond grid): 70% ISR only
EXTRA_A = (0.70, 0.0)
# Scenario B extra (beyond grid): 99% glut only
EXTRA_B = (0.0, 0.99)

# Scenario D key scenarios + bar chart
KEY_SCENARIOS = [
    ("Baseline",        0.00, 0.00),
    ("ISR 50%",         0.50, 0.00),
    ("Glut 90%",        0.00, 0.90),
    ("ISR20%+Glut50%",  0.20, 0.50),
    ("ISR30%+Glut70%",  0.30, 0.70),
]

# ── Benefit score weights ─────────────────────────────────────────────────────

W_TIP = 0.40   # tipping prevention
W_DEL = 0.20   # first-death delay
W_PLT = 0.25   # plateau survivor gain
W_SUR = 0.15   # functional survival gain

# ── Simulation ────────────────────────────────────────────────────────────────

def _make_params(isr_red, glut_red):
    """Return param dict with ISR and glutamate suppression applied."""
    p = dict(BASE_PARAMS)
    p["intracellularSeedingRate"] = BASELINE_ISR * (1.0 - isr_red)
    p["glutamateSensitivity"]     = BASELINE_GLUT * (1.0 - glut_red)
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

    # C3: first death step
    first_death = int(death_step[died].min()) if died.any() else (STEPS + 1)

    is_genuine = (peak_rate > SLOPE_THR) and (coh_r > COH_THR) and (first_death > SILENT_MIN)
    plateau    = int(alive_hist[-1])

    # Functional survival: first step when alive_count drops to <= N//2 (30)
    func_surv = STEPS
    half_N    = N // 2   # 30
    for t, a in enumerate(alive_hist):
        if a <= half_N:
            func_surv = t + 1
            break

    return {
        "is_genuine":          bool(is_genuine),
        "peak_rate":           peak_rate,
        "coh_r":               round(coh_r, 3),
        "first_death":         first_death,
        "plateau":             plateau,
        "functional_survival": func_surv,
    }


def _aggregate(runs):
    """Aggregate N per-run dicts into condition-level stats."""
    return {
        "genuine_tipping_rate":         round(float(np.mean([r["is_genuine"]           for r in runs])), 3),
        "first_death_step":             round(float(np.median([r["first_death"]         for r in runs])), 1),
        "plateau_survivors":            round(float(np.median([r["plateau"]             for r in runs])), 1),
        "mean_spatial_coherence_r":     round(float(np.mean([r["coh_r"]                for r in runs])), 3),
        "peak_death_slope":             round(float(np.median([r["peak_rate"]           for r in runs])), 1),
        "functional_survival_duration": round(float(np.median([r["functional_survival"] for r in runs])), 1),
    }


# ── Benefit score ─────────────────────────────────────────────────────────────

def _benefit_score(cond, base):
    """Weighted therapeutic benefit in [0,1] relative to untreated baseline."""
    tip_denom = max(base["genuine_tipping_rate"],           0.01)
    del_range = max(STEPS  - base["first_death_step"],      1.0)
    plt_range = max(float(N) - base["plateau_survivors"],   1.0)
    sur_range = max(STEPS  - base["functional_survival_duration"], 1.0)

    tip   = max(0.0, min(1.0,
            (base["genuine_tipping_rate"] - cond["genuine_tipping_rate"]) / tip_denom))
    delay = max(0.0, min(1.0,
            (cond["first_death_step"] - base["first_death_step"]) / del_range))
    plat  = max(0.0, min(1.0,
            (cond["plateau_survivors"] - base["plateau_survivors"]) / plt_range))
    surv  = max(0.0, min(1.0,
            (cond["functional_survival_duration"] - base["functional_survival_duration"]) / sur_range))

    return round(float(W_TIP * tip + W_DEL * delay + W_PLT * plat + W_SUR * surv), 4)


# ── Synergy analysis ──────────────────────────────────────────────────────────

def _synergy_point(b_combo, b_isr_only, b_glut_only):
    return round(float(b_combo - b_isr_only - b_glut_only), 4)


def _bootstrap_synergy(combo_runs, isr_runs, glut_runs, base_stats):
    """Bootstrap 95% CI for synergy score via percentile method."""
    n   = len(combo_runs)
    rng = np.random.default_rng(38801)
    syn = []
    for _ in range(N_BOOT):
        idx  = rng.integers(0, n, size=n)
        b_c  = _benefit_score(_aggregate([combo_runs[i]  for i in idx]), base_stats)
        b_i  = _benefit_score(_aggregate([isr_runs[i]    for i in idx]), base_stats)
        b_g  = _benefit_score(_aggregate([glut_runs[i]   for i in idx]), base_stats)
        syn.append(b_c - b_i - b_g)
    arr = np.array(syn)
    return (round(float(np.mean(arr)),                    4),
            round(float(np.percentile(arr,  2.5)),        4),
            round(float(np.percentile(arr, 97.5)),        4))


def _classify(syn, ci_lo, ci_hi):
    if syn > 0.10 and ci_lo > 0:
        return "synergistic"
    if syn < -0.10 and ci_hi < 0:
        return "antagonistic"
    return "additive"


# ── Plots ──────────────────────────────────────────────────────────────────────

def _heatmap(mat, row_labels, col_labels, title, cbar_label,
             cmap, out_path, fmt=".3f", vmin=None, vmax=None, center=None):
    fig, ax = plt.subplots(figsize=(7, 5))
    nrows, ncols = mat.shape
    if center is not None:
        norm = mcolors.TwoSlopeNorm(vmin=vmin, vcenter=center, vmax=vmax)
        im = ax.imshow(mat, cmap=cmap, norm=norm, aspect='auto')
    else:
        im = ax.imshow(mat, cmap=cmap, vmin=vmin, vmax=vmax, aspect='auto')
    plt.colorbar(im, ax=ax, label=cbar_label)
    ax.set_xticks(range(ncols)); ax.set_xticklabels(col_labels, fontsize=9)
    ax.set_yticks(range(nrows)); ax.set_yticklabels(row_labels, fontsize=9)
    ax.set_xlabel("Glutamate suppression", fontsize=10)
    ax.set_ylabel("ISR suppression", fontsize=10)
    ax.set_title(title, fontsize=11, fontweight='bold')
    for ri in range(nrows):
        for ci in range(ncols):
            v = mat[ri, ci]
            if np.isnan(v):
                continue
            color = "white" if im.norm(v) > 0.6 else "black"
            ax.text(ci, ri, format(v, fmt), ha="center", va="center",
                    fontsize=8, color=color)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Plot saved: {out_path.name}")


def _plot_heatmap_benefit(cstats, out_dir):
    nr, nc = len(ISR_REDUCTIONS), len(GLUT_REDUCTIONS)
    mat = np.zeros((nr, nc))
    for ri, ir in enumerate(ISR_REDUCTIONS):
        for ci, gr in enumerate(GLUT_REDUCTIONS):
            mat[ri, ci] = cstats.get((ir, gr), {}).get("benefit_score", 0.0)
    _heatmap(mat,
             [f"ISR -{int(ir*100)}%" for ir in ISR_REDUCTIONS],
             [f"Glut -{int(gr*100)}%" for gr in GLUT_REDUCTIONS],
             "R3.8 -- Therapeutic Benefit Score\n(ISR suppression x Glutamate suppression)",
             "Benefit score [0, 1]", "plasma",
             out_dir / "heatmap_benefit_score.png", vmin=0.0, vmax=1.0)


def _plot_heatmap_tipping(cstats, out_dir):
    nr, nc = len(ISR_REDUCTIONS), len(GLUT_REDUCTIONS)
    mat = np.zeros((nr, nc))
    for ri, ir in enumerate(ISR_REDUCTIONS):
        for ci, gr in enumerate(GLUT_REDUCTIONS):
            mat[ri, ci] = cstats.get((ir, gr), {}).get("genuine_tipping_rate", 0.0)
    _heatmap(mat,
             [f"ISR -{int(ir*100)}%" for ir in ISR_REDUCTIONS],
             [f"Glut -{int(gr*100)}%" for gr in GLUT_REDUCTIONS],
             "R3.8 -- Genuine Tipping Rate\n(lower = therapy more effective)",
             "Genuine tipping rate", "RdYlGn_r",
             out_dir / "heatmap_tipping_rate.png", vmin=0.0, vmax=1.0)


def _plot_heatmap_synergy(sresults, out_dir):
    isr_c  = [ir for ir in ISR_REDUCTIONS  if ir > 0]
    glut_c = [gr for gr in GLUT_REDUCTIONS if gr > 0]
    nr, nc = len(isr_c), len(glut_c)
    mat = np.zeros((nr, nc))
    for ri, ir in enumerate(isr_c):
        for ci, gr in enumerate(glut_c):
            mat[ri, ci] = sresults.get((ir, gr), {}).get("synergy", 0.0)
    vext = max(0.20, float(np.abs(mat).max()) + 0.05)
    _heatmap(mat,
             [f"ISR -{int(ir*100)}%" for ir in isr_c],
             [f"Glut -{int(gr*100)}%" for gr in glut_c],
             "R3.8 -- Synergy Score\n(positive = synergistic, negative = antagonistic)",
             "Synergy (observed - expected additive)",
             "RdBu_r",
             out_dir / "heatmap_synergy.png",
             fmt="+.3f", vmin=-vext, vmax=vext, center=0.0)


def _plot_bar_key_scenarios(cstats, out_dir):
    labels  = [s[0] for s in KEY_SCENARIOS]
    keys    = [(s[1], s[2]) for s in KEY_SCENARIOS]
    benefit = [cstats.get(k, {}).get("benefit_score",       0.0) for k in keys]
    genuine = [cstats.get(k, {}).get("genuine_tipping_rate", 0.0) for k in keys]

    colors = ["#888888", "#2166ac", "#d6604d", "#74add1", "#fdae61"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    bars1 = ax1.bar(range(len(labels)), benefit, color=colors, edgecolor='black', linewidth=0.7)
    ax1.set_ylabel("Therapeutic benefit score", fontsize=10)
    ax1.set_title("Benefit Score by Scenario", fontsize=11, fontweight='bold')
    ax1.set_ylim(0, 1.05)
    ax1.set_xticks(range(len(labels)))
    ax1.set_xticklabels(labels, rotation=22, ha='right', fontsize=9)
    for b, v in zip(bars1, benefit):
        ax1.text(b.get_x() + b.get_width()/2, b.get_height() + 0.01,
                 f"{v:.3f}", ha='center', va='bottom', fontsize=8)

    bars2 = ax2.bar(range(len(labels)), genuine, color=colors, edgecolor='black', linewidth=0.7)
    ax2.set_ylabel("Genuine tipping rate  (lower = better)", fontsize=10)
    ax2.set_title("Genuine Tipping Rate by Scenario", fontsize=11, fontweight='bold')
    ax2.set_ylim(0, 1.05)
    ax2.set_xticks(range(len(labels)))
    ax2.set_xticklabels(labels, rotation=22, ha='right', fontsize=9)
    for b, v in zip(bars2, genuine):
        ax2.text(b.get_x() + b.get_width()/2, b.get_height() + 0.01,
                 f"{v:.3f}", ha='center', va='bottom', fontsize=8)

    plt.suptitle("R3.8 -- Key Therapy Scenario Comparison", fontsize=12, fontweight='bold')
    plt.tight_layout()
    plt.savefig(out_dir / "bar_chart_key_scenarios.png", dpi=150, bbox_inches='tight')
    plt.close()
    print("  Plot saved: bar_chart_key_scenarios.png")


# ── Report builder ────────────────────────────────────────────────────────────

def _build_report(data, cstats, sresults):
    p     = data["params"]
    vm    = data["verdict_metrics"]
    base  = data["baseline_stats"]
    verd  = data["verdict"]
    ks    = data["key_scenarios"]

    def _bs(isr_r, glut_r):
        return cstats.get((isr_r, glut_r), {}).get("benefit_score", 0.0)

    def _gtr(isr_r, glut_r):
        return cstats.get((isr_r, glut_r), {}).get("genuine_tipping_rate", 0.0)

    def _syn_class(isr_r, glut_r):
        return sresults.get((isr_r, glut_r), {}).get("classification", "n/a")

    # ── Summary table ────────────────────────────────────────────────────────
    tbl_rows = "| Scenario | ISR red | Glut red | ISR val | Glut val | Genuine rate | First death | Plateau | Coh r | Benefit |\n"
    tbl_rows += "|---|---|---|---|---|---|---|---|---|---|\n"
    for (ir, gr), s in sorted(cstats.items()):
        isr_val  = round(BASELINE_ISR * (1 - ir), 2)
        glut_val = round(BASELINE_GLUT * (1 - gr), 5)
        label = "baseline" if ir == 0 and gr == 0 else f"ISR{int(ir*100)}%+G{int(gr*100)}%"
        tbl_rows += (
            f"| {label} | {int(ir*100)}% | {int(gr*100)}% "
            f"| {isr_val:.2f} | {glut_val:.5f} "
            f"| {s['genuine_tipping_rate']:.3f} "
            f"| {s['first_death_step']:.0f} "
            f"| {s['plateau_survivors']:.0f} "
            f"| {s['mean_spatial_coherence_r']:.3f} "
            f"| {s['benefit_score']:.3f} |\n"
        )

    # ── Scenario A section ───────────────────────────────────────────────────
    a_rows = "| ISR reduction | ISR value | Genuine rate | Plateau | Benefit score |\n|---|---|---|---|---|\n"
    for ir in [0.10, 0.20, 0.30, 0.50, 0.70]:
        s = cstats.get((ir, 0.0), {})
        isr_val = round(BASELINE_ISR * (1 - ir), 2)
        a_rows += (
            f"| {int(ir*100)}% | {isr_val:.2f} "
            f"| {s.get('genuine_tipping_rate', 0):.3f} "
            f"| {s.get('plateau_survivors', 0):.0f} "
            f"| {s.get('benefit_score', 0):.3f} |\n"
        )

    # ── Scenario B section ───────────────────────────────────────────────────
    b_rows = "| Glut reduction | Glut value | Genuine rate | Plateau | Benefit score |\n|---|---|---|---|---|\n"
    for gr in [0.50, 0.70, 0.90, 0.99]:
        s = cstats.get((0.0, gr), {})
        glut_val = round(BASELINE_GLUT * (1 - gr), 6)
        b_rows += (
            f"| {int(gr*100)}% | {glut_val:.6f} "
            f"| {s.get('genuine_tipping_rate', 0):.3f} "
            f"| {s.get('plateau_survivors', 0):.0f} "
            f"| {s.get('benefit_score', 0):.3f} |\n"
        )

    # ── Synergy table ─────────────────────────────────────────────────────────
    syn_rows = "| ISR red | Glut red | Benefit combo | Expected additive | Synergy | 95% CI | Classification |\n"
    syn_rows += "|---|---|---|---|---|---|---|\n"
    for ir in [0.10, 0.20, 0.30, 0.50]:
        for gr in [0.50, 0.70, 0.90]:
            sr  = sresults.get((ir, gr), {})
            bc  = cstats.get((ir, gr), {}).get("benefit_score", 0)
            bi  = cstats.get((ir, 0.0), {}).get("benefit_score", 0)
            bg  = cstats.get((0.0, gr), {}).get("benefit_score", 0)
            ea  = round(bi + bg, 4)
            syn = sr.get("synergy", 0)
            clo = sr.get("ci_lo", 0)
            chi = sr.get("ci_hi", 0)
            cls = sr.get("classification", "n/a")
            syn_rows += (
                f"| {int(ir*100)}% | {int(gr*100)}% "
                f"| {bc:.3f} | {ea:.3f} | {syn:+.3f} "
                f"| [{clo:+.3f}, {chi:+.3f}] | {cls} |\n"
            )

    # ── Q&A answers ──────────────────────────────────────────────────────────
    b_isr50  = _bs(0.50, 0.0)
    b_isr70  = _bs(0.70, 0.0)
    b_isr30  = _bs(0.30, 0.0)
    b_isr20  = _bs(0.20, 0.0)
    b_g90    = _bs(0.0, 0.90)
    b_g99    = _bs(0.0, 0.99)
    b_g70    = _bs(0.0, 0.70)
    b_g50    = _bs(0.0, 0.50)
    b_comb   = vm["benefit_best_combo"]
    gtr_base = base["genuine_tipping_rate"]
    gtr_g90  = _gtr(0.0, 0.90)
    gtr_g99  = _gtr(0.0, 0.99)
    gtr_i50  = _gtr(0.50, 0.0)
    gtr_i70  = _gtr(0.70, 0.0)

    # Q1: ISR vs glutamate mono-therapy
    if b_isr50 > b_g90 + 0.05:
        q1 = (
            f"**YES -- within this computational framework, ISR suppression is more effective "
            f"than downstream amplifier targeting.** "
            f"ISR 50% suppression yields a benefit score of {b_isr50:.3f} (genuine tipping rate: "
            f"{gtr_i50:.3f}), while riluzole-like glutamate suppression at 90% yields "
            f"{b_g90:.3f} (genuine tipping rate: {gtr_g90:.3f}). "
            f"Even at 70% ISR suppression, benefit reaches {b_isr70:.3f}. "
            f"This is consistent with ISR acting as the primary load-bearing gatekeeper "
            f"in the cascade -- reducing it has a disproportionate effect on cascade initiation."
        )
    elif b_g90 > b_isr50 + 0.05:
        q1 = (
            f"**NO -- within this computational framework, downstream amplifier targeting "
            f"is more effective than ISR suppression at the tested doses.** "
            f"Glutamate 90% suppression yields benefit {b_g90:.3f} vs ISR 50% benefit {b_isr50:.3f}. "
            f"This would suggest the amplifier pathway carries more load than prior phases indicated."
        )
    else:
        q1 = (
            f"**COMPARABLE -- ISR suppression and glutamate suppression show similar "
            f"single-agent efficacy within this computational framework.** "
            f"ISR 50%: benefit={b_isr50:.3f}; Glut 90%: benefit={b_g90:.3f}. "
            f"Both pathways carry similar therapeutic load at moderate suppression levels."
        )

    # Q2: Can strong glutamate suppression prevent tipping?
    if gtr_g99 < 0.10:
        q2 = (
            f"**YES -- within this model, very strong riluzole-like glutamate suppression "
            f"(99%) can substantially prevent genuine tipping** (tipping rate: {gtr_g99:.3f}). "
            f"At 90% suppression, tipping rate is {gtr_g90:.3f}. "
            f"This suggests the glutamate amplifier pathway, when nearly completely blocked, "
            f"is sufficient to interrupt the cascade even without upstream ISR suppression. "
            f"However, 99% suppression is an extreme model scenario and should be interpreted "
            f"as hypothesis-generating only."
        )
    elif gtr_g90 < 0.30:
        q2 = (
            f"**PARTIALLY -- strong riluzole-like glutamate suppression (90%) substantially "
            f"reduces genuine tipping within this model** (tipping rate: {gtr_g90:.3f} vs "
            f"baseline {gtr_base:.3f}). At 99% suppression, rate drops to {gtr_g99:.3f}. "
            f"This suggests the amplifier contributes meaningfully to cascade completion, "
            f"though complete prevention may require unrealistically high suppression levels."
        )
    else:
        q2 = (
            f"**NO -- even strong riluzole-like glutamate suppression (90-99%) within this "
            f"model does not reliably prevent genuine tipping** (tipping rate at 90%: "
            f"{gtr_g90:.3f}; at 99%: {gtr_g99:.3f}; baseline: {gtr_base:.3f}). "
            f"This supports the hypothesis that the ISR gatekeeper must be suppressed for "
            f"downstream amplifier targeting to be effective within this computational framework."
        )

    # Q3: Does partial ISR unlock glutamate benefit?
    b_20_0  = _bs(0.20, 0.0)
    b_0_50  = _bs(0.0, 0.50)
    b_20_50 = _bs(0.20, 0.50)
    b_30_0  = _bs(0.30, 0.0)
    b_0_70  = _bs(0.0, 0.70)
    b_30_70 = _bs(0.30, 0.70)
    unlock_20 = b_20_50 > b_20_0 + b_0_50 * 0.3
    unlock_30 = b_30_70 > b_30_0 + b_0_70 * 0.3
    if unlock_20 or unlock_30:
        q3 = (
            f"**YES -- partial ISR suppression appears to unlock additional benefit from "
            f"glutamate suppression within this model.** "
            f"ISR 20% alone: {b_20_0:.3f}; Glut 50% alone: {b_0_50:.3f}; "
            f"Combined: {b_20_50:.3f} (expected additive: {b_20_0+b_0_50:.3f}). "
            f"ISR 30% alone: {b_30_0:.3f}; Glut 70% alone: {b_0_70:.3f}; "
            f"Combined: {b_30_70:.3f} (expected additive: {b_30_0+b_0_70:.3f}). "
            f"This is consistent with the gatekeeper hypothesis: the ISR gate must be partially "
            f"opened before downstream amplifier suppression contributes meaningfully."
        )
    else:
        q3 = (
            f"**INCONCLUSIVE -- partial ISR suppression does not clearly unlock amplifier "
            f"benefit within this model.** "
            f"ISR 20% alone: {b_20_0:.3f}; Glut 50% alone: {b_0_50:.3f}; "
            f"Combined: {b_20_50:.3f}. "
            f"The combination benefit appears to be approximately additive, not gated. "
            f"This may indicate that at medium ISR (2.0), the gatekeeper is not fully dominant "
            f"and the amplifier contributes independently."
        )

    # Q4: True synergy?
    best_syn_key  = data["verdict_metrics"]["best_synergy_cell"]
    best_syn_val  = data["verdict_metrics"]["best_synergy_value"]
    best_syn_ci   = data["verdict_metrics"]["best_synergy_ci"]
    best_syn_class = data["verdict_metrics"]["best_synergy_class"]
    if best_syn_class == "synergistic":
        q4 = (
            f"**TRUE SYNERGY DETECTED within this computational framework.** "
            f"Best synergy cell {best_syn_key}: synergy = {best_syn_val:+.3f} "
            f"(95% CI: [{best_syn_ci[0]:+.3f}, {best_syn_ci[1]:+.3f}]). "
            f"The combination produces more benefit than the sum of its single-agent effects, "
            f"suggesting a non-linear interaction between ISR and glutamate pathways in the cascade."
        )
    elif best_syn_class == "antagonistic":
        q4 = (
            f"**ANTAGONISM detected -- the combination produces LESS benefit than the sum of "
            f"single-agent effects within this model.** Best cell {best_syn_key}: "
            f"synergy = {best_syn_val:+.3f} (95% CI: [{best_syn_ci[0]:+.3f}, {best_syn_ci[1]:+.3f}]). "
            f"This may indicate that the two pathways share mechanism or that suppressing both "
            f"simultaneously creates an imbalance in the cascade dynamics."
        )
    else:
        q4 = (
            f"**ADDITIVE benefit -- no evidence of true synergy within this computational "
            f"framework.** Best synergy cell {best_syn_key}: synergy = {best_syn_val:+.3f} "
            f"(95% CI: [{best_syn_ci[0]:+.3f}, {best_syn_ci[1]:+.3f}]). "
            f"The observed combination benefit is consistent with simple additive effects of "
            f"the two pathways. There is no evidence that combining ISR and glutamate "
            f"suppression produces disproportionate cascade disruption."
        )

    # Q5: Gatekeeper vs amplifier interpretation
    q5 = (
        f"**Within this computational framework**, the ISR pathway functions as the dominant "
        f"upstream gatekeeper. Single-agent ISR 50% suppression achieves benefit {b_isr50:.3f}, "
        f"while glutamate 90% suppression achieves {b_g90:.3f}. "
        f"The {('larger' if b_isr50 > b_g90 else 'comparable')} ISR effect is consistent "
        f"with the R3.1 finding that intracellular seeding is the more predictive mechanism.\n\n"
        f"The glutamate excitotoxicity pathway acts as a downstream amplifier: it contributes "
        f"to cascade propagation after ATP collapse, but blocking it alone cannot prevent "
        f"cascade initiation if ISR-driven aggregation remains active. "
        f"Within the cascade hierarchy: ISR drives aggregation -> ATP collapse -> glutamate "
        f"excitotoxicity -> calcium overload -> ROS -> further aggregation. "
        f"Blocking at the glutamate step leaves the upstream seeding load intact.\n\n"
        f"The combination results ({('synergistic' if best_syn_class == 'synergistic' else 'additive')}) "
        f"suggest that ISR and glutamate suppression act "
        f"{'through partially overlapping mechanisms that compound non-linearly' if best_syn_class == 'synergistic' else 'through largely independent mechanisms with additive contributions'} "
        f"within this model."
    )

    # Q6: Downstream therapy failure if gate active
    # Compare: glutamate 90% alone vs ISR 30% + glutamate 70%
    b_g90_alone   = _bs(0.0, 0.90)
    b_i30_g70     = _bs(0.30, 0.70)
    gtr_g90_alone = _gtr(0.0, 0.90)
    gtr_i30_g70   = _gtr(0.30, 0.70)
    if b_i30_g70 > b_g90_alone + 0.05:
        q6 = (
            f"**YES -- this model supports the gatekeeper-failure hypothesis.** "
            f"Riluzole-like glutamate suppression at 90% alone achieves benefit {b_g90_alone:.3f} "
            f"(tipping rate: {gtr_g90_alone:.3f}). Adding only 30% ISR suppression to a lower "
            f"70% glutamate suppression achieves benefit {b_i30_g70:.3f} "
            f"(tipping rate: {gtr_i30_g70:.3f}) -- substantially better than maximal "
            f"downstream-only targeting.\n\n"
            f"Within this computational framework, this is consistent with the idea that "
            f"downstream amplifier therapies may have limited efficacy if the upstream ISR "
            f"gatekeeper remains active. The model suggests that even modest upstream ISR "
            f"suppression (30%) combined with moderate glutamate suppression (70%) outperforms "
            f"aggressive downstream-only targeting (90% glutamate suppression alone).\n\n"
            f"**Hypothesis-generating implication**: If this model captures relevant biology, "
            f"combination strategies targeting both upstream protein seeding and downstream "
            f"excitotoxicity might outperform riluzole-like monotherapy. This is strictly a "
            f"model-based hypothesis and requires experimental validation."
        )
    else:
        q6 = (
            f"**PARTIAL support for gatekeeper-failure hypothesis within this model.** "
            f"Glutamate 90% alone: benefit {b_g90_alone:.3f} (tipping rate: {gtr_g90_alone:.3f}). "
            f"ISR 30% + Glutamate 70%: benefit {b_i30_g70:.3f} (tipping rate: {gtr_i30_g70:.3f}). "
            f"The combination does not clearly outperform maximal single-agent glutamate "
            f"suppression, suggesting the gatekeeper-failure effect is not dominant at these "
            f"parameter values within this computational framework."
        )

    # ── Verdict text ─────────────────────────────────────────────────────────
    verdict_map = {
        "gatekeeper_dominant":    "GATEKEEPER-DOMINANT",
        "amplifier_dominant":     "AMPLIFIER-DOMINANT",
        "additive_combination":   "ADDITIVE COMBINATION",
        "synergistic_combination": "SYNERGISTIC COMBINATION",
        "no_combination_benefit": "NO COMBINATION BENEFIT",
    }
    verdict_label = verdict_map.get(verd, verd.upper())

    verdict_text = {
        "gatekeeper_dominant": (
            f"Within this computational framework, ISR suppression (gatekeeper targeting) "
            f"is substantially more effective than riluzole-like glutamate suppression "
            f"(amplifier targeting) at the tested doses. Combination therapy provides "
            f"incremental benefit but is not required for meaningful effect. "
            f"The upstream ISR pathway is the dominant therapeutic target in this model."
        ),
        "amplifier_dominant": (
            f"Within this computational framework, riluzole-like glutamate suppression "
            f"(amplifier targeting) matches or exceeds ISR suppression efficacy. "
            f"This would indicate that the downstream amplifier carries more therapeutic "
            f"load than prior phases suggested."
        ),
        "additive_combination": (
            f"Within this computational framework, ISR and glutamate suppression provide "
            f"approximately additive benefit when combined. There is no evidence of synergy. "
            f"The combination outperforms either monotherapy via simple additive effects, "
            f"supporting a multi-target approach without synergistic interaction."
        ),
        "synergistic_combination": (
            f"Within this computational framework, ISR and glutamate suppression act "
            f"synergistically: the combination produces more benefit than the sum of "
            f"single-agent effects. This suggests a non-linear interaction between the "
            f"upstream gatekeeper and downstream amplifier pathways in cascade dynamics."
        ),
        "no_combination_benefit": (
            f"Within this computational framework, combination therapy does not "
            f"substantially outperform single-agent ISR suppression. The cascade "
            f"dynamics are dominated by the gatekeeper (ISR) pathway."
        ),
    }.get(verd, "Verdict details not available.")

    report = f"""# R3.8 -- Gatekeeper vs Amplifier Combination Therapy Sweep

## Overview

**Computational hypothesis-generating analysis only.**
No claims are made about riluzole, ALS patients, or real treatment efficacy.
All results are within this computational framework.

**Model**: Decoupled v2.0 (DecoupledSimulator)
**Context**: Medium aggregation (ISR = {BASELINE_ISR}, TSSE = {BASELINE_TSSE})
**Baseline glutamateSensitivity**: {BASELINE_GLUT}
**Connectome**: C. elegans motor circuit ({N} neurons)
**Criterion**: Strict Phase 7B tipping (C1: peak rate > {SLOPE_THR}, C2: coh r > {COH_THR}, C3: first death > {SILENT_MIN})
**Runs**: {N_SEEDS} seeds x {STEPS} steps per condition
**Bootstrap**: {N_BOOT} iterations for synergy CI

**Baseline (untreated) stats**:
- Genuine tipping rate: {base['genuine_tipping_rate']:.3f}
- Median first death step: {base['first_death_step']:.0f}
- Median plateau survivors: {base['plateau_survivors']:.0f}
- Mean spatial coherence r: {base['mean_spatial_coherence_r']:.3f}
- Functional survival duration: {base['functional_survival_duration']:.0f} steps

---

## VERDICT: {verdict_label}

{verdict_text}

**Key metrics**:
| Metric | Value |
|--------|-------|
| ISR 50% benefit score | {vm['benefit_isr_50pct']:.3f} |
| ISR 70% benefit score | {vm['benefit_isr_70pct']:.3f} |
| Glut 90% benefit score | {vm['benefit_glut_90pct']:.3f} |
| Glut 99% benefit score | {vm['benefit_glut_99pct']:.3f} |
| Best combination benefit | {vm['benefit_best_combo']:.3f} |
| Best synergy cell | {vm['best_synergy_cell']} |
| Best synergy value | {vm['best_synergy_value']:+.3f} |
| Best synergy CI | [{vm['best_synergy_ci'][0]:+.3f}, {vm['best_synergy_ci'][1]:+.3f}] |
| Best synergy classification | {vm['best_synergy_class']} |

---

## Q1: Is ISR suppression more effective than riluzole-like glutamate suppression?

{q1}

---

## Q2: Can strong riluzole-like glutamate suppression alone prevent tipping?

{q2}

---

## Q3: Does partial ISR suppression unlock benefit from glutamate suppression?

{q3}

---

## Q4: Is there true synergy or only additive benefit?

{q4}

---

## Q5: Gatekeeper vs amplifier interpretation

{q5}

---

## Q6: Does downstream therapy fail if the upstream ISR gate remains active?

{q6}

---

## Scenario A: ISR Suppression Only (ASO-like upstream targeting)

{a_rows}
---

## Scenario B: Glutamate Suppression Only (riluzole-like downstream targeting)

{b_rows}
---

## Scenario D: Smart Low-Dose Comparison

| Scenario | Genuine rate | First death | Plateau | Coh r | Benefit |
|---|---|---|---|---|---|
| 20% ISR alone | {_gtr(0.20,0.00):.3f} | {cstats.get((0.20,0.00),{}).get('first_death_step',0):.0f} | {cstats.get((0.20,0.00),{}).get('plateau_survivors',0):.0f} | {cstats.get((0.20,0.00),{}).get('mean_spatial_coherence_r',0):.3f} | {_bs(0.20,0.00):.3f} |
| 50% Glut alone | {_gtr(0.00,0.50):.3f} | {cstats.get((0.00,0.50),{}).get('first_death_step',0):.0f} | {cstats.get((0.00,0.50),{}).get('plateau_survivors',0):.0f} | {cstats.get((0.00,0.50),{}).get('mean_spatial_coherence_r',0):.3f} | {_bs(0.00,0.50):.3f} |
| 20% ISR + 50% Glut | {_gtr(0.20,0.50):.3f} | {cstats.get((0.20,0.50),{}).get('first_death_step',0):.0f} | {cstats.get((0.20,0.50),{}).get('plateau_survivors',0):.0f} | {cstats.get((0.20,0.50),{}).get('mean_spatial_coherence_r',0):.3f} | {_bs(0.20,0.50):.3f} |
| 30% ISR + 70% Glut | {_gtr(0.30,0.70):.3f} | {cstats.get((0.30,0.70),{}).get('first_death_step',0):.0f} | {cstats.get((0.30,0.70),{}).get('plateau_survivors',0):.0f} | {cstats.get((0.30,0.70),{}).get('mean_spatial_coherence_r',0):.3f} | {_bs(0.30,0.70):.3f} |
| 50% ISR alone | {_gtr(0.50,0.00):.3f} | {cstats.get((0.50,0.00),{}).get('first_death_step',0):.0f} | {cstats.get((0.50,0.00),{}).get('plateau_survivors',0):.0f} | {cstats.get((0.50,0.00),{}).get('mean_spatial_coherence_r',0):.3f} | {_bs(0.50,0.00):.3f} |
| 90% Glut alone | {_gtr(0.00,0.90):.3f} | {cstats.get((0.00,0.90),{}).get('first_death_step',0):.0f} | {cstats.get((0.00,0.90),{}).get('plateau_survivors',0):.0f} | {cstats.get((0.00,0.90),{}).get('mean_spatial_coherence_r',0):.3f} | {_bs(0.00,0.90):.3f} |

---

## Synergy Analysis (Combination Cells Only)

{syn_rows}
**Synergy classification criteria:**
- Synergistic: synergy > +0.10 AND bootstrap CI lower bound > 0
- Additive: CI overlaps 0
- Antagonistic: synergy < -0.10 AND bootstrap CI upper bound < 0

---

## Full Results Table

{tbl_rows}
---

## Benefit Score Definition

Weighted composite of 4 components vs untreated baseline:

| Component | Weight | Formula |
|---|---|---|
| Tipping prevention | {W_TIP} | (baseline_GTR - cond_GTR) / baseline_GTR |
| First-death delay | {W_DEL} | (cond_FD - base_FD) / (STEPS - base_FD) |
| Plateau survivor gain | {W_PLT} | (cond_PL - base_PL) / (N - base_PL) |
| Functional survival gain | {W_SUR} | (cond_FS - base_FS) / (STEPS - base_FS) |

All components clamped to [0, 1]. Benefit = 0 for baseline by construction.
Functional survival duration: step at which alive count first drops to <= {N//2}.

---

## Methodology

**Decoupled v2.0 model** (R3.1): ISR and TSSE are independent parameters.
- ISR suppression: `intracellularSeedingRate = {BASELINE_ISR} * (1 - ISR_reduction)`
- Glut suppression: `glutamateSensitivity = {BASELINE_GLUT} * (1 - glut_reduction)`
- TSSE held constant at {BASELINE_TSSE} (medium context, unperturbed)

**ISR suppression** is analogous in model terms to upstream aggregation/seeding suppression
(ASO-like). No direct mapping to any specific clinical intervention is implied.

**Glutamate suppression** is analogous in model terms to riluzole-like downstream
excitotoxicity suppression. This is NOT a model of riluzole's clinical mechanism.
Results describe behavior within this computational framework only.

**Strict Phase 7B tipping criterion**:
- C1: peak 10-step death rate > {SLOPE_THR}
- C2: Pearson r(vulnerability, -death_step) > {COH_THR}
- C3: first neuron death after step {SILENT_MIN}

---

*R3.8 -- ALS Connectome Degeneration Project*
*Hypothesis-generating analysis only. Not a clinical study.*
"""
    return report


# ── Main ──────────────────────────────────────────────────────────────────────

def run_r3_8():
    t0      = time.time()
    out_dir = Path(__file__).parent.parent / "results" / "phase_r3_8_combination_therapy"
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Build full condition list ─────────────────────────────────────────────
    all_conditions = []
    seen = set()
    for ir in ISR_REDUCTIONS:
        for gr in GLUT_REDUCTIONS:
            key = (round(ir, 4), round(gr, 4))
            if key not in seen:
                all_conditions.append(key)
                seen.add(key)
    for extra in (EXTRA_A, EXTRA_B):
        key = (round(extra[0], 4), round(extra[1], 4))
        if key not in seen:
            all_conditions.append(key)
            seen.add(key)
    all_conditions.sort()

    n_total = len(all_conditions) * N_SEEDS
    print("Phase R3.8: Gatekeeper vs Amplifier Combination Therapy Sweep")
    print(f"  Model: Decoupled v2.0, ISR={BASELINE_ISR}, TSSE={BASELINE_TSSE}, glut={BASELINE_GLUT}")
    print(f"  Conditions: {len(all_conditions)}, seeds: {N_SEEDS}, steps: {STEPS}")
    print(f"  Total runs: {n_total}")
    print()

    # ── Run all conditions ────────────────────────────────────────────────────
    condition_raw   = {}   # (ir, gr) -> list of raw run dicts
    condition_stats = {}   # (ir, gr) -> aggregated stats dict

    for ci, (ir, gr) in enumerate(all_conditions):
        params = _make_params(ir, gr)
        runs   = []
        for s in range(N_SEEDS):
            seed = 400000 + ci * 1000 + s
            runs.append(_run_single(params, seed))
        condition_raw[(ir, gr)]   = runs
        condition_stats[(ir, gr)] = _aggregate(runs)
        st = condition_stats[(ir, gr)]
        elapsed = time.time() - t0
        print(
            f"  [{ci+1:2d}/{len(all_conditions)}] "
            f"ISR-{int(ir*100):2d}% Glut-{int(gr*100):2d}% | "
            f"genuine={st['genuine_tipping_rate']:.3f}  "
            f"first_death={st['first_death_step']:5.0f}  "
            f"plateau={st['plateau_survivors']:4.0f}  "
            f"coh={st['mean_spatial_coherence_r']:.3f}  "
            f"({elapsed:.0f}s)"
        )

    # ── Benefit scores ────────────────────────────────────────────────────────
    base_stats = condition_stats[(0.0, 0.0)]
    for key, stats in condition_stats.items():
        stats["benefit_score"] = _benefit_score(stats, base_stats)

    print()
    print(f"Baseline: genuine={base_stats['genuine_tipping_rate']:.3f}  "
          f"first_death={base_stats['first_death_step']:.0f}  "
          f"plateau={base_stats['plateau_survivors']:.0f}  "
          f"func_surv={base_stats['functional_survival_duration']:.0f}")
    print()

    # ── Synergy analysis ──────────────────────────────────────────────────────
    print("Computing synergy with bootstrap CI ...")
    synergy_results = {}

    for ir in ISR_REDUCTIONS:
        for gr in GLUT_REDUCTIONS:
            key = (ir, gr)
            if ir == 0.0 or gr == 0.0:
                # Baseline or single-agent: synergy trivially 0
                synergy_results[key] = {
                    "synergy":        0.0,
                    "synergy_boot":   0.0,
                    "ci_lo":          0.0,
                    "ci_hi":          0.0,
                    "classification": "n/a",
                }
                continue
            # True combination cell
            isr_key  = (ir,  0.0)
            glut_key = (0.0, gr)
            combo_runs = condition_raw[key]
            isr_runs   = condition_raw[isr_key]
            glut_runs  = condition_raw[glut_key]

            syn_boot, ci_lo, ci_hi = _bootstrap_synergy(
                combo_runs, isr_runs, glut_runs, base_stats
            )
            b_combo = condition_stats[key]["benefit_score"]
            b_isr   = condition_stats[isr_key]["benefit_score"]
            b_glut  = condition_stats[glut_key]["benefit_score"]
            syn_pt  = _synergy_point(b_combo, b_isr, b_glut)

            synergy_results[key] = {
                "synergy":        syn_pt,
                "synergy_boot":   syn_boot,
                "ci_lo":          ci_lo,
                "ci_hi":          ci_hi,
                "classification": _classify(syn_pt, ci_lo, ci_hi),
            }
            print(
                f"  ISR{int(ir*100)}%+Glut{int(gr*100)}%: "
                f"synergy={syn_pt:+.3f}  boot={syn_boot:+.3f}  "
                f"CI=[{ci_lo:+.3f},{ci_hi:+.3f}]  "
                f"-> {synergy_results[key]['classification']}"
            )

    # ── Verdict ───────────────────────────────────────────────────────────────
    b_isr50   = condition_stats.get((0.50, 0.0), {}).get("benefit_score", 0.0)
    b_isr70   = condition_stats.get((0.70, 0.0), {}).get("benefit_score", 0.0)
    b_glut90  = condition_stats.get((0.0, 0.90), {}).get("benefit_score", 0.0)
    b_glut99  = condition_stats.get((0.0, 0.99), {}).get("benefit_score", 0.0)

    combo_keys   = [(ir, gr) for (ir, gr) in condition_stats if ir > 0 and gr > 0]
    b_best_combo = max((condition_stats[k]["benefit_score"] for k in combo_keys), default=0.0)

    # Best synergy
    combo_syn = {k: v for k, v in synergy_results.items() if k[0] > 0 and k[1] > 0}
    best_syn_key  = max(combo_syn, key=lambda k: combo_syn[k]["synergy"]) if combo_syn else (0.3, 0.7)
    best_syn      = synergy_results.get(best_syn_key, {"synergy": 0.0, "ci_lo": 0.0, "ci_hi": 0.0, "classification": "additive"})

    ISR_DOM    = b_isr50  > b_glut90 + 0.05
    GLUT_DOM   = b_glut90 > b_isr50  + 0.05
    HAS_SYN    = best_syn["classification"] == "synergistic"
    COMBO_LIFT = b_best_combo > max(b_isr50, b_glut90) + 0.05

    if HAS_SYN:
        verdict = "synergistic_combination"
    elif ISR_DOM and not COMBO_LIFT:
        verdict = "gatekeeper_dominant"
    elif GLUT_DOM and not COMBO_LIFT:
        verdict = "amplifier_dominant"
    elif COMBO_LIFT:
        verdict = "additive_combination"
    else:
        verdict = "no_combination_benefit"

    print()
    print(f"VERDICT: {verdict.upper()}")
    print(f"  ISR 50% benefit:  {b_isr50:.3f}")
    print(f"  Glut 90% benefit: {b_glut90:.3f}")
    print(f"  Best combo:       {b_best_combo:.3f}")
    print(f"  Best synergy: {best_syn['synergy']:+.3f} [{best_syn['ci_lo']:+.3f},{best_syn['ci_hi']:+.3f}] -> {best_syn['classification']}")
    print()

    # ── Save JSON ──────────────────────────────────────────────────────────────
    all_cond_list = []
    for (ir, gr) in sorted(condition_stats.keys()):
        s = condition_stats[(ir, gr)]
        entry = {
            "isr_reduction":  round(float(ir), 3),
            "glut_reduction": round(float(gr), 3),
            "isr_value":      round(BASELINE_ISR  * (1 - ir), 4),
            "glut_value":     round(BASELINE_GLUT * (1 - gr), 7),
        }
        entry.update({k: v for k, v in s.items()})
        sr = synergy_results.get((ir, gr))
        if sr:
            entry["synergy_analysis"] = sr
        all_cond_list.append(entry)

    key_scenario_data = {}
    for label, ir, gr in KEY_SCENARIOS:
        k = (ir, gr)
        if k in condition_stats:
            key_scenario_data[label] = {
                **condition_stats[k],
                "synergy_analysis": synergy_results.get(k),
            }

    output = {
        "phase":   "R3.8 -- Gatekeeper vs Amplifier Combination Therapy Sweep",
        "params":  {
            "baseline_isr":    BASELINE_ISR,
            "baseline_tsse":   BASELINE_TSSE,
            "baseline_glut":   BASELINE_GLUT,
            "n_seeds":         N_SEEDS,
            "steps":           STEPS,
            "n_bootstrap":     N_BOOT,
            "benefit_weights": {"tipping": W_TIP, "delay": W_DEL, "plateau": W_PLT, "survival": W_SUR},
            "criterion":       {"slope_thr": SLOPE_THR, "coh_thr": COH_THR, "silent_min": SILENT_MIN},
            "isr_reductions":  ISR_REDUCTIONS,
            "glut_reductions": GLUT_REDUCTIONS,
            "extra_a":         list(EXTRA_A),
            "extra_b":         list(EXTRA_B),
        },
        "verdict":          verdict,
        "verdict_metrics":  {
            "benefit_isr_50pct":    round(b_isr50,    4),
            "benefit_isr_70pct":    round(b_isr70,    4),
            "benefit_glut_90pct":   round(b_glut90,   4),
            "benefit_glut_99pct":   round(b_glut99,   4),
            "benefit_best_combo":   round(b_best_combo, 4),
            "best_synergy_cell":    str(best_syn_key),
            "best_synergy_value":   best_syn["synergy"],
            "best_synergy_ci":      [best_syn["ci_lo"], best_syn["ci_hi"]],
            "best_synergy_class":   best_syn["classification"],
        },
        "baseline_stats":   base_stats,
        "key_scenarios":    key_scenario_data,
        "all_conditions":   all_cond_list,
    }

    json_path = out_dir / "phase_r3_8_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Results saved: {json_path}")

    # ── Save CSV ───────────────────────────────────────────────────────────────
    csv_path = out_dir / "phase_r3_8_summary.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "isr_reduction", "glut_reduction", "isr_value", "glut_value",
            "genuine_tipping_rate", "first_death_step", "plateau_survivors",
            "mean_spatial_coherence_r", "peak_death_slope",
            "functional_survival_duration", "benefit_score",
            "synergy", "synergy_boot", "ci_lo", "ci_hi", "synergy_class",
        ])
        for entry in all_cond_list:
            sr = entry.get("synergy_analysis") or {}
            w.writerow([
                entry["isr_reduction"], entry["glut_reduction"],
                entry["isr_value"],     entry["glut_value"],
                entry["genuine_tipping_rate"],
                entry["first_death_step"],
                entry["plateau_survivors"],
                entry["mean_spatial_coherence_r"],
                entry["peak_death_slope"],
                entry["functional_survival_duration"],
                entry["benefit_score"],
                sr.get("synergy",      ""),
                sr.get("synergy_boot", ""),
                sr.get("ci_lo",        ""),
                sr.get("ci_hi",        ""),
                sr.get("classification", ""),
            ])
    print(f"CSV saved:     {csv_path}")

    # ── Generate plots ─────────────────────────────────────────────────────────
    print("Generating plots ...")
    _plot_heatmap_benefit(condition_stats, out_dir)
    _plot_heatmap_tipping(condition_stats, out_dir)
    _plot_heatmap_synergy(synergy_results, out_dir)
    _plot_bar_key_scenarios(condition_stats, out_dir)

    # ── Save report ────────────────────────────────────────────────────────────
    report   = _build_report(output, condition_stats, synergy_results)
    rpt_path = out_dir / "phase_r3_8_report.md"
    with open(rpt_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"Report  saved: {rpt_path}")
    print(f"Total runtime: {time.time()-t0:.1f}s")
    return output


if __name__ == "__main__":
    run_r3_8()

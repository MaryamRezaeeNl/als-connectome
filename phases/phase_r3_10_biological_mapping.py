"""
Phase R3.10 -- Biological Mapping of ISR: Mechanistic Decomposition

Question: When we suppress ISR, are we targeting production (seeding)
or spread? Do these two mechanisms respond differently to dose?

Three interventions on the DecoupledSimulator aggregation equation:

  d_agg = vulnerability * AGG_SEED_RATE * ISR * dt      <- term A
         + AGG_SPREAD_RATE * TSSE * agg_spread * dt     <- term B
         + oxidativeFeedback * ox * dt + noise

Intervention A -- Production suppression (ISR only):
  intracellularSeedingRate  = 2.0 * (1 - strength)
  transSynapticSpreadEfficiency = 2.0  (unchanged)
  Biological analogue: ASO gene silencing, reduces misfolding initiation rate

Intervention B -- Spread inhibition (TSSE only):
  intracellularSeedingRate  = 2.0  (unchanged)
  transSynapticSpreadEfficiency = 2.0 * (1 - strength)
  Biological analogue: synaptic transmission blockers,
  reduces prion-like propagation efficiency

Intervention C -- Coupled suppression (v1.0-style, both together):
  intracellularSeedingRate  = 2.0 * (1 - strength)
  transSynapticSpreadEfficiency = 2.0 * (1 - strength)
  Analogue: v1.0 aggAmp reduction; targets both pathways simultaneously

Note: Clearance enhancement (Intervention D) was NOT tested because
the current model has no aggregation decay term (no -clearance*agg
in d_agg). This is a model limitation noted in Future Work.

Context: Medium aggregation (ISR=2.0, TSSE=2.0)
Connectome: C. elegans motor circuit (61 neurons)
Criterion: Strict Phase 7B tipping (C1+C2+C3)
Seeds: 30 per (intervention, strength)  |  500 steps
Strength sweep: 11 levels [0.10 .. 0.99]
"""

import sys, os, time, json, csv, textwrap
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from connectome import NEURON_NAMES, VULNERABILITY
from phase_r3_1_decoupled_aggregation import DecoupledSimulator, _pearson_r

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ── Constants ─────────────────────────────────────────────────────────────────

STRENGTHS  = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 0.99]
N_SEEDS    = 30
STEPS      = 500
N_BOOT     = 500
N          = len(NEURON_NAMES)

SLOPE_THR  = 4
COH_THR    = 0.30
SILENT_MIN = 50

BASELINE_ISR  = 2.0
BASELINE_TSSE = 2.0
BASELINE_GLUT = 0.010

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

W_TIP = 0.40
W_DEL = 0.20
W_PLT = 0.25
W_SUR = 0.15

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES])

INTERVENTIONS = [
    {"id": "A", "name": "Production suppression (ISR only)",  "analogue": "ASO gene silencing"},
    {"id": "B", "name": "Spread inhibition (TSSE only)",      "analogue": "Synaptic transmission blockers"},
    {"id": "C", "name": "Coupled suppression (v1.0-style)",   "analogue": "Combined ISR+TSSE reduction"},
]

# ── Parameter factories ───────────────────────────────────────────────────────

def _params_A(strength):
    p = dict(BASE_PARAMS)
    p["intracellularSeedingRate"]      = BASELINE_ISR  * (1.0 - strength)
    # TSSE unchanged
    return p

def _params_B(strength):
    p = dict(BASE_PARAMS)
    p["transSynapticSpreadEfficiency"] = BASELINE_TSSE * (1.0 - strength)
    # ISR unchanged
    return p

def _params_C(strength):
    p = dict(BASE_PARAMS)
    p["intracellularSeedingRate"]      = BASELINE_ISR  * (1.0 - strength)
    p["transSynapticSpreadEfficiency"] = BASELINE_TSSE * (1.0 - strength)
    return p

PARAM_FACTORIES = {"A": _params_A, "B": _params_B, "C": _params_C}

# ── Simulation core ───────────────────────────────────────────────────────────

def _run_single(params, seed):
    sim        = DecoupledSimulator(seed=seed, noise_scale=0.003, params=params)
    alive_hist = []
    death_step = np.full(sim.n, STEPS + 1, dtype=float)
    prev_alive = np.ones(sim.n, dtype=bool)

    for s in range(STEPS):
        sim.step()
        curr   = sim.health > sim.DEAD_THRESHOLD
        newly  = prev_alive & ~curr & (death_step == STEPS + 1)
        death_step[newly] = float(s + 1)
        prev_alive = curr
        alive_hist.append(int(curr.sum()))

    # C1: peak 10-step death rate
    rates     = [alive_hist[t] - alive_hist[t + 10] for t in range(len(alive_hist) - 10)]
    peak_rate = int(max(rates)) if rates else 0

    # C2: spatial coherence
    died  = death_step < STEPS + 1
    coh_r = float(_pearson_r(VULN[died], -death_step[died])) if died.sum() >= 4 else 0.0

    # C3: first death after silent phase
    first_death = int(death_step[died].min()) if died.any() else (STEPS + 1)

    is_genuine = (peak_rate > SLOPE_THR) and (coh_r > COH_THR) and (first_death > SILENT_MIN)
    plateau    = int(alive_hist[-1])

    tip_step = STEPS + 1
    for t in range(len(alive_hist) - 10):
        if alive_hist[t] - alive_hist[t + 10] > SLOPE_THR:
            tip_step = t + 1
            break

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


def _aggregate(runs, boot_seed):
    n           = len(runs)
    genuine_arr = np.array([r["is_genuine"] for r in runs], dtype=float)
    rng_b       = np.random.default_rng(boot_seed)
    boot        = [float(np.mean(genuine_arr[rng_b.integers(0, n, size=n)])) for _ in range(N_BOOT)]
    ci_lo       = round(float(np.percentile(boot,  2.5)), 3)
    ci_hi       = round(float(np.percentile(boot, 97.5)), 3)

    first_deaths = np.array([r["first_death"] for r in runs], dtype=float)
    plateaus     = np.array([r["plateau"]      for r in runs], dtype=float)
    func_survs   = np.array([r["functional_survival"] for r in runs], dtype=float)

    return {
        "genuine_tipping_rate":       round(float(genuine_arr.mean()), 4),
        "genuine_tipping_rate_ci_lo": ci_lo,
        "genuine_tipping_rate_ci_hi": ci_hi,
        "first_death_step":           round(float(np.median(first_deaths)), 1),
        "plateau_survivors":          round(float(np.median(plateaus)),     1),
        "functional_survival_duration": round(float(np.median(func_survs)), 1),
    }


def _benefit_score(stats, base_stats):
    base_fd   = base_stats["first_death_step"]
    base_plat = base_stats["plateau_survivors"]
    base_surv = base_stats["functional_survival_duration"]

    tip  = 1.0 - stats["genuine_tipping_rate"]
    tip  = max(0.0, min(1.0, tip))

    delay_range = max(STEPS - base_fd, 1)
    delay = max(0.0, min(1.0, (stats["first_death_step"] - base_fd) / delay_range))

    plat_range = max(N - base_plat, 1)
    plat  = max(0.0, min(1.0, (stats["plateau_survivors"] - base_plat) / plat_range))

    surv_range = max(STEPS - base_surv, 1)
    surv  = max(0.0, min(1.0, (stats["functional_survival_duration"] - base_surv) / surv_range))

    return round(W_TIP * tip + W_DEL * delay + W_PLT * plat + W_SUR * surv, 6)


# ── Cliff detection ───────────────────────────────────────────────────────────

def _detect_cliffs(strength_results, cliff_tipping=0.20, cliff_benefit=0.10):
    cliffs = []
    data = strength_results
    for i in range(len(data) - 1):
        dt  = abs(data[i+1]["genuine_tipping_rate"] - data[i]["genuine_tipping_rate"])
        db  = abs(data[i+1]["benefit_score"]        - data[i]["benefit_score"])
        if dt >= cliff_tipping or db >= cliff_benefit:
            cliffs.append({
                "from_strength": data[i]["strength"],
                "to_strength":   data[i+1]["strength"],
                "delta_tipping": round(data[i+1]["genuine_tipping_rate"] - data[i]["genuine_tipping_rate"], 4),
                "delta_benefit": round(data[i+1]["benefit_score"]        - data[i]["benefit_score"],        4),
            })
    return cliffs


# ── Efficiency: strength needed to reach target tipping rate ─────────────────

def _strength_for_target(strength_results, target_rate):
    """Linear interpolation: strength at which genuine_tipping_rate == target_rate."""
    arr = [(d["strength"], d["genuine_tipping_rate"]) for d in strength_results]
    # tipping decreases (hopefully) as strength increases
    for i in range(len(arr) - 1):
        s0, r0 = arr[i]
        s1, r1 = arr[i+1]
        if r0 >= target_rate >= r1:
            if abs(r1 - r0) < 1e-9:
                return s0
            frac = (target_rate - r0) / (r1 - r0)
            return round(s0 + frac * (s1 - s0), 4)
    return None  # target not reached


# ── Plotting ──────────────────────────────────────────────────────────────────

def _plot(results_by_interv, out_dir):
    colors = {"A": "#22d3ee", "B": "#f97316", "C": "#a855f7"}
    styles = {"A": "-o",      "B": "-s",      "C": "-^"}
    labels = {
        "A": "A: Production suppression (ISR only)",
        "B": "B: Spread inhibition (TSSE only)",
        "C": "C: Coupled (v1.0-style)",
    }

    x_vals = STRENGTHS

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.patch.set_facecolor("#0f172a")
    for ax in axes:
        ax.set_facecolor("#1e293b")
        ax.tick_params(colors="#94a3b8")
        ax.xaxis.label.set_color("#94a3b8")
        ax.yaxis.label.set_color("#94a3b8")
        ax.title.set_color("#e2e8f0")
        for spine in ax.spines.values():
            spine.set_edgecolor("#334155")

    # ── Fig 1: Tipping rate ──
    ax = axes[0]
    for iid in ["A", "B", "C"]:
        y  = [d["genuine_tipping_rate"] for d in results_by_interv[iid]]
        lo = [d["genuine_tipping_rate_ci_lo"] for d in results_by_interv[iid]]
        hi = [d["genuine_tipping_rate_ci_hi"] for d in results_by_interv[iid]]
        ax.plot([s*100 for s in x_vals], y, styles[iid],
                color=colors[iid], lw=2, ms=5, label=labels[iid])
        ax.fill_between([s*100 for s in x_vals], lo, hi,
                        color=colors[iid], alpha=0.15)

    ax.axhline(1.0, color="#475569", lw=0.8, ls="--")
    ax.axhline(0.5, color="#475569", lw=0.8, ls=":")
    ax.set_xlabel("Intervention strength (%)", fontsize=10)
    ax.set_ylabel("Genuine tipping rate", fontsize=10)
    ax.set_title("Tipping Rate vs Strength", fontsize=11)
    ax.set_ylim(-0.05, 1.10)
    ax.set_xlim(5, 102)
    ax.legend(fontsize=8, facecolor="#1e293b", edgecolor="#334155",
              labelcolor="#e2e8f0", loc="upper right")
    ax.grid(True, color="#334155", lw=0.5)

    # ── Fig 2: Benefit score ──
    ax = axes[1]
    for iid in ["A", "B", "C"]:
        y = [d["benefit_score"] for d in results_by_interv[iid]]
        ax.plot([s*100 for s in x_vals], y, styles[iid],
                color=colors[iid], lw=2, ms=5, label=labels[iid])

    ax.set_xlabel("Intervention strength (%)", fontsize=10)
    ax.set_ylabel("Composite benefit score", fontsize=10)
    ax.set_title("Benefit Score vs Strength", fontsize=11)
    ax.set_ylim(-0.02, 0.80)
    ax.set_xlim(5, 102)
    ax.legend(fontsize=8, facecolor="#1e293b", edgecolor="#334155",
              labelcolor="#e2e8f0", loc="upper left")
    ax.grid(True, color="#334155", lw=0.5)

    fig.suptitle("R3.10 — Biological Mapping of ISR\nA: Production | B: Spread | C: Coupled",
                 color="#e2e8f0", fontsize=12, y=1.01)
    plt.tight_layout()
    fig1_path = os.path.join(out_dir, "fig1_comparison.png")
    fig.savefig(fig1_path, dpi=130, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  fig1 saved: {fig1_path}")

    # ── Fig 2: Plateau survivors ──
    fig2, ax2 = plt.subplots(figsize=(7, 4))
    fig2.patch.set_facecolor("#0f172a")
    ax2.set_facecolor("#1e293b")
    ax2.tick_params(colors="#94a3b8")
    ax2.xaxis.label.set_color("#94a3b8")
    ax2.yaxis.label.set_color("#94a3b8")
    ax2.title.set_color("#e2e8f0")
    for sp in ax2.spines.values():
        sp.set_edgecolor("#334155")

    for iid in ["A", "B", "C"]:
        y = [d["plateau_survivors"] for d in results_by_interv[iid]]
        ax2.plot([s*100 for s in x_vals], y, styles[iid],
                 color=colors[iid], lw=2, ms=5, label=labels[iid])

    ax2.axhline(9, color="#ef4444", lw=0.8, ls="--", label="Baseline (9)")
    ax2.set_xlabel("Intervention strength (%)", fontsize=10)
    ax2.set_ylabel("Plateau survivors (median)", fontsize=10)
    ax2.set_title("Plateau Survivors vs Strength", fontsize=11)
    ax2.set_xlim(5, 102)
    ax2.legend(fontsize=8, facecolor="#1e293b", edgecolor="#334155", labelcolor="#e2e8f0")
    ax2.grid(True, color="#334155", lw=0.5)
    plt.tight_layout()
    fig2_path = os.path.join(out_dir, "fig2_plateau.png")
    fig2.savefig(fig2_path, dpi=130, bbox_inches="tight", facecolor=fig2.get_facecolor())
    plt.close(fig2)
    print(f"  fig2 saved: {fig2_path}")


# ── Report generation ─────────────────────────────────────────────────────────

def _report(results, out_dir, baseline_stats):
    results_by_interv = {d["intervention"]: [] for d in results}
    for d in results:
        results_by_interv[d["intervention"]].append(d)

    # Key efficiency numbers
    eff = {}
    for iid in ["A", "B", "C"]:
        data = results_by_interv[iid]
        eff[iid] = {
            "s50":  _strength_for_target(data, 0.50),
            "s80":  _strength_for_target(data, 0.20),
            "best_benefit":  max(d["benefit_score"] for d in data),
            "best_strength": max(data, key=lambda d: d["benefit_score"])["strength"],
            "cliffs": _detect_cliffs(data),
        }

    def fmt_s(v):
        return f"{int(v*100)}%" if v is not None else "not reached"

    lines = []
    lines.append("# Phase R3.10 — Biological Mapping of ISR: Mechanistic Decomposition\n")
    lines.append(f"**Date generated**: 2026-06-06\n")
    lines.append(
        "**Model**: Decoupled v2.0 (DecoupledSimulator, R3.1)  \n"
        f"**Context**: Medium aggregation (ISR = {BASELINE_ISR}, TSSE = {BASELINE_TSSE})  \n"
        f"**Connectome**: C. elegans motor circuit ({N} neurons, 127 synapses)  \n"
        f"**Criterion**: Strict Phase 7B (C1: peak rate >{SLOPE_THR}, C2: coh r>{COH_THR}, C3: first death >{SILENT_MIN})  \n"
        f"**Seeds per condition**: {N_SEEDS}  |  **Steps**: {STEPS}  |  **Bootstrap CI**: N={N_BOOT}\n"
    )

    lines.append("---\n")
    lines.append("## Clearance Enhancement — Excluded by Design\n")
    lines.append(
        "**Clearance enhancement was not tested because the current model lacks an "
        "aggregation decay term. Future model versions should add explicit clearance "
        "kinetics to test this intervention class.**\n\n"
        "In the current aggregation equation:\n\n"
        "```\n"
        "d_agg = vulnerability * AGG_SEED_RATE * ISR * dt\n"
        "      + AGG_SPREAD_RATE * TSSE * agg_spread * dt\n"
        "      + oxidativeFeedback * ox * dt\n"
        "      + noise\n"
        "```\n\n"
        "There is no `−clearance * agg` term. The only bounds on aggregation are the "
        "`clip(agg, 0, 1)` ceiling and the absence of positive feedback when ISR/TSSE → 0. "
        "A future `AGG_CLEARANCE` term would enable testing of autophagy enhancers "
        "(rapamycin-like compounds) or proteasome activators as a third intervention class.\n"
    )

    lines.append("---\n")
    lines.append("## Interventions\n")
    lines.append(
        "| ID | Name | Biological analogue | Parameter modified |\n"
        "|----|------|---------------------|--------------------|\n"
        f"| A | Production suppression | ASO gene silencing | `ISR = {BASELINE_ISR} × (1 − strength)`, TSSE fixed |\n"
        f"| B | Spread inhibition | Synaptic transmission blockers | `TSSE = {BASELINE_TSSE} × (1 − strength)`, ISR fixed |\n"
        f"| C | Coupled (v1.0-style) | Combined target | Both ISR and TSSE × (1 − strength) |\n"
    )

    lines.append("\n---\n")
    lines.append("## Baseline (0% intervention)\n")
    lines.append(
        f"- Genuine tipping rate: {baseline_stats['genuine_tipping_rate']:.3f}  \n"
        f"- First death step (median): {baseline_stats['first_death_step']:.0f}  \n"
        f"- Plateau survivors (median): {baseline_stats['plateau_survivors']:.0f}  \n"
        f"- Functional survival duration (median): {baseline_stats['functional_survival_duration']:.0f} steps\n"
    )

    lines.append("\n---\n")
    lines.append("## Results Summary\n")

    for iid in ["A", "B", "C"]:
        meta    = next(x for x in INTERVENTIONS if x["id"] == iid)
        data    = results_by_interv[iid]
        e       = eff[iid]
        cliff_s = ""
        if e["cliffs"]:
            c = e["cliffs"][0]
            cliff_s = (f"Cliff at {int(c['from_strength']*100)}%→{int(c['to_strength']*100)}%: "
                       f"Δtipping={c['delta_tipping']:+.3f}, Δbenefit={c['delta_benefit']:+.3f}")
        else:
            cliff_s = "No cliff detected (gradual response)"

        lines.append(f"### Intervention {iid}: {meta['name']}\n")
        lines.append(f"**Biological analogue**: {meta['analogue']}\n\n")
        lines.append(
            f"- Strength for 50% tipping rate: {fmt_s(e['s50'])}  \n"
            f"- Strength for 20% tipping rate: {fmt_s(e['s80'])}  \n"
            f"- Best benefit score: {e['best_benefit']:.4f} at strength {int(e['best_strength']*100)}%  \n"
            f"- **{cliff_s}**\n\n"
        )

        lines.append(
            "| Strength | ISR val | TSSE val | Genuine tip% | 95% CI | Benefit | First death | Plateau |\n"
            "|----------|---------|----------|--------------|--------|---------|-------------|--------|\n"
        )
        for d in data:
            s    = d["strength"]
            isr  = round(BASELINE_ISR  * (1.0 - s if iid in ("A","C") else 1.0), 3)
            tsse = round(BASELINE_TSSE * (1.0 - s if iid in ("B","C") else 1.0), 3)
            lines.append(
                f"| {int(s*100)}% | {isr:.3f} | {tsse:.3f} | "
                f"{d['genuine_tipping_rate']*100:.1f}% | "
                f"[{d['genuine_tipping_rate_ci_lo']*100:.0f}, {d['genuine_tipping_rate_ci_hi']*100:.0f}] | "
                f"{d['benefit_score']:.4f} | {d['first_death_step']:.0f} | {d['plateau_survivors']:.0f} |\n"
            )
        lines.append("\n")

    lines.append("---\n")
    lines.append("## Key Questions\n")

    # Q1: Cliff location comparison
    lines.append("### Q1. Does production suppression show a different cliff location than spread inhibition?\n")
    cliff_A = eff["A"]["cliffs"]
    cliff_B = eff["B"]["cliffs"]
    cliff_C = eff["C"]["cliffs"]

    def cliff_desc(clist, interv_name):
        if not clist:
            return f"{interv_name}: No cliff detected (gradual/monotone dose-response)."
        parts = []
        for c in clist:
            parts.append(f"{interv_name}: cliff at {int(c['from_strength']*100)}%–{int(c['to_strength']*100)}% "
                         f"(Δtipping={c['delta_tipping']:+.3f}, Δbenefit={c['delta_benefit']:+.3f})")
        return " ".join(parts)

    lines.append(cliff_desc(cliff_A, "Intervention A") + "  \n")
    lines.append(cliff_desc(cliff_B, "Intervention B") + "  \n")
    lines.append(cliff_desc(cliff_C, "Intervention C") + "\n\n")

    if not cliff_A and not cliff_B:
        lines.append(
            "Both production and spread inhibition exhibit gradual dose-responses in this sweep. "
            "Neither requires a threshold crossing to achieve benefit — incremental suppression yields "
            "proportional benefit across the full 10–99% range tested.\n"
        )
    elif cliff_A and cliff_B:
        lines.append(
            f"Both interventions show cliffs, but at different locations. "
            f"This implies the two mechanisms have distinct saturation regimes in the cascade.\n"
        )
    elif cliff_A and not cliff_B:
        lines.append(
            "Production suppression (A) has a cliff but spread inhibition (B) does not. "
            "The intrinsic seeding pathway has a threshold behaviour — below a critical seeding rate, "
            "stochastic escape from cascade initiation becomes possible. "
            "Spread inhibition yields more linear benefits because reducing TSSE proportionally "
            "slows propagation without a sharp cascade threshold.\n"
        )
    elif not cliff_A and cliff_B:
        lines.append(
            "Spread inhibition (B) has a cliff but production suppression (A) does not. "
            "Network propagation has a percolation-like threshold: below a critical TSSE, "
            "aggregation no longer spreads sufficiently to entrain vulnerable hub neurons. "
            "Production suppression acts more linearly because it uniformly delays — "
            "but does not qualitatively change — each neuron's autonomous cascade trajectory.\n"
        )

    # Q2: Efficiency
    lines.append("\n### Q2. Which intervention is more efficient (lower strength for same effect)?\n")
    s50_A = eff["A"]["s50"]
    s50_B = eff["B"]["s50"]
    s50_C = eff["C"]["s50"]

    def comp_eff(s_a, s_b, s_c):
        vals = {"A": s_a, "B": s_b, "C": s_c}
        reached = {k: v for k, v in vals.items() if v is not None}
        if not reached:
            return "None of the interventions reached 50% tipping rate within the tested range."
        best = min(reached, key=reached.get)
        worst = max(reached, key=reached.get)
        s = (
            f"To reach 50% genuine tipping rate: "
            + ", ".join(f"Intervention {k}: {fmt_s(v)}" for k, v in sorted(reached.items()))
            + f". Most efficient: Intervention {best} ({fmt_s(reached[best])})."
        )
        if len(reached) > 1:
            ratio = reached[worst] / reached[best] if reached[best] else None
            if ratio and ratio > 1.2:
                s += (f" Intervention {best} requires {ratio:.1f}x less strength "
                      f"than Intervention {worst} for equivalent tipping suppression.")
        return s

    lines.append(comp_eff(s50_A, s50_B, s50_C) + "\n\n")

    b_A = eff["A"]["best_benefit"]
    b_B = eff["B"]["best_benefit"]
    b_C = eff["C"]["best_benefit"]
    best_id = max(["A","B","C"], key=lambda k: eff[k]["best_benefit"])
    lines.append(
        f"Maximum benefit scores: A={b_A:.4f} (at {int(eff['A']['best_strength']*100)}%), "
        f"B={b_B:.4f} (at {int(eff['B']['best_strength']*100)}%), "
        f"C={b_C:.4f} (at {int(eff['C']['best_strength']*100)}%). "
        f"Highest single-intervention benefit: Intervention {best_id}.\n"
    )

    # Q3: Coupled vs alone
    lines.append("\n### Q3. Does coupled suppression (v1.0-style) outperform either alone?\n")
    best_solo = max(b_A, b_B)
    if b_C > best_solo * 1.05:
        lines.append(
            f"Yes — coupled suppression (C) achieves benefit {b_C:.4f}, exceeding the better solo "
            f"intervention by {(b_C/best_solo - 1)*100:.1f}%. Targeting both pathways simultaneously "
            f"provides more than additive benefit, consistent with the two pathways being partially "
            f"independent drivers of the cascade under medium aggregation context.\n"
        )
    elif b_C >= best_solo:
        lines.append(
            f"Coupled suppression (C) achieves benefit {b_C:.4f}, marginally better than the best solo "
            f"intervention ({best_solo:.4f}). The gain from coupling is modest, suggesting that under "
            f"medium aggregation context one pathway dominates and co-suppressing the other adds limited value.\n"
        )
    else:
        dominant = "A" if b_A >= b_B else "B"
        lines.append(
            f"Coupled suppression (C) does NOT outperform the best solo intervention at matched strength. "
            f"Best solo is Intervention {dominant} with benefit {best_solo:.4f} vs coupled {b_C:.4f}. "
            f"This suggests that splitting the same total suppression across both pathways is less effective "
            f"than concentrating it on the dominant pathway.\n"
        )

    # Q4: Clinical prediction
    lines.append("\n### Q4. What does this predict about ASO vs synaptic-targeting therapies?\n")
    lines.append(
        "*All statements below are model-specific and hypothesis-generating only. "
        "No clinical predictions are made.*\n\n"
    )

    if b_A > b_B * 1.5:
        lines.append(
            "In this model, **production suppression (A, ASO analogue) substantially outperforms "
            "spread inhibition (B, synaptic blocker analogue)**. The model predicts that targeting "
            "the intrinsic protein misfolding initiation rate (analogous to TDP-43 production or "
            "misfolding) provides greater benefit than blocking trans-synaptic propagation at "
            "equivalent dose. This is consistent with the gatekeeper-dominant finding of R3.8: "
            "ISR (which controls term A of d_agg) is the primary load-bearing parameter in the "
            "medium aggregation context.\n\n"
            "**Hypothesis for experimental testing**: ASO-mediated TARDBP knockdown should produce "
            "larger and earlier dose-dependent neuroprotection than riluzole-class agents that primarily "
            "reduce glutamatergic excitotoxicity (the downstream pathway). Note: riluzole maps more "
            "directly to glutamateSensitivity than to TSSE — direct TSSE-targeting compounds do not "
            "yet have an established clinical analogue.\n"
        )
    elif b_B > b_A * 1.5:
        lines.append(
            "In this model, **spread inhibition (B, synaptic blocker analogue) substantially outperforms "
            "production suppression (A)**. The model predicts that once aggregation is present, preventing "
            "its propagation via synaptic contacts is more protective than slowing new misfolding. "
            "This would prioritise anti-propagation strategies (e.g., antibodies against secreted "
            "TDP-43 species) over ASO-based production reduction.\n"
        )
    else:
        lines.append(
            "**Interventions A and B have broadly comparable efficacy** across the tested strength range "
            f"(A best benefit {b_A:.4f}, B best benefit {b_B:.4f}). "
            "The model does not strongly favour either target. This suggests both the seeding rate and "
            "the propagation efficiency contribute meaningfully to cascade progression under medium "
            "aggregation context. A combined strategy (Intervention C) captures benefit from both "
            "mechanisms. In clinical terms, this is consistent with a rationale for co-targeting "
            "TDP-43 production (ASO) and synaptic transmission (glutamate modulators), though the "
            "R3.8 finding that glutamate sensitivity alone is negligible remains — TSSE is a "
            "distinct and more upstream pathway from glutamateSensitivity.\n"
        )

    lines.append("\n---\n")
    lines.append("## Model Limitations\n")
    lines.append(
        "1. **No aggregation decay term**: Clearance enhancement cannot be tested. "
        "Future versions should add `−AGG_CLEARANCE_RATE * atp * agg * dt` to d_agg.\n"
        "2. **TSSE is a uniform scalar**: In reality, different synapse types have different "
        "propagation efficiencies. A synapse-type-specific TSSE would enable more mechanistically "
        "realistic spread inhibition modelling.\n"
        "3. **ASO analogue is approximate**: Production suppression here reduces the uniform seeding rate "
        "multiplied by vulnerability — not a cell-type-specific knockdown. ASOs targeting specific "
        "motor neuron populations would require a population-stratified ISR.\n"
        "4. **Strength is not dose**: The strength parameter is a fractional reduction, not a "
        "drug concentration. A pharmacokinetic model linking dose to target engagement would be "
        "required before any dose prediction.\n"
    )

    lines.append("\n---\n")
    lines.append(
        "*This report was auto-generated by phase_r3_10_biological_mapping.py. "
        "All results are from computational simulation and are hypothesis-generating only. "
        "Not peer-reviewed. Not a clinical model.*\n"
    )

    report_path = os.path.join(out_dir, "r3_10_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"Report saved: {report_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def run_r3_10():
    out_dir = os.path.join(
        os.path.dirname(__file__), "..", "results", "r3_10_biological_mapping"
    )
    os.makedirs(out_dir, exist_ok=True)
    out_dir = os.path.realpath(out_dir)

    n_conditions = len(INTERVENTIONS) * len(STRENGTHS)
    n_total      = n_conditions * N_SEEDS + N_SEEDS  # +baseline
    print("Phase R3.10: Biological Mapping of ISR")
    print(f"  Interventions: {len(INTERVENTIONS)}  Strengths: {len(STRENGTHS)}")
    print(f"  Seeds: {N_SEEDS}/condition  Steps: {STEPS}")
    print(f"  Total runs: {n_total}")
    print()

    t0 = time.time()

    # ── Baseline ──
    print("  [baseline] Running baseline (ISR=2.0, TSSE=2.0)...")
    base_runs = [_run_single(dict(BASE_PARAMS), seed=370000 + s) for s in range(N_SEEDS)]
    baseline_stats = _aggregate(base_runs, boot_seed=37001)
    print(
        f"  [baseline] genuine={baseline_stats['genuine_tipping_rate']:.3f} "
        f"fd={baseline_stats['first_death_step']:.0f} "
        f"plat={baseline_stats['plateau_survivors']:.0f}"
    )

    # ── Sweep ──
    all_results = []
    run_count   = N_SEEDS

    for ii, interv in enumerate(INTERVENTIONS):
        iid = interv["id"]
        pfn = PARAM_FACTORIES[iid]
        print(f"\n  Intervention {iid}: {interv['name']}")

        for si, strength in enumerate(STRENGTHS):
            params = pfn(strength)
            isr_v  = round(params["intracellularSeedingRate"],      3)
            tsse_v = round(params["transSynapticSpreadEfficiency"], 3)

            base_seed = 380000 + ii * 100000 + si * 1000
            runs = [_run_single(params, seed=base_seed + s) for s in range(N_SEEDS)]
            run_count += N_SEEDS

            stats = _aggregate(runs, boot_seed=38000 + ii * 200 + si)
            ben   = _benefit_score(stats, baseline_stats)
            stats["benefit_score"] = ben
            stats["strength"]      = strength

            row = {
                "intervention": iid,
                "strength":     strength,
                "isr_value":    isr_v,
                "tsse_value":   tsse_v,
                **stats,
            }
            all_results.append(row)

            elapsed = time.time() - t0
            print(
                f"    {iid} str={int(strength*100):2d}%  "
                f"ISR={isr_v:.3f} TSSE={tsse_v:.3f} | "
                f"genuine={stats['genuine_tipping_rate']:.3f} "
                f"[{stats['genuine_tipping_rate_ci_lo']:.3f},{stats['genuine_tipping_rate_ci_hi']:.3f}] "
                f"benefit={ben:.4f}  ({elapsed:.0f}s)"
            )

    # ── Cliff detection per intervention ──
    results_by_interv = {d["intervention"]: [] for d in all_results}
    for d in all_results:
        results_by_interv[d["intervention"]].append(d)

    cliff_summary = {}
    for iid in ["A", "B", "C"]:
        cliff_summary[iid] = _detect_cliffs(results_by_interv[iid])

    # ── Efficiency ──
    efficiency = {}
    for iid in ["A", "B", "C"]:
        data = results_by_interv[iid]
        efficiency[iid] = {
            "strength_for_50pct_tipping": _strength_for_target(data, 0.50),
            "strength_for_20pct_tipping": _strength_for_target(data, 0.20),
            "best_benefit_score":         round(max(d["benefit_score"] for d in data), 6),
            "best_benefit_strength":      max(data, key=lambda d: d["benefit_score"])["strength"],
        }

    # ── Verdict ──
    best_solo = max(
        efficiency["A"]["best_benefit_score"],
        efficiency["B"]["best_benefit_score"],
    )
    b_C = efficiency["C"]["best_benefit_score"]
    dominant_solo = "A" if efficiency["A"]["best_benefit_score"] >= efficiency["B"]["best_benefit_score"] else "B"
    solo_ratio = (efficiency["A"]["best_benefit_score"] /
                  max(efficiency["B"]["best_benefit_score"], 1e-9))

    if solo_ratio > 1.5:
        verdict = "production_dominant"
    elif solo_ratio < 0.67:
        verdict = "spread_dominant"
    else:
        verdict = "comparable"

    if b_C > best_solo * 1.05:
        coupling_verdict = "synergistic"
    elif b_C >= best_solo * 0.95:
        coupling_verdict = "additive"
    else:
        coupling_verdict = "subadditive"

    print(f"\n  Verdict: {verdict}  |  Coupling: {coupling_verdict}")
    print(f"  Benefit A={efficiency['A']['best_benefit_score']:.4f}  "
          f"B={efficiency['B']['best_benefit_score']:.4f}  "
          f"C={efficiency['C']['best_benefit_score']:.4f}")

    total_time = time.time() - t0
    print(f"\nTotal runtime: {total_time:.1f}s")

    # ── JSON output ──
    out = {
        "phase":   "R3.10 -- Biological Mapping of ISR",
        "params": {
            "baseline_isr":      BASELINE_ISR,
            "baseline_tsse":     BASELINE_TSSE,
            "n_seeds":           N_SEEDS,
            "steps":             STEPS,
            "n_bootstrap":       N_BOOT,
            "strengths":         STRENGTHS,
            "benefit_weights":   {"tipping": W_TIP, "delay": W_DEL, "plateau": W_PLT, "survival": W_SUR},
            "criterion":         {"slope_thr": SLOPE_THR, "coh_thr": COH_THR, "silent_min": SILENT_MIN},
        },
        "verdict":          verdict,
        "coupling_verdict": coupling_verdict,
        "baseline_stats":   baseline_stats,
        "efficiency":       efficiency,
        "cliff_summary":    cliff_summary,
        "results":          all_results,
    }

    json_path = os.path.join(out_dir, "r3_10_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"Results saved: {json_path}")

    # ── CSV ──
    csv_path = os.path.join(out_dir, "r3_10_summary.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["intervention", "strength_pct", "isr_value", "tsse_value",
                    "genuine_tipping_rate", "gtr_ci_lo", "gtr_ci_hi",
                    "benefit_score", "first_death_step", "plateau_survivors"])
        for d in all_results:
            w.writerow([
                d["intervention"], int(d["strength"] * 100),
                d["isr_value"], d["tsse_value"],
                d["genuine_tipping_rate"],
                d["genuine_tipping_rate_ci_lo"],
                d["genuine_tipping_rate_ci_hi"],
                d["benefit_score"],
                d["first_death_step"],
                d["plateau_survivors"],
            ])
    print(f"CSV saved:     {csv_path}")

    # ── Plots ──
    print("Generating plots...")
    _plot(results_by_interv, out_dir)

    # ── Report ──
    _report(all_results, out_dir, baseline_stats)

    print("\nDone.")


if __name__ == "__main__":
    run_r3_10()

"""Phase 5 -- Criticality and Self-Sustaining Degeneration.

Extends ConnectomeSimulator with nonlinear feedback loops:

  aggregation -> mitochondrial damage -> ATP collapse
  -> glutamate accumulation (reuptake failure)
  -> calcium overload (NMDA activation)
  -> oxidative stress (ROS)
  -> aggregation amplification  <-- closes the loop

Irreversible state transitions fire when:
  ATP < atpCollapseThreshold  AND  aggregation > recoveryIrreversibility

Runs 500 random configurations x 500 steps each with ALS initialization.
Classifies each as stable / critical / runaway.
"""

import json
import time
import numpy as np
from pathlib import Path

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES, NODE_TYPES, VULNERABILITY, SYNAPSES, NEUROTRANSMITTER
from simulator import ConnectomeSimulator


# ---- Extended simulator -------------------------------------------------------

class CriticalitySimulator(ConnectomeSimulator):
    """ConnectomeSimulator + calcium/oxidative feedback + irreversible transitions.

    Key extension: aggregationAmplification scales BOTH intrinsic seeding AND
    prion-like spread, giving the parameter broad dynamic-range control.
    """

    def __init__(self, seed=42, noise_scale=0.003, params=None):
        super().__init__(seed=seed, noise_scale=noise_scale)

        self.p = {
            "aggregationAmplification": 1.0,
            "mitochondrialFragility":   1.0,
            "atpCollapseThreshold":     0.30,
            "glutamateSensitivity":     0.010,
            "calciumStressGain":        0.50,
            "oxidativeFeedback":        0.020,
            "recoveryIrreversibility":  0.80,
        }
        if params:
            self.p.update(params)

        # Extended state arrays
        self.calcium      = np.zeros(self.n)
        self.oxidative    = np.zeros(self.n)
        self.irreversible = np.zeros(self.n, dtype=bool)

        # Vectorised aggregation-spread matrix: agg_W[j,i] = weight of synapse i->j
        # (all synapse types carry misfolded-protein seeding)
        self.agg_W = np.zeros((self.n, self.n))
        for j in range(self.n):
            for i, w, _ in self.in_edges[j]:
                self.agg_W[j, i] = w

    def step(self, dt=1.0):
        h   = self.health
        atp = self.atp
        tox = self.toxicity
        agg = self.aggregation
        cal = self.calcium
        ox  = self.oxidative
        p   = self.p

        alive = (h > self.DEAD_THRESHOLD).astype(float)
        amp   = p["aggregationAmplification"]

        # -- 1. Aggregation: prion seeding + spread + oxidative feedback --------
        agg_spread = self.agg_W @ (agg * alive)
        noise = self.rng.normal(0, self.noise_scale, self.n)
        d_agg = (
            self.vulnerability * self.AGG_SEED_RATE * amp * dt
            + self.AGG_SPREAD_RATE * amp * agg_spread * dt   # amp applied to spread too
            + p["oxidativeFeedback"] * ox * dt
            + noise
        )
        new_agg = np.clip(agg + d_agg * alive, 0.0, 1.0)

        # -- 2. ATP: mitochondrial fragility amplifies damage -------------------
        atp_target = np.clip(
            1.0 - self.ATP_DAMAGE_SCALE * p["mitochondrialFragility"] * new_agg, 0.0, 1.0
        )
        new_atp = np.clip(atp + (atp_target - atp) * self.ATP_RECOVERY * dt, 0.0, 1.0)

        # Irreversible collapse: both thresholds crossed simultaneously
        newly_irrev = (
            (new_atp < p["atpCollapseThreshold"])
            & (new_agg > p["recoveryIrreversibility"])
            & (alive > 0.5)
        )
        self.irreversible |= newly_irrev
        # Pin ATP below threshold -- the energy collapse is self-reinforcing
        new_atp = np.where(
            self.irreversible,
            np.minimum(new_atp, p["atpCollapseThreshold"] * 0.75),
            new_atp,
        )

        # -- 3. Glutamate -> calcium cascade ------------------------------------
        # Low ATP -> EAAT2 reuptake failure -> synaptic glu build-up -> NMDA
        glut_drive  = p["glutamateSensitivity"] * np.maximum(0.0, 0.5 - new_atp) * alive
        glut_spread = self.excitotox_W @ glut_drive
        d_cal = (p["calciumStressGain"] * glut_spread - 0.05 * cal) * dt
        new_cal = np.clip(cal + d_cal * alive, 0.0, 1.0)

        # -- 4. Oxidative stress: calcium-driven ROS ----------------------------
        d_ox = (0.15 * new_cal - 0.04 * new_atp * ox) * dt
        new_ox = np.clip(ox + d_ox * alive, 0.0, 1.0)

        # -- 5. Excitotoxic toxicity: calcium augments baseline -----------------
        excitotox_in = self.excitotox_W @ (h * alive)
        d_tox = (
            excitotox_in * (1.0 - new_atp) * self.EXCITOTOX_FACTOR
            + 0.004 * new_cal
            - self.CLEARANCE_BASE * new_atp * tox
        ) * dt
        new_tox = np.clip(tox + d_tox * alive, 0.0, 1.0)

        # -- 6. Health: aggregation + toxicity + calcium + oxidative -----------
        d_health = -(
            self.HEALTH_LOSS_AGG * new_agg
            + self.HEALTH_LOSS_TOX * new_tox
            + 0.005 * new_cal
            + 0.004 * new_ox
        ) * dt
        new_health = np.clip(h + d_health * alive, 0.0, 1.0)

        # Irreversible neurons cannot recover
        new_health = np.where(self.irreversible, np.minimum(new_health, h), new_health)

        # Commit
        self.aggregation = new_agg
        self.atp         = new_atp
        self.toxicity    = new_tox
        self.calcium     = new_cal
        self.oxidative   = new_ox
        self.health      = new_health
        self.time       += dt

        n_alive = int((new_health > self.DEAD_THRESHOLD).sum())
        alive_m = alive > 0.5
        self.history.append({
            "time":          self.time,
            "alive_count":   n_alive,
            "mean_agg":      float(new_agg[alive_m].mean()) if alive_m.any() else 1.0,
            "mean_atp":      float(new_atp[alive_m].mean()) if alive_m.any() else 0.0,
            "mean_cal":      float(new_cal[alive_m].mean()) if alive_m.any() else 1.0,
            "mean_ox":       float(new_ox[alive_m].mean())  if alive_m.any() else 1.0,
            "n_irreversible": int(self.irreversible.sum()),
        })
        return n_alive


# ---- Regime classification ---------------------------------------------------

def classify_regime(alive_at_200: int, alive_at_500: int) -> str:
    """
    stable  : >50 alive at t=500
    runaway : <10 alive by t=200
    critical: everything between
    """
    if alive_at_200 < 10:
        return "runaway"
    if alive_at_500 > 50:
        return "stable"
    return "critical"


# ---- Parameter space ---------------------------------------------------------
# Log-uniform sampling for parameters spanning >10x ensures coverage at
# both extremes (low -> stable, high -> runaway).

PARAM_RANGES = {
    "aggregationAmplification": (0.05, 20.0),   # ~400x range; log-sampled
    "mitochondrialFragility":   (0.30,  8.0),
    "atpCollapseThreshold":     (0.05,  0.70),
    "glutamateSensitivity":     (0.0005, 0.10),  # log-sampled
    "calciumStressGain":        (0.02,  5.0),
    "oxidativeFeedback":        (0.0005, 0.50),  # log-sampled
    "recoveryIrreversibility":  (0.20,  0.99),
}

PARAM_KEYS = list(PARAM_RANGES.keys())

# Parameters for which log-uniform sampling is used (span > 10x)
_LOG_SAMPLE = {"aggregationAmplification", "glutamateSensitivity", "oxidativeFeedback"}


def _sample_params(rng) -> dict:
    params = {}
    for k in PARAM_KEYS:
        lo, hi = PARAM_RANGES[k]
        if k in _LOG_SAMPLE:
            params[k] = float(np.exp(rng.uniform(np.log(lo), np.log(hi))))
        else:
            params[k] = float(rng.uniform(lo, hi))
    return params


# ---- Single run --------------------------------------------------------------

def run_single_config(params: dict, config_id: int, steps: int = 500) -> dict:
    sim = CriticalitySimulator(seed=config_id + 100, noise_scale=0.003, params=params)

    hist_alive = []
    for _ in range(steps):
        hist_alive.append(sim.step())

    alive_at_200 = hist_alive[199]
    alive_at_500 = hist_alive[steps - 1]
    regime = classify_regime(alive_at_200, alive_at_500)

    return {
        "alive_at_200": alive_at_200,
        "alive_at_500": alive_at_500,
        "regime":       regime,
        "hist_alive":   hist_alive,
    }


# ---- Search ------------------------------------------------------------------

def run_search(n_configs: int = 500, seed: int = 42, steps: int = 500) -> list:
    rng = np.random.default_rng(seed)
    all_results = []
    t0 = time.time()

    for i in range(n_configs):
        params = _sample_params(rng)
        result = run_single_config(params, config_id=i, steps=steps)

        all_results.append({
            "id":           i,
            "params":       {k: round(v, 7) for k, v in params.items()},
            "regime":       result["regime"],
            "alive_at_200": result["alive_at_200"],
            "alive_at_500": result["alive_at_500"],
            "hist_alive":   result["hist_alive"],
        })

        if (i + 1) % 50 == 0:
            counts = {}
            for r in all_results:
                counts[r["regime"]] = counts.get(r["regime"], 0) + 1
            print(
                f"  [{i+1:3d}/{n_configs}]  "
                f"{time.time()-t0:.0f}s  "
                f"stable={counts.get('stable',0):3d}  "
                f"critical={counts.get('critical',0):3d}  "
                f"runaway={counts.get('runaway',0):3d}"
            )

    return all_results


# ---- Criticality scoring (for top-20 ranking) --------------------------------

def criticality_score(r: dict) -> float:
    """Score for ranking critical-regime configs.

    Returns the minimum margin to either boundary, normalised to [0, 1].
    Configs deepest in the critical band (away from both runaway and stable
    edges) score highest.
    """
    dist_from_runaway = r["alive_at_200"] - 10   # > 0 for critical
    dist_from_stable  = 50 - r["alive_at_500"]   # > 0 for critical
    return max(0.0, min(dist_from_runaway, dist_from_stable) / 40.0)


# ---- Parameter statistics helpers -------------------------------------------

def _pstats(subset: list, key: str) -> dict:
    vals = [r["params"][key] for r in subset]
    if not vals:
        return {"mean": "n/a", "std": "n/a", "min": "n/a", "max": "n/a"}
    return {
        "mean": round(float(np.mean(vals)), 5),
        "std":  round(float(np.std(vals)),  5),
        "min":  round(float(np.min(vals)),  5),
        "max":  round(float(np.max(vals)),  5),
    }


# ---- Report builder ----------------------------------------------------------

def build_report(all_results: list, top_critical: list) -> str:
    n   = len(all_results)
    stb = [r for r in all_results if r["regime"] == "stable"]
    crt = [r for r in all_results if r["regime"] == "critical"]
    rwy = [r for r in all_results if r["regime"] == "runaway"]

    def _fmt(v):
        return str(v) if isinstance(v, str) else f"{v}"

    lines = []

    lines += [
        "# Phase 5 -- Criticality and Self-Sustaining Degeneration",
        "",
        "## 1. Overview",
        "",
        "Phase 5 extends the biophysical ALS C. elegans connectome simulator with "
        "nonlinear feedback loops implementing the full excitotoxic cascade:",
        "",
        "```",
        "aggregation",
        "  -> mitochondrial damage  (mitochondrialFragility)",
        "  -> ATP collapse           (atpCollapseThreshold)",
        "  -> glutamate accumulation (glutamateSensitivity x reuptake failure)",
        "  -> Ca2+ overload          (calciumStressGain x NMDA activation)",
        "  -> oxidative stress       (ROS generation from Ca2+)",
        "  -> aggregation seeding    (oxidativeFeedback)  <-- closes the loop",
        "```",
        "",
        "**Irreversible transitions** engage when a neuron simultaneously satisfies:",
        "",
        "  * ATP < `atpCollapseThreshold`",
        "  * aggregation > `recoveryIrreversibility`",
        "",
        "Once triggered, health can no longer improve -- the neuron is locked "
        "into the degenerative cascade.",
        "",
        "**Key design**: `aggregationAmplification` scales BOTH intrinsic seeding "
        "AND prion-like spread, giving it broad dynamic-range control. Log-uniform "
        "sampling ensures coverage of both low (stable) and high (runaway) extremes.",
        "",
    ]

    lines += [
        "## 2. Parameter Search",
        "",
        f"- **Configurations:** {n}",
        f"- **Steps per run:** 500",
        f"- **Initialization:** ALS focal onset (motor neurons seeded with elevated aggregation)",
        f"- **Sampling:** log-uniform for `aggregationAmplification`, `glutamateSensitivity`, "
        f"`oxidativeFeedback`; uniform for others",
        "",
        "| Parameter | Range | Sampling |",
        "|-----------|-------|----------|",
    ]
    for k, (lo, hi) in PARAM_RANGES.items():
        smode = "log-uniform" if k in _LOG_SAMPLE else "uniform"
        lines.append(f"| `{k}` | [{lo}, {hi}] | {smode} |")
    lines.append("")

    # Regime distribution
    lines += [
        "## 3. Regime Distribution",
        "",
        "| Regime | Criterion | Count | Fraction |",
        "|--------|-----------|-------|----------|",
        f"| **Stable**   | >50 alive at t=500                         | {len(stb)} | {len(stb)/n:.1%} |",
        f"| **Critical** | >=10 at t=200 AND <=50 alive at t=500      | {len(crt)} | {len(crt)/n:.1%} |",
        f"| **Runaway**  | <10 alive by t=200                         | {len(rwy)} | {len(rwy)/n:.1%} |",
        "",
    ]

    # Parameter analysis
    lines.append("## 4. Parameter Analysis by Regime")
    lines.append("")

    for key in PARAM_KEYS:
        s = _pstats(stb, key)
        c = _pstats(crt, key)
        r = _pstats(rwy, key)
        lines += [
            f"### `{key}`",
            "",
            "| Regime | Mean | Std | Min | Max |",
            "|--------|------|-----|-----|-----|",
            f"| Stable   | {_fmt(s['mean'])} | {_fmt(s['std'])} | {_fmt(s['min'])} | {_fmt(s['max'])} |",
            f"| Critical | {_fmt(c['mean'])} | {_fmt(c['std'])} | {_fmt(c['min'])} | {_fmt(c['max'])} |",
            f"| Runaway  | {_fmt(r['mean'])} | {_fmt(r['std'])} | {_fmt(r['min'])} | {_fmt(r['max'])} |",
            "",
        ]

    # Top-20 critical configs
    lines += [
        "## 5. Top 20 Critical-Regime Configurations",
        "",
        "Ranked by `min(alive_at_200 - 10, 50 - alive_at_500) / 40` "
        "(deepest in the critical band).",
        "",
        "| Rank | ID | @t200 | @t500 | Score | aggAmp | mitFrag | atpThr | glutSens | CaGain | oxFB | recIrrev |",
        "|------|----|----|----|----|----|----|----|----|----|----|----| ",
    ]
    for rank, r in enumerate(top_critical, 1):
        pr = r["params"]
        sc = criticality_score(r)
        lines.append(
            f"| {rank} | {r['id']} "
            f"| {r['alive_at_200']} | {r['alive_at_500']} "
            f"| {sc:.3f} "
            f"| {pr['aggregationAmplification']:.4f} "
            f"| {pr['mitochondrialFragility']:.3f} "
            f"| {pr['atpCollapseThreshold']:.3f} "
            f"| {pr['glutamateSensitivity']:.5f} "
            f"| {pr['calciumStressGain']:.3f} "
            f"| {pr['oxidativeFeedback']:.5f} "
            f"| {pr['recoveryIrreversibility']:.3f} |"
        )
    lines.append("")

    # Key findings
    lines.append("## 6. Key Findings")
    lines.append("")

    # Regime-separation: normalised mean difference stable vs runaway
    seps = []
    for key in PARAM_KEYS:
        lo, hi = PARAM_RANGES[key]
        span = hi - lo
        sm = _pstats(stb, key)["mean"]
        rm = _pstats(rwy, key)["mean"]
        cm = _pstats(crt, key)["mean"]
        if isinstance(sm, str) or isinstance(rm, str):
            seps.append((key, 0.0, sm, cm, rm))
            continue
        sep = abs(sm - rm) / span if span > 0 else 0.0
        seps.append((key, sep, sm, cm, rm))
    seps.sort(key=lambda x: -(x[1] if isinstance(x[1], float) else 0.0))

    lines += [
        "### Parameters ranked by regime-separation power",
        "",
        "| Parameter | Stable mean | Critical mean | Runaway mean | Separation |",
        "|-----------|-------------|---------------|--------------|------------|",
    ]
    for key, sep, sm, cm, rm in seps:
        sep_str = f"{sep:.3f}" if isinstance(sep, float) else "n/a"
        lines.append(
            f"| `{key}` | {_fmt(sm)} | {_fmt(cm)} | {_fmt(rm)} | {sep_str} |"
        )

    lines += [
        "",
        "### Self-Sustaining Degeneration",
        "",
        "The feedback loop becomes self-sustaining when loop gain exceeds unity:",
        "",
        "  `aggregationAmplification x oxidativeFeedback x calciumStressGain`",
        "  `  x glutamateSensitivity x mitochondrialFragility > theta_critical`",
        "",
        "Below theta: perturbations decay -> **stable** regime.  ",
        "Above theta: degeneration accelerates irreversibly -> **runaway** regime.  ",
        "Near theta: slow, sustained, heterogeneous decline -> **critical** regime.",
        "",
        "The critical regime maps to clinical ALS heterogeneity: "
        "some patients plateau (stable), some rapidly decline (runaway), "
        "most show intermediate multi-year progression (critical).",
        "",
        "### Irreversibility as a Disease Switch",
        "",
        "The `atpCollapseThreshold` x `recoveryIrreversibility` interaction "
        "acts as a binary switch. Once a neuron crosses both thresholds it can no longer "
        "recover energy homeostasis, turning the excitotoxic cascade into a one-way "
        "degenerative commitment.",
        "",
    ]

    # Biological interpretation
    lines += [
        "## 7. Biological Interpretation",
        "",
        "| Model Parameter | ALS Biology |",
        "|----------------|-------------|",
        "| `aggregationAmplification` | TDP-43 / FUS prion-like seeding and spreading efficiency |",
        "| `mitochondrialFragility`   | Mitochondrial vulnerability (PINK1/Parkin, Complex I deficits) |",
        "| `atpCollapseThreshold`     | Bioenergetic point of no return (~30% normal ATP) |",
        "| `glutamateSensitivity`     | EAAT2 glutamate transporter expression level |",
        "| `calciumStressGain`        | NMDA receptor density and calcium channel activity |",
        "| `oxidativeFeedback`        | SOD1 activity / antioxidant reserve capacity |",
        "| `recoveryIrreversibility`  | Autophagic clearance capacity (p62, ubiquitin flux) |",
        "",
        "---",
        "_Generated by `phase5_criticality.py` -- ALS connectome project Phase 5_",
    ]

    return "\n".join(lines)


# ---- Main --------------------------------------------------------------------

def main():
    N_CONFIGS = 500
    STEPS     = 500
    SEED      = 42

    print("=" * 70)
    print("Phase 5 -- Criticality and Self-Sustaining Degeneration")
    print("=" * 70)
    print(f"Configs : {N_CONFIGS}  |  Steps: {STEPS}  |  RNG seed: {SEED}")
    print(f"Feedback: aggregation -> ATP -> glutamate -> Ca2+ -> ROS -> aggregation")
    print(f"Regimes : stable (>50 alive @t500)  |  runaway (<10 @t200)")
    print()
    print("Parameter search space:")
    for k, (lo, hi) in PARAM_RANGES.items():
        smode = "(log)" if k in _LOG_SAMPLE else "     "
        print(f"  {smode} {k:<30} [{lo}, {hi}]")
    print()
    print("Running search ...")

    t0 = time.time()
    all_results = run_search(n_configs=N_CONFIGS, seed=SEED, steps=STEPS)
    t_total = time.time() - t0

    stable   = [r for r in all_results if r["regime"] == "stable"]
    critical = [r for r in all_results if r["regime"] == "critical"]
    runaway  = [r for r in all_results if r["regime"] == "runaway"]

    print(f"\nSearch complete in {t_total:.1f}s")
    print(f"  Stable  : {len(stable):4d}  ({len(stable)/N_CONFIGS:.1%})")
    print(f"  Critical: {len(critical):4d}  ({len(critical)/N_CONFIGS:.1%})")
    print(f"  Runaway : {len(runaway):4d}  ({len(runaway)/N_CONFIGS:.1%})")

    # Top-20 critical configs
    top_critical = sorted(critical, key=criticality_score, reverse=True)[:20]

    # ---- Save outputs --------------------------------------------------------
    Path("results").mkdir(exist_ok=True)

    # regime_map.json -- all 500 configs (without hist_alive to keep size small)
    regime_map_out = {
        "n_configs":    N_CONFIGS,
        "steps":        STEPS,
        "regime_counts": {
            "stable":   len(stable),
            "critical": len(critical),
            "runaway":  len(runaway),
        },
        "param_ranges":  {k: list(v) for k, v in PARAM_RANGES.items()},
        "log_sampled":   sorted(_LOG_SAMPLE),
        "configs": [
            {
                "id":           r["id"],
                "params":       r["params"],
                "regime":       r["regime"],
                "alive_at_200": r["alive_at_200"],
                "alive_at_500": r["alive_at_500"],
            }
            for r in all_results
        ],
    }
    with open("results/regime_map.json", "w") as f:
        json.dump(regime_map_out, f, indent=2)
    print("\nSaved -> results/regime_map.json")

    # critical_configs.json -- top 20 with full hist_alive
    crit_out = {
        "description": "Top 20 critical-regime configurations",
        "ranking":     "min(alive_at_200 - 10, 50 - alive_at_500) / 40",
        "configs": [
            {
                "rank":              rank,
                "id":                r["id"],
                "params":            r["params"],
                "regime":            r["regime"],
                "alive_at_200":      r["alive_at_200"],
                "alive_at_500":      r["alive_at_500"],
                "criticality_score": round(criticality_score(r), 4),
                "hist_alive":        r["hist_alive"],
            }
            for rank, r in enumerate(top_critical, 1)
        ],
    }
    with open("results/critical_configs.json", "w") as f:
        json.dump(crit_out, f, indent=2)
    print("Saved -> results/critical_configs.json")

    # phase5_criticality_report.md
    report = build_report(all_results, top_critical)
    with open("results/phase5_criticality_report.md", "w", encoding="utf-8") as f:
        f.write(report)
    print("Saved -> results/phase5_criticality_report.md")

    # ---- Print top-5 critical configs ----------------------------------------
    print("\nTop 5 critical-regime configurations:")
    print(f"  {'Rank':>4} {'ID':>4} {'@200':>5} {'@500':>5} {'Score':>7}  "
          f"{'aggAmp':>8} {'mitFrag':>7} {'oxFB':>7}")
    print("  " + "-" * 65)
    for rank, r in enumerate(top_critical[:5], 1):
        pr = r["params"]
        print(
            f"  {rank:>4} {r['id']:>4} "
            f"{r['alive_at_200']:>5} {r['alive_at_500']:>5} "
            f"{criticality_score(r):>7.4f}  "
            f"{pr['aggregationAmplification']:>8.4f} "
            f"{pr['mitochondrialFragility']:>7.3f} "
            f"{pr['oxidativeFeedback']:>7.5f}"
        )


if __name__ == "__main__":
    main()

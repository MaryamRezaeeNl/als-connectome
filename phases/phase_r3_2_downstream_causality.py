"""R3.2 -- Downstream Causal Power Test.

Tests whether the downstream cascade pathways (mitochondrial damage,
glutamate excitotoxicity, calcium/ROS, irreversibility lock) can become
genuinely load-bearing when stressed independently of aggregation --
or whether they remain permanently seeding-gated amplifiers.

Three parameter regimes define which upstream mechanisms are active:
  Regime 1 -- Seeding-dominant: high ISR, moderate TSSE
  Regime 2 -- Spread-dominant:  low ISR,  high TSSE
  Regime 3 -- Downstream-stressed: moderate ISR/TSSE + elevated mito/glut/calcium

Six ablations are run for each config (one mechanism disabled at a time):
  A: ISR = 0.001          (intracellular seeding off)
  B: TSSE = 0.001         (trans-synaptic spread off)
  C: mitFrag = 0.001      (mitochondrial damage off)
  D: glutSens = 1e-6      (glutamate pathway off)
  E: calcGain = 0.001     (calcium/ROS off)
  F: recovIrrev = 0.999   (irreversibility lock-in off)

Effect classification on three metrics:
  first_death_shift: ablation minus baseline (>0 = delayed = mechanism was accelerating)
  plateau_gain:      ablation minus baseline (>0 = more survivors)
  genuine_rate_drop: baseline minus ablation (>0 = mechanism was sustaining tipping)

Effect size:
  Large:  shift>50 OR gain>10 neurons OR rate_drop>0.30
  Medium: shift 20-50 OR gain 5-10    OR rate_drop 0.10-0.30
  Small:  shift<20 OR gain<5          OR rate_drop<0.10

Role:
  load_bearing:   large effect in ANY regime
  seeding_gated:  large only when seeding active (regime 1 but not regime 2 stressed-only)
  amplifier:      medium effect in stressed regime (3) only
  negligible:     no meaningful effect across all regimes

Key question: under downstream-stressed conditions, can mito/glut/calcium
become load-bearing, or are they permanently gated by upstream aggregation?

Outputs:
  results/r3_2_downstream_causality/r3_2_results.json
  results/r3_2_downstream_causality/r3_2_report.md
"""

import json
import time
import sys
import os
import itertools
import numpy as np
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from connectome import NEURON_NAMES, VULNERABILITY
from phase_r3_1_decoupled_aggregation import DecoupledSimulator, _pearson_r

# ── Strict Phase 7B criterion (shared constants) ────────────────────────────
_VULN          = np.array([VULNERABILITY[n] for n in NEURON_NAMES])
_C1_SLOPE_THR  = 4
_C2_COHERENCE  = 0.30
_C3_SILENT_MIN = 50
_DEAD_THR      = 0.15
_ABLATION_SEEDS = 5    # seeds per ablation run


def _run_one(params, seed, steps=500):
    """Run one simulation; return tipping metrics dict."""
    sim = DecoupledSimulator(seed=seed, noise_scale=0.003, params=params)
    alive_hist = []
    death_step = {}
    prev_alive = np.ones(sim.n, dtype=bool)

    for s in range(steps):
        n_alive = sim.step()
        alive_hist.append(n_alive)
        cur_alive = sim.health > sim.DEAD_THRESHOLD
        newly_dead = prev_alive & ~cur_alive
        for idx in np.where(newly_dead)[0]:
            if idx not in death_step:
                death_step[idx] = s + 1
        prev_alive = cur_alive

    first_death = min(death_step.values()) if death_step else steps + 1

    # C1
    peak_rate = max(
        (alive_hist[i - 10] - alive_hist[i] for i in range(10, len(alive_hist))),
        default=0
    )
    c1 = peak_rate > _C1_SLOPE_THR

    # C2
    if len(death_step) >= 4:
        idxs   = list(death_step.keys())
        vuls   = [_VULN[i] for i in idxs]
        dsteps = [death_step[i] for i in idxs]
        coh_r  = _pearson_r(vuls, [-d for d in dsteps])
    else:
        coh_r = 0.0
    c2 = coh_r > _C2_COHERENCE

    # C3
    c3 = first_death > _C3_SILENT_MIN

    return {
        "is_genuine":  bool(c1 and c2 and c3),
        "first_death": int(first_death),
        "plateau":     int(alive_hist[-1]),
        "coh_r":       round(float(coh_r), 3),
        "peak_rate":   int(peak_rate),
    }


def _run_n(params, seeds_list, steps=500):
    """Run multiple seeds; return aggregated stats."""
    runs = [_run_one(params, seed=s, steps=steps) for s in seeds_list]
    return {
        "genuine_rate":     round(sum(r["is_genuine"] for r in runs) / len(runs), 3),
        "mean_first_death": round(float(np.mean([r["first_death"] for r in runs])), 1),
        "mean_plateau":     round(float(np.mean([r["plateau"]     for r in runs])), 1),
        "mean_coh_r":       round(float(np.mean([r["coh_r"]      for r in runs])), 3),
    }


# ── Effect size classifier ──────────────────────────────────────────────────

def _effect_size(shift, gain, rate_drop):
    """Classify effect size from three metrics."""
    if shift > 50 or gain > 10 or rate_drop > 0.30:
        return "large"
    if shift > 20 or gain > 5 or rate_drop > 0.10:
        return "medium"
    return "small"


# ── Regime definitions ───────────────────────────────────────────────────────

BASE_OTHER = {
    "aggregationAmplification": 1.0,
    "atpCollapseThreshold":     0.30,
    "oxidativeFeedback":        0.020,
    "recoveryIrreversibility":  0.80,
}

def _make_configs(param_grid, limit=10):
    """Generate configs from Cartesian product of param_grid; cap at limit."""
    keys   = list(param_grid.keys())
    combos = list(itertools.product(*[param_grid[k] for k in keys]))
    if len(combos) > limit:
        rng = np.random.default_rng(42)
        idxs = rng.choice(len(combos), size=limit, replace=False)
        combos = [combos[i] for i in sorted(idxs)]
    configs = []
    for vals in combos:
        cfg = dict(BASE_OTHER)
        cfg.update(dict(zip(keys, vals)))
        configs.append(cfg)
    return configs


REGIME_DEFS = {
    "seeding_dominant": {
        "description": "High ISR, moderate TSSE; seeding drives cascade",
        "grid": {
            "intracellularSeedingRate":      [2.0, 5.0, 10.0],
            "transSynapticSpreadEfficiency": [0.5, 2.0],
            "mitochondrialFragility":        [1.0],
            "glutamateSensitivity":          [0.01],
            "calciumStressGain":             [0.5],
        },
    },
    "spread_dominant": {
        "description": "Low ISR, high TSSE; spread drives cascade",
        "grid": {
            "intracellularSeedingRate":      [0.05, 0.5],
            "transSynapticSpreadEfficiency": [2.0, 5.0, 10.0],
            "mitochondrialFragility":        [1.0],
            "glutamateSensitivity":          [0.01],
            "calciumStressGain":             [0.5],
        },
    },
    "downstream_stressed": {
        "description": "Moderate ISR/TSSE + elevated mito/glut/calcium",
        "grid": {
            "intracellularSeedingRate":      [0.5, 2.0],
            "transSynapticSpreadEfficiency": [0.5, 2.0],
            "mitochondrialFragility":        [4.0, 8.0],
            "glutamateSensitivity":          [0.05, 0.1],
            "calciumStressGain":             [3.0, 5.0],
        },
    },
}

# ── Ablation definitions ──────────────────────────────────────────────────────

ABLATIONS = {
    "A_seeding_off":   {"intracellularSeedingRate":     0.001},
    "B_spread_off":    {"transSynapticSpreadEfficiency": 0.001},
    "C_mito_off":      {"mitochondrialFragility":        0.001},
    "D_glut_off":      {"glutamateSensitivity":          1e-6},
    "E_calcium_off":   {"calciumStressGain":             0.001},
    "F_irrev_off":     {"recoveryIrreversibility":       0.999},
}

ABLATION_LABELS = {
    "A_seeding_off":  "Intracellular seeding (ISR)",
    "B_spread_off":   "Trans-synaptic spread (TSSE)",
    "C_mito_off":     "Mitochondrial damage",
    "D_glut_off":     "Glutamate excitotoxicity",
    "E_calcium_off":  "Calcium / ROS",
    "F_irrev_off":    "Irreversibility lock",
}

STEPS          = 500
N_BASELINE     = 10
N_ABLATION     = _ABLATION_SEEDS


# ── Main sweep ────────────────────────────────────────────────────────────────

def run_phase16a():
    t0 = time.time()
    out_dir = Path(__file__).parent.parent / "results" / "r3_2_downstream_causality"
    out_dir.mkdir(parents=True, exist_ok=True)

    results_by_regime = {}

    for regime_name, rdef in REGIME_DEFS.items():
        print(f"\n=== Regime: {regime_name} ===")
        configs = _make_configs(rdef["grid"])
        print(f"  {len(configs)} configs, {N_BASELINE} baseline seeds, "
              f"{len(ABLATIONS)} ablations x {N_ABLATION} seeds each")

        regime_results = []

        for ci, cfg in enumerate(configs):
            # Baseline
            base_seeds = list(range(1000 + ci * 100, 1000 + ci * 100 + N_BASELINE))
            baseline   = _run_n(cfg, base_seeds, steps=STEPS)

            # Ablations
            ablation_results = {}
            for abl_key, abl_override in ABLATIONS.items():
                abl_params = dict(cfg)
                abl_params.update(abl_override)
                abl_seeds  = list(range(5000 + ci * 100, 5000 + ci * 100 + N_ABLATION))
                abl_stats  = _run_n(abl_params, abl_seeds, steps=STEPS)

                shift     = round(abl_stats["mean_first_death"] - baseline["mean_first_death"], 1)
                gain      = round(abl_stats["mean_plateau"]     - baseline["mean_plateau"],     1)
                rate_drop = round(baseline["genuine_rate"]      - abl_stats["genuine_rate"],     3)
                eff       = _effect_size(abs(shift), abs(gain), max(rate_drop, 0))

                ablation_results[abl_key] = {
                    "baseline_genuine_rate": baseline["genuine_rate"],
                    "ablation_genuine_rate": abl_stats["genuine_rate"],
                    "baseline_first_death":  baseline["mean_first_death"],
                    "ablation_first_death":  abl_stats["mean_first_death"],
                    "baseline_plateau":      baseline["mean_plateau"],
                    "ablation_plateau":      abl_stats["mean_plateau"],
                    "first_death_shift":     shift,
                    "plateau_gain":          gain,
                    "genuine_rate_drop":     rate_drop,
                    "effect_size":           eff,
                }

            regime_results.append({
                "config_idx": ci,
                "params":     {k: round(v, 5) for k, v in cfg.items()
                               if k in ("intracellularSeedingRate",
                                        "transSynapticSpreadEfficiency",
                                        "mitochondrialFragility",
                                        "glutamateSensitivity",
                                        "calciumStressGain")},
                "baseline":   baseline,
                "ablations":  ablation_results,
            })

            elapsed = time.time() - t0
            dominant_abl = max(
                ablation_results.items(),
                key=lambda kv: abs(kv[1]["first_death_shift"]) + 5 * abs(kv[1]["genuine_rate_drop"])
            )
            isr  = cfg.get("intracellularSeedingRate", "?")
            tsse = cfg.get("transSynapticSpreadEfficiency", "?")
            print(
                f"  [{ci+1:2d}/{len(configs)}] ISR={isr:.2f} TSSE={tsse:.2f} | "
                f"genuine={baseline['genuine_rate']:.2f} plateau={baseline['mean_plateau']:5.1f} | "
                f"biggest_abl={dominant_abl[0]} ({dominant_abl[1]['effect_size']}) | "
                f"{elapsed:.0f}s"
            )

        results_by_regime[regime_name] = {
            "description": rdef["description"],
            "n_configs": len(configs),
            "configs": regime_results,
        }

    # ── Aggregate causal power table ─────────────────────────────────────────
    causal_table = _build_causal_table(results_by_regime)

    output = {
        "phase": "R3.2 -- Downstream Causal Power Test",
        "params": {
            "steps": STEPS,
            "n_baseline_seeds": N_BASELINE,
            "n_ablation_seeds": N_ABLATION,
            "criterion": {
                "c1_slope_thr": _C1_SLOPE_THR,
                "c2_coherence_thr": _C2_COHERENCE,
                "c3_silent_min": _C3_SILENT_MIN,
            },
            "effect_thresholds": {
                "large":  "shift>50 OR gain>10 OR rate_drop>0.30",
                "medium": "shift>20 OR gain>5  OR rate_drop>0.10",
                "small":  "otherwise",
            },
        },
        "causal_power_table": causal_table,
        "regime_results": results_by_regime,
    }

    json_path = out_dir / "r3_2_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults saved: {json_path}")

    report = _build_report(output)
    report_path = out_dir / "r3_2_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"Report  saved: {report_path}")
    print(f"Total runtime: {time.time()-t0:.1f}s")
    return output


# ── Causal table builder ──────────────────────────────────────────────────────

def _regime_abl_stats(regime_data, abl_key):
    """Average ablation metrics across all configs in one regime."""
    shifts     = []
    gains      = []
    rate_drops = []
    effects    = []

    for cfg_r in regime_data["configs"]:
        a = cfg_r["ablations"][abl_key]
        shifts.append(a["first_death_shift"])
        gains.append(a["plateau_gain"])
        rate_drops.append(a["genuine_rate_drop"])
        effects.append(a["effect_size"])

    mean_shift     = float(np.mean(shifts))
    mean_gain      = float(np.mean(gains))
    mean_rate_drop = float(np.mean(rate_drops))
    majority_eff   = max(set(effects), key=effects.count)

    return {
        "mean_shift":     round(mean_shift, 1),
        "mean_gain":      round(mean_gain, 1),
        "mean_rate_drop": round(mean_rate_drop, 3),
        "majority_effect": majority_eff,
    }


def _classify_role(row_by_regime):
    """Classify mechanistic role from per-regime effect sizes."""
    effects = {rn: rd["majority_effect"] for rn, rd in row_by_regime.items()}

    any_large    = any(e == "large"  for e in effects.values())
    stressed_med = effects.get("downstream_stressed") in ("large", "medium")
    seed_large   = effects.get("seeding_dominant")   == "large"
    spread_large = effects.get("spread_dominant")    == "large"

    if any_large:
        if seed_large or spread_large:
            return "load_bearing"
        return "load_bearing"       # large in stressed still counts

    if stressed_med and not seed_large and not spread_large:
        return "amplifier"

    if stressed_med:
        return "seeding_gated"

    return "negligible"


def _build_causal_table(results_by_regime):
    table = {}
    for abl_key, abl_label in ABLATION_LABELS.items():
        row = {}
        for regime_name, rdata in results_by_regime.items():
            row[regime_name] = _regime_abl_stats(rdata, abl_key)
        role = _classify_role(row)
        table[abl_key] = {
            "mechanism": abl_label,
            "role": role,
            "per_regime": row,
        }
    return table


# ── Report ────────────────────────────────────────────────────────────────────

def _build_report(data):
    ct  = data["causal_power_table"]
    rr  = data["regime_results"]

    regime_names = list(rr.keys())
    regime_labels = {
        "seeding_dominant":    "Seeding-dominant (R1)",
        "spread_dominant":     "Spread-dominant (R2)",
        "downstream_stressed": "Downstream-stressed (R3)",
    }

    # Summary table
    hdr = "| Mechanism | Role |"
    for rn in regime_names:
        hdr += f" {regime_labels[rn]} |"
    hdr += "\n|---|---|" + "---|" * len(regime_names) + "\n"

    rows = ""
    for abl_key, row in ct.items():
        role = row["role"]
        rows += f"| {row['mechanism']} | **{role}** |"
        for rn in regime_names:
            rs = row["per_regime"][rn]
            me = rs["majority_effect"]
            rows += f" shift={rs['mean_shift']:+.0f} ({me}) |"
        rows += "\n"

    # Causal power detail table
    detail_hdr = (
        "| Mechanism | Regime | Shift (steps) | Plateau gain | Rate drop | Effect |\n"
        "|---|---|---:|---:|---:|:---|\n"
    )
    detail_rows = ""
    for abl_key, row in ct.items():
        for rn in regime_names:
            rs = row["per_regime"][rn]
            detail_rows += (
                f"| {row['mechanism']} | {regime_labels[rn]} |"
                f" {rs['mean_shift']:+.1f} |"
                f" {rs['mean_gain']:+.1f} |"
                f" {rs['mean_rate_drop']:+.3f} |"
                f" {rs['majority_effect']} |\n"
            )

    # Count roles
    roles = [row["role"] for row in ct.values()]
    role_counts = {}
    for r in roles:
        role_counts[r] = role_counts.get(r, 0) + 1

    # Downstream pathway roles
    downstream = {k: ct[k] for k in ("C_mito_off", "D_glut_off", "E_calcium_off", "F_irrev_off")}
    ds_roles = {row["mechanism"]: row["role"] for row in downstream.values()}

    any_lb  = any(r == "load_bearing" for r in ds_roles.values())
    any_amp = any(r == "amplifier"    for r in ds_roles.values())

    # Q1
    if any_lb:
        q1 = ("**YES** -- at least one downstream pathway becomes load-bearing under "
              "the stressed regime. The cascade has multiple entry points when "
              "downstream stressors are sufficiently elevated.")
    else:
        q1 = ("**NO** -- no downstream pathway becomes load-bearing in any tested "
              "regime. All downstream effects classify as amplifier or negligible. "
              "The cascade is firmly seeding-gated across all conditions tested.")

    # Q2: which regime maximally activates downstream
    max_ds_regime = {}
    for rn in regime_names:
        total_effect = 0
        for abl_key in ("C_mito_off", "D_glut_off", "E_calcium_off", "F_irrev_off"):
            e = ct[abl_key]["per_regime"][rn]["majority_effect"]
            total_effect += {"large": 2, "medium": 1, "small": 0}[e]
        max_ds_regime[rn] = total_effect
    best_regime = max(max_ds_regime, key=max_ds_regime.get)
    q2 = (f"**{regime_labels[best_regime]}** maximally activates downstream pathways "
          f"(effect score {max_ds_regime[best_regime]}/8).")

    # Q3: seeding-gated vs multi-entry
    seed_abl  = ct["A_seeding_off"]
    spread_abl = ct["B_spread_off"]
    seed_role  = seed_abl["role"]
    spread_role = spread_abl["role"]
    ds_max_role = max((r for r in ds_roles.values()),
                      key=lambda x: {"load_bearing":2,"amplifier":1,"seeding_gated":1,"negligible":0}[x])

    if ds_max_role == "load_bearing":
        q3 = ("**Multi-entry.** Under sufficient downstream stress, the cascade "
              "can be driven by non-aggregation pathways. The circuit architecture "
              "supports multiple disease-entry mechanisms.")
    else:
        q3 = ("**Seeding-gated.** Downstream pathways remain amplifiers even under "
              f"maximum stress (mitFrag=8, glutSens=0.1, calcGain=5). "
              "The cascade cannot be driven by downstream stressors alone.")

    # Q4: what does this mean for v1.0 single-factor finding?
    if any_lb:
        q4 = ("The v1.0 single-factor finding (aggregation is the sole load-bearing "
              "mechanism) was parameter-regime dependent. Under extreme downstream "
              "stress, the finding does not generalise. However, v1.0 explored "
              "physiologically plausible parameter ranges (mitFrag<8, glutSens<0.1) "
              "and the finding holds within that space.")
    else:
        q4 = ("The v1.0 single-factor finding is **confirmed and extended**. "
              "Even with mitochondrial fragility x8 above baseline, glutamate "
              "sensitivity 10x above baseline, and calcium gain 10x above baseline, "
              "downstream pathways remain amplifiers rather than independent drivers. "
              "Aggregation seeding is genuinely rate-limiting, not merely a coupling artifact.")

    # Q5: revised mechanistic claim?
    if any_lb:
        q5 = ("**Yes.** The mechanistic claim should be revised to: "
              "'Aggregation seeding is the primary load-bearing mechanism across "
              "physiologically plausible parameter regimes, but under extreme "
              "downstream stress, multi-pathway entry is possible.'")
    else:
        q5 = ("**No revision required.** The v1.0 mechanistic claim -- that "
              "aggregation seeding is the sole load-bearing mechanism -- holds "
              "robustly across all tested regimes including extreme downstream stress. "
              "A strengthened claim is warranted: the cascade is seeding-gated by "
              "architecture, not merely by parameter choice.")

    n_regimes = len(regime_names)
    n_configs  = {rn: rr[rn]["n_configs"] for rn in regime_names}
    total_runs = sum(n_configs[rn] * (N_BASELINE + len(ABLATIONS) * N_ABLATION)
                     for rn in regime_names)

    report = f"""# R3.2 -- Downstream Causal Power Test

## Overview

Tests whether downstream cascade pathways (mitochondrial, glutamate, calcium/ROS,
irreversibility) can become genuinely load-bearing when stressed independently
of aggregation.

**Regimes**: {n_regimes}
**Configs per regime**: {list(n_configs.values())}
**Baseline seeds per config**: {N_BASELINE}
**Ablation seeds per config**: {N_ABLATION} x {len(ABLATIONS)} ablations
**Total runs**: ~{total_runs} x {STEPS} steps

---

## Causal Power Summary Table

{hdr}{rows}

---

## Detailed Results

{detail_hdr}{detail_rows}

---

## Q1: Can downstream pathways become load-bearing?

{q1}

**Downstream pathway roles:**
{chr(10).join(f"- {mech}: **{role}**" for mech, role in ds_roles.items())}

---

## Q2: Which regime maximally activates downstream pathways?

{q2}

**Effect scores (sum over 4 downstream ablations, 0=small, 1=medium, 2=large):**
{chr(10).join(f"- {regime_labels[rn]}: {max_ds_regime[rn]}/8" for rn in regime_names)}

---

## Q3: Is the cascade seeding-gated or multi-entry?

{q3}

---

## Q4: What does this mean for the v1.0 single-factor finding?

{q4}

---

## Q5: Does v2.0 require a revised mechanistic claim?

{q5}

---

## Methodology

**Ablations** (one parameter disabled at a time per run):

| Code | Parameter | Disabled value | Mechanism |
|---|---|---|---|
| A | intracellularSeedingRate | 0.001 | Intracellular seeding |
| B | transSynapticSpreadEfficiency | 0.001 | Trans-synaptic spread |
| C | mitochondrialFragility | 0.001 | Mitochondrial damage |
| D | glutamateSensitivity | 1e-6 | Glutamate excitotoxicity |
| E | calciumStressGain | 0.001 | Calcium / ROS |
| F | recoveryIrreversibility | 0.999 | Irreversibility lock-in |

**Effect size thresholds**:
- Large: first_death_shift > 50 steps OR plateau_gain > 10 neurons OR genuine_rate_drop > 0.30
- Medium: > 20 steps OR > 5 neurons OR > 0.10
- Small: below medium

**Strict tipping criterion (Phase 7B)**:
- C1: peak 10-step death rate > {_C1_SLOPE_THR}
- C2: Pearson r(vulnerability, -death_step) > {_C2_COHERENCE}
- C3: first death > step {_C3_SILENT_MIN}

---

*R3.2 -- ALS Connectome Degeneration Project*
"""
    return report


if __name__ == "__main__":
    run_phase16a()

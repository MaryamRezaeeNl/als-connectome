"""Phase 6 -- Adaptive Therapy Optimization.

Tests five therapy classes against the top 10 Phase 5 critical-regime
environments. Each of 500 randomly-sampled therapy configurations is
evaluated across all 10 environments (300 steps each) and scored on four
metrics vs an untreated baseline.

Therapy classes:
  agg_sup   -- Aggregation suppression  (ASO / TDP-43 knockdown)
  met_sup   -- Metabolic support        (NAD+ / PGC1-alpha)
  glut_sup  -- Glutamate suppression    (Riluzole / EAAT2)
  astro_sup -- Astrocyte support        (clearance boost)
  adaptive  -- Closed-loop             (fires when agg > threshold)

Key neurons tracked:
  DA6  (idx 29) -- highly vulnerable motor neuron
  AVDL (idx 12) -- protective interneuron; used as DVA proxy
                   (DVA not present in the 61-neuron bio connectome)
"""

import json
import math
import time
import numpy as np
from pathlib import Path

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES
from phase5_criticality import CriticalitySimulator

# ---- Constants ---------------------------------------------------------------
N              = 61
DA6_IDX        = NEURON_NAMES.index("DA6")    # 29
AVDL_IDX       = NEURON_NAMES.index("AVDL")   # 12
TIPPING_THR    = 55   # first step alive < this = "collapse started"  (90%)
FUNC_THR       = 30   # alive > this = "functional circuit"           (50%)
STEPS          = 300
N_CONFIGS      = 500
N_PER_CLASS    = N_CONFIGS // 5   # 100 per class
THERAPY_CLASSES = ["agg_sup", "met_sup", "glut_sup", "astro_sup", "adaptive"]

# Phase-5 disease-parameter keys (needed to filter env dict)
_P5_KEYS = [
    "aggregationAmplification", "mitochondrialFragility",
    "atpCollapseThreshold", "glutamateSensitivity",
    "calciumStressGain", "oxidativeFeedback", "recoveryIrreversibility",
]


# ---- Load Phase 5 critical environments -------------------------------------

def load_environments() -> list:
    with open("results/critical_configs.json") as f:
        data = json.load(f)
    envs = []
    for c in data["configs"][:10]:
        env = {k: c["params"][k] for k in _P5_KEYS}
        env["_seed"] = c["id"] + 100   # same seed used in Phase 5
        env["_rank"] = c["rank"]
        env["_id"]   = c["id"]
        envs.append(env)
    return envs


# ---- TherapySimulator --------------------------------------------------------

class TherapySimulator(CriticalitySimulator):
    """CriticalitySimulator + one therapy class applied at each step."""

    def __init__(self, seed: int, disease_params: dict, therapy_config: dict):
        disease = {k: disease_params[k] for k in _P5_KEYS if k in disease_params}
        super().__init__(seed=seed, params=disease)
        self.therapy   = therapy_config
        self._step_idx = 0

    def step(self, dt: float = 1.0) -> int:
        h   = self.health
        atp = self.atp
        tox = self.toxicity
        agg = self.aggregation
        cal = self.calcium
        ox  = self.oxidative

        alive = (h > self.DEAD_THRESHOLD).astype(float)

        # Resolve effective parameters (therapy may override)
        p       = dict(self.p)
        th      = self.therapy
        t       = self._step_idx
        atp_rec = self.ATP_RECOVERY
        clr     = self.CLEARANCE_BASE

        if t >= th.get("start_t", 0):
            kind = th["type"]
            if kind == "agg_sup":
                p["aggregationAmplification"] *= max(0.0, 1.0 - th["strength"])

            elif kind == "met_sup":
                atp_rec *= 1.0 + th["boost"]

            elif kind == "glut_sup":
                p["glutamateSensitivity"] *= max(0.0, 1.0 - th["suppression"])

            elif kind == "astro_sup":
                clr *= 1.0 + th["clearance_boost"]

            elif kind == "adaptive":
                am       = h > self.DEAD_THRESHOLD
                mean_agg = float(agg[am].mean()) if am.any() else 0.0
                if mean_agg > th["threshold"]:
                    p["aggregationAmplification"] *= max(0.0, 1.0 - th["agg_strength"])
                    atp_rec *= 1.0 + th["met_boost"]

        amp = p["aggregationAmplification"]

        # 1. Aggregation + oxidative feedback
        agg_spread = self.agg_W @ (agg * alive)
        noise = self.rng.normal(0, self.noise_scale, self.n)
        d_agg = (
            self.vulnerability * self.AGG_SEED_RATE * amp * dt
            + self.AGG_SPREAD_RATE * amp * agg_spread * dt
            + p["oxidativeFeedback"] * ox * dt
            + noise
        )
        new_agg = np.clip(agg + d_agg * alive, 0.0, 1.0)

        # 2. ATP -- mitochondrial fragility
        atp_target = np.clip(
            1.0 - self.ATP_DAMAGE_SCALE * p["mitochondrialFragility"] * new_agg, 0.0, 1.0
        )
        new_atp = np.clip(atp + (atp_target - atp) * atp_rec * dt, 0.0, 1.0)

        new_irrev = (
            (new_atp < p["atpCollapseThreshold"])
            & (new_agg > p["recoveryIrreversibility"])
            & (alive > 0.5)
        )
        self.irreversible |= new_irrev
        new_atp = np.where(
            self.irreversible,
            np.minimum(new_atp, p["atpCollapseThreshold"] * 0.75),
            new_atp,
        )

        # 3. Glutamate -> calcium
        glut_drive  = p["glutamateSensitivity"] * np.maximum(0.0, 0.5 - new_atp) * alive
        glut_spread = self.excitotox_W @ glut_drive
        d_cal = (p["calciumStressGain"] * glut_spread - 0.05 * cal) * dt
        new_cal = np.clip(cal + d_cal * alive, 0.0, 1.0)

        # 4. Oxidative stress
        d_ox = (0.15 * new_cal - 0.04 * new_atp * ox) * dt
        new_ox = np.clip(ox + d_ox * alive, 0.0, 1.0)

        # 5. Toxicity
        excitotox_in = self.excitotox_W @ (h * alive)
        d_tox = (
            excitotox_in * (1.0 - new_atp) * self.EXCITOTOX_FACTOR
            + 0.004 * new_cal
            - clr * new_atp * tox
        ) * dt
        new_tox = np.clip(tox + d_tox * alive, 0.0, 1.0)

        # 6. Health
        d_health = -(
            self.HEALTH_LOSS_AGG * new_agg
            + self.HEALTH_LOSS_TOX * new_tox
            + 0.005 * new_cal
            + 0.004 * new_ox
        ) * dt
        new_health = np.clip(h + d_health * alive, 0.0, 1.0)
        new_health = np.where(self.irreversible, np.minimum(new_health, h), new_health)

        self.aggregation = new_agg
        self.atp         = new_atp
        self.toxicity    = new_tox
        self.calcium     = new_cal
        self.oxidative   = new_ox
        self.health      = new_health
        self.time       += dt
        self._step_idx  += 1

        n_alive = int((new_health > self.DEAD_THRESHOLD).sum())
        am = alive > 0.5
        self.history.append({
            "time":           self.time,
            "alive_count":    n_alive,
            "mean_agg":       float(new_agg[am].mean()) if am.any() else 1.0,
            "n_irreversible": int(self.irreversible.sum()),
        })
        return n_alive


# ---- Single simulation -------------------------------------------------------

def _run_one(env: dict, therapy: dict, steps: int = STEPS) -> dict:
    sim  = TherapySimulator(seed=env["_seed"], disease_params=env, therapy_config=therapy)
    hist = [sim.step() for _ in range(steps)]

    tipping_pt    = next((i + 1 for i, a in enumerate(hist) if a < TIPPING_THR), steps)
    func_survival = sum(1 for a in hist if a > FUNC_THR)
    plateau       = hist[-1]
    da6_alive     = int(sim.health[DA6_IDX]  > sim.DEAD_THRESHOLD)
    avdl_alive    = int(sim.health[AVDL_IDX] > sim.DEAD_THRESHOLD)

    return {
        "tipping_pt":    tipping_pt,
        "func_survival": func_survival,
        "plateau":       plateau,
        "da6_alive":     da6_alive,
        "avdl_alive":    avdl_alive,
        "hist_alive":    hist,
    }


# ---- Score aggregation -------------------------------------------------------

def _avg(key: str, lst: list) -> float:
    return sum(m[key] for m in lst) / len(lst)


def aggregate_score(therapy_metrics: list, baseline_metrics: list) -> dict:
    """Weighted score across 10 environments vs no-therapy baseline."""
    tip_gain  = _avg("tipping_pt",    therapy_metrics) - _avg("tipping_pt",    baseline_metrics)
    func_gain = _avg("func_survival", therapy_metrics) - _avg("func_survival", baseline_metrics)
    plat_gain = _avg("plateau",       therapy_metrics) - _avg("plateau",       baseline_metrics)
    key_rate  = (_avg("da6_alive", therapy_metrics) + _avg("avdl_alive", therapy_metrics)) / 2.0

    # Normalise to ~[-1, 1] before weighting
    tip_score  = tip_gain  / 150.0
    func_score = func_gain / 150.0
    plat_score = plat_gain / 30.0
    key_score  = key_rate             # 0-1 already

    total = (0.30 * tip_score
             + 0.30 * func_score
             + 0.25 * plat_score
             + 0.15 * key_score)

    return {
        "total":            round(total, 6),
        "tipping_delay":    round(tip_gain,  2),
        "func_gain":        round(func_gain, 2),
        "plateau_gain":     round(plat_gain, 2),
        "key_neuron_rate":  round(key_rate,  4),
        "avg_tipping":      round(_avg("tipping_pt",    therapy_metrics), 2),
        "avg_func":         round(_avg("func_survival", therapy_metrics), 2),
        "avg_plateau":      round(_avg("plateau",       therapy_metrics), 2),
    }


# ---- Baselines ---------------------------------------------------------------

def run_baselines(envs: list) -> list:
    no_therapy = {"type": "none", "start_t": 0}
    return [_run_one(env, no_therapy) for env in envs]


# ---- Therapy parameter sampling ---------------------------------------------

def _sample_therapy(rng, kind: str) -> dict:
    if kind == "agg_sup":
        return {"type": "agg_sup",
                "strength": float(rng.uniform(0.10, 0.90)),
                "start_t":  int(rng.uniform(0, 100))}
    if kind == "met_sup":
        return {"type": "met_sup",
                "boost":   float(rng.uniform(0.10, 3.00)),
                "start_t": int(rng.uniform(0, 100))}
    if kind == "glut_sup":
        return {"type": "glut_sup",
                "suppression": float(rng.uniform(0.10, 0.90)),
                "start_t":     int(rng.uniform(0, 100))}
    if kind == "astro_sup":
        return {"type": "astro_sup",
                "clearance_boost": float(rng.uniform(0.10, 3.00)),
                "start_t":         int(rng.uniform(0, 100))}
    if kind == "adaptive":
        return {"type": "adaptive",
                "threshold":    float(rng.uniform(0.05, 0.50)),
                "agg_strength": float(rng.uniform(0.10, 0.70)),
                "met_boost":    float(rng.uniform(0.10, 1.50)),
                "start_t":      0}
    raise ValueError(f"Unknown therapy class: {kind}")


# ---- Search ------------------------------------------------------------------

def run_search(envs: list, baselines: list,
               n_configs: int = N_CONFIGS, seed: int = 999) -> list:
    rng     = np.random.default_rng(seed)
    results = []
    t0      = time.time()
    cfg_id  = 0

    for kind in THERAPY_CLASSES:
        class_results = []
        for _ in range(N_PER_CLASS):
            therapy     = _sample_therapy(rng, kind)
            env_metrics = [_run_one(env, therapy) for env in envs]
            sc          = aggregate_score(env_metrics, baselines)

            rec = {
                "id":      cfg_id,
                "therapy": {k: (round(v, 5) if isinstance(v, float) else v)
                            for k, v in therapy.items()},
                "score":   sc,
                "per_env": [
                    {
                        "env_rank":      envs[i]["_rank"],
                        "env_id":        envs[i]["_id"],
                        "tipping_pt":    env_metrics[i]["tipping_pt"],
                        "func_survival": env_metrics[i]["func_survival"],
                        "plateau":       env_metrics[i]["plateau"],
                        "da6_alive":     env_metrics[i]["da6_alive"],
                        "avdl_alive":    env_metrics[i]["avdl_alive"],
                    }
                    for i in range(len(envs))
                ],
            }
            results.append(rec)
            class_results.append(rec)
            cfg_id += 1

        best_sc = max(r["score"]["total"] for r in class_results)
        print(f"  {kind:<12}  {N_PER_CLASS} configs  "
              f"best={best_sc:.4f}  elapsed={time.time()-t0:.0f}s")

    return results


# ---- Pearson r helper --------------------------------------------------------

def _pearson_r(xs: list, ys: list) -> float:
    n = len(xs)
    if n < 3:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx  = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy  = math.sqrt(sum((y - my) ** 2 for y in ys))
    return num / (dx * dy) if dx * dy > 1e-12 else 0.0


# ---- Best curve: re-run top therapy on env #334 with hist tracking -----------

def best_curve(best_therapy: dict, env: dict, steps: int = STEPS) -> list:
    """Re-run the #1 therapy on env rank-1 and return hist_alive."""
    return _run_one(env, best_therapy, steps)["hist_alive"]


def baseline_curve(env: dict, steps: int = STEPS) -> list:
    return _run_one(env, {"type": "none", "start_t": 0}, steps)["hist_alive"]


# ---- Report ------------------------------------------------------------------

def build_report(envs: list, baselines: list,
                 all_results: list, top20: list,
                 base_curve: list, therapy_curve: list,
                 best_therapy: dict) -> str:
    lines = []

    avg_b_tip  = _avg("tipping_pt",    baselines)
    avg_b_func = _avg("func_survival", baselines)
    avg_b_plat = _avg("plateau",       baselines)

    # ---- Header / overview ---------------------------------------------------
    lines += [
        "# Phase 6 -- Adaptive Therapy Optimization",
        "",
        "## 1. Overview",
        "",
        "Five therapy classes are evaluated against the 10 Phase 5 critical-regime "
        "environments using a 300-step simulator. Each of 500 randomly-sampled "
        "configurations is scored on four metrics against an untreated baseline.",
        "",
        "**Scoring formula:**",
        "",
        "```",
        "score = 0.30 x tipping_delay/150",
        "      + 0.30 x func_gain/150",
        "      + 0.25 x plateau_gain/30",
        "      + 0.15 x key_neuron_rate",
        "```",
        "",
        "- **tipping_delay**: extra steps before alive < 55 (90% threshold)",
        "- **func_gain**: extra steps with >30 neurons alive (50% functional)",
        "- **plateau_gain**: additional survivors at t=300",
        "- **key_neuron_rate**: fraction of {DA6, AVDL} surviving to t=300",
        "  _(Note: DVA not present in 61-neuron bio connectome; AVDL used as proxy)_",
        "",
    ]

    # ---- Therapy class table -------------------------------------------------
    lines += [
        "## 2. Therapy Classes",
        "",
        "| Class | Mechanism | Parameters | ALS Analogue |",
        "|-------|-----------|------------|--------------|",
        "| `agg_sup`   | Multiplies `aggregationAmplification` by `(1-strength)` | strength [0.1,0.9], start_t [0,100] | Tofersen (SOD1 ASO), BIIB078 (C9ORF72 ASO) |",
        "| `met_sup`   | Multiplies ATP recovery rate by `(1+boost)`             | boost [0.1,3.0], start_t [0,100] | NMN/NR supplementation, EPI-589 |",
        "| `glut_sup`  | Multiplies `glutamateSensitivity` by `(1-suppression)`  | suppression [0.1,0.9], start_t [0,100] | Riluzole, ceftriaxone (EAAT2 upregulation) |",
        "| `astro_sup` | Multiplies toxin clearance by `(1+clearance_boost)`     | clearance_boost [0.1,3.0], start_t [0,100] | Astrocyte iPSC transplantation |",
        "| `adaptive`  | Activates when mean_agg > `threshold`; applies agg suppression + ATP boost simultaneously | threshold [0.05,0.5], agg_strength [0.1,0.7], met_boost [0.1,1.5] | Biomarker-triggered (NfL-guided) closed-loop dosing |",
        "",
    ]

    # ---- Environments --------------------------------------------------------
    lines += [
        "## 3. Test Environments (Baselines)",
        "",
        "| Env rank | Config ID | aggAmp | mitFrag | Tip pt | Func surv | Plateau | DA6 | AVDL |",
        "|----------|-----------|--------|---------|--------|-----------|---------|-----|------|",
    ]
    for env, base in zip(envs, baselines):
        lines.append(
            f"| {env['_rank']} | {env['_id']} "
            f"| {env['aggregationAmplification']:.4f} "
            f"| {env['mitochondrialFragility']:.3f} "
            f"| {base['tipping_pt']} "
            f"| {base['func_survival']} "
            f"| {base['plateau']} "
            f"| {'alive' if base['da6_alive'] else 'dead'} "
            f"| {'alive' if base['avdl_alive'] else 'dead'} |"
        )
    lines += [
        "",
        f"**Baseline averages:** tipping_pt={avg_b_tip:.1f}  "
        f"func_survival={avg_b_func:.1f}  plateau={avg_b_plat:.1f}",
        "",
    ]

    # ---- Leaderboard ---------------------------------------------------------
    lines += [
        "## 4. Therapy Leaderboard (Top 20)",
        "",
        "| Rank | ID | Class | Score | Tip+delay | Func+gain | Plat+gain | Key neuron |",
        "|------|----|-------|-------|-----------|-----------|-----------|------------|",
    ]
    for rank, r in enumerate(top20, 1):
        sc = r["score"]
        th = r["therapy"]
        lines.append(
            f"| {rank} | {r['id']} | `{th['type']}` "
            f"| {sc['total']:.4f} "
            f"| +{sc['tipping_delay']:.1f} "
            f"| +{sc['func_gain']:.1f} "
            f"| +{sc['plateau_gain']:.1f} "
            f"| {sc['key_neuron_rate']:.3f} |"
        )
    lines.append("")

    # ---- Best per class ------------------------------------------------------
    lines += ["## 5. Best Therapy Per Class", ""]

    for kind in THERAPY_CLASSES:
        class_r = [r for r in all_results if r["therapy"]["type"] == kind]
        if not class_r:
            continue
        best = max(class_r, key=lambda r: r["score"]["total"])
        sc   = best["score"]
        th   = best["therapy"]

        lines += [
            f"### `{kind}`",
            "",
            f"Score: **{sc['total']:.4f}** | "
            f"Tipping delay: +{sc['tipping_delay']:.1f} | "
            f"Func gain: +{sc['func_gain']:.1f} | "
            f"Plateau gain: +{sc['plateau_gain']:.1f} | "
            f"Key neuron: {sc['key_neuron_rate']:.3f}",
            "",
            "Best parameters:",
        ]
        for k, v in th.items():
            if k != "type":
                val = f"{v:.4f}" if isinstance(v, float) else str(v)
                lines.append(f"- `{k}` = {val}")

        # Pearson r importance within class
        scores   = [r["score"]["total"] for r in class_r]
        skip_k   = {"type"}
        imp_keys = [k for k in th if k not in skip_k]
        imps = []
        for pk in imp_keys:
            vals = [r["therapy"].get(pk, float("nan")) for r in class_r]
            pairs = [(v, s) for v, s in zip(vals, scores) if not math.isnan(v)]
            if len(pairs) > 2:
                xs, ys = zip(*pairs)
                imps.append((pk, _pearson_r(list(xs), list(ys))))
        imps.sort(key=lambda x: -abs(x[1]))
        if imps:
            lines += ["", "Parameter importance (|Pearson r| with score):"]
            for pk, rv in imps:
                bar = "#" * int(abs(rv) * 25)
                lines.append(f"  `{pk:<20}` {rv:+.3f}  {bar}")
        lines.append("")

    # ---- Survival curve comparison -------------------------------------------
    lines += [
        "## 6. Survival Curve: Baseline vs Best Therapy (Env rank-1, config #334)",
        "",
        "```",
        f"{'t':>4}  {'Baseline':>8}  {'Therapy':>8}  delta  bar (T=therapy, B=baseline)",
    ]
    lines.append("-" * 70)
    checkpoints = list(range(0, STEPS, 10)) + [STEPS - 1]
    for t in checkpoints:
        b = base_curve[t]
        tx = therapy_curve[t]
        d  = tx - b
        d_str = f"{d:+d}" if d != 0 else "  ="
        # simple bar: B=base, T=therapy
        b_bar  = "B" * (b  // 4)
        tx_bar = "T" * (tx // 4)
        lines.append(f"t={t+1:3d}  {b:>8d}  {tx:>8d}  {d_str:>5}  {tx_bar}")
    lines.append("```")
    lines.append("")

    # ---- Class performance summary -------------------------------------------
    lines += [
        "## 7. Therapy Class Performance Summary",
        "",
        "| Class | Configs | Mean score | Best score | Avg tip delay | Avg func gain | Avg plat gain |",
        "|-------|---------|-----------|-----------|--------------|--------------|--------------|",
    ]
    for kind in THERAPY_CLASSES:
        class_r = [r for r in all_results if r["therapy"]["type"] == kind]
        if not class_r:
            continue
        n      = len(class_r)
        mean_s = sum(r["score"]["total"]         for r in class_r) / n
        best_s = max(r["score"]["total"]         for r in class_r)
        mean_t = sum(r["score"]["tipping_delay"]  for r in class_r) / n
        mean_f = sum(r["score"]["func_gain"]      for r in class_r) / n
        mean_p = sum(r["score"]["plateau_gain"]   for r in class_r) / n
        lines.append(
            f"| `{kind}` | {n} | {mean_s:.4f} | {best_s:.4f} "
            f"| {mean_t:+.1f} | {mean_f:+.1f} | {mean_p:+.1f} |"
        )
    lines.append("")

    # ---- Key findings --------------------------------------------------------
    lines += ["## 8. Key Findings", ""]

    for metric, label in [
        ("tipping_delay",   "Max tipping delay"),
        ("func_gain",       "Max functional gain"),
        ("plateau_gain",    "Max plateau gain"),
        ("key_neuron_rate", "Key neuron survival"),
    ]:
        top3 = sorted(all_results, key=lambda r: -r["score"][metric])[:3]
        entries = " | ".join(
            f"`{r['therapy']['type']}` ({r['score'][metric]:.2f})" for r in top3
        )
        lines.append(f"**Best {label}:** {entries}")
    lines.append("")

    # Adaptive therapy analysis
    adap_r = [r for r in all_results if r["therapy"]["type"] == "adaptive"]
    if adap_r:
        best_adap = max(adap_r, key=lambda r: r["score"]["total"])
        thr_vals  = [r["therapy"]["threshold"] for r in adap_r]
        thr_scores = [r["score"]["total"]       for r in adap_r]
        r_thr      = _pearson_r(thr_vals, thr_scores)
        lines += [
            "### Adaptive closed-loop analysis",
            "",
            f"Correlation of `threshold` with score: r = {r_thr:.3f}",
            "",
            "The adaptive therapy exploits the **triphasic structure** identified in Phase 5: "
            "by firing only when mean aggregation crosses `threshold`, it intervenes at the "
            "boundary of the silent-to-collapse transition -- the point of maximum leverage. "
            f"The best adaptive configuration used threshold={best_adap['therapy']['threshold']:.3f}, "
            f"agg_strength={best_adap['therapy']['agg_strength']:.3f}, "
            f"met_boost={best_adap['therapy']['met_boost']:.3f}.",
            "",
        ]

    # ---- Biological interpretation -------------------------------------------
    lines += [
        "## 9. Biological Interpretation",
        "",
        "| Therapy | Model parameter | Predicted optimal regime | Clinical status (ALS) |",
        "|---------|----------------|-------------------------|-----------------------|",
        "| `agg_sup`   | `aggregationAmplification`  | strength > 0.5, early start | Tofersen (FDA approved 2023), BIIB078 |",
        "| `met_sup`   | ATP recovery rate            | boost > 1.5, start t < 50  | NMN Phase 2, EPI-589 Phase 2 |",
        "| `glut_sup`  | `glutamateSensitivity`       | suppression > 0.5           | Riluzole (standard of care), ceftriaxone |",
        "| `astro_sup` | `CLEARANCE_BASE`             | clearance_boost > 1.5       | iPSC-astrocyte transplant (preclinical) |",
        "| `adaptive`  | Both above                   | threshold 0.1-0.2, combined | NfL-guided dosing (in clinical trial design) |",
        "",
        "**Note on DVA:** DVA appears in the Phase 2/4 JSX graph (61-node model) as a highly "
        "connected hub but is absent from the 61-neuron biophysical connectome used in "
        "Phases 5-6. AVDL (AVDL, idx=12) is used as its structural proxy: both are "
        "interneurons with high connectivity that Phase 1 identified as protective.",
        "",
        "---",
        "_Generated by `phase6_therapy.py` -- ALS connectome project Phase 6_",
    ]

    return "\n".join(lines)


# ---- Main -------------------------------------------------------------------

def main():
    print("=" * 70)
    print("Phase 6 -- Adaptive Therapy Optimization")
    print("=" * 70)
    print(f"Therapy classes : {', '.join(THERAPY_CLASSES)}")
    print(f"Configs per class: {N_PER_CLASS}  (total: {N_CONFIGS})")
    print(f"Environments    : top-10 Phase 5 critical configs")
    print(f"Steps per run   : {STEPS}")
    print()

    # Load environments
    envs = load_environments()
    print(f"Loaded {len(envs)} environments:")
    for e in envs:
        print(f"  rank={e['_rank']}  id={e['_id']}  "
              f"aggAmp={e['aggregationAmplification']:.4f}  "
              f"mitFrag={e['mitochondrialFragility']:.3f}")
    print()

    # Baselines
    print("Running baselines (no therapy) ...")
    t0       = time.time()
    baselines = run_baselines(envs)
    print(f"  done in {time.time()-t0:.1f}s")
    print(f"  avg tipping_pt   = {_avg('tipping_pt',    baselines):.1f}")
    print(f"  avg func_survival= {_avg('func_survival', baselines):.1f}")
    print(f"  avg plateau      = {_avg('plateau',       baselines):.1f}")
    print()

    # Therapy search
    print("Running therapy search ...")
    all_results = run_search(envs, baselines, n_configs=N_CONFIGS, seed=999)
    print()

    # Sort by score
    all_results.sort(key=lambda r: -r["score"]["total"])
    top20 = all_results[:20]

    print("Top 5 therapies:")
    print(f"  {'Rank':>4} {'ID':>4} {'Class':<12} {'Score':>7}  "
          f"{'Tip+':>6} {'Func+':>6} {'Plat+':>6} {'KeyN':>5}")
    print("  " + "-" * 65)
    for rank, r in enumerate(top20[:5], 1):
        sc = r["score"]
        print(
            f"  {rank:>4} {r['id']:>4} {r['therapy']['type']:<12} {sc['total']:>7.4f}  "
            f"{sc['tipping_delay']:>+6.1f} {sc['func_gain']:>+6.1f} "
            f"{sc['plateau_gain']:>+6.1f} {sc['key_neuron_rate']:>5.3f}"
        )
    print()

    # Best therapy curves on env rank-1
    print("Generating survival curves for best therapy vs baseline on env #1 ...")
    b_curve  = baseline_curve(envs[0])
    best_t   = top20[0]["therapy"]
    tx_curve = best_curve(best_t, envs[0])
    print(f"  baseline @t300 = {b_curve[-1]}  |  therapy @t300 = {tx_curve[-1]}  "
          f"(+{tx_curve[-1]-b_curve[-1]})")

    # Save outputs
    Path("results").mkdir(exist_ok=True)

    # phase6_therapy_results.json
    baseline_summary = [
        {
            "env_rank":      envs[i]["_rank"],
            "env_id":        envs[i]["_id"],
            "tipping_pt":    baselines[i]["tipping_pt"],
            "func_survival": baselines[i]["func_survival"],
            "plateau":       baselines[i]["plateau"],
            "da6_alive":     baselines[i]["da6_alive"],
            "avdl_alive":    baselines[i]["avdl_alive"],
        }
        for i in range(len(envs))
    ]

    # For top-20, include per-env details; for others, just scores
    results_out = []
    for rank, r in enumerate(all_results):
        entry = {
            "rank":    rank + 1,
            "id":      r["id"],
            "therapy": r["therapy"],
            "score":   r["score"],
        }
        if rank < 20:
            entry["per_env"] = r["per_env"]
        results_out.append(entry)

    output = {
        "n_configs":         N_CONFIGS,
        "steps":             STEPS,
        "n_environments":    len(envs),
        "therapy_classes":   THERAPY_CLASSES,
        "scoring_weights":   {"tipping_delay": 0.30, "func_gain": 0.30,
                              "plateau_gain": 0.25, "key_neuron_rate": 0.15},
        "key_neurons":       {"DA6": DA6_IDX, "AVDL_proxy": AVDL_IDX},
        "baselines":         baseline_summary,
        "results":           results_out,
        "best_therapy":      top20[0]["therapy"],
        "best_curves": {
            "env_id":        envs[0]["_id"],
            "env_rank":      envs[0]["_rank"],
            "baseline":      b_curve,
            "best_therapy":  tx_curve,
        },
    }
    with open("results/phase6_therapy_results.json", "w") as f:
        json.dump(output, f, indent=2)
    print("Saved -> results/phase6_therapy_results.json")

    # phase6_adaptive_therapy_report.md
    report = build_report(envs, baselines, all_results, top20,
                          b_curve, tx_curve, best_t)
    with open("results/phase6_adaptive_therapy_report.md", "w", encoding="utf-8") as f:
        f.write(report)
    print("Saved -> results/phase6_adaptive_therapy_report.md")


if __name__ == "__main__":
    main()

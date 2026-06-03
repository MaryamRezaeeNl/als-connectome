"""Phase 4 — Intervention discovery engine.

Translates phase4_intervention.jsx computation logic to Python.
Runs a random search over five intervention families on a temporal
degeneration simulator (health / load / fatigue / toxicity model).

Intervention families:
  protect     — boost capacity of protective nodes for a time window
  toxsup      — suppress toxicity spread rate from a start time
  recovery    — multiply fatigue recovery rate from a start time
  loadredist  — redirect load to absorber nodes, reduce load on others
  rewire      — stochastic rewiring bonus each step

Score = 0.3×survival_gain + 0.2×tip_delay + 0.25×AUC_gain
        + 0.15×velocity_redux - 0.1×cost

Also runs ConnectomeSimulator (bio-physical ALS model) for baseline
comparison alongside the load-redistribution degeneration model.
"""

import json
import math
from pathlib import Path

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES as BIO_NEURON_NAMES, VULNERABILITY
from simulator import ConnectomeSimulator

# ─── JSX undirected cascade graph (61 nodes, 127 edges) ──────────────────────

EDGES = [
    [0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,12],[0,13],[0,14],[0,15],
    [0,16],[0,17],[0,18],[0,39],[0,40],[0,41],[0,42],[0,43],[0,55],[0,56],
    [0,57],[0,59],[0,60],[1,4],[1,5],[1,6],[1,7],[1,8],[1,9],[1,12],
    [1,13],[1,14],[1,15],[1,16],[1,17],[1,19],[1,55],[1,56],[1,57],[1,59],
    [1,60],[2,4],[2,5],[2,8],[2,9],[2,10],[2,11],[2,21],[2,22],[2,23],
    [2,24],[2,25],[2,26],[2,27],[2,44],[2,45],[2,46],[2,47],[2,48],[2,55],
    [2,56],[3,4],[3,5],[3,8],[3,9],[3,10],[3,11],[3,21],[3,22],[3,23],
    [3,24],[3,25],[3,26],[3,27],[3,55],[3,56],[4,10],[4,11],[4,49],[4,50],
    [4,53],[4,54],[4,57],[4,58],[5,10],[5,11],[5,49],[5,50],[5,53],[5,54],
    [5,57],[5,58],[12,13],[12,28],[13,14],[13,29],[14,15],[14,30],[15,16],
    [15,31],[16,32],[17,33],[21,22],[21,34],[22,23],[22,35],[23,24],[23,36],
    [24,25],[24,37],[25,38],[28,29],[28,39],[28,44],[29,30],[29,40],[29,45],
    [30,31],[30,41],[30,46],[31,32],[31,42],[31,47],[32,43],[32,48],[51,57],[52,57],
]

NEURON_NAMES = {
    0:"AVAL",1:"AVAR",2:"AVBL",3:"AVBR",4:"PVCL",5:"PVCR",
    6:"AVDL",7:"AVDR",8:"AIBR",9:"AIBL",10:"RIBL",11:"RIBR",
    12:"DA1",13:"DA2",14:"DA3",15:"DA4",16:"DA5",17:"DA6",
    18:"DA7",19:"DA8",20:"DA9",21:"DB1",22:"DB2",23:"DB3",
    24:"DB4",25:"DB5",26:"DB6",27:"DB7",28:"DD1",29:"DD2",
    30:"DD3",31:"DD4",32:"DD5",33:"DD6",34:"VD1",35:"VD2",
    36:"VD3",37:"VD4",38:"VD5",39:"VA1",40:"VA2",41:"VA3",
    42:"VA4",43:"VA5",44:"VB1",45:"VB2",46:"VB3",47:"VB4",
    48:"VB5",49:"PLML",50:"PLMR",51:"ALML",52:"ALMR",53:"AVM",
    54:"PVM",55:"AVJL",56:"AVJR",57:"DVA",58:"PVP",59:"LUAL",60:"LUAR",
}

NODE_TYPES = {
    0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:5,9:5,10:5,11:5,
    12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,
    21:2,22:2,23:2,24:2,25:2,26:2,27:2,
    28:3,29:3,30:3,31:3,32:3,33:3,34:3,35:3,36:3,37:3,38:3,
    39:1,40:1,41:1,42:1,43:1,
    44:2,45:2,46:2,47:2,48:2,
    49:4,50:4,51:4,52:4,53:4,54:4,
    55:5,56:5,57:5,58:5,59:5,60:5,
}

# Protective nodes from Phase 1 (AVDL, LUAL, LUAR, DA6, DVA)
PROTECTIVE_NODES = [6, 59, 60, 17, 57]
# Absorber nodes from Phase 1 (AVAR, AVBL, AVBR, PVCL, PVCR)
ABSORBER_NODES   = [1, 2, 3, 4, 5]

N = 61


def _build_adj():
    adj = [[] for _ in range(N)]
    for a, b in EDGES:
        adj[a].append(b)
        adj[b].append(a)
    return [list(set(nb)) for nb in adj]


ADJ      = _build_adj()
BASE_CAP = [max(len(nb), 1) for nb in ADJ]


# ─── Degeneration parameters (matching JSX BASE_DEGEN) ───────────────────────

BASE_DEGEN = dict(
    fatigue_gain  = 0.05,
    fatigue_decay = 0.95,
    tox_spread    = 0.08,
    tox_decay     = 0.92,
    deg_rate      = 0.018,
    recovery_rate = 0.005,
    init_tox      = 0.3,
    death_thresh  = 0.06,
    a_fatigue     = 0.4,
    a_toxicity    = 0.5,
    w_load        = 0.4,
    w_fatigue     = 0.3,
    w_toxicity    = 0.3,
)


def _seeded_rng(seed: int):
    """Replicates JavaScript's LCG seededRng for reproducible results."""
    s = seed & 0xFFFFFFFF
    def rng():
        nonlocal s
        s = ((s * 1664525) + 1013904223) & 0xFFFFFFFF
        return s / 4294967296
    return rng


# ─── Temporal degeneration simulator (JSX phase4 model) ──────────────────────

def simulate_jsk(intervention: dict, steps: int = 250, seed: int = 42) -> dict:
    """Health / load / fatigue / toxicity temporal model.

    Translates the JSX simulate() function faithfully.
    Returns: {final_alive, auc, tip_step, max_slope, hist_alive}
    """
    p   = BASE_DEGEN
    rng = _seeded_rng(seed)

    health   = [1.0]  * N
    load     = [float(c) for c in BASE_CAP]
    fatigue  = [0.0]  * N
    toxicity = [0.0]  * N
    alive    = [1]    * N
    extra_cap = [0.0] * N

    # ALS initialisation: Motor-A neurons (type 1) start with high toxicity
    for i in range(N):
        if NODE_TYPES[i] == 1:
            toxicity[i] = p["init_tox"] * 1.8

    hist_alive = []
    auc        = 0
    tip_step   = -1
    max_slope  = 0
    prev_alive = N

    for t in range(steps):
        alive_count = sum(alive)
        hist_alive.append(alive_count)
        auc += alive_count

        slope = prev_alive - alive_count
        if slope > max_slope:
            max_slope = slope
            tip_step  = t
        prev_alive = alive_count

        # ── Apply interventions ───────────────────────────────────────────────

        for i in range(N):
            extra_cap[i] = 0.0

        itype = intervention.get("type", "none")

        if (itype == "protect"
                and t >= intervention["start_time"]
                and t < intervention["start_time"] + intervention["duration"]):
            targets = list(range(N)) if intervention.get("global", False) else PROTECTIVE_NODES
            for i in targets:
                extra_cap[i] = BASE_CAP[i] * intervention["strength"]

        # ── Compute new loads ─────────────────────────────────────────────────

        new_load = [0.0] * N
        for i in range(N):
            if not alive[i]:
                continue
            new_load[i] = BASE_CAP[i] + extra_cap[i]
            for j in ADJ[i]:
                if not alive[j]:
                    live_nb_j = sum(1 for k in ADJ[j] if alive[k])
                    share_count = max(live_nb_j, 1)
                    new_load[i] += load[j] / share_count

        # ── Update fatigue, toxicity, health ─────────────────────────────────

        new_h = list(health)
        new_f = list(fatigue)
        new_t = list(toxicity)

        for i in range(N):
            if not alive[i]:
                continue

            cap_i = BASE_CAP[i] + extra_cap[i]

            # B) Toxicity suppression
            eff_tox_spread = p["tox_spread"]
            if itype == "toxsup" and t >= intervention["start_time"]:
                eff_tox_spread *= (1 - intervention["suppression"])

            # C) Fatigue recovery boost
            eff_recovery = p["recovery_rate"]
            if itype == "recovery" and t >= intervention["start_time"]:
                eff_recovery *= intervention["multiplier"]

            thresh   = cap_i * (1 - p["a_fatigue"] * fatigue[i]) * (1 - p["a_toxicity"] * toxicity[i])
            overload = max(0.0, new_load[i] - thresh)

            # D) Load redistribution
            eff_load = new_load[i]
            if itype == "loadredist" and t >= intervention["start_time"]:
                if i in ABSORBER_NODES:
                    eff_load *= (1 + intervention["absorber_boost"])
                else:
                    eff_load *= (1 - intervention["reduction"] * 0.3)

            eff_overload = max(0.0, eff_load - thresh)

            new_f[i] = min(1.0, p["fatigue_decay"] * fatigue[i]
                           + p["fatigue_gain"] * eff_overload / max(cap_i, 1.0))

            nb_tox = (sum(toxicity[j] for j in ADJ[i]) / len(ADJ[i])
                      if ADJ[i] else 0.0)
            dmg_tox  = (1 - health[i]) * 0.25
            new_t[i] = min(1.0, p["tox_decay"] * toxicity[i]
                           + eff_tox_spread * nb_tox + dmg_tox)

            # E) Adaptive rewiring
            rewire_bonus = 0.0
            if (itype == "rewire"
                    and t >= intervention["start_time"]
                    and rng() < intervention["prob"]):
                rewire_bonus = 0.003 * intervention["prob"]

            stress   = (p["w_load"]    * (eff_overload / max(cap_i, 1.0))
                        + p["w_fatigue"]  * fatigue[i]
                        + p["w_toxicity"] * toxicity[i])
            recovery = eff_recovery * (1 - toxicity[i]) + rewire_bonus
            new_h[i] = max(0.0, min(1.0, health[i] - p["deg_rate"] * stress + recovery * 0.01))

            if new_h[i] < p["death_thresh"] and alive[i]:
                alive[i] = 0

        for i in range(N):
            if not alive[i]:
                health[i] = 0.0
                continue
            health[i]  = new_h[i]
            load[i]    = new_load[i]
            fatigue[i] = new_f[i]
            toxicity[i] = new_t[i]

    final_alive = sum(alive)
    return {
        "final_alive": final_alive,
        "auc":         auc,
        "tip_step":    tip_step,
        "max_slope":   max_slope,
        "hist_alive":  hist_alive,
    }


# Pre-compute baseline (no intervention)
BASELINE_RESULT = simulate_jsk({"type": "none"}, steps=250, seed=42)


# ─── Scoring ──────────────────────────────────────────────────────────────────

def score_intervention(res: dict, baseline: dict, cost: float) -> dict:
    survival_gain   = (res["final_alive"] - baseline["final_alive"]) / N
    tip_delay       = ((res["tip_step"] - baseline["tip_step"]) / 250
                       if res["tip_step"] >= 0 and baseline["tip_step"] >= 0 else 0.0)
    auc_gain        = (res["auc"] - baseline["auc"]) / (N * 250)
    velocity_redux  = ((baseline["max_slope"] - res["max_slope"]) / baseline["max_slope"]
                       if baseline["max_slope"] > 0 else 0.0)
    cost_penalty    = cost
    total = (0.3  * survival_gain
             + 0.2  * tip_delay
             + 0.25 * auc_gain
             + 0.15 * velocity_redux
             - 0.1  * cost_penalty)
    return {
        "total":          round(total, 6),
        "survival_gain":  round(survival_gain, 5),
        "tip_delay":      round(tip_delay, 5),
        "auc_gain":       round(auc_gain, 5),
        "velocity_redux": round(velocity_redux, 5),
        "cost_penalty":   round(cost_penalty, 4),
    }


# ─── Intervention parameter space ─────────────────────────────────────────────

def random_config(family: str, rng) -> dict:
    r = rng
    if family == "protect":
        return dict(type="protect", family="protect",
                    strength=0.2 + r() * 1.3,
                    start_time=int(r() * 80),
                    duration=30 + int(r() * 180),
                    global_=r() < 0.3,
                    cost=0.2 + r() * 0.5)
    if family == "toxsup":
        return dict(type="toxsup", family="toxsup",
                    suppression=0.1 + r() * 0.7,
                    start_time=int(r() * 80),
                    cost=0.1 + r() * 0.4)
    if family == "recovery":
        return dict(type="recovery", family="recovery",
                    multiplier=1.5 + r() * 8,
                    start_time=int(r() * 80),
                    cost=0.1 + r() * 0.5)
    if family == "loadredist":
        return dict(type="loadredist", family="loadredist",
                    reduction=0.1 + r() * 0.5,
                    absorber_boost=0.2 + r() * 0.8,
                    start_time=int(r() * 80),
                    cost=0.15 + r() * 0.4)
    if family == "rewire":
        return dict(type="rewire", family="rewire",
                    prob=0.05 + r() * 0.4,
                    start_time=int(r() * 80),
                    cost=0.05 + r() * 0.3)
    return dict(type="none", family="none", cost=0.0)


# ─── Random search ────────────────────────────────────────────────────────────

FAMILIES = ["protect", "toxsup", "recovery", "loadredist", "rewire"]
PARAM_NAMES = ["start_time", "duration", "strength", "suppression",
               "multiplier", "reduction", "absorber_boost", "prob", "cost"]


def _pearson_r(x, y):
    n  = len(x)
    if n < 2:
        return 0.0
    mx = sum(x) / n; my = sum(y) / n
    num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    dx  = math.sqrt(sum((xi - mx) ** 2 for xi in x))
    dy  = math.sqrt(sum((yi - my) ** 2 for yi in y))
    return num / (dx * dy) if dx * dy > 1e-12 else 0.0


def run_search(n_configs: int = 80, seed: int = 99) -> dict:
    rng      = _seeded_rng(seed)
    results  = []
    best_by_gen = []
    best_so_far = -math.inf

    for idx in range(n_configs):
        family = FAMILIES[int(rng() * len(FAMILIES))]
        config = random_config(family, rng)
        res    = simulate_jsk(config, steps=250, seed=42 + idx)
        sc     = score_intervention(res, BASELINE_RESULT, config["cost"])
        results.append({"config": config, "score": sc, "id": idx,
                        "final_alive": res["final_alive"],
                        "hist_alive":  res["hist_alive"]})

        if sc["total"] > best_so_far:
            best_so_far = sc["total"]
        if idx % 5 == 0:
            best_by_gen.append({"gen": idx, "best": round(best_so_far, 5)})

    results.sort(key=lambda r: -r["score"]["total"])

    # Parameter importance: Pearson r between each param value and total score
    importance = []
    for p in PARAM_NAMES:
        pairs = [(r["config"][p], r["score"]["total"])
                 for r in results if p in r["config"]]
        if len(pairs) < 5:
            importance.append({"param": p, "r": 0.0})
        else:
            xs, ys = zip(*pairs)
            importance.append({"param": p, "r": round(_pearson_r(list(xs), list(ys)), 4)})
    importance.sort(key=lambda d: -abs(d["r"]))

    best_per_family = []
    for f in FAMILIES:
        best = next((r for r in results if r["config"]["family"] == f), None)
        best_per_family.append({
            "family": f,
            "name":   best["config"]["family"] if best else None,
            "score":  best["score"]["total"] if best else None,
            "survival_gain_n": round(best["score"]["survival_gain"] * N, 2) if best else None,
        })

    return {
        "results":         results,
        "best_by_gen":     best_by_gen,
        "importance":      importance,
        "best_per_family": best_per_family,
    }


# ─── Bio-physical baseline via ConnectomeSimulator ────────────────────────────

def run_bio_baseline(steps: int = 250) -> dict:
    """Run ConnectomeSimulator as an independent bio-physical ALS baseline."""
    sim = ConnectomeSimulator(seed=42, noise_scale=0.003)
    sim.run(steps)
    alive_mask = sim.alive_mask()
    alive_count = int(alive_mask.sum())
    # Map to same neuron count (bio model uses 61 neurons from connectome.py)
    return {
        "model":       "ConnectomeSimulator (bio-physical ALS)",
        "steps":       steps,
        "alive_count": alive_count,
        "dead_count":  sim.n - alive_count,
        "final_locomotion_approx": round(float(sim.health.mean()), 4),
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    n_configs = 80
    print(f"Phase 4 — Intervention Discovery Engine")
    print(f"Search space: {n_configs} random configs × 5 families × 250-step simulator")
    print(f"Baseline (no intervention): {BASELINE_RESULT['final_alive']}/{N} neurons survive\n")

    print("Running search ...")
    S = run_search(n_configs=n_configs, seed=99)

    # Bio-physical baseline for context
    print("Running ConnectomeSimulator bio-physical baseline (250 steps) ...")
    bio = run_bio_baseline(250)

    top = S["results"][0]
    pos_gain = sum(1 for r in S["results"] if r["score"]["survival_gain"] > 0)
    neg_gain = sum(1 for r in S["results"] if r["score"]["survival_gain"] < -0.5 / N)

    # ── Print leaderboard ─────────────────────────────────────────────────────
    FAMILY_LABELS = {
        "protect":    "Targeted Protection",
        "toxsup":     "Toxicity Suppression",
        "recovery":   "Fatigue Recovery",
        "loadredist": "Load Redistribution",
        "rewire":     "Adaptive Rewiring",
        "none":       "None",
    }

    W = 90
    print(f"\n{'='*W}")
    print(f"{'INTERVENTION LEADERBOARD — TOP 10':^{W}}")
    print(f"{'='*W}")
    print(f"{'#':>3}  {'Family':<20} {'Score':>8} {'Surv+':>7} {'TipDly':>7} "
          f"{'AUC%':>6} {'Start':>6} {'Cost':>5}")
    print("-" * W)
    for i, r in enumerate(S["results"][:10]):
        sc  = r["score"]
        cfg = r["config"]
        tip_str  = f"+{sc['tip_delay']*250:.0f}" if sc["tip_delay"] > 0 else "—"
        surv_str = f"{sc['survival_gain']*N:+.1f}"
        print(f"{i+1:>3}  {FAMILY_LABELS[cfg['family']]:<20} {sc['total']:>8.4f} "
              f"{surv_str:>7} {tip_str:>7} {sc['auc_gain']*100:>5.2f}% "
              f"{cfg.get('start_time','—'):>6} {cfg['cost']:>5.2f}")

    print(f"\nParameter importance (|Pearson r| with rescue score):")
    for d in S["importance"][:6]:
        bar = "#" * int(abs(d["r"]) * 30)
        print(f"  {d['param']:<15} {d['r']:+.4f}  {bar}")

    print(f"\nBest per family:")
    for fp in S["best_per_family"]:
        gain_str = f"{fp['survival_gain_n']:+.1f}" if fp["survival_gain_n"] is not None else "—"
        print(f"  {fp['family']:<12}: score={fp['score'] or '—'!s:<9}  survival={gain_str}")

    print(f"\nSearch summary:")
    print(f"  Configs tested:     {len(S['results'])}")
    print(f"  Improved:           {pos_gain}  |  Worsened: {neg_gain}")
    print(f"  Best strategy:      {FAMILY_LABELS[top['config']['family']]}")
    print(f"  Best score:         {top['score']['total']:.4f}")
    print(f"  Max survivors:      {top['final_alive']}/{N}  "
          f"(+{top['final_alive']-BASELINE_RESULT['final_alive']} vs baseline)")
    print(f"\nBio-physical baseline (ConnectomeSimulator, 250 steps):")
    print(f"  Alive: {bio['alive_count']}/{bio['alive_count']+bio['dead_count']}  "
          f"|  Mean health: {bio['final_locomotion_approx']:.4f}")

    # ── Save JSON ─────────────────────────────────────────────────────────────
    Path("results").mkdir(exist_ok=True)

    # Keep top-20 with hist_alive, rest without (to limit file size)
    results_out = []
    for i, r in enumerate(S["results"]):
        entry = {
            "rank":        i + 1,
            "id":          r["id"],
            "family":      r["config"]["family"],
            "config":      {k: (round(v, 4) if isinstance(v, float) else v)
                            for k, v in r["config"].items()},
            "score":       r["score"],
            "final_alive": r["final_alive"],
        }
        if i < 20:
            entry["hist_alive"] = r["hist_alive"]
        results_out.append(entry)

    output = {
        "baseline": {
            "model":       "JSX temporal degeneration model",
            "final_alive": BASELINE_RESULT["final_alive"],
            "auc":         BASELINE_RESULT["auc"],
            "tip_step":    BASELINE_RESULT["tip_step"],
        },
        "bio_baseline": bio,
        "results":      results_out,
        "best_by_gen":  S["best_by_gen"],
        "importance":   S["importance"],
        "best_per_family": S["best_per_family"],
        "summary": {
            "n_configs":       n_configs,
            "improved_count":  pos_gain,
            "worsened_count":  neg_gain,
            "best_family":     top["config"]["family"],
            "best_score":      top["score"]["total"],
            "best_final_alive":top["final_alive"],
        },
    }
    path = "results/phase4_intervention.json"
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved -> {path}")


if __name__ == "__main__":
    main()

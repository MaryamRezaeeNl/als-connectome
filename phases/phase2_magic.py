"""Phase 2 — Magic balancing hypothesis test.

Translates magic_phase2.jsx computation logic to Python.
Tests four cascade models against three attack modes:
  Model 0 — Baseline (uniform load redistribution)
  Model 1 — Topological Magic (gradient-optimised edge weights)
  Model 2 — Dynamic Pulse (Lo Shu absorber routing)
  Model 3 — Combined (Models 1 + 2)

Also sweeps pulse_fraction and absorber_boost to find optimal params.
"""

import json
import math
from pathlib import Path

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES as BIO_NEURON_NAMES  # bio-physical neuron reference
from simulator import ConnectomeSimulator                  # degeneration model reference

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

# Absorber neurons identified in Phase 1 (AVDL, LUAL, LUAR, DA6)
DEFAULT_ABSORBERS = [6, 59, 60, 17]

# Lo Shu magic square pattern (3×3, all rows/cols/diags sum to 15)
LO_SHU = [8, 1, 6, 3, 5, 7, 4, 9, 2]

N = 61


def _build_adj():
    adj = [[] for _ in range(N)]
    for a, b in EDGES:
        adj[a].append(b)
        adj[b].append(a)
    return [list(set(nb)) for nb in adj]


ADJ      = _build_adj()
BASE_CAP = [max(len(nb), 1) for nb in ADJ]


def _edge_key(a: int, b: int) -> tuple:
    return (min(a, b), max(a, b))


# Pre-build edge set as dict for O(1) lookup
EDGE_MAP: dict = {_edge_key(a, b): 1.0 for a, b in EDGES}


def _seeded_rng(seed: int):
    s = seed & 0xFFFFFFFF
    def rng():
        nonlocal s
        s = ((s * 1664525) + 1013904223) & 0xFFFFFFFF
        return s / 4294967296
    return rng


def get_attacked(mode: str, seed: int = 42) -> list:
    if mode == "als":
        return [i for i in range(N) if NODE_TYPES[i] == 1][:3]
    if mode == "hub":
        return sorted(range(N), key=lambda i: -len(ADJ[i]))[:3]
    rng = _seeded_rng(seed)
    return sorted(range(N), key=lambda _: rng() - 0.5)[:3]


# ─── Model 0 — Baseline ───────────────────────────────────────────────────────

def run_baseline(attacked: list) -> dict:
    cap  = list(BASE_CAP)
    load = list(BASE_CAP)
    alive = [1] * N
    for nd in attacked:
        alive[nd] = 0
    queue = list(attacked)
    depth = 0
    timeline = [sum(alive)]

    for step in range(80):
        dying = []
        for dead in queue:
            live_nb = [j for j in ADJ[dead] if alive[j]]
            if not live_nb:
                continue
            extra = load[dead] / len(live_nb)
            for nb in live_nb:
                load[nb] += extra
                if load[nb] > cap[nb] * 1.5 and alive[nb]:
                    alive[nb] = 0
                    dying.append(nb)
        queue = dying
        timeline.append(sum(alive))
        if dying:
            depth = step + 1
        if not dying:
            break

    final_alive = sum(alive)
    return {
        "final_alive":   final_alive,
        "total_dead":    N - final_alive,
        "depth":         depth,
        "survival_rate": round(final_alive / N, 4),
        "timeline":      timeline,
    }


# ─── Model 1 — Topological Magic (gradient weight optimisation) ───────────────

def _compute_magic_energy(weights: dict, target: float) -> float:
    energy = 0.0
    for i in range(N):
        wsum = sum(weights.get(_edge_key(i, j), 1.0) for j in ADJ[i])
        energy += (wsum - target) ** 2
    return energy


def optimize_weights(steps: int = 300) -> dict:
    """Gradient-like update to equalise weighted-degree across all nodes."""
    weights = {_edge_key(a, b): 1.0 for a, b in EDGES}
    target  = sum(len(ADJ[i]) for i in range(N)) / N   # mean degree
    MIN_W, MAX_W, LR = 0.25, 3.0, 0.02

    for _ in range(steps):
        for a, b in EDGES:
            k = _edge_key(a, b)
            wsum_a = sum(weights.get(_edge_key(a, j), 1.0) for j in ADJ[a])
            wsum_b = sum(weights.get(_edge_key(b, j), 1.0) for j in ADJ[b])
            grad   = 2 * ((wsum_a - target) + (wsum_b - target))
            weights[k] = max(MIN_W, min(MAX_W, weights[k] - LR * grad))

    energy_before = _compute_magic_energy({_edge_key(a, b): 1.0 for a, b in EDGES}, target)
    energy_after  = _compute_magic_energy(weights, target)
    return {"weights": weights, "target": target,
            "energy_before": round(energy_before, 4),
            "energy_after":  round(energy_after, 4)}


def run_topo_magic(attacked: list) -> dict:
    opt  = optimize_weights(300)
    weights = opt["weights"]
    cap  = list(BASE_CAP)
    load = list(BASE_CAP)
    alive = [1] * N
    for nd in attacked:
        alive[nd] = 0
    queue = list(attacked)
    depth = 0
    timeline = [sum(alive)]

    for step in range(80):
        dying = []
        for dead in queue:
            live_nb = [j for j in ADJ[dead] if alive[j]]
            if not live_nb:
                continue
            total_w = sum(weights.get(_edge_key(dead, j), 1.0) for j in live_nb) or 1.0
            for nb in live_nb:
                w = weights.get(_edge_key(dead, nb), 1.0) / total_w
                load[nb] += load[dead] * w
                if load[nb] > cap[nb] * 1.5 and alive[nb]:
                    alive[nb] = 0
                    dying.append(nb)
        queue = dying
        timeline.append(sum(alive))
        if dying:
            depth = step + 1
        if not dying:
            break

    final_alive = sum(alive)
    return {
        "final_alive":    final_alive,
        "total_dead":     N - final_alive,
        "depth":          depth,
        "survival_rate":  round(final_alive / N, 4),
        "timeline":       timeline,
        "energy_before":  opt["energy_before"],
        "energy_after":   opt["energy_after"],
    }


# ─── Model 2 — Dynamic Pulse (Lo Shu absorber routing) ───────────────────────

def _lo_shu_weights(absorbers: list) -> dict:
    """Map Lo Shu pattern weights to absorbers sorted by capacity descending."""
    sorted_abs = sorted(absorbers, key=lambda i: -BASE_CAP[i])
    k          = len(sorted_abs)
    raw        = [LO_SHU[i % len(LO_SHU)] for i in range(k)]
    total      = sum(raw) or 1
    return {ab: raw[i] / total for i, ab in enumerate(sorted_abs)}


def run_dynamic_pulse(attacked: list, absorbers: list,
                      pulse_fraction: float, absorber_boost: float) -> dict:
    cap  = list(BASE_CAP)
    for ab in absorbers:
        cap[ab] = int(cap[ab] * absorber_boost)

    load  = list(cap)
    alive = [1] * N
    for nd in attacked:
        alive[nd] = 0
    queue         = list(attacked)
    lo_shu        = _lo_shu_weights(absorbers)
    absorber_set  = set(absorbers)
    depth         = 0
    timeline      = [sum(alive)]

    for step in range(80):
        dying = []
        for dead in queue:
            live_nb = [j for j in ADJ[dead] if alive[j]]
            if not live_nb:
                continue
            dead_load       = load[dead]
            alive_absorbers = [a for a in absorbers if alive[a]]

            pulse_amount = 0.0
            if alive_absorbers:
                pulse_amount = dead_load * pulse_fraction
                lo_norm = sum(lo_shu.get(a, 1.0 / len(alive_absorbers))
                              for a in alive_absorbers) or 1.0
                for ab in alive_absorbers:
                    w = lo_shu.get(ab, 1.0 / len(alive_absorbers)) / lo_norm
                    load[ab] += pulse_amount * w
                    if load[ab] > cap[ab] * 1.5 and alive[ab]:
                        alive[ab] = 0
                        dying.append(ab)

            normal_load = dead_load - pulse_amount
            per_nb = normal_load / len(live_nb) if live_nb else 0
            for nb in live_nb:
                load[nb] += per_nb
                if load[nb] > cap[nb] * 1.5 and alive[nb]:
                    alive[nb] = 0
                    dying.append(nb)

        queue = dying
        timeline.append(sum(alive))
        if dying:
            depth = step + 1
        if not dying:
            break

    final_alive        = sum(alive)
    absorbers_overloaded = sum(1 for ab in absorbers if not alive[ab])
    return {
        "final_alive":          final_alive,
        "total_dead":           N - final_alive,
        "depth":                depth,
        "survival_rate":        round(final_alive / N, 4),
        "timeline":             timeline,
        "absorbers_overloaded": absorbers_overloaded,
    }


# ─── Model 3 — Combined ───────────────────────────────────────────────────────

def run_combined(attacked: list, absorbers: list,
                 pulse_fraction: float, absorber_boost: float) -> dict:
    opt     = optimize_weights(300)
    weights = opt["weights"]
    cap     = list(BASE_CAP)
    for ab in absorbers:
        cap[ab] = int(cap[ab] * absorber_boost)

    load  = list(cap)
    alive = [1] * N
    for nd in attacked:
        alive[nd] = 0
    queue    = list(attacked)
    lo_shu   = _lo_shu_weights(absorbers)
    depth    = 0
    timeline = [sum(alive)]

    for step in range(80):
        dying = []
        for dead in queue:
            live_nb = [j for j in ADJ[dead] if alive[j]]
            if not live_nb:
                continue
            dead_load       = load[dead]
            alive_absorbers = [a for a in absorbers if alive[a]]

            pulse_amount = 0.0
            if alive_absorbers:
                pulse_amount = dead_load * pulse_fraction
                lo_norm = sum(lo_shu.get(a, 1.0 / len(alive_absorbers))
                              for a in alive_absorbers) or 1.0
                for ab in alive_absorbers:
                    w = lo_shu.get(ab, 1.0 / len(alive_absorbers)) / lo_norm
                    load[ab] += pulse_amount * w
                    if load[ab] > cap[ab] * 1.5 and alive[ab]:
                        alive[ab] = 0
                        dying.append(ab)

            normal_load = dead_load - pulse_amount
            if live_nb:
                total_w = sum(weights.get(_edge_key(dead, j), 1.0) for j in live_nb) or 1.0
                for nb in live_nb:
                    w = weights.get(_edge_key(dead, nb), 1.0) / total_w
                    load[nb] += normal_load * w
                    if load[nb] > cap[nb] * 1.5 and alive[nb]:
                        alive[nb] = 0
                        dying.append(nb)

        queue = dying
        timeline.append(sum(alive))
        if dying:
            depth = step + 1
        if not dying:
            break

    final_alive = sum(alive)
    return {
        "final_alive":   final_alive,
        "total_dead":    N - final_alive,
        "depth":         depth,
        "survival_rate": round(final_alive / N, 4),
        "timeline":      timeline,
        "energy_before": opt["energy_before"],
        "energy_after":  opt["energy_after"],
    }


# ─── Full experiment ──────────────────────────────────────────────────────────

def run_experiment(absorbers: list, pulse_fraction: float,
                   absorber_boost: float, random_seeds: list) -> dict:
    attack_modes = ["als", "hub", "random"]
    results = {}

    for mode in attack_modes:
        if mode == "random":
            # Average over multiple random seeds
            runs = []
            for seed in random_seeds:
                att = get_attacked("random", seed)
                runs.append({
                    "base":     run_baseline(att),
                    "topo":     run_topo_magic(att),
                    "pulse":    run_dynamic_pulse(att, absorbers, pulse_fraction, absorber_boost),
                    "combined": run_combined(att, absorbers, pulse_fraction, absorber_boost),
                })

            def _avg(model_key, metric):
                return sum(r[model_key][metric] for r in runs) / len(runs)

            def _avg_timeline(model_key):
                max_len = max(len(r[model_key]["timeline"]) for r in runs)
                return [
                    sum((r[model_key]["timeline"][i]
                         if i < len(r[model_key]["timeline"])
                         else r[model_key]["final_alive"])
                        for r in runs) / len(runs)
                    for i in range(max_len)
                ]

            results[mode] = {
                m: {
                    "final_alive":   round(_avg(m, "final_alive"), 2),
                    "total_dead":    round(_avg(m, "total_dead"), 2),
                    "depth":         round(_avg(m, "depth"), 2),
                    "survival_rate": round(_avg(m, "survival_rate"), 4),
                    "timeline":      [round(v, 2) for v in _avg_timeline(m)],
                }
                for m in ["base", "topo", "pulse", "combined"]
            }
        else:
            att = get_attacked(mode)
            results[mode] = {
                "base":     run_baseline(att),
                "topo":     run_topo_magic(att),
                "pulse":    run_dynamic_pulse(att, absorbers, pulse_fraction, absorber_boost),
                "combined": run_combined(att, absorbers, pulse_fraction, absorber_boost),
            }

    # Pulse fraction sweep (ALS attack only)
    att_als = get_attacked("als")
    base_als = run_baseline(att_als)
    pf_sweep = []
    for pf in [0.05, 0.10, 0.20, 0.30]:
        res = run_dynamic_pulse(att_als, absorbers, pf, absorber_boost)
        pf_sweep.append({
            "pf":         pf,
            "final_alive":res["final_alive"],
            "gain":       res["final_alive"] - base_als["final_alive"],
        })

    # Absorber boost sweep (ALS attack only)
    boost_sweep = []
    for ab in [1.0, 1.2, 1.5, 2.0]:
        res = run_dynamic_pulse(att_als, absorbers, pulse_fraction, ab)
        boost_sweep.append({
            "boost":      ab,
            "final_alive":res["final_alive"],
            "gain":       res["final_alive"] - base_als["final_alive"],
        })

    return {"results": results, "pf_sweep": pf_sweep, "boost_sweep": boost_sweep}


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    absorbers      = DEFAULT_ABSORBERS
    pulse_fraction = 0.10
    absorber_boost = 1.2
    random_seeds   = list(range(1, 21))  # 20 seeds

    absorber_names = [NEURON_NAMES[i] for i in absorbers]
    print(f"Absorbers: {', '.join(absorber_names)}")
    print(f"Pulse fraction: {pulse_fraction}  |  Absorber boost: ×{absorber_boost}")
    print("Running experiment (all attack modes × 4 models + parameter sweeps) ...")

    R = run_experiment(absorbers, pulse_fraction, absorber_boost, random_seeds)

    # ── Print results table ───────────────────────────────────────────────────
    W = 80
    MODEL_LABELS = {"base": "Baseline", "topo": "Topo Magic",
                    "pulse": "Dyn Pulse", "combined": "Combined"}

    print(f"\n{'='*W}")
    print(f"{'PHASE 2 — FINAL ALIVE NEURONS BY MODEL × ATTACK':^{W}}")
    print(f"{'='*W}")
    print(f"{'Attack':<8} {'Model':<14} {'Alive':>6} {'Dead':>5} "
          f"{'Depth':>6} {'Survival%':>10} {'Gain':>6}")
    print("-" * W)

    for mode in ["als", "hub", "random"]:
        base_alive = R["results"][mode]["base"]["final_alive"]
        for mi, mkey in enumerate(["base", "topo", "pulse", "combined"]):
            res  = R["results"][mode][mkey]
            gain = res["final_alive"] - base_alive
            mode_label = mode.upper() if mi == 0 else ""
            gain_str   = "—" if mkey == "base" else f"{gain:+.1f}"
            print(f"{mode_label:<8} {MODEL_LABELS[mkey]:<14} "
                  f"{res['final_alive']:>6.1f} {res['total_dead']:>5.1f} "
                  f"{res['depth']:>6.1f} {res['survival_rate']*100:>9.1f}% {gain_str:>6}")
        print()

    print("Pulse fraction sweep (ALS attack):")
    print(f"  {'pf':>6}  {'alive':>6}  {'gain':>6}")
    for row in R["pf_sweep"]:
        print(f"  {row['pf']:>6.2f}  {row['final_alive']:>6}  {row['gain']:>+6}")

    print("\nAbsorber boost sweep (ALS attack):")
    print(f"  {'boost':>6}  {'alive':>6}  {'gain':>6}")
    for row in R["boost_sweep"]:
        print(f"  {row['boost']:>6.1f}  {row['final_alive']:>6}  {row['gain']:>+6}")

    # ── Save JSON ─────────────────────────────────────────────────────────────
    Path("results").mkdir(exist_ok=True)

    # Build gain summary
    gains = {}
    for mode in ["als", "hub", "random"]:
        base_alive = R["results"][mode]["base"]["final_alive"]
        gains[mode] = {
            m: round(R["results"][mode][m]["final_alive"] - base_alive, 2)
            for m in ["topo", "pulse", "combined"]
        }

    # Strip timelines from output to keep JSON manageable
    results_clean = {}
    for mode, mode_res in R["results"].items():
        results_clean[mode] = {}
        for mkey, res in mode_res.items():
            results_clean[mode][mkey] = {k: v for k, v in res.items() if k != "timeline"}

    output = {
        "params": {
            "absorbers":       absorbers,
            "absorber_names":  absorber_names,
            "pulse_fraction":  pulse_fraction,
            "absorber_boost":  absorber_boost,
            "random_seeds":    len(random_seeds),
        },
        "results":     results_clean,
        "gains":       gains,
        "pf_sweep":    R["pf_sweep"],
        "boost_sweep": R["boost_sweep"],
        "summary": {
            "best_pf":    max(R["pf_sweep"],    key=lambda d: d["gain"])["pf"],
            "best_boost": max(R["boost_sweep"], key=lambda d: d["gain"])["boost"],
        },
    }
    path = "results/phase2_magic.json"
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved -> {path}")


if __name__ == "__main__":
    main()

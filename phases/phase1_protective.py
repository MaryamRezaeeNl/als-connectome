"""Phase 1 — Protective node analysis.

Translates protective_node_analysis.jsx computation logic to Python.
Boosts each neuron's capacity at +10%/+20%/+50% under 3 attack modes
(ALS, Hub, Random) and measures how many cascade deaths are prevented.
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

TYPE_LABELS  = ["Command IN", "Motor-A (ALS)", "Motor-B", "Motor-D", "Sensory", "Interneuron"]
BOOST_LEVELS = [0.0, 0.10, 0.20, 0.50]
ATTACK_MODES = ["als", "hub", "random"]
N = 61


def _build_adj():
    adj = [[] for _ in range(N)]
    for a, b in EDGES:
        adj[a].append(b)
        adj[b].append(a)
    return [list(set(nb)) for nb in adj]


ADJ      = _build_adj()
BASE_CAP = [max(len(nb), 1) for nb in ADJ]


def _seeded_rng(seed: int):
    """Replicates JavaScript's seededRng using the same LCG constants."""
    s = seed & 0xFFFFFFFF
    def rng():
        nonlocal s
        s = ((s * 1664525) + 1013904223) & 0xFFFFFFFF
        return s / 4294967296
    return rng


def get_attacked_nodes(mode: str, seed: int = 42):
    if mode == "als":
        return [i for i in range(N) if NODE_TYPES[i] == 1][:3]
    if mode == "hub":
        return sorted(range(N), key=lambda i: -len(ADJ[i]))[:3]
    rng = _seeded_rng(seed)
    return sorted(range(N), key=lambda _: rng() - 0.5)[:3]


# ─── Cascade with optional single-neuron capacity boost ──────────────────────

def run_cascade(attacked: list, boosted_neuron: int, boost_factor: float) -> dict:
    """Load-redistribution cascade with an optional capacity boost on one neuron."""
    cap  = list(BASE_CAP)
    if boosted_neuron >= 0:
        cap[boosted_neuron] = int(cap[boosted_neuron] * (1 + boost_factor))

    load  = list(cap)
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
        "timeline":      timeline,
    }


# ─── Network metrics (degree, betweenness) ───────────────────────────────────

def _compute_degree():
    return [len(nb) for nb in ADJ]


def _compute_betweenness():
    bc = [0.0] * N
    for s in range(N):
        stack, pred = [], [[] for _ in range(N)]
        sigma = [0.0] * N
        dist  = [-1]   * N
        sigma[s] = 1; dist[s] = 0
        queue, qi = [s], 0
        while qi < len(queue):
            v = queue[qi]; qi += 1
            stack.append(v)
            for w in ADJ[v]:
                if dist[w] < 0:
                    queue.append(w); dist[w] = dist[v] + 1
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]; pred[w].append(v)
        delta = [0.0] * N
        while stack:
            w = stack.pop()
            for v in pred[w]:
                if sigma[w] > 0:
                    delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
            if w != s:
                bc[w] += delta[w]
    f = (N - 1) * (N - 2)
    return [v / f if f > 0 else 0.0 for v in bc]


def _pearson_r(x, y):
    n  = len(x)
    mx = sum(x) / n; my = sum(y) / n
    num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    dx  = math.sqrt(sum((xi - mx) ** 2 for xi in x))
    dy  = math.sqrt(sum((yi - my) ** 2 for yi in y))
    return num / (dx * dy) if dx * dy > 1e-12 else 0.0


# ─── Main experiment ──────────────────────────────────────────────────────────

def run_protection_experiment():
    degree = _compute_degree()
    btwn   = _compute_betweenness()

    # Baselines: cascade with no boost for each attack mode
    baselines = {m: run_cascade(get_attacked_nodes(m), -1, 0.0) for m in ATTACK_MODES}

    neurons = []
    for i in range(N):
        scores  = {}   # scores[mode][boost_idx]
        details = {}

        for mode in ATTACK_MODES:
            attacked = get_attacked_nodes(mode)
            scores[mode]  = [0]                  # boost_idx=0 -> baseline protection = 0
            details[mode] = [baselines[mode]]
            for bi in range(1, len(BOOST_LEVELS)):
                res = run_cascade(attacked, i, BOOST_LEVELS[bi])
                prot = baselines[mode]["total_dead"] - res["total_dead"]
                scores[mode].append(prot)
                details[mode].append(res)

        # Aggregate: average over modes at max boost, clamp negatives to 0
        max_bi    = len(BOOST_LEVELS) - 1
        agg_score = sum(max(0, scores[m][max_bi]) for m in ATTACK_MODES) / len(ATTACK_MODES)

        # Absorb ratio: how much protection per unit of degree
        absorb_ratio = agg_score / degree[i] if degree[i] > 0 else agg_score

        neurons.append({
            "id":           i,
            "name":         NEURON_NAMES[i],
            "type":         NODE_TYPES[i],
            "type_label":   TYPE_LABELS[NODE_TYPES[i]],
            "degree":       degree[i],
            "btwn":         round(btwn[i], 5),
            "agg_score":    round(agg_score, 4),
            "absorb_ratio": round(absorb_ratio, 4),
            "is_hub":       degree[i] >= 8,
            "scores":       {m: [round(s, 3) for s in scores[m]] for m in ATTACK_MODES},
        })

    ranked = sorted(neurons, key=lambda n: -n["agg_score"])

    agg_scores  = [n["agg_score"] for n in neurons]
    corr_deg    = _pearson_r([n["degree"]       for n in neurons], agg_scores)
    corr_btwn   = _pearson_r([n["btwn"]         for n in neurons], agg_scores)
    corr_absorb = _pearson_r([n["absorb_ratio"]  for n in neurons], agg_scores)

    hub_protectors     = [n for n in ranked if n["is_hub"]  and n["agg_score"] > 0][:5]
    non_hub_protectors = [n for n in ranked if not n["is_hub"] and n["agg_score"] > 0][:5]

    # Outliers: absorb_ratio > mean + 1.5std
    ar_vals = [n["absorb_ratio"] for n in neurons]
    ar_mean = sum(ar_vals) / N
    ar_std  = math.sqrt(sum((v - ar_mean) ** 2 for v in ar_vals) / N)
    outliers = sorted(
        [n for n in neurons if n["absorb_ratio"] > ar_mean + 1.5 * ar_std],
        key=lambda n: -n["absorb_ratio"]
    )

    return {
        "neurons":           neurons,
        "ranked":            ranked,
        "baselines":         {m: {"total_dead": baselines[m]["total_dead"],
                                  "final_alive": baselines[m]["final_alive"]}
                              for m in ATTACK_MODES},
        "corr_deg":          round(corr_deg, 4),
        "corr_btwn":         round(corr_btwn, 4),
        "corr_absorb":       round(corr_absorb, 4),
        "hub_protectors":    hub_protectors,
        "non_hub_protectors":non_hub_protectors,
        "outliers":          outliers,
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    total_sims = N * (len(BOOST_LEVELS) - 1) * len(ATTACK_MODES) + len(ATTACK_MODES)
    print(f"Running {total_sims} cascade simulations (61 neurons × 3 boost levels × 3 attack modes + 3 baselines) ...")

    R = run_protection_experiment()

    # ── Print results table ───────────────────────────────────────────────────
    W = 96
    print(f"\n{'='*W}")
    print(f"{'PROTECTIVE NODE ANALYSIS — TOP 20 (ranked by aggregate protection score)':^{W}}")
    print(f"{'='*W}")
    print(f"{'#':>3}  {'Neuron':<8} {'Type':<15} {'AggScore':>8} "
          f"{'ALS+50%':>7} {'Hub+50%':>7} {'Rnd+50%':>7} {'AbsorbR':>7} {'Deg':>4} {'Hub':>4}")
    print("-" * W)
    for i, nd in enumerate(R["ranked"][:20]):
        s = nd["scores"]
        print(f"{i+1:>3}  {nd['name']:<8} {nd['type_label']:<15} {nd['agg_score']:>8.3f} "
              f"{s['als'][3]:>7.1f} {s['hub'][3]:>7.1f} {s['random'][3]:>7.1f} "
              f"{nd['absorb_ratio']:>7.3f} {nd['degree']:>4} {'*' if nd['is_hub'] else '—':>4}")

    print(f"\nBaseline deaths — ALS: {R['baselines']['als']['total_dead']}, "
          f"Hub: {R['baselines']['hub']['total_dead']}, "
          f"Random: {R['baselines']['random']['total_dead']}")

    print(f"\nCorrelations with aggregate protection score:")
    print(f"  degree       : r = {R['corr_deg']:+.4f}")
    print(f"  betweenness  : r = {R['corr_btwn']:+.4f}")
    print(f"  absorb_ratio : r = {R['corr_absorb']:+.4f}")

    top1 = R["ranked"][0]
    print(f"\nTop protector:  {top1['name']} ({top1['type_label']}) — "
          f"avg {top1['agg_score']:.2f} deaths prevented at +50% boost")

    outlier_names = [o["name"] for o in R["outliers"][:5]]
    print(f"Outliers (absorb_ratio > mean+1.5 std): {', '.join(outlier_names) or 'none'}")

    hub_names = [h["name"] for h in R["hub_protectors"]]
    non_hub_names = [h["name"] for h in R["non_hub_protectors"]]
    print(f"Hub protectors:     {', '.join(hub_names) or 'none'}")
    print(f"Non-hub heroes:     {', '.join(non_hub_names) or 'none'}")

    # ── Save JSON ─────────────────────────────────────────────────────────────
    Path("results").mkdir(exist_ok=True)

    # Trim timeline from details to keep JSON small
    for nd in R["neurons"]:
        nd.pop("scores", None)  # kept separately in ranked

    output = {
        "ranked":            R["ranked"],
        "baselines":         R["baselines"],
        "correlations": {
            "degree":       R["corr_deg"],
            "betweenness":  R["corr_btwn"],
            "absorb_ratio": R["corr_absorb"],
        },
        "hub_protectors":    R["hub_protectors"],
        "non_hub_protectors":R["non_hub_protectors"],
        "outliers":          R["outliers"],
        "summary": {
            "top_protector":      top1["name"],
            "top_agg_score":      top1["agg_score"],
            "outlier_names":      outlier_names,
        },
    }
    path = "results/phase1_protective.json"
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved -> {path}")


if __name__ == "__main__":
    main()

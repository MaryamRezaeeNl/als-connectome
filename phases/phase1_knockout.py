"""Phase 1 — Single-node knockout analysis.

Translates knockout_analysis.jsx computation logic to Python.
Runs 61 single-node knockouts on the C. elegans cascade graph and
correlates cascade damage with five centrality metrics.
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

TYPE_LABELS = ["Command IN", "Motor-A (ALS)", "Motor-B", "Motor-D", "Sensory", "Interneuron"]
N = 61


def _build_adj():
    adj = [[] for _ in range(N)]
    for a, b in EDGES:
        adj[a].append(b)
        adj[b].append(a)
    return [list(set(nb)) for nb in adj]


ADJ = _build_adj()
CAP = [max(len(nb), 1) for nb in ADJ]


# ─── Cascade simulation ───────────────────────────────────────────────────────

def cascade(knocked_out: int) -> int:
    """Load-redistribution cascade from a single node knockout.

    Returns secondary death count (does not count the knocked-out node itself).
    """
    cap   = list(CAP)
    load  = list(CAP)
    alive = [1] * N
    alive[knocked_out] = 0
    queue = [knocked_out]

    for _ in range(60):
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
        if not dying:
            break

    return N - 1 - sum(alive)


# ─── Network metrics ──────────────────────────────────────────────────────────

def compute_degree():
    return [len(nb) for nb in ADJ]


def compute_betweenness():
    bc = [0.0] * N
    for s in range(N):
        stack, pred = [], [[] for _ in range(N)]
        sigma = [0.0] * N
        dist  = [-1]   * N
        sigma[s] = 1
        dist[s]  = 0
        queue, qi = [s], 0
        while qi < len(queue):
            v = queue[qi]; qi += 1
            stack.append(v)
            for w in ADJ[v]:
                if dist[w] < 0:
                    queue.append(w)
                    dist[w] = dist[v] + 1
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
        delta = [0.0] * N
        while stack:
            w = stack.pop()
            for v in pred[w]:
                if sigma[w] > 0:
                    delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
            if w != s:
                bc[w] += delta[w]
    factor = (N - 1) * (N - 2)
    return [v / factor if factor > 0 else 0.0 for v in bc]


def compute_eigenvector(iters: int = 100):
    x = [1.0 / N] * N
    for _ in range(iters):
        y = [0.0] * N
        for i in range(N):
            for j in ADJ[i]:
                y[i] += x[j]
        norm = math.sqrt(sum(v * v for v in y)) or 1.0
        x = [v / norm for v in y]
    return x


def compute_spectral_contrib():
    """Approximate Fiedler vector component via power iteration with deflation."""
    deg   = [len(nb) for nb in ADJ]
    shift = 2 * max(deg) + 1
    u1    = [1.0 / math.sqrt(N)] * N

    def _dot(a, b): return sum(ai * bi for ai, bi in zip(a, b))
    def _nm(v):     return math.sqrt(_dot(v, v))
    def _defl(v, u):
        d = _dot(v, u)
        return [vi - d * ui for vi, ui in zip(v, u)]
    def _norm(v):
        r = _nm(v)
        return v if r < 1e-12 else [vi / r for vi in v]
    def _Lx(x):
        y = [0.0] * N
        for i in range(N):
            y[i] = deg[i] * x[i]
            for j in ADJ[i]:
                y[i] -= x[j]
        return y

    v = _norm(_defl([math.sin(i + 1) for i in range(N)], u1))
    for _ in range(80):
        Lv = _Lx(v)
        w  = [shift * vi - Lvi for vi, Lvi in zip(v, Lv)]
        w  = _defl(w, u1)
        r  = _nm(w)
        if r < 1e-12:
            break
        v = _norm(w)
    return [abs(vi) for vi in v]


def compute_bridge_score():
    """1 if removing the node disconnects the graph, else 0."""
    scores = [0.0] * N
    for ko in range(N):
        start = 1 if ko == 0 else 0
        vis   = [False] * N
        vis[ko] = vis[start] = True
        queue, qi, cnt = [start], 0, 1
        while qi < len(queue):
            for v in ADJ[queue[qi]]:
                if not vis[v]:
                    vis[v] = True
                    cnt += 1
                    queue.append(v)
            qi += 1
        scores[ko] = 1.0 if cnt < N - 1 else 0.0
    return scores


# ─── Statistics ───────────────────────────────────────────────────────────────

def pearson_r(x, y):
    n  = len(x)
    mx = sum(x) / n
    my = sum(y) / n
    num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    dx  = math.sqrt(sum((xi - mx) ** 2 for xi in x))
    dy  = math.sqrt(sum((yi - my) ** 2 for yi in y))
    return num / (dx * dy) if dx * dy > 1e-12 else 0.0


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Computing network metrics ...")
    degree   = compute_degree()
    btwn     = compute_betweenness()
    eigenv   = compute_eigenvector()
    spectral = compute_spectral_contrib()
    bridge   = compute_bridge_score()

    print(f"Running {N} single-node knockouts ...")
    knockouts = []
    for i in range(N):
        knockouts.append({
            "id":         i,
            "name":       NEURON_NAMES[i],
            "type":       NODE_TYPES[i],
            "type_label": TYPE_LABELS[NODE_TYPES[i]],
            "damage":     cascade(i),
            "degree":     degree[i],
            "btwn":       round(btwn[i], 5),
            "eigenv":     round(eigenv[i], 5),
            "spectral":   round(spectral[i], 5),
            "bridge":     bridge[i],
        })

    damages     = [k["damage"] for k in knockouts]
    metric_keys = ["degree", "btwn", "eigenv", "spectral", "bridge"]
    corrs = {m: pearson_r([k[m] for k in knockouts], damages) for m in metric_keys}

    ranked      = sorted(knockouts, key=lambda k: -k["damage"])
    best_metric = max(corrs, key=lambda k: abs(corrs[k]))

    # Outlier detection: residuals > 1.5std from regression line of best metric
    x_arr  = [k[best_metric] for k in knockouts]
    mx, my = sum(x_arr) / N, sum(damages) / N
    m_reg  = (sum((xi - mx) * (di - my) for xi, di in zip(x_arr, damages)) /
              (sum((xi - mx) ** 2 for xi in x_arr) or 1))
    b_reg  = my - m_reg * mx
    resid  = [k["damage"] - (m_reg * k[best_metric] + b_reg) for k in knockouts]
    res_std   = math.sqrt(sum(r * r for r in resid) / N)
    outliers  = [knockouts[i]["name"] for i in range(N) if abs(resid[i]) > 1.5 * res_std]

    # ── Print results table ───────────────────────────────────────────────────
    W = 94
    print(f"\n{'='*W}")
    print(f"{'KNOCKOUT ANALYSIS — TOP 20 (ranked by cascade damage)':^{W}}")
    print(f"{'='*W}")
    print(f"{'#':>3}  {'Neuron':<8} {'Type':<15} {'Damage':>6}  "
          f"{'Deg':>4} {'Btwn':>8} {'Eigenv':>7} {'Spectral':>9} {'Bridge':>6}")
    print("-" * W)
    for i, nd in enumerate(ranked[:20]):
        print(f"{i+1:>3}  {nd['name']:<8} {nd['type_label']:<15} {nd['damage']:>6}  "
              f"{nd['degree']:>4} {nd['btwn']:>8.4f} {nd['eigenv']:>7.4f} "
              f"{nd['spectral']:>9.5f} {'YES' if nd['bridge'] else '—':>6}")

    print(f"\nCorrelations with cascade damage (Pearson r):")
    for m in sorted(metric_keys, key=lambda k: -abs(corrs[k])):
        marker = "  <- best predictor" if m == best_metric else ""
        print(f"  {m:<12}: r = {corrs[m]:+.4f}{marker}")

    zero_dmg = sum(1 for k in knockouts if k["damage"] == 0)
    print(f"\nOutliers (|residual| > 1.5 std): {', '.join(outliers) or 'none'}")
    print(f"Zero-damage knockouts:         {zero_dmg}")
    print(f"Most critical node:            {ranked[0]['name']} — {ranked[0]['damage']} secondary deaths")

    # ── Save JSON ─────────────────────────────────────────────────────────────
    Path("results").mkdir(exist_ok=True)
    output = {
        "ranked":       ranked,
        "correlations": {k: round(v, 6) for k, v in corrs.items()},
        "best_metric":  best_metric,
        "outliers":     outliers,
        "res_std":      round(res_std, 4),
        "summary": {
            "most_critical":     ranked[0]["name"],
            "max_damage":        ranked[0]["damage"],
            "zero_damage_count": zero_dmg,
            "best_predictor_r":  round(corrs[best_metric], 4),
        },
    }
    path = "results/phase1_knockout.json"
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved -> {path}")


if __name__ == "__main__":
    main()

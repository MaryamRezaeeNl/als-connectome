"""
Phase-transition sweep: resilience vs spectral weight alpha.

Port of JSX_assest/magic_phase_transition.jsx (simulation logic only; React UI omitted).

Experiment: fix graph size, edge count, and all SA parameters; sweep alpha
(the weight given to spectral gap lambda2 in the SA fitness function) across
five values [0.0, 0.1, 0.3, 0.5, 1.0].  For each alpha, one SA run optimises
a random graph for:

    score = resilience + alpha * (lambda2/2) - lambda_e * (energy / n*target^2)

where resilience = 0.2*r_random + 0.4*r_targeted + 0.4*r_cascade.

Output:
    - Per-alpha resilience, spectral gap, and score
    - Peak alpha (highest resilience)
    - Phase-transition point (first alpha where resilience drops >0.005 from previous)
    - Cascade attack delta (alpha=0 vs peak)

Usage:
    python explore_phase_transition.py [--n N] [--edges E] [--sa-steps S]
                                       [--magic-steps M] [--target T]
                                       [--lambda-e L] [--attack-k K] [--seed D]
"""

import math
import random
import argparse
import numpy as np

# ── LCG RNG matching JS seededRng(seed) ──────────────────────────────────────

def make_lcg(seed):
    """32-bit LCG identical to the JavaScript seededRng implementation."""
    s = int(seed) & 0xFFFFFFFF
    def rng():
        nonlocal s
        s = (1664525 * s + 1013904223) & 0xFFFFFFFF
        return s / 4294967296.0
    return rng

# ── graph helpers ─────────────────────────────────────────────────────────────

def make_initial_graph(n, target_edges, seed):
    """Build a connected random graph: path backbone + random edges."""
    rng = make_lcg(seed)
    edge_set = set()
    for i in range(n - 1):
        edge_set.add((i, i + 1) if i < i + 1 else (i + 1, i))
    attempts = 0
    while len(edge_set) < target_edges and attempts < 300000:
        attempts += 1
        a = int(rng() * n)
        b = int(rng() * n)
        if a != b:
            edge_set.add((min(a, b), max(a, b)))
    return list(edge_set)

def build_adj(n, edges):
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    return adj

def is_connected(n, edges):
    adj = build_adj(n, edges)
    vis = [False] * n
    q = [0]; vis[0] = True; cnt = 1
    while q:
        v = q.pop()
        for w in adj[v]:
            if not vis[w]:
                vis[w] = True; cnt += 1; q.append(w)
    return cnt == n

# ── spectral gap (Fiedler value lambda2) ─────────────────────────────────────

def spectral_gap(n, adj, iters=80):
    """Power iteration on the Laplacian to estimate the Fiedler value."""
    if n < 3:
        return 0.0
    deg = np.array([len(nb) for nb in adj], dtype=float)
    max_deg = deg.max()
    shift = 2 * max_deg + 1

    u1 = np.ones(n) / math.sqrt(n)

    def Lx(x):
        y = deg * x
        for i in range(n):
            for j in adj[i]:
                y[i] -= x[j]
        return y

    lcg = make_lcg(37)
    v = np.array([lcg() - 0.5 for _ in range(n)])
    v -= np.dot(v, u1) * u1
    norm = np.linalg.norm(v)
    if norm < 1e-12:
        return 0.0
    v /= norm

    lambda2 = 0.0
    for _ in range(iters):
        Lv = Lx(v)
        w = shift * v - Lv
        w -= np.dot(w, u1) * u1
        nm = np.linalg.norm(w)
        if nm < 1e-12:
            break
        e_shifted = np.dot(v, w) / np.dot(v, v)
        lambda2 = shift - e_shifted
        v = w / nm

    return max(0.0, lambda2)

# ── magic energy + gradient-descent optimiser ─────────────────────────────────

def magic_energy(adj, x, target):
    """Sum of squared deviations of each node's neighbor-sum from target."""
    A = np.zeros((len(adj), len(adj)))
    for i, nb in enumerate(adj):
        for j in nb:
            A[i, j] = 1.0
    neighbor_sums = A @ x
    return float(np.sum((neighbor_sums - target) ** 2))

def optimize_magic(adj, target, steps, seed, lr=0.002):
    """Gradient descent on magic energy, clamping x to [0, 100]."""
    n = len(adj)
    A = np.zeros((n, n))
    for i, nb in enumerate(adj):
        for j in nb:
            A[i, j] = 1.0

    lcg = make_lcg(seed)
    x = np.array([lcg() * 10 for _ in range(n)])

    for _ in range(steps):
        neighbor_sums = A @ x
        residuals = neighbor_sums - target
        grad = 2.0 * (A.T @ residuals)  # analytical gradient
        x = np.clip(x - lr * grad, 0.0, 100.0)

    return x

# ── three attack models ───────────────────────────────────────────────────────

def attack_random(adj, k, seed):
    """Random failure: remove k random nodes; return fraction surviving."""
    n = len(adj)
    return (n - k) / n  # metric ignores which nodes are removed

def attack_targeted(adj, k):
    """Adaptive targeted hub attack: repeatedly remove highest-degree alive node."""
    n = len(adj)
    alive = set(range(n))
    for _ in range(k):
        if not alive:
            break
        best = max(alive, key=lambda i: sum(1 for j in adj[i] if j in alive))
        alive.discard(best)
    return len(alive) / n

def attack_cascade(adj, initial_dead):
    """Load-redistribution cascade: each dead node spreads load to live neighbours."""
    n = len(adj)
    capacity = np.array([max(len(nb), 1) for nb in adj], dtype=float)
    load = capacity.copy()
    alive = np.ones(n, dtype=bool)
    queue = list(initial_dead)
    for nd in queue:
        alive[nd] = False

    changed = True
    while changed:
        changed = False
        dying = []
        for dead in queue:
            live_nbrs = [j for j in adj[dead] if alive[j]]
            if not live_nbrs:
                continue
            extra = load[dead] / len(live_nbrs)
            for nb in live_nbrs:
                load[nb] += extra
                if load[nb] > capacity[nb] * 1.5 and alive[nb]:
                    alive[nb] = False
                    dying.append(nb)
                    changed = True
        queue = dying

    return alive.sum() / n

def top_k_nodes(adj, k):
    return sorted(range(len(adj)), key=lambda i: len(adj[i]), reverse=True)[:k]

# ── evaluate ──────────────────────────────────────────────────────────────────

def evaluate(edges, n, params, alpha):
    target      = params["target"]
    magic_steps = params["magic_steps"]
    seed        = params["seed"]
    lambda_e    = params["lambda_e"]
    attack_k    = params["attack_k"]

    adj = build_adj(n, edges)
    x = optimize_magic(adj, target, magic_steps, seed)
    energy = magic_energy(adj, x, target)
    norm_e = energy / (n * target * target)

    sg = spectral_gap(n, adj)
    norm_sg = sg / 2.0

    r_rand = attack_random(adj, attack_k, seed)
    r_targ = attack_targeted(adj, attack_k)
    r_casc = attack_cascade(adj, top_k_nodes(adj, attack_k))
    resilience = 0.2 * r_rand + 0.4 * r_targ + 0.4 * r_casc

    score = resilience + alpha * norm_sg - lambda_e * norm_e
    return dict(score=score, resilience=resilience, energy=energy,
                sg=sg, norm_sg=norm_sg, r_rand=r_rand, r_targ=r_targ, r_casc=r_casc)

# ── simulated annealing step ──────────────────────────────────────────────────

def sa_step(edges, n, rng):
    """Remove one random edge and add a new random edge; reject if disconnected."""
    ri = int(rng() * len(edges))
    ra, rb = edges[ri]
    edge_set = set(edges)
    edge_set.discard((ra, rb))
    edge_set.discard((rb, ra))

    na = nb = 0
    for attempts in range(300):
        na = int(rng() * n)
        nb = int(rng() * n)
        if na != nb and (min(na, nb), max(na, nb)) not in edge_set:
            break
    else:
        return None

    new_edge = (min(na, nb), max(na, nb))
    new_edges = [e for i, e in enumerate(edges) if i != ri] + [new_edge]
    return new_edges if is_connected(n, new_edges) else None

# ── run one SA ────────────────────────────────────────────────────────────────

def run_sa(n, edge_count, sa_steps, params, alpha):
    seed = params["seed"]
    edges = make_initial_graph(n, edge_count, seed)
    cur_score = evaluate(edges, n, params, alpha)["score"]
    best_score = cur_score
    best_edges = edges[:]

    rng = make_lcg(seed + int(alpha * 100) + 1)
    T0 = 0.3

    for step in range(sa_steps):
        T = T0 * math.exp(-3 * step / sa_steps)
        cand = sa_step(edges, n, rng)
        if cand is None:
            continue
        p_step = dict(params, seed=seed + step)
        res = evaluate(cand, n, p_step, alpha)
        d = res["score"] - cur_score
        if d > 0 or random.random() < math.exp(d / max(T, 1e-6)):
            edges = cand
            cur_score = res["score"]
            if res["score"] > best_score:
                best_score = res["score"]
                best_edges = cand[:]

    return evaluate(best_edges, n, params, alpha)

# ── main ──────────────────────────────────────────────────────────────────────

ALPHA_VALUES = [0.0, 0.1, 0.3, 0.5, 1.0]

def run_sweep(n, edge_count, sa_steps, params):
    results = []
    for alpha in ALPHA_VALUES:
        print("  alpha=%.1f ..." % alpha, end="", flush=True)
        res = run_sa(n, edge_count, sa_steps, params, alpha)
        results.append(res)
        print(" resilience=%.3f  sg=%.3f" % (res["resilience"], res["sg"]))
    return results


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--n",           type=int,   default=18)
    ap.add_argument("--edges",       type=int,   default=28)
    ap.add_argument("--sa-steps",    type=int,   default=80)
    ap.add_argument("--magic-steps", type=int,   default=220)
    ap.add_argument("--target",      type=float, default=20.0)
    ap.add_argument("--lambda-e",    type=float, default=0.1)
    ap.add_argument("--attack-k",    type=int,   default=3)
    ap.add_argument("--seed",        type=int,   default=42)
    args = ap.parse_args()

    params = dict(target=args.target, magic_steps=args.magic_steps,
                  seed=args.seed, lambda_e=args.lambda_e, attack_k=args.attack_k)

    print("Alpha sweep: resilience vs spectral weight")
    print("n=%d  edges=%d  sa_steps=%d  attack_k=%d  seed=%d" % (
        args.n, args.edges, args.sa_steps, args.attack_k, args.seed))
    print()

    results = run_sweep(args.n, args.edges, args.sa_steps, params)

    print()
    print("%-6s  %-10s  %-8s  %-8s  %-8s  %-8s" % (
        "alpha", "resilience", "r_rand", "r_targ", "r_casc", "sg"))
    print("-" * 62)
    for alpha, r in zip(ALPHA_VALUES, results):
        print("%-6.1f  %-10.4f  %-8.4f  %-8.4f  %-8.4f  %-8.4f" % (
            alpha, r["resilience"], r["r_rand"], r["r_targ"], r["r_casc"], r["sg"]))

    res_vals = [r["resilience"] for r in results]
    peak_idx = max(range(len(res_vals)), key=lambda i: res_vals[i])
    print()
    print("Peak alpha: %.1f  (resilience=%.4f)" % (ALPHA_VALUES[peak_idx], res_vals[peak_idx]))

    # Phase transition: first alpha where resilience drops > 0.005 from previous
    transition = None
    for k in range(1, len(results)):
        if res_vals[k] < res_vals[k - 1] - 0.005:
            transition = ALPHA_VALUES[k]
            break
    if transition is not None:
        print("Phase transition detected at alpha >= %.1f" % transition)
    else:
        print("No phase transition detected across the sweep")

    r0 = results[0]
    rp = results[peak_idx]
    casc_delta = (rp["r_casc"] - r0["r_casc"]) * 100
    print("Cascade attack delta (alpha=0 -> peak): %+.2f%%" % casc_delta)


if __name__ == "__main__":
    main()

"""
Spectral-gap ablation via three attack models (v3b).

Port of JSX_assest/magic_topology_v3b.jsx (simulation logic only; React UI omitted).

Extends v3a by replacing the health-based collapse simulation with three
complementary attack models evaluated on the optimised graph:

  Random failure   -- remove k random nodes (fraction surviving = (n-k)/n)
  Targeted hub     -- iteratively remove the current highest-degree live node
  Cascade load     -- dead nodes redistribute load to live neighbours;
                      nodes overloaded > 1.5x capacity also die

Composite resilience = 0.2*r_random + 0.4*r_targeted + 0.4*r_cascade

Two SA runs share the same initial graph:
  Version A -- score = resilience - lambda_e * energy_norm
  Version B -- score = resilience + alpha * (lambda2/2) - lambda_e * energy_norm

The per-attack breakdown reveals which failure mode benefits most from
spectral optimisation.

Default parameters match JSX component defaults:
  n=18, edges=28, sa_steps=100, magic_steps=250, target=20, lambda_e=0.1,
  alpha=0.3, temp0=0.3, attack_k=3, seed=42

Usage:
    python explore_topology_v3b.py [--n N] [--edges E] [--sa-steps S]
                                   [--magic-steps M] [--target T]
                                   [--lambda-e L] [--alpha A] [--temp0 T0]
                                   [--attack-k K] [--seed SEED]
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
    rng = make_lcg(seed)
    edge_set = set()
    for i in range(n - 1):
        edge_set.add((i, i + 1))
    attempts = 0
    while len(edge_set) < target_edges and attempts < 200000:
        attempts += 1
        a = int(rng() * n); b = int(rng() * n)
        if a != b:
            edge_set.add((min(a, b), max(a, b)))
    return list(edge_set)

def build_adj(n, edges):
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b); adj[b].append(a)
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

# ── spectral gap ──────────────────────────────────────────────────────────────

def spectral_gap(n, adj, iters=80):
    if n < 3:
        return 0.0
    deg = np.array([len(nb) for nb in adj], dtype=float)
    shift = 2 * deg.max() + 1
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
    nm = np.linalg.norm(v)
    if nm < 1e-12:
        return 0.0
    v /= nm

    lambda2 = 0.0
    for _ in range(iters):
        Lv = Lx(v)
        w = shift * v - Lv
        w -= np.dot(w, u1) * u1
        nm = np.linalg.norm(w)
        if nm < 1e-12:
            break
        lambda2 = shift - np.dot(v, w) / np.dot(v, v)
        v = w / nm

    return max(0.0, lambda2)

# ── magic energy + optimiser ──────────────────────────────────────────────────

def optimize_magic(adj, target, steps, seed, lr=0.002):
    n = len(adj)
    A = np.zeros((n, n))
    for i, nb in enumerate(adj):
        for j in nb:
            A[i, j] = 1.0
    lcg = make_lcg(seed)
    x = np.array([lcg() * 10 for _ in range(n)])
    for _ in range(steps):
        residuals = A @ x - target
        grad = 2.0 * (A.T @ residuals)
        x = np.clip(x - lr * grad, 0.0, 100.0)
    return x

def magic_energy(adj, x, target):
    n = len(adj)
    A = np.zeros((n, n))
    for i, nb in enumerate(adj):
        for j in nb:
            A[i, j] = 1.0
    return float(np.sum((A @ x - target) ** 2))

# ── three attack models ───────────────────────────────────────────────────────

def attack_random(adj, k, seed):
    """Random failure: fraction of nodes surviving removal of k random nodes."""
    return (len(adj) - k) / len(adj)

def attack_targeted(adj, k):
    """Adaptive targeted hub attack: remove current max-degree live node k times."""
    n = len(adj)
    alive = set(range(n))
    for _ in range(k):
        if not alive:
            break
        best = max(alive, key=lambda i: sum(1 for j in adj[i] if j in alive))
        alive.discard(best)
    return len(alive) / n

def attack_cascade(adj, initial_attacked):
    """
    Load-redistribution cascade.  Capacity = degree.  Initial attack transfers
    load equally to live neighbours; nodes loaded >1.5x capacity die and spread
    further.  Returns fraction alive when cascade terminates.
    """
    n = len(adj)
    capacity = np.array([max(len(nb), 1) for nb in adj], dtype=float)
    load = capacity.copy()
    alive = np.ones(n, dtype=bool)
    queue = list(initial_attacked)
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
                    alive[nb] = False; dying.append(nb); changed = True
        queue = dying

    return alive.sum() / n

def top_k_nodes(adj, k):
    return sorted(range(len(adj)), key=lambda i: len(adj[i]), reverse=True)[:k]

# ── evaluate ──────────────────────────────────────────────────────────────────

def evaluate(edges, n, params, use_spectral):
    target      = params["target"]
    magic_steps = params["magic_steps"]
    seed        = params["seed"]
    alpha       = params["alpha"]
    lambda_e    = params["lambda_e"]
    attack_k    = params["attack_k"]

    adj = build_adj(n, edges)
    x = optimize_magic(adj, target, magic_steps, seed)
    energy = magic_energy(adj, x, target)
    norm_e = energy / (n * target * target)

    sg = spectral_gap(n, adj) if use_spectral else 0.0
    norm_sg = sg / 2.0

    top_k = top_k_nodes(adj, attack_k)
    r_random   = attack_random(adj, attack_k, seed)
    r_targeted = attack_targeted(adj, attack_k)
    r_cascade  = attack_cascade(adj, top_k)

    resilience = 0.2 * r_random + 0.4 * r_targeted + 0.4 * r_cascade
    score = resilience + (alpha * norm_sg if use_spectral else 0.0) - lambda_e * norm_e

    return dict(score=score, resilience=resilience, energy=energy, sg=sg,
                r_random=r_random, r_targeted=r_targeted, r_cascade=r_cascade,
                attacked=top_k)

# ── SA step ───────────────────────────────────────────────────────────────────

def sa_step(edges, n, rng):
    ri = int(rng() * len(edges))
    ra, rb = edges[ri]
    edge_set = set(edges)
    edge_set.discard((ra, rb)); edge_set.discard((rb, ra))
    for _ in range(300):
        na = int(rng() * n); nb = int(rng() * n)
        if na != nb and (min(na, nb), max(na, nb)) not in edge_set:
            new_edges = [e for i, e in enumerate(edges) if i != ri] + [(min(na, nb), max(na, nb))]
            return new_edges if is_connected(n, new_edges) else None
    return None

# ── run one SA ────────────────────────────────────────────────────────────────

def run_sa(n, edge_count, sa_steps, params, use_spectral):
    seed = params["seed"]
    edges = make_initial_graph(n, edge_count, seed)
    init_result = evaluate(edges, n, params, use_spectral)

    cur_edges = edges[:]
    cur_score = init_result["score"]
    best_score = cur_score; best_edges = edges[:]
    log = [{"step": 0, "score": init_result["score"],
             "resilience": init_result["resilience"], "sg": init_result["sg"]}]

    rng = make_lcg(seed + (500 if use_spectral else 0))
    temp0 = params["temp0"]

    for step in range(sa_steps):
        T = temp0 * math.exp(-3 * step / sa_steps)
        cand = sa_step(cur_edges, n, rng)
        if cand is None:
            continue
        p_step = dict(params, seed=seed + step)
        res = evaluate(cand, n, p_step, use_spectral)
        d = res["score"] - cur_score
        if d > 0 or random.random() < math.exp(d / max(T, 1e-6)):
            cur_edges = cand; cur_score = res["score"]
            if res["score"] > best_score:
                best_score = res["score"]; best_edges = cand[:]
        log.append({"step": step + 1, "score": cur_score,
                    "resilience": res["resilience"], "sg": res["sg"]})

    best_result = evaluate(best_edges, n, params, use_spectral)
    return init_result, best_result, log

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--n",           type=int,   default=18)
    ap.add_argument("--edges",       type=int,   default=28)
    ap.add_argument("--sa-steps",    type=int,   default=100)
    ap.add_argument("--magic-steps", type=int,   default=250)
    ap.add_argument("--target",      type=float, default=20.0)
    ap.add_argument("--lambda-e",    type=float, default=0.1)
    ap.add_argument("--alpha",       type=float, default=0.3)
    ap.add_argument("--temp0",       type=float, default=0.3)
    ap.add_argument("--attack-k",    type=int,   default=3)
    ap.add_argument("--seed",        type=int,   default=42)
    args = ap.parse_args()

    params = dict(target=args.target, magic_steps=args.magic_steps, seed=args.seed,
                  alpha=args.alpha, lambda_e=args.lambda_e, attack_k=args.attack_k,
                  temp0=args.temp0)

    print("v3B: SA ablation -- three attack models, spectral gap on/off")
    print("n=%d  edges=%d  sa_steps=%d  attack_k=%d  alpha=%.2f  seed=%d" % (
        args.n, args.edges, args.sa_steps, args.attack_k, args.alpha, args.seed))
    print()

    print("Running Version A (no spectral gap) ...")
    init_a, best_a, log_a = run_sa(args.n, args.edges, args.sa_steps, params, use_spectral=False)

    print("Running Version B (with spectral gap, alpha=%.2f) ..." % args.alpha)
    init_b, best_b, log_b = run_sa(args.n, args.edges, args.sa_steps, params, use_spectral=True)

    print()
    header = "%-10s  %-10s  %-10s  %-10s  %-10s  %-8s  %-8s"
    print(header % ("version", "resilience", "r_random", "r_targeted", "r_cascade", "lambda2", "energy"))
    print("-" * 78)
    row = "%-10s  %-10.4f  %-10.4f  %-10.4f  %-10.4f  %-8.4f  %-8.1f"
    print(row % ("A init",  init_a["resilience"], init_a["r_random"],
                 init_a["r_targeted"], init_a["r_cascade"], init_a["sg"], init_a["energy"]))
    print(row % ("A best",  best_a["resilience"], best_a["r_random"],
                 best_a["r_targeted"], best_a["r_cascade"], best_a["sg"], best_a["energy"]))
    print(row % ("B init",  init_b["resilience"], init_b["r_random"],
                 init_b["r_targeted"], init_b["r_cascade"], init_b["sg"], init_b["energy"]))
    print(row % ("B best",  best_b["resilience"], best_b["r_random"],
                 best_b["r_targeted"], best_b["r_cascade"], best_b["sg"], best_b["energy"]))

    print()
    print("Per-attack delta (B best - A best):")
    print("  Random:   %+.4f (%+.2f%%)" % (
        best_b["r_random"]   - best_a["r_random"],
        (best_b["r_random"]  - best_a["r_random"]) * 100))
    print("  Targeted: %+.4f (%+.2f%%)" % (
        best_b["r_targeted"] - best_a["r_targeted"],
        (best_b["r_targeted"]- best_a["r_targeted"]) * 100))
    print("  Cascade:  %+.4f (%+.2f%%)" % (
        best_b["r_cascade"]  - best_a["r_cascade"],
        (best_b["r_cascade"] - best_a["r_cascade"]) * 100))
    print("  Overall:  %+.4f (%+.2f%%)" % (
        best_b["resilience"] - best_a["resilience"],
        (best_b["resilience"]- best_a["resilience"]) * 100))

    print()
    res_wins    = best_b["resilience"] > best_a["resilience"]
    sg_increased = best_b["sg"] > best_a["sg"]
    casc_diff   = best_b["r_cascade"]  - best_a["r_cascade"]
    rand_diff   = best_b["r_random"]   - best_a["r_random"]
    targ_diff   = best_b["r_targeted"] - best_a["r_targeted"]

    print("VERDICT")
    if res_wins and sg_increased and casc_diff > rand_diff:
        verdict = ("Spectral gap primarily helped via cascade robustness "
                   "(+%.2f%%) -- algebraic connectivity impeded propagation." % (casc_diff * 100))
    elif res_wins and sg_increased:
        verdict = ("Spectral gap improved resilience uniformly across all "
                   "attack types -- not cascade-specific.")
    elif res_wins and not sg_increased:
        verdict = ("Resilience improved but lambda2 did not increase -- SA "
                   "found a better topology without spectral pressure.")
    elif not res_wins and sg_increased:
        verdict = ("lambda2 increased (%.3f -> %.3f) but resilience fell "
                   "(%.2f%%) -- higher connectivity accelerated cascade failure." % (
                       best_a["sg"], best_b["sg"],
                       (best_b["resilience"] - best_a["resilience"]) * 100))
    else:
        verdict = "No improvement in either version -- increase sa_steps or alpha."

    print("  " + verdict)
    print("  lambda2: A=%.4f  B=%.4f" % (best_a["sg"], best_b["sg"]))


if __name__ == "__main__":
    main()

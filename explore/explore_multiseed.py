"""
Multi-seed robustness: mean +/- 95% CI of resilience vs spectral weight alpha.

Port of JSX_assest/magic_multiseed.jsx (simulation logic only; React UI omitted).

Runs NUM_SEEDS independent graphs per alpha value to determine whether the
spectral-gap benefit seen with a single seed is a genuine effect or noise.
For each (alpha, seed) pair a short SA run is executed; results are aggregated
into mean, std, and 95% CI per alpha.

Verdict logic (mirrors the JSX):
  - spectral_helps : best alpha CI does not overlap alpha=0 CI
  - phase_transition: alpha=1.0 mean is meaningfully below the peak
  - cascade_leads   : cascade attack improves more than random attack at best alpha

Default parameters match the JSX component defaults:
  n=18, edges=28, magic_steps=180, target=20, lambda_e=0.1, attack_k=3
  NUM_SEEDS=15, SA_STEPS=40 (fixed inside JSX)

Usage:
    python explore_multiseed.py [--n N] [--edges E] [--magic-steps M]
                                [--target T] [--lambda-e L] [--attack-k K]
                                [--num-seeds S]
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

def make_graph(n, target_edges, seed):
    rng = make_lcg(seed)
    edge_set = set()
    for i in range(n - 1):
        edge_set.add((i, i + 1))
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

# ── spectral gap ──────────────────────────────────────────────────────────────

def spectral_gap(n, adj, iters=60):
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

# ── attack models ─────────────────────────────────────────────────────────────

def attack_random(adj, k, seed):
    return (len(adj) - k) / len(adj)

def attack_targeted(adj, k):
    n = len(adj)
    alive = set(range(n))
    for _ in range(k):
        if not alive:
            break
        best = max(alive, key=lambda i: sum(1 for j in adj[i] if j in alive))
        alive.discard(best)
    return len(alive) / n

def attack_cascade(adj, initial_dead):
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
                    alive[nb] = False; dying.append(nb); changed = True
        queue = dying
    return alive.sum() / n

def top_k_nodes(adj, k):
    return sorted(range(len(adj)), key=lambda i: len(adj[i]), reverse=True)[:k]

# ── evaluate + SA ─────────────────────────────────────────────────────────────

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

    r_rand = attack_random(adj, attack_k, seed)
    r_targ = attack_targeted(adj, attack_k)
    r_casc = attack_cascade(adj, top_k_nodes(adj, attack_k))
    resilience = 0.2 * r_rand + 0.4 * r_targ + 0.4 * r_casc

    score = resilience + alpha * (sg / 2.0) - lambda_e * norm_e
    return dict(score=score, resilience=resilience, r_rand=r_rand,
                r_targ=r_targ, r_casc=r_casc, sg=sg)

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

def run_one_sa(n, edge_count, sa_steps, params, alpha, graph_seed):
    edges = make_graph(n, edge_count, graph_seed)
    cur_score = evaluate(edges, n, params, alpha)["score"]
    best_score = cur_score; best_edges = edges[:]

    rng = make_lcg(graph_seed * 100 + int(alpha * 37))
    T0 = 0.3

    for step in range(sa_steps):
        T = T0 * math.exp(-3 * step / sa_steps)
        cand = sa_step(edges, n, rng)
        if cand is None:
            continue
        p_step = dict(params, seed=params["seed"] + step)
        res = evaluate(cand, n, p_step, alpha)
        d = res["score"] - cur_score
        if d > 0 or random.random() < math.exp(d / max(T, 1e-6)):
            edges = cand; cur_score = res["score"]
            if res["score"] > best_score:
                best_score = res["score"]; best_edges = cand[:]

    return evaluate(best_edges, n, params, alpha)

# ── statistics ────────────────────────────────────────────────────────────────

def mean(arr):
    return sum(arr) / len(arr)

def std(arr):
    m = mean(arr)
    return math.sqrt(sum((v - m) ** 2 for v in arr) / len(arr))

def ci95(arr):
    return 1.96 * std(arr) / math.sqrt(len(arr))

def ci_overlap(m1, ci1, m2, ci2):
    return not (m1 + ci1 < m2 - ci2 or m2 + ci2 < m1 - ci1)

# ── main ──────────────────────────────────────────────────────────────────────

ALPHA_VALUES = [0.0, 0.1, 0.3, 0.5, 1.0]
SA_STEPS = 40

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--n",           type=int,   default=18)
    ap.add_argument("--edges",       type=int,   default=28)
    ap.add_argument("--magic-steps", type=int,   default=180)
    ap.add_argument("--target",      type=float, default=20.0)
    ap.add_argument("--lambda-e",    type=float, default=0.1)
    ap.add_argument("--attack-k",    type=int,   default=3)
    ap.add_argument("--num-seeds",   type=int,   default=15)
    args = ap.parse_args()

    num_seeds = args.num_seeds
    total_runs = len(ALPHA_VALUES) * num_seeds
    params_base = dict(target=args.target, magic_steps=args.magic_steps,
                       seed=1, lambda_e=args.lambda_e, attack_k=args.attack_k)

    print("Multi-seed robustness: %d alpha values x %d seeds = %d runs" % (
        len(ALPHA_VALUES), num_seeds, total_runs))
    print("n=%d  edges=%d  sa_steps=%d  magic_steps=%d  attack_k=%d" % (
        args.n, args.edges, SA_STEPS, args.magic_steps, args.attack_k))
    print()

    # raw_results[alpha_idx][seed_idx] = result dict
    raw_results = [[None] * num_seeds for _ in ALPHA_VALUES]
    done = 0

    for ai, alpha in enumerate(ALPHA_VALUES):
        for si in range(num_seeds):
            seed = si + 1
            p = dict(params_base, seed=seed)
            res = run_one_sa(args.n, args.edges, SA_STEPS, p, alpha, seed)
            raw_results[ai][si] = res
            done += 1
            if done % 5 == 0 or done == total_runs:
                print("  %d/%d" % (done, total_runs), flush=True)

    # compute per-alpha statistics
    print()
    print("%-6s  %-6s  %-8s  %-8s  %-8s  %-8s  %-8s  %-10s" % (
        "alpha", "n", "mean%", "std%", "CI95%", "r_rand%", "r_targ%", "r_casc%"))
    print("-" * 74)

    alpha_stats = []
    for ai, alpha in enumerate(ALPHA_VALUES):
        vals = [r["resilience"] for r in raw_results[ai]]
        m = mean(vals); s = std(vals); c = ci95(vals)
        r_rand_m = mean([r["r_rand"] for r in raw_results[ai]])
        r_targ_m = mean([r["r_targ"] for r in raw_results[ai]])
        r_casc_m = mean([r["r_casc"] for r in raw_results[ai]])
        alpha_stats.append(dict(mean=m, std=s, ci=c, n=len(vals),
                                r_rand=r_rand_m, r_targ=r_targ_m, r_casc=r_casc_m))
        vs_zero = (m - alpha_stats[0]["mean"]) * 100 if ai > 0 else 0.0
        print("%-6.1f  %-6d  %-8.2f  %-8.2f  %-8.2f  %-8.2f  %-8.2f  %-8.2f  %+.2f%%" % (
            alpha, len(vals), m*100, s*100, c*100,
            r_rand_m*100, r_targ_m*100, r_casc_m*100, vs_zero))

    # verdict
    print()
    s0 = alpha_stats[0]
    peak_idx = max(range(len(alpha_stats)), key=lambda i: alpha_stats[i]["mean"])
    sp = alpha_stats[peak_idx]

    best_ci_overlaps = ci_overlap(sp["mean"], sp["ci"], s0["mean"], s0["ci"])
    spectral_helps = sp["mean"] > s0["mean"] and not best_ci_overlaps

    s4 = alpha_stats[-1]
    phase_transition = s4["mean"] < sp["mean"] - 0.005

    casc_gain = sp["r_casc"] - s0["r_casc"]
    rand_gain = sp["r_rand"] - s0["r_rand"]
    targ_gain = sp["r_targ"] - s0["r_targ"]
    cascade_leads = casc_gain > rand_gain and casc_gain > targ_gain

    print("VERDICT (%d seeds)" % num_seeds)
    print("  Spectral helps?    %s  (CI overlap with alpha=0: %s)" % (
        "YES" if spectral_helps else "NO",
        "yes" if best_ci_overlaps else "no"))
    print("  Best alpha:        %.1f  (mean=%.4f +/- %.4f)" % (
        ALPHA_VALUES[peak_idx], sp["mean"], sp["ci"]))
    print("  Phase transition?  %s  (alpha=1.0 mean=%.4f vs peak=%.4f)" % (
        "YES" if phase_transition else "NO", s4["mean"], sp["mean"]))
    print("  Cascade leads?     %s  (cascade gain=%.4f, rand=%.4f, targ=%.4f)" % (
        "YES" if cascade_leads else "NO", casc_gain, rand_gain, targ_gain))


if __name__ == "__main__":
    main()

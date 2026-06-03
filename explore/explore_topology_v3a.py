"""
Spectral-gap ablation via collapse simulation (v3a).

Port of JSX_assest/magic_topology_v3a.jsx (simulation logic only; React UI omitted).

Runs two SA optimisations on the same initial graph:

  Version A -- fitness = resilience - lambda_e * energy_norm
  Version B -- fitness = resilience + alpha * sg_norm - lambda_e * energy_norm

"Resilience" here is measured by a health-based collapse simulation:
each alive node loses health proportional to the count of its dead neighbours,
softened by its own magic value x[i].  The metric is the fraction of nodes
still alive after a fixed number of collapse steps.

This isolates whether including spectral gap in the SA objective causes the
optimiser to find topologies with genuinely better collapse resistance, or
whether lambda2 is just a proxy that adds noise.

Default parameters match JSX component defaults:
  n=18, edges=28, sa_steps=100, magic_steps=250, target=20, dmg=1.0,
  lambda_e=0.1, alpha=0.3, temp0=0.3, seed=42

Usage:
    python explore_topology_v3a.py [--n N] [--edges E] [--sa-steps S]
                                   [--magic-steps M] [--target T] [--dmg D]
                                   [--lambda-e L] [--alpha A] [--temp0 T0]
                                   [--seed SEED]
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

# ── collapse simulation (v3a-specific) ───────────────────────────────────────

def get_attacked(adj, k=3):
    """Return indices of the k highest-degree nodes."""
    return sorted(range(len(adj)), key=lambda i: len(adj[i]), reverse=True)[:k]

def simulate_collapse(adj, x, attacked, dmg=1.0, steps=40):
    """
    Health-based cascade collapse.  Each alive node i loses health each step
    proportional to its number of dead neighbours, divided by (1 + x[i]/20).
    Returns fraction alive at end and per-step alive counts.
    """
    n = len(adj)
    h = np.full(n, 100.0)
    for nd in attacked:
        h[nd] = 0.0
    hist = []
    for _ in range(steps):
        hist.append(int((h > 0).sum()))
        nh = h.copy()
        for i in range(n):
            if h[i] <= 0:
                continue
            dead_count = sum(1 for j in adj[i] if h[j] <= 0)
            nh[i] = max(0.0, h[i] - (dead_count * dmg) / (1 + x[i] / 20.0))
        h = nh
    return float((h > 0).sum()) / n, hist

# ── evaluate ──────────────────────────────────────────────────────────────────

def evaluate(edges, n, params, use_spectral):
    target      = params["target"]
    dmg         = params["dmg"]
    magic_steps = params["magic_steps"]
    seed        = params["seed"]
    alpha       = params["alpha"]
    lambda_e    = params["lambda_e"]

    adj = build_adj(n, edges)
    x = optimize_magic(adj, target, magic_steps, seed)
    energy = magic_energy(adj, x, target)
    norm_e = energy / (n * target * target)

    attacked = get_attacked(adj)
    resilience, hist = simulate_collapse(adj, x, attacked, dmg)

    sg = spectral_gap(n, adj) if use_spectral else 0.0
    norm_sg = sg / 2.0

    score = resilience + (alpha * norm_sg if use_spectral else 0.0) - lambda_e * norm_e
    return dict(score=score, resilience=resilience, energy=energy,
                sg=sg, norm_sg=norm_sg, hist=hist, attacked=attacked)

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
    ap.add_argument("--dmg",         type=float, default=1.0)
    ap.add_argument("--lambda-e",    type=float, default=0.1)
    ap.add_argument("--alpha",       type=float, default=0.3)
    ap.add_argument("--temp0",       type=float, default=0.3)
    ap.add_argument("--seed",        type=int,   default=42)
    args = ap.parse_args()

    params = dict(target=args.target, dmg=args.dmg, magic_steps=args.magic_steps,
                  seed=args.seed, alpha=args.alpha, lambda_e=args.lambda_e,
                  temp0=args.temp0)

    print("v3A: SA ablation -- collapse simulation, spectral gap on/off")
    print("n=%d  edges=%d  sa_steps=%d  alpha=%.2f  dmg=%.1f  seed=%d" % (
        args.n, args.edges, args.sa_steps, args.alpha, args.dmg, args.seed))
    print()

    print("Running Version A (no spectral gap) ...")
    init_a, best_a, log_a = run_sa(args.n, args.edges, args.sa_steps, params, use_spectral=False)

    print("Running Version B (with spectral gap, alpha=%.2f) ..." % args.alpha)
    init_b, best_b, log_b = run_sa(args.n, args.edges, args.sa_steps, params, use_spectral=True)

    def fmt_result(label, init, best):
        res_delta = (best["resilience"] - init["resilience"]) * 100
        score_delta = best["score"] - init["score"]
        print("  %s" % label.replace("—", "--"))
        print("    Initial   resilience=%.4f  sg=%.4f  energy=%.1f" % (
            init["resilience"], init["sg"], init["energy"]))
        print("    Optimized resilience=%.4f  sg=%.4f  energy=%.1f" % (
            best["resilience"], best["sg"], best["energy"]))
        print("    Resilience delta: %+.2f%%   Score delta: %+.4f" % (res_delta, score_delta))

    print()
    fmt_result("VERSION A — No Spectral Gap", init_a, best_a)
    print()
    fmt_result("VERSION B — With Spectral Gap", init_b, best_b)

    print()
    print("VERDICT")
    res_wins    = best_b["resilience"] > best_a["resilience"]
    sg_higher   = best_b["sg"] > best_a["sg"]
    res_gain    = (best_b["resilience"] - best_a["resilience"]) * 100

    if res_wins and sg_higher:
        verdict = ("Spectral pressure found graphs with higher lambda2 "
                   "(%.3f -> %.3f) AND better collapse resilience (%+.2f%%)." % (
                       best_a["sg"], best_b["sg"], res_gain))
    elif res_wins and not sg_higher:
        verdict = ("Resilience improved (%+.2f%%) but lambda2 did not increase "
                   "-- SA found a better topology without raising spectral gap." % res_gain)
    elif not res_wins and sg_higher:
        verdict = ("lambda2 increased (%.3f -> %.3f) but resilience fell (%.2f%%) "
                   "-- higher connectivity accelerated collapse propagation." % (
                       best_a["sg"], best_b["sg"], res_gain))
    else:
        verdict = "Neither resilience nor spectral gap improved in B -- try more SA steps or higher alpha."

    print("  " + verdict)
    print("  lambda2: A=%.4f  B=%.4f" % (best_a["sg"], best_b["sg"]))
    print("  Resilience: A=%.4f  B=%.4f" % (best_a["resilience"], best_b["resilience"]))


if __name__ == "__main__":
    main()

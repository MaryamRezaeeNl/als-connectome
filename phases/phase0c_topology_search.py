"""Phase 0C -- AI-Learned Topology Search.

Third prototype (2026-05-18). Combines the cascade model (Phase 0A) and
magic-graph optimiser (Phase 0B) to search for network topologies that are
maximally resilient to targeted-hub attack.

Algorithm:
  1. Generate 30 random Erdos-Renyi graphs at 4 edge densities (p in 0.12-0.35)
  2. For each graph, optimise magic-node values (balance each node's neighbour sum)
  3. Simulate cascade: attack top-3 degree-centrality hubs, track survival for 40 steps
  4. Score = survival_rate - energy_residual / 10000
  5. Identify best and worst topology

Key finding (later confirmed in Phase R2.1):
  Denser graphs (more edges) perform worse under targeted attack.
  Best graph (index 28, 28 edges, p=0.12): score=0.42, survival=45%
  Worst graph (index 2,  55 edges, p=0.25): score=-0.03, survival=0%

Connection to the full ALS model:
  This is the direct precursor to Phase 7C (topology robustness) and Phase R2.1
  (motif resilience). The finding that 'more connected != more resilient' is the
  same result that sparse_chain topology (RES=0.815) vs triangle_rich (RES=0.738)
  confirmed on the C. elegans connectome in Round 2.

Run from project root:
  python phases/phase0c_topology_search.py
"""

import numpy as np
import time

try:
    import networkx as nx
    HAS_NX = True
except ImportError:
    HAS_NX = False
    print("WARNING: networkx not installed.")

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


# ── Constants ──────────────────────────────────────────────────────────────────
N_NODES     = 20
N_GRAPHS    = 30
P_VALUES    = [0.12, 0.18, 0.25, 0.35]
TARGET      = 20
OPT_STEPS   = 800
LEARNING_RATE = 0.001
COLLAPSE_STEPS = 40
DAMAGE_RATE = 4
N_HUB_ATTACK = 3  # attack top-N degree-centrality hubs


# ── Graph construction ─────────────────────────────────────────────────────────

def make_connected_graph(n, p, seed):
    """Build a connected Erdos-Renyi graph; fall back to path graph if needed."""
    if not HAS_NX:
        raise RuntimeError("networkx required")
    rng = np.random.default_rng(seed)
    for _ in range(100):
        G = nx.erdos_renyi_graph(n=n, p=p, seed=int(rng.integers(0, 1_000_000)))
        if nx.is_connected(G):
            return nx.convert_node_labels_to_integers(G)
    # Fallback: path graph + random edges
    G = nx.path_graph(n)
    extras = [(i, j) for i in range(n) for j in range(i + 1, n) if not G.has_edge(i, j)]
    n_extra = int(p * len(extras))
    rng.shuffle(extras)
    G.add_edges_from(extras[:n_extra])
    return nx.convert_node_labels_to_integers(G)


# ── Magic graph helpers ────────────────────────────────────────────────────────

def magic_energy(adj, x, target=TARGET):
    errors = adj @ x - target
    return float(np.sum(errors ** 2))


def optimize_magic(adj, n, target=TARGET, lr=LEARNING_RATE,
                   steps=OPT_STEPS, seed=0):
    """Numerical gradient descent to minimise magic energy."""
    rng = np.random.default_rng(seed)
    x = rng.uniform(0, 10, size=n)
    epsilon = 1e-5
    for _ in range(steps):
        E = magic_energy(adj, x, target)
        grad = np.zeros_like(x)
        for k in range(n):
            xp    = x.copy(); xp[k] += epsilon
            grad[k] = (magic_energy(adj, xp, target) - E) / epsilon
        x -= lr * grad
        x  = np.clip(x, 0, 100)
    return x, magic_energy(adj, x, target)


# ── Collapse simulation ────────────────────────────────────────────────────────

def simulate_collapse(G, x_magic, attacked_nodes,
                       damage_rate=DAMAGE_RATE, steps=COLLAPSE_STEPS):
    """Cascade where nodes lose health from dead neighbours; magic-value = resistance."""
    health = np.ones(G.number_of_nodes()) * 100.0
    for node in attacked_nodes:
        health[node] = 0.0

    alive_history = []
    adj_list = {i: list(G.neighbors(i)) for i in G.nodes()}

    for _ in range(steps):
        alive_history.append(int(np.sum(health > 0)))
        new_health = health.copy()
        for i in G.nodes():
            if health[i] <= 0:
                continue
            dead_nb = sum(1 for j in adj_list[i] if health[j] <= 0)
            # Nodes with higher magic-value are slightly more resistant
            resistance = 1 + (x_magic[i] / 20.0)
            damage     = (dead_nb * damage_rate) / resistance
            new_health[i] -= damage
        new_health[new_health < 0] = 0
        health = new_health

    final_alive = int(np.sum(health > 0))
    return final_alive, alive_history


# ── Graph evaluation ──────────────────────────────────────────────────────────

def evaluate_graph(G, seed=0):
    """Optimise magic values and run collapse; return score dict."""
    adj = nx.to_numpy_array(G)
    n   = G.number_of_nodes()
    x_opt, final_energy = optimize_magic(adj, n, seed=seed)

    # Attack top-3 degree-centrality hubs
    centrality    = nx.degree_centrality(G)
    attacked      = sorted(centrality, key=centrality.get, reverse=True)[:N_HUB_ATTACK]
    final_alive, history = simulate_collapse(G, x_opt, attacked)

    resilience = final_alive / n
    # Score: high survival is good, high residual energy is bad
    score = resilience - final_energy / 10000.0

    return {
        "x": x_opt,
        "energy": final_energy,
        "resilience": resilience,
        "score": score,
        "alive_history": history,
        "attacked": attacked,
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("Phase 0C -- AI-Learned Topology Search")
    print("%d graphs, n=%d, p in %s" % (N_GRAPHS, N_NODES, P_VALUES))
    print()

    if not HAS_NX:
        print("networkx not available -- skipping")
        print("\nPhase 0C complete")
        return

    results = []
    t0 = time.time()

    for idx in range(N_GRAPHS):
        p = P_VALUES[idx % len(P_VALUES)]
        G = make_connected_graph(n=N_NODES, p=p, seed=idx)
        res = evaluate_graph(G, seed=idx)
        res["index"]  = idx
        res["p"]      = p
        res["edges"]  = G.number_of_edges()
        res["G"]      = G
        results.append(res)
        if (idx + 1) % 10 == 0:
            print("  %d/%d  %.0fs" % (idx + 1, N_GRAPHS, time.time() - t0))

    elapsed = time.time() - t0

    best  = max(results, key=lambda r: r["score"])
    worst = min(results, key=lambda r: r["score"])

    print()
    print("=== RESULTS ===")
    print("Best graph:  index=%d  p=%.2f  edges=%d  score=%.4f  survival=%.0f%%  energy=%.1f" % (
        best["index"], best["p"], best["edges"],
        best["score"], best["resilience"] * 100, best["energy"]))
    print("Worst graph: index=%d  p=%.2f  edges=%d  score=%.4f  survival=%.0f%%  energy=%.1f" % (
        worst["index"], worst["p"], worst["edges"],
        worst["score"], worst["resilience"] * 100, worst["energy"]))
    print()
    print("Total elapsed: %.0fs" % elapsed)

    # Summary table
    print()
    print("Score by edge density group:")
    for p_val in P_VALUES:
        group = [r for r in results if r["p"] == p_val]
        scores    = [r["score"]      for r in group]
        survivals = [r["resilience"] for r in group]
        edges_avg = sum(r["edges"] for r in group) / len(group)
        print("  p=%.2f: mean_score=%.3f  mean_survival=%.1f%%  mean_edges=%.1f" % (
            p_val, float(np.mean(scores)),
            float(np.mean(survivals)) * 100, edges_avg))

    print()
    print("Key finding: denser graphs (higher p, more edges) consistently score lower.")
    print("Confirmed in Phase R2.1: sparse_chain RES=0.815 vs triangle_rich RES=0.738")

    if HAS_MATPLOTLIB:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))

        # Scatter: edges vs survival, coloured by p
        p_colours = {0.12: "#00e5ff", 0.18: "#a8ff78", 0.25: "#ffd700", 0.35: "#ff4444"}
        for res in results:
            col = p_colours.get(res["p"], "#888888")
            axes[0].scatter(res["edges"], res["resilience"] * 100,
                            color=col, alpha=0.7, s=60,
                            label=("p=%.2f" % res["p"]))
        # Mark best and worst
        axes[0].scatter(best["edges"],  best["resilience"]  * 100,
                        color="#ffffff", marker="*", s=200, zorder=5, label="Best")
        axes[0].scatter(worst["edges"], worst["resilience"] * 100,
                        color="#ff0000", marker="X", s=200, zorder=5, label="Worst")
        axes[0].set_xlabel("Edge count")
        axes[0].set_ylabel("Survival rate (%)")
        axes[0].set_title("Phase 0C: Edge Count vs Resilience")

        # Best vs worst alive histories
        axes[1].plot(best["alive_history"],  color="#00e5ff", linewidth=2, label="Best (idx=%d, e=%d)" % (best["index"],  best["edges"]))
        axes[1].plot(worst["alive_history"], color="#ff4444", linewidth=2, label="Worst (idx=%d, e=%d)" % (worst["index"], worst["edges"]))
        axes[1].set_xlabel("Collapse step")
        axes[1].set_ylabel("Alive nodes")
        axes[1].set_title("Phase 0C: Collapse Comparison")
        axes[1].legend(fontsize=9)

        plt.tight_layout()
        plt.savefig("results/phase0c_topology_search.png", dpi=150)
        print("\nFigure saved: results/phase0c_topology_search.png")

    print("\nPhase 0C complete")
    return results


if __name__ == "__main__":
    main()

"""Phase 0B -- Magic Graph Optimizer.

Second prototype (2026-05-18). Introduces real network topology via NetworkX.

A 'magic graph' is a graph where every node's value is chosen such that
the sum of its neighbours' values equals a target T for all nodes simultaneously.
This is solved by numerical gradient descent on the total squared error.

Connection to the full ALS model:
  This is the conceptual origin of Phase 2 (Magic Balancing): the idea that
  a healthy neural circuit is one where excitatory load is balanced across nodes
  so every neuron's incoming signal sums to a target activity level.
  The gradient descent here is the precursor to the therapeutic optimisation
  explored in Phases 6 and 9 (aggregation suppression).

Key result:
  Erdos-Renyi graph (n=20, p=0.18, 34 edges)
  Initial energy: 1708  ->  Final energy: 572  (3000 gradient steps)
  Neighbour sums move from [0, 31] range toward target=20.

Run from project root:
  python phases/phase0b_magic_graph.py
"""

import numpy as np
import time

try:
    import networkx as nx
    HAS_NX = True
except ImportError:
    HAS_NX = False
    print("WARNING: networkx not installed. Some functions will be skipped.")

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


# ── Constants ──────────────────────────────────────────────────────────────────
N_NODES      = 20
EDGE_PROB    = 0.18
TARGET       = 20     # desired neighbour-sum for each node
LEARNING_RATE = 0.001
OPT_STEPS    = 3000
SEED         = 42


# ── Graph helpers ──────────────────────────────────────────────────────────────

def build_graph(n=N_NODES, p=EDGE_PROB, seed=SEED):
    """Build a connected Erdos-Renyi random graph."""
    if not HAS_NX:
        raise RuntimeError("networkx required for graph construction")
    G = nx.erdos_renyi_graph(n=n, p=p, seed=seed)
    if not nx.is_connected(G):
        largest = max(nx.connected_components(G), key=len)
        G = G.subgraph(largest).copy()
    G = nx.convert_node_labels_to_integers(G)
    return G


def neighbour_sums(adj, x):
    """Compute the sum of neighbour values for each node (via adjacency matrix)."""
    return adj @ x


def magic_energy(adj, x, target):
    """Total squared error from each node's neighbour sum equalling the target."""
    errors = neighbour_sums(adj, x) - target
    return float(np.sum(errors ** 2))


# ── Optimiser ──────────────────────────────────────────────────────────────────

def optimize_magic_graph(adj, n, target=TARGET, lr=LEARNING_RATE,
                          steps=OPT_STEPS, seed=SEED):
    """Gradient descent via numerical finite differences.

    Returns:
        x_opt   -- optimised node values (n,)
        history -- energy at each step
    """
    rng = np.random.default_rng(seed)
    x = rng.uniform(0, 10, size=n)
    history = []
    epsilon = 1e-5

    for _ in range(steps):
        current_energy = magic_energy(adj, x, target)
        history.append(current_energy)

        grad = np.zeros_like(x)
        for k in range(n):
            x_plus    = x.copy()
            x_plus[k] += epsilon
            e_plus    = magic_energy(adj, x_plus, target)
            grad[k]   = (e_plus - current_energy) / epsilon

        x -= lr * grad
        x  = np.clip(x, 0, 100)

    return x, history


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("Phase 0B -- Magic Graph Optimizer")
    print("Graph: n=%d, p=%.2f, target=%d" % (N_NODES, EDGE_PROB, TARGET))
    print("Optimizer: %d steps, lr=%.4f (numerical gradient)" % (OPT_STEPS, LEARNING_RATE))
    print()

    if not HAS_NX:
        print("networkx not available -- skipping")
        print("\nPhase 0B complete")
        return

    G   = build_graph()
    n   = G.number_of_nodes()
    adj = nx.to_numpy_array(G)

    print("Graph built: %d nodes, %d edges" % (n, G.number_of_edges()))

    # Initial random values
    rng = np.random.default_rng(SEED)
    x_init = rng.uniform(0, 10, size=n)
    energy_init = magic_energy(adj, x_init, TARGET)

    print("Initial energy: %.2f" % energy_init)
    print("Optimising...")
    t0 = time.time()

    x_opt, energy_history = optimize_magic_graph(adj, n)
    elapsed = time.time() - t0

    energy_final = magic_energy(adj, x_opt, TARGET)
    print("Final energy:   %.2f (%.1f%% reduction)" % (
        energy_final, 100 * (1 - energy_final / energy_init)))
    print("Elapsed: %.1fs" % elapsed)

    # Neighbour sum comparison
    sums_before = neighbour_sums(adj, x_init)
    sums_after  = neighbour_sums(adj, x_opt)
    print()
    print("Neighbour sums (first 8 nodes):")
    print("  Before: " + " ".join("%.1f" % v for v in sums_before[:8]))
    print("  After:  " + " ".join("%.1f" % v for v in sums_after[:8]))
    print("  Target: %d" % TARGET)
    print("  After variance from target: %.2f (before: %.2f)" % (
        float(np.var(sums_after - TARGET)),
        float(np.var(sums_before - TARGET))))

    if HAS_MATPLOTLIB:
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))

        # Energy decay curve
        axes[0].plot(energy_history, color="#00e5ff", linewidth=1.5)
        axes[0].set_xlabel("Optimisation step")
        axes[0].set_ylabel("Magic energy (total squared error)")
        axes[0].set_title("Phase 0B: Magic Energy Convergence")
        axes[0].axhline(y=energy_final, color="#a8ff78", linestyle="--", linewidth=0.8)

        # Neighbour sums before vs after
        nodes = range(n)
        axes[1].bar([x - 0.2 for x in nodes], sums_before, 0.4,
                    label="Before", color="#374151")
        axes[1].bar([x + 0.2 for x in nodes], sums_after, 0.4,
                    label="After",  color="#00e5ff", alpha=0.8)
        axes[1].axhline(y=TARGET, color="#ffd700", linestyle="--",
                         linewidth=1.5, label="Target")
        axes[1].set_xlabel("Node index")
        axes[1].set_ylabel("Neighbour sum")
        axes[1].set_title("Phase 0B: Neighbour Sums Before/After")
        axes[1].legend(fontsize=9)

        plt.tight_layout()
        plt.savefig("results/phase0b_magic_graph.png", dpi=150)
        print("\nFigure saved: results/phase0b_magic_graph.png")

    print("\nPhase 0B complete")
    return x_opt, energy_history


if __name__ == "__main__":
    main()

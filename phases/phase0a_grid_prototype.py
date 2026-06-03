"""Phase 0A -- Grid Cascade Prototype.

Earliest ALS neurodegeneration prototype (2026-05-18).
A 30x30 grid of neurons where each neuron starts at 100% health.
One neuron at the centre is initially dead. Damage spreads to
4-connected neighbours at a fixed rate per dead neighbour per step.

This is the conceptual ancestor of the full C. elegans cascade model:
  dead neighbour -> health loss -> more dead neighbours -> cascade
The same two-tier cascade mechanism (seeding + spreading) is present
here in its simplest possible form before network topology was introduced.

Findings:
  - Cascade is slow initially (13 steps before first wave dies)
  - Accelerates as more neighbours become dead
  - By step 60: ~55 neurons dead out of 900 (damage ring radius ~4-5)

Run from project root:
  python phases/phase0a_grid_prototype.py
"""

import numpy as np
import time

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


# ── Constants ──────────────────────────────────────────────────────────────────
GRID_SIZE   = 30
STEPS       = 60
DAMAGE_RATE = 8   # HP removed per dead neighbour per step
INIT_HEALTH = 100


# ── Core simulation ────────────────────────────────────────────────────────────

def count_dead_neighbours(grid):
    """Return a same-shaped array with the number of dead (health<=0) 4-neighbours."""
    dead = grid <= 0
    counts = np.zeros_like(grid, dtype=int)
    counts[1:,  :]  += dead[:-1, :]   # damage from neighbour above
    counts[:-1, :]  += dead[1:,  :]   # damage from neighbour below
    counts[:,  1:]  += dead[:,  :-1]  # damage from neighbour to the left
    counts[:, :-1]  += dead[:,   1:]  # damage from neighbour to the right
    return counts


def update_health(grid, damage_rate):
    """Apply one step of neighbour-driven damage spread."""
    dead_nb = count_dead_neighbours(grid)
    new_grid = grid - dead_nb * damage_rate
    new_grid[new_grid < 0] = 0
    return new_grid


def run_grid_simulation(size=GRID_SIZE, steps=STEPS, damage_rate=DAMAGE_RATE):
    """Run the cascade and return alive-count history."""
    health = np.ones((size, size)) * INIT_HEALTH

    # Single dead neuron at centre -- initial ALS-like focal seeding
    centre = size // 2
    health[centre, centre] = 0

    alive_history = []
    for _ in range(steps):
        alive_history.append(int(np.sum(health > 0)))
        health = update_health(health, damage_rate)

    return alive_history, health


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("Phase 0A -- Grid Cascade Prototype")
    print("Grid: %dx%d = %d neurons" % (GRID_SIZE, GRID_SIZE, GRID_SIZE**2))
    print("Damage rate: %d HP per dead neighbour per step" % DAMAGE_RATE)
    print()

    t0 = time.time()
    alive_history, final_health = run_grid_simulation()
    elapsed = time.time() - t0

    n_total = GRID_SIZE ** 2
    n_alive_final = alive_history[-1]
    n_dead_final  = n_total - n_alive_final

    # Find the step when cascade first accelerates (first drop below 899)
    first_death_step = next((i for i, a in enumerate(alive_history) if a < n_total - 1), None)

    print("Results after %d steps:" % STEPS)
    print("  Total neurons:  %d" % n_total)
    print("  Alive at t=0:   %d" % alive_history[0])
    print("  Alive at t=%d:  %d" % (STEPS - 1, n_alive_final))
    print("  Dead at t=%d:   %d" % (STEPS - 1, n_dead_final))
    print("  First death at: step %s" % (str(first_death_step) if first_death_step else "none"))
    print("  Elapsed: %.3fs" % elapsed)

    # Spot-check wave arrivals
    for t_check in [13, 19, 25, 35, 50, 59]:
        if t_check < len(alive_history):
            print("  t=%2d: %d alive (%d dead)" % (
                t_check, alive_history[t_check], n_total - alive_history[t_check]))

    if HAS_MATPLOTLIB:
        plt.figure(figsize=(8, 4))
        plt.plot(range(STEPS), alive_history, color="#00e5ff", linewidth=2)
        plt.xlabel("Step")
        plt.ylabel("Alive neurons")
        plt.title("Phase 0A: Grid Cascade — Alive Neurons Over Time")
        plt.axhline(y=n_total, color="#374151", linestyle="--", linewidth=0.8)
        plt.tight_layout()
        plt.savefig("results/phase0a_grid_cascade.png", dpi=150)
        print("\nFigure saved: results/phase0a_grid_cascade.png")

    print("\nPhase 0A complete")
    return alive_history


if __name__ == "__main__":
    main()

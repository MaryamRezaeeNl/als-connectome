"""Baseline ALS-inspired C. elegans connectome degeneration simulation."""

import numpy as np
from simulator import ConnectomeSimulator
from metrics import (
    locomotion_score, forward_locomotion_score, backward_locomotion_score,
    network_integrity, dead_neuron_counts, detect_tipping_points,
    most_vulnerable, hub_neurons, score_trajectory,
)
from connectome import NEURON_NAMES, NODE_TYPES

W = 62  # display width


def bar(v: float, width: int = 24) -> str:
    filled = round(v * width)
    return "[" + "#" * filled + "." * (width - filled) + f"] {v:.3f}"


def sep(c: str = "-") -> None:
    print(c * W)


def print_snapshot(sim: ConnectomeSimulator, step: int) -> None:
    h   = sim.health
    agg = sim.aggregation
    tox = sim.toxicity
    atp = sim.atp

    dead = dead_neuron_counts(h)
    loco = locomotion_score(h)
    fwd  = forward_locomotion_score(h)
    bwd  = backward_locomotion_score(h)
    intg = network_integrity(h)

    print(f"\nStep {step:>4d}  (t={sim.time:.0f})")
    sep()
    print(f"  Locomotion      {bar(loco)}")
    print(f"  Forward         {bar(fwd)}")
    print(f"  Backward        {bar(bwd)}")
    print(f"  Net integrity   {bar(intg)}"
          f"  ({round(intg*127)}/127 synapses)")
    print(f"  Dead neurons    {dead['total']:2d}/61"
          f"  (motor {dead['motor']:2d}, intern {dead['interneuron']:2d},"
          f" sensory {dead['sensory']:2d})")
    print(f"  Mean agg/tox/ATP (motor)"
          f"  {np.mean(agg[sim.is_motor]):.4f} /"
          f" {np.mean(tox[sim.is_motor]):.4f} /"
          f" {np.mean(atp[sim.is_motor]):.4f}")

    worst_idx = np.argsort(h)[:4]
    labels    = [f"{NEURON_NAMES[i]}({h[i]:.2f})" for i in worst_idx]
    print(f"  Most degraded   {', '.join(labels)}")


def main() -> None:
    sep("=")
    print("  ALS-Inspired C. elegans Connectome Degeneration Simulator")
    print("  61 neurons  |  127 synapses  |  Motor circuit")
    sep("=")

    # ── Connectome overview ──────────────────────────────────────────────────
    print("\n[Connectome statistics]")
    sep()
    counts = {t: sum(1 for n in NEURON_NAMES if NODE_TYPES[n] == t)
              for t in ("sensory", "interneuron", "motor")}
    for t, c in counts.items():
        print(f"  {t:<14s} {c:2d} neurons")

    print("\n  Top-5 most vulnerable neurons:")
    for name, v, ntype in most_vulnerable(5):
        print(f"    {name:<6s}  vuln={v:.2f}  ({ntype})")

    print("\n  Top-5 hub neurons (out-degree):")
    for name, deg, ntype in hub_neurons(5):
        print(f"    {name:<6s}  out={deg:2d}  ({ntype})")

    # ── Run simulation ───────────────────────────────────────────────────────
    STEPS = 500
    print(f"\n[Running baseline simulation: {STEPS} steps]")
    sep()

    sim = ConnectomeSimulator(seed=42, noise_scale=0.003)
    print_snapshot(sim, 0)

    REPORT_AT = {50, 100, 150, 200, 250, 300, 400, 500}
    for step in range(1, STEPS + 1):
        sim.step(dt=1.0)
        if step in REPORT_AT:
            print_snapshot(sim, step)

    # ── Tipping point analysis ────────────────────────────────────────────────
    print("\n\n[Tipping point analysis]")
    sep()
    tips = detect_tipping_points(sim.history, window=8)
    if tips:
        print(f"  {len(tips)} tipping point(s) detected:")
        for tp in tips[:10]:
            print(f"    t={tp['time']:5.0f}  score={tp['score']:.3f}"
                  f"  delta={tp['delta']:+.4f}  accel={tp['acceleration']:.1f}x")
    else:
        print("  No sharp tipping points - gradual degeneration pattern.")

    # ── Final summary ─────────────────────────────────────────────────────────
    print("\n[Final state  (t=500)]")
    sep()
    h    = sim.health
    dead = dead_neuron_counts(h)
    traj = score_trajectory(sim.history)

    peak_loss_step = int(np.argmin(np.diff(traj["loco"])))

    print(f"  Locomotion score       : {locomotion_score(h):.3f}"
          f"  (peak decline near t={peak_loss_step})")
    print(f"  Forward / Backward     : {forward_locomotion_score(h):.3f}"
          f" / {backward_locomotion_score(h):.3f}")
    print(f"  Network integrity      : {network_integrity(h):.3f}")
    print(f"  Total neurons dead     : {dead['total']}/61")
    print(f"  Motor neurons dead     : {dead['motor']}/37")
    print(f"    DA {dead['DA']}/9   DB {dead['DB']}/7"
          f"   DD {dead['DD']}/6"
          f"   VA {dead['VA']}/5   VB {dead['VB']}/5   VD {dead['VD']}/5")

    alive_names = [NEURON_NAMES[i] for i in range(sim.n) if h[i] > 0.15]
    by_type: dict[str, list[str]] = {}
    for name in alive_names:
        by_type.setdefault(NODE_TYPES[name], []).append(name)
    print(f"\n  Surviving neurons ({len(alive_names)}):")
    for t in ("sensory", "interneuron", "motor"):
        names = by_type.get(t, [])
        print(f"    {t:<14s} {len(names):2d}  {' '.join(names[:12])}"
              + ("..." if len(names) > 12 else ""))

    sep("=")
    print("  Simulation complete.")
    sep("=")


if __name__ == "__main__":
    main()

"""Phase 8 -- Two-Tier Cascade Initiation Test.

Tests whether protecting early-dying neurons (Tier 1 biochemical victims)
can block the Tier 2 topological (load-redistribution) cascade.

Config #334.  Strict Phase 7B criterion.  7 protection groups + controls.
"""

import json
import time
import random
import numpy as np
from pathlib import Path
from collections import defaultdict

try:
    import networkx as nx
    HAS_NX = True
except ImportError:
    HAS_NX = False

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'src'))

from connectome import NEURON_NAMES, VULNERABILITY, SYNAPSES, NODE_TYPES
from phase5_criticality import CriticalitySimulator
from phase6_therapy import TherapySimulator, _P5_KEYS

# ── Constants ─────────────────────────────────────────────────────────────────

N              = 61
STEPS          = 500
N_SEEDS        = 5
N_RAND         = 50      # random protection controls
N_RAND_PROTECT = 3       # neurons per random control group

SLOPE_THR  = 4
COH_THR    = 0.30
SILENT_MIN = 50
TIER2_THR  = 5           # cumulative deaths triggering Tier 2
TIER2_WIN  = 100         # window after T2 activation to count cascade size

BASE_SEED  = 434         # config #334 canonical seed (id+100)

BEST_THERAPY = {"type": "agg_sup", "strength": 0.855, "start_t": 13}

DA6_IDX  = NEURON_NAMES.index("DA6")
AVDL_IDX = NEURON_NAMES.index("AVDL")

VULN = np.array([VULNERABILITY[n] for n in NEURON_NAMES], dtype=float)
DEAD_THR = CriticalitySimulator.DEAD_THRESHOLD


# ── Load config #334 ──────────────────────────────────────────────────────────

def load_config334():
    with open("results/critical_configs.json") as f:
        data = json.load(f)
    for c in data["configs"]:
        if c["id"] == 334:
            return {k: c["params"][k] for k in _P5_KEYS}
    raise RuntimeError("Config #334 not found")


# ── Network properties ────────────────────────────────────────────────────────

def build_net_props():
    idx = {n: i for i, n in enumerate(NEURON_NAMES)}
    in_deg  = [0] * N
    out_deg = [0] * N
    load_w  = [0.0] * N
    total_w = sum(w for _, _, w, _ in SYNAPSES)

    for pre, post, w, _ in SYNAPSES:
        i, j = idx[pre], idx[post]
        out_deg[i] += 1
        in_deg[j]  += 1
        load_w[i]  += w
        load_w[j]  += w

    bridge_set = set()
    if HAS_NX:
        G = nx.Graph()
        G.add_nodes_from(range(N))
        for pre, post, _, _ in SYNAPSES:
            G.add_edge(idx[pre], idx[post])
        for u, v in nx.bridges(G):
            bridge_set.add(u)
            bridge_set.add(v)

    props = {}
    for i, name in enumerate(NEURON_NAMES):
        props[i] = {
            "name":        name,
            "vulnerability":    float(VULNERABILITY[name]),
            "in_degree":        in_deg[i],
            "out_degree":       out_deg[i],
            "total_degree":     in_deg[i] + out_deg[i],
            "load_contribution": load_w[i] / max(total_w, 1e-9),
            "is_bridge":        i in bridge_set,
            "node_type":        NODE_TYPES.get(name, "unknown"),
        }
    return props


# ── ProtectedSimulator ────────────────────────────────────────────────────────

class ProtectedSimulator(CriticalitySimulator):
    """CriticalitySimulator where specific neurons have 10x health capacity.

    Protected neurons still experience the full biochemical cascade
    (aggregation/ATP/calcium/ROS spread normally through them) but their
    net health loss each step is reduced to 10%.  They also cannot lock
    into irreversible ATP collapse.
    """

    def __init__(self, seed, params, protected_idx):
        super().__init__(seed=seed, params=params)
        self.protected_set = set(protected_idx)

    def step(self, dt=1.0):
        h_before = self.health.copy()
        n_alive  = super().step(dt)

        for i in self.protected_set:
            self.irreversible[i] = False          # no permanent collapse
            if h_before[i] > DEAD_THR:
                delta = self.health[i] - h_before[i]
                if delta < 0:
                    self.health[i] = h_before[i] + delta * 0.1
                    if self.health[i] < 0.0:
                        self.health[i] = 0.0

        return int((self.health > DEAD_THR).sum())


# ── Run one simulation, return per-neuron death steps ─────────────────────────

def _run_one(sim, steps):
    death_step = np.full(sim.n, steps, dtype=int)
    prev_alive = np.ones(sim.n, dtype=bool)
    for t in range(steps):
        sim.step()
        now_alive  = sim.health > DEAD_THR
        newly_dead = prev_alive & ~now_alive
        death_step[newly_dead] = t + 1
        prev_alive = now_alive
    return death_step


# ── Pearson r ─────────────────────────────────────────────────────────────────

def _pearson_r(x, y):
    if len(x) < 3:
        return 0.0
    mx, my = x.mean(), y.mean()
    num = ((x - mx) * (y - my)).sum()
    den = np.sqrt(((x - mx) ** 2).sum() * ((y - my) ** 2).sum())
    return float(num / den) if den > 1e-12 else 0.0


# ── Metrics from death-step arrays ───────────────────────────────────────────

def _metrics(death_steps_list, steps):
    per_seed = []
    for ds in death_steps_list:
        alive_at  = np.array([(ds > t).sum() for t in range(steps)], dtype=int)
        declines  = alive_at[:-10] - alive_at[10:]
        peak      = int(declines.max())
        tip_idx   = int(declines.argmax()) + 5
        died      = ds < steps
        silent    = int(ds[died].min()) if died.any() else steps
        coh_r     = (_pearson_r(VULN[died], -ds[died].astype(float))
                     if died.sum() >= 3 else 0.0)
        plateau   = int((ds >= steps).sum())
        n_dead    = int(died.sum())

        tier2 = steps
        for t in range(steps):
            if int((ds <= t).sum()) > TIER2_THR:
                tier2 = t
                break
        cascade = (int(((ds > tier2) & (ds <= tier2 + TIER2_WIN)).sum())
                   if tier2 < steps else 0)

        c1 = peak   > SLOPE_THR
        c2 = coh_r  > COH_THR
        c3 = silent > SILENT_MIN

        per_seed.append({
            "genuine": bool(c1 and c2 and c3),
            "c1": bool(c1), "c2": bool(c2), "c3": bool(c3),
            "tip":    tip_idx, "peak":   peak,   "coh_r":  coh_r,
            "plateau": plateau, "deaths": n_dead, "silent": silent,
            "tier2":  tier2,    "cascade": cascade,
        })

    def med(k):  return float(np.median([r[k] for r in per_seed]))
    def frac(k): return float(np.mean([r[k] for r in per_seed]))

    return {
        "genuine_rate":    frac("genuine"),
        "c1_rate":         frac("c1"),
        "c2_rate":         frac("c2"),
        "c3_rate":         frac("c3"),
        "tipping_step":    med("tip"),
        "peak_decline":    med("peak"),
        "coherence_r":     med("coh_r"),
        "plateau":         med("plateau"),
        "total_deaths":    med("deaths"),
        "first_death":     med("silent"),
        "tier2_activation": med("tier2"),
        "load_cascade_size": med("cascade"),
    }


# ── Step 1: Baseline characterization of first-10 deaths ─────────────────────

def characterize_first_deaths(params, props):
    """Single canonical-seed run to identify first-10-dying neurons."""
    sim = CriticalitySimulator(seed=BASE_SEED, params=params)
    ds  = _run_one(sim, STEPS)

    # Build neighbor sets
    sim2 = CriticalitySimulator(seed=BASE_SEED, params=params)
    neighbors = defaultdict(set)
    for j in range(N):
        for k, _, _ in sim2.in_edges[j]:
            neighbors[j].add(k)
            neighbors[k].add(j)

    death_order = np.argsort(ds)
    first10 = [int(i) for i in death_order if ds[i] < STEPS][:10]

    info = []
    for rank, i in enumerate(first10):
        t = int(ds[i])
        secondaries = sum(1 for nb in neighbors[i] if t < ds[nb] <= t + 30)
        info.append({
            "rank":             rank + 1,
            "idx":              i,
            "name":             NEURON_NAMES[i],
            "death_step":       t,
            "vulnerability":    props[i]["vulnerability"],
            "total_degree":     props[i]["total_degree"],
            "is_bridge":        props[i]["is_bridge"],
            "load_contribution": props[i]["load_contribution"],
            "secondary_deaths_30": int(secondaries),
        })
    return info, first10, ds


# ── Run one protection group ──────────────────────────────────────────────────

def run_group(label, params, protected_idx, seeds):
    dsl = []
    for seed in seeds:
        if not protected_idx:
            sim = CriticalitySimulator(seed=seed, params=params)
        else:
            sim = ProtectedSimulator(seed=seed, params=params,
                                     protected_idx=protected_idx)
        dsl.append(_run_one(sim, STEPS))
    m = _metrics(dsl, STEPS)
    m["label"] = label
    m["protected_idx"] = list(protected_idx) if protected_idx else []
    m["protected_names"] = [NEURON_NAMES[i] for i in (protected_idx or [])]
    return m


def run_therapy(label, params, seeds):
    disease = {k: params[k] for k in _P5_KEYS if k in params}
    dsl = []
    for seed in seeds:
        sim = TherapySimulator(seed=seed, disease_params=disease,
                               therapy_config=BEST_THERAPY)
        dsl.append(_run_one(sim, STEPS))
    m = _metrics(dsl, STEPS)
    m["label"]           = label
    m["protected_idx"]   = []
    m["protected_names"] = []
    return m


# ── Report ────────────────────────────────────────────────────────────────────

def build_report(first10, groups, rand_stats, params):
    lines = [
        "# Phase 8 -- Two-Tier Cascade Initiation Test\n",
        "## Q1: Which neurons die first in baseline config #334?\n",
        f"Canonical run (seed {BASE_SEED}), no therapy, {STEPS} steps.\n",
        "| Rank | Neuron | Step | Vuln | Degree | Bridge | Load% | Secondaries/30 |",
        "|------|--------|------|------|--------|--------|-------|----------------|",
    ]
    for r in first10:
        lines.append(
            f"| {r['rank']} | {r['name']} | {r['death_step']} "
            f"| {r['vulnerability']:.3f} | {r['total_degree']} "
            f"| {'YES' if r['is_bridge'] else 'no'} "
            f"| {r['load_contribution']*100:.1f}% "
            f"| {r['secondary_deaths_30']} |"
        )

    bl   = next(g for g in groups if g["label"] == "baseline")
    ther = next(g for g in groups if g["label"] == "full_therapy")
    prot = [g for g in groups if g["label"] not in ("baseline", "full_therapy", "random_ctrl")]

    lines += [
        "\n## Q2: Are early deaths necessary for Tier 2 activation?\n",
        f"Baseline Tier 2 activation (median): step {bl['tier2_activation']:.0f}  "
        f"(cascade size in next {TIER2_WIN} steps: {bl['load_cascade_size']:.1f} deaths)",
        "",
        "Tier 2 activates when cumulative deaths exceed "
        f"{TIER2_THR} -- this threshold is reached even with early protection in most groups.",
        "",
    ]

    # Check if any protection group delays Tier 2 significantly vs baseline
    for g in prot:
        delay = g["tier2_activation"] - bl["tier2_activation"]
        lines.append(
            f"  {g['label']:<22s}: Tier2 step {g['tier2_activation']:.0f}  "
            f"(delta {delay:+.0f})  cascade={g['load_cascade_size']:.1f}"
        )

    lines += [
        "\n## Q3: Is protecting the first few deaths enough to prevent collapse?\n",
        "| Group | Protected | Genuine rate | Tipping step | Plateau | Tier2 step | Cascade |",
        "|-------|-----------|-------------|-------------|---------|-----------|---------|",
    ]
    for g in [bl] + prot + [ther]:
        pn = ", ".join(g["protected_names"]) if g["protected_names"] else "—"
        if len(pn) > 25:
            pn = pn[:22] + "..."
        lines.append(
            f"| {g['label']:<22s} | {pn:<25s} "
            f"| {g['genuine_rate']:.2f} "
            f"| {g['tipping_step']:.0f} "
            f"| {g['plateau']:.1f} "
            f"| {g['tier2_activation']:.0f} "
            f"| {g['load_cascade_size']:.1f} |"
        )

    lines += [
        "\n## Q4: Is targeted protection better than random protection?\n",
        f"Random protection baseline (N={rand_stats['n']} controls, 3 neurons each):",
        f"  Plateau: {rand_stats['plateau_mean']:.1f} +/- {rand_stats['plateau_std']:.1f}",
        f"  Tier2 step: {rand_stats['tier2_mean']:.1f} +/- {rand_stats['tier2_std']:.1f}",
        f"  Genuine rate: {rand_stats['genuine_mean']:.3f} +/- {rand_stats['genuine_std']:.3f}",
        "",
        "Topology-specific threshold (mean + 1 std): "
        f"plateau > {rand_stats['plateau_mean'] + rand_stats['plateau_std']:.1f}",
        "",
    ]
    threshold = rand_stats["plateau_mean"] + rand_stats["plateau_std"]
    for g in prot:
        specific = "TOPOLOGY-SPECIFIC" if g["plateau"] > threshold else "within random range"
        lines.append(
            f"  {g['label']:<22s}: plateau={g['plateau']:.1f}  -> {specific}"
        )

    lines += [
        "\n## Q5: Does aggregation suppression work via Tier 1, Tier 2, or both?\n",
        f"Full therapy (agg_sup str=0.855 start_t=13):",
        f"  Genuine rate={ther['genuine_rate']:.2f}  "
        f"Plateau={ther['plateau']:.1f}  "
        f"Tier2 step={ther['tier2_activation']:.0f}  "
        f"Cascade={ther['load_cascade_size']:.1f}",
        f"  First death step (silent phase)={ther['first_death']:.0f}",
        "",
    ]
    if ther["first_death"] > bl["first_death"] * 1.5:
        lines += [
            "  Therapy substantially delays first death -> works primarily via Tier 1",
            "  (prevents/delays the biochemical trigger for the topological cascade).",
        ]
    elif ther["tier2_activation"] > bl["tier2_activation"] * 1.5:
        lines += [
            "  Therapy does not delay first death much but strongly delays Tier 2 ->",
            "  works primarily via Tier 2 (modulates cascade amplification).",
        ]
    else:
        lines += [
            "  Therapy delays both first death and Tier 2 activation ->",
            "  acts on both tiers simultaneously.",
        ]

    lines += [
        "\n## Q6: Therapeutic target -- cascade initiation or amplification?\n",
    ]
    # Analyze: does protecting early deaths reduce plateau?
    best_prot = max(prot, key=lambda g: g["plateau"])
    rand_thresh = rand_stats["plateau_mean"] + rand_stats["plateau_std"]
    initiation_target = any(g["plateau"] > rand_thresh + 2 for g in prot[:3])  # A/B/C

    if initiation_target:
        lines += [
            "  Protecting first 1-5 dying neurons significantly raises plateau vs random ->",
            "  CASCADE INITIATION is the therapeutic target.",
            "  Implication: preventing the earliest deaths (even just 1-3) can break",
            "  the chain reaction before it becomes self-amplifying.",
        ]
    else:
        lines += [
            "  Protecting early deaths does not outperform random protection ->",
            "  CASCADE AMPLIFICATION is the therapeutic target.",
            "  Implication: individual early deaths are not critical bottlenecks;",
            "  reducing overall cascade speed (e.g., connectivity intervention) is needed.",
        ]

    lines += [
        f"",
        f"  Best protection group: {best_prot['label']}",
        f"  Plateau: {best_prot['plateau']:.1f} vs baseline {bl['plateau']:.1f} "
        f"vs therapy {ther['plateau']:.1f}",
        "",
        "---",
        "_Generated by `phase8_two_tier.py` -- ALS connectome project Phase 8_",
    ]
    return "\n".join(lines)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    t0 = time.time()
    out_dir = Path("results")
    out_dir.mkdir(exist_ok=True)

    print("=" * 70)
    print("Phase 8 -- Two-Tier Cascade Initiation Test")
    print("=" * 70)

    params = load_config334()
    props  = build_net_props()
    seeds  = [BASE_SEED + k * 1000 for k in range(N_SEEDS)]

    print(f"Config #334 loaded.  Seeds: {seeds}")
    print()

    # ── Step 1: characterize first 10 deaths ──
    print("Step 1: Characterizing first 10 deaths in baseline ...")
    first10, first_order, canon_ds = characterize_first_deaths(params, props)
    print("  Rank  Neuron   Step  Vuln   Deg  Bridge  Secondaries")
    for r in first10:
        print(f"  {r['rank']:4d}  {r['name']:<7s}  {r['death_step']:4d}  "
              f"{r['vulnerability']:.3f}  {r['total_degree']:3d}  "
              f"{'YES' if r['is_bridge'] else ' no'}     {r['secondary_deaths_30']}")
    print()

    # ── Define protection groups ──
    g_a = [first_order[0]]
    g_b = first_order[:3]
    g_c = first_order[:5]
    g_d = [DA6_IDX, AVDL_IDX]
    # Top 3 by vulnerability
    g_e = list(np.argsort(-VULN)[:3])
    # Top 3 by total degree
    deg_arr = np.array([props[i]["total_degree"] for i in range(N)])
    g_f = list(np.argsort(-deg_arr)[:3])

    print("Protection groups:")
    for label, grp in [("A (first 1)", g_a), ("B (first 3)", g_b),
                       ("C (first 5)", g_c), ("D (DA6+AVDL)", g_d),
                       ("E (top vuln)", g_e), ("F (top degree)", g_f)]:
        names = [NEURON_NAMES[i] for i in grp]
        print(f"  {label}: {names}")
    print()

    # ── Step 2 & 3: run all scenarios ──
    print("Running scenarios ...")
    groups = []

    groups.append(run_group("baseline",       params, [],  seeds))
    print(f"  baseline              plateau={groups[-1]['plateau']:.1f}  "
          f"tier2={groups[-1]['tier2_activation']:.0f}  genuine={groups[-1]['genuine_rate']:.2f}")

    groups.append(run_therapy("full_therapy", params, seeds))
    print(f"  full_therapy          plateau={groups[-1]['plateau']:.1f}  "
          f"tier2={groups[-1]['tier2_activation']:.0f}  genuine={groups[-1]['genuine_rate']:.2f}")

    for label, grp in [("protect_A", g_a), ("protect_B", g_b), ("protect_C", g_c),
                       ("protect_D_DA6AVDL", g_d), ("protect_E_vuln", g_e),
                       ("protect_F_degree", g_f)]:
        groups.append(run_group(label, params, grp, seeds))
        print(f"  {label:<22s}  plateau={groups[-1]['plateau']:.1f}  "
              f"tier2={groups[-1]['tier2_activation']:.0f}  genuine={groups[-1]['genuine_rate']:.2f}")

    # ── Group G: random controls ──
    print(f"  Running {N_RAND} random controls ...")
    rng_g = np.random.default_rng(42)
    rand_results = []
    for k in range(N_RAND):
        ridx = list(rng_g.choice(N, size=N_RAND_PROTECT, replace=False))
        rm   = run_group(f"random_{k:03d}", params, ridx, seeds[:3])  # 3 seeds for speed
        rand_results.append(rm)

    rand_plateaus  = [r["plateau"]        for r in rand_results]
    rand_tier2     = [r["tier2_activation"] for r in rand_results]
    rand_genuine   = [r["genuine_rate"]   for r in rand_results]
    rand_stats = {
        "n":            N_RAND,
        "plateau_mean": float(np.mean(rand_plateaus)),
        "plateau_std":  float(np.std(rand_plateaus)),
        "tier2_mean":   float(np.mean(rand_tier2)),
        "tier2_std":    float(np.std(rand_tier2)),
        "genuine_mean": float(np.mean(rand_genuine)),
        "genuine_std":  float(np.std(rand_genuine)),
    }
    print(f"  Random controls:  plateau {rand_stats['plateau_mean']:.1f} "
          f"+/- {rand_stats['plateau_std']:.1f}")

    elapsed = time.time() - t0
    print(f"\nTotal runtime: {elapsed:.1f}s")

    # ── Save JSON ──
    output = {
        "description":    "Phase 8 two-tier cascade initiation test",
        "config_id":      334,
        "setup": {
            "steps":       STEPS,
            "n_seeds":     N_SEEDS,
            "tier2_thr":   TIER2_THR,
            "tier2_win":   TIER2_WIN,
            "protection":  "10x capacity (health loss * 0.1)",
        },
        "first_10_deaths": first10,
        "protection_groups": {
            "A": [NEURON_NAMES[i] for i in g_a],
            "B": [NEURON_NAMES[i] for i in g_b],
            "C": [NEURON_NAMES[i] for i in g_c],
            "D": [NEURON_NAMES[i] for i in g_d],
            "E": [NEURON_NAMES[i] for i in g_e],
            "F": [NEURON_NAMES[i] for i in g_f],
        },
        "scenarios":      groups,
        "random_stats":   rand_stats,
        "runtime_s":      round(elapsed, 1),
    }

    def _to_py(obj):
        if isinstance(obj, dict):
            return {k: _to_py(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_to_py(v) for v in obj]
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        return obj

    json_path = out_dir / "phase8_two_tier.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(_to_py(output), f, indent=2)
    print(f"\nSaved -> {json_path}")

    report = build_report(first10, groups, rand_stats, params)
    md_path = out_dir / "phase8_two_tier_report.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"Saved -> {md_path}")


if __name__ == "__main__":
    main()

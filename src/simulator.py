"""
ALS-inspired degeneration model for the C. elegans motor circuit.

State per neuron (all in [0, 1]):
  health      – functional viability; 0 = dead
  atp         – mitochondrial energy supply
  toxicity    – accumulated excitotoxic / oxidative damage
  aggregation – misfolded protein burden (TDP-43 analog)

Disease mechanism cascade:
  aggregation grows (intrinsic seeding + prion-like spreading)
  -> ATP falls (mitochondrial dysfunction)
  -> clearance fails -> toxicity accumulates (excitotoxicity)
  -> health declines
"""

import numpy as np
from collections import defaultdict
from connectome import NEURON_NAMES, NODE_TYPES, VULNERABILITY, SYNAPSES, NEUROTRANSMITTER


class ConnectomeSimulator:

    DEAD_THRESHOLD   = 0.15   # health below this = functionally dead
    AGG_SEED_RATE    = 0.0006 # intrinsic per-step aggregation seeding (scaled by vulnerability)
    AGG_SPREAD_RATE  = 0.005  # prion-like spreading coefficient per synapse
    ATP_RECOVERY     = 0.04   # rate of ATP equilibration toward target
    ATP_DAMAGE_SCALE = 1.10   # how sharply aggregation suppresses ATP
    EXCITOTOX_FACTOR = 0.004  # excitotoxic accumulation rate (when ATP fails)
    CLEARANCE_BASE   = 0.025  # baseline ATP-dependent toxin clearance rate
    HEALTH_LOSS_AGG  = 0.018  # health consumed per unit aggregation per step
    HEALTH_LOSS_TOX  = 0.010  # health consumed per unit toxicity per step

    def __init__(self, seed: int = 42, noise_scale: float = 0.003):
        self.rng = np.random.default_rng(seed)
        self.noise_scale = noise_scale
        self.n = len(NEURON_NAMES)
        self.idx = {name: i for i, name in enumerate(NEURON_NAMES)}

        # Neuron property arrays
        self.vulnerability = np.array([VULNERABILITY[n] for n in NEURON_NAMES])
        self.is_motor      = np.array([NODE_TYPES[n] == "motor"      for n in NEURON_NAMES])
        self.is_glutamate  = np.array([NEUROTRANSMITTER[n] == "glutamate" for n in NEURON_NAMES])

        # State arrays
        self.health      = np.ones(self.n)
        self.atp         = np.ones(self.n)
        self.toxicity    = np.zeros(self.n)
        self.aggregation = np.zeros(self.n)

        # Seed small initial aggregation (ALS onset is focal, not simultaneous)
        for i, name in enumerate(NEURON_NAMES):
            base = 0.015 if NODE_TYPES[name] == "motor" else 0.002
            self.aggregation[i] = self.rng.uniform(0, base) * self.vulnerability[i]

        self._build_adjacency()
        self.time    = 0.0
        self.history = []

    def _build_adjacency(self):
        n, idx = self.n, self.idx

        self.in_edges  = defaultdict(list)  # in_edges[j]  = [(i, weight, syn_type), ...]
        self.out_edges = defaultdict(list)  # out_edges[i] = [(j, weight, syn_type), ...]

        # Dense matrix for excitotoxic inputs: only glutamatergic excitatory synapses
        self.excitotox_W = np.zeros((n, n))

        for pre, post, weight, syn_type in SYNAPSES:
            i, j = idx[pre], idx[post]
            self.in_edges[j].append((i, weight, syn_type))
            self.out_edges[i].append((j, weight, syn_type))
            if NEUROTRANSMITTER[pre] == "glutamate" and syn_type == "excitatory":
                self.excitotox_W[j, i] = weight  # row j receives from col i

    def step(self, dt: float = 1.0):
        h   = self.health
        atp = self.atp
        tox = self.toxicity
        agg = self.aggregation

        alive = (h > self.DEAD_THRESHOLD).astype(float)

        # ── 1. Aggregation ────────────────────────────────────────────────────
        # Prion-like spread: each alive presynaptic neuron seeds aggregation in
        # its targets proportional to its own aggregate load
        agg_spread = np.zeros(self.n)
        for j in range(self.n):
            if not alive[j]:
                continue
            for i, w, _ in self.in_edges[j]:
                if alive[i]:
                    agg_spread[j] += w * agg[i]

        # Unclipped noise: zero-mean stochastic variation (clipping would bias toward growth)
        noise   = self.rng.normal(0, self.noise_scale, self.n)
        d_agg   = (self.vulnerability * self.AGG_SEED_RATE * dt
                   + self.AGG_SPREAD_RATE * agg_spread * dt
                   + noise)
        new_agg = np.clip(agg + d_agg * alive, 0.0, 1.0)

        # ── 2. ATP ────────────────────────────────────────────────────────────
        # Target ATP falls as aggregates overwhelm mitochondria
        atp_target = np.clip(1.0 - self.ATP_DAMAGE_SCALE * new_agg, 0.0, 1.0)
        new_atp    = np.clip(atp + (atp_target - atp) * self.ATP_RECOVERY * dt, 0.0, 1.0)

        # ── 3. Toxicity ───────────────────────────────────────────────────────
        # Excitotoxic input weighted by presynaptic health (active glutamate release)
        excitotox_in = self.excitotox_W @ (h * alive)  # shape (n,)

        # Accumulates when ATP fails to power clearance and reuptake
        d_tox   = (excitotox_in * (1.0 - new_atp) * self.EXCITOTOX_FACTOR
                   - self.CLEARANCE_BASE * new_atp * tox) * dt
        new_tox = np.clip(tox + d_tox * alive, 0.0, 1.0)

        # ── 4. Health ─────────────────────────────────────────────────────────
        d_health   = -(self.HEALTH_LOSS_AGG * new_agg
                       + self.HEALTH_LOSS_TOX * new_tox) * dt
        new_health = np.clip(h + d_health * alive, 0.0, 1.0)

        self.aggregation = new_agg
        self.atp         = new_atp
        self.toxicity    = new_tox
        self.health      = new_health
        self.time       += dt

        self.history.append({
            "time":        self.time,
            "health":      new_health.copy(),
            "atp":         new_atp.copy(),
            "toxicity":    new_tox.copy(),
            "aggregation": new_agg.copy(),
        })

    def run(self, steps: int, dt: float = 1.0):
        for _ in range(steps):
            self.step(dt)

    def alive_mask(self) -> np.ndarray:
        return self.health > self.DEAD_THRESHOLD

    def neuron_state(self, name: str) -> dict:
        i = self.idx[name]
        return {
            "health":      float(self.health[i]),
            "atp":         float(self.atp[i]),
            "toxicity":    float(self.toxicity[i]),
            "aggregation": float(self.aggregation[i]),
        }

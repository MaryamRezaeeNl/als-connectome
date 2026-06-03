"""Scoring functions and tipping point detection for the degeneration simulator."""

import numpy as np
from connectome import NEURON_NAMES, NODE_TYPES, VULNERABILITY, SYNAPSES

_IDX = {n: i for i, n in enumerate(NEURON_NAMES)}

# Boolean index arrays for neuron classes
_SENSORY     = np.array([NODE_TYPES[n] == "sensory"     for n in NEURON_NAMES])
_INTERNEURON = np.array([NODE_TYPES[n] == "interneuron" for n in NEURON_NAMES])
_MOTOR       = np.array([NODE_TYPES[n] == "motor"       for n in NEURON_NAMES])

_DA = np.array([n.startswith("DA") for n in NEURON_NAMES])
_DB = np.array([n.startswith("DB") for n in NEURON_NAMES])
_DD = np.array([n.startswith("DD") for n in NEURON_NAMES])
_VA = np.array([n.startswith("VA") for n in NEURON_NAMES])
_VB = np.array([n.startswith("VB") for n in NEURON_NAMES])
_VD = np.array([n.startswith("VD") for n in NEURON_NAMES])

_FWD_CMD = np.array([n in {"AVBL","AVBR","PVCL","PVCR"}              for n in NEURON_NAMES])
_BWD_CMD = np.array([n in {"AVAL","AVAR","AVDL","AVDR","AVEL","AVER"} for n in NEURON_NAMES])

DEAD_THRESHOLD = 0.15


def locomotion_score(health: np.ndarray) -> float:
    """Overall locomotion score [0,1]: mean health of all motor neurons."""
    return float(np.mean(health[_MOTOR]))


def forward_locomotion_score(health: np.ndarray) -> float:
    """Forward locomotion: DB + VB (70%) weighted with forward command (30%)."""
    motor = np.mean(health[_DB | _VB])
    cmd   = np.mean(health[_FWD_CMD])
    return float(0.7 * motor + 0.3 * cmd)


def backward_locomotion_score(health: np.ndarray) -> float:
    """Backward locomotion: DA + VA (70%) weighted with backward command (30%)."""
    motor = np.mean(health[_DA | _VA])
    cmd   = np.mean(health[_BWD_CMD])
    return float(0.7 * motor + 0.3 * cmd)


def network_integrity(health: np.ndarray) -> float:
    """Fraction of the 127 synapses with both endpoints still alive."""
    alive  = health > DEAD_THRESHOLD
    active = sum(1 for pre, post, *_ in SYNAPSES
                 if alive[_IDX[pre]] and alive[_IDX[post]])
    return active / len(SYNAPSES)


def dead_neuron_counts(health: np.ndarray) -> dict:
    """Dead neuron counts broken down by class."""
    dead = health <= DEAD_THRESHOLD
    return {
        "total":       int(dead.sum()),
        "sensory":     int((dead & _SENSORY).sum()),
        "interneuron": int((dead & _INTERNEURON).sum()),
        "motor":       int((dead & _MOTOR).sum()),
        "DA": int((dead & _DA).sum()),
        "DB": int((dead & _DB).sum()),
        "DD": int((dead & _DD).sum()),
        "VA": int((dead & _VA).sum()),
        "VB": int((dead & _VB).sum()),
        "VD": int((dead & _VD).sum()),
    }


def mean_state(health: np.ndarray, agg: np.ndarray,
               tox: np.ndarray, atp: np.ndarray) -> dict:
    """Mean state variables split by neuron type."""
    return {
        "health_motor":       float(np.mean(health[_MOTOR])),
        "health_interneuron": float(np.mean(health[_INTERNEURON])),
        "health_sensory":     float(np.mean(health[_SENSORY])),
        "agg_motor":          float(np.mean(agg[_MOTOR])),
        "tox_motor":          float(np.mean(tox[_MOTOR])),
        "atp_motor":          float(np.mean(atp[_MOTOR])),
    }


def detect_tipping_points(history: list, window: int = 8) -> list:
    """
    Find timesteps where locomotion score declines faster than
    2x the rolling-mean rate, signalling a cascade transition.
    Returns list of dicts with time, score, delta, acceleration.
    """
    if len(history) < window + 2:
        return []

    times  = [s["time"]              for s in history]
    scores = [locomotion_score(s["health"]) for s in history]

    tipping = []
    for i in range(window, len(scores) - 1):
        past_deltas  = [scores[j] - scores[j-1] for j in range(i - window + 1, i)]
        mean_delta   = float(np.mean(past_deltas))
        curr_delta   = scores[i] - scores[i-1]

        if curr_delta < 0 and mean_delta < 0 and curr_delta < 2.0 * mean_delta:
            accel = curr_delta / mean_delta if mean_delta != 0 else 0.0
            tipping.append({
                "time":         times[i],
                "score":        scores[i],
                "delta":        curr_delta,
                "acceleration": accel,
            })
    return tipping


def most_vulnerable(n: int = 10) -> list[tuple[str, float, str]]:
    """Rank neurons by intrinsic vulnerability."""
    ranked = sorted(NEURON_NAMES, key=lambda x: -VULNERABILITY[x])
    return [(name, VULNERABILITY[name], NODE_TYPES[name]) for name in ranked[:n]]


def hub_neurons(n: int = 10) -> list[tuple[str, int, str]]:
    """Rank neurons by out-degree (number of downstream targets)."""
    out_deg: dict[str, int] = {}
    for pre, *_ in SYNAPSES:
        out_deg[pre] = out_deg.get(pre, 0) + 1
    ranked = sorted(out_deg, key=lambda x: -out_deg[x])
    return [(name, out_deg[name], NODE_TYPES[name]) for name in ranked[:n]]


def score_trajectory(history: list) -> dict:
    """Extract full time-series of key metrics from history."""
    times  = [s["time"] for s in history]
    loco   = [locomotion_score(s["health"])          for s in history]
    fwd    = [forward_locomotion_score(s["health"])  for s in history]
    bwd    = [backward_locomotion_score(s["health"]) for s in history]
    integ  = [network_integrity(s["health"])         for s in history]
    dead   = [dead_neuron_counts(s["health"])["motor"] for s in history]
    return {
        "time":      times,
        "loco":      loco,
        "forward":   fwd,
        "backward":  bwd,
        "integrity": integ,
        "dead_motor": dead,
    }

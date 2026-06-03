"""C. elegans motor circuit: 61 neurons, 127 synapses."""

NEURON_NAMES = [
    # Sensory neurons (6)
    "PLML", "PLMR", "ALML", "ALMR", "AVM", "PVM",
    # Command interneurons – forward locomotion (4)
    "AVBL", "AVBR", "PVCL", "PVCR",
    # Command interneurons – backward locomotion (6)
    "AVAL", "AVAR", "AVDL", "AVDR", "AVEL", "AVER",
    # Premotor interneurons (8)
    "RIML", "RIMR", "AIBL", "AIBR", "RIBL", "RIBR", "AVJL", "AVJR",
    # Motor neurons – DA class: backward dorsal (9)
    "DA1", "DA2", "DA3", "DA4", "DA5", "DA6", "DA7", "DA8", "DA9",
    # Motor neurons – DB class: forward dorsal (7)
    "DB1", "DB2", "DB3", "DB4", "DB5", "DB6", "DB7",
    # Motor neurons – DD class: inhibitory dorsal (6)
    "DD1", "DD2", "DD3", "DD4", "DD5", "DD6",
    # Motor neurons – VA class: backward ventral (5)
    "VA1", "VA2", "VA3", "VA4", "VA5",
    # Motor neurons – VB class: forward ventral (5)
    "VB1", "VB2", "VB3", "VB4", "VB5",
    # Motor neurons – VD class: inhibitory ventral (5)
    "VD1", "VD2", "VD3", "VD4", "VD5",
]

assert len(NEURON_NAMES) == 61, f"Expected 61 neurons, got {len(NEURON_NAMES)}"

NODE_TYPES = {
    **{n: "sensory"     for n in ["PLML","PLMR","ALML","ALMR","AVM","PVM"]},
    **{n: "interneuron" for n in [
        "AVBL","AVBR","PVCL","PVCR",
        "AVAL","AVAR","AVDL","AVDR","AVEL","AVER",
        "RIML","RIMR","AIBL","AIBR","RIBL","RIBR","AVJL","AVJR",
    ]},
    **{n: "motor" for n in NEURON_NAMES[24:]},
}

# Neurotransmitter identity per neuron
NEUROTRANSMITTER = {
    **{n: "glutamate"      for n in NEURON_NAMES[:24]},
    **{n: "acetylcholine"  for n in [
        "DA1","DA2","DA3","DA4","DA5","DA6","DA7","DA8","DA9",
        "DB1","DB2","DB3","DB4","DB5","DB6","DB7",
        "VA1","VA2","VA3","VA4","VA5",
        "VB1","VB2","VB3","VB4","VB5",
    ]},
    **{n: "GABA" for n in [
        "DD1","DD2","DD3","DD4","DD5","DD6",
        "VD1","VD2","VD3","VD4","VD5",
    ]},
}

# ALS-like selective vulnerability [0,1]; motor neurons degenerate fastest
VULNERABILITY = {
    **{n: 0.05 for n in NEURON_NAMES[:6]},     # sensory
    **{n: 0.15 for n in NEURON_NAMES[6:10]},   # forward command
    **{n: 0.15 for n in NEURON_NAMES[10:16]},  # backward command
    **{n: 0.30 for n in NEURON_NAMES[16:24]},  # premotor
    **{n: 1.00 for n in NEURON_NAMES[24:33]},  # DA – highest
    **{n: 0.90 for n in NEURON_NAMES[33:40]},  # DB
    **{n: 0.70 for n in NEURON_NAMES[40:46]},  # DD
    **{n: 0.95 for n in NEURON_NAMES[46:51]},  # VA
    **{n: 0.85 for n in NEURON_NAMES[51:56]},  # VB
    **{n: 0.65 for n in NEURON_NAMES[56:61]},  # VD
}

# Synaptic edges: (pre, post, weight, type)
# Weights approximate relative synapse counts; White et al. 1986 / Cook et al. 2019
SYNAPSES = [
    # ── Sensory → Command (14) ──────────────────────────────────────────────
    ("PLML", "PVCL", 0.8, "excitatory"),
    ("PLMR", "PVCR", 0.8, "excitatory"),
    ("PLML", "PVCR", 0.4, "excitatory"),
    ("PLMR", "PVCL", 0.4, "excitatory"),
    ("PLML", "AVDL", 0.6, "excitatory"),
    ("PLMR", "AVDR", 0.6, "excitatory"),
    ("ALML", "AVDL", 0.7, "excitatory"),
    ("ALMR", "AVDR", 0.7, "excitatory"),
    ("ALML", "AVAL", 0.5, "excitatory"),
    ("ALMR", "AVAR", 0.5, "excitatory"),
    ("AVM",  "AVDL", 0.6, "excitatory"),
    ("AVM",  "AVDR", 0.6, "excitatory"),
    ("PVM",  "PVCL", 0.5, "excitatory"),
    ("PVM",  "PVCR", 0.5, "excitatory"),

    # ── Command interneuron network (18) ─────────────────────────────────────
    ("AVAL", "AVDL", 0.6, "excitatory"),
    ("AVAR", "AVDR", 0.6, "excitatory"),
    ("AVDL", "AVAL", 0.4, "excitatory"),
    ("AVDR", "AVAR", 0.4, "excitatory"),
    ("AVAL", "AVEL", 0.5, "excitatory"),
    ("AVAR", "AVER", 0.5, "excitatory"),
    ("PVCL", "AVBL", 0.7, "excitatory"),
    ("PVCR", "AVBR", 0.7, "excitatory"),
    ("RIML", "AVAL", 0.5, "inhibitory"),
    ("RIMR", "AVAR", 0.5, "inhibitory"),
    ("RIML", "AVBL", 0.4, "inhibitory"),
    ("RIMR", "AVBR", 0.4, "inhibitory"),
    ("AIBL", "AVAL", 0.6, "excitatory"),
    ("AIBR", "AVAR", 0.6, "excitatory"),
    ("RIBL", "AVBL", 0.5, "excitatory"),
    ("RIBR", "AVBR", 0.5, "excitatory"),
    ("AVJL", "PVCL", 0.6, "excitatory"),
    ("AVJR", "PVCR", 0.6, "excitatory"),

    # ── Command → DA motors (9) ──────────────────────────────────────────────
    ("AVAL", "DA1", 0.9, "excitatory"),
    ("AVAL", "DA3", 0.8, "excitatory"),
    ("AVAL", "DA5", 0.8, "excitatory"),
    ("AVAL", "DA7", 0.7, "excitatory"),
    ("AVAL", "DA9", 0.7, "excitatory"),
    ("AVAR", "DA2", 0.9, "excitatory"),
    ("AVAR", "DA4", 0.8, "excitatory"),
    ("AVAR", "DA6", 0.8, "excitatory"),
    ("AVAR", "DA8", 0.7, "excitatory"),

    # ── Command → VA motors (5) ──────────────────────────────────────────────
    ("AVAL", "VA1", 0.9, "excitatory"),
    ("AVAL", "VA3", 0.8, "excitatory"),
    ("AVAL", "VA5", 0.7, "excitatory"),
    ("AVAR", "VA2", 0.9, "excitatory"),
    ("AVAR", "VA4", 0.8, "excitatory"),

    # ── Command → DB motors (7) ──────────────────────────────────────────────
    ("AVBL", "DB1", 0.9, "excitatory"),
    ("AVBL", "DB3", 0.8, "excitatory"),
    ("AVBL", "DB5", 0.8, "excitatory"),
    ("AVBL", "DB7", 0.7, "excitatory"),
    ("AVBR", "DB2", 0.9, "excitatory"),
    ("AVBR", "DB4", 0.8, "excitatory"),
    ("AVBR", "DB6", 0.8, "excitatory"),

    # ── Command → VB motors (5) ──────────────────────────────────────────────
    ("AVBL", "VB1", 0.9, "excitatory"),
    ("AVBL", "VB3", 0.8, "excitatory"),
    ("AVBL", "VB5", 0.7, "excitatory"),
    ("AVBR", "VB2", 0.9, "excitatory"),
    ("AVBR", "VB4", 0.8, "excitatory"),

    # ── Accessory command → motors (4) ───────────────────────────────────────
    ("AVDL", "DA1", 0.6, "excitatory"),
    ("AVDR", "DA2", 0.6, "excitatory"),
    ("AVEL", "VA1", 0.6, "excitatory"),
    ("AVER", "VA2", 0.6, "excitatory"),

    # ── Reciprocal inhibition: B-class drives D-class (12) ───────────────────
    ("DB1", "DD1", 0.7, "excitatory"),
    ("DB2", "DD1", 0.5, "excitatory"),
    ("DB3", "DD2", 0.7, "excitatory"),
    ("DB4", "DD2", 0.5, "excitatory"),
    ("DB5", "DD3", 0.7, "excitatory"),
    ("DB6", "DD3", 0.5, "excitatory"),
    ("DB7", "DD4", 0.7, "excitatory"),
    ("VB1", "VD1", 0.7, "excitatory"),
    ("VB2", "VD1", 0.5, "excitatory"),
    ("VB3", "VD2", 0.7, "excitatory"),
    ("VB4", "VD2", 0.5, "excitatory"),
    ("VB5", "VD3", 0.7, "excitatory"),

    # ── A-class drives D-class for backward coordination (7) ─────────────────
    ("DA1", "DD1", 0.6, "excitatory"),
    ("DA3", "DD2", 0.6, "excitatory"),
    ("DA5", "DD3", 0.6, "excitatory"),
    ("DA7", "DD4", 0.6, "excitatory"),
    ("VA1", "VD1", 0.6, "excitatory"),
    ("VA3", "VD2", 0.6, "excitatory"),
    ("VA5", "VD3", 0.6, "excitatory"),

    # ── Premotor → motor neurons (12) ────────────────────────────────────────
    ("RIML", "DA1", 0.4, "inhibitory"),
    ("RIMR", "DA2", 0.4, "inhibitory"),
    ("RIML", "VA1", 0.4, "inhibitory"),
    ("RIMR", "VA2", 0.4, "inhibitory"),
    ("RIBL", "DB1", 0.4, "excitatory"),
    ("RIBR", "DB2", 0.4, "excitatory"),
    ("RIBL", "VB1", 0.4, "excitatory"),
    ("RIBR", "VB2", 0.4, "excitatory"),
    ("AIBL", "DA1", 0.5, "excitatory"),
    ("AIBR", "DA2", 0.5, "excitatory"),
    ("AVJL", "DB1", 0.5, "excitatory"),
    ("AVJR", "DB2", 0.5, "excitatory"),

    # ── Motor propagation chains via gap junctions (31) ──────────────────────
    # DA chain (8)
    ("DA1","DA2",0.3,"excitatory"), ("DA2","DA3",0.3,"excitatory"),
    ("DA3","DA4",0.3,"excitatory"), ("DA4","DA5",0.3,"excitatory"),
    ("DA5","DA6",0.3,"excitatory"), ("DA6","DA7",0.3,"excitatory"),
    ("DA7","DA8",0.3,"excitatory"), ("DA8","DA9",0.3,"excitatory"),
    # DB chain (6)
    ("DB1","DB2",0.3,"excitatory"), ("DB2","DB3",0.3,"excitatory"),
    ("DB3","DB4",0.3,"excitatory"), ("DB4","DB5",0.3,"excitatory"),
    ("DB5","DB6",0.3,"excitatory"), ("DB6","DB7",0.3,"excitatory"),
    # VA chain (4)
    ("VA1","VA2",0.3,"excitatory"), ("VA2","VA3",0.3,"excitatory"),
    ("VA3","VA4",0.3,"excitatory"), ("VA4","VA5",0.3,"excitatory"),
    # VB chain (4)
    ("VB1","VB2",0.3,"excitatory"), ("VB2","VB3",0.3,"excitatory"),
    ("VB3","VB4",0.3,"excitatory"), ("VB4","VB5",0.3,"excitatory"),
    # DD chain (5)
    ("DD1","DD2",0.3,"excitatory"), ("DD2","DD3",0.3,"excitatory"),
    ("DD3","DD4",0.3,"excitatory"), ("DD4","DD5",0.3,"excitatory"),
    ("DD5","DD6",0.3,"excitatory"),
    # VD chain (4)
    ("VD1","VD2",0.3,"excitatory"), ("VD2","VD3",0.3,"excitatory"),
    ("VD3","VD4",0.3,"excitatory"), ("VD4","VD5",0.3,"excitatory"),

    # ── Cross-hemisphere connections (3) ─────────────────────────────────────
    ("AVAL", "AVAR", 0.4, "excitatory"),
    ("AVBL", "AVBR", 0.4, "excitatory"),
    ("PVCL", "AVAL", 0.5, "excitatory"),
]

assert len(SYNAPSES) == 127, f"Expected 127 synapses, got {len(SYNAPSES)}"

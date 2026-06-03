// C. elegans motor circuit — 61 neurons, 127 synapses
// Source: White et al. 1986, Cook et al. 2019

export const NEURON_NAMES: string[] = [
  // Sensory neurons (6)
  "PLML","PLMR","ALML","ALMR","AVM","PVM",
  // Command interneurons – forward locomotion (4)
  "AVBL","AVBR","PVCL","PVCR",
  // Command interneurons – backward locomotion (6)
  "AVAL","AVAR","AVDL","AVDR","AVEL","AVER",
  // Premotor interneurons (8)
  "RIML","RIMR","AIBL","AIBR","RIBL","RIBR","AVJL","AVJR",
  // Motor neurons – DA class (9)
  "DA1","DA2","DA3","DA4","DA5","DA6","DA7","DA8","DA9",
  // Motor neurons – DB class (7)
  "DB1","DB2","DB3","DB4","DB5","DB6","DB7",
  // Motor neurons – DD class (6)
  "DD1","DD2","DD3","DD4","DD5","DD6",
  // Motor neurons – VA class (5)
  "VA1","VA2","VA3","VA4","VA5",
  // Motor neurons – VB class (5)
  "VB1","VB2","VB3","VB4","VB5",
  // Motor neurons – VD class (5)
  "VD1","VD2","VD3","VD4","VD5",
];

export type NeuronType = "sensory"|"interneuron"|"motor";
export type Neurotransmitter = "glutamate"|"acetylcholine"|"GABA";

export const NODE_TYPES: Record<string, NeuronType> = {
  PLML:"sensory", PLMR:"sensory", ALML:"sensory", ALMR:"sensory", AVM:"sensory", PVM:"sensory",
  AVBL:"interneuron",AVBR:"interneuron",PVCL:"interneuron",PVCR:"interneuron",
  AVAL:"interneuron",AVAR:"interneuron",AVDL:"interneuron",AVDR:"interneuron",AVEL:"interneuron",AVER:"interneuron",
  RIML:"interneuron",RIMR:"interneuron",AIBL:"interneuron",AIBR:"interneuron",
  RIBL:"interneuron",RIBR:"interneuron",AVJL:"interneuron",AVJR:"interneuron",
  DA1:"motor",DA2:"motor",DA3:"motor",DA4:"motor",DA5:"motor",DA6:"motor",DA7:"motor",DA8:"motor",DA9:"motor",
  DB1:"motor",DB2:"motor",DB3:"motor",DB4:"motor",DB5:"motor",DB6:"motor",DB7:"motor",
  DD1:"motor",DD2:"motor",DD3:"motor",DD4:"motor",DD5:"motor",DD6:"motor",
  VA1:"motor",VA2:"motor",VA3:"motor",VA4:"motor",VA5:"motor",
  VB1:"motor",VB2:"motor",VB3:"motor",VB4:"motor",VB5:"motor",
  VD1:"motor",VD2:"motor",VD3:"motor",VD4:"motor",VD5:"motor",
};

export const NEUROTRANSMITTER: Record<string, Neurotransmitter> = {
  PLML:"glutamate",PLMR:"glutamate",ALML:"glutamate",ALMR:"glutamate",AVM:"glutamate",PVM:"glutamate",
  AVBL:"glutamate",AVBR:"glutamate",PVCL:"glutamate",PVCR:"glutamate",
  AVAL:"glutamate",AVAR:"glutamate",AVDL:"glutamate",AVDR:"glutamate",AVEL:"glutamate",AVER:"glutamate",
  RIML:"glutamate",RIMR:"glutamate",AIBL:"glutamate",AIBR:"glutamate",
  RIBL:"glutamate",RIBR:"glutamate",AVJL:"glutamate",AVJR:"glutamate",
  DA1:"acetylcholine",DA2:"acetylcholine",DA3:"acetylcholine",DA4:"acetylcholine",
  DA5:"acetylcholine",DA6:"acetylcholine",DA7:"acetylcholine",DA8:"acetylcholine",DA9:"acetylcholine",
  DB1:"acetylcholine",DB2:"acetylcholine",DB3:"acetylcholine",DB4:"acetylcholine",
  DB5:"acetylcholine",DB6:"acetylcholine",DB7:"acetylcholine",
  DD1:"GABA",DD2:"GABA",DD3:"GABA",DD4:"GABA",DD5:"GABA",DD6:"GABA",
  VA1:"acetylcholine",VA2:"acetylcholine",VA3:"acetylcholine",VA4:"acetylcholine",VA5:"acetylcholine",
  VB1:"acetylcholine",VB2:"acetylcholine",VB3:"acetylcholine",VB4:"acetylcholine",VB5:"acetylcholine",
  VD1:"GABA",VD2:"GABA",VD3:"GABA",VD4:"GABA",VD5:"GABA",
};

// ALS-like selective vulnerability [0,1]
export const VULNERABILITY: Record<string, number> = {
  PLML:0.05,PLMR:0.05,ALML:0.05,ALMR:0.05,AVM:0.05,PVM:0.05,
  AVBL:0.15,AVBR:0.15,PVCL:0.15,PVCR:0.15,
  AVAL:0.15,AVAR:0.15,AVDL:0.15,AVDR:0.15,AVEL:0.15,AVER:0.15,
  RIML:0.30,RIMR:0.30,AIBL:0.30,AIBR:0.30,RIBL:0.30,RIBR:0.30,AVJL:0.30,AVJR:0.30,
  DA1:1.00,DA2:1.00,DA3:1.00,DA4:1.00,DA5:1.00,DA6:1.00,DA7:1.00,DA8:1.00,DA9:1.00,
  DB1:0.90,DB2:0.90,DB3:0.90,DB4:0.90,DB5:0.90,DB6:0.90,DB7:0.90,
  DD1:0.70,DD2:0.70,DD3:0.70,DD4:0.70,DD5:0.70,DD6:0.70,
  VA1:0.95,VA2:0.95,VA3:0.95,VA4:0.95,VA5:0.95,
  VB1:0.85,VB2:0.85,VB3:0.85,VB4:0.85,VB5:0.85,
  VD1:0.65,VD2:0.65,VD3:0.65,VD4:0.65,VD5:0.65,
};

// [pre, post, weight, type] — 127 directed synapses
export const SYNAPSES: [string, string, number, "excitatory"|"inhibitory"][] = [
  // Sensory -> Command
  ["PLML","PVCL",0.8,"excitatory"],["PLMR","PVCR",0.8,"excitatory"],
  ["PLML","PVCR",0.4,"excitatory"],["PLMR","PVCL",0.4,"excitatory"],
  ["PLML","AVDL",0.6,"excitatory"],["PLMR","AVDR",0.6,"excitatory"],
  ["ALML","AVDL",0.7,"excitatory"],["ALMR","AVDR",0.7,"excitatory"],
  ["ALML","AVAL",0.5,"excitatory"],["ALMR","AVAR",0.5,"excitatory"],
  ["AVM","AVDL",0.6,"excitatory"],["AVM","AVDR",0.6,"excitatory"],
  ["PVM","PVCL",0.5,"excitatory"],["PVM","PVCR",0.5,"excitatory"],
  // Command interneuron network
  ["AVAL","AVDL",0.6,"excitatory"],["AVAR","AVDR",0.6,"excitatory"],
  ["AVDL","AVAL",0.4,"excitatory"],["AVDR","AVAR",0.4,"excitatory"],
  ["AVAL","AVEL",0.5,"excitatory"],["AVAR","AVER",0.5,"excitatory"],
  ["PVCL","AVBL",0.7,"excitatory"],["PVCR","AVBR",0.7,"excitatory"],
  ["RIML","AVAL",0.5,"inhibitory"],["RIMR","AVAR",0.5,"inhibitory"],
  ["RIML","AVBL",0.4,"inhibitory"],["RIMR","AVBR",0.4,"inhibitory"],
  ["AIBL","AVAL",0.6,"excitatory"],["AIBR","AVAR",0.6,"excitatory"],
  ["AIBL","AVBL",0.5,"excitatory"],["AIBR","AVBR",0.5,"excitatory"],
  ["RIBL","PVCL",0.4,"excitatory"],["RIBR","PVCR",0.4,"excitatory"],
  ["AVJL","AVBL",0.5,"excitatory"],["AVJR","AVBR",0.5,"excitatory"],
  ["AVJL","AVAL",0.4,"excitatory"],["AVJR","AVAR",0.4,"excitatory"],
  // Command -> Motor DA (backward)
  ["AVAL","DA1",0.8,"excitatory"],["AVAL","DA2",0.8,"excitatory"],
  ["AVAL","DA3",0.7,"excitatory"],["AVAL","DA4",0.7,"excitatory"],
  ["AVAL","DA5",0.6,"excitatory"],["AVAR","DA6",0.8,"excitatory"],
  ["AVAR","DA7",0.7,"excitatory"],["AVAR","DA8",0.6,"excitatory"],
  ["AVAR","DA9",0.5,"excitatory"],["AVDL","DA1",0.5,"excitatory"],
  ["AVDL","DA2",0.5,"excitatory"],["AVDR","DA6",0.5,"excitatory"],
  // Command -> Motor DB (forward)
  ["AVBL","DB1",0.8,"excitatory"],["AVBL","DB2",0.8,"excitatory"],
  ["AVBL","DB3",0.7,"excitatory"],["AVBL","DB4",0.6,"excitatory"],
  ["AVBR","DB5",0.8,"excitatory"],["AVBR","DB6",0.7,"excitatory"],
  ["AVBR","DB7",0.6,"excitatory"],["PVCL","DB1",0.5,"excitatory"],
  ["PVCR","DB5",0.5,"excitatory"],
  // Command -> Motor VA (backward ventral)
  ["AVAL","VA1",0.7,"excitatory"],["AVAL","VA2",0.7,"excitatory"],
  ["AVAL","VA3",0.6,"excitatory"],["AVAR","VA4",0.7,"excitatory"],
  ["AVAR","VA5",0.6,"excitatory"],["AVDL","VA1",0.4,"excitatory"],
  // Command -> Motor VB (forward ventral)
  ["AVBL","VB1",0.8,"excitatory"],["AVBL","VB2",0.7,"excitatory"],
  ["AVBR","VB3",0.8,"excitatory"],["AVBR","VB4",0.7,"excitatory"],
  ["PVCL","VB1",0.5,"excitatory"],["PVCL","VB2",0.4,"excitatory"],
  ["PVCR","VB3",0.4,"excitatory"],
  // Motor -> DD inhibitory (dorsal)
  ["DA1","DD1",0.6,"excitatory"],["DA2","DD2",0.6,"excitatory"],
  ["DA3","DD3",0.6,"excitatory"],["DA4","DD4",0.5,"excitatory"],
  ["DA5","DD5",0.5,"excitatory"],["DB1","DD1",0.5,"excitatory"],
  ["DB2","DD2",0.5,"excitatory"],["DB3","DD3",0.5,"excitatory"],
  ["DB4","DD4",0.4,"excitatory"],["DD1","DA1",0.5,"inhibitory"],
  ["DD2","DA2",0.5,"inhibitory"],["DD3","DA3",0.4,"inhibitory"],
  ["DD1","DB1",0.5,"inhibitory"],["DD2","DB2",0.4,"inhibitory"],
  // Motor -> VD inhibitory (ventral)
  ["VA1","VD1",0.6,"excitatory"],["VA2","VD2",0.6,"excitatory"],
  ["VA3","VD3",0.5,"excitatory"],["VA4","VD4",0.5,"excitatory"],
  ["VB1","VD1",0.5,"excitatory"],["VB2","VD2",0.5,"excitatory"],
  ["VB3","VD3",0.4,"excitatory"],["VD1","VA1",0.4,"inhibitory"],
  ["VD2","VA2",0.4,"inhibitory"],["VD1","VB1",0.4,"inhibitory"],
  // DA self-chain (backward wave propagation)
  ["DA1","DA2",0.3,"excitatory"],["DA2","DA3",0.3,"excitatory"],
  ["DA3","DA4",0.3,"excitatory"],["DA4","DA5",0.3,"excitatory"],
  ["DA5","DA6",0.3,"excitatory"],["DA6","DA7",0.3,"excitatory"],
  ["DA7","DA8",0.3,"excitatory"],["DA8","DA9",0.2,"excitatory"],
  // DB self-chain
  ["DB1","DB2",0.3,"excitatory"],["DB2","DB3",0.3,"excitatory"],
  ["DB3","DB4",0.3,"excitatory"],["DB4","DB5",0.3,"excitatory"],
  ["DB5","DB6",0.3,"excitatory"],["DB6","DB7",0.2,"excitatory"],
  // VA self-chain
  ["VA1","VA2",0.3,"excitatory"],["VA2","VA3",0.3,"excitatory"],
  ["VA3","VA4",0.3,"excitatory"],["VA4","VA5",0.2,"excitatory"],
  // VB self-chain
  ["VB1","VB2",0.3,"excitatory"],["VB2","VB3",0.3,"excitatory"],
  ["VB3","VB4",0.3,"excitatory"],["VB4","VB5",0.2,"excitatory"],
  // VD self-chain
  ["VD1","VD2",0.3,"excitatory"],["VD2","VD3",0.3,"excitatory"],
  ["VD3","VD4",0.3,"excitatory"],["VD4","VD5",0.2,"excitatory"],
  // DD self-chain
  ["DD1","DD2",0.3,"excitatory"],["DD2","DD3",0.3,"excitatory"],
  ["DD3","DD4",0.3,"excitatory"],["DD4","DD5",0.3,"excitatory"],
  ["DD5","DD6",0.2,"excitatory"],
];

export const N = NEURON_NAMES.length; // 61

// Build index map
export const NEURON_IDX: Record<string, number> = {};
NEURON_NAMES.forEach((n, i) => { NEURON_IDX[n] = i; });

// Build vulnerability array
export const VULN_ARRAY: number[] = NEURON_NAMES.map(n => VULNERABILITY[n] ?? 0.15);

// Build aggregation weight matrix [j][i] = weight of synapse i->j
export function buildAggW(): number[][] {
  const W: number[][] = Array.from({length: N}, () => new Array(N).fill(0));
  for (const [pre, post, weight] of SYNAPSES) {
    const i = NEURON_IDX[pre];
    const j = NEURON_IDX[post];
    if (i !== undefined && j !== undefined) {
      W[j][i] = weight; // j receives from i
    }
  }
  return W;
}

// Build excitotox weight matrix (only glutamate excitatory synapses)
export function buildExcitotoxW(): number[][] {
  const W: number[][] = Array.from({length: N}, () => new Array(N).fill(0));
  for (const [pre, post, weight, stype] of SYNAPSES) {
    const i = NEURON_IDX[pre];
    const j = NEURON_IDX[post];
    if (i !== undefined && j !== undefined && NEUROTRANSMITTER[pre] === "glutamate" && stype === "excitatory") {
      W[j][i] = weight;
    }
  }
  return W;
}

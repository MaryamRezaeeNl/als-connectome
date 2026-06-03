"use client";
import { useState } from "react";

// ─── Connectome Data ──────────────────────────────────────────────────────────
const EDGES: [number, number][] = [
  [0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,12],[0,13],[0,14],[0,15],
  [0,16],[0,17],[0,18],[0,39],[0,40],[0,41],[0,42],[0,43],[0,55],[0,56],
  [0,57],[0,59],[0,60],[1,4],[1,5],[1,6],[1,7],[1,8],[1,9],[1,12],
  [1,13],[1,14],[1,15],[1,16],[1,17],[1,19],[1,55],[1,56],[1,57],[1,59],
  [1,60],[2,4],[2,5],[2,8],[2,9],[2,10],[2,11],[2,21],[2,22],[2,23],
  [2,24],[2,25],[2,26],[2,27],[2,44],[2,45],[2,46],[2,47],[2,48],[2,55],
  [2,56],[3,4],[3,5],[3,8],[3,9],[3,10],[3,11],[3,21],[3,22],[3,23],
  [3,24],[3,25],[3,26],[3,27],[3,55],[3,56],[4,10],[4,11],[4,49],[4,50],
  [4,53],[4,54],[4,57],[4,58],[5,10],[5,11],[5,49],[5,50],[5,53],[5,54],
  [5,57],[5,58],[12,13],[12,28],[13,14],[13,29],[14,15],[14,30],[15,16],
  [15,31],[16,32],[17,33],[21,22],[21,34],[22,23],[22,35],[23,24],[23,36],
  [24,25],[24,37],[25,38],[28,29],[28,39],[28,44],[29,30],[29,40],[29,45],
  [30,31],[30,41],[30,46],[31,32],[31,42],[31,47],[32,43],[32,48],[51,57],[52,57],
];

const NEURON_NAMES: Record<number, string> = {
  0:"AVAL",1:"AVAR",2:"AVBL",3:"AVBR",4:"PVCL",5:"PVCR",
  6:"AVDL",7:"AVDR",8:"AIBR",9:"AIBL",10:"RIBL",11:"RIBR",
  12:"DA1",13:"DA2",14:"DA3",15:"DA4",16:"DA5",17:"DA6",
  18:"DA7",19:"DA8",20:"DA9",21:"DB1",22:"DB2",23:"DB3",
  24:"DB4",25:"DB5",26:"DB6",27:"DB7",28:"DD1",29:"DD2",
  30:"DD3",31:"DD4",32:"DD5",33:"DD6",34:"VD1",35:"VD2",
  36:"VD3",37:"VD4",38:"VD5",39:"VA1",40:"VA2",41:"VA3",
  42:"VA4",43:"VA5",44:"VB1",45:"VB2",46:"VB3",47:"VB4",
  48:"VB5",49:"PLML",50:"PLMR",51:"ALML",52:"ALMR",53:"AVM",
  54:"PVM",55:"AVJL",56:"AVJR",57:"DVA",58:"PVP",59:"LUAL",60:"LUAR",
};

const NODE_TYPES: Record<number, number> = {
  0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:5,9:5,10:5,11:5,
  12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,
  21:2,22:2,23:2,24:2,25:2,26:2,27:2,
  28:3,29:3,30:3,31:3,32:3,33:3,34:3,35:3,36:3,37:3,38:3,
  39:1,40:1,41:1,42:1,43:1,
  44:2,45:2,46:2,47:2,48:2,
  49:4,50:4,51:4,52:4,53:4,54:4,
  55:5,56:5,57:5,58:5,59:5,60:5,
};

const TYPE_COLORS = ["#00e5ff","#ff4444","#ffd700","#a855f7","#a8ff78","#6688cc"];
const TYPE_LABELS  = ["Command","Motor-A","Motor-B","Motor-D","Sensory","Interneuron"];
const N = 61;
const LO_SHU = [8,1,6,3,5,7,4,9,2];
const DEFAULT_ABSORBERS = [6, 59, 60, 17]; // AVDL, LUAL, LUAR, DA6
const MODEL_COLORS = ["#3a5570","#00e5ff","#a8ff78","#ffd700"];
const MODEL_LABELS = ["Baseline","Topo Magic","Dynamic Pulse","Combined"];

// ─── Graph Setup ──────────────────────────────────────────────────────────────
function buildAdj(): number[][] {
  const adj: number[][] = Array.from({length:N}, ()=>[]);
  for (const [a,b] of EDGES) { adj[a].push(b); adj[b].push(a); }
  return adj.map(nb => [...new Set(nb)]);
}
const ADJ = buildAdj();
const BASE_CAP = ADJ.map(nb => Math.max(nb.length, 1));

const EDGE_MAP: Record<string, number> = {};
for (const [a,b] of EDGES) EDGE_MAP[`${Math.min(a,b)},${Math.max(a,b)}`] = 1.0;
function edgeKey(a: number, b: number): string { return `${Math.min(a,b)},${Math.max(a,b)}`; }

// ─── Types ────────────────────────────────────────────────────────────────────
interface ModelResult {
  finalAlive: number; totalDead: number; depth: number;
  timeline: number[]; survivalRate: number;
  energyBefore?: number; energyAfter?: number; target?: number;
  absorberLoadHist?: number[][]; absorberOverloaded?: number;
}
interface AttackResults { base: ModelResult; topo: ModelResult; pulse: ModelResult; combined: ModelResult; }
interface ExperimentData {
  results: { als: AttackResults; hub: AttackResults; random: AttackResults };
  pfSweep: Array<{ pf: number; finalAlive: number; gain: number }>;
  boostSweep: Array<{ ab: number; finalAlive: number; gain: number }>;
}

// ─── Attack Generators ────────────────────────────────────────────────────────
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
}
function getAttacked(mode: string, seed = 42): number[] {
  if (mode==="als") return Object.keys(NODE_TYPES).filter(i=>NODE_TYPES[+i]===1).map(Number).slice(0,3);
  if (mode==="hub") return [...Array(N).keys()].sort((a,b)=>ADJ[b].length-ADJ[a].length).slice(0,3);
  const rng = seededRng(seed);
  return [...Array(N).keys()].sort(()=>rng()-.5).slice(0,3);
}

// ─── Model 0: Baseline Cascade ───────────────────────────────────────────────
function runBaseline(attacked: number[]): ModelResult {
  const cap=new Float64Array(BASE_CAP), load=new Float64Array(N);
  for (let i=0;i<N;i++) load[i]=cap[i];
  const alive=new Uint8Array(N).fill(1);
  for (const nd of attacked) alive[nd]=0;
  let queue=[...attacked], depth=0;
  const timeline=[alive.reduce((s,v)=>s+v,0)];
  for (let step=0;step<80;step++) {
    const dying:number[]=[];
    for (const dead of queue) {
      const lnb=ADJ[dead].filter(j=>alive[j]); if(!lnb.length) continue;
      const extra=load[dead]/lnb.length;
      for (const nb of lnb) { load[nb]+=extra; if(load[nb]>cap[nb]*1.5&&alive[nb]){alive[nb]=0;dying.push(nb);} }
    }
    queue=dying; timeline.push(alive.reduce((s,v)=>s+v,0));
    if(dying.length) depth=step+1; if(!dying.length) break;
  }
  const fa=alive.reduce((s,v)=>s+v,0);
  return {finalAlive:fa,totalDead:N-fa,depth,timeline,survivalRate:fa/N};
}

// ─── Model 1: Topological Magic ───────────────────────────────────────────────
function computeMagicEnergy(w: Record<string,number>, adj: number[][], target: number): number {
  return adj.reduce((e,nb,i)=>{const ws=nb.reduce((s,j)=>s+(w[edgeKey(i,j)]||1),0); return e+(ws-target)**2;},0);
}
function optimizeWeights(steps=300): {weights:Record<string,number>;target:number;energyBefore:number;energyAfter:number} {
  const weights: Record<string,number>={};
  for (const [a,b] of EDGES) weights[edgeKey(a,b)]=1.0;
  const target=ADJ.reduce((s,nb)=>s+nb.length,0)/N;
  const MIN_W=0.25,MAX_W=3.0,LR=0.02;
  for (let step=0;step<steps;step++) {
    for (const [a,b] of EDGES) {
      const k=edgeKey(a,b);
      const wsA=ADJ[a].reduce((s,j)=>s+(weights[edgeKey(a,j)]||1),0);
      const wsB=ADJ[b].reduce((s,j)=>s+(weights[edgeKey(b,j)]||1),0);
      weights[k]=Math.max(MIN_W,Math.min(MAX_W,weights[k]-LR*2*((wsA-target)+(wsB-target))));
    }
  }
  const initW=Object.fromEntries(EDGES.map(([a,b])=>[edgeKey(a,b),1.0]));
  return {weights,target,energyBefore:computeMagicEnergy(initW,ADJ,target),energyAfter:computeMagicEnergy(weights,ADJ,target)};
}
function runTopoMagic(attacked: number[]): ModelResult {
  const {weights,target,energyBefore,energyAfter}=optimizeWeights(300);
  const cap=new Float64Array(BASE_CAP),load=new Float64Array(N);
  for (let i=0;i<N;i++) load[i]=cap[i];
  const alive=new Uint8Array(N).fill(1);
  for (const nd of attacked) alive[nd]=0;
  let queue=[...attacked],depth=0;
  const timeline=[alive.reduce((s,v)=>s+v,0)];
  for (let step=0;step<80;step++) {
    const dying:number[]=[];
    for (const dead of queue) {
      const lnb=ADJ[dead].filter(j=>alive[j]); if(!lnb.length) continue;
      const tw=lnb.reduce((s,j)=>s+(weights[edgeKey(dead,j)]||1),0)||1;
      for (const nb of lnb) { const w=(weights[edgeKey(dead,nb)]||1)/tw; load[nb]+=load[dead]*w; if(load[nb]>cap[nb]*1.5&&alive[nb]){alive[nb]=0;dying.push(nb);} }
    }
    queue=dying; timeline.push(alive.reduce((s,v)=>s+v,0));
    if(dying.length) depth=step+1; if(!dying.length) break;
  }
  const fa=alive.reduce((s,v)=>s+v,0);
  return {finalAlive:fa,totalDead:N-fa,depth,timeline,survivalRate:fa/N,energyBefore,energyAfter,target};
}

// ─── Model 2: Dynamic Magic Pulse ────────────────────────────────────────────
function loShuWeights(absorbers: number[]): Record<number,number> {
  const sorted=[...absorbers].sort((a,b)=>BASE_CAP[b]-BASE_CAP[a]);
  const raw=sorted.map((_,i)=>LO_SHU[i%LO_SHU.length]);
  const total=raw.reduce((a,b)=>a+b,0);
  return Object.fromEntries(sorted.map((id,i)=>[id,raw[i]/total]));
}
function runDynamicPulse(attacked: number[], absorbers: number[], pf: number, boost: number): ModelResult {
  const cap=new Float64Array(BASE_CAP);
  for (const ab of absorbers) cap[ab]*=boost;
  const load=new Float64Array(N);
  for (let i=0;i<N;i++) load[i]=cap[i];
  const alive=new Uint8Array(N).fill(1);
  for (const nd of attacked) alive[nd]=0;
  let queue=[...attacked],depth=0;
  const timeline=[alive.reduce((s,v)=>s+v,0)];
  const loShu=loShuWeights(absorbers);
  const absorberLoadHist: number[][]=Array.from({length:absorbers.length},()=>[]);
  for (let step=0;step<80;step++) {
    const dying:number[]=[];
    for (const dead of queue) {
      const lnb=ADJ[dead].filter(j=>alive[j]); if(!lnb.length) continue;
      const dl=load[dead], alive_abs=absorbers.filter(a=>alive[a]);
      let pulse=0;
      if (alive_abs.length>0) {
        pulse=dl*pf;
        const ln=alive_abs.reduce((s,a)=>s+(loShu[a]||1/alive_abs.length),0)||1;
        for (const ab of alive_abs) { const w=(loShu[ab]||1/alive_abs.length)/ln; load[ab]+=pulse*w; if(load[ab]>cap[ab]*1.5&&alive[ab]){alive[ab]=0;dying.push(ab);} }
      }
      const perNb=(dl-pulse)/lnb.length;
      for (const nb of lnb) { load[nb]+=perNb; if(load[nb]>cap[nb]*1.5&&alive[nb]){alive[nb]=0;dying.push(nb);} }
    }
    queue=dying; timeline.push(alive.reduce((s,v)=>s+v,0));
    absorbers.forEach((ab,i)=>absorberLoadHist[i].push(load[ab]));
    if(dying.length) depth=step+1; if(!dying.length) break;
  }
  const fa=alive.reduce((s,v)=>s+v,0);
  return {finalAlive:fa,totalDead:N-fa,depth,timeline,survivalRate:fa/N,absorberLoadHist,absorberOverloaded:absorbers.filter(ab=>!alive[ab]).length};
}

// ─── Model 3: Combined ────────────────────────────────────────────────────────
function runCombined(attacked: number[], absorbers: number[], pf: number, boost: number): ModelResult {
  const {weights,energyBefore,energyAfter}=optimizeWeights(300);
  const cap=new Float64Array(BASE_CAP);
  for (const ab of absorbers) cap[ab]*=boost;
  const load=new Float64Array(N);
  for (let i=0;i<N;i++) load[i]=cap[i];
  const alive=new Uint8Array(N).fill(1);
  for (const nd of attacked) alive[nd]=0;
  let queue=[...attacked],depth=0;
  const timeline=[alive.reduce((s,v)=>s+v,0)];
  const loShu=loShuWeights(absorbers);
  for (let step=0;step<80;step++) {
    const dying:number[]=[];
    for (const dead of queue) {
      const lnb=ADJ[dead].filter(j=>alive[j]); if(!lnb.length) continue;
      const dl=load[dead], alive_abs=absorbers.filter(a=>alive[a]);
      let pulse=0;
      if (alive_abs.length>0) {
        pulse=dl*pf;
        const ln=alive_abs.reduce((s,a)=>s+(loShu[a]||1/alive_abs.length),0)||1;
        for (const ab of alive_abs) { const w=(loShu[ab]||1/alive_abs.length)/ln; load[ab]+=pulse*w; if(load[ab]>cap[ab]*1.5&&alive[ab]){alive[ab]=0;dying.push(ab);} }
      }
      const nl=dl-pulse, tw=lnb.reduce((s,j)=>s+(weights[edgeKey(dead,j)]||1),0)||1;
      for (const nb of lnb) { const w=(weights[edgeKey(dead,nb)]||1)/tw; load[nb]+=nl*w; if(load[nb]>cap[nb]*1.5&&alive[nb]){alive[nb]=0;dying.push(nb);} }
    }
    queue=dying; timeline.push(alive.reduce((s,v)=>s+v,0));
    if(dying.length) depth=step+1; if(!dying.length) break;
  }
  const fa=alive.reduce((s,v)=>s+v,0);
  return {finalAlive:fa,totalDead:N-fa,depth,timeline,survivalRate:fa/N,energyBefore,energyAfter};
}

// ─── Experiment Runner ────────────────────────────────────────────────────────
function runExperiment(absorbers: number[], pf: number, boost: number, seeds: number[]): ExperimentData {
  const res: Record<string,AttackResults>={};
  for (const mode of ["als","hub","random"]) {
    if (mode==="random") {
      const runs=seeds.map(seed=>{
        const att=getAttacked("random",seed);
        return {base:runBaseline(att),topo:runTopoMagic(att),pulse:runDynamicPulse(att,absorbers,pf,boost),combined:runCombined(att,absorbers,pf,boost)};
      });
      const avgF=(k: "base"|"topo"|"pulse"|"combined",f: "finalAlive"|"totalDead"|"depth"|"survivalRate")=>
        runs.reduce((s,r)=>s+r[k][f],0)/runs.length;
      const avgT=(k: "base"|"topo"|"pulse"|"combined")=>{
        const ml=Math.max(...runs.map(r=>r[k].timeline.length));
        return Array.from({length:ml},(_,i)=>runs.reduce((s,r)=>s+(r[k].timeline[i]??r[k].finalAlive),0)/runs.length);
      };
      res[mode]={
        base:    {finalAlive:avgF("base","finalAlive"),   totalDead:avgF("base","totalDead"),   depth:avgF("base","depth"),   timeline:avgT("base"),   survivalRate:avgF("base","survivalRate")},
        topo:    {finalAlive:avgF("topo","finalAlive"),   totalDead:avgF("topo","totalDead"),   depth:avgF("topo","depth"),   timeline:avgT("topo"),   survivalRate:avgF("topo","survivalRate")},
        pulse:   {finalAlive:avgF("pulse","finalAlive"),  totalDead:avgF("pulse","totalDead"),  depth:avgF("pulse","depth"),  timeline:avgT("pulse"),  survivalRate:avgF("pulse","survivalRate")},
        combined:{finalAlive:avgF("combined","finalAlive"),totalDead:avgF("combined","totalDead"),depth:avgF("combined","depth"),timeline:avgT("combined"),survivalRate:avgF("combined","survivalRate")},
      };
    } else {
      const att=getAttacked(mode);
      res[mode]={base:runBaseline(att),topo:runTopoMagic(att),pulse:runDynamicPulse(att,absorbers,pf,boost),combined:runCombined(att,absorbers,pf,boost)};
    }
  }
  const pfSweep=[0.05,0.10,0.20,0.30].map(p=>{const att=getAttacked("als");const r=runDynamicPulse(att,absorbers,p,boost);return {pf:p,finalAlive:r.finalAlive,gain:r.finalAlive-runBaseline(att).finalAlive};});
  const boostSweep=[1.0,1.2,1.5,2.0].map(b=>{const att=getAttacked("als");const r=runDynamicPulse(att,absorbers,pf,b);return {ab:b,finalAlive:r.finalAlive,gain:r.finalAlive-runBaseline(att).finalAlive};});
  return {results:res as ExperimentData["results"],pfSweep,boostSweep};
}

// ─── SVG Chart Internals ─────────────────────────────────────────────────────
interface ChartSeries { label:string; data:(number|null)[]; color:string; bold?:boolean; dim?:boolean; dash?:boolean; }

function M2LineChart({series,height=110,width=480,title}:{series:ChartSeries[];height?:number;width?:number;title?:string}) {
  const pad={t:22,r:12,b:20,l:38};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const all=series.flatMap(s=>s.data).filter((v): v is number=>v!=null&&isFinite(v as number));
  if(!all.length) return null;
  const yMin=Math.min(...all),yMax=Math.max(...all)||1;
  const xLen=Math.max(...series.map(s=>s.data.length),2);
  const tx=(i:number)=>(i/Math.max(xLen-1,1))*W;
  const ty=(v:number)=>H-((v-yMin)/(yMax-yMin||1))*H;
  const mkPath=(d:(number|null)[])=>d.map((v,i)=>v!=null?`${i===0?"M":"L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`:"").filter(Boolean).join(" ");
  return (<svg width={width} height={height} style={{display:"block"}}>
    {title&&<text x={pad.l+W/2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
    <g transform={`translate(${pad.l},${pad.t})`}>
      {[0,0.5,1].map(f=>(<g key={f}><line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/><text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={8} fill="#3a5570">{Math.round(yMin+f*(yMax-yMin))}</text></g>))}
      {series.map(s=><path key={s.label} d={mkPath(s.data)} fill="none" stroke={s.color} strokeWidth={s.bold?2.5:1.6} strokeLinejoin="round" opacity={s.dim?0.4:1} strokeDasharray={s.dash?"5,3":"none"}/>)}
    </g>
  </svg>);
}

interface BarGroup { label:string; values:number[]; }
function M2GroupedBarChart({groups,width=520,height=170}:{groups:BarGroup[];width?:number;height?:number}) {
  const pad={t:22,r:12,b:30,l:42};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const allVals=groups.flatMap(g=>g.values);
  const minV=Math.min(...allVals,0),maxV=Math.max(...allVals,1);
  const gw=W/groups.length,bw=gw/5,gap=gw/5;
  const ty=(v:number)=>H-((v-minV)/(maxV-minV||1))*H;
  return (<svg width={width} height={height} style={{display:"block"}}>
    <text x={pad.l+W/2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>FINAL ALIVE NEURONS BY MODEL vs ATTACK</text>
    <g transform={`translate(${pad.l},${pad.t})`}>
      {[0,0.25,0.5,0.75,1].map(f=>(<g key={f}><line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/><text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={7} fill="#3a5570">{Math.round(minV+f*(maxV-minV))}</text></g>))}
      {groups.map((g,gi)=>{
        const gx=gi*gw, baseline=groups[0]?.values[0]??1;
        return (<g key={gi}>
          {g.values.map((v,mi)=>{const x=gx+gap+(mi*(bw+2)),col=MODEL_COLORS[mi];return (<g key={mi}><rect x={x} y={ty(v)} width={bw} height={Math.max(Math.abs(ty(v)-ty(Math.max(minV,0))),1)} fill={col} rx={2} opacity={0.85}/>{v>baseline&&mi>0&&<text x={x+bw/2} y={ty(v)-3} textAnchor="middle" fontSize={7} fill={col}>↑</text>}{v<baseline-0.5&&<text x={x+bw/2} y={ty(v)-3} textAnchor="middle" fontSize={7} fill="#ff4444">▼</text>}</g>);})}
          <text x={gx+gw/2} y={H+16} textAnchor="middle" fontSize={9} fill="#5a7a9a">{g.label}</text>
        </g>);
      })}
      {MODEL_LABELS.map((l,i)=>(<g key={i} transform={`translate(${i*120},${H+26})`}><rect x={0} y={-7} width={10} height={8} fill={MODEL_COLORS[i]} rx={1}/><text x={13} y={0} fontSize={8} fill={MODEL_COLORS[i]}>{l}</text></g>))}
    </g>
  </svg>);
}

function M2SweepChart({data,xKey,xLabel,title,width=240,height=130}:{data:Array<Record<string,number>>;xKey:string;xLabel?:string;title?:string;width?:number;height?:number}) {
  if(!data.length) return null;
  const pad={t:20,r:12,b:28,l:38};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const xs=data.map(d=>d[xKey]),ys=data.map(d=>d.gain);
  const xMin=Math.min(...xs),xMax=Math.max(...xs),yMin=Math.min(...ys,-0.5),yMax=Math.max(...ys,0.5);
  const tx=(v:number)=>((v-xMin)/(xMax-xMin||1))*W;
  const ty=(v:number)=>H-((v-yMin)/(yMax-yMin||1))*H;
  const path=data.map((d,i)=>`${i===0?"M":"L"}${tx(d[xKey]).toFixed(1)},${ty(d.gain).toFixed(1)}`).join(" ");
  return (<svg width={width} height={height} style={{display:"block"}}>
    {title&&<text x={pad.l+W/2} y={13} textAnchor="middle" fontSize={9} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
    <g transform={`translate(${pad.l},${pad.t})`}>
      <line x1={0} x2={W} y1={ty(0)} y2={ty(0)} stroke="#1a3050" strokeWidth={1} strokeDasharray="3,2"/>
      {[0,0.5,1].map(f=>(<g key={f}><line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/><text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={7} fill="#3a5570">{(yMin+f*(yMax-yMin)).toFixed(1)}</text></g>))}
      {data.map((d,i)=><text key={i} x={tx(d[xKey])} y={H+14} textAnchor="middle" fontSize={8} fill="#3a5570">{d[xKey]}</text>)}
      {xLabel&&<text x={W/2} y={H+26} textAnchor="middle" fontSize={8} fill="#4a6a8a">{xLabel}</text>}
      <path d={path} fill="none" stroke="#a8ff78" strokeWidth={2} strokeLinejoin="round"/>
      {data.map((d,i)=><circle key={i} cx={tx(d[xKey])} cy={ty(d.gain)} r={4} fill={d.gain>0?"#a8ff78":"#ff4444"} opacity={0.9}/>)}
    </g>
  </svg>);
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function M2Stat({label,value,color,sub,big}:{label:string;value:string;color:string;sub?:string;big?:boolean}) {
  return (
    <div className="rounded-xl p-3" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${color}22`}}>
      <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,textTransform:"uppercase"}}>{label}</div>
      <div className="font-mono font-black leading-tight" style={{fontSize:big?22:15,color}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:"#1e3050",marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ─── Research Finding ─────────────────────────────────────────────────────────
function M2ResearchFinding({data}:{data:ExperimentData}) {
  const {results,pfSweep}=data;
  type AK="als"|"hub"|"random";
  const ATKLABELS=["ALS","Hub","Random"];
  const gains={} as Record<AK,{topo:number;pulse:number;combined:number}>;
  for (const atk of ["als","hub","random"] as AK[]) {
    const base=results[atk].base.finalAlive;
    gains[atk]={topo:results[atk].topo.finalAlive-base,pulse:results[atk].pulse.finalAlive-base,combined:results[atk].combined.finalAlive-base};
  }
  const bestModel=(atk:AK)=>{
    const g=gains[atk],max=Math.max(g.topo,g.pulse,g.combined);
    if(max<=0) return {name:"no gain",gain:max,color:"#3a5570"};
    if(max===g.combined) return {name:"Combined",gain:max,color:"#ffd700"};
    if(max===g.pulse) return {name:"Dynamic Pulse",gain:max,color:"#a8ff78"};
    return {name:"Topo Magic",gain:max,color:"#00e5ff"};
  };
  const anyHarmed=(["als","hub","random"] as AK[]).some(a=>Math.min(gains[a].topo,gains[a].pulse,gains[a].combined)<-0.5);
  const bestPF=pfSweep.reduce((b,d)=>d.gain>b.gain?d:b,pfSweep[0]);
  const alsBest=bestModel("als");
  const overallPositive=(["als","hub","random"] as AK[]).every(a=>Math.max(gains[a].topo,gains[a].pulse,gains[a].combined)>0);

  return (
    <div className="rounded-2xl p-5" style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${overallPositive?"#a8ff7855":"#ffd70044"}`}}>
      <div className="text-xs font-bold mb-4" style={{color:overallPositive?"#a8ff78":"#ffd700",letterSpacing:2}}>PHASE 2 — RESEARCH FINDING</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(["als","hub","random"] as AK[]).map((atk,i)=>{
          const bm=bestModel(atk);
          return <M2Stat key={atk} label={`Best model (${ATKLABELS[i]})`} value={bm.name} color={bm.color} sub={`survival gain: ${bm.gain.toFixed(1)} neurons`}/>;
        })}
      </div>
      {anyHarmed&&<div className="rounded-lg p-3 mb-4 text-sm" style={{background:"rgba(255,68,68,0.08)",border:"1px solid #ff444444",color:"#ff8888"}}>⚠️ Warning: At some parameter settings, the magic model worsened the cascade — preventing absorber overload is critical.</div>}
      <p className="text-sm leading-relaxed max-w-3xl" style={{color:"#8ab0cc",lineHeight:1.9}}>
        {alsBest.name!=="no gain"?`✅ In ALS attack, ${alsBest.name} gave the best result, saving ${alsBest.gain.toFixed(1)} additional neurons.`:`⚠️ In ALS attack, no magic model showed meaningful improvement.`}{" "}
        {overallPositive?"Effect was positive across all three attack modes — this is a general finding, not ALS-specific.":"Effect depended on attack type — magic balancing does not work equally for all scenarios."}{" "}
        {`Best pulse fraction: ${bestPF.pf} (gain=${bestPF.gain.toFixed(1)} in ALS attack).`}{" "}
        {anyHarmed?"⚠️ At high pulse_fraction, absorbers became overloaded and cascade worsened — important phase transition.":"Absorbers remained stable across all parameter settings."}
      </p>
      <div className="mt-4 rounded-lg p-3 text-xs leading-relaxed" style={{background:"rgba(0,0,0,0.3)",color:"#3a5570"}}>
        <span style={{color:"#00e5ff"}}>Important limitations: </span>
        This is a simulation on a simplified connectome model, not an ALS treatment model. Magic balancing refers to symmetry-constrained load redistribution. Results require biological validation.
        <br/><span style={{color:"#00e5ff"}}>Next (Phase 3): </span>Does this effect persist in a temporal degeneration model (gradual, not instantaneous)?
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Phase2MagicBalancing() {
  const [pulseFrac,     setPulseFrac]     = useState(0.10);
  const [absorberBoost, setAbsorberBoost] = useState(1.2);
  const [activeAtk,     setActiveAtk]     = useState<"als"|"hub"|"random">("als");
  const [results,       setResults]       = useState<ExperimentData|null>(null);
  const [running,       setRunning]       = useState(false);

  const absorbers=DEFAULT_ABSORBERS;

  const run=()=>{
    setRunning(true); setResults(null);
    setTimeout(()=>{
      const seeds=Array.from({length:20},(_,i)=>i+1);
      setResults(runExperiment(absorbers,pulseFrac,absorberBoost,seeds));
      setRunning(false);
    },50);
  };

  const R=results,atk=activeAtk;
  const timelineSeries: ChartSeries[] = R?[
    {label:"baseline",data:R.results[atk].base.timeline,    color:MODEL_COLORS[0],bold:false,dash:true},
    {label:"topo",    data:R.results[atk].topo.timeline,    color:MODEL_COLORS[1],bold:false},
    {label:"pulse",   data:R.results[atk].pulse.timeline,   color:MODEL_COLORS[2],bold:true},
    {label:"combined",data:R.results[atk].combined.timeline,color:MODEL_COLORS[3],bold:true},
  ]:[];
  const barGroups: BarGroup[] = R?[
    {label:"ALS",    values:[R.results.als.base.finalAlive,R.results.als.topo.finalAlive,R.results.als.pulse.finalAlive,R.results.als.combined.finalAlive]},
    {label:"Hub",    values:[R.results.hub.base.finalAlive,R.results.hub.topo.finalAlive,R.results.hub.pulse.finalAlive,R.results.hub.combined.finalAlive]},
    {label:"Random", values:[R.results.random.base.finalAlive,R.results.random.topo.finalAlive,R.results.random.pulse.finalAlive,R.results.random.combined.finalAlive]},
  ]:[];

  return (
    <div className="space-y-4 font-mono text-[#b0c8e0]">
      <div>
        <div style={{fontSize:9,letterSpacing:5,color:"#ffd700",marginBottom:4}}>PHASE 2 — MAGIC BALANCING HYPOTHESIS TEST</div>
        <h2 className="text-xl font-black mb-1" style={{background:"linear-gradient(100deg,#00e5ff,#a8ff78 40%,#ffd700)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Can Magic-Inspired Balancing Reduce Cascade?
        </h2>
        <p style={{fontSize:11,color:"#3a5570",maxWidth:600}}>
          Three models vs baseline — all on the same C. elegans connectome.
          This is a <span style={{color:"#ffd700"}}>hypothesis test</span>, not a therapeutic claim.
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        {/* sidebar */}
        <div className="flex flex-col gap-3" style={{minWidth:185,maxWidth:200}}>
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>PARAMS</div>
            <div>
              <div style={{fontSize:10,color:"#3a5570",marginBottom:3}}>Pulse fraction: <span style={{color:"#a8ff78",fontWeight:700}}>{Math.round(pulseFrac*100)}%</span></div>
              <input type="range" min={0.05} max={0.30} step={0.05} value={pulseFrac} onChange={e=>setPulseFrac(parseFloat(e.target.value))} className="w-full" style={{accentColor:"#a8ff78"}}/>
            </div>
            <div style={{height:8}}/>
            <div>
              <div style={{fontSize:10,color:"#3a5570",marginBottom:3}}>Absorber boost: <span style={{color:"#ff9944",fontWeight:700}}>×{absorberBoost.toFixed(1)}</span></div>
              <input type="range" min={1.0} max={2.0} step={0.1} value={absorberBoost} onChange={e=>setAbsorberBoost(parseFloat(e.target.value))} className="w-full" style={{accentColor:"#ff9944"}}/>
            </div>
            <div style={{marginTop:12,fontSize:9,color:"#3a5570"}}>
              Absorbers (Phase 1 protective nodes):
              {absorbers.map((id,i)=><div key={i} style={{color:TYPE_COLORS[NODE_TYPES[id]],marginTop:3,fontSize:10}}>{NEURON_NAMES[id]} ({TYPE_LABELS[NODE_TYPES[id]]})</div>)}
            </div>
            <button onClick={run} disabled={running} className="w-full mt-3 rounded-lg py-2.5 font-bold font-mono cursor-pointer" style={{fontSize:12,letterSpacing:1,background:running?"#162030":"rgba(255,215,0,0.08)",border:`1px solid ${running?"#162030":"#ffd700"}`,color:running?"#3a5570":"#ffd700"}}>
              {running?"⏳ Running...":"▶ RUN PHASE 2"}
            </button>
          </div>

          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>ATTACK MODE</div>
            {([["als","ALS attack","#ff4444"],["hub","Hub attack","#ffd700"],["random","Random (×20)","#00e5ff"]] as const).map(([k,l,col])=>(
              <button key={k} onClick={()=>setActiveAtk(k)} className="w-full mb-1 rounded text-left font-mono cursor-pointer" style={{padding:"6px 8px",fontSize:9,background:activeAtk===k?`${col}18`:"transparent",border:`1px solid ${activeAtk===k?col:"#162030"}`,color:activeAtk===k?col:"#3a5570"}}>{l}</button>
            ))}
          </div>

          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>MODELS</div>
            {MODEL_LABELS.map((l,i)=><div key={i} className="flex items-center gap-2 mb-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background:MODEL_COLORS[i]}}/><div style={{fontSize:9,color:MODEL_COLORS[i]}}>{l}</div></div>)}
            <div style={{marginTop:8,fontSize:8,color:"#3a5570",lineHeight:1.5}}>Lo Shu (3×3):<br/>8 1 6 / 3 5 7 / 4 9 2<br/>sum=15 per row/col/diag</div>
          </div>
        </div>

        {/* main panel */}
        <div className="flex-1 flex flex-col gap-3" style={{minWidth:300}}>
          {R&&(<>
            <div className="grid grid-cols-4 gap-2">
              {(["base","topo","pulse","combined"] as const).map((k,i)=>{
                const res=R.results[atk][k],base=R.results[atk].base.finalAlive,gain=res.finalAlive-base;
                return <M2Stat key={k} label={["Baseline","Topo Magic","Dyn. Pulse","Combined"][i]} value={`${res.finalAlive.toFixed(1)}/${N}`} color={MODEL_COLORS[i]} sub={i===0?"baseline":`${gain>=0?"+":""}${gain.toFixed(1)} vs base`}/>;
              })}
            </div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}><M2GroupedBarChart groups={barGroups} width={520} height={170}/></div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}>
              <M2LineChart series={timelineSeries} height={120} width={520} title={`CASCADE TIMELINE — ${atk.toUpperCase()} attack`}/>
              <div className="flex gap-3 mt-2 flex-wrap">
                {MODEL_LABELS.map((l,i)=><span key={i} className="flex items-center gap-1" style={{fontSize:9,color:MODEL_COLORS[i]}}><span className="inline-block w-3" style={{height:2,background:MODEL_COLORS[i]}}/>{l}</span>)}
              </div>
            </div>
            <div className="rounded-xl p-4 border border-[#162030]" style={{background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>PARAMETER SWEEP (ALS attack)</div>
              <div className="grid grid-cols-2 gap-4 overflow-x-auto">
                <M2SweepChart data={R.pfSweep} xKey="pf" xLabel="pulse fraction" title="PULSE FRACTION vs SURVIVAL GAIN" width={245} height={140}/>
                <M2SweepChart data={R.boostSweep} xKey="ab" xLabel="absorber boost" title="ABSORBER BOOST vs SURVIVAL GAIN" width={245} height={140}/>
              </div>
            </div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>RESULTS TABLE</div>
              <table className="w-full font-mono" style={{borderCollapse:"collapse",fontSize:10}}>
                <thead><tr>{["Attack","Model","Alive","Dead","Depth","Survival%","Gain"].map(h=><th key={h} style={{textAlign:"left",color:"#3a5570",padding:"4px 8px",borderBottom:"1px solid #162030",fontSize:8,letterSpacing:1}}>{h}</th>)}</tr></thead>
                <tbody>
                  {(["als","hub","random"] as const).flatMap(a=>(["base","topo","pulse","combined"] as const).map((m,mi)=>{
                    const res=R.results[a][m],base=R.results[a].base.finalAlive,gain=res.finalAlive-base;
                    return (<tr key={`${a}-${m}`} style={{background:mi===0?"rgba(255,255,255,0.02)":"transparent"}}>
                      <td style={{padding:"3px 8px",color:"#4a6a8a"}}>{mi===0?a.toUpperCase():""}</td>
                      <td style={{padding:"3px 8px",color:MODEL_COLORS[mi],fontWeight:mi===0?400:700}}>{MODEL_LABELS[mi]}</td>
                      <td style={{padding:"3px 8px",color:MODEL_COLORS[mi]}}>{res.finalAlive.toFixed(1)}</td>
                      <td style={{padding:"3px 8px",color:"#ff4444"}}>{res.totalDead.toFixed(1)}</td>
                      <td style={{padding:"3px 8px",color:"#3a5570"}}>{res.depth.toFixed(1)}</td>
                      <td style={{padding:"3px 8px",color:"#00e5ff"}}>{(res.survivalRate*100).toFixed(1)}%</td>
                      <td style={{padding:"3px 8px",color:gain>0?"#a8ff78":gain<-0.5?"#ff4444":"#3a5570"}}>{mi===0?"—":`${gain>=0?"+":""}${gain.toFixed(1)}`}</td>
                    </tr>);
                  }))}
                </tbody>
              </table>
            </div>
            <M2ResearchFinding data={R}/>
          </>)}
          {!R&&<div className="h-72 flex items-center justify-center text-xs tracking-widest border rounded-2xl" style={{color:"#162030",borderColor:"#162030",borderStyle:"dashed"}}>PRESS RUN PHASE 2</div>}
        </div>
      </div>
    </div>
  );
}

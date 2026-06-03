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

const NEURON_NAMES: Record<number,string> = {
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
const NODE_TYPES: Record<number,number> = {
  0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:5,9:5,10:5,11:5,
  12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,
  21:2,22:2,23:2,24:2,25:2,26:2,27:2,
  28:3,29:3,30:3,31:3,32:3,33:3,34:3,35:3,36:3,37:3,38:3,
  39:1,40:1,41:1,42:1,43:1,44:2,45:2,46:2,47:2,48:2,
  49:4,50:4,51:4,52:4,53:4,54:4,55:5,56:5,57:5,58:5,59:5,60:5,
};
const TYPE_COLORS = ["#00e5ff","#ff4444","#ffd700","#a855f7","#a8ff78","#6688cc"];
const TYPE_LABELS  = ["Command","Motor-A","Motor-B","Motor-D","Sensory","Interneuron"];
const BOOST_LEVELS = [0, 0.10, 0.20, 0.50];
const BOOST_LABELS = ["Baseline","Boost +10%","Boost +20%","Boost +50%"];
const BOOST_COLORS = ["#3a5570","#a8ff78","#ffd700","#ff4444"];
const ATTACK_MODES  = ["als","hub","random"] as const;
const ATTACK_LABELS = ["ALS attack","Hub attack","Random attack"];
const ATTACK_COLORS = ["#ff4444","#ffd700","#00e5ff"];
const N = 61;

// ─── Graph ────────────────────────────────────────────────────────────────────
const ADJ_PN = (() => {
  const adj: number[][]=Array.from({length:N},()=>[]);
  for (const [a,b] of EDGES){adj[a].push(b);adj[b].push(a);}
  return adj.map(nb=>[...new Set(nb)]);
})();
const BASE_CAP_PN = ADJ_PN.map(nb=>Math.max(nb.length,1));

function seededRng(seed:number):()=>number {
  let s=seed>>>0; return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}
function getAttackedPN(mode:"als"|"hub"|"random"):number[] {
  if(mode==="als") return Object.keys(NODE_TYPES).filter(i=>NODE_TYPES[+i]===1).map(Number).slice(0,3);
  if(mode==="hub") return [...Array(N).keys()].sort((a,b)=>ADJ_PN[b].length-ADJ_PN[a].length).slice(0,3);
  const rng=seededRng(42); return [...Array(N).keys()].sort(()=>rng()-.5).slice(0,3);
}

// ─── Cascade ──────────────────────────────────────────────────────────────────
interface CascadeResult { finalAlive:number; totalDead:number; depth:number; timeline:number[]; }
function runCascadePN(attacked:number[], boosted:number, boostFactor:number): CascadeResult {
  const cap=new Float64Array(BASE_CAP_PN);
  if(boosted>=0) cap[boosted]*=(1+boostFactor);
  const load=new Float64Array(N);
  for (let i=0;i<N;i++) load[i]=cap[i];
  const alive=new Uint8Array(N).fill(1);
  for (const nd of attacked) alive[nd]=0;
  let queue=[...attacked],depth=0;
  const timeline=[alive.reduce((s,v)=>s+v,0)];
  for (let step=0;step<80;step++) {
    const dying:number[]=[];
    for (const dead of queue) {
      const lnb=ADJ_PN[dead].filter(j=>alive[j]); if(!lnb.length) continue;
      const extra=load[dead]/lnb.length;
      for (const nb of lnb){load[nb]+=extra;if(load[nb]>cap[nb]*1.5&&alive[nb]){alive[nb]=0;dying.push(nb);}}
    }
    queue=dying; timeline.push(alive.reduce((s,v)=>s+v,0));
    if(dying.length) depth=step+1; if(!dying.length) break;
  }
  const fa=alive.reduce((s,v)=>s+v,0);
  return {finalAlive:fa,totalDead:N-fa,depth,timeline};
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
function computeDegreePN():number[] { return ADJ_PN.map(nb=>nb.length); }
function computeBetweennessPN():number[] {
  const bc=new Float64Array(N);
  for (let s=0;s<N;s++) {
    const stack:number[]=[],pred:number[][]=Array.from({length:N},()=>[]);
    const sigma=new Float64Array(N),dist=new Int32Array(N).fill(-1);
    sigma[s]=1;dist[s]=0;const q=[s];
    for (let qi=0;qi<q.length;qi++){const v=q[qi];stack.push(v);for(const w of ADJ_PN[v]){if(dist[w]<0){q.push(w);dist[w]=dist[v]+1;}if(dist[w]===dist[v]+1){sigma[w]+=sigma[v];pred[w].push(v);}}}
    const delta=new Float64Array(N);
    while(stack.length){const w=stack.pop()!;for(const v of pred[w])delta[v]+=(sigma[v]/sigma[w])*(1+delta[w]);if(w!==s)bc[w]+=delta[w];}
  }
  const f=(N-1)*(N-2);
  return Array.from(bc).map(v=>f>0?v/f:0);
}

const DEGREE_PN = computeDegreePN();
const BTWN_PN   = computeBetweennessPN();

// ─── Experiment ───────────────────────────────────────────────────────────────
interface NeuronRecord {
  id:number; name:string; type:number; degree:number; btwn:number;
  scores:Record<string,number[]>; details:Record<string,CascadeResult[]>;
  aggScore:number; absorbRatio:number; isHub:boolean;
}
interface ProtectionResults {
  neurons:NeuronRecord[]; ranked:NeuronRecord[];
  baselines:Record<string,CascadeResult>;
  corrDeg:number; corrBtwn:number; corrAbs:number;
  hubProtectors:NeuronRecord[]; nonHubProtectors:NeuronRecord[]; outliers:NeuronRecord[];
}
function pearsonRPN(x:number[],y:number[]):number {
  const n=x.length,mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;
  const num=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0);
  const dx=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0));
  const dy=Math.sqrt(y.reduce((s,v)=>s+(v-my)**2,0));
  return dx*dy<1e-12?0:num/(dx*dy);
}
function runProtectionExperiment():ProtectionResults {
  const baselines:Record<string,CascadeResult>={};
  for (const mode of ATTACK_MODES) baselines[mode]=runCascadePN(getAttackedPN(mode),-1,0);
  const neurons=Array.from({length:N},(_,i)=>{
    const scores:Record<string,number[]>={},details:Record<string,CascadeResult[]>={};
    for (const mode of ATTACK_MODES) {
      const attacked=getAttackedPN(mode);
      scores[mode]=[0]; details[mode]=[baselines[mode]];
      for (let bi=1;bi<BOOST_LEVELS.length;bi++){
        const res=runCascadePN(attacked,i,BOOST_LEVELS[bi]);
        scores[mode].push(baselines[mode].totalDead-res.totalDead);
        details[mode].push(res);
      }
    }
    const aggScore=ATTACK_MODES.reduce((s,m)=>s+Math.max(0,scores[m][BOOST_LEVELS.length-1]),0)/ATTACK_MODES.length;
    const absorbRatio=DEGREE_PN[i]>0?aggScore/DEGREE_PN[i]:aggScore;
    return {id:i,name:NEURON_NAMES[i],type:NODE_TYPES[i],degree:DEGREE_PN[i],btwn:BTWN_PN[i],scores,details,aggScore,absorbRatio,isHub:DEGREE_PN[i]>=8};
  });
  const ranked=[...neurons].sort((a,b)=>b.aggScore-a.aggScore);
  const aggScores=neurons.map(n=>n.aggScore);
  const corrDeg=pearsonRPN(neurons.map(n=>n.degree),aggScores);
  const corrBtwn=pearsonRPN(neurons.map(n=>n.btwn),aggScores);
  const corrAbs=pearsonRPN(neurons.map(n=>n.absorbRatio),aggScores);
  const hubProtectors=ranked.filter(n=>n.isHub&&n.aggScore>0).slice(0,5);
  const nonHubProtectors=ranked.filter(n=>!n.isHub&&n.aggScore>0).slice(0,5);
  const arArr=neurons.map(n=>n.absorbRatio);
  const arMean=arArr.reduce((a,b)=>a+b,0)/N;
  const arStd=Math.sqrt(arArr.reduce((s,v)=>s+(v-arMean)**2,0)/N);
  const outliers=neurons.filter(n=>n.absorbRatio>arMean+1.5*arStd).sort((a,b)=>b.absorbRatio-a.absorbRatio);
  return {neurons,ranked,baselines,corrDeg,corrBtwn,corrAbs,hubProtectors,nonHubProtectors,outliers};
}

// ─── SVG Charts ───────────────────────────────────────────────────────────────
function PNBarChart({items,width=520,height=190,title,yLabel}:{items:Array<{label:string;value:number;color:string}>;width?:number;height?:number;title?:string;yLabel?:string}) {
  if(!items.length) return null;
  const pad={t:24,r:12,b:52,l:36};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const maxV=Math.max(...items.map(d=>d.value),0.01),minV=Math.min(...items.map(d=>d.value),0),span=maxV-minV||1;
  const bw=(W/items.length)*0.72,gap=W/items.length;
  const ty=(v:number)=>H-((v-minV)/span)*H;
  return (<svg width={width} height={height} style={{display:"block"}}>
    {title&&<text x={pad.l+W/2} y={15} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
    <g transform={`translate(${pad.l},${pad.t})`}>
      <line x1={0} x2={W} y1={ty(0)} y2={ty(0)} stroke="#1a3050" strokeWidth={1}/>
      {[0,0.5,1].map(f=>(<g key={f}><line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/><text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={7} fill="#3a5570">{(minV+f*span).toFixed(1)}</text></g>))}
      {yLabel&&<text x={-28} y={H/2} textAnchor="middle" fontSize={8} fill="#4a6a8a" transform={`rotate(-90,-28,${H/2})`}>{yLabel}</text>}
      {items.map((d,i)=>{
        const x=i*gap+gap/2-bw/2,bh=Math.abs(ty(d.value)-ty(0))||2;
        return (<g key={i}>
          <rect x={x} y={d.value>=0?ty(d.value):ty(0)} width={bw} height={bh} fill={d.color} rx={2} opacity={0.85}/>
          {d.value>0&&<text x={x+bw/2} y={ty(d.value)-3} textAnchor="middle" fontSize={7} fill={d.color}>{d.value.toFixed(1)}</text>}
          <text x={x+bw/2} y={H+14} textAnchor="middle" fontSize={7.5} fill={d.color} transform={`rotate(-38,${x+bw/2},${H+14})`}>{d.label}</text>
        </g>);
      })}
    </g>
  </svg>);
}

function PNScatterPlot({xData,yData,xLabel,yLabel,title,width=250,height=190,colors,rValue}:{xData:number[];yData:number[];xLabel?:string;yLabel?:string;title?:string;width?:number;height?:number;colors?:string[];rValue?:number}) {
  const pad={t:22,r:10,b:30,l:38};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  if(!xData.length) return null;
  const xMin=Math.min(...xData),xMax=Math.max(...xData)||1,yMin=Math.min(...yData),yMax=Math.max(...yData)||1;
  const tx=(v:number)=>((v-xMin)/(xMax-xMin||1))*W;
  const ty=(v:number)=>H-((v-yMin)/(yMax-yMin||1))*H;
  const mx=xData.reduce((a,b)=>a+b,0)/xData.length,my=yData.reduce((a,b)=>a+b,0)/yData.length;
  const m=xData.reduce((s,v,i)=>s+(v-mx)*(yData[i]-my),0)/(xData.reduce((s,v)=>s+(v-mx)**2,0)||1);
  const b=my-m*mx;
  return (<svg width={width} height={height} style={{display:"block"}}>
    {title&&<text x={pad.l+W/2} y={14} textAnchor="middle" fontSize={9} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
    <g transform={`translate(${pad.l},${pad.t})`}>
      {[0,0.5,1].map(f=>(<g key={f}><line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/><line x1={W*f} x2={W*f} y1={0} y2={H} stroke="#0f1e30" strokeWidth={1}/><text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={7} fill="#3a5570">{(yMin+f*(yMax-yMin)).toFixed(1)}</text><text x={W*f} y={H+14} textAnchor="middle" fontSize={7} fill="#3a5570">{(xMin+f*(xMax-xMin)).toFixed(xMax-xMin<5?1:0)}</text></g>))}
      {xLabel&&<text x={W/2} y={H+26} textAnchor="middle" fontSize={8} fill="#4a6a8a">{xLabel}</text>}
      {yLabel&&<text x={-28} y={H/2} textAnchor="middle" fontSize={8} fill="#4a6a8a" transform={`rotate(-90,-28,${H/2})`}>{yLabel}</text>}
      <line x1={tx(xMin)} y1={ty(m*xMin+b)} x2={tx(xMax)} y2={ty(m*xMax+b)} stroke="#fff" strokeWidth={1} opacity={0.15} strokeDasharray="4,3"/>
      {rValue!=null&&<text x={W-2} y={10} textAnchor="end" fontSize={9} fill={Math.abs(rValue)>0.5?"#ffd700":"#3a5570"} fontWeight="bold">r={rValue.toFixed(2)}</text>}
      {xData.map((x,i)=><circle key={i} cx={tx(x)} cy={ty(yData[i])} r={4} fill={colors?colors[i]:"#00e5ff"} opacity={0.8}/>)}
    </g>
  </svg>);
}

function PNLineChart({series,height=90,width=320,title}:{series:Array<{label:string;data:number[];color:string;bold?:boolean;dim?:boolean;dash?:boolean}>;height?:number;width?:number;title?:string}) {
  const pad={t:22,r:12,b:18,l:36};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const all=series.flatMap(s=>s.data).filter(v=>v!=null&&isFinite(v));
  if(!all.length) return null;
  const yMin=Math.min(...all),yMax=Math.max(...all)||1;
  const xLen=Math.max(...series.map(s=>s.data.length),2);
  const tx=(i:number)=>(i/Math.max(xLen-1,1))*W;
  const ty=(v:number)=>H-((v-yMin)/(yMax-yMin||1))*H;
  const mkPath=(d:number[])=>d.map((v,i)=>v!=null?`${i===0?"M":"L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`:"").filter(Boolean).join(" ");
  return (<svg width={width} height={height} style={{display:"block"}}>
    {title&&<text x={pad.l+W/2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
    <g transform={`translate(${pad.l},${pad.t})`}>
      {[0,0.5,1].map(f=>(<g key={f}><line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/><text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={8} fill="#3a5570">{Math.round(yMin+f*(yMax-yMin))}</text></g>))}
      {series.map(s=><path key={s.label} d={mkPath(s.data)} fill="none" stroke={s.color} strokeWidth={s.bold?2.5:1.5} strokeLinejoin="round" opacity={s.dim?0.35:1} strokeDasharray={s.dash?"5,3":"none"}/>)}
    </g>
  </svg>);
}

function PNHeatmap({neurons,attackMode,width=520,height=160}:{neurons:NeuronRecord[];attackMode:string;width?:number;height?:number}) {
  const top20=[...neurons].sort((a,b)=>b.aggScore-a.aggScore).slice(0,20);
  const pad={t:20,r:10,b:38,l:16};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const cw=W/top20.length,rh=H/BOOST_LEVELS.length;
  const allScores=top20.flatMap(n=>BOOST_LEVELS.map((_,bi)=>n.scores[attackMode]?.[bi]||0));
  const maxS=Math.max(...allScores,0.01);
  const heatColor=(v:number)=>{if(v<=0)return "#0a1520";const t=v/maxS;return `rgb(${Math.round(20+t*230)},${Math.round(30+t*180)},${Math.round(80-t*60)})`;}
  return (<svg width={width} height={height} style={{display:"block"}}>
    <text x={pad.l+W/2} y={13} textAnchor="middle" fontSize={9} fill="#5a7a9a" letterSpacing={1}>PROTECTION HEATMAP — {attackMode.toUpperCase()} attack (top 20 × boost level)</text>
    <g transform={`translate(${pad.l},${pad.t})`}>
      {top20.map((n,i)=>BOOST_LEVELS.map((_,bi)=><rect key={`${i}-${bi}`} x={i*cw+1} y={bi*rh+1} width={cw-2} height={rh-2} fill={heatColor(n.scores[attackMode]?.[bi]||0)} rx={2}/>))}
      {top20.map((n,i)=><text key={i} x={i*cw+cw/2} y={H+16} textAnchor="middle" fontSize={7} fill={TYPE_COLORS[n.type]} transform={`rotate(-40,${i*cw+cw/2},${H+16})`}>{n.name}</text>)}
      {BOOST_LEVELS.map((bl,bi)=><text key={bi} x={-4} y={bi*rh+rh/2+4} textAnchor="end" fontSize={7} fill="#3a5570">+{Math.round(bl*100)}%</text>)}
    </g>
  </svg>);
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function PNStat({label,value,color,sub,big}:{label:string;value:string;color:string;sub?:string;big?:boolean}) {
  return (<div className="rounded-xl p-3" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${color}22`}}>
    <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,textTransform:"uppercase"}}>{label}</div>
    <div className="font-mono font-black leading-tight" style={{fontSize:big?22:16,color}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:"#1e3050",marginTop:2}}>{sub}</div>}
  </div>);
}

function NeuronCard({node,rank,showAbsorb}:{node:NeuronRecord;rank:number;showAbsorb?:boolean}) {
  const col=TYPE_COLORS[node.type];
  return (<div className="rounded-xl p-3" style={{background:`${col}0c`,border:`1px solid ${col}33`}}>
    <div className="flex items-center gap-2 mb-1.5">
      <div style={{fontSize:12,color:"#3a5570",fontFamily:"monospace",minWidth:18}}>#{rank}</div>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:col}}/>
      <div style={{fontSize:13,fontWeight:700,color:col}}>{node.name}</div>
      <div style={{fontSize:9,color:"#3a5570",marginLeft:"auto"}}>{TYPE_LABELS[node.type]}</div>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      <div style={{fontSize:10,color:"#3a5570"}}>Score: <span style={{color:col,fontWeight:700}}>{node.aggScore.toFixed(2)}</span></div>
      <div style={{fontSize:10,color:"#3a5570"}}>Degree: <span style={{color:"#00e5ff"}}>{node.degree}</span></div>
      {showAbsorb&&<div style={{fontSize:10,color:"#3a5570"}}>Absorb ratio: <span style={{color:"#ff9944",fontWeight:700}}>{node.absorbRatio.toFixed(2)}</span></div>}
      <div style={{fontSize:10,color:"#3a5570"}}>{node.isHub?"🔴 Hub":"⚪ Non-hub"}</div>
    </div>
    <div className="flex gap-1 mt-2">
      {ATTACK_MODES.map((m,i)=><div key={m} className="flex-1 text-center rounded" style={{fontSize:8,background:`${ATTACK_COLORS[i]}15`,padding:"3px 2px"}}><div style={{color:ATTACK_COLORS[i],fontWeight:700}}>+{Math.max(0,node.scores[m]?.[3]??0).toFixed(1)}</div><div style={{color:"#3a5570"}}>{ATTACK_LABELS[i].split(" ")[0]}</div></div>)}
    </div>
  </div>);
}

// ─── Research Finding ─────────────────────────────────────────────────────────
function PNResearchFinding({data}:{data:ProtectionResults}) {
  const {ranked,corrDeg,corrBtwn,corrAbs,hubProtectors,nonHubProtectors,outliers,baselines}=data;
  const top1=ranked[0],topHub=hubProtectors[0],topNonHub=nonHubProtectors[0];
  const hubBetter=topHub&&topNonHub&&topHub.aggScore>topNonHub.aggScore;
  const degCorr=Math.abs(corrDeg)>0.5;
  const absCorr=corrAbs>corrDeg+0.1;
  return (
    <div className="rounded-2xl p-5" style={{background:"rgba(168,255,120,0.04)",border:`1px solid ${top1.aggScore>3?"#a8ff7855":"#ffd70044"}`}}>
      <div className="text-xs font-bold mb-4" style={{color:"#a8ff78",letterSpacing:2}}>PHASE 1C — RESEARCH FINDING</div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <PNStat label="Top protector" value={top1.name} color={TYPE_COLORS[top1.type]} sub={`score=${top1.aggScore.toFixed(2)}, ${TYPE_LABELS[top1.type]}`}/>
        <PNStat label="Degree corr." value={`r=${corrDeg.toFixed(3)}`} color={degCorr?"#ffd700":"#3a5570"} sub={degCorr?"hubs protect":"weak relationship"}/>
        <PNStat label="Absorb ratio corr." value={`r=${corrAbs.toFixed(3)}`} color={absCorr?"#ff9944":"#3a5570"} sub={absCorr?"low-degree protects better":"hubs dominate"}/>
        <PNStat label="Outliers" value={`${outliers.length}`} color="#ff9944" sub={outliers.slice(0,2).map(o=>o.name).join(", ")}/>
      </div>
      <p className="text-sm leading-relaxed max-w-3xl" style={{color:"#8ab0cc",lineHeight:1.9}}>
        {top1.aggScore>0?`✅ ${top1.name} (${TYPE_LABELS[top1.type]}) was the strongest protective neuron — boosting its capacity prevented an average of ${top1.aggScore.toFixed(1)} secondary deaths.`:`⚠️ No effective protective neuron found — this network topology is resistant to capacity boosts.`}{" "}
        {hubBetter?`Hub neurons (e.g. ${topHub?.name}) provided more protection than non-hub neurons — hubs both cause and absorb damage.`:`Non-hub neurons (e.g. ${topNonHub?.name}) provided more protection relative to their degree — better candidates for neuroprotection.`}{" "}
        {outliers.length>0&&`${outliers[0].name} was an outlier: protection score exceeded expectation from its degree — likely has a special structural role.`}{" "}
        <span style={{color:"#3a5570"}}>(baseline ALS: {baselines.als.totalDead} dead, hub: {baselines.hub.totalDead} dead, random: {baselines.random.totalDead} dead)</span>
      </p>
      <div className="mt-4 rounded-lg p-3 text-xs leading-relaxed" style={{background:"rgba(0,0,0,0.3)",color:"#3a5570"}}>
        <span style={{color:"#00e5ff"}}>Next step (Phase 2): </span>
        Are the synapses connected to these protective neurons fragile? Edge fragility analysis could reveal whether protecting these neurons requires connection preservation or direct capacity increase.
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Phase8ProtectiveNodes() {
  const [results,     setResults]     = useState<ProtectionResults|null>(null);
  const [running,     setRunning]     = useState(false);
  const [activeAtk,   setActiveAtk]   = useState<"als"|"hub"|"random">("als");
  const [activeBoost, setActiveBoost] = useState(3);
  const [viewMode,    setViewMode]    = useState<"top10"|"hub"|"nonhub"|"outlier">("top10");

  const run=()=>{
    setRunning(true); setResults(null);
    setTimeout(()=>{ setResults(runProtectionExperiment()); setRunning(false); },40);
  };
  const R=results;
  const nodeColors=R?R.neurons.map(n=>TYPE_COLORS[n.type]):[];
  const displayNodes=R?(
    viewMode==="hub"?R.ranked.filter(n=>n.isHub).slice(0,10):
    viewMode==="nonhub"?R.ranked.filter(n=>!n.isHub).slice(0,10):
    viewMode==="outlier"?R.outliers.slice(0,10):R.ranked.slice(0,10)
  ):[];
  const metricKeys=["degree","btwn"] as const;

  return (
    <div className="space-y-4 font-mono text-[#b0c8e0]">
      <div>
        <div style={{fontSize:9,letterSpacing:5,color:"#a8ff78",marginBottom:4}}>PHASE 1C — PROTECTIVE NODE ANALYSIS</div>
        <h2 className="text-xl font-black mb-1" style={{background:"linear-gradient(100deg,#a8ff78,#00e5ff 45%,#ffd700)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Which Neurons Stabilize the Network?
        </h2>
        <p style={{fontSize:11,color:"#3a5570",maxWidth:600}}>
          Each neuron is boosted by +10%, +20%, +50% capacity.
          Key question: <span style={{color:"#ffd700"}}>Do the hubs that cause damage also provide protection?</span>
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        {/* sidebar */}
        <div className="flex flex-col gap-3" style={{minWidth:185,maxWidth:200}}>
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>EXPERIMENT</div>
            <div style={{fontSize:10,color:"#3a5570",lineHeight:1.8,marginBottom:14}}>61 neurons × 3 boost levels<br/>× 3 attack modes<br/>= 549 cascade simulations<br/>+ baseline comparisons</div>
            <button onClick={run} disabled={running} className="w-full rounded-lg py-2.5 font-bold font-mono cursor-pointer" style={{fontSize:12,letterSpacing:1,background:running?"#162030":"rgba(168,255,120,0.1)",border:`1px solid ${running?"#162030":"#a8ff78"}`,color:running?"#3a5570":"#a8ff78"}}>
              {running?"⏳ Running 549...":"▶ RUN PHASE 1C"}
            </button>
          </div>
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>ATTACK MODE</div>
            {ATTACK_MODES.map((m,i)=><button key={m} onClick={()=>setActiveAtk(m)} className="w-full mb-1 rounded text-left font-mono cursor-pointer" style={{padding:"6px 8px",fontSize:9,background:activeAtk===m?`${ATTACK_COLORS[i]}18`:"transparent",border:`1px solid ${activeAtk===m?ATTACK_COLORS[i]:"#162030"}`,color:activeAtk===m?ATTACK_COLORS[i]:"#3a5570"}}>{ATTACK_LABELS[i]}</button>)}
          </div>
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>BOOST LEVEL</div>
            {BOOST_LEVELS.map((_,i)=><button key={i} onClick={()=>setActiveBoost(i)} className="w-full mb-1 rounded text-left font-mono cursor-pointer" style={{padding:"6px 8px",fontSize:9,background:activeBoost===i?`${BOOST_COLORS[i]}18`:"transparent",border:`1px solid ${activeBoost===i?BOOST_COLORS[i]:"#162030"}`,color:activeBoost===i?BOOST_COLORS[i]:"#3a5570"}}>{BOOST_LABELS[i]}</button>)}
          </div>
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>VIEW</div>
            {([["top10","Top 10 all"],["hub","Hub protectors"],["nonhub","Non-hub heroes"],["outlier","Outliers"]] as const).map(([k,l])=><button key={k} onClick={()=>setViewMode(k)} className="w-full mb-1 rounded text-left font-mono cursor-pointer" style={{padding:"5px 8px",fontSize:9,background:viewMode===k?"rgba(255,255,255,0.06)":"transparent",border:`1px solid ${viewMode===k?"#ffffff33":"#162030"}`,color:viewMode===k?"#fff":"#3a5570"}}>{l}</button>)}
          </div>
        </div>

        {/* main panel */}
        <div className="flex-1 flex flex-col gap-3" style={{minWidth:300}}>
          {R&&(<>
            <div className="grid grid-cols-4 gap-2">
              <PNStat label="Top protector" value={R.ranked[0].name} color={TYPE_COLORS[R.ranked[0].type]} big sub={`+${R.ranked[0].aggScore.toFixed(1)} deaths prevented`}/>
              <PNStat label="Corr w/ degree" value={`r=${R.corrDeg.toFixed(2)}`} color={Math.abs(R.corrDeg)>0.5?"#ffd700":"#3a5570"} sub="protection vs degree"/>
              <PNStat label="Best absorber" value={R.outliers[0]?.name||"—"} color="#ff9944" sub={`absorb ratio=${R.outliers[0]?.absorbRatio.toFixed(2)||"—"}`}/>
              <PNStat label="Hub protectors" value={`${R.hubProtectors.length}`} color="#ff4444" sub="hubs with positive protection"/>
            </div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}>
              <PNBarChart items={R.ranked.slice(0,20).map(n=>({label:n.name,value:n.scores[activeAtk]?.[activeBoost]||0,color:TYPE_COLORS[n.type]}))} width={520} height={190} title={`PROTECTION SCORES — ${ATTACK_LABELS[ATTACK_MODES.indexOf(activeAtk)]} · ${BOOST_LABELS[activeBoost]}`} yLabel="deaths prevented"/>
            </div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}>
              <PNHeatmap neurons={R.neurons} attackMode={activeAtk} width={520} height={160}/>
              <div style={{marginTop:8,fontSize:9,color:"#3a5570"}}>darker = more protection · rows = boost level (+0%, +10%, +20%, +50%)</div>
            </div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>CORRELATION: protection score vs network metrics</div>
              <div className="grid grid-cols-2 gap-3">
                <PNScatterPlot xData={R.neurons.map(n=>n.degree)} yData={R.neurons.map(n=>n.aggScore)} xLabel="Degree" yLabel="Protection score" title="Protection vs Degree" width={250} height={190} colors={nodeColors} rValue={R.corrDeg}/>
                <PNScatterPlot xData={R.neurons.map(n=>n.btwn)} yData={R.neurons.map(n=>n.aggScore)} xLabel="Betweenness" yLabel="Protection score" title="Protection vs Betweenness" width={250} height={190} colors={nodeColors} rValue={R.corrBtwn}/>
              </div>
            </div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>CASCADE TIMELINE: {R.ranked[0].name} — baseline vs boosted</div>
              <PNLineChart series={[
                {label:"baseline",data:R.ranked[0].details[activeAtk][0].timeline,color:"#ff4444",dash:true},
                {label:"+10%",    data:R.ranked[0].details[activeAtk][1].timeline,color:"#a8ff78",dim:true},
                {label:"+20%",    data:R.ranked[0].details[activeAtk][2].timeline,color:"#ffd700",dim:true},
                {label:"+50%",    data:R.ranked[0].details[activeAtk][3].timeline,color:"#00e5ff",bold:true},
              ]} height={100} width={520} title={`alive neurons — ${R.ranked[0].name} boost`}/>
              <div className="flex gap-3 mt-2">
                {[["baseline","#ff4444"],["10%","#a8ff78"],["20%","#ffd700"],["50%","#00e5ff"]].map(([l,col])=><span key={l} className="flex items-center gap-1" style={{fontSize:9,color:col}}><span className="inline-block w-3" style={{height:2,background:col}}/>{l}</span>)}
              </div>
            </div>
            <div className="rounded-xl p-4 border border-[#162030]" style={{background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>
                {viewMode==="top10"?"TOP 10 PROTECTIVE NEURONS":viewMode==="hub"?"HUB PROTECTORS (degree ≥ 8)":viewMode==="nonhub"?"NON-HUB HEROES (low degree, high protection)":"OUTLIERS (absorb ratio >> expected)"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {displayNodes.map((node)=><NeuronCard key={node.id} node={node} rank={R.ranked.indexOf(node)+1} showAbsorb={viewMode==="outlier"}/>)}
              </div>
            </div>
            <div className="rounded-xl p-4 border border-[#162030] overflow-x-auto" style={{background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>FULL RESULTS TABLE</div>
              <div style={{overflowX:"auto",maxHeight:240,overflowY:"auto"}}>
                <table className="w-full font-mono" style={{borderCollapse:"collapse",fontSize:10}}>
                  <thead style={{position:"sticky",top:0,background:"#070d1a"}}>
                    <tr>{["#","Neuron","Type","Prot(ALS)","Prot(Hub)","Prot(Rand)","Avg","Absorb","Deg","Hub"].map(h=><th key={h} style={{textAlign:"left",color:"#3a5570",padding:"4px 8px",borderBottom:"1px solid #162030",fontSize:8,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {R.ranked.map((n,i)=><tr key={i} style={{background:i<5?`${TYPE_COLORS[n.type]}08`:"transparent"}}>
                      <td style={{padding:"3px 8px",color:"#3a5570"}}>{i+1}</td>
                      <td style={{padding:"3px 8px",color:TYPE_COLORS[n.type],fontWeight:i<5?700:400}}>{n.name}</td>
                      <td style={{padding:"3px 8px"}}><span style={{fontSize:8,color:TYPE_COLORS[n.type],border:`1px solid ${TYPE_COLORS[n.type]}44`,borderRadius:4,padding:"1px 5px"}}>{TYPE_LABELS[n.type].split(" ")[0]}</span></td>
                      <td style={{padding:"3px 8px",color:(n.scores.als?.[3]??0)>0?"#a8ff78":"#ff4444"}}>{(n.scores.als?.[3]??0).toFixed(1)}</td>
                      <td style={{padding:"3px 8px",color:(n.scores.hub?.[3]??0)>0?"#a8ff78":"#ff4444"}}>{(n.scores.hub?.[3]??0).toFixed(1)}</td>
                      <td style={{padding:"3px 8px",color:(n.scores.random?.[3]??0)>0?"#a8ff78":"#ff4444"}}>{(n.scores.random?.[3]??0).toFixed(1)}</td>
                      <td style={{padding:"3px 8px",color:"#ffd700",fontWeight:700}}>{n.aggScore.toFixed(2)}</td>
                      <td style={{padding:"3px 8px",color:"#ff9944"}}>{n.absorbRatio.toFixed(2)}</td>
                      <td style={{padding:"3px 8px",color:"#00e5ff"}}>{n.degree}</td>
                      <td style={{padding:"3px 8px",color:n.isHub?"#ff4444":"#3a5570"}}>{n.isHub?"●":"—"}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <PNResearchFinding data={R}/>
          </>)}
          {!R&&<div className="h-72 flex items-center justify-center text-xs tracking-widest border rounded-2xl" style={{color:"#162030",borderColor:"#162030",borderStyle:"dashed"}}>PRESS RUN PHASE 1C — 549 simulations</div>}
        </div>
      </div>
    </div>
  );
}

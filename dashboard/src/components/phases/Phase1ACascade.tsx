"use client";
import { useState, useRef, useEffect } from "react";

// ─── Connectome Data ──────────────────────────────────────────────────────────
const CELEGANS_EDGES: [number,number][] = [
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
const TYPE_LABELS = ["Command IN","Motor-A (ALS target)","Motor-B","Motor-D (inhibitory)","Sensory","Interneuron"];
const TYPE_COLORS = ["#00e5ff","#ff4444","#ffd700","#a855f7","#a8ff78","#6688cc"];
const N = 61;

// ─── Graph ────────────────────────────────────────────────────────────────────
function buildAdjList(edges:[number,number][], n:number): number[][] {
  const adj:number[][]=Array.from({length:n},()=>[]);
  for (const [a,b] of edges){adj[a].push(b);adj[b].push(a);}
  return adj;
}
const ADJ_CAS = buildAdjList(CELEGANS_EDGES, N);
const CAP_CAS = ADJ_CAS.map(nb=>Math.max(nb.length,1));

// ─── Graph Metrics ────────────────────────────────────────────────────────────
function spectralGap(adjList:number[][], iters=80):number {
  const n=adjList.length; if(n<3) return 0;
  const deg=adjList.map(nb=>nb.length);
  const shift=2*Math.max(...deg)+1;
  const u1=new Float64Array(n).fill(1/Math.sqrt(n));
  const dot=(a:Float64Array,b:Float64Array)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const nm=(v:Float64Array)=>Math.sqrt(dot(v,v));
  const defl=(v:Float64Array,u:Float64Array)=>{const d=dot(v,u);return v.map((x,i)=>x-d*u[i]) as Float64Array;};
  const norm=(v:Float64Array)=>{const r=nm(v);return r<1e-12?v:v.map(x=>x/r) as Float64Array;};
  const Lx=(x:Float64Array)=>{const y=new Float64Array(n);for(let i=0;i<n;i++){y[i]=deg[i]*x[i];for(const j of adjList[i])y[i]-=x[j];}return y;};
  let v=norm(defl(Float64Array.from({length:n},(_,i)=>Math.sin(i+1)),u1));
  let l2=0;
  for(let it=0;it<iters;it++){
    const Lv=Lx(v);const w_raw=v.map((x,i)=>shift*x-Lv[i]) as Float64Array;
    const w=defl(w_raw,u1);const r=nm(w);if(r<1e-12)break;
    l2=shift-dot(v,w)/dot(v,v);v=norm(w);
  }
  return Math.max(0,l2);
}
function clusteringCoeff(adjList:number[][]):number {
  const n=adjList.length;let total=0;
  for(let i=0;i<n;i++){const nb=adjList[i],k=nb.length;if(k<2)continue;const nbSet=new Set(nb);let tri=0;for(const u of nb)for(const v of adjList[u])if(v!==i&&nbSet.has(v))tri++;total+=tri/(k*(k-1));}
  return total/n;
}
function avgPathLength(adjList:number[][]):number {
  const n=adjList.length;let td=0,tp=0;
  for(let src=0;src<n;src++){const dist=new Int32Array(n).fill(-1);dist[src]=0;const q=[src];for(let qi=0;qi<q.length;qi++){const u=q[qi];for(const v of adjList[u])if(dist[v]<0){dist[v]=dist[u]+1;q.push(v);}}for(let i=0;i<n;i++)if(dist[i]>0){td+=dist[i];tp++;}}
  return tp>0?td/tp:0;
}

// ─── ALS Cascade Simulation ───────────────────────────────────────────────────
interface CasFrame { step:number; aliveCount:number; deadByType:number[]; snapshot:Uint8Array; }
interface CasResult { history:CasFrame[]; finalAlive:Uint8Array; }
function runALSCascade(adjList:number[][], attackMode:string, steps=50):CasResult {
  const n=adjList.length;
  const cap=adjList.map(nb=>Math.max(nb.length,1));
  const load=new Float64Array(cap);
  const alive=new Uint8Array(n).fill(1);
  const initialDead=attackMode==="als"
    ?Object.keys(NODE_TYPES).filter(i=>NODE_TYPES[+i]===1).map(Number).slice(0,3)
    :attackMode==="hub"
    ?[...Array(n).keys()].sort((a,b)=>adjList[b].length-adjList[a].length).slice(0,3)
    :[...Array(n).keys()].sort(()=>Math.random()-.5).slice(0,3);
  for(const nd of initialDead){alive[nd]=0;}
  let queue=[...initialDead];
  const history:CasFrame[]=[];
  for(let step=0;step<steps;step++){
    const deadByType=[0,0,0,0,0,0];
    for(let i=0;i<n;i++)if(!alive[i])deadByType[NODE_TYPES[i]]++;
    history.push({step,aliveCount:alive.reduce((s,v)=>s+v,0),deadByType:[...deadByType],snapshot:alive.slice() as Uint8Array});
    const dying:number[]=[];
    for(const dead of queue){
      const lnb=adjList[dead].filter(j=>alive[j]);if(!lnb.length)continue;
      const extra=load[dead]/lnb.length;
      for(const nb of lnb){load[nb]+=extra;if(load[nb]>cap[nb]*1.5&&alive[nb]){alive[nb]=0;dying.push(nb);}}
    }
    queue=dying;if(!dying.length)break;
  }
  const deadByType=[0,0,0,0,0,0];
  for(let i=0;i<n;i++)if(!alive[i])deadByType[NODE_TYPES[i]]++;
  history.push({step:history.length,aliveCount:alive.reduce((s,v)=>s+v,0),deadByType,snapshot:alive.slice() as Uint8Array});
  return {history,finalAlive:alive};
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function computeLayout(size=420):{x:number;y:number}[] {
  const cx=size/2,cy=size/2;
  const typeGroups:Record<number,number[]>={};
  for(let i=0;i<N;i++){const t=NODE_TYPES[i];if(!typeGroups[t])typeGroups[t]=[];typeGroups[t].push(i);}
  const pos=new Array<{x:number;y:number}>(N);
  const radii=[60,130,100,155,185,80];
  const angleOffsets=[0,0,Math.PI,Math.PI/2,Math.PI*1.2,Math.PI*0.7];
  for(const [t,nodes] of Object.entries(typeGroups)){
    const ti=+t,r=radii[ti]||120,ao=angleOffsets[ti]||0;
    nodes.forEach((id,idx)=>{const angle=ao+(idx/nodes.length)*Math.PI*2;pos[id]={x:cx+r*Math.cos(angle),y:cy+r*Math.sin(angle)};});
  }
  return pos;
}
const LAYOUT = computeLayout(420);

// ─── SVG Charts ───────────────────────────────────────────────────────────────
interface CasSeries {label:string;data:number[];color:string;bold?:boolean;dim?:boolean;}
function CasLineChart({series,height=90,width=320,title,xLabel}:{series:CasSeries[];height?:number;width?:number;title?:string;xLabel?:string}) {
  const pad={t:22,r:12,b:24,l:38};
  const W=width-pad.l-pad.r,H=height-pad.t-pad.b;
  const all=series.flatMap(s=>s.data).filter(v=>isFinite(v));
  if(!all.length)return null;
  const yMin=Math.min(...all),yMax=Math.max(...all)||1;
  const xLen=Math.max(...series.map(s=>s.data.length),2);
  const tx=(i:number)=>(i/(xLen-1))*W;
  const ty=(v:number)=>H-((v-yMin)/(yMax-yMin||1))*H;
  const mkPath=(d:number[])=>d.filter(v=>v!=null).length<2?"":d.map((v,i)=>v!=null?`${i===0?"M":"L"}${tx(i).toFixed(1)},${ty(v).toFixed(1)}`:"").filter(Boolean).join(" ");
  return (<svg width={width} height={height} style={{display:"block"}}>
    {title&&<text x={pad.l+W/2} y={14} textAnchor="middle" fontSize={10} fill="#5a7a9a" letterSpacing={1}>{title}</text>}
    <g transform={`translate(${pad.l},${pad.t})`}>
      {[0,0.5,1].map(f=>(<g key={f}><line x1={0} x2={W} y1={H*(1-f)} y2={H*(1-f)} stroke="#0f1e30" strokeWidth={1}/><text x={-3} y={H*(1-f)+4} textAnchor="end" fontSize={8} fill="#3a5570">{Math.round(yMin+f*(yMax-yMin))}</text></g>))}
      {xLabel&&<text x={W/2} y={H+18} textAnchor="middle" fontSize={9} fill="#3a5570">{xLabel}</text>}
      {series.map(s=><path key={s.label} d={mkPath(s.data)} fill="none" stroke={s.color} strokeWidth={s.bold?2.5:1.8} strokeLinejoin="round" opacity={s.dim?0.4:1}/>)}
    </g>
  </svg>);
}

// ─── Network Visualizer ───────────────────────────────────────────────────────
function NetworkViz({alive,size=420,step}:{alive:Uint8Array;size?:number;step:number}) {
  return (<svg width={size} height={size} style={{background:"#030810",borderRadius:14,display:"block"}}>
    {CELEGANS_EDGES.map(([a,b],i)=>{
      const aA=alive[a],bA=alive[b];
      if(!aA&&!bA)return null;
      return <line key={i} x1={LAYOUT[a].x} y1={LAYOUT[a].y} x2={LAYOUT[b].x} y2={LAYOUT[b].y} stroke={aA&&bA?"#1a3555":"#2a1515"} strokeWidth={aA&&bA?1:0.5} opacity={aA&&bA?0.6:0.2}/>;
    })}
    {Array.from({length:N},(_,i)=>{
      const isAlive=alive[i];
      const typeColor=TYPE_COLORS[NODE_TYPES[i]];
      const color=isAlive?typeColor:"#1a0808";
      const r=isAlive?(NODE_TYPES[i]<=1?9:7):5;
      return (<g key={i}>
        <circle cx={LAYOUT[i].x} cy={LAYOUT[i].y} r={r} fill={color} opacity={isAlive?0.95:0.25}/>
        <text x={LAYOUT[i].x} y={LAYOUT[i].y+3.5} textAnchor="middle" fontSize={5.5} fill={isAlive?"#fff":"#441111"} fontWeight="bold">{NEURON_NAMES[i]}</text>
      </g>);
    })}
    <text x={10} y={20} fontSize={11} fill="#3a5570" fontFamily="monospace">step {step}</text>
  </svg>);
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function CasStat({label,value,color="#00e5ff",sub}:{label:string;value:string;color?:string;sub?:string}) {
  return (<div className="rounded-xl p-2" style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${color}22`}}>
    <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,textTransform:"uppercase"}}>{label}</div>
    <div className="font-mono font-black leading-tight" style={{fontSize:16,color}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:"#1e3050",marginTop:2}}>{sub}</div>}
  </div>);
}

// ─── Main Component ───────────────────────────────────────────────────────────
type AttackMode = "als"|"random"|"hub";
interface AllSim { als:CasResult; random:CasResult; hub:CasResult; }

// pre-compute metrics (module level, not per render)
const SG  = spectralGap(ADJ_CAS).toFixed(3);
const CC  = clusteringCoeff(ADJ_CAS).toFixed(3);
const APL = avgPathLength(ADJ_CAS).toFixed(2);
const AVG_DEG = (CELEGANS_EDGES.length*2/N).toFixed(1);

export default function Phase1ACascade() {
  const [attackMode, setAttackMode] = useState<AttackMode>("als");
  const [simResult,  setSimResult]  = useState<AllSim|null>(null);
  const [playStep,   setPlayStep]   = useState(0);
  const [playing,    setPlaying]    = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // run all three simulations on mount
  useEffect(()=>{
    const res:AllSim={
      als:    runALSCascade(ADJ_CAS,"als",50),
      random: runALSCascade(ADJ_CAS,"random",50),
      hub:    runALSCascade(ADJ_CAS,"hub",50),
    };
    setSimResult(res);
    setPlayStep(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // playback timer
  useEffect(()=>{
    if(!playing||!simResult)return;
    const maxStep=simResult[attackMode].history.length-1;
    timerRef.current=setInterval(()=>{
      setPlayStep(s=>{if(s>=maxStep){setPlaying(false);return s;}return s+1;});
    },200);
    return()=>{if(timerRef.current)clearInterval(timerRef.current);};
  },[playing,attackMode,simResult]);

  const curHistory=simResult?simResult[attackMode].history:[];
  const curFrame=curHistory[playStep]||{aliveCount:N,snapshot:new Uint8Array(N).fill(1),deadByType:[0,0,0,0,0,0],step:0};

  const alsAlive   =simResult?simResult.als.history.map(h=>h.aliveCount):[];
  const randomAlive=simResult?simResult.random.history.map(h=>h.aliveCount):[];
  const hubAlive   =simResult?simResult.hub.history.map(h=>h.aliveCount):[];
  const motorADead =simResult?simResult.als.history.map(h=>h.deadByType[1]):[];
  const motorBDead =simResult?simResult.als.history.map(h=>h.deadByType[2]):[];
  const commandDead=simResult?simResult.als.history.map(h=>h.deadByType[0]):[];
  const inhibDead  =simResult?simResult.als.history.map(h=>h.deadByType[3]):[];

  const finalALS   =simResult?simResult.als.history[simResult.als.history.length-1]:null;
  const finalRandom=simResult?simResult.random.history[simResult.random.history.length-1]:null;
  const finalHub   =simResult?simResult.hub.history[simResult.hub.history.length-1]:null;

  return (
    <div className="space-y-4 font-mono text-[#b0c8e0]">
      <div>
        <div style={{fontSize:9,letterSpacing:5,color:"#00e5ff",marginBottom:4}}>C. ELEGANS MOTOR CONNECTOME · ALS CASCADE MODEL</div>
        <h2 className="text-xl font-black mb-1" style={{background:"linear-gradient(100deg,#ff4444,#ffd700 40%,#00e5ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          ALS Neurodegeneration Simulation
        </h2>
        <p style={{fontSize:11,color:"#3a5570",maxWidth:600}}>
          Real C. elegans neural network (Varshney 2011) · 61 neurons · 127 synapses.
          In ALS, Motor-A class neurons die first → cascade → paralysis.
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        {/* left: controls + metrics */}
        <div className="flex flex-col gap-3" style={{minWidth:190,maxWidth:205}}>
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>C. ELEGANS MOTOR CIRCUIT</div>
            <div className="flex flex-col gap-2">
              <CasStat label="Spectral gap λ₂" value={SG} color="#00e5ff" sub="algebraic connectivity"/>
              <CasStat label="Clustering coeff" value={CC} color="#a8ff78" sub="local cohesion"/>
              <CasStat label="Avg path length"  value={APL} color="#ffd700" sub="small-world?"/>
              <CasStat label="Avg degree"        value={AVG_DEG} color="#a855f7" sub="synapses/neuron"/>
            </div>
          </div>

          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:10}}>ATTACK MODE</div>
            {([
              {key:"als"  as AttackMode,label:"🔴 ALS Pattern",   sub:"Motor-A first (clinically observed)"},
              {key:"hub"  as AttackMode,label:"🎯 Hub Attack",     sub:"highest degree first"},
              {key:"random" as AttackMode,label:"🎲 Random Failure",sub:"random selection"},
            ]).map(({key,label,sub})=>(
              <button key={key} onClick={()=>{setAttackMode(key);setPlayStep(0);setPlaying(false);}} className="w-full mb-1.5 rounded-lg text-left cursor-pointer"
                style={{padding:"8px 10px",background:attackMode===key?`${key==="als"?"#ff4444":key==="hub"?"#ffd700":"#a8ff78"}18`:"rgba(255,255,255,0.02)",border:`1px solid ${attackMode===key?(key==="als"?"#ff4444":key==="hub"?"#ffd700":"#a8ff78"):"#162030"}`,color:attackMode===key?"#fff":"#3a5570"}}>
                <div style={{fontSize:11,fontWeight:700}}>{label}</div>
                <div style={{fontSize:9,color:"#3a5570"}}>{sub}</div>
              </button>
            ))}
          </div>

          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>NEURON TYPES</div>
            {TYPE_LABELS.map((l,i)=><div key={i} className="flex items-center gap-2 mb-1.5"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:TYPE_COLORS[i]}}/><div style={{fontSize:9,color:i===1?TYPE_COLORS[i]:"#3a5570"}}>{l}</div></div>)}
            <div style={{marginTop:8,fontSize:9,color:"#ff5500",borderTop:"1px solid #162030",paddingTop:8}}>🔥 Orange/Red = overloaded</div>
          </div>

          {finalALS&&(<div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.03)"}}>
            <div style={{fontSize:9,color:"#3a5570",letterSpacing:1,marginBottom:8}}>FINAL STATE</div>
            <CasStat label="ALS survivors"    value={`${finalALS.aliveCount}/${N}`} color="#ff4444" sub={`${(finalALS.aliveCount/N*100).toFixed(0)}% alive`}/>
            <div className="h-2"/>
            <CasStat label="Hub attack"       value={`${finalHub?.aliveCount??N}/${N}`} color="#ffd700" sub={`${((finalHub?.aliveCount??N)/N*100).toFixed(0)}% alive`}/>
            <div className="h-2"/>
            <CasStat label="Random failure"   value={`${finalRandom?.aliveCount??N}/${N}`} color="#a8ff78" sub={`${((finalRandom?.aliveCount??N)/N*100).toFixed(0)}% alive`}/>
          </div>)}
        </div>

        {/* center: network viz */}
        <div className="flex flex-col gap-3">
          <NetworkViz alive={curFrame.snapshot||new Uint8Array(N).fill(1)} size={420} step={playStep}/>

          {/* playback controls */}
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.02)"}}>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={()=>{setPlayStep(0);setPlaying(false);}} className="rounded px-2.5 py-1 cursor-pointer font-mono text-xs" style={{background:"rgba(255,255,255,0.05)",border:"1px solid #162030",color:"#3a5570"}}>⏮</button>
              <button onClick={()=>setPlaying(p=>!p)} className="rounded px-3.5 py-1 cursor-pointer font-mono font-bold text-xs" style={{background:playing?"rgba(255,100,100,0.1)":"rgba(0,229,255,0.1)",border:`1px solid ${playing?"#ff4444":"#00e5ff"}`,color:playing?"#ff4444":"#00e5ff"}}>{playing?"⏸ PAUSE":"▶ PLAY"}</button>
              <button onClick={()=>setPlayStep(s=>Math.min(s+1,curHistory.length-1))} className="rounded px-2.5 py-1 cursor-pointer font-mono text-xs" style={{background:"rgba(255,255,255,0.05)",border:"1px solid #162030",color:"#3a5570"}}>⏭</button>
              <div className="flex-1">
                <input type="range" min={0} max={Math.max(curHistory.length-1,1)} value={playStep} onChange={e=>{setPlaying(false);setPlayStep(parseInt(e.target.value));}} className="w-full" style={{accentColor:"#00e5ff"}}/>
              </div>
              <div style={{fontSize:10,color:"#00e5ff",fontFamily:"monospace",minWidth:60}}>{curFrame.aliveCount}/{N} alive</div>
            </div>
            {/* type progress bar */}
            <div className="flex h-2 rounded overflow-hidden gap-0.5">
              {TYPE_LABELS.map((_,i)=>{
                const total=Object.values(NODE_TYPES).filter(t=>t===i).length;
                const dead=curFrame.deadByType?.[i]||0;
                const alv=total-dead;
                return alv>0?<div key={i} style={{flex:alv,background:TYPE_COLORS[i],opacity:0.8,transition:"flex 0.2s"}}/>:null;
              })}
              <div style={{flex:curFrame.deadByType?.reduce((a,b)=>a+b,0)||0,background:"#1a0808",transition:"flex 0.2s"}}/>
            </div>
          </div>
        </div>

        {/* right: charts */}
        <div className="flex-1 flex flex-col gap-3" style={{minWidth:280}}>
          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.02)"}}>
            <CasLineChart series={[
              {label:"als",   data:alsAlive,    color:"#ff4444",bold:true},
              {label:"hub",   data:hubAlive,    color:"#ffd700"},
              {label:"random",data:randomAlive, color:"#a8ff78"},
            ]} height={110} width={310} title="ALIVE NEURONS OVER TIME" xLabel="cascade step"/>
            <div className="flex gap-3 mt-1.5">
              {[["🔴 ALS","#ff4444"],["🎯 Hub","#ffd700"],["🎲 Random","#a8ff78"]].map(([l,c])=><span key={l} className="flex items-center gap-1" style={{fontSize:9,color:c}}><span className="inline-block w-3" style={{height:2,background:c}}/>{l}</span>)}
            </div>
          </div>

          <div className="rounded-xl p-3 border border-[#162030]" style={{background:"rgba(255,255,255,0.02)"}}>
            <CasLineChart series={[
              {label:"motorA",  data:motorADead,  color:"#ff4444",bold:true},
              {label:"motorB",  data:motorBDead,  color:"#ffd700"},
              {label:"command", data:commandDead, color:"#00e5ff"},
              {label:"inhib",   data:inhibDead,   color:"#a855f7"},
            ]} height={100} width={310} title="DEATH BY NEURON TYPE (ALS pattern)" xLabel="step"/>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {[["Motor-A","#ff4444"],["Motor-B","#ffd700"],["Command","#00e5ff"],["Inhibitory","#a855f7"]].map(([l,c])=><span key={l} className="flex items-center gap-1" style={{fontSize:9,color:c}}><span className="inline-block w-2.5" style={{height:2,background:c}}/>{l}</span>)}
            </div>
          </div>

          {finalALS&&<div className="rounded-xl p-4 border border-[#ff444433]" style={{background:"rgba(255,68,68,0.05)"}}>
            <div style={{fontSize:9,color:"#ff4444",letterSpacing:1,marginBottom:10}}>ALS CASCADE FINDING</div>
            <p style={{fontSize:12,color:"#8ab0cc",lineHeight:1.8}}>
              {finalALS.aliveCount<(finalRandom?.aliveCount||N)
                ?`✅ ALS pattern (Motor-A first) caused a more severe cascade than random failure — ${N-finalALS.aliveCount} vs ${N-(finalRandom?.aliveCount||N)} neurons lost.`
                :`⚠️ In this network, the ALS pattern did not produce a more severe cascade than random failure.`}{" "}
              {finalALS.deadByType[0]>0
                ?`Command interneurons (AVAL/AVAR) also cascaded → consistent with clinical observations that upper motor neurons are affected in ALS.`
                :`Command interneurons survived → core circuit preserved.`}
            </p>
            <div className="mt-3 rounded-lg p-3 text-xs leading-relaxed" style={{background:"rgba(0,0,0,0.3)",color:"#3a5570"}}>
              <span style={{color:"#00e5ff"}}>Research question: </span>
              Do networks with a higher spectral gap (λ₂={SG}) slow the ALS cascade?
              This could be compared against clinical data on ALS progression rates.
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

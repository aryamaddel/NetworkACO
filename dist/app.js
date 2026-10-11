import { POINTS, OPTIMUM } from './berlin52.js';
const $=id=>document.getElementById(id), fmt=n=>Math.round(n).toLocaleString('en-US');
const colors=['#b46639','#22745f','#91968e'], names=['standard','network','recent'];
const coords=POINTS.map(([x,y])=>[35+(x-25)/1715*530,340-(y-5)/1170*305]);
let worker=null, benchWorker=null, history=[], options={}, running=false, paused=false, complete=false;
let benchmarkStart=41, currentIndex=0;
function makeWorker() {return new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}
function map(id,tour=[],color) {
  let svg='<defs><pattern id="grid-'+id+'" width="35" height="35" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#dce0d7"/></pattern></defs><rect width="600" height="370" fill="url(#grid-'+id+')"/>';
  if(tour.length) svg+=`<path d="${tour.concat(tour[0]).map((p,i)=>`${i?'L':'M'}${coords[p].join(',')}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linejoin="round" opacity=".85"/>`;
  svg+=coords.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="3.3" fill="${tour.length?color:'#9fa79c'}" stroke="#fffefa" stroke-width="1.1"><title>Stop ${i+1}</title></circle>`).join('');
  if(tour.length){const [x,y]=coords[tour[0]];svg+=`<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${color}" stroke-width="1.3"/><text x="${x+10}" y="${y-10}" font-size="9" fill="${color}">START / FINISH</text>`;}
  $(id).innerHTML=svg;
}
function chart(index) {
  const seen=history.slice(0,index+1), max=seen.length?Math.max(...history[0].map(x=>x.best))*1.02:20000,min=OPTIMUM*.97;
  const x=t=>55+t/(options.budget||2000)*625, y=v=>210-(v-min)/(max-min)*180;
  let svg='';
  for(let i=0;i<4;i++){const v=min+(max-min)*i/3;svg+=`<path d="M55 ${y(v)}H680" stroke="#e0e2db"/><text x="44" y="${y(v)+3}" text-anchor="end" font-size="10" fill="#778077">${fmt(v)}</text>`;}
  svg+=`<path d="M55 ${y(OPTIMUM)}H680" stroke="#a4aea0" stroke-dasharray="3 4"/><text x="680" y="${y(OPTIMUM)-5}" text-anchor="end" font-size="9" fill="#778077">Optimum 7,542</text>`;
  [0,.5,1].forEach(f=>{svg+=`<text x="${x(f*(options.budget||2000))}" y="232" text-anchor="middle" font-size="10" fill="#778077">${fmt(f*(options.budget||2000))}</text>`;});
  for(let m=2;m>=0;m--) if(seen.length) svg+=`<path d="${seen.map((s,i)=>`${i?'L':'M'}${x(s[m].t)},${y(s[m].best)}`).join(' ')}" fill="none" stroke="${colors[m]}" stroke-width="${m===2?1.5:2}" ${m===2?'stroke-dasharray="4 4"':''}/>`;
  $('chart').innerHTML=svg;
}
function memory(snapshot) {
  if(!snapshot){$('memory').innerHTML='<text x="250" y="90" text-anchor="middle" fill="#778077" font-size="12">Run a simulation to see the connections.</text>';return;}
  const t=snapshot.t-1, refs=snapshot.refs, start=Math.max(0,Math.min(t-80,...refs)-5), x=i=>25+(i-start)/Math.max(1,t-start)*445;
  let svg=`<path d="M25 135H470" stroke="#cbd2c7"/><text x="25" y="166" fill="#778077" font-size="10">Ant ${start+1}</text><text x="470" y="166" text-anchor="end" fill="#778077" font-size="10">Current ant ${t+1}</text>`;
  svg+=`<rect x="${x(Math.max(0,t-20))}" y="124" width="${Math.max(2,x(t)-x(Math.max(0,t-20)))}" height="22" fill="#e1e9df"/>`;
  for(const ref of refs){const xx=x(ref);svg+=`<path d="M${xx} 135 Q${(xx+470)/2} ${20+(ref%5)*9} 470 135" fill="none" stroke="#22745f" opacity=".24"/><path d="M${xx} 130V141" stroke="#22745f" stroke-width="2"><title>Ant ${ref+1}</title></path>`;}
  svg+='<circle cx="470" cy="135" r="5" fill="#22745f"/>';
  $('memory').innerHTML=svg;
  const older=refs.filter(r=>r<t-20).length;
  $('memory-caption').textContent=t<=20?'Warm-up: connections exist, but these first 21 ants use distance hints only.':`${older} of ${refs.length} teachers are older than the last 20 ants. Pale band = recent history. Connections join attempts, not stops.`;
}
function draw(index) {
  currentIndex=index;const s=history[index];
  if(!s){names.slice(0,2).forEach((n,i)=>map(n+'-map',[],colors[i]));chart(-1);memory(null);return;}
  names.slice(0,2).forEach((n,i)=>{map(n+'-map',s[i].tour,colors[i]);$(n+'-length').textContent=fmt(s[i].best);$(n+'-gap').textContent=`${((s[i].best/OPTIMUM-1)*100).toFixed(1)}% above the known optimum`;});
  $('attempt').textContent=`${fmt(s[0].t)} / ${fmt(options.budget)} routes`;
  const improvement=(s[0].best-s[1].best)/s[0].best*100;
  const prefix=complete&&index===history.length-1?'Final result:':'At this point:';
  $('verdict').textContent=Math.abs(improvement)<1e-9?`${prefix} both methods have found equally short routes. Try another seed or compare multiple runs.`:`${prefix} network ACO’s best route is ${Math.abs(improvement).toFixed(1)}% ${improvement>0?'shorter':'longer'} than simple ACO’s (${fmt(Math.abs(s[0].best-s[1].best))} route units). This is one run, not a general guarantee.`;
  chart(index);memory(s[1]);
}
function stop(){worker?.terminate();worker=null;running=false;paused=false;$('pause').disabled=true;$('pause').textContent='Pause';$('run').textContent='Run simulation →';}
function reset(){stop();history=[];complete=false;options={budget:Number($('budget').value)};$('timeline').max=0;$('timeline').value=0;$('timeline').disabled=true;$('download').disabled=true;$('status').textContent='Ready to explore';$('attempt').textContent=`0 / ${fmt(options.budget)} routes`;for(const n of names.slice(0,2)){$(n+'-length').textContent='—';$(n+'-gap').textContent='Waiting for the first route';}$('verdict').textContent='Press Run simulation. Both methods start with the same guesses. No winner is predetermined.';$('memory-caption').textContent='One mark = one selected teacher. These are links between attempts, not roads between stops.';draw(-1);}
function readOptions(){return {seed:Number($('seed').value),budget:Number($('budget').value),omega:Number($('omega').value),r:20,beta:2,alpha:1};}
$('controls').addEventListener('submit',e=>{
  e.preventDefault();reset();options=readOptions();running=true;$('pause').disabled=false;$('status').textContent='Computing routes…';$('run').textContent='Restart simulation →';
  try{worker=makeWorker();}catch(error){stop();$('status').textContent=`Cannot start worker: ${error.message}`;return;}
  worker.onerror=e=>{stop();$('status').textContent='Simulation failed. Serve this page over HTTP and try again.';};
  worker.onmessage=({data})=>{
    if(data.type==='error'){stop();$('status').textContent=data.message;return;}
    if(data.type==='progress'){
      history.push(...data.snapshots);complete=data.done;$('timeline').disabled=false;$('timeline').max=history.length-1;$('timeline').value=history.length-1;$('download').disabled=false;draw(history.length-1);
      if(data.done){stop();$('status').textContent='Complete · drag to replay';}else $('status').textContent=paused?'Paused · drag to replay':`${fmt(history.at(-1)[0].t)} routes tried per method`;
    }
  };worker.postMessage({type:'start',options});
});
$('pause').addEventListener('click',()=>{paused=!paused;worker?.postMessage({type:paused?'pause':'resume'});$('pause').textContent=paused?'Resume':'Pause';$('status').textContent=paused?'Paused · drag to replay':'Computing routes…';});
$('timeline').addEventListener('input',()=>{if(running&&!paused)$('pause').click();draw(Number($('timeline').value));});
$('reset').addEventListener('click',reset);
$('download').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({dataset:'TSPLIB berlin52',optimum:OPTIMUM,options,complete,methodOrder:names,snapshots:history},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`aco-seed-${options.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function showBenchmark(data){
  const rows=data.rows,n=rows.length,means=Object.fromEntries(names.map(k=>[k,rows.reduce((s,r)=>s+r[k],0)/n]));
  const wins=rows.filter(r=>r.network<r.standard).length,ties=rows.filter(r=>r.network===r.standard).length,losses=n-wins-ties;
  const diff=(means.standard-means.network)/means.standard*100;
  const differences=rows.map(r=>r.standard-r.network),avg=differences.reduce((a,b)=>a+b)/n;
  const se=Math.sqrt(differences.reduce((a,b)=>a+(b-avg)**2,0)/(n-1)/n), margin=2.093*se;
  $('benchmark-label').textContent=`${data.kind||'Recorded held-out experiment'} · seeds ${rows[0].seed}–${rows.at(-1).seed} · ${fmt(data.budget)} routes per method per seed · ω = ${data.omega}`;
  $('benchmark-summary').innerHTML=`<div class="stat"><strong>${Math.abs(diff).toFixed(2)}%</strong><span>${diff>=0?'shorter':'longer'} mean route for network ACO</span></div><div class="stat"><strong>${wins} / ${n}</strong><span>runs where network ACO beats simple ACO</span></div><div class="stat"><strong>${fmt(n*data.budget)}</strong><span>routes evaluated per method</span></div>`;
  $('benchmark-table').innerHTML=names.map((k,i)=>`<tr><td>${['Simple ACO','Network ACO','Recent-only control'][i]}</td><td>${means[k].toLocaleString('en-US',{maximumFractionDigits:1})}</td><td>${((means[k]/OPTIMUM-1)*100).toFixed(2)}%</td><td>${i===1?`${wins} / ${ties} / ${losses}`:'—'}</td></tr>`).join('');
  $('benchmark-conclusion').textContent=`Paired mean saving (simple minus network): ${avg.toFixed(1)} units; approximate 95% t interval [${(avg-margin).toFixed(1)}, ${(avg+margin).toFixed(1)}]. ${avg-margin<=0&&avg+margin>=0?'The interval includes zero: these runs do not establish a reliable advantage.':avg>0?'These seeds support an advantage at these settings; this is not a claim about all routing problems.':'These seeds favor simple ACO at these settings.'}`;
  $('benchmark-settings').textContent=`Same ${fmt(data.budget)}-route budget per seed, r=20, β=2, α=1, floor=10⁻⁶; standard evaporation=0.05. ${data.kind==='Live browser experiment'?'Computed just now in your browser.':'Seeds 1–20 were used during exploratory checks; the recorded comparison uses previously unused seeds 21–40. The near-lattice setting was selected after those exploratory checks, not after inspecting these held-out results.'} These intervals describe seed variation on one dataset; they are not a cross-problem guarantee.`;
  $('seed-table').innerHTML=rows.map(r=>`<tr><td>${r.seed}</td><td>${fmt(r.standard)}</td><td>${fmt(r.network)}</td><td>${fmt(r.recent)}</td></tr>`).join('');
}
$('benchmark').addEventListener('click',()=>{
  if(benchWorker){benchWorker.terminate();benchWorker=null;$('benchmark').textContent='Test 20 new seeds →';$('benchmark-label').textContent='Benchmark cancelled. The previous complete results remain below.';return;}
  const opts=readOptions();benchWorker=makeWorker();$('benchmark').textContent='Cancel benchmark';$('benchmark-label').textContent='Testing 20 new seeds… 0 / 20';
  benchWorker.onerror=()=>{benchWorker?.terminate();benchWorker=null;$('benchmark').textContent='Test 20 new seeds →';$('benchmark-label').textContent='Benchmark failed. Please try again.';};
  benchWorker.onmessage=({data})=>{
    if(data.type==='benchmark-progress')$('benchmark-label').textContent=`Testing seeds ${benchmarkStart}–${benchmarkStart+19}… ${data.count} / 20 complete`;
    if(data.type==='benchmark-done'){showBenchmark(data.data);benchmarkStart+=20;benchWorker.terminate();benchWorker=null;$('benchmark').textContent='Test 20 new seeds →';}
    if(data.type==='error'){benchWorker.terminate();benchWorker=null;$('benchmark').textContent='Test 20 new seeds →';$('benchmark-label').textContent=data.message;}
  };benchWorker.postMessage({type:'benchmark',options:opts,start:benchmarkStart});
});
fetch('./benchmark.json').then(r=>{if(!r.ok)throw new Error('unavailable');return r.json();}).then(showBenchmark).catch(()=>{$('benchmark-label').textContent='Recorded results unavailable. Click “Test 20 new seeds” to compute them locally.';});
reset();

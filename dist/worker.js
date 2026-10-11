import { Colony, runComparison } from './solver.js';
let colonies=[], paused=false, running=false;
function tick() {
  if(paused||!running) return;
  const snapshots=[];
  for(let i=0;i<20;i++) {
    if(colonies[0].t>=colonies[0].budget) break;
    const values=colonies.map(c=>c.step());
    if(colonies[0].t%10===0||colonies[0].t===1||colonies[0].t===colonies[0].budget) snapshots.push(values);
  }
  const done=colonies[0].t>=colonies[0].budget;
  postMessage({type:'progress',snapshots,done});
  if(done) running=false;
  else setTimeout(tick,12);
}
self.onmessage=async ({data})=>{
  try {
    if(data.type==='start') {
      colonies=['standard','network','recent'].map(method=>new Colony({...data.options,method}));
      paused=false;running=true;tick();
    } else if(data.type==='pause') paused=true;
    else if(data.type==='resume'&&paused) {paused=false;tick();}
    else if(data.type==='benchmark') {
      const rows=[];
      for(let seed=data.start;seed<data.start+20;seed++) {
        const r=runComparison({...data.options,seed});
        rows.push({seed,standard:r.standard.best,network:r.network.best,recent:r.recent.best});
        postMessage({type:'benchmark-progress',count:rows.length});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      postMessage({type:'benchmark-done',data:{...data.options,rows,seedStart:data.start,kind:'Live browser experiment'}});
    }
  } catch(error) {running=false;postMessage({type:'error',message:error.message});}
};

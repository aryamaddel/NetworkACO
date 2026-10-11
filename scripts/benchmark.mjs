import { runComparison } from '../dist/solver.js';
const omega=Number(process.argv[2]??-.9999), count=Number(process.argv[3]??20), budget=Number(process.argv[4]??2000), start=Number(process.argv[5]??21);
if(!Number.isInteger(count)||count<1||count>1000||!Number.isInteger(start)||start<0) throw new Error('Invalid seed range');
const rows=[];
for(let seed=start;seed<start+count;seed++) {
  const r=runComparison({seed,omega,budget});
  rows.push({seed,standard:r.standard.best,network:r.network.best,recent:r.recent.best});
}
console.log(JSON.stringify({omega,budget,count,means:Object.fromEntries(['standard','network','recent'].map(m=>[m,rows.reduce((s,r)=>s+r[m],0)/count])),wins:rows.filter(r=>r.network<r.standard).length,rows},null,2));

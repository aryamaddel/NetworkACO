import { POINTS } from './berlin52.js';

export function random(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function distances(points) {
  return points.map(a => Float64Array.from(points, b => Math.floor(Math.hypot(a[0]-b[0], a[1]-b[1]) + .5)));
}
export function tourLength(tour, d) {
  let length = 0;
  for (let i=0;i<tour.length;i++) length += d[tour[i]][tour[(i+1)%tour.length]];
  return length;
}
export function selectParents(t, degrees, r, omega, rng) {
  if (t <= r) return Array.from({length:t},(_,i)=>i);
  if (omega === -1) return Array.from({length:r},(_,i)=>t-r+i);
  const weights = Float64Array.from(degrees.slice(0,t), k => Math.max(r+omega*k,0));
  let total = weights.reduce((a,b)=>a+b,0);
  const refs=[];
  for (let j=0;j<r;j++) {
    let x=rng()*total, selected=-1;
    for (let i=0;i<t;i++) if (weights[i]>0) { selected=i; x-=weights[i]; if(x<0) break; }
    if(selected<0) throw new Error('Insufficient eligible parents');
    total-=weights[selected]; weights[selected]=0; refs.push(selected);
  }
  return refs;
}

export class Colony {
  constructor({method='network',seed=1,budget=2000,r=20,omega=-.9,beta=2,alpha=1,points=POINTS}={}) {
    if(!['standard','network','recent'].includes(method)) throw new Error('Unknown method');
    if(!Number.isInteger(budget)||budget<r+2||budget>20000||!Number.isInteger(r)||r<1||!Number.isFinite(omega)||omega < -1||omega>2||!Number.isFinite(beta)||beta<0||!Number.isFinite(alpha)||alpha<0||!Number.isInteger(seed)||seed<0||seed>4294967295) throw new Error('Invalid parameters');
    this.method=method; this.r=r; this.omega=omega; this.beta=beta; this.alpha=alpha;
    this.budget=budget; this.n=points.length; this.d=distances(points);
    this.rng=random(seed); this.graphRng=random((seed+100000)>>>0);
    this.t=0; this.best=Infinity; this.bestTour=[]; this.tours=[]; this.lengths=[];
    this.degrees=new Int32Array(budget); this.refs=[];
    this.floor=1e-6; this.tau=new Float64Array(this.n*this.n).fill(this.floor);
    this.eta=this.d.map(row=>Float64Array.from(row,d=>d>0?1/Math.pow(d,beta):0));
  }
  deposit(tau,tour,amount) {
    for(let i=0;i<this.n;i++) { const a=tour[i],b=tour[(i+1)%this.n]; tau[a*this.n+b]+=amount; tau[b*this.n+a]+=amount; }
  }
  step() {
    if(this.t>=this.budget) return null;
    let tau=this.tau;
    if(this.method!=='standard') {
      this.refs=selectParents(this.t,this.degrees,this.r,this.method==='recent'?-1:this.omega,this.graphRng);
      this.refs.forEach(i=>this.degrees[i]++);
      tau=new Float64Array(this.n*this.n).fill(this.floor);
      if(this.t>this.r) for(const i of this.refs) this.deposit(tau,this.tours[i],1/this.lengths[i]);
    }
    // Shared warm-up: first r+1 routes use distance only, without pheromone.
    const visited=new Uint8Array(this.n), route=[Math.floor(this.rng()*this.n)], weights=new Float64Array(this.n);
    visited[route[0]]=1;
    while(route.length<this.n) {
      const from=route[route.length-1]; let total=0,last=-1;
      for(let j=0;j<this.n;j++) {
        weights[j]=visited[j]?0:this.eta[from][j]*(this.t<=this.r?1:Math.pow(tau[from*this.n+j],this.alpha));
        total+=weights[j]; if(!visited[j]) last=j;
      }
      let x=this.rng()*total, next=last;
      for(let j=0;j<this.n;j++) if(!visited[j]) { x-=weights[j]; if(x<0) {next=j;break;} }
      route.push(next); visited[next]=1;
    }
    const length=tourLength(route,this.d);
    if(length<this.best) { this.best=length; this.bestTour=route.slice(); }
    this.tours.push(route); this.lengths.push(length);
    if(this.method==='standard') {
      for(let i=0;i<tau.length;i++) tau[i]=this.floor+(tau[i]-this.floor)*(1-1/this.r);
      this.deposit(tau,route,1/length);
    }
    this.t++;
    return {t:this.t,best:this.best,tour:this.bestTour.slice(),length,refs:this.refs.slice()};
  }
}

export function runComparison(options={}) {
  const colonies=['standard','network','recent'].map(method=>new Colony({...options,method}));
  const traces=colonies.map(()=>[]);
  for(let t=0;t<colonies[0].budget;t++) colonies.forEach((c,i)=>{ const s=c.step(); if(t%20===0||t===c.budget-1)traces[i].push({t:s.t,best:s.best}); });
  return Object.fromEntries(colonies.map((c,i)=>[c.method,{best:c.best,tour:c.bestTour,trace:traces[i]}]));
}

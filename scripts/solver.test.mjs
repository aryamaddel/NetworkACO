import test from 'node:test';
import assert from 'node:assert/strict';
import { Colony, distances, tourLength, selectParents, random, runComparison } from '../dist/solver.js';
import {POINTS,OPTIMUM} from '../dist/berlin52.js';
import {readFileSync} from 'node:fs';

test('TSPLIB rounding and closed-tour length',()=>{
  const d=distances([[0,0],[3,0],[3,4],[0,4]]);
  assert.equal(tourLength([0,1,2,3],d),14);
  assert.equal(distances([[0,0],[1,1]])[0][1],1);
  assert.equal(distances(POINTS)[0][1],666);
});
test('network has distinct predecessors, correct edge count and popularity caps',()=>{
  for(const omega of [-1,-.9999,-.9,0,1]){
    const degrees=new Int32Array(180),rng=random(42),r=10;
    for(let t=0;t<degrees.length;t++){
      const refs=selectParents(t,degrees,r,omega,rng);
      assert.equal(refs.length,Math.min(t,r));assert.equal(new Set(refs).size,refs.length);
      assert.ok(refs.every(i=>i>=0&&i<t));
      if(omega===-1&&t>r)assert.deepEqual(refs,Array.from({length:r},(_,i)=>t-r+i));
      refs.forEach(i=>degrees[i]++);
    }
    assert.equal(degrees.reduce((a,b)=>a+b),55+10*(180-11));
    if(omega<0)assert.ok(Math.max(...degrees)<=Math.ceil(-r/omega));
  }
});
test('all generated tours visit every stop once; best scores are truthful and monotone',()=>{
  for(const method of ['standard','network','recent']){
    const c=new Colony({method,budget:120});let previous=Infinity;
    while(c.t<c.budget){const s=c.step(),tour=c.tours.at(-1);assert.equal(new Set(tour).size,52);assert.equal(s.length,tourLength(tour,c.d));assert.ok(s.best<=previous);assert.equal(s.best,tourLength(s.tour,c.d));assert.ok(s.best>=OPTIMUM);previous=s.best;}
    assert.equal(c.step(),null);
  }
});
test('common warm-up, reproducibility and zero-pheromone control',()=>{
  const a=new Colony({method:'standard',budget:100}),b=new Colony({method:'network',budget:100});
  for(let i=0;i<21;i++)assert.deepEqual(a.step().tour,b.step().tour);
  assert.deepEqual(runComparison({budget:80,seed:24}),runComparison({budget:80,seed:24}));
  const zero=runComparison({budget:80,alpha:0});
  assert.deepEqual(zero.standard,zero.network);assert.deepEqual(zero.standard,zero.recent);
});
test('invalid configurations are rejected',()=>{
  for(const options of [{budget:1},{omega:-2},{seed:-1},{r:0},{beta:NaN},{method:'unknown'}])assert.throws(()=>new Colony(options));
});
test('recorded benchmark uses all 20 declared held-out seeds and reproducible first row',()=>{
  const data=JSON.parse(readFileSync(new URL('../dist/benchmark.json',import.meta.url)));
  assert.deepEqual(data.rows.map(r=>r.seed),Array.from({length:20},(_,i)=>21+i));
  const first=data.rows[0],r=runComparison({...data,seed:first.seed});
  for(const method of ['standard','network','recent'])assert.equal(r[method].best,first[method]);
});

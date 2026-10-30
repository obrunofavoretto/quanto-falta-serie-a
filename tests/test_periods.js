'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {campaign,opponentContext,compare}=require('../comparador-periodos.js');
const teams=[{id:1,name:'A'},{id:2,name:'B'},{id:3,name:'C'}];
const match=(id,day,home,away,hg,ag)=>({id,date:`2026-02-${String(day).padStart(2,'0')}T21:00Z`,home,away,hg,ag});
const matches=[match('a',1,1,2,1,0),match('b',3,3,1,1,1),match('c',5,1,3,0,2),match('d',7,2,1,0,3),match('e',9,1,2,2,0),match('f',11,3,1,2,1),match('g',13,1,3,0,0),match('h',15,2,1,2,2)];
const data={teams,matches:[...matches].reverse()};
const result=compare(data,1,'e',3);
assert.deepEqual(result.before.matches.map(m=>m.id),['b','c','d']);
assert.deepEqual(result.after.matches.map(m=>m.id),['e','f','g']);
assert.equal(result.before.points,4);assert.equal(result.after.points,4);assert.equal(result.delta,0);
assert.equal(result.before.home,1);assert.equal(result.after.home,2);
const home=compare(data,1,'e',3,'home');assert.deepEqual(home.before.matches.map(m=>m.id),['a','c']);assert.deepEqual(home.after.matches.map(m=>m.id),['e','g']);
const first=compare(data,1,'a',5);assert.equal(first.before.ppg,null);assert.equal(first.delta,null);assert.equal(first.before.opponentPpg,null);
assert.equal(first.after.contextCount,3); // Dois rivais ainda não tinham jogado antes do confronto.
const last=compare(data,1,'h',5);assert.equal(last.after.played,1);assert.equal(last.after.points,1);
const all=compare(data,1,'e','all');assert.equal(all.before.played,4);assert.equal(all.after.played,4);
assert.equal(campaign([],1).gapg,null);assert.equal(campaign([matches[6]],1).ppg,1);
assert.throws(()=>compare(data,1,'no-match',5));assert.throws(()=>compare(data,1,'a',7));
const context=opponentContext(data);assert.equal(context.get('a').away.ppg,null);assert.equal(context.get('b').away.ppg,3);
const edited=structuredClone(data);edited.matches.find(m=>m.id==='h').hg=20;
assert.deepEqual(opponentContext(edited).get('e'),context.get('e')); // Sem informação de resultados futuros.
const simultaneous={teams,matches:[match('x',1,1,2,3,0),match('y',1,3,1,0,1)]};
assert.equal(opponentContext(simultaneous).get('y').away.ppg,null);
const real=JSON.parse(fs.readFileSync(path.join(__dirname,'../relogio-gols.json'),'utf8'));
for(const t of real.teams){
 const games=real.matches.filter(m=>m.home===t.id||m.away===t.id).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const r=compare(real,t.id,games[games.length-5].id,5);
 assert.equal(r.before.played,Math.min(5,games.length-5));assert.equal(r.after.played,5);
 for(const p of [r.before,r.after]){
  assert.equal(p.played,p.wins+p.draws+p.losses);assert.equal(p.points,3*p.wins+p.draws);
  assert.equal(p.points,p.homeSplit.points+p.awaySplit.points);assert.equal(p.gf,p.homeSplit.gf+p.awaySplit.gf);
  for(const m of p.matches){const prior=real.matches.filter(g=>(g.home===m.opponent||g.away===m.opponent)&&Date.parse(g.date)<Date.parse(m.date));const c=campaign(prior,m.opponent);assert.equal(m.opponentContext.played,c.played);assert.equal(m.opponentContext.points,c.points);}
 }
}
console.log('Períodos: marco incluído depois, janelas, mando, amostras vazias/desiguais, 0 a 0, partidas simultâneas e contexto sem resultados futuros conferidos para os 20 clubes.');

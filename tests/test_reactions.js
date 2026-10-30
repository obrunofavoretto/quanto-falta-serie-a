'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {analyze,rank}=require('../viradas-reacoes.js');
const teamA={id:1,name:'A'},teamB={id:2,name:'B'};
function game(hg,ag,firstScorer=1){return {id:'g',home:1,away:2,hg,ag,firstScorer,firstGoalStatus:firstScorer===null?'goalless':'known'};}
function stats(m){return analyze({teams:[teamA,teamB],matches:[m]});}
for(const [hg,ag,lost,recovered] of [[1,0,0,0],[1,1,2,1],[1,2,3,3],[2,2,2,1],[3,2,0,0]]){
 const [a,b]=stats(game(hg,ag));assert.equal(a.lost,lost);assert.equal(b.recovered,recovered);assert.equal(a.opened,1);assert.equal(b.behind,1);
}
const [reaction,defeat]=stats(game(2,1,2));assert.equal(reaction.recovered,3);assert.equal(defeat.lost,3);
const zero=stats(game(0,0,null));assert.equal(zero[0].played,1);assert.equal(zero[0].goalless,1);assert.equal(zero[0].opened,0);assert.equal(zero[0].behind,0);
const ambiguous=stats({...game(1,1),firstScorer:null,firstGoalStatus:'ambiguous'});assert.equal(ambiguous[0].played,0);assert.equal(ambiguous[0].excluded,1);
assert.deepEqual(rank([{id:1,name:'B',lost:3},{id:2,name:'A',lost:3},{id:3,name:'C',lost:2}],'lost').map(t=>t.rank),[1,1,3]);
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../relogio-gols.json'),'utf8'));
const all=analyze(data),home=analyze(data,'home'),away=analyze(data,'away');
for(const t of all){
 for(const key of ['played','opened','behind','goalless','lost','recovered'])assert.equal(t[key],home.find(x=>x.id===t.id)[key]+away.find(x=>x.id===t.id)[key]);
 assert.equal(t.played,t.opened+t.behind+t.goalless);
 assert.equal(t.lost,2*t.leadDraws+3*t.leadLosses);
 assert.equal(t.recovered,t.behindDraws+3*t.behindWins);
 assert.equal(t.lost,t.matches.reduce((s,m)=>s+m.lost,0));
 assert.equal(t.recovered,t.matches.reduce((s,m)=>s+m.recovered,0));
}
assert.equal(all.reduce((s,t)=>s+t.opened,0),all.reduce((s,t)=>s+t.behind,0));
assert.equal(all.reduce((s,t)=>s+t.lost,0),all.reduce((s,t)=>s+t.recovered+t.leadDraws,0));
console.log('Viradas: vitória, empate, derrota, reação, 0 a 0, ordem ambígua, empates no ranking e filtros dos 20 clubes conferidos.');
console.log('Mais pontos deixados escapar:',rank(all,'lost').slice(0,3).map(t=>[t.name,t.lost]));
console.log('Mais pontos recuperados:',rank(all,'recovered').slice(0,3).map(t=>[t.name,t.recovered]));

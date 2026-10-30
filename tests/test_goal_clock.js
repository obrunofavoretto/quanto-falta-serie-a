'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');
const {summarize}=require('../relogio-gols.js');
const real=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../relogio-gols.json'),'utf8'));
for(const team of real.teams){
 const all=summarize(real,team.id),home=summarize(real,team.id,'home'),away=summarize(real,team.id,'away');
 assert.equal(all.matches.length,home.matches.length+away.matches.length);
 assert.equal(all.totalFor,all.matches.reduce((s,m)=>s+(m.home===team.id?m.hg:m.ag),0));
 assert.equal(all.totalAgainst,all.matches.reduce((s,m)=>s+(m.home===team.id?m.ag:m.hg),0));
 assert.equal(all.totalFor,home.totalFor+away.totalFor);
}
const fixture={teams:[{id:1},{id:2}],matches:[{home:1,away:2,goals:[]},{home:2,away:1,goals:[{team:1,bin:3},{team:2,bin:7}]}]};
assert.deepEqual(summarize(fixture,1,'home').forPeaks,[]);
assert.equal(summarize(fixture,1).matches.length,2);
assert.deepEqual(summarize(fixture,1).forPeaks,[3]);
assert.deepEqual(summarize(fixture,1).againstPeaks,[7]);
fixture.matches[1].goals.push({team:1,bin:7});
assert.deepEqual(summarize(fixture,1).forPeaks,[3,7]);
console.log('Relógio: totais dos 20 clubes, filtros, 0 a 0 e empates de faixas validados.');

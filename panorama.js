/* As simulações da calculadora não alteram estes dados. */
(function(){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=s=>new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
const badge=t=>typeof badges!=='undefined'&&badges[t.id]?`<img src="${badges[t.id]}" alt="" loading="lazy">`:'';
async function read(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Falha na coleta');return r.json();}
function top(teams,key,direction){const sorted=[...teams].sort((a,b)=>direction*(a[key]-b[key])||a.name.localeCompare(b.name,'pt-BR'));const limit=sorted[2][key];return sorted.filter(t=>direction*(t[key]-limit)<=0);}
async function goals(){const el=document.getElementById('goal-content');try{
const data=await read('./forma.json');
if(data.teams?.length!==20||!data.teams.every(t=>Number.isInteger(t.goalsFor)&&t.goalsFor>=0&&Number.isInteger(t.goalsAgainst)&&t.goalsAgainst>=0&&Number.isInteger(t.played)&&t.played>0))throw Error('Gols incompletos');
const cards=[['Três melhores ataques','goalsFor',-1,'marcados'],['Três melhores defesas','goalsAgainst',1,'sofridos'],['Três piores ataques','goalsFor',1,'marcados'],['Três piores defesas','goalsAgainst',-1,'sofridos']];
el.innerHTML=`<p class="small">Última consulta: ${esc(stamp(data.fetchedAt))} (Brasília). Fonte: <a href="https://en.wikipedia.org/wiki/2026%E2%80%9327_Serie_A">Wikipédia + ESPN</a>.${Date.now()-new Date(data.fetchedAt)>36*3600000?' Atenção: dados há mais de 36 horas sem atualização.':''}</p><div class="goal-grid">`+cards.map(([title,key,dir,label])=>`<article class="goal-card"><h3>${title}</h3><ul class="goal-list">${top(data.teams,key,dir).map((t,i,arr)=>`<li><span>${i&&arr[i-1][key]===t[key]?arr.findIndex(a=>a[key]===t[key])+1:i+1}º</span>${badge(t)}<strong class="goal-name">${esc(t.name)}</strong><span class="goal-value"><strong>${t[key]}</strong> ${label}<small>${(t[key]/t.played).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}/jogo · ${t.played} jogos</small></span></li>`).join('')}</ul></article>`).join('')+'</div>';
}catch(e){el.textContent='Rankings indisponíveis nesta consulta. Tente novamente mais tarde.';}}
async function day(){const el=document.getElementById('day-content');try{const data=await read('./mudancas.json');const {current}=data;const before=data.roundBefore||data.before;const round=data.round;
if(!current||current.teams?.length!==20)throw Error('Tabela incompleta');
if(!before){el.textContent="Referência anterior indisponível. A comparação será exibida após uma mudança observada, sem presumir manutenção de posição.";return;}
const old=new Map(before.teams.map((t,i)=>[t.id,{...t,position:i+1}]));
if(old.size!==20||current.teams.some(t=>!old.has(t.id)))throw Error('Tabelas incompatíveis');

const games=(current.teams.reduce((n,t)=>n+t.played,0)-before.teams.reduce((n,t)=>n+t.played,0))/2;
el.innerHTML=`<p><strong>${round?'Balanço da '+esc(round.number)+'ª rodada':'Mudanças entre coletas'}</strong> · ${games} jogo(s) incorporado(s) desde a referência anterior.</p><p class="small">Referência anterior: ${esc(stamp(before.fetchedAt))}. Última consulta: ${esc(stamp(current.fetchedAt))} (Brasília).${Date.now()-new Date(current.fetchedAt)>36*3600000?' Atenção: coleta desatualizada.':''} Comparação acumulada dos 20 clubes desde a referência anterior, incluindo mudanças causadas por resultados dos rivais. A referência não muda à meia-noite. O balanço pode ser parcial enquanto houver jogos ou atualização pendente da fonte; partidas atrasadas disputadas no intervalo também afetam a tabela.</p><div class="day-scroll"><table class="day-table"><thead><tr><th scope="col">Clube</th><th scope="col">Antes</th><th scope="col">Agora</th><th scope="col">Mudança</th><th scope="col">Pontos</th></tr></thead><tbody>${current.teams.map((t,i)=>{const prev=old.get(t.id),delta=prev.position-i-1;return `<tr><td><span class="day-club">${badge(t)}${esc(t.name)}</span></td><td>${prev.position}º</td><td>${i+1}º</td><td class="day-${delta>0?'up':delta<0?'down':'flat'}">${delta>0?'▲ Subiu '+delta:delta<0?'▼ Caiu '+(-delta):'— Manteve'}</td><td>${prev.points} → ${t.points}</td></tr>`;}).join('')}</tbody></table></div><p class="small">Ordem da tabela comunitária da <a href="https://en.wikipedia.org/wiki/2026%E2%80%9327_Serie_A">Wikipédia</a> (CC BY-SA 4.0), preservando os desempates publicados.</p>`;
}catch(e){el.textContent='Comparação da rodada indisponível nesta consulta. Tente novamente mais tarde.';}}
goals();day();
})();

/* Comparador por mando: usa a campanha completa, independente das simulações. */
(async function(){
'use strict';
const host=document.getElementById('mando-content');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const avg=(s,key)=>s.played?s[key]/s.played:null;
try{
const response=await fetch('./mando.json',{cache:'no-store'});if(!response.ok)throw Error();
const data=await response.json();
const fields=['played','points','wins','draws','losses','goalsFor','goalsAgainst'];
if(data.teams?.length!==20||!data.teams.every(t=>['home','away'].every(v=>fields.every(k=>Number.isInteger(t[v]?.[k])&&t[v][k]>=0)&&t[v].played===t[v].wins+t[v].draws+t[v].losses&&t[v].points===3*t[v].wins+t[v].draws)))throw Error();
const teams=[...data.teams].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
host.innerHTML=`<p class="small">Última consulta: ${esc(new Date(data.fetchedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} (Brasília).${Date.now()-Date.parse(data.fetchedAt)>36*3600000?' Atenção: dados há mais de 36 horas sem atualização.':''}</p><label class="mando-picker">Escolha o time<select id="mando-team">${teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><div id="mando-result" aria-live="polite"></div><p class="small">Campanha completa da Serie A 2026–27 na última consulta. Pontos por jogo = pontos ÷ partidas; aproveitamento = pontos ÷ (3 × partidas). A conclusão compara pontos por jogo, sem prever resultados. Mando segue o registro da partida, mesmo em campo neutro. Fonte: <a href="${esc(data.sourceUrl)}">Wikipédia, matriz de resultados e classificação</a> (CC BY-SA 4.0). Pode haver atraso após os jogos. Simulações da calculadora não alteram estes números.</p>`;
const select=document.getElementById('mando-team');
function render(){
const t=teams.find(t=>String(t.id)===select.value),h=t.home,a=t.away;
const hp=avg(h,'points'),ap=avg(a,'points'),delta=hp===null||ap===null?null:hp-ap;
const badge=typeof badges!=='undefined'&&badges[t.id]?`<img src="${badges[t.id]}" alt="" width="44" height="44">`:'';
const verdict=delta===null?'Ainda faltam jogos em um dos mandos para comparar.':Math.abs(delta)<1e-9?'Mesmo rendimento em casa e fora.':`Rende mais ${delta>0?'em casa':'fora de casa'}.`;
const metrics=[['Jogos disputados',s=>s.played],['Pontos conquistados',s=>s.points],['Pontos por jogo',s=>s.played?num(avg(s,'points')):'—'],['Aproveitamento',s=>s.played?num(100*s.points/(3*s.played))+'%':'—'],['Vitórias',s=>s.wins],['Empates',s=>s.draws],['Derrotas',s=>s.losses],['Gols marcados',s=>s.goalsFor],['Gols marcados por jogo',s=>s.played?num(avg(s,'goalsFor')):'—'],['Gols sofridos',s=>s.goalsAgainst],['Gols sofridos por jogo',s=>s.played?num(avg(s,'goalsAgainst')):'—'],['Saldo de gols',s=>s.goalsFor-s.goalsAgainst]];
document.getElementById('mando-result').innerHTML=`<h3 class="mando-club">${badge}${esc(t.name)}</h3><div class="mando-verdict"><strong>${verdict}</strong>${delta!==null?`<span>${num(hp)} ponto(s)/jogo em casa · ${num(ap)} fora.${Math.abs(delta)>1e-9?' Diferença: '+num(Math.abs(delta))+' ponto(s) por jogo.':''}</span>`:''}</div><div class="mando-bars">${[['Casa',h],['Fora',a]].map(([label,s])=>`<div><span>${label}</span><div class="track"><div class="bar" style="width:${s.played?100*s.points/(3*s.played):0}%;background:${label==='Casa'?'#e8bd65':'#77baff'}"></div></div><b>${s.played?num(100*s.points/(3*s.played))+'%':'—'}</b></div>`).join('')}</div><div class="day-scroll"><table class="day-table mando-table"><caption>Desempenho como mandante e visitante</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Em casa</th><th scope="col">Fora</th></tr></thead><tbody>${metrics.map(([label,value])=>`<tr><th scope="row">${label}</th><td>${value(h)}</td><td>${value(a)}</td></tr>`).join('')}</tbody></table></div>`;
}
select.onchange=render;render();
}catch{host.textContent='Comparação por mando indisponível nesta consulta. Recarregue a página para tentar novamente.';}
})();

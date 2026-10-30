"""Uma coleta Wikipedia + uma ESPN por projeto, sem credenciais."""
import json, re, os, sys, urllib.request, zlib
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from parser import normalized

def read_url(url, maximum):
    req=urllib.request.Request(url,headers={'User-Agent':'EsporteComValorQuantoFalta/2.0 (https://esportecomvalor.wordpress.com/)','Accept':'text/html,application/json'})
    with urllib.request.urlopen(req,timeout=40) as r: raw=r.read(maximum+1)
    if len(raw)>maximum:raise ValueError('Resposta muito grande')
    return raw.decode('utf-8')

def n(name):
    s=normalized(name)
    return {'atletico mg':'atletico mineiro','atletico-mg':'atletico mineiro',
            'athletico pr':'athletico paranaense','athletico-pr':'athletico paranaense',
            'vasco':'vasco da gama','bragantino':'red bull bragantino',
            'athletic club':'athletic bilbao','deportivo':'deportivo a coruna',
            'as roma':'roma','le havre ac':'le havre','mainz':'mainz 05',
            'hamburg sv':'hamburger sv','fc cologne':'1. fc koln',
            'sc paderborn 07':'sc paderborn'}.get(s,s)

def team_keys(t):
    return {n(t[k]) for k in ('name','displayName','shortDisplayName','location') if t.get(k)}

def minute(value):
    value=re.sub(r"['’′\s]",'',value)
    m=re.fullmatch(r'(\d+)(?:\+(\d+))?',value)
    if not m: raise ValueError('Minuto inválido')
    b,e=int(m[1]),int(m[2] or 0)
    if b>90 or e>30 or (e and b not in (45,90)):raise ValueError('Minuto inválido')
    bucket=(3 if b==45 else 7) if e else 0 if b<=15 else 1 if b<=30 else 2 if b<=45 else 4 if b<=60 else 5 if b<=75 else 6
    return b,e,bucket

def build(config, snapshot, espn, previous=None):
    now=datetime.now(timezone.utc).isoformat();count=config['clubs'];total=2*(count-1)
    teams=[]; ids={};names={}
    for i,t in enumerate(snapshot['standings']):
        cid=t['id'] if isinstance(t['id'],int) else zlib.crc32(t['id'].encode())
        ids[t['id']]=cid;names[n(t['name'])]=cid
        teams.append(dict(id=cid,name=t['name'],points=t.get('points',t.get('Pts')),played=t.get('played',t.get('Pld')),
                          goalsFor=t.get('goals_for',t.get('GF')),goalsAgainst=t.get('goals_against',t.get('GA')),position=i+1))
    if len(teams)!=count or len({t['id'] for t in teams})!=count:raise ValueError('Cadastro inválido')
    byid={t['id']:t for t in teams}; matrix={}; wiki_matches=snapshot['matches'].values()
    for m in wiki_matches:
        if 'home_id' in m: h,a=ids[m['home_id']],ids[m['away_id']]
        else:h,a=[names[n(x)] for x in m['teams']]
        matrix[(h,a)]=m['score']
    stats={t['id']:{v:dict(played=0,points=0,wins=0,draws=0,losses=0,goalsFor=0,goalsAgainst=0) for v in ('home','away')} for t in teams}
    for (h,a),(hg,ag) in matrix.items():
        for cid,venue,gf,ga in [(h,'home',hg,ag),(a,'away',ag,hg)]:
            s=stats[cid][venue];s['played']+=1;s['goalsFor']+=gf;s['goalsAgainst']+=ga;s['points']+=3 if gf>ga else 1 if gf==ga else 0;s['wins' if gf>ga else 'draws' if gf==ga else 'losses']+=1
    for t in teams:
        t['goalsFor']=stats[t['id']]['home']['goalsFor']+stats[t['id']]['away']['goalsFor']
        t['goalsAgainst']=stats[t['id']]['home']['goalsAgainst']+stats[t['id']]['away']['goalsAgainst']
    events=espn.get('events',[])
    if len(events)>=1000:raise ValueError('ESPN possivelmente truncada')
    if events and not any(l.get('slug')==config['espn'] for l in espn.get('leagues',[])):raise ValueError('Liga ESPN incorreta')
    sourceids={};date_matches={};clock_matches={};fixture_dates={};excluded=[]
    for e in events:
        if e.get('season',{}).get('year')!=config['year']:continue
        if len(e.get('competitions',[]))!=1:continue
        c=e['competitions'][0];cs=c.get('competitors',[])
        if len(cs)!=2:continue
        resolved={}
        for side in cs:
            candidates={cid for name,cid in names.items() if name in team_keys(side['team'])}
            if len(candidates)==1:
                cid=next(iter(candidates));resolved[side['homeAway']]=(cid,side);sourceids[cid]=str(side['team']['id'])
        if set(resolved)!={'home','away'}:continue
        h,hs=resolved['home'];a,as_=resolved['away']; status=c.get('status',{}).get('type',{})
        if h==a:continue
        try:date=datetime.fromisoformat(e['date'].replace('Z','+00:00'))
        except (KeyError,ValueError):continue
        if status.get('name')=='STATUS_SCHEDULED' and status.get('state')=='pre' and (h,a) not in matrix:
            fixture_dates[h,a]=e['date'];continue
        if not status.get('completed') or status.get('name')!='STATUS_FULL_TIME':continue
        if date>datetime.now(timezone.utc):continue
        try:score=[int(hs['score']),int(as_['score'])]
        except (KeyError,ValueError):continue
        if matrix.get((h,a))!=score:continue
        if (h,a) in date_matches:raise ValueError('Confronto duplicado na mesma temporada')
        m=dict(id=str(e['id']),date=e['date'],home=h,away=a,hg=score[0],ag=score[1])
        date_matches[h,a]=m
        try:
            goals=[];order=[];sid={str(hs['id']):h,str(as_['id']):a}
            for d in c.get('details',[]):
                if not d.get('scoringPlay') or d.get('shootout'):continue
                if d.get('scoreValue')!=1:raise ValueError('Valor do gol inválido')
                credited=sid[str(d['team']['id'])];base,extra,bucket=minute(d['clock']['displayValue'])
                g=dict(team=credited,minute=str(base)+('+'+str(extra) if extra else ''),bin=bucket)
                goals.append(g);order.append((base,extra,d['clock'].get('value'),credited))
            if [sum(g['team']==h for g in goals),sum(g['team']==a for g in goals)]!=score:raise ValueError('Gols incompletos')
            first=None;first_status='goalless'
            if order:
                firstminute=min((g[0],g[1]) for g in order);candidates=[g for g in order if (g[0],g[1])==firstminute]
                if all(isinstance(g[2],(int,float)) for g in candidates):
                    seconds=min(g[2] for g in candidates);candidates=[g for g in candidates if g[2]==seconds]
                cids={g[3] for g in candidates};first=next(iter(cids)) if len(cids)==1 else None;first_status='known' if first is not None else 'ambiguous'
            clock_matches[h,a]={**m,'goals':goals,'firstScorer':first,'firstGoalStatus':first_status}
        except (KeyError,ValueError,TypeError) as exc:excluded.append(dict(id=m['id'],reason=str(exc)))
    if not date_matches:raise ValueError('Nenhum resultado datado conciliado com a Wikipedia')
    for t in teams:
        recent=[]
        for m in date_matches.values():
            cid=t['id'];home=m['home']==cid
            if cid not in (m['home'],m['away']):continue
            gf,ga=(m['hg'],m['ag']) if home else (m['ag'],m['hg'])
            recent.append(dict(**{**m,'date':int(datetime.fromisoformat(m['date'].replace('Z','+00:00')).timestamp()*1000),
                                 'home':byid[m['home']]['name'],'away':byid[m['away']]['name']},
                              points=3 if gf>ga else 1 if gf==ga else 0,opponent=byid[m['away'] if home else m['home']]['name'],
                              venue='Casa' if home else 'Fora',score=f'{gf}–{ga}',round='Rodada a confirmar'))
        recent.sort(key=lambda m:(m['date'],m['id']),reverse=True);t['recent']=recent[:10]
        t['lastMatchId']=recent[0]['id'] if recent else None
        t['lastMatchDate']=recent[0]['date'] if recent else None
        t['sourceId']=sourceids.get(t['id'],'')
    fixtures=[]
    for h in byid:
        for a in byid:
            if h==a or (h,a) in matrix:continue
            date=fixture_dates.get((h,a))
            fixtures.append(dict(id=f'{h}-{a}',home=h,away=a,date=int(datetime.fromisoformat(date.replace('Z','+00:00')).timestamp()*1000) if date else None,
                                 round='Rodada a confirmar',status='scheduled' if date else 'pending'))
    for t in teams:
        if sum(t['id'] in (f['home'],f['away']) for f in fixtures)!=total-t['played']:raise ValueError('Calendário incompatível')
    common=dict(league=config['key'],season=config['year'],fetchedAt=now,sourceUrl=snapshot['source'],license='CC BY-SA 4.0')
    standings={**common,'source':'Wikipédia — colaboradores do artigo','sourceHistoryUrl':snapshot['source']+'?action=history','teams':[{k:v for k,v in t.items() if k not in ('recent','lastMatchId','lastMatchDate')} for t in teams]}
    form={**common,'status':'updated','teams':teams}
    mando={**common,'teams':[dict(id=t['id'],name=t['name'],**stats[t['id']]) for t in teams]}
    clockteams=[dict(id=t['id'],name=t['name'],sourceId=t['sourceId'],completed=t['played']) for t in teams]
    clock={**common,'source':'ESPN + Wikipedia','sourceUrl':'https://www.espn.com/soccer/league/_/name/'+config['espn'],
           'bins':['1–15','16–30','31–45','45+','46–60','61–75','76–90','90+'],
           'teams':clockteams,'matches':sorted(clock_matches.values(),key=lambda m:(m['date'],m['id'])),
           'completedMatches':len(matrix),'excluded':excluded}
    current=dict(date=now[:10],fetchedAt=now,teams=standings['teams'])
    old=(previous or {}).get('current');history=(previous or {}).get('history',[])
    if old and datetime.fromisoformat(old['fetchedAt'])>datetime.fromisoformat(now):raise ValueError('Relógio retrocedeu')
    if old and old['teams']!=current['teams']:history=(history+[old])[-120:]
    changes=dict(current=current,before=old if old and old['teams']!=current['teams'] else (previous or {}).get('before'),
                 round=None,roundBefore=None,history=history)
    badges={str(t['id']):'https://a.espncdn.com/i/teamlogos/soccer/500/'+t['sourceId']+'.png' for t in teams}
    return {'classificacao.json':standings,'forma.json':form,'mando.json':mando,
            'raio-x.json':{**form,'fixtures':fixtures},'relogio-gols.json':clock,'mudancas.json':changes,'badges.json':badges}

def main():
    config=json.loads(Path('league.json').read_text());wiki=read_url(config['source'],5_000_000)
    if config['key']=='br-serie-a':
        from collect_br import parse_snapshot
        snapshot=parse_snapshot(wiki)
    else:
        from parser import parse
        snapshot=parse(wiki,config['key'],dict(clubs=config['clubs'],season=config['season'],article=config['article'],teams='all'))
    espn=json.loads(read_url('https://site.api.espn.com/apis/site/v2/sports/soccer/'+config['espn']+'/scoreboard?dates='+str(config['year'])+'&limit=1000',15_000_000))
    previous=json.loads(Path('mudancas.json').read_text()) if Path('mudancas.json').exists() else None
    data=build(config,snapshot,espn,previous)
    for path,value in data.items():
        tmp=Path(path+'.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2));os.replace(tmp,path)
    print(config['name']+': '+str(len(data['relogio-gols.json']['matches']))+' jogos com eventos; '+str(len(data['raio-x.json']['fixtures']))+' confrontos restantes. Wikipedia + ESPN, sem API paga.')
if __name__=='__main__':main()

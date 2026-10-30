"""Snapshot validado da tabela e matriz; nenhuma inferência de datas ou gols."""
import hashlib
import json
import os
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from wiki_standings import SOURCE, Tables, parse_table, normalized, CLUBS

CODES = ['ATP','ATM','BAH','BOT','CHA','COR','CTB','CRU','FLA','FLU','GRE','INT','MIR','PAL','RBB','REM','SAN','SPA','VAS','VIT']
NAMES = ['Athletico Paranaense','Atlético Mineiro','Bahia','Botafogo','Chapecoense','Corinthians','Coritiba','Cruzeiro','Flamengo','Fluminense','Grêmio','Internacional','Mirassol','Palmeiras','Red Bull Bragantino','Remo','Santos','São Paulo','Vasco da Gama','Vitória']


def parse_snapshot(html):
    standings = parse_table(html)
    parser = Tables(); parser.feed(html)
    candidates = [t for t in parser.tables if t and len(t[0]) == 21
                  and t[0][0] == 'Mandante \\ Visitante' and t[0][1:] == CODES]
    if len(candidates) != 1 or len(candidates[0]) != 21:
        raise ValueError('Matriz única de 20 clubes não encontrada')
    matches = {}; played = Counter(); points = Counter(); gf = Counter(); ga = Counter()
    for i, row in enumerate(candidates[0][1:]):
        if len(row) != 21 or normalized(row[0]) != normalized(NAMES[i]):
            raise ValueError('Ordem ou estrutura de clubes alterada')
        for j, cell in enumerate(row[1:]):
            if i == j:
                if cell not in ('—', '–', ''): raise ValueError('Diagonal inválida')
                continue
            value = re.sub(r'\[[^]]*\]', '', cell).strip()
            score = re.fullmatch(r'(\d{1,2})\s*[–−-]\s*(\d{1,2})', value)
            if not score:
                if value and not re.fullmatch(r'[a-z]|—|–|\d{1,2}/\d{1,2}(?:/\d{2,4})?', value):
                    raise ValueError('Célula de resultado não reconhecida: ' + value)
                continue
            h, a = map(int, score.groups())
            if max(h, a) > 30: raise ValueError('Placar fora dos limites')
            home, away = CLUBS[normalized(NAMES[i])], CLUBS[normalized(NAMES[j])]
            mid = f'br-serie-a:2026:{home}:{away}'
            matches[mid] = dict(id=mid, competition='br-serie-a', status='FT',
                                teams=[NAMES[i], NAMES[j]], score=[h, a],
                                status_basis='Placar na matriz; conciliado com jogos e pontos da tabela',
                                date=None)
            for team in (home, away): played[team] += 1
            points[home] += 3 if h > a else 1 if h == a else 0
            points[away] += 3 if a > h else 1 if h == a else 0
            gf[home] += h; ga[home] += a; gf[away] += a; ga[away] += h
    if not matches: raise ValueError('Nenhum placar encontrado')
    for team in standings:
        if played[team['id']] != team['played'] or points[team['id']] != team['points']:
            raise ValueError('Tabela e matriz ainda não conciliadas: ' + team['name'])
        team.update(goals_for=gf[team['id']], goals_against=ga[team['id']])
    revision = re.search(r'wgRevisionId["\s]*:\s*(\d+)', html)
    return dict(competition='br-serie-a', season=2026, standings=standings, matches=matches,
                source=SOURCE, source_revision=revision.group(1) if revision else None,
                source_sha256=hashlib.sha256(html.encode()).hexdigest(),
                collected_at=datetime.now(timezone.utc).isoformat(),
                attribution='Wikipédia — colaboradores do artigo; CC BY-SA 4.0',
                license_url='https://creativecommons.org/licenses/by-sa/4.0/')


def changes(current, previous):
    if not previous:
        return []  # Bootstrap nunca transforma a temporada inteira em notícias novas.
    if previous.get('season') != current['season']:
        raise ValueError('Temporadas diferentes')
    if set(previous['matches']) - set(current['matches']):
        raise ValueError('Resultados desapareceram; revisão manual necessária')
    return [(m, 'correction' if mid in previous['matches'] else 'newly_observed')
            for mid, m in current['matches'].items()
            if mid not in previous['matches'] or m['score'] != previous['matches'][mid]['score']]


def main():
    req = urllib.request.Request(SOURCE, headers={
        'User-Agent': 'EsporteComValorEditorial/1.0 (https://github.com/obrunofavoretto/motor-editorial-futebol)',
        'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=45) as response:
        raw = response.read(5_000_001)
    if len(raw) > 5_000_000: raise ValueError('Página excedeu tamanho esperado')
    current = parse_snapshot(raw.decode('utf-8'))
    path = Path('data/wiki-br-2026.json')
    previous = json.loads(path.read_text()) if path.exists() else None
    updates = changes(current, previous)
    coverage = {'competitions': {'br-serie-a': {'name': 'Brasileirão Série A', 'teams': 'all'}}}
    out = Path('output/wikipedia'); out.mkdir(parents=True, exist_ok=True)
    chosen = updates
    if previous is None:
        chosen = [(next(iter(current['matches'].values())), 'bootstrap_sample')]
    for match, kind in chosen:
        factual = {**match, 'source': SOURCE, 'collected_at': current['collected_at']}
        draft = analyze(factual, coverage)
        draft.update(observation=kind, match_date=None, source_revision=current['source_revision'],
                     attribution=current['attribution'], license_url=current['license_url'])
        draft['missing'].append('Data da partida indisponível na matriz')
        label = {'bootstrap_sample':'AMOSTRA HISTÓRICA — não é notícia recente',
                 'correction':'CORREÇÃO DE PLACAR — revisar texto anterior',
                 'newly_observed':'PLACAR NOVO NA FONTE — data da partida não confirmada'}[kind]
        draft['notice'] = label
        name = hashlib.sha256(match['id'].encode()).hexdigest()[:24]
        (out / f'{name}.json').write_text(json.dumps(draft, ensure_ascii=False, indent=2))
        (out / f'{name}.md').write_text(f'# {draft["title"]}\n\n{label}\n\n{draft["text"]}\n\nFonte: {SOURCE}\n\n{current["attribution"]}\nLicença: {current["license_url"]}\n\nRevisão editorial obrigatória. Sem cronologia, data, escalações ou análise tática.\n')
    summary = (f"Wikipedia validada: {len(current['standings'])} clubes, "
               f"{len(current['matches'])} placares conciliados. "
               f"Novos/corrigidos: {len(updates)}. Bootstrap: {previous is None}. "
               'Sem consultas à API-Football; sem agendamento.')
    (out / 'summary.txt').write_text(summary)
    path.parent.mkdir(exist_ok=True)
    tmp = path.with_suffix('.tmp'); tmp.write_text(json.dumps(current, ensure_ascii=False, indent=2))
    os.replace(tmp, path)
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as stream: stream.write(summary)


if __name__ == '__main__': main()

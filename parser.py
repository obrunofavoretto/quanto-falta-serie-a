"""Matrizes internacionais com identidade por links, conciliação e falha isolada."""
import argparse
import hashlib
import json
import os
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urlsplit, unquote
from wiki_standings import normalized


def identity(href):
    path = unquote(urlsplit(href).path)
    return path.split('/wiki/', 1)[1] if '/wiki/' in path else None


class LinkedTables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables = []; self.table = None
        self.row = None; self.cell = None; self.depth = 0; self.skip = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style', 'sup'): self.skip += 1
        if tag == 'table':
            self.depth += 1
            if self.depth == 1: self.table = []
        if self.depth != 1: return
        if tag == 'tr': self.row = []
        if tag in ('th', 'td'):
            self.cell = {'text': '', 'links': []}
            # Atributos de span inválidos usam o valor padrão 1 do HTML.
            if any(re.fullmatch(r'\d+', attrs.get(k, '1')) and int(attrs.get(k, '1')) != 1
                   for k in ('colspan', 'rowspan')):
                self.cell['span'] = True
        if tag == 'a' and self.cell is not None and not self.skip:
            key = identity(attrs.get('href', ''))
            if key: self.cell['links'].append(key)

    def handle_data(self, text):
        if self.depth == 1 and self.cell is not None and not self.skip:
            self.cell['text'] += text

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'sup'): self.skip = max(0, self.skip - 1)
        if self.depth == 1:
            if tag in ('th', 'td') and self.cell is not None:
                self.cell['text'] = ' '.join(self.cell['text'].split())
                if self.row is not None: self.row.append(self.cell)
                self.cell = None
            if tag == 'tr' and self.row is not None:
                self.table.append(self.row); self.row = None
        if tag == 'table':
            if self.depth == 1: self.tables.append(self.table); self.table = None
            self.depth -= 1


def unique_link(cell):
    links = set(cell['links'])
    if len(links) != 1: raise ValueError('Identidade do clube ambígua')
    return next(iter(links))


def parse(html, slug, config):
    p = LinkedTables(); p.feed(html)
    size = config['clubs']
    matrices = [t for t in p.tables if t and len(t[0]) == size+1
                and 'Home \\ Away' in t[0][0]['text'] and len(t) == size+1]
    if len(matrices) != 1: raise ValueError('Matriz única não encontrada')
    matrix = matrices[0]
    columns = [unique_link(c) for c in matrix[0][1:]]
    if len(set(columns)) != size: raise ValueError('Colunas duplicadas')
    names = {}; all_matches = {}; played = Counter(); wins = Counter(); draws = Counter()
    gf = Counter(); ga = Counter()
    for row in matrix[1:]:
        if len(row) != size+1 or any(c.get('span') for c in row):
            raise ValueError('Estrutura da matriz alterada')
        home = unique_link(row[0]); names[home] = row[0]['text']
        if home not in columns: raise ValueError('Mandante sem coluna correspondente')
        for away, cell in zip(columns, row[1:]):
            value = cell['text']
            if home == away:
                if value not in ('', '—', '–'): raise ValueError('Diagonal inválida')
                continue
            score = re.fullmatch(r'(\d{1,2})\s*[–−-]\s*(\d{1,2})', value)
            if not score:
                if value not in ('', '—', '–') and not re.fullmatch(r'[a-z]', value):
                    raise ValueError('Resultado múltiplo ou formato não suportado: '+value)
                continue
            h, a = map(int, score.groups())
            if max(h, a) > 30: raise ValueError('Placar inválido')
            mid = slug+':'+config['season']+':'+home+':'+away
            all_matches[mid] = dict(id=mid, home_id=home, away_id=away, score=[h,a], date=None)
            played[home] += 1; played[away] += 1
            gf[home] += h; ga[home] += a; gf[away] += a; ga[away] += h
            if h == a: draws[home] += 1; draws[away] += 1
            else: wins[home if h > a else away] += 1
    if set(names) != set(columns): raise ValueError('Cadastro incompleto ou linhas duplicadas')
    # Seleciona uma classificação única com todos os clubes da competição.
    candidates = []
    for table in p.tables:
        if not table or len(table) != size+1: continue
        header = [c['text'] for c in table[0]]
        if not {'Pld','W','GF','GA','Pts'}.issubset(header): continue
        if not any(c.startswith('Team') for c in header): continue
        ti = next(i for i,c in enumerate(header) if c.startswith('Team'))
        rows = []
        for row in table[1:]:
            if len(row) <= max(header.index(k) for k in ('Pld','W','GF','GA','Pts')): break
            ids = set(row[ti]['links']) & set(columns)
            if not ids:
                # Links de redirecionamento podem diferir; exige nome visível
                # exatamente equivalente e único na matriz.
                ids = {key for key,name in names.items() if normalized(name) == normalized(row[ti]['text'])}
            if len(ids) != 1: break
            team = next(iter(ids))
            try:
                values = {k:int(row[header.index(k)]['text']) for k in ('Pld','W','GF','GA','Pts')}
                draw_key = 'D' if 'D' in header else 'T'
                values['D'] = int(row[header.index(draw_key)]['text'])
            except (ValueError, IndexError): break
            rows.append(dict(id=team, name=names[team], position=len(rows)+1, **values))
        if len(rows) == size and len({r['id'] for r in rows}) == size: candidates.append(rows)
    if len(candidates) != 1: raise ValueError('Classificação geral única não encontrada')
    standings = candidates[0]
    for t in standings:
        key = t['id']
        if (t['Pld'],t['W'],t['D'],t['GF'],t['GA'],t['Pts']) != (played[key],wins[key],draws[key],gf[key],ga[key],3*wins[key]+draws[key]):
            raise ValueError('Tabela e matriz não conciliadas: '+t['name'])
    if config['teams'] != 'all' and not set(config['teams']).issubset(set(names.values())):
        raise ValueError('Clube monitorado não identificado')
    aliases = config.get('aliases', {})
    matches = {}
    for mid, m in all_matches.items():
        teams = [names[m['home_id']], names[m['away_id']]]
        if config['teams'] != 'all' and not set(teams) & set(config['teams']): continue
        matches[mid] = dict(**m, competition=slug, status='FT', teams=[aliases.get(t,t) for t in teams],
                            status_basis='Placar da matriz conciliado com classificação', goals=None)
    return dict(competition=slug, season=config['season'], matches=matches, standings=standings,
                total_league_matches=len(all_matches), collected_at=datetime.now(timezone.utc).isoformat(),
                source='https://en.wikipedia.org/wiki/'+quote(config['article']),
                source_sha256=hashlib.sha256(html.encode()).hexdigest(),
                attribution='Wikipedia contributors, CC BY-SA 4.0',
                license_url='https://creativecommons.org/licenses/by-sa/4.0/')


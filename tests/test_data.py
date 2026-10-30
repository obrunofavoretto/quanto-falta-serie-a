import unittest,json
from pathlib import Path
class DataTests(unittest.TestCase):
 def test_league_and_data(self):
  c=json.loads(Path('league.json').read_text());n=c['clubs'];total=2*(n-1)
  table=json.loads(Path('classificacao.json').read_text());teams=table['teams'];ids={t['id'] for t in teams}
  self.assertEqual(len(ids),n);self.assertEqual(table['league'],c['key'])
  for name in ('forma.json','mando.json','raio-x.json','relogio-gols.json'):
   d=json.loads(Path(name).read_text());self.assertEqual({t['id'] for t in d['teams']},ids)
  fixtures=json.loads(Path('raio-x.json').read_text())['fixtures']
  for t in teams:self.assertEqual(sum(t['id'] in (m['home'],m['away']) for m in fixtures),total-t['played'])

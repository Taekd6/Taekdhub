#!/usr/bin/env python3
"""Contrôle rapide du référentiel : intégrité du .apkg, doublons, anomalies de forme, listes de cartes à risque. Lecture seule (sauf /tmp)."""
import json,glob,re,zipfile,sqlite3,tempfile,os,collections
cards=[]
for f in sorted(glob.glob('referentiel/**/cartes*.jsonl',recursive=True)):
    for l in open(f,encoding='utf-8'):
        c=json.loads(l); c['_f']=f; cards.append(c)
print('cartes',len(cards))
# apkg
z=zipfile.ZipFile('public/anki/taekdhub-referentiel.apkg'); print('zip ok',z.testzip() is None,z.namelist())
d=tempfile.mkdtemp(); z.extract('collection.anki2',d); db=sqlite3.connect(os.path.join(d,'collection.anki2'))
n=db.execute('select count(*) from notes').fetchone()[0]; g=db.execute('select count(distinct guid) from notes').fetchone()[0]
nc=db.execute('select count(*) from cards').fetchone()[0]; empt=db.execute("select count(*) from notes where flds like '%\x1f\x1f%' or flds like '\x1f%'").fetchone()[0]
print('notes',n,'guids distincts',g,'cartes',nc,'champs vides',empt,'decks',db.execute('select count(*) from notes').fetchone()[0] and len(set(r[0] for r in db.execute('select did from cards'))))
# schema/id
ids=collections.Counter(c['id'] for c in cards); print('ids dupliqués',[k for k,v in ids.items() if v>1][:5])
# doublons de recto (global) et verso
rc=collections.defaultdict(list)
for c in cards: rc[re.sub(r'\W+','',c['recto'].lower())].append(c['id'])
dups=[v for v in rc.values() if len(v)>1]; print('rectos identiques (global)',len(dups),dups[:8])
# anomalies de forme
pat={'latex_residuel':r'\\\(|\\\)|\\\[|\[latex\]|\\frac|\\mathrm','accolade_unité':r'\{-?\d\}','verso_vide':r'^\s*$','nan':r'\bNone\b|\bnan\b','HTML':r'<(div|br|span|b)\b','tronqué':r'[,;:(\-+=×/]$'}
for k,p in pat.items():
    hits=[c['id'] for c in cards if re.search(p,c['verso']) or (k!='tronqué' and re.search(p,c['recto']))]
    print(k,len(hits),hits[:10])
# risque
rec=[c for c in cards if 'verso' in (c.get('origine','')+c.get('note','')).lower() and ('vide' in (c.get('origine','')+c.get('note','')).lower() or 'reconstruit' in (c.get('origine','')+c.get('note','')).lower())]
nosrc=[c for c in cards if c['validation']['source'].startswith('aucune')]
inc=[c for c in cards if not c['validation']['exigibilite'].startswith('confirmé')]
av=[c for c in cards if c['validation']['mathematique']!='vérifié']
print('versos reconstruits',len(rec),'sans source',len(nosrc),'exigibilité incertaine',len(inc),'math non vérifié',len(av))
phys=[c for c in cards if '/physique/' in c['_f'] or '/chimie/' in c['_f']]
print('physique/chimie sans source ET à confirmer',sum(1 for c in phys if c['validation']['source'].startswith('aucune') and not c['validation']['exigibilite'].startswith('confirmé')))
# unités: formules physique sans unité détectable
unit=re.compile(r'\b(m|s|kg|J|W|V|A|T|Hz|K|mol|Pa|N|C|F|H|Ω|S|rad|eV|L|bar|°C)\b|[·⁻⁰¹²³⁴⁵⁶⁷⁸⁹]|\bSI\b')
fm=[c for c in phys if c['type']=='formule' and not unit.search(c['verso'])]
print('formules physique/chimie sans unité repérable',len(fm),[c['id'] for c in fm][:25])
json.dump({'rec':[c['id'] for c in rec],'nosrc':[c['id'] for c in nosrc],'fm':[c['id'] for c in fm]},open('/tmp/claude-0/qc.json','w'))

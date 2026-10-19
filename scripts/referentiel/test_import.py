"""Test d'import réel du .apkg dans une collection Anki TEMPORAIRE (jamais le profil principal) : import, réimport, GUID, textes, recouvrements.
Usage : python scripts/referentiel/test_import.py   (nécessite `pip install anki`)."""
import tempfile,os,json,glob,html,re,collections,sys,unicodedata
from anki.collection import Collection,ImportAnkiPackageRequest,ImportAnkiPackageOptions
import os as _o
ROOT=_o.path.abspath(_o.path.join(_o.path.dirname(__file__),'..','..'))
APKG=_o.path.join(ROOT,'public','anki','taekdhub-referentiel.apkg')
tmp=tempfile.mkdtemp(prefix='anki-test-'); path=os.path.join(tmp,'collection.anki2'); print('collection temporaire:',path)
assert 'Anki2' not in path
col=Collection(path)
# anciennes notes factices + historique de révision
basic=col.models.by_name('Basic'); did=col.decks.id('Maths MP::Ancien (factice)')
old=[]
for i in range(6):
    n=col.new_note(basic); n['Front']=f'ancienne carte {i}'; n['Back']=f'réponse {i}'; col.add_note(n,did); old.append(n.id)
cids=[c for n in old for c in col.card_ids_of_note(n)]
for cid in cids[:3]:
    col.sched.answerCard(col.sched.getCard(),3) if False else None
# historique réel : on passe par le planificateur
col.sched.reset() if hasattr(col.sched,'reset') else None
for _ in range(3):
    card=col.sched.getCard()
    if card is None: break
    col.sched.answerCard(card,3)
def snap():
    return dict(notes=col.note_count(),cards=col.card_count(),revlog=col.db.scalar('select count(*) from revlog'),
        oldstate=col.db.all(f"select id,nid,ivl,due,reps,queue from cards where nid in ({','.join(map(str,old))}) order by id"),
        oldnotes=col.db.all(f"select id,guid,mod,flds from notes where id in ({','.join(map(str,old))}) order by id"))
s0=snap(); print('avant import: notes',s0['notes'],'cartes',s0['cards'],'revlog',s0['revlog'])
def do_import(label,**kw):
    opts=ImportAnkiPackageOptions(**kw)
    r=col.import_anki_package(ImportAnkiPackageRequest(package_path=APKG,options=opts))
    L=r.log; print(label,'| nouvelles',len(L.new),'doublons',len(L.duplicate),'maj',len(L.updated),'conflits',len(L.conflicting),'ignorées',len(L.first_field_match) if hasattr(L,'first_field_match') else '-')
    return L
L1=do_import('IMPORT 1',merge_notetypes=False)
s1=snap(); print('après import 1: notes',s1['notes'],'cartes',s1['cards'],'revlog',s1['revlog'])
print('anciennes notes/cartes/historique inchangés :',s1['oldstate']==s0['oldstate'] and s1['oldnotes']==s0['oldnotes'] and s1['revlog']==s0['revlog'])
L2=do_import('IMPORT 2 (même paquet)',merge_notetypes=False)
s2=snap(); print('après import 2: notes',s2['notes'],'cartes',s2['cards'],'revlog',s2['revlog'],'| identique à import 1 :',(s2['notes'],s2['cards'])==(s1['notes'],s1['cards']))
print('anciennes inchangées après import 2 :',s2['oldstate']==s0['oldstate'] and s2['oldnotes']==s0['oldnotes'])
# GUID / champs / modèles
print('GUID distincts:',col.db.scalar('select count(distinct guid) from notes'),'/',col.db.scalar('select count(*) from notes'))
print('notetypes:',[m['name'] for m in col.models.all()])
nt=col.models.by_name('TaekdHub — Référentiel'); print('champs du modèle:',[f['name'] for f in nt['flds']],'gabarits',len(nt['tmpls']))
print('paquets importés:',len([d for d in col.decks.all_names_and_ids() if d.name.startswith('TaekdHub::')]),'| ex.',[d.name for d in col.decks.all_names_and_ids() if d.name.startswith('TaekdHub::')][:3])
# comparaison exacte avec le JSONL
J={}
for f in glob.glob(ROOT+'/referentiel/**/cartes*.jsonl',recursive=True):
    for l in open(f,encoding='utf-8'):
        c=json.loads(l); J[c['id']]=c
import sys as _s; _s.path.insert(0,_o.path.dirname(__file__)); from referentiel import cell
bad=[];empty=0;byid={}
for nid in col.find_notes('"note:TaekdHub — Référentiel"'):
    n=col.get_note(nid); r,v,i=n['Recto'],n['Verso'],n['Id']; byid[i]=nid
    if not r.strip() or not v.strip(): empty+=1
    c=J.get(i)
    if c is None or r!=cell(c['recto']) or v!=cell(c['verso']): bad.append(i)
print('notes TaekdHub:',len(byid),'| champs vides:',empty,'| écarts texte vs JSONL:',len(bad),bad[:5],'| ids JSONL absents:',len(set(J)-set(byid)))
# recouvrements
pairs=[('ra-83','cp-116'),('rn-114','ev-125'),('rn-110','ev-162'),('rn-112','ev-163'),('rn-207','ta-33')]
for a,b in pairs:
    na,nb=col.get_note(byid[a]),col.get_note(byid[b])
    da=col.decks.name(col.get_card(col.card_ids_of_note(na.id)[0]).did); db_=col.decks.name(col.get_card(col.card_ids_of_note(nb.id)[0]).did)
    print('recouvrement',a,b,'| guid distincts',na.guid!=nb.guid,'| paquets',da.split('::')[-1],'/',db_.split('::')[-1])
# rendu : question/réponse d'une carte test, tout le texte passe par le moteur
bad_render=0;spec=collections.Counter()
for i,nid in byid.items():
    card=col.get_card(col.card_ids_of_note(nid)[0]); q=card.question(); a=card.answer()
    if J[i]['recto'][:12] not in html.unescape(re.sub('<[^>]+>','',q)).replace('\xa0',' ') and J[i]['recto'][:12] not in html.unescape(q): bad_render+=1
for c in J.values():
    for ch in c['recto']+c['verso']:
        o=ord(ch)
        if 0x1D400<=o<=0x1D7FF: spec['alphanumériques mathématiques U+1D400…']+=1
        elif unicodedata.category(ch)=='Mn': spec['diacritiques combinants (ex. vecteur E⃗)']+=1
print('rendu: cartes dont la question ne contient pas son recto:',bad_render)
print('caractères à risque de police:',dict(spec))
ex=col.get_card(col.card_ids_of_note(byid['og-06'])[0]); print('og-06 rendu:',re.sub('<[^>]+>',' ',ex.answer())[:160].replace('\n',' '))
col.close(); print('terminé, dossier temporaire:',tmp)

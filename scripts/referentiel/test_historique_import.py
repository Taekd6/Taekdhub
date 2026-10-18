"""Vérifie qu'un import (x2) ne touche ni les anciennes notes ni leur historique de révision (collection temporaire factice).
Usage : python scripts/referentiel/test_historique_import.py   (nécessite `pip install anki`)."""
import tempfile,os
from anki.collection import Collection,ImportAnkiPackageRequest,ImportAnkiPackageOptions
import os as _o
ROOT=_o.path.abspath(_o.path.join(_o.path.dirname(__file__),'..','..'))
APKG=_o.path.join(ROOT,'public','anki','taekdhub-referentiel.apkg')
tmp=tempfile.mkdtemp(prefix='anki-test-hist-'); col=Collection(os.path.join(tmp,'collection.anki2'))
basic=col.models.by_name('Basic'); did=col.decks.id('Maths MP::Ancien (factice)'); col.decks.select(did)
ids=[]
for i in range(6):
    n=col.new_note(basic); n['Front']=f'ancienne {i}'; n['Back']=f'rep {i}'; col.add_note(n,did); ids.append(n.id)
for r in (3,3,1,4):
    card=col.sched.getCard()
    assert card is not None
    col.sched.answerCard(card,r)
q=f"nid in ({','.join(map(str,ids))})"
before=(col.db.all(f"select id,cid,ease,ivl,type from revlog order by id"),col.db.all(f"select id,ivl,due,reps,lapses,queue,type,factor from cards where {q} order by id"),col.db.all(f"select id,guid,mod,flds from notes where id in ({",".join(map(str,ids))}) order by id"))
print('historique créé: revlog',len(before[0]),'cartes avec reps>0:',sum(1 for c in before[1] if c[3]>0))
for k in (1,2):
    col.import_anki_package(ImportAnkiPackageRequest(package_path=APKG,options=ImportAnkiPackageOptions()))
    after=(col.db.all(f"select id,cid,ease,ivl,type from revlog where cid in (select id from cards where {q}) order by id"),col.db.all(f"select id,ivl,due,reps,lapses,queue,type,factor from cards where {q} order by id"),col.db.all(f"select id,guid,mod,flds from notes where id in ({",".join(map(str,ids))}) order by id"))
    print(f'après import {k}: revlog des anciennes cartes identique:',after[0]==before[0],'| état des cartes identique:',after[1]==before[1],'| notes identiques:',after[2]==before[2],'| total notes',col.note_count())
col.close()

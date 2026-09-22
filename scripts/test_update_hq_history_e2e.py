"""Test bout en bout : deux passages successifs puis une panne totale.

Tourne dans un dossier temporaire pour ne rien écrire dans le dépôt.
"""
import json, os, tempfile, importlib.util
ICI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("m", os.path.join(ICI, "update_hq_history.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
os.chdir(tempfile.mkdtemp(prefix="hq-hist-test-"))

def payload(n, base):   # n points de 15 min à partir de 00:00 le 22
    det=[{"date":f"2026-09-22T{h:02d}:{mm:02d}:00","valeurs":{"demandeTotal":base+h*100}}
         for h in range(n) for mm in (0,)]
    return {"details":det}
def payload_prod(n):
    return {"details":[{"date":f"2026-09-22T{h:02d}:00:00",
            "valeurs":{"hydraulique":30000+h*50,"eolien":800,"thermique":5,"solaire":0,"autres":10}}
            for h in range(n)]}
def payload_ech(n):
    return [{"date":f"2026-09-22T{(h+4)%24:02d}:00:00+00:00","exportations_total":1200+h,
             "exportations_newengland":-800,"exportations_newyork":-900,
             "exportations_ontario":1200,"exportations_newbrunswick":0} for h in range(n)]

# passage 1 : 6 h de données
m.recuperer=lambda url: payload(6,20000) if 'demande' in url else (payload_prod(6) if 'production' in url else payload_ech(6))
print("=== passage 1 ==="); m.main()
j1=json.load(open('data/hq/2026-09-22.json')); s1=json.load(open('data/hq/daily-summary.json'))

# passage 2 : l'API a avancé à 10 h — doit fusionner, pas dupliquer
m.recuperer=lambda url: payload(10,20000) if 'demande' in url else (payload_prod(10) if 'production' in url else payload_ech(10))
print("\n=== passage 2 (API avancée) ==="); m.main()
j2=json.load(open('data/hq/2026-09-22.json')); s2=json.load(open('data/hq/daily-summary.json'))

print("\n=== vérifications ===")
print(f"  pts demande : {len(j1['demand']['t'])} → {len(j2['demand']['t'])}")
assert len(j2['demand']['t'])==10, j2['demand']['t']
assert j2['demand']['t']==sorted(j2['demand']['t']), "doit rester trié"
assert len(set(j2['demand']['t']))==10, "aucun doublon"
assert len(s2['jours'])==1 and s2['jours'][0]['date']=='2026-09-22'
print(f"  pointe recalculée : {s1['jours'][0]['demande']['max']} → {s2['jours'][0]['demande']['max']}")
assert s2['jours'][0]['demande']['max']==20900, s2['jours'][0]
idx=json.load(open('data/hq/index.json')); print("  index :",idx['dates'])
print("  taille fichier jour :",os.path.getsize('data/hq/2026-09-22.json'),"o | résumé :",os.path.getsize('data/hq/daily-summary.json'),"o")

# passage 3 : toutes les sources tombent → ne doit RIEN écraser
def boom(url): raise RuntimeError("API injoignable")
m.recuperer=boom
print("\n=== passage 3 (toutes sources en échec) ==="); code=m.main()
j3=json.load(open('data/hq/2026-09-22.json'))
assert code==1, "doit signaler l'échec"
assert j3==j2, "les données existantes ne doivent pas être touchées"
print("  ✅ code de sortie 1, données intactes")
print("\nE2E OK")

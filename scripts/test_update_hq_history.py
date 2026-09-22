"""Tests unitaires : fuseaux, fusion des séries, résumé, extraction."""
import json, os, importlib.util
ICI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("m", os.path.join(ICI, "update_hq_history.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

# ── 1. Fuseaux : naïf = heure locale, UTC = converti ──
print("— horodatages —")
for brut in ["2026-09-21T23:45:00", "2026-09-20T04:00:00+00:00", "2026/09/11T16:00:00Z", None, "n'importe quoi"]:
    print(f"  {str(brut):32} → {m.jour_et_heure(brut)}")

# ── 2. Fusion : dédoublonnage + tri + conservation de l'existant ──
print("\n— fusion —")
a = m.fusionner({}, {"01:00":{"mw":100},"00:00":{"mw":90}}, ["mw"])
print("  premier passage :", a)
b = m.fusionner(a, {"00:30":{"mw":95},"01:00":{"mw":111}}, ["mw"])
print("  2e passage (insert + écrase) :", b)
assert b["t"]==["00:00","00:30","01:00"], b
assert b["mw"]==[90,95,111], b
print("  ✅ trié, dédoublonné, valeur mise à jour")

# ── 3. Résumé : pointe, creux, moyennes ──
print("\n— résumé —")
contenu={"date":"2026-09-22",
 "demand":{"t":["00:00","01:00","02:00"],"mw":[20000,25000,18000]},
 "production":{"t":["00:00","01:00"],"hydraulique":[19000,23000],"eolien":[1000,1500],
               "thermique":[0,0],"solaire":[None,None],"autres":[None,None]},
 "exchange":{"t":["00:00"],"exportations_total":[1200],"exportations_newengland":[-800],
             "exportations_newyork":[-900],"exportations_ontario":[1200],"exportations_newbrunswick":[0]}}
r=m.resumer("2026-09-22",contenu); print(" ",json.dumps(r,ensure_ascii=False))
assert r["demande"]["max"]==25000 and r["demande"]["heure_pointe"]=="01:00", r
assert r["demande"]["min"]==18000, r
assert r["production_moy"]["hydraulique"]==21000.0, r
assert "solaire" not in r["production_moy"], "une source toute vide ne doit pas apparaître"
print("  ✅ pointe/creux/heure de pointe/moyennes corrects")

# ── 4. Extraction depuis les formes réelles de l'API ──
print("\n— extraction —")
dem={"details":[{"date":"2026-09-22T00:00:00","valeurs":{"demandeTotal":21000.4}},
                {"date":"2026-09-22T00:15:00","valeurs":{}},          # trou
                {"date":"2026-09-21T23:45:00","valeurs":{"demandeTotal":20500}}]}
d=m.extraire_demande(dem); print(" ",{k:len(v) for k,v in d.items()})
assert set(d)=={"2026-09-22","2026-09-21"} and len(d["2026-09-22"])==1, d
prod={"details":[{"date":"2026-09-22T00:00:00","valeurs":{"hydraulique":30000,"eolien":900,"thermique":12}}]}
p=m.extraire_production(prod); assert p["2026-09-22"]["00:00"]["hydraulique"]==30000
ech=[{"date":"2026-09-22T04:00:00+00:00","exportations_total":1248.5,"exportations_newengland":-868.6}]
e=m.extraire_echanges(ech)
print("  échange UTC 04:00 →", list(e.keys()), list(e.values())[0].keys().__class__.__name__, list(list(e.values())[0].keys())[:1])
assert "2026-09-22" in e and "00:00" in e["2026-09-22"], f"04:00 UTC devrait devenir 00:00 heure QC : {e}"
print("  ✅ trous ignorés, UTC converti en heure du Québec")
print("\nTOUS LES TESTS PASSENT")

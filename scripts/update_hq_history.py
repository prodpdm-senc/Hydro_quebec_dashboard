#!/usr/bin/env python3
"""Historise les données ouvertes d'Hydro-Québec dans le dépôt.

Le tableau de bord ne garde que 7 jours dans le localStorage du visiteur, ce qui
interdit toute lecture saisonnière. Ce script, lancé par GitHub Actions, archive
deux niveaux de détail :

  data/hq/<AAAA-MM-JJ>.json   pleine résolution 15 min, conservé 90 jours
  data/hq/daily-summary.json  une ligne par jour, conservée indéfiniment
  data/hq/index.json          liste des journées à pleine résolution

Le résumé quotidien est le socle des analyses pluriannuelles (pointe, moyennes,
régression demande/température). Il pèse quelques centaines d'octets par jour.

Lancé depuis Actions, donc sans la contrainte CORS du navigateur : on interroge
les points d'accès d'Hydro-Québec directement.
"""

import json
import os
import glob
import urllib.request
from datetime import datetime, timezone, timedelta

try:
    from zoneinfo import ZoneInfo
    QC = ZoneInfo('America/Montreal')
except Exception:                                    # pragma: no cover
    QC = timezone(timedelta(hours=-5))

RACINE = 'data/hq'
RETENTION_JOURS = 90          # pleine résolution ; le résumé n'expire pas

SOURCES = {
    'demand':     'https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/demande.json',
    'production': 'https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/production.json',
    'exchange':   'https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/'
                  'importations-exportations-avec-transits/exports/json?lang=fr&limit=2000',
}

SOURCES_PROD = ['hydraulique', 'eolien', 'thermique', 'solaire', 'autres']
# Champs d'échange conservés tels quels : les conventions de signe sont celles
# de l'API, on ne les réinterprète pas ici.
CHAMPS_ECHANGE = [
    'exportations_total', 'exportations_newengland', 'exportations_newyork',
    'exportations_ontario', 'exportations_newbrunswick',
]


def recuperer(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def jour_et_heure(brut):
    """('AAAA-MM-JJ', 'HH:MM') en heure du Québec, à partir d'un horodatage API.

    Les jeux demande/production renvoient un horodatage sans fuseau, déjà en
    heure locale ; le jeu des échanges renvoie de l'UTC explicite. Mélanger les
    deux sans conversion décalerait les échanges de 4 ou 5 heures.
    """
    if not brut:
        return None, None
    t = str(brut).replace('/', '-').replace('Z', '+00:00')
    try:
        d = datetime.fromisoformat(t)
    except ValueError:
        return None, None
    d = d.astimezone(QC) if d.tzinfo else d.replace(tzinfo=QC)
    return d.strftime('%Y-%m-%d'), d.strftime('%H:%M')


def fusionner(existant, nouveaux, colonnes):
    """Fusionne des séries à colonnes parallèles, en dédoublonnant sur l'heure."""
    index = {h: i for i, h in enumerate(existant.get('t', []))}
    sortie = {'t': list(existant.get('t', []))}
    for c in colonnes:
        col = list(existant.get(c, []))
        col += [None] * (len(sortie['t']) - len(col))
        sortie[c] = col

    for heure, valeurs in sorted(nouveaux.items()):
        if heure in index:
            i = index[heure]
        else:
            i = len(sortie['t'])
            index[heure] = i
            sortie['t'].append(heure)
            for c in colonnes:
                sortie[c].append(None)
        for c in colonnes:
            if valeurs.get(c) is not None:
                sortie[c][i] = valeurs[c]

    ordre = sorted(range(len(sortie['t'])), key=lambda i: sortie['t'][i])
    return {'t': [sortie['t'][i] for i in ordre],
            **{c: [sortie[c][i] for i in ordre] for c in colonnes}}


def extraire_demande(payload):
    par_jour = {}
    for r in (payload or {}).get('details', []):
        jour, heure = jour_et_heure(r.get('date'))
        mw = (r.get('valeurs') or {}).get('demandeTotal')
        if jour and isinstance(mw, (int, float)):
            par_jour.setdefault(jour, {})[heure] = {'mw': round(float(mw), 1)}
    return par_jour


def extraire_production(payload):
    par_jour = {}
    for r in (payload or {}).get('details', []):
        jour, heure = jour_et_heure(r.get('date'))
        v = r.get('valeurs') or {}
        if not jour:
            continue
        ligne = {s: (round(float(v[s]), 1) if isinstance(v.get(s), (int, float)) else None)
                 for s in SOURCES_PROD}
        if any(x is not None for x in ligne.values()):
            par_jour.setdefault(jour, {})[heure] = ligne
    return par_jour


def extraire_echanges(payload):
    par_jour = {}
    for r in (payload or []):
        jour, heure = jour_et_heure(r.get('date'))
        if not jour:
            continue
        ligne = {c: (round(float(r[c]), 1) if isinstance(r.get(c), (int, float)) else None)
                 for c in CHAMPS_ECHANGE}
        if any(x is not None for x in ligne.values()):
            par_jour.setdefault(jour, {})[heure] = ligne
    return par_jour


def stats(valeurs):
    v = [x for x in valeurs if isinstance(x, (int, float))]
    if not v:
        return None
    return {'min': round(min(v), 1), 'max': round(max(v), 1),
            'moy': round(sum(v) / len(v), 1), 'n': len(v)}


def resumer(jour, contenu):
    """Une ligne de résumé quotidien : pointe, creux, moyennes par source."""
    dem = contenu.get('demand', {})
    prod = contenu.get('production', {})
    ech = contenu.get('exchange', {})

    ligne = {'date': jour}

    s = stats(dem.get('mw', []))
    if s:
        mws = dem['mw']
        i = max((k for k in range(len(mws)) if isinstance(mws[k], (int, float))),
                key=lambda k: mws[k], default=None)
        ligne['demande'] = {**s, 'heure_pointe': dem['t'][i] if i is not None else None}

    moyennes = {}
    for src in SOURCES_PROD:
        s = stats(prod.get(src, []))
        if s:
            moyennes[src] = s['moy']
    if moyennes:
        moyennes['total'] = round(sum(moyennes.values()), 1)
        ligne['production_moy'] = moyennes

    moy_ech = {}
    for c in CHAMPS_ECHANGE:
        s = stats(ech.get(c, []))
        if s:
            moy_ech[c] = s['moy']
    if moy_ech:
        ligne['echanges_moy'] = moy_ech

    return ligne


def main():
    os.makedirs(RACINE, exist_ok=True)

    recolte = {}
    for cle, url in SOURCES.items():
        try:
            payload = recuperer(url)
            recolte[cle] = {'demand': extraire_demande,
                            'production': extraire_production,
                            'exchange': extraire_echanges}[cle](payload)
            print(f"{cle}: {sum(len(v) for v in recolte[cle].values())} points "
                  f"sur {len(recolte[cle])} journée(s)")
        except Exception as e:
            print(f"⚠️  {cle}: échec ({e}) — on continue avec les autres")
            recolte[cle] = {}

    if not any(recolte.values()):
        print("Aucune source n'a répondu, rien à écrire.")
        return 1

    jours = sorted({j for src in recolte.values() for j in src})
    colonnes = {'demand': ['mw'], 'production': SOURCES_PROD, 'exchange': CHAMPS_ECHANGE}

    for jour in jours:
        chemin = f'{RACINE}/{jour}.json'
        contenu = {}
        if os.path.exists(chemin):
            with open(chemin) as f:
                contenu = json.load(f)

        for cle in ('demand', 'production', 'exchange'):
            nouveaux = recolte[cle].get(jour)
            if nouveaux:
                contenu[cle] = fusionner(contenu.get(cle, {}), nouveaux, colonnes[cle])

        contenu['date'] = jour
        contenu['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        with open(chemin, 'w') as f:
            json.dump(contenu, f, separators=(',', ':'))
        print(f"  {jour}: {len(contenu.get('demand', {}).get('t', []))} pts demande, "
              f"{len(contenu.get('production', {}).get('t', []))} pts production, "
              f"{len(contenu.get('exchange', {}).get('t', []))} pts échanges")

    # ── Purge de la pleine résolution ──────────────────────────────────────
    limite = (datetime.now(QC) - timedelta(days=RETENTION_JOURS)).strftime('%Y-%m-%d')
    for f in glob.glob(f'{RACINE}/????-??-??.json'):
        if os.path.basename(f)[:10] < limite:
            os.remove(f)
            print(f"  purge {f}")

    # ── Résumé quotidien, reconstruit pour les journées disponibles ────────
    resume = {}
    chemin_resume = f'{RACINE}/daily-summary.json'
    if os.path.exists(chemin_resume):
        with open(chemin_resume) as f:
            resume = {r['date']: r for r in json.load(f).get('jours', [])}

    for f in sorted(glob.glob(f'{RACINE}/????-??-??.json')):
        with open(f) as fh:
            contenu = json.load(fh)
        ligne = resumer(contenu['date'], contenu)
        if len(ligne) > 1:
            resume[ligne['date']] = ligne

    with open(chemin_resume, 'w') as f:
        json.dump({'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                   'jours': [resume[d] for d in sorted(resume)]}, f, separators=(',', ':'))
    print(f"daily-summary.json : {len(resume)} journée(s)")

    dispo = sorted(os.path.basename(f)[:10]
                   for f in glob.glob(f'{RACINE}/????-??-??.json'))
    with open(f'{RACINE}/index.json', 'w') as f:
        json.dump({'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                   'dates': dispo}, f)
    print(f"index.json : {len(dispo)} journée(s) à pleine résolution")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

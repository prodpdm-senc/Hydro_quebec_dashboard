#!/usr/bin/env python3
"""
Collecte les données québécoises d'Hydro-Québec dans des fichiers journaliers.

Raison d'être : les sources ne gardent qu'une fenêtre glissante très courte —
48 h pour la demande, 24 h pour la production et les échanges — et l'archive
officielle s'arrête au 1er janvier 2025. Une journée qui sort de la fenêtre sans
avoir été enregistrée est définitivement perdue.

Le proxy local écrivait déjà ces fichiers, mais seulement quand quelqu'un
ouvrait le tableau de bord sur la machine d'Alex. Ce script tourne dans GitHub
Actions, comme le collecteur IESO.

Chaque relevé est rangé dans le fichier du jour correspondant à son propre
horodatage, en heure de l'Est. Une exécution peut donc remplir plusieurs
journées et rattraper les trous laissés par une exécution manquée. L'écriture
est idempotente : relire, fusionner par horodatage, réécrire trié.
"""

import glob
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

EST = ZoneInfo("America/Toronto")
RACINE = "data/quebec"
ODS = "https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets"
HQ = "https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json"

# Les séries volumineuses sont conservées moins longtemps : les niveaux pèsent
# environ 300 Ko par jour contre quelques kilo-octets pour la demande.
RETENTION_JOURS = {
    "demande": 730,
    "production": 730,
    "echanges": 730,
    "turbine": 730,
    "niveaux": 730,
}


def telecharger(url, timeout=120):
    requete = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(requete, timeout=timeout) as reponse:
        return json.loads(reponse.read())


def export_ods(dataset, where=None, select=None):
    params = {"lang": "fr"}
    if where:
        params["where"] = where
    if select:
        params["select"] = select
    url = f"{ODS}/{dataset}/exports/json?{urllib.parse.urlencode(params)}"
    donnees = telecharger(url)
    if not isinstance(donnees, list):
        raise RuntimeError(donnees.get("message", "réponse ODS inattendue"))
    return donnees


def jour_est(horodatage):
    """Date de l'Est d'un horodatage ISO, naïf (heure locale HQ) ou avec fuseau."""
    if not horodatage:
        return None
    texte = str(horodatage).replace("/", "-").replace("Z", "+00:00")
    try:
        instant = datetime.fromisoformat(texte)
    except ValueError:
        return None
    # Les fichiers demande.json et production.json donnent déjà l'heure locale.
    if instant.tzinfo is None:
        return instant.strftime("%Y-%m-%d")
    return instant.astimezone(EST).strftime("%Y-%m-%d")


def nombre(valeur):
    try:
        resultat = float(valeur)
    except (TypeError, ValueError):
        return None
    return resultat


def en_secondes(horodatage):
    """ISO -> secondes Unix. Un horodatage sans fuseau est de l'heure de l'Est."""
    texte = str(horodatage).replace("/", "-").replace("Z", "+00:00")
    instant = datetime.fromisoformat(texte)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=EST)
    return int(instant.timestamp())


def fusionner(domaine, releves):
    """Range les relevés par journée et fusionne avec ce qui est déjà sur disque."""
    par_jour = {}
    for releve in releves:
        jour = jour_est(releve.get("t"))
        if jour:
            par_jour.setdefault(jour, []).append(releve)

    ecrits = {}
    for jour, nouveaux in sorted(par_jour.items()):
        dossier = f"{RACINE}/{domaine}"
        os.makedirs(dossier, exist_ok=True)
        chemin = f"{dossier}/{jour}.json"

        existants = {}
        if os.path.exists(chemin):
            with open(chemin) as fichier:
                for releve in deserialiser(domaine, json.load(fichier)):
                    existants[cle(releve)] = releve

        avant = len(existants)
        for releve in nouveaux:
            existants[cle(releve)] = releve

        points = sorted(existants.values(), key=cle)

        # Ne réécrire que si les données bougent. Le champ "maj" change à chaque
        # passage : sans cette garde, chaque exécution produirait un commit
        # même quand rien de neuf n'est publié.
        if len(points) == avant and os.path.exists(chemin):
            ecrits[jour] = (len(points), 0)
            continue

        with open(chemin, "w") as fichier:
            json.dump(
                {
                    "jour": jour,
                    "domaine": domaine,
                    "maj": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    **serialiser(domaine, points),
                },
                fichier,
                separators=(",", ":"),
                ensure_ascii=False,
            )
        ecrits[jour] = (len(points), len(points) - avant)
    return ecrits


def cle(releve):
    """
    Un relevé est identifié par son horodatage et, s'il y a lieu, sa série.

    L'horodatage est ramené en secondes Unix plutôt que comparé tel quel : le
    format colonnaire réécrit "2026-09-17T20:00:00Z" en "...+00:00", et une clé
    textuelle faisait alors réinsérer à chaque exécution des points déjà
    présents.
    """
    horodatage = releve.get("t")
    try:
        reference = en_secondes(horodatage)
    except (ValueError, TypeError):
        reference = str(horodatage)
    return (str(reference), str(releve.get("s") or ""))


# Les domaines à séries répètent le nom de station et la région sur chaque
# point : 692 Ko par jour pour les niveaux, soit 121 Mo sur la rétention, dans
# un dépôt dont l'historique ne se dégonflera jamais. On les écrit donc en
# colonnes — métadonnées une fois par série, puis deux tableaux parallèles
# d'horodatages (secondes Unix) et de valeurs. Les autres domaines pèsent
# quelques kilo-octets et gardent la forme lisible.
SERIES = {"turbine": ("m3s", ("nom", "region")), "niveaux": ("m", ("region",))}


def depuis_secondes(secondes):
    return datetime.fromtimestamp(secondes, timezone.utc).isoformat()


def serialiser(domaine, points):
    if domaine not in SERIES:
        return {"points": points}

    champ, meta_champs = SERIES[domaine]
    series = {}
    for point in points:
        nom = point.get("s") or ""
        serie = series.setdefault(nom, {**{m: point.get(m) for m in meta_champs}, "t": [], "v": []})
        serie["t"].append(en_secondes(point["t"]))
        serie["v"].append(point.get(champ))
    return {"unite": champ, "series": series}


def deserialiser(domaine, contenu):
    if domaine not in SERIES:
        return contenu.get("points", [])

    champ, meta_champs = SERIES[domaine]
    points = []
    for nom, serie in contenu.get("series", {}).items():
        meta = {m: serie.get(m) for m in meta_champs}
        for secondes, valeur in zip(serie.get("t", []), serie.get("v", [])):
            points.append({"t": depuis_secondes(secondes), "s": nom, champ: valeur, **meta})
    return points


# ── Collecteurs ──────────────────────────────────────────────────────────────

def collecter_demande():
    donnees = telecharger(f"{HQ}/demande.json")
    return [
        {"t": d["date"], "mw": nombre(d.get("valeurs", {}).get("demandeTotal"))}
        for d in donnees.get("details", [])
        if d.get("valeurs", {}).get("demandeTotal") is not None
    ]


def collecter_production():
    donnees = telecharger(f"{HQ}/production.json")
    releves = []
    for d in donnees.get("details", []):
        valeurs = d.get("valeurs") or {}
        if not valeurs:
            continue
        releve = {"t": d["date"]}
        for champ in ("total", "hydraulique", "eolien", "solaire", "thermique", "autres"):
            valeur = nombre(valeurs.get(champ))
            if valeur is not None:
                releve[champ] = valeur
        releves.append(releve)
    return releves


def collecter_echanges():
    lignes = export_ods("importations-exportations-avec-transits")
    releves = []
    for ligne in lignes:
        if not ligne.get("date"):
            continue
        releve = {"t": ligne["date"]}
        for champ, valeur in ligne.items():
            if champ == "date":
                continue
            nombre_valeur = nombre(valeur)
            if nombre_valeur is not None:
                releve[champ] = nombre_valeur
        releves.append(releve)
    return releves


def collecter_turbine():
    lignes = export_ods(
        "donnees-hydrometriques",
        where='depil_json_type_point_donnee LIKE "Débit turbiné"',
        select="nom,regionqc,depil_json_type_point_donnee,split_date,split_value",
    )
    releves = []
    for ligne in lignes:
        valeur = nombre(ligne.get("split_value"))
        horodatage = ligne.get("split_date")
        if valeur is None or not horodatage:
            continue
        serie = ligne.get("depil_json_type_point_donnee", "")
        releves.append(
            {
                "t": str(horodatage).replace("/", "-"),
                "s": serie.replace("Débit turbiné - ", ""),
                "nom": ligne.get("nom"),
                "region": ligne.get("regionqc"),
                "m3s": valeur,
            }
        )
    return releves


def collecter_niveaux():
    depuis = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
    lignes = export_ods(
        "donnees-hydrometeorologiques",
        where=f"composition_depil_type_point_donnee=\"Niveau\" AND date > '{depuis}'",
        select="nom,regionqc,date,valeur",
    )
    releves = []
    for ligne in lignes:
        valeur = nombre(ligne.get("valeur"))
        if valeur is None or not ligne.get("date"):
            continue
        releves.append(
            {
                "t": ligne["date"],
                "s": ligne.get("nom"),
                "region": ligne.get("regionqc"),
                "m": valeur,
            }
        )
    return releves


COLLECTEURS = {
    "demande": collecter_demande,
    "production": collecter_production,
    "echanges": collecter_echanges,
    "turbine": collecter_turbine,
    "niveaux": collecter_niveaux,
}


def purger(domaine):
    limite = datetime.now(timezone.utc) - timedelta(days=RETENTION_JOURS[domaine])
    for chemin in glob.glob(f"{RACINE}/{domaine}/????-??-??.json"):
        jour = os.path.basename(chemin)[:-5]
        try:
            date = datetime.strptime(jour, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if date < limite:
            os.remove(chemin)
            print(f"  purgé {chemin}")


def index():
    resume = {}
    for domaine in COLLECTEURS:
        jours = sorted(
            os.path.basename(c)[:-5]
            for c in glob.glob(f"{RACINE}/{domaine}/????-??-??.json")
        )
        if jours:
            resume[domaine] = {"debut": jours[0], "fin": jours[-1], "jours": len(jours)}
    os.makedirs(RACINE, exist_ok=True)
    with open(f"{RACINE}/index.json", "w") as fichier:
        json.dump(
            {
                "maj": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "domaines": resume,
            },
            fichier,
            indent=1,
            ensure_ascii=False,
        )
    return resume


def main():
    demandes = sys.argv[1:] or list(COLLECTEURS)
    echecs = []

    for domaine in demandes:
        if domaine not in COLLECTEURS:
            print(f"domaine inconnu : {domaine}", file=sys.stderr)
            echecs.append(domaine)
            continue
        try:
            releves = COLLECTEURS[domaine]()
            ecrits = fusionner(domaine, releves)
            print(f"{domaine}: {len(releves)} relevés")
            for jour, (total, ajouts) in sorted(ecrits.items()):
                print(f"  {jour}: {total} points (+{ajouts})")
            purger(domaine)
        except Exception as erreur:  # une source en panne ne doit pas bloquer les autres
            print(f"{domaine}: ÉCHEC — {erreur}", file=sys.stderr)
            echecs.append(domaine)

    print("\nindex:", json.dumps(index(), ensure_ascii=False))

    if len(echecs) == len(demandes):
        print("\nToutes les sources ont échoué.", file=sys.stderr)
        return 1
    if echecs:
        print(f"\nSources en échec : {', '.join(echecs)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

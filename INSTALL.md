# 🚀 Guide d'installation - Storage Manager

## Étapes rapides

### 1️⃣ Copier les fichiers

Vous avez besoin de **2 fichiers** :

```
├── storage-manager.js    (NOUVEAU)
└── index.html            (MODIFIÉ)
```

**Depuis votre dépôt local :**
```bash
git pull origin main
# Remplacez ou fusionnez les fichiers fournis
```

### 2️⃣ Vérifier que tout fonctionne

1. Ouvrez le dashboard dans votre navigateur
2. Ouvrez la console (F12)
3. Vérifiez que vous voyez ceci au démarrage :
   ```
   🚀 Initialisation dashboard
   💾 Mémoire 7j rolling initialisée
   ✅ Dashboard prêt
   ```

4. Testez dans la console :
   ```javascript
   StorageManager.getStats()
   ```

### 3️⃣ Tester la persistance

1. Cliquez sur l'onglet "Demande" 
2. Attendez le chargement (voir le log)
3. Allez à la console et tapez :
   ```javascript
   StorageManager.logStats()
   ```

Vous devriez voir quelque chose comme :
```
📊 Mémoire: 120 demandes, 115 prod, 110 échanges | 245.32KB (4.90%)
```

### 4️⃣ Vérifier la structure

Vérifiez que votre repo a maintenant :
```
Hydro_quebec_dashboard/
├── index.html                    ✅ (modifié avec StorageManager)
├── storage-manager.js            ✅ (nouveau)
├── STORAGE_MANAGER.md            ✅ (documentation)
├── INSTALL.md                    ✅ (ce fichier)
├── data/
├── .github/
└── README.md
```

## ✨ Résultat attendu

Après l'installation, vous aurez :

✅ **Persistance automatique** des 7 derniers jours  
✅ **Chargement rapide** - les anciennes données se chargent depuis localStorage  
✅ **Historique préservé** - même après fermeture/rechargement du navigateur  
✅ **Nettoyage automatique** - les données de plus de 7 jours sont supprimées  

## 🔍 Qu'est-ce qui a changé ?

### Dans `index.html` :

1. **1 ligne** avant `</head>` :
   ```html
   <script src="storage-manager.js"></script>
   ```

2. **3 appels** au stockage ajoutés :
   - Dans `loadDemandTab()` → sauvegarde demand
   - Dans `loadProductionTab()` → sauvegarde production  
   - Dans `loadExchangeTab()` → sauvegarde exchange

3. **1 initialisation** au démarrage :
   ```javascript
   StorageManager.init();
   ```

### Nouveaux fichiers :

1. **`storage-manager.js`** (8KB)
   - Module autonome de gestion du stockage
   - Aucune dépendance externe
   - Interface simple : `init()`, `save()`, `load()`, etc.

2. **Documentation**
   - `STORAGE_MANAGER.md` - API complète
   - `INSTALL.md` - Ce guide

## 🐛 Si ça ne marche pas

### Vérifier le localStorage

```javascript
// Dans la console du navigateur
typeof localStorage          // Doit retourner "object"
localStorage.length         // Doit retourner un nombre
localStorage.getItem('hq-theme')  // Doit retourner quelque chose
```

### Vérifier que storage-manager.js est chargé

```javascript
typeof StorageManager       // Doit retourner "object"
StorageManager.getStats     // Doit être une fonction
```

### Vider et recommencer

```javascript
StorageManager.clear();
// Rechargez la page
```

## 📊 Données sauvegardées

Pour chaque type (demand, production, exchange) :
```javascript
{
  date: "2026-05-16T10:30:00Z",
  valeurs: { /* données du moment */ }
}
```

Jusqu'à **672 points par type** = 7 jours × 96 points/jour (15 min interval).

## 🔐 Sécurité

- ✅ Tout local (localStorage du navigateur)
- ✅ Aucun appel réseau supplémentaire
- ✅ Aucune donnée personnelle supplémentaire
- ✅ Aucun cookie tiers

## 🚀 Commit dans Git

Une fois testé et validé :

```bash
cd Hydro_quebec_dashboard
git add storage-manager.js index.html STORAGE_MANAGER.md INSTALL.md
git commit -m "feat: add 7-day rolling storage for energy data

- Add StorageManager module for localStorage persistence
- Auto-save demand, production, exchange data
- Auto-cleanup after 7 days
- 250KB storage usage (~5% of limit)
- Compatible with all modern browsers"
git push origin main
```

## ✅ Checklist de validation

- [ ] `storage-manager.js` copié dans le repo
- [ ] `index.html` remplacé (ou fusionné)
- [ ] Console affiche "💾 Mémoire 7j rolling initialisée"
- [ ] `StorageManager.getStats()` fonctionne
- [ ] Données sauvegardées après chargement des tabs
- [ ] Nettoyage automatique toutes les heures
- [ ] Navigateur supporte localStorage (tous les modernes ✅)

---

**Besoin d'aide ?** Consultez `STORAGE_MANAGER.md` pour l'API complète.

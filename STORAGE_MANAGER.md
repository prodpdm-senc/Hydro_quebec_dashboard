# 📊 Storage Manager - Mémoire 7 Jours Rolling

## Vue d'ensemble

Le **Storage Manager** ajoute une **persistance des données énergétiques** sur **7 jours** au dashboard. Les données sont stockées dans le `localStorage` du navigateur et automatiquement nettoyées quotidiennement.

## ✨ Fonctionnalités

### 1. **Fenêtre Rolling de 7 jours**
- Conserve l'historique des 7 derniers jours de données
- Données automatiquement supprimées après 7 jours
- Nettoyage programmé chaque heure

### 2. **Types de données persistées**
- **Demande** : Consommation électrique Hydro-Québec
- **Production** : Mix énergétique (hydro, éolien, thermique, solaire)
- **Échanges** : Flux interprovincial (NE, NY, Ontario, NB)

### 3. **Stockage intelligent**
- Sauvegarde automatique lors de chaque chargement de tab
- Pas de doublons (détection par timestamp)
- Sauvegarde en arrière-plan (localStorage)

## 📁 Fichiers modifiés

```
Hydro_quebec_dashboard/
├── index.html                    (MODIFIÉ - intégration StorageManager)
├── storage-manager.js            (NOUVEAU - module de persistance)
└── STORAGE_MANAGER.md           (NOUVEAU - cette documentation)
```

## 🔧 Modifications apportées

### 1. `storage-manager.js` (NOUVEAU)
Module indépendant avec les méthodes suivantes :

```javascript
StorageManager.init()           // Initialiser au démarrage
StorageManager.save()           // Sauvegarder 1 point
StorageManager.saveBatch()      // Sauvegarder plusieurs points
StorageManager.load()           // Charger toutes les données
StorageManager.getLastDays()    // Obtenir les 7 derniers jours
StorageManager.cleanup()        // Nettoyer les anciennes données
StorageManager.clear()          // Vider complètement
StorageManager.getStats()       // Obtenir stats (nb points, taille)
StorageManager.logStats()       // Afficher stats dans console
```

### 2. `index.html` (MODIFIÉ)
Les modifications incluent :

1. **Script loading** (avant `</head>`)
   ```html
   <script src="storage-manager.js"></script>
   ```

2. **Initialisation** (au démarrage de l'app)
   ```javascript
   StorageManager.init();
   ```

3. **Persistance dans loadDemandTab()**
   ```javascript
   StorageManager.saveBatch(store.demand.map(d => ({ 
     type: "demand", 
     date: d.date, 
     valeurs: d.valeurs 
   })));
   ```

4. **Persistance dans loadProductionTab()**
   ```javascript
   StorageManager.saveBatch(store.production.map(d => ({ 
     type: "production", 
     date: d.date, 
     valeurs: d.valeurs 
   })));
   ```

5. **Persistance dans loadExchangeTab()**
   ```javascript
   StorageManager.saveBatch(store.exchange.map(d => ({ 
     type: "exchange", 
     date: d.date, 
     valeurs: d 
   })));
   ```

## 📊 Utilisation

### Accéder aux données stockées (dans la console navigateur)

```javascript
// Voir toutes les données
StorageManager.load()

// Voir les 7 derniers jours
StorageManager.getLastDays()

// Voir les statistiques
StorageManager.getStats()
// Sortie:
// {
//   demandPoints: 672,
//   productionPoints: 645,
//   exchangePoints: 650,
//   storageSizeKB: "245.32",
//   storagePercent: "4.90",
//   lastUpdated: "2026-05-16 10:30:45"
// }

// Afficher les stats dans la console
StorageManager.logStats()

// Vider complètement le stockage
StorageManager.clear()
```

## 🎯 Cas d'usage

### Cas 1: Graphiques historiques
Les données persistées permettent maintenant de créer des graphiques couvrant les 7 derniers jours même après un rechargement de page.

### Cas 2: Comparaisons temporelles
Comparer la production/demande de différents jours de la semaine.

### Cas 3: Détection de tendances
Identifier les tendances sur une semaine complète.

## 💾 Capacité de stockage

- **Limite localStorage** : ~5-10 MB par domaine
- **Taille estimée (7 jours)** : ~250 KB
- **Utilisation** : ~5% de la limite

L'application avertit automatiquement si le localStorage est plein.

## 🔄 Auto-nettoyage

Le système nettoie automatiquement les données :
- **Période** : Toutes les heures
- **Critère** : Données plus vieilles que 7 jours
- **Action** : Suppression silencieuse (log en console)

## 🐛 Dépannage

### Les données ne sont pas sauvegardées ?

1. Vérifiez que le localStorage n'est pas désactivé
   ```javascript
   localStorage.setItem('test', 'value'); // Doit fonctionner
   ```

2. Vérifiez le navigateur support localStorage
   ```javascript
   !!window.localStorage
   ```

3. Regardez la console pour les erreurs
   ```javascript
   StorageManager.logStats() // Devrait afficher les stats
   ```

### Le stockage est plein ?

```javascript
// Vider et recommencer
StorageManager.clear();
```

## 📈 Prochaines améliorations possibles

- [ ] Migration vers IndexedDB pour plus de capacité (~50+ MB)
- [ ] Export des 7 jours en CSV
- [ ] Graphiques comparatifs jour vs jour
- [ ] Prédictions simples basées sur l'historique
- [ ] Synchronisation cloud optionnelle

## 🔐 Sécurité

- Aucune donnée n'est envoyée vers des serveurs externes
- Tout reste local dans le navigateur
- Les utilisateurs peuvent vider le stockage à tout moment
- Pas de cookies tiers, pas de tracking

## 📝 Version

- **StorageManager v1.0**
- Date: 2026-05-16
- Compatible: tous les navigateurs modernes

---

Pour toute question, consultez la console navigateur et utilisez `StorageManager.logStats()`.

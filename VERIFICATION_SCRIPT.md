# ✅ Script de vérification d'installation

Copiez-collez ces commandes dans la **console navigateur (F12)** pour vérifier que tout fonctionne.

---

## 🔍 Test 1: StorageManager existe et est initialisé

```javascript
// Doit retourner "object"
console.log('StorageManager existe?', typeof StorageManager);

// Doit retourner true
console.log('Méthodes disponibles?', 
  typeof StorageManager.init === 'function' &&
  typeof StorageManager.save === 'function' &&
  typeof StorageManager.getStats === 'function'
);
```

**Résultat attendu:**
```
StorageManager existe? object
Méthodes disponibles? true
```

---

## 📊 Test 2: Vérifier les statistiques

```javascript
const stats = StorageManager.getStats();
console.table({
  'Demand Points': stats.demandPoints,
  'Production Points': stats.productionPoints,
  'Exchange Points': stats.exchangePoints,
  'Storage Size (KB)': stats.storageSizeKB,
  'Usage %': stats.storagePercent,
  'Last Updated': stats.lastUpdated
});
```

**Résultat attendu:** Tableau avec 0+ points dans chaque catégorie

---

## 🔐 Test 3: localStorage est activé

```javascript
// Doit retourner true
console.log('localStorage activé?', typeof localStorage === 'object');

// Doit afficher une clé hq-energy-history
const allKeys = Object.keys(localStorage);
console.log('Clés localStorage:', allKeys.filter(k => k.includes('hq')));

// Doit montrer les données structurées
const data = localStorage.getItem('hq-energy-history');
console.log('Données présentes?', data ? 'OUI' : 'NON');
```

**Résultat attendu:**
```
localStorage activé? true
Clés localStorage: ['hq-energy-history', 'hq-theme', 'hq-console', 'hq-debug']
Données présentes? OUI
```

---

## 📈 Test 4: Charger les données

```javascript
const data = StorageManager.load();
console.log('Demande:', {
  points: data.demand.length,
  first: data.demand[0]?.date,
  last: data.demand[data.demand.length-1]?.date
});

console.log('Production:', {
  points: data.production.length,
  first: data.production[0]?.date,
  last: data.production[data.production.length-1]?.date
});

console.log('Échanges:', {
  points: data.exchange.length,
  first: data.exchange[0]?.date,
  last: data.exchange[data.exchange.length-1]?.date
});
```

**Résultat attendu:** Voir les points et dates croissantes

---

## 🔄 Test 5: Fonctionnalité getLastDays

```javascript
const last7 = StorageManager.getLastDays(7);
const last24h = StorageManager.getLastDays(1);

console.log('Derniers 7 jours:', {
  demand: last7.demand.length,
  production: last7.production.length,
  exchange: last7.exchange.length
});

console.log('Dernières 24h:', {
  demand: last24h.demand.length,
  production: last24h.production.length,
  exchange: last24h.exchange.length
});
```

**Résultat attendu:** Nombres décroissants (7j > 24h)

---

## 🎯 Test 6: Sauvegarder manuellement

```javascript
// Créer un point test
const testData = {
  type: 'demand',
  date: new Date().toISOString(),
  valeurs: { demandeTotal: 39999 }
};

// Sauvegarder
StorageManager.save('demand', testData);

// Vérifier
const saved = StorageManager.load();
const testPoint = saved.demand.find(d => d.valeurs.demandeTotal === 39999);
console.log('Point test sauvegardé?', !!testPoint);

// Nettoyer le test
if (testPoint) {
  const idx = saved.demand.indexOf(testPoint);
  saved.demand.splice(idx, 1);
  localStorage.setItem('hq-energy-history', JSON.stringify(saved));
  console.log('Point test supprimé');
}
```

**Résultat attendu:**
```
Point test sauvegardé? true
Point test supprimé
```

---

## 🗑️ Test 7: Nettoyage

```javascript
const before = StorageManager.getStats();
console.log('Avant nettoyage:', before);

StorageManager.cleanup();

const after = StorageManager.getStats();
console.log('Après nettoyage:', after);

console.log('Différence:', {
  demand: before.demandPoints - after.demandPoints,
  production: before.productionPoints - after.productionPoints,
  exchange: before.exchangePoints - after.exchangePoints
});
```

**Résultat attendu:** Différences = 0 (aucune donnée > 7j)

---

## 🎬 Test 8: Afficher les stats en console

```javascript
StorageManager.logStats();
```

**Résultat attendu:**
```
📊 Mémoire: 672 demandes, 650 prod, 645 échanges | 245.32KB (4.90%)
```

---

## 📋 Checklist de validation complète

Copiez-collez ce bloc complet pour faire tous les tests d'un coup :

```javascript
console.log('=== VERIFICATION COMPLETE STORAGE MANAGER ===\n');

// Test 1
console.log('✓ Test 1: StorageManager existe');
console.log('  typeof StorageManager:', typeof StorageManager);

// Test 2
console.log('\n✓ Test 2: Statistiques');
const stats = StorageManager.getStats();
console.table(stats);

// Test 3
console.log('\n✓ Test 3: localStorage');
console.log('  localStorage activé:', typeof localStorage === 'object');
console.log('  Données présentes:', !!localStorage.getItem('hq-energy-history'));

// Test 4
console.log('\n✓ Test 4: Charger les données');
const data = StorageManager.load();
console.log('  Demand:', data.demand.length, 'points');
console.log('  Production:', data.production.length, 'points');
console.log('  Exchange:', data.exchange.length, 'points');

// Test 5
console.log('\n✓ Test 5: Plage de dates');
if (data.demand.length > 0) {
  const first = new Date(data.demand[0].date);
  const last = new Date(data.demand[data.demand.length-1].date);
  const days = (last - first) / (1000 * 60 * 60 * 24);
  console.log('  Plage temporelle:', days.toFixed(1), 'jours');
}

// Test 6
console.log('\n✓ Test 6: Afficher stats');
StorageManager.logStats();

console.log('\n✅ TOUS LES TESTS PASSÉS!');
```

---

## 🔧 Si un test échoue

### `StorageManager is not defined`
❌ **Problème:** Le script n'a pas été chargé  
✅ **Solution:** 
- Vérifiez que `storage-manager.js` existe dans le répertoire
- Vérifiez le Network tab (F12) que le script se charge
- Rechargez la page (Ctrl+R)

### `localStorage is not available`
❌ **Problème:** localStorage est désactivé ou mode privé  
✅ **Solution:**
- Désactiver le mode privé/incognito
- Vérifier les paramètres du navigateur
- Utiliser un autre navigateur pour tester

### Zéro points sauvegardés
❌ **Problème:** Les données ne sont pas rechargées  
✅ **Solution:**
- Cliquez sur l'onglet "Demande" pour charger les données
- Attendez que le chargement se termine
- Vérifiez la console pour les erreurs

### Différence entre 7j et 24h = 0
❌ **Problème:** Pas assez de données  
✅ **Solution:**
- Attendez 24h pour avoir un historique complet
- Ou rechargez plusieurs fois les onglets
- Testez avec `StorageManager.getLastDays(1)` qui doit être < 7j

---

## 📈 Interprétation des stats

```
📊 Mémoire: 672 demandes, 650 prod, 645 échanges | 245.32KB (4.90%)
       ↑         ↑              ↑        ↑         ↑       ↑
   Nom      672 pts        650 pts    645 pts   Taille Pourcent
                           (7 jours)           de la limite
```

**Normal:**
- Demand, Production, Exchange entre 600-700 (7 jours)
- Taille < 500 KB
- Pourcent < 10%

**Anormal:**
- Points = 0 → Les données ne se sauvegardent pas
- Taille > 1MB → Trop de données
- Pourcent > 50% → localStorage presque plein

---

## 🧹 Réinitialiser complètement

Si quelque chose ne marche pas :

```javascript
// Vider TOUT le stockage
localStorage.clear();

// Confirmer que c'est vide
console.log('localStorage vide?', localStorage.length === 0);

// Rechargez la page
location.reload();

// Re-testez
StorageManager.getStats();
```

---

## ✨ Succès!

Si tous les tests passent, vous êtes **prêt à utiliser** le Storage Manager! 🎉

Les données seront maintenant sauvegardées automatiquement dans les 7 derniers jours.

---

**Besoin d'aide?** Consultez `STORAGE_MANAGER.md` pour l'API complète.

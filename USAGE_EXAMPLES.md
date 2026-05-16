# 📋 Exemples d'utilisation - Storage Manager

## 🎬 Lors du chargement de la page

### Console au démarrage
```
🚀 Initialisation dashboard 
💾 Mémoire 7j rolling initialisée
🇨🇦 Chargement Canada tab
✅ Dashboard prêt
```

### Lors du chargement d'un onglet (ex: Demande)
```
🔄 Chargement Demande
✅ Demande: 120 pts · actuelle 39,450 MW
```

À ce moment, les données sont **automatiquement sauvegardées** dans le localStorage.

---

## 💻 Utilisation en console navigateur (F12)

### 1. Voir les statistiques

```javascript
StorageManager.logStats()
```

**Résultat :**
```
📊 Mémoire: 672 demandes, 650 prod, 645 échanges | 245.32KB (4.90%)
```

### 2. Obtenir les stats en objet JavaScript

```javascript
const stats = StorageManager.getStats();
console.log(stats);
```

**Résultat :**
```javascript
{
  demandPoints: 672,
  productionPoints: 650,
  exchangePoints: 645,
  storageSizeKB: "245.32",
  storagePercent: "4.90",
  lastUpdated: "2026-05-16 11:30:45"
}
```

### 3. Charger les 7 derniers jours

```javascript
const data = StorageManager.getLastDays();
console.log(data);
```

**Résultat :**
```javascript
{
  demand: [
    { date: "2026-05-09T10:30:00Z", valeurs: { demandeTotal: 38500 } },
    { date: "2026-05-09T10:45:00Z", valeurs: { demandeTotal: 38600 } },
    // ... 670 entrées
  ],
  production: [ /* idem */ ],
  exchange: [ /* idem */ ],
  lastUpdated: 1715850645123
}
```

### 4. Accéder directement aux données brutes

```javascript
const allData = StorageManager.load();
console.log('Nombre de points demand:', allData.demand.length);
console.log('Dernière mise à jour:', new Date(allData.lastUpdated));
```

### 5. Vider le stockage (tout)

```javascript
StorageManager.clear();
// Console: 🗑️ Mémoire 7 jours vidée
```

---

## 📊 Cas d'usage pratiques

### Cas 1: Analyser la demande moyenne par jour

```javascript
const data = StorageManager.getLastDays();
const grouped = {};

data.demand.forEach(point => {
  const day = new Date(point.date).toLocaleDateString();
  if (!grouped[day]) grouped[day] = [];
  grouped[day].push(point.valeurs.demandeTotal);
});

const averages = {};
Object.entries(grouped).forEach(([day, values]) => {
  const avg = values.reduce((a, b) => a + b) / values.length;
  averages[day] = Math.round(avg);
});

console.table(averages);
```

**Résultat :**
```
┌────────────────┬────────────┐
│ (index)        │ Values     │
├────────────────┼────────────┤
│ 5/9/2026       │ 38500      │
│ 5/10/2026      │ 39200      │
│ 5/11/2026      │ 38800      │
│ ...            │ ...        │
└────────────────┴────────────┘
```

### Cas 2: Trouver le pic de production sur 7 jours

```javascript
const data = StorageManager.getLastDays();
const allProduction = data.production;

const maxProduction = allProduction.reduce((max, current) => {
  const currentTotal = (current.valeurs.hydraulique || 0) +
                      (current.valeurs.eolien || 0) +
                      (current.valeurs.thermique || 0) +
                      (current.valeurs.solaire || 0);
  const maxTotal = (max.valeurs.hydraulique || 0) +
                  (max.valeurs.eolien || 0) +
                  (max.valeurs.thermique || 0) +
                  (max.valeurs.solaire || 0);
  return currentTotal > maxTotal ? current : max;
});

console.log('Pic de production:', maxProduction);
// Résultat: 
// {
//   date: "2026-05-15T14:30:00Z",
//   valeurs: { hydraulique: 25000, eolien: 5000, ... }
// }
```

### Cas 3: Exporter en CSV (les 7 derniers jours)

```javascript
const data = StorageManager.getLastDays();

let csv = "Date,Demande (MW),Hydro (MW),Éolien (MW)\n";
data.demand.forEach((d, i) => {
  const prod = data.production[i];
  csv += `${d.date},${d.valeurs.demandeTotal},${prod?.valeurs.hydraulique || 0},${prod?.valeurs.eolien || 0}\n`;
});

// Créer le fichier
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'energy-7days.csv';
a.click();
```

### Cas 4: Calculer le surplus/déficit sur 7 jours

```javascript
const data = StorageManager.getLastDays();

const balances = data.demand.map((d, i) => {
  const dem = d.valeurs.demandeTotal;
  const prod = (data.production[i]?.valeurs.hydraulique || 0) +
              (data.production[i]?.valeurs.eolien || 0) +
              (data.production[i]?.valeurs.thermique || 0) +
              (data.production[i]?.valeurs.solaire || 0);
  return {
    date: d.date,
    surplus: prod - dem,
    ratio: ((prod / dem) * 100).toFixed(1) + '%'
  };
});

console.table(balances);
```

---

## 🔍 Monitorer en temps réel

### Créer une fonction de monitoring

```javascript
function monitorStorage() {
  setInterval(() => {
    const stats = StorageManager.getStats();
    console.clear();
    console.log('=== STORAGE MONITOR ===');
    console.log(`Demand: ${stats.demandPoints} points`);
    console.log(`Production: ${stats.productionPoints} points`);
    console.log(`Exchange: ${stats.exchangePoints} points`);
    console.log(`Size: ${stats.storageSizeKB}KB / ${stats.storagePercent}%`);
    console.log(`Last update: ${stats.lastUpdated}`);
  }, 5000); // Rafraîchir chaque 5 secondes
}

// Démarrer
monitorStorage();
```

---

## 📝 Intégrer dans votre propre code

### Exemple: Créer un graphique des 7 derniers jours

```javascript
// Récupérer les données
const data = StorageManager.getLastDays();

// Préparer les labels et valeurs
const labels = data.demand.map(d => {
  const dt = new Date(d.date);
  return dt.toLocaleDateString() + ' ' + dt.getHours() + 'h';
});

const values = data.demand.map(d => d.valeurs.demandeTotal);

// Créer le chart (exemple avec Chart.js)
new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [{
      label: 'Demande (7j)',
      data: values,
      borderColor: '#4a7fa5',
      fill: false
    }]
  }
});
```

---

## 🧹 Maintenance manuelle

### Nettoyer les données manuellement

```javascript
// Vérifier avant de nettoyer
StorageManager.logStats();

// Nettoyer les anciennes données (> 7 jours)
StorageManager.cleanup();

// Vérifier après
StorageManager.logStats();
```

### Réinitialiser complètement

```javascript
// ⚠️ ATTENTION: Cela supprime TOUT
StorageManager.clear();

// Pour confirmer, vérifier
localStorage.getItem('hq-energy-history')  // Doit être null
```

---

## 🚀 Prochaines étapes

- [ ] Créer un onglet "Historique 7j" dans le dashboard
- [ ] Ajouter des graphiques de tendances
- [ ] Implémenter des alertes sur les anomalies
- [ ] Exporter automatiquement en CSV chaque semaine

---

**Besoin d'aide ?** Allez voir `STORAGE_MANAGER.md` pour la documentation complète.

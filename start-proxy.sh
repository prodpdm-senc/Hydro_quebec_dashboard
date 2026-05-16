#!/bin/bash
# Lancer le serveur proxy Hydro-Québec

cd "$(dirname "$0")"

echo "🚀 Démarrage du serveur proxy..."
echo "📊 Serveur lancé sur http://localhost:3001"
echo "🔗 Endpoints disponibles:"
echo "   - /api/hydro-quebec/demande"
echo "   - /api/hydro-quebec/production"
echo "   - /api/hydro-quebec/exchange"
echo "   - /api/ieso/realtime"
echo "   - /health (santé du serveur)"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter"
echo ""

node proxy-server.js

#!/bin/sh
# Entrypoint script - s'exécute en root pour créer les dossiers dans les volumes

# Créer les dossiers nécessaires dans les volumes montés
mkdir -p /app/data/backups
mkdir -p /app/public/uploads/logos

# Donner les permissions à nodejs
chown -R nodejs:nodejs /app/data
chown -R nodejs:nodejs /app/public/uploads

# Lancer la commande en tant que nodejs
exec su-exec nodejs "$@"

# kiss-forms

Formulaires web avec admin, sauvegarde brouillon, export PDF/JPG. Pensé pour les studios de design qui envoient des questionnaires à leurs clients.

## Install

```bash
git clone <repo-url>
cd kiss-forms/app
cp .env.example .env
# Éditer .env avec vos valeurs
npm install
```

## Usage

```bash
# Dev
npm run dev

# Production
NODE_ENV=production npm start
```

L'admin est accessible sur `/<ADMIN_URL_PATH>` (défini dans `.env`).
Les formulaires sont accessibles sur `/f/<slug>`.
Les projets multi-formulaires sur `/p/<slug>`.

## Config

| Variable | Description | Requis |
|----------|-------------|--------|
| `ADMIN_PASSWORD` | Mot de passe admin | oui |
| `ADMIN_URL_PATH` | Chemin URL secret du panel admin | oui |
| `SESSION_SECRET` | Clé de session | non |
| `PORT` | Port serveur (défaut: 3000) | non |
| `BACKUP_RETENTION_WEEKS` | Rétention des backups (défaut: 4) | non |

## Stack

- Express 4 + SQLite (better-sqlite3)
- Vanilla JS côté client (pas de framework)
- 3 thèmes CSS : Material, Code, Editorial
- Export PDF (pdfkit) et JPG (node-canvas)
- Rate limiting, Helmet, CSP

## Dev

```bash
npm run dev       # serveur avec --watch
npm test          # 175 tests (Jest + Supertest)
npm run test:coverage
```

## License

[MIT](LICENSE)

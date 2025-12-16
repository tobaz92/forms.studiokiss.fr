require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Vérification des variables d'environnement requises
if (!process.env.ADMIN_PASSWORD) {
  console.error('ERREUR: ADMIN_PASSWORD est requis dans le fichier .env');
  process.exit(1);
}

if (!process.env.ADMIN_URL_PATH) {
  console.error('ERREUR: ADMIN_URL_PATH est requis dans le fichier .env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Traefik) - nécessaire pour rate limiting correct
app.set('trust proxy', 1);
const isDev = process.env.NODE_ENV === 'development';

// Security headers avec helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"], // Permet les onclick inline
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Permet le chargement des fonts
}));

// CORS configuré correctement
app.use(cors({
  origin: isDev ? true : 'https://forms.studiokiss.fr',
  credentials: true
}));

// Logging des requêtes (combined format en prod, dev format sinon)
app.use(morgan(isDev ? 'dev' : 'combined'));

app.use(express.json({ limit: '1mb' }));

// Rate limiting pour le login admin (seulement en prod)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  skip: () => isDev,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting pour les soumissions
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  message: { error: 'Trop de soumissions, réessayez plus tard' },
  skip: () => isDev,
  standardHeaders: true,
  legacyHeaders: false,
});

// Import des routes
const adminRoutes = require('./routes/admin/index');
const publicRoutes = require('./routes/public');

// Import du module de backup
const backup = require('./utils/backup');

// Routes API - rate limit sur login
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin', adminRoutes);

// Rate limit sur submit AVANT les routes public
app.use('/api/form/:slug/submit', submitLimiter);
app.use('/api', publicRoutes);

// Headers restrictifs pour les fichiers uploadés (empêche l'exécution)
app.use('/uploads', (req, res, next) => {
  // Forcer le téléchargement au lieu de l'exécution
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}, express.static(path.join(__dirname, 'public', 'uploads')));

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route admin (URL secrète)
app.get(`/${process.env.ADMIN_URL_PATH}`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Route formulaire client
app.get('/f/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route formulaire client avec données préremplies
app.get('/f/:slug/:prefill', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route projet client (accès à tous les formulaires d'un projet)
app.get('/p/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'project.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Page 404 minimaliste (ne révèle rien sur l'application)
const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
    .c { text-align: center; }
    h1 { font-size: 72px; margin: 0; color: #999; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="c">
    <h1>404</h1>
    <p>Not Found</p>
  </div>
</body>
</html>`;

// Bloquer l'accès à la racine (ne révèle pas l'existence de l'app)
app.get('/', (req, res) => {
  res.status(404).send(notFoundHtml);
});

// 404 pour toutes les autres routes non définies
app.use((req, res) => {
  // Retourner JSON pour les routes API
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route non trouvée' });
  }
  res.status(404).send(notFoundHtml);
});

// Démarrage du scheduler de backup (uniquement en production)
if (process.env.NODE_ENV === 'production') {
  backup.startScheduler();
}

// Démarrage
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           Kiss Forms v2 - Studio Kiss                 ║
╠═══════════════════════════════════════════════════════╣
║  Serveur démarré sur http://localhost:${PORT}            ║
║  Admin: http://localhost:${PORT}/${process.env.ADMIN_URL_PATH.substring(0, 15)}...  ║
╚═══════════════════════════════════════════════════════╝
  `);
});

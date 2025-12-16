const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Sessions en mémoire
const sessions = new Map();
const SESSION_TIMEOUT = 3600000; // 1 heure
const MAX_SESSIONS = 100;
const isDev = process.env.NODE_ENV === 'development';

// Nettoyage périodique des sessions expirées
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) sessions.delete(token);
  }
}, 5 * 60 * 1000);
cleanupInterval.unref();

// Comparaison en temps constant
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    const padded = Buffer.alloc(bufA.length);
    bufB.copy(padded, 0, 0, Math.min(bufB.length, bufA.length));
    crypto.timingSafeEqual(bufA, padded);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Validation et parsing d'ID numérique
function parseId(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId) || numericId <= 0) return null;
  return numericId;
}

// Middleware d'authentification
function authMiddleware(req, res, next) {
  if (isDev) return next();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const session = sessions.get(token);
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expirée' });
  }

  session.expiresAt = Date.now() + SESSION_TIMEOUT;
  next();
}

// Login
router.post('/login', (req, res) => {
  if (isDev) {
    const token = 'dev-token-' + crypto.randomBytes(8).toString('hex');
    sessions.set(token, {
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TIMEOUT
    });
    return res.json({ token, dev: true });
  }

  const { password } = req.body;
  if (!safeCompare(password || '', process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  if (sessions.size >= MAX_SESSIONS) {
    let oldestToken = null;
    let oldestTime = Infinity;
    for (const [token, session] of sessions.entries()) {
      if (session.createdAt < oldestTime) {
        oldestTime = session.createdAt;
        oldestToken = token;
      }
    }
    if (oldestToken) sessions.delete(oldestToken);
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TIMEOUT
  });

  res.json({ token });
});

// Logout
router.post('/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  sessions.delete(token);
  res.json({ success: true });
});

// Vérifier la session
router.get('/check-session', authMiddleware, (req, res) => {
  res.json({ valid: true });
});

module.exports = { router, authMiddleware, parseId };

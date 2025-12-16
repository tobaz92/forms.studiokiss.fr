const express = require('express');
const router = express.Router();
const db = require('../../database');
const fs = require('fs');
const path = require('path');
const backup = require('../../utils/backup');
const { authMiddleware } = require('./auth');

// Rate limiting pour backups (1 par minute par session)
const backupLastAccess = new Map();
const BACKUP_COOLDOWN_MS = 60 * 1000;

function checkBackupCooldown(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const now = Date.now();
  const lastAccess = backupLastAccess.get(token);

  if (lastAccess && (now - lastAccess) < BACKUP_COOLDOWN_MS) {
    const remaining = Math.ceil((BACKUP_COOLDOWN_MS - (now - lastAccess)) / 1000);
    res.status(429).json({ error: `Veuillez attendre ${remaining}s avant le prochain backup` });
    return false;
  }

  // Nettoyer les anciennes entrées
  if (backupLastAccess.size > 100) {
    const oldestAllowed = now - BACKUP_COOLDOWN_MS * 2;
    for (const [key, time] of backupLastAccess) {
      if (time < oldestAllowed) backupLastAccess.delete(key);
    }
  }

  return { token, now };
}

// Télécharger la DB directement
router.get('/backup', authMiddleware, (req, res) => {
  const cooldown = checkBackupCooldown(req, res);
  if (!cooldown) return;

  const dbPath = path.join(__dirname, '..', '..', 'data', 'forms.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Base de données non trouvée' });

  backupLastAccess.set(cooldown.token, cooldown.now);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="kiss-forms-backup-${timestamp}.db"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const fileStream = fs.createReadStream(dbPath);
  fileStream.on('error', (err) => {
    console.error('Erreur lecture DB:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lecture base de données' });
  });
  fileStream.pipe(res);
});

// Liste des backups
router.get('/backups', authMiddleware, (req, res) => {
  res.json(backup.listBackups());
});

// Créer un backup manuel
router.post('/backups', authMiddleware, (req, res) => {
  try {
    const cooldown = checkBackupCooldown(req, res);
    if (!cooldown) return;

    const result = backup.createBackup('manual');
    if (result.success) {
      backupLastAccess.set(cooldown.token, cooldown.now);
      backup.cleanOldBackups();
      res.json(result);
    } else {
      res.status(500).json({ error: result.error || 'Erreur lors de la création du backup' });
    }
  } catch (error) {
    console.error('[BACKUP] Erreur POST /backups:', error);
    res.status(500).json({ error: error.message || 'Erreur interne' });
  }
});

// Télécharger un backup spécifique
router.get('/backups/:filename', authMiddleware, (req, res) => {
  const { filename } = req.params;

  if (!/^forms-[\w-]+\.db$/.test(filename)) {
    return res.status(400).json({ error: 'Nom de fichier invalide' });
  }

  if (!backup.backupExists(filename)) return res.status(404).json({ error: 'Backup non trouvé' });

  const filePath = backup.getBackupPath(filename);
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const fileStream = fs.createReadStream(filePath);
  fileStream.on('error', (err) => {
    console.error('Erreur lecture backup:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lecture backup' });
  });
  fileStream.pipe(res);
});

// Supprimer un backup
router.delete('/backups/:filename', authMiddleware, (req, res) => {
  const { filename } = req.params;

  if (!/^forms-[\w-]+\.db$/.test(filename)) {
    return res.status(400).json({ error: 'Nom de fichier invalide' });
  }

  if (!backup.backupExists(filename)) return res.status(404).json({ error: 'Backup non trouvé' });

  try {
    fs.unlinkSync(backup.getBackupPath(filename));
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression backup:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

module.exports = router;

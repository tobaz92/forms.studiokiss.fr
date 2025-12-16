const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../../database');
const fs = require('fs');
const { authMiddleware, parseId } = require('./auth');
const { upload, validateFileContent, uploadsDir } = require('./upload');

// Lister les médias
router.get('/', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM media ORDER BY created_at DESC').all());
});

// Upload un média
router.post('/', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Erreur upload: ' + err.message });
    }

    if (!req.file) return res.status(400).json({ error: 'Aucun fichier uploadé' });

    try {
      const validation = await validateFileContent(req.file.path, req.file.mimetype);
      if (!validation.valid) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: validation.reason });
      }
    } catch (validationErr) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Erreur lors de la validation du fichier' });
    }

    try {
      const mediaPath = '/uploads/logos/' + req.file.filename;
      const result = db.prepare('INSERT INTO media (filename, original_name, path, mimetype, size) VALUES (?, ?, ?, ?, ?)')
        .run(req.file.filename, req.file.originalname, mediaPath, req.file.mimetype, req.file.size);

      res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid));
    } catch (dbErr) {
      console.error('DB error:', dbErr);
      res.status(500).json({ error: 'Erreur base de données: ' + dbErr.message });
    }
  });
});

// Supprimer un média
router.delete('/:id', authMiddleware, (req, res) => {
  const numericId = parseId(req.params.id);
  if (!numericId) return res.status(400).json({ error: 'ID invalide' });

  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(numericId);
  if (!media) return res.status(404).json({ error: 'Média non trouvé' });

  const filePath = path.join(uploadsDir, media.filename);
  try { fs.unlinkSync(filePath); } catch {}

  db.prepare('DELETE FROM media WHERE id = ?').run(numericId);
  res.json({ success: true });
});

module.exports = router;

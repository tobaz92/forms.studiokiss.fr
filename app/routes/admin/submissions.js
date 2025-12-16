const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authMiddleware, parseId } = require('./auth');

const VALID_SUBMISSION_STATUSES = ['draft', 'submitted', 'validated', 'archived'];

// Lister les soumissions d'un formulaire
router.get('/forms/:id/submissions', authMiddleware, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const { status } = req.query;
  let query = 'SELECT * FROM submissions WHERE form_id = ?';
  const params = [id];

  if (status) {
    if (!VALID_SUBMISSION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Détail d'une soumission
router.get('/submissions/:id', authMiddleware, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const submission = db.prepare(`
    SELECT s.*, f.title as form_title, f.structure as form_structure
    FROM submissions s JOIN forms f ON f.id = s.form_id WHERE s.id = ?
  `).get(id);

  if (!submission) return res.status(404).json({ error: 'Soumission non trouvée' });
  res.json(submission);
});

// Changer le statut d'une soumission
router.put('/submissions/:id/status', authMiddleware, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const { status } = req.body;
  if (!VALID_SUBMISSION_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  db.prepare('UPDATE submissions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
  if (!submission) return res.status(404).json({ error: 'Soumission non trouvée' });
  res.json(submission);
});

// Supprimer une soumission
router.delete('/submissions/:id', authMiddleware, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const result = db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Soumission non trouvée' });
  res.json({ success: true });
});

module.exports = { router, VALID_SUBMISSION_STATUSES };

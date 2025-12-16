const express = require('express');
const router = express.Router();
const db = require('../../database');
const path = require('path');
const fs = require('fs');
const { authMiddleware, parseId } = require('./auth');
const { upload, validateFileContent, uploadsDir } = require('./upload');
const { nanoid } = require('../../utils/nanoid');

// Lister les projets
router.get('/', authMiddleware, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, COUNT(f.id) as forms_count
    FROM projects p
    LEFT JOIN forms f ON f.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

// Créer un projet
router.post('/', authMiddleware, async (req, res) => {
  const { name, style, form_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis' });

  const slug = nanoid(10);

  const result = db.prepare('INSERT INTO projects (name, slug, style, form_order) VALUES (?, ?, ?, ?)').run(
    name, slug, style || 'google', form_order ? JSON.stringify(form_order) : '[]'
  );
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.json(project);
});

// Modifier un projet
router.put('/:id', authMiddleware, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const { name, slug, shared_sections, form_order, style, logo } = req.body;

  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projet non trouvé' });

  if (slug && slug !== existing.slug) {
    const slugExists = db.prepare('SELECT id FROM projects WHERE slug = ? AND id != ?').get(slug, id);
    if (slugExists) return res.status(400).json({ error: 'Ce slug est déjà utilisé' });
  }

  db.prepare(`
    UPDATE projects SET name = ?, slug = ?, shared_sections = ?, form_order = ?, style = ?, logo = ? WHERE id = ?
  `).run(
    name || existing.name,
    slug || existing.slug,
    shared_sections ? JSON.stringify(shared_sections) : existing.shared_sections,
    form_order ? JSON.stringify(form_order) : existing.form_order,
    style || existing.style || 'google',
    logo !== undefined ? logo : existing.logo,
    id
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.json(project);
});

// Upload du logo
router.post('/:id/logo', authMiddleware, upload.single('logo'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projet non trouvé' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier uploadé' });

  try {
    const validation = await validateFileContent(req.file.path, req.file.mimetype);
    if (!validation.valid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: validation.reason });
    }
  } catch (err) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Erreur lors de la validation du fichier' });
  }

  if (existing.logo) {
    const oldLogoPath = path.join(uploadsDir, path.basename(existing.logo));
    try { fs.unlinkSync(oldLogoPath); } catch {}
  }

  const logoUrl = '/uploads/logos/' + req.file.filename;
  db.prepare('UPDATE projects SET logo = ? WHERE id = ?').run(logoUrl, id);
  res.json({ logo: logoUrl });
});

// Supprimer le logo
router.delete('/:id/logo', authMiddleware, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Projet non trouvé' });

  if (existing.logo) {
    const logoPath = path.join(uploadsDir, path.basename(existing.logo));
    try { fs.unlinkSync(logoPath); } catch {}
  }

  db.prepare('UPDATE projects SET logo = NULL WHERE id = ?').run(id);
  res.json({ success: true });
});

// Supprimer un projet
router.delete('/:id', authMiddleware, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalide' });

  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Projet non trouvé' });
  res.json({ success: true });
});

module.exports = router;

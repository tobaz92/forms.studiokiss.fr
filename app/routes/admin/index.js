const express = require('express');
const router = express.Router();
const db = require('../../database');

const { router: authRouter, authMiddleware } = require('./auth');
const projectsRouter = require('./projects');
const formsRouter = require('./forms');
const { router: submissionsRouter } = require('./submissions');
const exportsRouter = require('./exports');
const mediaRouter = require('./media');
const backupsRouter = require('./backups');

// Auth (login, logout, check-session)
router.use('/', authRouter);

// CRUD
router.use('/projects', projectsRouter);
router.use('/forms', formsRouter);
router.use('/', submissionsRouter);
router.use('/', exportsRouter);
router.use('/media', mediaRouter);
router.use('/', backupsRouter);

// Templates
router.get('/templates', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM templates ORDER BY name').all());
});

// Stats
router.get('/stats', authMiddleware, (req, res) => {
  res.json({
    projects: db.prepare('SELECT COUNT(*) as count FROM projects').get().count,
    forms: db.prepare('SELECT COUNT(*) as count FROM forms').get().count,
    submissions: db.prepare('SELECT COUNT(*) as count FROM submissions').get().count,
    submissionsByStatus: db.prepare('SELECT status, COUNT(*) as count FROM submissions GROUP BY status').all()
  });
});

module.exports = router;

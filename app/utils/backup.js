/**
 * Module de backup automatique - Kiss Forms
 * Sauvegarde hebdomadaire de la base de données SQLite
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const DB_PATH = path.join(__dirname, '..', 'data', 'forms.db');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const MAX_BACKUPS = parseInt(process.env.BACKUP_RETENTION_WEEKS) || 4; // 4 semaines par défaut

/**
 * Initialise le dossier de backups
 */
function initBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log('[BACKUP] Dossier backups créé');
    }
}

/**
 * Effectue un backup de la base de données
 * @param {string} reason - Raison du backup (scheduled, manual, pre-delete, etc.)
 * @returns {object} - Infos sur le backup créé
 */
// Raisons de backup autorisées
const VALID_REASONS = ['manual', 'scheduled', 'pre-delete', 'pre-migration'];

function createBackup(reason = 'manual') {
    initBackupDir();

    // Validation de la raison (sécurité: évite injection dans le nom de fichier)
    const safeReason = VALID_REASONS.includes(reason) ? reason : 'manual';

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `forms-${safeReason}-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, filename);

    try {
        // Vérifier que la DB source existe
        if (!fs.existsSync(DB_PATH)) {
            throw new Error('Base de données source introuvable');
        }

        fs.copyFileSync(DB_PATH, backupPath);
        const stats = fs.statSync(backupPath);

        console.log(`[BACKUP] ${filename} créé (${(stats.size / 1024).toFixed(1)} KB)`);

        return {
            success: true,
            filename,
            size: stats.size,
            sizeFormatted: formatSize(stats.size),
            date: now.toISOString()
        };
    } catch (error) {
        console.error(`[BACKUP] Erreur: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Nettoie les vieux backups (garde les X plus récents)
 * @returns {number} - Nombre de backups supprimés
 */
function cleanOldBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return 0;

    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => ({
            name: f,
            time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Plus récent en premier

    const toDelete = files.slice(MAX_BACKUPS);

    toDelete.forEach(file => {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
        console.log(`[BACKUP] Ancien backup supprimé: ${file.name}`);
    });

    return toDelete.length;
}

/**
 * Liste tous les backups disponibles
 * @returns {Array} - Liste des backups triés par date décroissante
 */
function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return [];

    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const stats = fs.statSync(path.join(BACKUP_DIR, f));
            return {
                filename: f,
                size: stats.size,
                sizeFormatted: formatSize(stats.size),
                date: stats.mtime.toISOString()
            };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Formate une taille en bytes en format lisible
 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Démarre le scheduler de backup automatique
 * Par défaut: tous les dimanches à 3h du matin
 */
function startScheduler() {
    // Cron: minute heure jour-du-mois mois jour-de-la-semaine
    // 0 3 * * 0 = tous les dimanches à 3h00
    const schedule = process.env.BACKUP_SCHEDULE || '0 3 * * 0';

    const isValid = cron.validate(schedule);
    if (!isValid) {
        console.error(`[BACKUP] Schedule invalide: ${schedule}`);
        return false;
    }

    cron.schedule(schedule, () => {
        console.log('[BACKUP] Backup hebdomadaire démarré...');
        const result = createBackup('scheduled');

        if (result.success) {
            const deleted = cleanOldBackups();
            console.log(`[BACKUP] Terminé. ${deleted} ancien(s) backup(s) nettoyé(s)`);
        }
    });

    console.log(`[BACKUP] Scheduler activé - ${describeSchedule(schedule)}`);
    return true;
}

/**
 * Décrit le schedule en français
 */
function describeSchedule(schedule) {
    if (schedule === '0 3 * * 0') return 'Tous les dimanches à 3h00';
    if (schedule === '0 3 * * 1') return 'Tous les lundis à 3h00';
    return `Cron: ${schedule}`;
}

/**
 * Retourne le chemin d'un backup
 */
function getBackupPath(filename) {
    return path.join(BACKUP_DIR, filename);
}

/**
 * Vérifie si un backup existe
 */
function backupExists(filename) {
    return fs.existsSync(path.join(BACKUP_DIR, filename));
}

module.exports = {
    createBackup,
    cleanOldBackups,
    listBackups,
    startScheduler,
    getBackupPath,
    backupExists,
    BACKUP_DIR
};

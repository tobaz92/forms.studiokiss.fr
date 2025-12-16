const Database = require('better-sqlite3');
const path = require('path');

// Utiliser une base en mémoire pour les tests
const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : path.join(__dirname, 'data', 'forms.db');
const db = new Database(dbPath);

// Activer les foreign keys
db.pragma('foreign_keys = ON');

// Créer les tables
db.exec(`
  -- Table des projets
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    shared_sections TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Table des données partagées du projet (contact, etc.)
  CREATE TABLE IF NOT EXISTS project_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- Table des formulaires
  CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    structure TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  -- Table des soumissions
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
  );

  -- Table des paramètres
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Table des templates
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    structure TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations pour ajouter les colonnes si elles n'existent pas
try {
  db.exec(`ALTER TABLE projects ADD COLUMN slug TEXT UNIQUE`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN shared_sections TEXT DEFAULT '[]'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN form_order TEXT DEFAULT '[]'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN style TEXT DEFAULT 'google'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN logo TEXT`);
} catch (e) {}

// Table médiathèque
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      path TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch (e) {}

// Insérer les templates par défaut s'ils n'existent pas
const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get();

if (templateCount.count === 0) {
  const insertTemplate = db.prepare('INSERT INTO templates (name, structure) VALUES (?, ?)');

  // Template Formulaire de contact
  const templateContact = {
    title: "Formulaire de contact",
    description: "",
    sections: [
      {
        id: "coordonnees",
        title: "VOS COORDONNEES",
        fields: [
          { id: "nom", label: "Nom complet", type: "text", required: true },
          { id: "email", label: "Email", type: "email", required: true },
          { id: "telephone", label: "Téléphone", type: "tel", required: false },
          { id: "societe", label: "Société / Organisation", type: "text", required: false }
        ]
      },
      {
        id: "message",
        title: "VOTRE MESSAGE",
        fields: [
          {
            id: "objet",
            label: "Objet de votre demande",
            type: "select",
            required: true,
            options: ["Demande d'information", "Demande de devis", "Partenariat", "Autre"]
          },
          { id: "message", label: "Votre message", type: "textarea", required: true },
          { id: "disponibilite", label: "Disponibilité pour un échange", type: "radio", required: false, options: ["Matin", "Après-midi", "Pas de préférence"] }
        ]
      }
    ]
  };

  // Template Enquête de satisfaction
  const templateSatisfaction = {
    title: "Enquête de satisfaction",
    description: "",
    sections: [
      {
        id: "informations",
        title: "INFORMATIONS",
        fields: [
          { id: "nom", label: "Votre nom (optionnel)", type: "text", required: false },
          { id: "email", label: "Votre email (optionnel)", type: "email", required: false },
          { id: "date_prestation", label: "Date de la prestation", type: "date", required: false }
        ]
      },
      {
        id: "evaluation",
        title: "VOTRE EVALUATION",
        fields: [
          { id: "satisfaction_globale", label: "Satisfaction globale", type: "radio", required: true, options: ["Très satisfait", "Satisfait", "Neutre", "Insatisfait", "Très insatisfait"] },
          { id: "qualite", label: "Qualité du travail fourni", type: "radio", required: false, options: ["Excellente", "Bonne", "Moyenne", "Insuffisante"] },
          { id: "delais", label: "Respect des délais", type: "radio", required: false, options: ["Excellente", "Bonne", "Moyenne", "Insuffisante"] },
          { id: "communication", label: "Communication et écoute", type: "radio", required: false, options: ["Excellente", "Bonne", "Moyenne", "Insuffisante"] },
          {
            id: "points_positifs",
            label: "Qu'avez-vous le plus apprécié ?",
            type: "checkbox",
            required: false,
            options: ["Réactivité", "Créativité", "Professionnalisme", "Rapport qualité-prix", "Accompagnement", "Autre"]
          }
        ]
      },
      {
        id: "commentaires",
        title: "COMMENTAIRES",
        fields: [
          { id: "ameliorations", label: "Que pourrions-nous améliorer ?", type: "textarea", required: false },
          { id: "commentaire_libre", label: "Commentaire libre", type: "textarea", required: false },
          { id: "recommandation", label: "Recommanderiez-vous nos services ?", type: "radio", required: false, options: ["Oui, certainement", "Probablement", "Je ne sais pas", "Probablement pas", "Non"] }
        ]
      }
    ]
  };

  insertTemplate.run('Formulaire de contact', JSON.stringify(templateContact));
  insertTemplate.run('Enquête de satisfaction', JSON.stringify(templateSatisfaction));
}

module.exports = db;

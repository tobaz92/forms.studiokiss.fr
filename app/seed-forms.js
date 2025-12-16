const db = require('./database');

// Récupérer les templates
const templateContact = db.prepare('SELECT structure FROM templates WHERE id = 1').get();
const templateSatisfaction = db.prepare('SELECT structure FROM templates WHERE id = 2').get();

// Vérifier si le projet existe
let project = db.prepare('SELECT id FROM projects WHERE name = ?').get('Projet Demo');
if (!project) {
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Projet Demo');
  project = db.prepare('SELECT id FROM projects WHERE name = ?').get('Projet Demo');
}

// Créer les formulaires
const forms = [
  {
    title: 'Formulaire de contact',
    slug: 'demo-contact-2024',
    structure: templateContact.structure
  },
  {
    title: 'Enquête de satisfaction',
    slug: 'demo-satisfaction-2024',
    structure: templateSatisfaction.structure
  }
];

forms.forEach(form => {
  const existing = db.prepare('SELECT id FROM forms WHERE slug = ?').get(form.slug);
  if (!existing) {
    db.prepare('INSERT INTO forms (project_id, title, slug, structure) VALUES (?, ?, ?, ?)')
      .run(project.id, form.title, form.slug, form.structure);
    console.log(`Created: ${form.title}`);
  } else {
    console.log(`Already exists: ${form.title}`);
  }
});

console.log('Done!');

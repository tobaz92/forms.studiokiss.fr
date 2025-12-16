/**
 * Service de génération de PDF pour les soumissions
 * Design inspiré du style HTML (Material Design / Google Style)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { STATUS_LABELS, STATUS_COLORS_PDF, isPathSafe, formatValue, formatDateFR } = require('./export-utils');

const COLORS = {
  primary: '#212121',
  secondary: '#757575',
  accent: '#1a73e8',
  accentLight: '#e8f0fe',
  success: '#1e8e3e',
  warning: '#f9ab00',
  gray50: '#fafafa',
  gray100: '#f5f5f5',
  gray200: '#eeeeee',
  gray300: '#e0e0e0',
  gray400: '#bdbdbd',
  gray500: '#9e9e9e',
  gray600: '#757575',
  gray700: '#616161',
  gray900: '#212121',
  white: '#ffffff'
};

// Dimensions et marges
const MARGINS = {
  top: 50,
  bottom: 60,
  left: 50,
  right: 50
};

const PAGE_WIDTH = 595.28;  // A4
const PAGE_HEIGHT = 841.89; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right;
const FOOTER_Y = PAGE_HEIGHT - 40;

/**
 * Génère un PDF pour une soumission
 */
function generateSubmissionPDF({ submission, form, project }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: MARGINS,
    bufferPages: true,
    info: {
      Title: `${form.title} - Soumission`,
      Author: project?.name || 'Studio Kiss',
      Subject: 'Formulaire de soumission',
      Creator: 'Kiss Forms'
    }
  });

  // Parse des données avec gestion d'erreur
  let submissionData = {};
  let formStructure = { sections: [] };

  try {
    submissionData = typeof submission.data === 'string'
      ? JSON.parse(submission.data)
      : (submission.data || {});
  } catch (e) {
    submissionData = {};
  }

  try {
    formStructure = typeof form.structure === 'string'
      ? JSON.parse(form.structure)
      : (form.structure || { sections: [] });
  } catch (e) {
    formStructure = { sections: [] };
  }

  let currentY = MARGINS.top;

  // En-tête
  currentY = renderHeader(doc, { form, project, submission }, currentY);

  // Contenu
  currentY = renderContent(doc, { formStructure, submissionData }, currentY);

  // Pied de page
  addFooter(doc, project);

  return doc;
}

/**
 * Rendu de l'en-tête
 */
function renderHeader(doc, { form, project, submission }, startY) {
  let y = startY;
  const logoHeight = 40;
  const logoMaxWidth = 120;

  // === BARRE DE STATUT EN HAUT ===
  const dateStr = formatDateFR(submission.updated_at || submission.created_at);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.gray500)
    .text(dateStr, MARGINS.left, y);

  // Statut à droite
  const statusText = STATUS_LABELS[submission.status] || submission.status;
  doc
    .fillColor(STATUS_COLORS_PDF[submission.status] || COLORS.gray500)
    .text(statusText.toUpperCase(), MARGINS.left, y, {
      width: CONTENT_WIDTH,
      align: 'right'
    });

  y += 25;

  // === LOGO CENTRÉ ===
  let logoLoaded = false;
  if (project && project.logo) {
    const publicDir = path.join(__dirname, '..', 'public');
    const logoPath = path.join(publicDir, project.logo);
    const isSafe = isPathSafe(logoPath, publicDir);
    const isSupportedFormat = !project.logo.toLowerCase().endsWith('.svg');

    if (isSafe && isSupportedFormat && fs.existsSync(logoPath)) {
      try {
        const logoX = (PAGE_WIDTH - logoMaxWidth) / 2;
        doc.image(logoPath, logoX, y, {
          fit: [logoMaxWidth, logoHeight],
          align: 'center',
          valign: 'center'
        });
        logoLoaded = true;
        y += logoHeight + 20;
      } catch (err) {
        console.error('Erreur chargement logo:', err.message);
      }
    }
  }

  // === TITRE CENTRÉ ===
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(COLORS.gray900)
    .text(form.title || 'Formulaire', MARGINS.left, y, {
      width: CONTENT_WIDTH,
      align: 'center'
    });

  y += 24;

  // Nom du projet (sous-titre)
  if (project && project.name) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.gray600)
      .text(project.name, MARGINS.left, y, {
        width: CONTENT_WIDTH,
        align: 'center'
      });
    y += 18;
  }

  y += 10;

  return y;
}

/**
 * Rendu du contenu avec sections style "card"
 */
function renderContent(doc, { formStructure, submissionData }, startY) {
  let y = startY;
  const sections = formStructure.sections || [];
  const maxY = FOOTER_Y - 40;
  const sectionPadding = 18;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const fields = section.fields || [];

    // Sauter les sections sans champs
    if (fields.length === 0) continue;

    // Nouvelle page si nécessaire (au moins 80px pour commencer une section)
    if (y + 80 > maxY) {
      doc.addPage();
      y = MARGINS.top;
    }

    // Header de section
    y += 10;

    // Titre de section (style Google: petit, uppercase, gris)
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.gray500)
      .text((section.title || '').toUpperCase(), MARGINS.left + sectionPadding, y, {
        width: CONTENT_WIDTH - sectionPadding * 2,
        characterSpacing: 0.8
      });

    y += 16;

    // Ligne sous le titre
    doc
      .strokeColor(COLORS.gray200)
      .lineWidth(1)
      .moveTo(MARGINS.left + sectionPadding, y)
      .lineTo(MARGINS.left + CONTENT_WIDTH - sectionPadding, y)
      .stroke();

    y += 14;

    // Champs de la section
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      const value = submissionData[field.id];
      const fieldHeight = calculateFieldHeight(doc, field, value);

      // Nouvelle page si le champ ne tient pas
      if (y + fieldHeight > maxY) {
        doc.addPage();
        y = MARGINS.top;

        // Titre "suite" sur la nouvelle page
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLORS.gray500)
          .text((section.title || '').toUpperCase() + ' (suite)', MARGINS.left + sectionPadding, y, {
            width: CONTENT_WIDTH - sectionPadding * 2,
            characterSpacing: 0.8
          });
        y += 16;

        doc
          .strokeColor(COLORS.gray200)
          .lineWidth(1)
          .moveTo(MARGINS.left + sectionPadding, y)
          .lineTo(MARGINS.left + CONTENT_WIDTH - sectionPadding, y)
          .stroke();
        y += 14;
      }

      y = renderField(doc, field, value, y, sectionPadding);
      y += 8;
    }

    y += 20; // Espace entre sections
  }

  return y;
}

/**
 * Rendu d'un champ
 */
function renderField(doc, field, value, startY, padding) {
  let y = startY;
  const fieldX = MARGINS.left + padding;
  const fieldWidth = CONTENT_WIDTH - padding * 2;

  // Label du champ
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.gray700)
    .text(field.label, fieldX, y, {
      width: fieldWidth
    });

  y += 12;

  // Valeur dans un fond gris (style Material)
  const displayValue = formatValue(value, field.type);

  // Calculer la hauteur du texte
  doc.font('Helvetica').fontSize(9);
  const textHeight = doc.heightOfString(displayValue, {
    width: fieldWidth - 16,
    lineGap: 2
  });

  const valueBoxHeight = Math.max(textHeight + 14, 26);

  // Fond gris pour la valeur (style input)
  doc
    .fillColor(COLORS.gray100)
    .roundedRect(fieldX, y, fieldWidth, valueBoxHeight, 4)
    .fill();

  // Texte de la valeur
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(displayValue === '—' ? COLORS.gray400 : COLORS.gray900)
    .text(displayValue, fieldX + 8, y + 7, {
      width: fieldWidth - 16,
      lineGap: 2
    });

  y += valueBoxHeight;

  return y;
}

/**
 * Calcule la hauteur d'un champ
 */
function calculateFieldHeight(doc, field, value) {
  const displayValue = formatValue(value, field.type);
  const fieldWidth = CONTENT_WIDTH - 36 - 16; // padding section + padding value

  doc.font('Helvetica').fontSize(9);
  const textHeight = doc.heightOfString(displayValue, {
    width: fieldWidth,
    lineGap: 2
  });

  // Label (12) + value box (min 26) + spacing
  return 12 + Math.max(textHeight + 14, 26);
}

/**
 * Ajoute le pied de page
 */
function addFooter(doc, project) {
  const pages = doc.bufferedPageRange();

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    // Ligne de séparation
    doc
      .strokeColor(COLORS.gray200)
      .lineWidth(0.5)
      .moveTo(MARGINS.left, FOOTER_Y - 10)
      .lineTo(PAGE_WIDTH - MARGINS.right, FOOTER_Y - 10)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.gray500);

    // Nom du projet ou Studio Kiss à gauche
    const footerText = project?.name || 'Studio Kiss';
    doc.text(footerText, MARGINS.left, FOOTER_Y);

    // Numéro de page à droite
    doc.text(
      `${i + 1} / ${pages.count}`,
      PAGE_WIDTH - MARGINS.right - 40,
      FOOTER_Y,
      { width: 40, align: 'right' }
    );
  }
}

/**
 * Génère un PDF pour plusieurs soumissions d'un projet
 */
function generateProjectPDF({ submissions, project }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: MARGINS,
    bufferPages: true,
    info: {
      Title: `${project.name} - Soumissions`,
      Author: 'Studio Kiss',
      Subject: 'Récapitulatif des soumissions',
      Creator: 'Kiss Forms'
    }
  });

  let isFirstSubmission = true;

  for (const { submission, form } of submissions) {
    let submissionData = {};
    let formStructure = { sections: [] };

    try {
      submissionData = typeof submission.data === 'string'
        ? JSON.parse(submission.data)
        : (submission.data || {});
    } catch (e) {
      submissionData = {};
    }

    try {
      formStructure = typeof form.structure === 'string'
        ? JSON.parse(form.structure)
        : (form.structure || { sections: [] });
    } catch (e) {
      formStructure = { sections: [] };
    }

    // Vérifier qu'il y a du contenu à afficher
    const hasContent = formStructure.sections && formStructure.sections.some(s => s.fields && s.fields.length > 0);
    if (!hasContent) continue;

    // Nouvelle page pour chaque formulaire (sauf le premier)
    if (!isFirstSubmission) {
      doc.addPage();
    }
    isFirstSubmission = false;

    let currentY = MARGINS.top;
    currentY = renderHeader(doc, { form, project, submission }, currentY);
    renderContent(doc, { formStructure, submissionData }, currentY);
  }

  addFooter(doc, project);

  return doc;
}

module.exports = {
  generateSubmissionPDF,
  generateProjectPDF
};

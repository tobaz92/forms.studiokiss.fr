/**
 * Service de génération de JPG pour les soumissions
 * Design inspiré du style Material Design
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { STATUS_LABELS, STATUS_COLORS_JPG, isPathSafe, formatValue, formatDateFR, sanitizeFilename } = require('./export-utils');

const COLORS = {
  background: '#ffffff',
  primary: '#212121',
  secondary: '#757575',
  accent: '#1a73e8',
  success: '#1e8e3e',
  warning: '#f9ab00',
  gray100: '#f5f5f5',
  gray200: '#eeeeee',
  gray300: '#e0e0e0',
  gray400: '#bdbdbd',
  gray500: '#9e9e9e',
  gray600: '#757575',
  gray700: '#616161',
  gray900: '#212121'
};

// Dimensions
const WIDTH = 800;
const MARGIN = 40;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const LINE_HEIGHT = 20; // Hauteur de ligne pour le texte
const FIELD_PADDING = 12; // Padding dans les champs

/**
 * Dessine un rectangle arrondi
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Wrap text pour canvas avec support des retours à la ligne
 */
function wrapText(ctx, text, maxWidth) {
  const lines = [];

  // D'abord, séparer par les retours à la ligne existants
  const paragraphs = String(text).split(/\r?\n/);

  for (const paragraph of paragraphs) {
    // Si le paragraphe est vide, ajouter une ligne vide
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      // Si le mot seul est plus large que maxWidth, le couper
      if (ctx.measureText(word).width > maxWidth) {
        // Sauvegarder la ligne en cours si elle existe
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        // Couper le mot long caractère par caractère
        let partialWord = '';
        for (const char of word) {
          const testWord = partialWord + char;
          if (ctx.measureText(testWord).width > maxWidth && partialWord) {
            lines.push(partialWord);
            partialWord = char;
          } else {
            partialWord = testWord;
          }
        }
        if (partialWord) {
          currentLine = partialWord;
        }
        continue;
      }

      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Calcule la hauteur nécessaire pour le canvas
 */
function calculateHeight(ctx, formStructure, submissionData) {
  let height = 180; // Header

  const sections = formStructure.sections || [];

  for (const section of sections) {
    const fields = section.fields || [];
    if (fields.length === 0) continue;

    height += 50; // Section header

    for (const field of fields) {
      const value = submissionData[field.id];
      const displayValue = formatValue(value, field.type);

      ctx.font = '13px Arial';
      const lines = wrapText(ctx, displayValue, CONTENT_WIDTH - FIELD_PADDING * 3);
      const valueHeight = Math.max(lines.length * LINE_HEIGHT + FIELD_PADDING * 2, 40);

      height += 24 + valueHeight + 16; // Label + value + spacing
    }

    height += 20; // Section spacing
  }

  height += 60; // Footer
  return Math.max(height, 400);
}

/**
 * Génère un JPG pour une soumission
 */
async function generateSubmissionJPG({ submission, form, project }) {
  // Parse des données
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

  // Créer un canvas temporaire pour calculer la hauteur
  const tempCanvas = createCanvas(WIDTH, 100);
  const tempCtx = tempCanvas.getContext('2d');
  const HEIGHT = calculateHeight(tempCtx, formStructure, submissionData);

  // Créer le canvas final
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fond blanc
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  let y = MARGIN;

  // === HEADER ===

  // Date et statut
  ctx.font = '11px Arial';
  ctx.fillStyle = COLORS.gray500;
  ctx.fillText(formatDateFR(submission.updated_at || submission.created_at), MARGIN, y + 12);

  const statusText = (STATUS_LABELS[submission.status] || submission.status).toUpperCase();
  ctx.fillStyle = STATUS_COLORS_JPG[submission.status] || COLORS.gray500;
  const statusWidth = ctx.measureText(statusText).width;
  ctx.fillText(statusText, WIDTH - MARGIN - statusWidth, y + 12);

  y += 30;

  // Logo (si disponible)
  if (project && project.logo) {
    const publicDir = path.join(__dirname, '..', 'public');
    const logoPath = path.join(publicDir, project.logo);
    const isSafe = isPathSafe(logoPath, publicDir);
    const isSupportedFormat = !project.logo.toLowerCase().endsWith('.svg');

    if (isSafe && isSupportedFormat && fs.existsSync(logoPath)) {
      try {
        const logo = await loadImage(logoPath);
        const maxLogoWidth = 120;
        const maxLogoHeight = 40;
        const scale = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
        const logoWidth = logo.width * scale;
        const logoHeight = logo.height * scale;
        const logoX = (WIDTH - logoWidth) / 2;

        ctx.drawImage(logo, logoX, y, logoWidth, logoHeight);
        y += logoHeight + 15;
      } catch (err) {
        console.error('Erreur chargement logo:', err.message);
      }
    }
  }

  // Titre
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = COLORS.gray900;
  ctx.textAlign = 'center';
  ctx.fillText(form.title || 'Formulaire', WIDTH / 2, y + 20);
  ctx.textAlign = 'left';
  y += 28;

  // Nom du projet
  if (project && project.name) {
    ctx.font = '12px Arial';
    ctx.fillStyle = COLORS.gray600;
    ctx.textAlign = 'center';
    ctx.fillText(project.name, WIDTH / 2, y + 12);
    ctx.textAlign = 'left';
    y += 20;
  }

  y += 20;

  // === CONTENU ===
  const sections = formStructure.sections || [];

  for (const section of sections) {
    const fields = section.fields || [];
    if (fields.length === 0) continue;

    // Titre de section
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = COLORS.gray500;
    ctx.fillText((section.title || '').toUpperCase(), MARGIN, y + 12);
    y += 20;

    // Ligne sous le titre
    ctx.strokeStyle = COLORS.gray200;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y);
    ctx.lineTo(WIDTH - MARGIN, y);
    ctx.stroke();
    y += 15;

    // Champs
    for (const field of fields) {
      const value = submissionData[field.id];
      const displayValue = formatValue(value, field.type);

      // Label
      ctx.font = 'bold 11px Arial';
      ctx.fillStyle = COLORS.gray700;
      ctx.fillText(field.label || '', MARGIN, y + 12);
      y += 24;

      // Valeur dans un fond gris
      ctx.font = '13px Arial';
      const lines = wrapText(ctx, displayValue, CONTENT_WIDTH - FIELD_PADDING * 3);
      const valueHeight = Math.max(lines.length * LINE_HEIGHT + FIELD_PADDING * 2, 40);

      // Fond arrondi
      ctx.fillStyle = COLORS.gray100;
      roundRect(ctx, MARGIN, y, CONTENT_WIDTH, valueHeight, 4);
      ctx.fill();

      // Texte
      ctx.fillStyle = displayValue === '—' ? COLORS.gray400 : COLORS.gray900;
      let textY = y + FIELD_PADDING + 14; // Baseline offset
      for (const line of lines) {
        ctx.fillText(line, MARGIN + FIELD_PADDING, textY);
        textY += LINE_HEIGHT;
      }

      y += valueHeight + 16;
    }

    y += 15;
  }

  // === FOOTER ===
  y = HEIGHT - 30;

  ctx.strokeStyle = COLORS.gray200;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y - 10);
  ctx.lineTo(WIDTH - MARGIN, y - 10);
  ctx.stroke();

  ctx.font = '10px Arial';
  ctx.fillStyle = COLORS.gray500;
  ctx.fillText(project?.name || 'Studio Kiss', MARGIN, y);

  const dateExport = new Date().toLocaleDateString('fr-FR');
  const dateWidth = ctx.measureText(dateExport).width;
  ctx.fillText(dateExport, WIDTH - MARGIN - dateWidth, y);

  // Retourner le buffer JPG
  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

/**
 * Génère plusieurs JPG pour un projet (retourne un tableau de buffers)
 */
async function generateProjectJPGs({ submissions, project }) {
  const jpgs = [];

  for (const { submission, form } of submissions) {
    let formStructure = { sections: [] };

    try {
      formStructure = typeof form.structure === 'string'
        ? JSON.parse(form.structure)
        : (form.structure || { sections: [] });
    } catch (e) {
      formStructure = { sections: [] };
    }

    // Vérifier qu'il y a du contenu
    const hasContent = formStructure.sections && formStructure.sections.some(s => s.fields && s.fields.length > 0);
    if (!hasContent) continue;

    const buffer = await generateSubmissionJPG({ submission, form, project });
    jpgs.push({
      buffer,
      filename: `${sanitizeFilename(form.title || 'formulaire')}.jpg`
    });
  }

  return jpgs;
}

module.exports = {
  generateSubmissionJPG,
  generateProjectJPGs
};

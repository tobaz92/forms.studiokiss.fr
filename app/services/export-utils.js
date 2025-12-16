const path = require('path');

const STATUS_LABELS = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  validated: 'Validé',
  archived: 'Archivé'
};

const STATUS_COLORS_PDF = {
  draft: '#9e9e9e',
  submitted: '#f9ab00',
  validated: '#1e8e3e',
  archived: '#9e9e9e'
};

const STATUS_COLORS_JPG = STATUS_COLORS_PDF; // Alias pour clarté d'import

function isPathSafe(filePath, allowedDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowed = path.resolve(allowedDir);
  return resolvedPath.startsWith(resolvedAllowed + path.sep) || resolvedPath === resolvedAllowed;
}

function formatValue(value, fieldType) {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  if (fieldType === 'date' && value) return formatDateFR(value);
  return String(value);
}

function formatDateFR(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function sanitizeFilename(name, maxLength = 50) {
  return (name || '')
    .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s-]/gi, '')
    .replace(/\s+/g, '_')
    .substring(0, maxLength);
}

module.exports = {
  STATUS_LABELS,
  STATUS_COLORS_PDF,
  STATUS_COLORS_JPG,
  isPathSafe,
  formatValue,
  formatDateFR,
  sanitizeFilename
};

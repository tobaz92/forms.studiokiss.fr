const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FileType = require('file-type');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'logos');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

function isSvgSafe(buffer) {
  const content = buffer.toString('utf8').toLowerCase();
  const dangerous = [
    '<script', 'javascript:', 'vbscript:', 'data:text/html',
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
    'onchange', 'oninput', 'onkeydown', 'onkeyup', 'onkeypress',
    'onmouseenter', 'onmouseleave', 'onsubmit', 'onreset', 'onscroll',
    'ondrag', 'ondrop', 'onpaste', 'oncopy', 'oncut',
    'xlink:href="javascript', 'href="javascript', 'href="data:',
    'foreignobject', '<set', '<animate', 'additive', 'begin='
  ];
  return !dangerous.some(d => content.includes(d));
}

async function validateFileContent(filePath, declaredMime) {
  if (declaredMime === 'image/svg+xml') {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('<svg') || !content.includes('</svg>')) {
      return { valid: false, reason: 'Fichier SVG invalide' };
    }
    if (!isSvgSafe(fs.readFileSync(filePath))) {
      return { valid: false, reason: 'SVG contient du code potentiellement dangereux' };
    }
    return { valid: true };
  }

  const fileType = await FileType.fromFile(filePath);
  if (!fileType) return { valid: false, reason: 'Type de fichier non reconnu' };
  if (!ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
    return { valid: false, reason: `Type réel du fichier (${fileType.mime}) non autorisé` };
  }
  return { valid: true, detectedMime: fileType.mime };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error('Type de fichier non autorisé. Formats acceptés: JPG, PNG, GIF, WebP, SVG'));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Extension de fichier non autorisée'));
    }
    cb(null, true);
  }
});

module.exports = { upload, validateFileContent, uploadsDir };

/**
 * Tests utilitaires - Kiss Forms v2
 * Tests des fonctions d'échappement et validation côté serveur
 */

describe('Fonction escapeHtml (simulation)', () => {
  // Simulation de la fonction escapeHtml utilisée côté client
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
  }

  test('échappe les balises HTML', () => {
    expect(escapeHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('échappe les guillemets', () => {
    expect(escapeHtml('"test"')).toBe('&quot;test&quot;');
    expect(escapeHtml("'test'")).toBe('&#039;test&#039;');
  });

  test('échappe les esperluettes', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  test('gère null et undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  test('convertit les nombres en string', () => {
    expect(escapeHtml(123)).toBe('123');
    expect(escapeHtml(0)).toBe('0');
  });

  test('gère les chaînes vides', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('ne modifie pas le texte normal', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('Test 123')).toBe('Test 123');
  });

  test('échappe les tentatives XSS courantes', () => {
    const xssPayloads = [
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '"><script>alert(1)</script>',
      "'-alert(1)-'",
      '<body onload=alert(1)>',
      '<iframe src="javascript:alert(1)">',
    ];

    xssPayloads.forEach(payload => {
      const escaped = escapeHtml(payload);
      expect(escaped).not.toContain('<script');
      expect(escaped).not.toContain('<img');
      expect(escaped).not.toContain('<svg');
      expect(escaped).not.toContain('<body');
      expect(escaped).not.toContain('<iframe');
    });
  });
});

describe('Validation des slugs', () => {
  const slugRegex = /^[a-zA-Z0-9_-]+$/;

  test('accepte les slugs valides', () => {
    expect(slugRegex.test('mon-projet')).toBe(true);
    expect(slugRegex.test('projet_123')).toBe(true);
    expect(slugRegex.test('ABC-xyz_123')).toBe(true);
    expect(slugRegex.test('simple')).toBe(true);
  });

  test('rejette les slugs avec caractères spéciaux', () => {
    expect(slugRegex.test('projet<script>')).toBe(false);
    expect(slugRegex.test('projet;DROP')).toBe(false);
    expect(slugRegex.test('../etc/passwd')).toBe(false);
    expect(slugRegex.test('projet avec espaces')).toBe(false);
    expect(slugRegex.test("projet'injection")).toBe(false);
  });

  test('rejette les slugs vides', () => {
    expect(slugRegex.test('')).toBe(false);
  });
});

describe('Validation des IDs numériques', () => {
  function isValidId(id) {
    if (typeof id === 'number') {
      return Number.isInteger(id) && id > 0;
    }
    if (typeof id === 'string') {
      return /^\d+$/.test(id) && parseInt(id) > 0;
    }
    return false;
  }

  test('accepte les IDs entiers positifs', () => {
    expect(isValidId(1)).toBe(true);
    expect(isValidId(123)).toBe(true);
    expect(isValidId('456')).toBe(true);
  });

  test('rejette les IDs négatifs ou nuls', () => {
    expect(isValidId(0)).toBe(false);
    expect(isValidId(-1)).toBe(false);
    expect(isValidId('-5')).toBe(false);
  });

  test('rejette les IDs non numériques', () => {
    expect(isValidId('abc')).toBe(false);
    expect(isValidId('12abc')).toBe(false);
    expect(isValidId('1.5')).toBe(false);
    expect(isValidId(null)).toBe(false);
    expect(isValidId(undefined)).toBe(false);
  });
});

describe('Comparaison timing-safe', () => {
  const crypto = require('crypto');

  function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  test('retourne true pour des chaînes identiques', () => {
    expect(safeCompare('password123', 'password123')).toBe(true);
    expect(safeCompare('test', 'test')).toBe(true);
  });

  test('retourne false pour des chaînes différentes', () => {
    expect(safeCompare('password123', 'password124')).toBe(false);
    expect(safeCompare('abc', 'abd')).toBe(false);
  });

  test('retourne false pour des longueurs différentes', () => {
    expect(safeCompare('short', 'longer-string')).toBe(false);
    expect(safeCompare('abc', 'ab')).toBe(false);
  });

  test('retourne false pour des types non-string', () => {
    expect(safeCompare(null, 'test')).toBe(false);
    expect(safeCompare('test', null)).toBe(false);
    expect(safeCompare(123, '123')).toBe(false);
    expect(safeCompare(undefined, undefined)).toBe(false);
  });
});

describe('Validation des types MIME', () => {
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  test('accepte les types images autorisés', () => {
    expect(ALLOWED_IMAGE_TYPES.includes('image/jpeg')).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.includes('image/png')).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.includes('image/gif')).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.includes('image/webp')).toBe(true);
  });

  test('rejette SVG (risque XSS)', () => {
    expect(ALLOWED_IMAGE_TYPES.includes('image/svg+xml')).toBe(false);
  });

  test('rejette les types non-image', () => {
    expect(ALLOWED_IMAGE_TYPES.includes('text/html')).toBe(false);
    expect(ALLOWED_IMAGE_TYPES.includes('application/javascript')).toBe(false);
    expect(ALLOWED_IMAGE_TYPES.includes('text/plain')).toBe(false);
  });
});

describe('Validation des actions de soumission', () => {
  const validActions = ['save', 'submit'];

  test('accepte les actions valides', () => {
    expect(validActions.includes('save')).toBe(true);
    expect(validActions.includes('submit')).toBe(true);
  });

  test('rejette les actions invalides', () => {
    expect(validActions.includes('delete')).toBe(false);
    expect(validActions.includes('execute')).toBe(false);
    expect(validActions.includes('')).toBe(false);
  });
});

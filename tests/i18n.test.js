const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const TRANSLATIONS = require('../public/js/translations');

const ROOT = path.resolve(__dirname, '..');
const PAGES = [
  'public/index.html',
  'public/multiplication/index.html',
  'public/division/index.html',
  'public/missing-factor/index.html',
  'public/review-multiply/index.html',
  'public/review-divide/index.html',
  'public/progress/index.html',
  'public/privacy.html',
];

test('Polish and English catalogs contain the same non-empty keys', () => {
  const polishKeys = Object.keys(TRANSLATIONS.pl).sort();
  const englishKeys = Object.keys(TRANSLATIONS.en).sort();

  assert.deepEqual(englishKeys, polishKeys);
  for (const key of polishKeys) {
    assert.notEqual(TRANSLATIONS.pl[key].trim(), '', `${key} is blank in Polish`);
    assert.notEqual(TRANSLATIONS.en[key].trim(), '', `${key} is blank in English`);
  }
});

test('every translated HTML attribute references a catalog entry', () => {
  const attributePattern = /data-i18n(?:-placeholder|-aria|-content)?="([^"]+)"/g;

  for (const relativePath of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    for (const match of html.matchAll(attributePattern)) {
      assert.ok(TRANSLATIONS.pl[match[1]], `${relativePath} uses missing key ${match[1]}`);
      assert.ok(TRANSLATIONS.en[match[1]], `${relativePath} uses missing key ${match[1]}`);
    }
  }
});

test('every page loads the catalog and language runtime in the correct order', () => {
  for (const relativePath of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    const translationsAt = html.indexOf('/js/translations.js');
    const runtimeAt = html.indexOf('/js/i18n.js');

    assert.ok(translationsAt >= 0, `${relativePath} does not load translations`);
    assert.ok(runtimeAt > translationsAt, `${relativePath} loads i18n before translations`);
  }
});

test('static HTML fallback text matches the English catalog', () => {
  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const textPattern = /<([a-zA-Z0-9]+)\b[^<>]*\sdata-i18n="([^"]+)"[^<>]*>([^<]*)<\/\1>/g;

  for (const relativePath of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(html, /<html lang="en">/, `${relativePath} is not lang="en"`);
    for (const [, , key, text] of html.matchAll(textPattern)) {
      assert.equal(text.trim(), escape(TRANSLATIONS.en[key]), `${relativePath}: fallback for ${key}`);
    }
  }
});

test('UI strings avoid long dashes', () => {
  for (const language of ['pl', 'en']) {
    for (const [key, value] of Object.entries(TRANSLATIONS[language])) {
      assert.ok(!/[—–]/.test(value), `${language}.${key} contains a long dash`);
    }
  }
});

test('no page has an inline script, which the CSP would block', () => {
  for (const relativePath of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) {
      assert.match(tag, /\ssrc="/, `${relativePath} has an inline script`);
    }
    assert.doesNotMatch(html, /\son[a-z]+="/, `${relativePath} has an inline event handler`);
  }
});

test('every page sets the theme in <head> before the stylesheets', () => {
  for (const relativePath of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    const headEnd = html.indexOf('</head>');
    const themeAt = html.indexOf('/js/theme.js');
    assert.ok(themeAt > 0 && themeAt < headEnd, `${relativePath} does not load theme.js in head`);
    assert.ok(themeAt < html.indexOf('/css/style.css'), `${relativePath} loads theme.js after the stylesheet`);
  }
});

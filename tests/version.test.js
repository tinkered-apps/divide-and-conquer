const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('the service worker cache carries the app version', () => {
  const appVersion = read('public/js/home.js').match(/const APP_VERSION = '([^']+)'/)?.[1];
  const cacheName = read('public/sw.js').match(/const CACHE = '([^']+)'/)?.[1];
  assert.ok(appVersion, 'APP_VERSION not found in public/js/home.js');
  assert.equal(cacheName, `divide-and-conquer-v${appVersion}`);
});

test('the privacy page names the current cache', () => {
  const cacheName = read('public/sw.js').match(/const CACHE = '([^']+)'/)?.[1];
  const listed = read('public/privacy.html').match(/divide-and-conquer-v[\d.]+/g);
  assert.deepEqual([...new Set(listed)], [cacheName]);
});

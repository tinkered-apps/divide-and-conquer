const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, STORAGE_KEY, ALLOWED_SESSION_MINUTES } = require('../public/js/store');

const NOW = new Date('2026-07-24T12:00:00.000Z');

function memoryStorage(initial = {}) {
  const items = { ...initial };
  return {
    items,
    getItem: key => (key in items ? items[key] : null),
    setItem: (key, value) => { items[key] = String(value); },
  };
}

function newStore(storage = memoryStorage()) {
  let next = 0;
  return createStore(storage, { now: () => NOW, makeId: () => `id-${++next}` });
}

test('only approved session durations are accepted', () => {
  assert.deepEqual([...ALLOWED_SESSION_MINUTES], [1, 2, 3, 5, 10]);
  const store = newStore();
  store.createProfile('Ola');
  assert.equal(store.current().sessionMinutes, 2);
  assert.equal(store.updateSessionMinutes(5), true);
  assert.equal(store.current().sessionMinutes, 5);
  assert.equal(store.updateSessionMinutes(4), false);
  assert.equal(store.current().sessionMinutes, 5);
});

test('profiles keep separate progress and review marks', () => {
  const store = newStore();
  const first = store.createProfile('  Test One  ');
  assert.equal(first.name, 'Test One');
  store.setReviewMark('multiply', 7, 6, 'correct');
  store.setReviewMark('multiply', 6, 7, 'correct');

  const stats = store.getStats('multiplication');
  assert.equal(stats.length, 1);
  assert.deepEqual([stats[0].factorA, stats[0].factorB], [6, 7]);
  assert.equal(stats[0].correct, 1);
  assert.equal(stats[0].stage, 1);
  assert.equal(store.getReviewMarks('multiply').length, 1);

  store.createProfile('Test Two');
  assert.equal(store.getStats('multiplication').length, 0);
  assert.equal(store.getReviewMarks('multiply').length, 0);

  store.selectProfile(first.id);
  assert.equal(store.getStats('multiplication').length, 1);
  assert.deepEqual(store.listProfiles().map(profile => profile.name), ['Test One', 'Test Two']);
});

test('a red review mark is saved and recorded as a mistake', () => {
  const store = newStore();
  store.createProfile('Ola');
  store.setReviewMark('divide', 56, 7, 'incorrect');
  assert.deepEqual(store.getReviewMarks('divide'), [{ keyA: 56, keyB: 7, state: 'incorrect' }]);
  const [stat] = store.getStats('division');
  assert.equal(stat.incorrect, 1);
  assert.equal(stat.lastResult, false);

  store.setReviewMark('divide', 56, 7, 'none');
  assert.equal(store.getReviewMarks('divide').length, 0);
  store.setReviewMark('divide', 56, 7, 'correct');
  store.clearReviewMarks('divide');
  assert.equal(store.getReviewMarks('divide').length, 0);
});

test('recorded attempts persist in storage and survive a reload', () => {
  const storage = memoryStorage();
  const store = newStore(storage);
  store.createProfile('Ola');
  const stat = store.recordAttempt('missingFactor', 7, 49, true);
  assert.deepEqual([stat.factorA, stat.product, stat.correct, stat.stage], [7, 49, 1, 1]);

  const reloaded = newStore(storage);
  assert.equal(reloaded.current().name, 'Ola');
  assert.equal(reloaded.getStats('missingFactor')[0].correct, 1);
  assert.ok(storage.items[STORAGE_KEY]);
});

test('two stores on the same storage do not overwrite each other', () => {
  const storage = memoryStorage();
  const tabA = newStore(storage);
  tabA.createProfile('Ola');
  const tabB = newStore(storage);
  tabA.recordAttempt('multiplication', 2, 3, true);
  tabB.recordAttempt('division', 6, 3, true);
  assert.equal(tabA.getStats('multiplication').length, 1);
  assert.equal(tabA.getStats('division').length, 1);
});

test('invalid facts are rejected', () => {
  const store = newStore();
  store.createProfile('Ola');
  assert.throws(() => store.recordAttempt('division', 55, 7, true));
  assert.throws(() => store.recordAttempt('multiplication', 0, 3, true));
  assert.throws(() => store.setReviewMark('multiply', 2, 3, 'maybe'));
});

test('deleting a learner removes their data and signs them out', () => {
  const store = newStore();
  const learner = store.createProfile('Ola');
  store.recordAttempt('multiplication', 2, 3, true);
  assert.equal(store.deleteProfile(learner.id), true);
  assert.equal(store.current(), null);
  assert.equal(store.listProfiles().length, 0);
  assert.equal(store.hasProgress(), false);
});

test('a backup restores learners on another device', () => {
  const source = newStore();
  source.createProfile('Ola');
  source.recordAttempt('multiplication', 3, 4, true);
  source.setReviewMark('multiply', 8, 7, 'incorrect');
  const backup = JSON.parse(JSON.stringify(source.exportData()));
  assert.equal(source.lastBackupAt(), NOW.toISOString());

  const target = newStore();
  assert.equal(target.importData(backup), 1);
  const [profile] = target.listProfiles();
  target.selectProfile(profile.id);
  assert.equal(target.getStats('multiplication').length, 2);
  assert.deepEqual(target.getReviewMarks('multiply'), [{ keyA: 7, keyB: 8, state: 'incorrect' }]);
});

test('importing drops invalid entries and rejects files that are not backups', () => {
  const store = newStore();
  assert.throws(() => store.importData({ hello: 'world' }));
  assert.throws(() => store.importData({ app: 'divide-and-conquer', version: 1, profiles: [] }));

  const count = store.importData({
    app: 'divide-and-conquer',
    version: 1,
    profiles: [
      {
        id: 'abc',
        name: 'X'.repeat(80),
        sessionMinutes: 999,
        stats: {
          multiplication: {
            '3,4': { correct: 2, incorrect: 0, stage: 2, dueAt: NOW.toISOString(), lastResult: true },
            '11,4': { correct: 2, incorrect: 0, stage: 2 },
            '<script>': { correct: 1 },
          },
          division: { '55,7': { correct: 1, incorrect: 0, stage: 1 } },
        },
        reviewMarks: { multiply: { '4,3': 'correct', '2,2': 'evil' } },
      },
      { id: 'no name' },
    ],
  });
  assert.equal(count, 1);
  store.selectProfile('abc');
  const profile = store.current();
  assert.equal(profile.name.length, 30);
  assert.equal(profile.sessionMinutes, 2);
  assert.equal(store.getStats('multiplication').length, 1);
  assert.equal(store.getStats('division').length, 0);
  assert.deepEqual(store.getReviewMarks('multiply'), [{ keyA: 3, keyB: 4, state: 'correct' }]);
});

test('a corrupted or blocked storage does not break the app', () => {
  const corrupted = newStore(memoryStorage({ [STORAGE_KEY]: '{not json' }));
  assert.equal(corrupted.current(), null);
  corrupted.createProfile('Ola');
  assert.equal(corrupted.current().name, 'Ola');

  const blocked = newStore({
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  });
  blocked.createProfile('Ola');
  blocked.recordAttempt('multiplication', 2, 2, true);
  assert.equal(blocked.getStats('multiplication').length, 1);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler, masteryOf } = require('../public/js/learning');
const { computeMasteryUpdate } = require('../public/js/store');

const NOW = new Date('2026-07-24T12:00:00.000Z');

function current(stage, dueAt = NOW.toISOString()) {
  return { stage, dueAt, correct: 0, incorrect: 0 };
}

test('due correct answers promote through increasingly spaced stages', () => {
  const first = computeMasteryUpdate(current(0), true, NOW);
  assert.equal(first.stage, 1);
  assert.equal(first.dueAt, NOW.toISOString());

  const familiar = computeMasteryUpdate(current(1), true, NOW);
  assert.equal(familiar.stage, 2);
  assert.equal(familiar.dueAt, '2026-07-25T12:00:00.000Z');

  const learned = computeMasteryUpdate(current(2), true, NOW);
  assert.equal(learned.stage, 3);
  assert.equal(learned.dueAt, '2026-07-27T12:00:00.000Z');
});

test('mastered tasks receive a 30-day maintenance review', () => {
  const result = computeMasteryUpdate(current(5), true, NOW);
  assert.equal(result.stage, 5);
  assert.equal(result.dueAt, '2026-08-23T12:00:00.000Z');
});

test('early correct answers do not promote or move the due date', () => {
  const dueAt = '2026-08-01T12:00:00.000Z';
  const result = computeMasteryUpdate(current(3, dueAt), true, NOW);
  assert.equal(result.stage, 3);
  assert.equal(result.dueAt, dueAt);
});

test('incorrect answers reduce mastery by two stages and become due now', () => {
  const result = computeMasteryUpdate(current(5, '2026-08-01T12:00:00.000Z'), false, NOW);
  assert.equal(result.stage, 3);
  assert.equal(result.dueAt, NOW.toISOString());
  assert.equal(result.lastResult, false);
});

function task(id) {
  return { id };
}

test('an incorrect task returns after exactly two intervening questions', () => {
  const tasks = ['a', 'b', 'c', 'd', 'e'].map(task);
  const scheduler = createScheduler(
    tasks,
    [{ id: 'a', stage: 2, dueAt: NOW.toISOString() }],
    { random: () => 0, now: () => NOW }
  );
  assert.equal(scheduler.pick().id, 'a');
  scheduler.record('a', false, { id: 'a', stage: 0, dueAt: NOW.toISOString() }, 2);
  assert.equal(scheduler.pick().id, 'b');
  assert.equal(scheduler.pick().id, 'c');
  assert.equal(scheduler.pick().id, 'a');
});

test('a first successful recall returns after three intervening questions', () => {
  const tasks = ['a', 'b', 'c', 'd', 'e', 'f'].map(task);
  const scheduler = createScheduler(
    tasks,
    [{ id: 'a', stage: 0, dueAt: NOW.toISOString() }],
    { random: () => 0, now: () => NOW }
  );
  assert.equal(scheduler.pick().id, 'a');
  scheduler.record('a', true, { id: 'a', stage: 1, dueAt: NOW.toISOString() }, 0);
  assert.equal(scheduler.pick().id, 'b');
  assert.equal(scheduler.pick().id, 'c');
  assert.equal(scheduler.pick().id, 'd');
  assert.equal(scheduler.pick().id, 'a');
});

test('scheduler avoids either of the previous two tasks when alternatives exist', () => {
  const scheduler = createScheduler(
    ['a', 'b', 'c', 'd'].map(task),
    [],
    { random: () => 0, now: () => NOW }
  );
  const first = scheduler.pick().id;
  const second = scheduler.pick().id;
  const third = scheduler.pick().id;
  assert.notEqual(second, first);
  assert.notEqual(third, first);
  assert.notEqual(third, second);
});

test('masteryOf classifies a fact from its stats', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();

  assert.equal(masteryOf(undefined), 'none');
  assert.equal(masteryOf({ correct: 0, incorrect: 0, stage: 0 }), 'none');
  assert.equal(masteryOf({ correct: 1, incorrect: 0, stage: 1, dueAt: future, lastResult: true }), 'learning');
  assert.equal(masteryOf({ correct: 0, incorrect: 1, stage: 0, dueAt: future, lastResult: false }), 'review');
  assert.equal(masteryOf({ correct: 3, incorrect: 0, stage: 2, dueAt: past, lastResult: true }), 'review');
  assert.equal(masteryOf({ correct: 5, incorrect: 0, stage: 3, dueAt: future, lastResult: true }), 'learned');
});

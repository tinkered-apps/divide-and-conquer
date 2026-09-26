(() => {
  const STATES = ['none', 'correct', 'incorrect'];
  const grid = document.getElementById('mult-grid');
  const cellMap = {};
  let user;
  let counts = { correct: 0, incorrect: 0, none: 100 };

  const canonicalKey = (a, b) => `${Math.min(a, b)},${Math.max(a, b)}`;

  const STATE_KEY = { none: 'review.unmarked', correct: 'review.knows', incorrect: 'review.doesNotKnow' };
  const stateText = state => I18N.t(STATE_KEY[state]);

  function updateSummary() {
    document.getElementById('num-green').textContent = counts.correct;
    document.getElementById('num-red').textContent = counts.incorrect;
    document.getElementById('num-gray').textContent = counts.none;
  }

  function labelCell(cell) {
    cell.setAttribute('aria-label', `${cell.dataset.label}: ${stateText(cell.dataset.state || 'none')}`);
  }

  function announce(cell) {
    const status = document.getElementById('review-status');
    if (status) status.textContent = `${cell.dataset.label}: ${stateText(cell.dataset.state)}`;
  }

  function setState(cell, next) {
    const current = cell.dataset.state || 'none';
    if (current === next) return;
    counts[current] -= 1;
    counts[next] += 1;
    cell.dataset.state = next;
    labelCell(cell);
  }

  function flashResult(cell) {
    cell.textContent = cell.dataset.result;
    cell.classList.add('flash-result');
    setTimeout(() => {
      cell.textContent = cell.dataset.display;
      cell.classList.remove('flash-result');
    }, 1500);
  }

  function cycleState(cell) {
    const current = cell.dataset.state || 'none';
    const next = STATES[(STATES.indexOf(current) + 1) % STATES.length];
    const a = Number(cell.dataset.a);
    const b = Number(cell.dataset.b);
    const pair = a === b ? null : cellMap[`${b},${a}`];

    setState(cell, next);
    if (pair) setState(pair, next);
    updateSummary();
    flashResult(cell);
    if (pair) flashResult(pair);
    announce(cell);

    try {
      STORE.setReviewMark('multiply', a, b, next);
    } catch {
      setState(cell, current);
      if (pair) setState(pair, current);
      updateSummary();
    }
  }

  function buildGrid(saved) {
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const key = `${a},${b}`;
        const label = `${a}×${b}`;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.label = label;
        cell.dataset.result = a * b;
        cell.dataset.a = a;
        cell.dataset.b = b;
        cell.dataset.display = label.replace(/[×÷]/, '\u200b$&');
        cell.textContent = cell.dataset.display;
        const restored = saved[canonicalKey(a, b)] || 'none';
        cell.dataset.state = restored;
        if (restored !== 'none') {
          counts.none -= 1;
          counts[restored] += 1;
        }
        labelCell(cell);
        cell.addEventListener('click', () => cycleState(cell));
        cellMap[key] = cell;
        grid.appendChild(cell);
      }
    }
  }

  function init() {
    user = STORE.current();
    if (!user) {
      location.href = '/';
      return;
    }
    const saved = {};
    STORE.getReviewMarks('multiply').forEach(mark => { saved[`${mark.keyA},${mark.keyB}`] = mark.state; });
    buildGrid(saved);
    updateSummary();
  }

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!user) return;
    STORE.clearReviewMarks('multiply');
    Object.values(cellMap).forEach(cell => { cell.dataset.state = 'none'; labelCell(cell); });
    counts = { correct: 0, incorrect: 0, none: 100 };
    updateSummary();
  });

  document.addEventListener('languagechange', () => {
    Object.values(cellMap).forEach(labelCell);
  });

  init();
})();

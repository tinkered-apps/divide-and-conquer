(() => {
  const STATES = ['none', 'correct', 'incorrect'];
  const grid = document.getElementById('div-grid');
  let user;
  let counts = { correct: 0, incorrect: 0, none: 100 };

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
    counts[current] -= 1;
    counts[next] += 1;
    cell.dataset.state = next;
    labelCell(cell);
    updateSummary();
    flashResult(cell);
    announce(cell);

    try {
      STORE.setReviewMark('divide', Number(cell.dataset.dividend), Number(cell.dataset.divisor), next);
    } catch {
      counts[next] -= 1;
      counts[current] += 1;
      cell.dataset.state = current;
      labelCell(cell);
      updateSummary();
    }
  }

  function buildGrid(saved) {
    for (let divisor = 1; divisor <= 10; divisor++) {
      for (let quotient = 1; quotient <= 10; quotient++) {
        const dividend = divisor * quotient;
        const key = `${dividend},${divisor}`;
        const label = `${dividend}÷${divisor}`;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.label = label;
        cell.dataset.result = quotient;
        cell.dataset.dividend = dividend;
        cell.dataset.divisor = divisor;
        cell.dataset.display = label.replace(/[×÷]/, '\u200b$&');
        cell.textContent = cell.dataset.display;
        const restored = saved[key] || 'none';
        cell.dataset.state = restored;
        if (restored !== 'none') {
          counts.none -= 1;
          counts[restored] += 1;
        }
        labelCell(cell);
        cell.addEventListener('click', () => cycleState(cell));
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
    STORE.getReviewMarks('divide').forEach(mark => { saved[`${mark.keyA},${mark.keyB}`] = mark.state; });
    buildGrid(saved);
    updateSummary();
  }

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!user) return;
    STORE.clearReviewMarks('divide');
    grid.querySelectorAll('.cell').forEach(cell => { cell.dataset.state = 'none'; labelCell(cell); });
    counts = { correct: 0, incorrect: 0, none: 100 };
    updateSummary();
  });

  document.addEventListener('languagechange', () => {
    grid.querySelectorAll('.cell').forEach(labelCell);
  });

  init();
})();

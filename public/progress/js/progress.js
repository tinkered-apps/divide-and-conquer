(() => {
  const STATUS_KEYS = {
    none: 'progress.noneTitle',
    learning: 'progress.learningTitle',
    learned: 'progress.learnedTitle',
    review: 'progress.reviewTitle',
  };

  const statusOf = LEARNING.masteryOf;

  const modal = document.getElementById('cell-modal');
  const closeButton = document.getElementById('cell-modal-close');
  const pageContent = document.querySelector('main');
  const pageNav = document.querySelector('.grid-nav');
  let currentModal = null;
  let previousFocus = null;

  function closeCellModal() {
    if (modal.style.display === 'none') return;
    modal.style.display = 'none';
    pageContent.inert = false;
    pageNav.inert = false;
    previousFocus?.focus();
  }

  function showCellModal(expression, result, stat) {
    if (modal.style.display === 'none') previousFocus = document.activeElement;
    currentModal = { expression, result, stat };
    const correct = stat?.correct || 0;
    const incorrect = stat?.incorrect || 0;
    const total = correct + incorrect;
    const status = statusOf(stat);
    document.getElementById('cell-modal-expr').textContent = `${expression} =`;
    document.getElementById('cell-modal-result').textContent = result;
    const statusElement = document.getElementById('cell-modal-status');
    statusElement.textContent = I18N.t(STATUS_KEYS[status]);
    statusElement.dataset.status = status;

    const barWrap = document.getElementById('cell-modal-bar-wrap');
    const barGreen = document.getElementById('cell-modal-bar-green');
    const barRed = document.getElementById('cell-modal-bar-red');
    const counts = document.getElementById('cell-modal-counts');
    const none = document.getElementById('cell-modal-none');
    if (total) {
      barWrap.style.display = 'flex';
      counts.style.display = 'flex';
      none.style.display = 'none';
      barGreen.style.flex = correct || 0.01;
      barRed.style.flex = incorrect || 0.01;
      counts.innerHTML = `<span>${I18N.t('progress.correctCount', { count: correct })}</span><span>${I18N.t('progress.wrongCount', { count: incorrect })}</span>`;
    } else {
      barWrap.style.display = 'none';
      counts.style.display = 'none';
      none.style.display = 'block';
      none.textContent = I18N.t('progress.notPracticed');
    }
    modal.style.display = 'flex';
    pageContent.inert = true;
    pageNav.inert = true;
    closeButton.focus();
  }

  function addCell(container, label, result, stat, display = label) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    const status = statusOf(stat);
    cell.dataset.progress = status;
    cell.dataset.expression = label;
    cell.textContent = String(display).replace(/[×÷]/, '\u200b$&');
    cell.setAttribute('aria-label', `${label}, ${I18N.t(STATUS_KEYS[status])}`);
    cell.addEventListener('click', () => showCellModal(label, result, stat));
    container.appendChild(cell);
  }

  function buildGrid(container, getter, formatter) {
    for (let row = 1; row <= 10; row++) {
      for (let column = 1; column <= 10; column++) {
        const item = formatter(row, column);
        addCell(container, item.label, item.result, getter(item.key), item.display);
      }
    }
  }

  function renderSummary(panel, stats, uniqueKeys) {
    const counts = { none: 0, learning: 0, learned: 0, review: 0 };
    uniqueKeys.forEach(key => { counts[statusOf(stats[key])] += 1; });
    panel.querySelector('.summary').innerHTML = [
      ['learned', 'remembered'],
      ['review', 'review due'],
      ['learning', 'learning'],
      ['none', 'not practised'],
    ].map(([status, label]) => `
      <div class="stat-chip">
        <div class="num num-${status}">${counts[status]}</div>
        <div class="lbl" data-i18n="progress.${status}">${label}</div>
      </div>
    `).join('');
    I18N.apply(panel);
  }

  function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(item => {
          const active = item === tab;
          item.classList.toggle('active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        document.querySelectorAll('.panel').forEach(panel => panel.classList.add('hidden-mobile'));
        document.getElementById(tab.dataset.panel).classList.remove('hidden-mobile');
      });
    });
  }

  function init() {
    const user = STORE.current();
    if (!user) {
      location.href = '/';
      return;
    }

    const mult = {};
    STORE.getStats('multiplication').forEach(stat => {
      const a = Math.min(stat.factorA, stat.factorB);
      const b = Math.max(stat.factorA, stat.factorB);
      mult[`${a},${b}`] = stat;
    });
    const division = {};
    STORE.getStats('division').forEach(stat => { division[`${stat.dividend},${stat.divisor}`] = stat; });
    const missing = {};
    STORE.getStats('missingFactor').forEach(stat => { missing[`${stat.factorA},${stat.product}`] = stat; });

    buildGrid(
      document.getElementById('mult-grid'),
      key => mult[key],
      (a, b) => ({
        key: `${Math.min(a, b)},${Math.max(a, b)}`,
        label: `${a}×${b}`,
        display: `${a}×${b}`,
        result: a * b,
      })
    );
    buildGrid(
      document.getElementById('div-grid'),
      key => division[key],
      (divisor, quotient) => ({
        key: `${divisor * quotient},${divisor}`,
        label: `${divisor * quotient}÷${divisor}`,
        display: `${divisor * quotient}÷${divisor}`,
        result: quotient,
      })
    );
    buildGrid(
      document.getElementById('missing-grid'),
      key => missing[key],
      (factorA, answer) => ({
        key: `${factorA},${factorA * answer}`,
        label: `${factorA}×_=${factorA * answer}`,
        display: `${factorA}×_=${factorA * answer}`,
        result: answer,
      })
    );

    const multKeys = [];
    for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) multKeys.push(`${a},${b}`);
    const divisionKeys = [];
    const missingKeys = [];
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        divisionKeys.push(`${a * b},${a}`);
        missingKeys.push(`${a},${a * b}`);
      }
    }
    renderSummary(document.getElementById('mult-panel'), mult, multKeys);
    renderSummary(document.getElementById('div-panel'), division, divisionKeys);
    renderSummary(document.getElementById('missing-panel'), missing, missingKeys);
    setupTabs();
  }

  closeButton.addEventListener('click', closeCellModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeCellModal();
  });
  document.addEventListener('keydown', event => {
    if (modal.style.display === 'none') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCellModal();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
    }
  });
  document.addEventListener('languagechange', () => {
    document.querySelectorAll('.math-grid .cell').forEach(cell => {
      cell.setAttribute(
        'aria-label',
        `${cell.dataset.expression}, ${I18N.t(STATUS_KEYS[cell.dataset.progress])}`
      );
    });
    if (modal.style.display !== 'none' && currentModal) {
      showCellModal(currentModal.expression, currentModal.result, currentModal.stat);
    }
  });
  init();
})();

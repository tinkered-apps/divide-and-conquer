const LEARNING = (() => {
  // One definition of a fact's state, shared by the practice screen
  // (question weight) and the Progress grid (cell colour and weight).
  function masteryOf(stat) {
    if (!stat || stat.correct + stat.incorrect === 0) return 'none';
    const due = stat.dueAt && new Date(stat.dueAt) <= new Date();
    if (stat.lastResult === false || (due && stat.stage >= 2)) return 'review';
    if (stat.stage >= 3) return 'learned';
    return 'learning';
  }

  function createScheduler(tasks, initialStats, options = {}) {
    const random = options.random || Math.random;
    const now = options.now || (() => new Date());
    const stats = new Map(initialStats.map(stat => [stat.id, { ...stat }]));
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    const queue = [];
    const recent = [];
    let questionsShown = 0;

    function isRecent(id) {
      return recent.includes(id);
    }

    function choose(items) {
      if (!items.length) return null;
      return items[Math.floor(random() * items.length)];
    }

    function urgency(stat) {
      return [stat.stage ?? 0, new Date(stat.dueAt || 0).getTime()];
    }

    function pick() {
      const eligible = queue
        .filter(item => item.eligibleAt <= questionsShown + 1)
        .sort((a, b) => a.eligibleAt - b.eligibleAt);
      let task = null;
      if (eligible.length) {
        const queued = eligible.find(item => !isRecent(item.id)) || eligible[0];
        queue.splice(queue.indexOf(queued), 1);
        task = taskMap.get(queued.id);
      }

      const waitingIds = new Set(
        queue
          .filter(item => item.eligibleAt > questionsShown + 1)
          .map(item => item.id)
      );
      const available = tasks.filter(item => !isRecent(item.id) && !waitingIds.has(item.id));
      if (!task) {
        const due = available
          .filter(item => {
            const stat = stats.get(item.id);
            return stat && (!stat.dueAt || new Date(stat.dueAt) <= now());
          })
          .sort((a, b) => {
            const ua = urgency(stats.get(a.id));
            const ub = urgency(stats.get(b.id));
            return ua[0] - ub[0] || ua[1] - ub[1];
          });
        const unseen = available.filter(item => !stats.has(item.id));
        if (due.length && unseen.length) {
          task = random() < 0.7 ? choose(due.slice(0, 5)) : choose(unseen);
        } else {
          task = choose(due) || choose(unseen);
        }
      }

      if (!task) {
        const maintenance = available
          .filter(item => stats.has(item.id))
          .sort((a, b) =>
            new Date(stats.get(a.id).dueAt || 0) - new Date(stats.get(b.id).dueAt || 0)
          );
        task = choose(maintenance.slice(0, 5)) || choose(tasks);
      }

      questionsShown += 1;
      recent.push(task.id);
      if (recent.length > 2) recent.shift();
      return task;
    }

    function record(taskId, correct, updatedStat, previousStage) {
      if (updatedStat) stats.set(taskId, { ...updatedStat, id: taskId });
      const newStage = updatedStat?.stage ?? previousStage;
      if (!correct) {
        queue.push({ id: taskId, eligibleAt: questionsShown + 3 });
      } else if (previousStage === 0 && newStage === 1) {
        queue.push({ id: taskId, eligibleAt: questionsShown + 4 });
      }
    }

    return { pick, record, getStat: id => stats.get(id), stats, queue };
  }

  function startGame(config) {
    let user;
    let scheduler;
    let currentTask;
    let scoreCorrect = 0;
    let scoreIncorrect = 0;
    let deadline;
    let timerInterval;
    let expired = false;
    let answerCommitted = false;
    let waitingForNext = false;
    let feedbackType = null;
    let advanceTimer = null;
    const strengthened = new Set();

    const questionEl = document.getElementById('question');
    const inputEl = document.getElementById('answer-input');
    const feedbackEl = document.getElementById('feedback');
    const btnCheck = document.getElementById('btn-check');
    const btnNext = document.getElementById('btn-next');
    const timerEl = document.getElementById('timer');
    const scoreCorrectEl = document.getElementById('score-correct');
    const scoreIncorrectEl = document.getElementById('score-incorrect');
    const gameCard = document.querySelector('.game-card');

    function init() {
      user = STORE.current();
      if (!user) {
        window.location.href = '/';
        return;
      }
      const stats = loadStats();
      scheduler = createScheduler(config.tasks(), stats.map(config.normalizeStat));
      setupEvents();
      showNextQuestion();
      startTimer(user.sessionMinutes || 2);
    }

    function loadStats() {
      try {
        return STORE.getStats(config.type);
      } catch {
        return [];
      }
    }

    function showNextQuestion() {
      clearTimeout(advanceTimer);
      if (expired) {
        showSummary();
        return;
      }
      waitingForNext = false;
      answerCommitted = false;
      currentTask = scheduler.pick();
      questionEl.textContent = config.question(currentTask);
      questionEl.dataset.mastery = masteryOf(scheduler.getStat(currentTask.id));
      inputEl.value = '';
      inputEl.className = 'answer-input';
      inputEl.disabled = false;
      feedbackEl.className = 'feedback';
      feedbackEl.textContent = '';
      feedbackType = null;
      btnCheck.style.display = '';
      btnCheck.disabled = false;
      btnNext.className = 'btn-next';
      inputEl.focus();
    }

    function saveAnswer(correct) {
      try {
        return STORE.recordAttempt(config.type, ...config.keys(currentTask), correct);
      } catch {
        return null;
      }
    }

    function checkAnswer() {
      if (waitingForNext || answerCommitted) return;
      const userAnswer = Number.parseInt(inputEl.value, 10);
      if (Number.isNaN(userAnswer)) {
        inputEl.focus();
        return;
      }

      answerCommitted = true;
      const correct = userAnswer === currentTask.answer;
      const previousStage = scheduler.getStat(currentTask.id)?.stage || 0;
      inputEl.disabled = true;
      btnCheck.disabled = true;

      if (correct) {
        scoreCorrect += 1;
        scoreCorrectEl.textContent = scoreCorrect;
        inputEl.className = 'answer-input correct';
        feedbackEl.className = 'feedback visible success';
        feedbackType = 'correct';
        feedbackEl.textContent = I18N.t('game.correct');
      } else {
        scoreIncorrect += 1;
        scoreIncorrectEl.textContent = scoreIncorrect;
        inputEl.className = 'answer-input incorrect';
        feedbackEl.className = 'feedback visible error';
        feedbackType = 'incorrect';
        feedbackEl.textContent = I18N.t('game.correctAnswer', { answer: currentTask.answer });
      }

      const saved = saveAnswer(correct);
      const normalized = saved ? config.normalizeStat(saved) : null;
      if (normalized?.stage > previousStage) strengthened.add(currentTask.id);
      scheduler.record(currentTask.id, correct, normalized, previousStage);

      if (correct) {
        feedbackEl.style.setProperty('--feedback-delay', '800ms');
        feedbackEl.classList.add('advancing');
        advanceTimer = setTimeout(() => expired ? showSummary() : showNextQuestion(), 800);
      } else if (expired) {
        showSummary();
      } else {
        btnCheck.style.display = 'none';
        btnNext.className = 'btn-next visible';
        waitingForNext = true;
        feedbackEl.style.setProperty('--feedback-delay', '3000ms');
        feedbackEl.classList.add('advancing');
        advanceTimer = setTimeout(showNextQuestion, 3000);
      }
    }

    function formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function tickTimer() {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      timerEl.textContent = formatTime(seconds);
      if (seconds > 0) return;
      expired = true;
      clearInterval(timerInterval);
      timerEl.classList.add('expired');
      if (waitingForNext) showSummary();
    }

    function startTimer(minutes) {
      deadline = Date.now() + minutes * 60 * 1000;
      timerEl.textContent = formatTime(minutes * 60);
      timerInterval = setInterval(tickTimer, 250);
    }

    function showSummary() {
      if (gameCard.classList.contains('session-finished')) return;
      clearInterval(timerInterval);
      const total = scoreCorrect + scoreIncorrect;
      const accuracy = total ? Math.round(scoreCorrect / total * 100) : 0;
      gameCard.classList.add('session-finished');
      gameCard.innerHTML = `
        <div class="session-summary" role="status">
          <h1 data-i18n="game.finished">${I18N.t('game.finished')}</h1>
          <p data-i18n="game.finishedDesc">${I18N.t('game.finishedDesc')}</p>
          <div class="summary-grid">
            <div><strong>${scoreCorrect}</strong><span data-i18n="game.good">${I18N.t('game.good')}</span></div>
            <div><strong>${scoreIncorrect}</strong><span data-i18n="game.improve">${I18N.t('game.improve')}</span></div>
            <div><strong>${accuracy}%</strong><span data-i18n="game.accuracy">${I18N.t('game.accuracy')}</span></div>
            <div><strong>${strengthened.size}</strong><span data-i18n="game.strengthened">${I18N.t('game.strengthened')}</span></div>
          </div>
          <div class="summary-actions">
            <button type="button" class="btn btn-primary" id="restart-session" data-i18n="game.again">${I18N.t('game.again')}</button>
            <a class="btn summary-home" href="/" data-i18n="game.home">${I18N.t('game.home')}</a>
          </div>
        </div>
      `;
      I18N.apply(gameCard);
      document.getElementById('restart-session').addEventListener('click', () => location.reload());
    }

    function setupEvents() {
      btnCheck.addEventListener('click', checkAnswer);
      btnNext.addEventListener('click', showNextQuestion);
      inputEl.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (waitingForNext) showNextQuestion();
          else checkAnswer();
          return;
        }
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
        if (!allowed.includes(event.key) && !/^\d$/.test(event.key)) event.preventDefault();
      });
      document.addEventListener('languagechange', () => {
        if (feedbackType === 'correct') {
          feedbackEl.textContent = I18N.t('game.correct');
        } else if (feedbackType === 'incorrect') {
          feedbackEl.textContent = I18N.t('game.correctAnswer', { answer: currentTask.answer });
        }
        I18N.apply(gameCard);
      });
    }

    init();
  }

  return { createScheduler, startGame, masteryOf };
})();

if (typeof module !== 'undefined') module.exports = LEARNING;

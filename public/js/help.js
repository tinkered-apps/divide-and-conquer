(() => {
  const page = document.body.dataset.helpPage || 'home';
  const header = document.querySelector('.site-header, .status-bar, .grid-nav');
  if (!header || !I18N) return;

  const tools = I18N.ensureHeaderTools(header);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'help-button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.textContent = '?';
  tools.appendChild(button);

  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <section class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <button type="button" class="help-close">×</button>
      <h2 id="help-title"></h2>
      <p class="help-intro"></p>
      <ul></ul>
    </section>
  `;
  document.body.appendChild(overlay);

  const closeButton = overlay.querySelector('.help-close');
  let previousFocus = null;

  function translate() {
    button.setAttribute('aria-label', I18N.t('common.help'));
    closeButton.setAttribute('aria-label', I18N.t('common.close'));
    overlay.querySelector('#help-title').textContent = I18N.t(`help.${page}.title`);
    overlay.querySelector('.help-intro').textContent = I18N.t(`help.${page}.intro`);
    overlay.querySelector('ul').innerHTML = [1, 2, 3, 4]
      .map(index => `<li>${I18N.t(`help.${page}.${index}`)}</li>`)
      .join('');
  }

  function open() {
    previousFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    closeButton.focus();
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    previousFocus?.focus();
  }

  button.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  document.addEventListener('languagechange', translate);
  document.addEventListener('keydown', event => {
    if (!overlay.classList.contains('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.disabled);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  translate();
})();

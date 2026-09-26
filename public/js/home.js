(() => {
  // Version shown in the footer; CACHE in sw.js carries the same number (see AGENTS.md).
  const APP_VERSION = '1.00';
  document.getElementById('app-version').textContent = 'v' + APP_VERSION;

  const picker = document.getElementById('auth-modal');
  const profileList = document.getElementById('profile-list');
  const profileDivider = document.getElementById('profile-divider');
  const closePickerButton = document.getElementById('btn-close-picker');
  const nickInput = document.getElementById('input-nick');
  const nickError = document.getElementById('new-user-error');
  const headerUser = document.getElementById('header-user');
  const headerNick = document.getElementById('header-nick');
  const settings = document.getElementById('session-settings');

  const deviceData = document.getElementById('device-data');
  const backupStatus = document.getElementById('backup-status');
  const installTip = document.getElementById('data-install');
  const dataStatus = document.getElementById('data-status');
  const importInput = document.getElementById('import-file');
  let previousFocus = null;

  function flash(element, text) {
    element.textContent = text;
    clearTimeout(element.flashTimer);
    element.flashTimer = setTimeout(() => { element.textContent = ''; }, 4000);
  }

  // ─── Learner picker ──────────────────────────────
  function renderProfiles() {
    const profiles = STORE.listProfiles();
    profileList.innerHTML = '';
    profiles.forEach(profile => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary btn-full';
      button.textContent = profile.name;
      button.addEventListener('click', () => {
        STORE.selectProfile(profile.id);
        STORE.requestPersistence();
        closePicker();
        showCurrent();
      });
      profileList.appendChild(button);
    });
    profileList.classList.toggle('hidden', !profiles.length);
    profileDivider.classList.toggle('hidden', !profiles.length);
  }

  function openPicker() {
    previousFocus = document.activeElement;
    renderProfiles();
    nickInput.value = '';
    nickError.textContent = '';
    nickInput.classList.remove('error');
    const canClose = Boolean(STORE.current());
    closePickerButton.classList.toggle('hidden', !canClose);
    picker.classList.remove('hidden');
    (profileList.querySelector('button') || nickInput).focus();
  }

  function closePicker() {
    if (!STORE.current()) return;
    picker.classList.add('hidden');
    previousFocus?.focus?.();
  }

  function createLearner() {
    const name = nickInput.value.trim();
    nickError.textContent = '';
    nickInput.classList.remove('error');
    if (!name) {
      nickInput.classList.add('error');
      nickError.textContent = I18N.t('profile.nameRequired');
      nickInput.focus();
      return;
    }
    try {
      STORE.createProfile(name);
    } catch {
      nickInput.classList.add('error');
      nickError.textContent = I18N.t('profile.tooMany');
      return;
    }
    STORE.requestPersistence();
    closePicker();
    showCurrent();
  }

  // ─── Home screen for the current learner ─────────
  function selectDuration(minutes) {
    settings.querySelectorAll('[data-minutes]').forEach(button => {
      const selected = Number(button.dataset.minutes) === minutes;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  // iPadOS reports itself as a Mac, so a touch screen marks it as an iPad.
  function needsInstallTip() {
    const apple = /iPhone|iPad|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return apple && !navigator.standalone;
  }

  function renderBackupStatus() {
    const last = STORE.lastBackupAt();
    backupStatus.textContent = last
      ? I18N.t('data.lastBackup', { date: new Date(last).toLocaleDateString(I18N.getLanguage()) })
      : I18N.t('data.noBackup');
  }

  function showCurrent() {
    const user = STORE.current();
    if (!user) {
      headerUser.classList.add('hidden');
      settings.classList.add('hidden');
      deviceData.classList.add('hidden');
      openPicker();
      return;
    }
    headerNick.textContent = user.name;
    headerUser.classList.remove('hidden');
    settings.classList.remove('hidden');
    deviceData.classList.remove('hidden');
    installTip.classList.toggle('hidden', !needsInstallTip());
    selectDuration(user.sessionMinutes);
    renderBackupStatus();
  }

  settings.querySelectorAll('[data-minutes]').forEach(button => {
    button.addEventListener('click', () => {
      const minutes = Number(button.dataset.minutes);
      STORE.updateSessionMinutes(minutes);
      selectDuration(minutes);

    });
  });

  // ─── Backup, restore, delete ─────────────────────
  function exportBackup() {
    const backup = STORE.exportData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `divide-and-conquer-backup-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    renderBackupStatus();
    flash(dataStatus, I18N.t('data.exported'));
  }

  async function importBackup(file) {
    const status = STORE.current() ? dataStatus : nickError;
    try {
      const count = STORE.importData(JSON.parse(await file.text()));
      if (STORE.current()) {
        flash(dataStatus, I18N.t('data.imported', { count }));
        showCurrent();
      } else {
        renderProfiles();
        (profileList.querySelector('button') || nickInput).focus();
      }
    } catch {
      flash(status, I18N.t('data.importFailed'));
    }
  }

  function deleteLearner() {
    const user = STORE.current();
    if (!user) return;
    if (!window.confirm(I18N.t('data.deleteConfirm', { name: user.name }))) return;
    STORE.deleteProfile(user.id);
    showCurrent();
  }

  document.getElementById('btn-export').addEventListener('click', exportBackup);
  document.getElementById('btn-import').addEventListener('click', () => importInput.click());
  document.getElementById('btn-picker-import').addEventListener('click', () => importInput.click());
  document.getElementById('btn-delete').addEventListener('click', deleteLearner);
  importInput.addEventListener('change', () => {
    const [file] = importInput.files;
    importInput.value = '';
    if (file) importBackup(file);
  });

  document.getElementById('btn-switch').addEventListener('click', openPicker);
  document.getElementById('btn-create-user').addEventListener('click', createLearner);
  nickInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') createLearner();
  });
  closePickerButton.addEventListener('click', closePicker);
  picker.addEventListener('click', event => {
    if (event.target === picker) closePicker();
  });
  document.addEventListener('keydown', event => {
    if (picker.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      closePicker();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...picker.querySelectorAll('button, input')]
      .filter(element => !element.disabled && element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!picker.contains(document.activeElement)) {
      event.preventDefault();
      first?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('languagechange', () => {
    if (STORE.current()) renderBackupStatus();
  });

  showCurrent();
})();

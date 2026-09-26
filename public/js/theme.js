// Loaded in <head> so data-theme is set before first paint. The saved choice
// wins; without one, the system setting decides and is followed live. The
// switch cycles system -> light -> dark -> system.
const THEME = (() => {
  const STORAGE_KEY = 'divide-and-conquer-theme';
  const NEXT_MODE = { system: 'light', light: 'dark', dark: 'system' };
  const ACTION = {
    light: ['theme.toLight', 'Switch to light mode'],
    dark: ['theme.toDark', 'Switch to dark mode'],
    system: ['theme.toSystem', 'Follow the system theme'],
  };
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  // Used when storage is blocked (private mode): lasts until the page closes.
  let unsavedMode = null;

  function mode() {
    if (unsavedMode) return unsavedMode;
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
      return 'system';
    }
  }

  function current() {
    const chosen = mode();
    if (chosen !== 'system') return chosen;
    return systemDark.matches ? 'dark' : 'light';
  }

  function label() {
    const [key, fallback] = ACTION[NEXT_MODE[mode()]];
    return typeof I18N !== 'undefined' ? I18N.t(key) : fallback;
  }

  const ICONS = {
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  };

  // The icon shows what the next click switches to.
  function refreshButtons() {
    const icon = ICONS[NEXT_MODE[mode()]];
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.innerHTML = icon;
      button.setAttribute('aria-label', label());
      button.title = label();
    });
  }

  function apply() {
    root.dataset.theme = current();
    refreshButtons();
  }

  function set(nextMode) {
    try {
      if (nextMode === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, nextMode);
      unsavedMode = null;
    } catch {
      unsavedMode = nextMode;
    }
    apply();
  }

  function mountToggle() {
    const header = document.querySelector('.site-header, .status-bar, .grid-nav');
    if (!header) return;
    let tools = header.querySelector('.header-tools');
    if (!tools) {
      tools = document.createElement('div');
      tools.className = 'header-tools';
      header.appendChild(tools);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.addEventListener('click', () => set(NEXT_MODE[mode()]));
    tools.appendChild(button);
    refreshButtons();
  }

  apply();
  systemDark.addEventListener('change', apply);
  document.addEventListener('languagechange', refreshButtons);
  document.addEventListener('DOMContentLoaded', mountToggle, { once: true });

  return { current, mode, set };
})();

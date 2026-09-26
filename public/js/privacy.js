// Privacy page: shows the note in the language chosen in the app. The header
// toggles from theme.js and i18n.js work as on every other page, and share
// their stored choices with the app.
(() => {
  function showLanguage() {
    const language = I18N.getLanguage();
    document.querySelectorAll('[data-locale]').forEach(article => {
      article.hidden = article.dataset.locale !== language;
    });
  }

  showLanguage();
  document.addEventListener('languagechange', showLanguage);
})();

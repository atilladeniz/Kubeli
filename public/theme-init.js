// Sync theme from localStorage before first paint to prevent flash.
// Loaded as a blocking classic script from index.html so it runs before
// the app renders; kept external because the CSP forbids inline scripts.
(function () {
  try {
    var raw = localStorage.getItem('kubeli-ui-settings');
    if (!raw) { document.documentElement.classList.add('classic-dark', 'vibrancy-standard'); return; }
    var s = JSON.parse(raw);
    var theme = s && s.state && s.state.settings && s.state.settings.theme;
    var resolved = theme || 'classic-dark';
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(resolved);
    var vib = (s.state && s.state.settings && s.state.settings.vibrancyLevel) || 'standard';
    document.documentElement.classList.add('vibrancy-' + vib);
  } catch {
    document.documentElement.classList.add('classic-dark', 'vibrancy-standard');
  }
})();
// Helper: switch theme without CSS transition animation
window.__applyThemeNoTransition = function () {
  try {
    var raw = localStorage.getItem('kubeli-ui-settings');
    if (!raw) return;
    var s = JSON.parse(raw);
    var theme = s && s.state && s.state.settings && s.state.settings.theme;
    if (!theme) return;
    var resolved = theme;
    if (theme === 'system') resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var r = document.documentElement;
    r.classList.add('no-transitions');
    r.classList.remove('dark', 'light', 'classic-dark');
    r.classList.add(resolved);
    var vib = (s.state && s.state.settings && s.state.settings.vibrancyLevel) || 'standard';
    r.classList.remove('vibrancy-off', 'vibrancy-standard', 'vibrancy-more', 'vibrancy-extra');
    r.classList.add('vibrancy-' + vib);
    // Force style recalc then re-enable transitions
    void getComputedStyle(r).opacity;
    r.classList.remove('no-transitions');
  } catch {
    // ignore: theme switch is best-effort
  }
};

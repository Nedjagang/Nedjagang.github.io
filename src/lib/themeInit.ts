// Inlined into <head> before paint to avoid a flash of incorrect theme.
// Kept dependency-free on purpose: this is 20 lines, not a library's job.
// Default is 'light' (pearl white) for every first-time visitor, regardless
// of OS preference; the header toggle writes an explicit 'dark'/'light' to
// localStorage. 'system' is still honored if it's ever set by hand.
// Re-applies after every view-transition swap, because the incoming page's
// <html> replaces the attributes the previous page had set.
export const themeInitScript = `
(function () {
  function applyTheme() {
    try {
      var theme = localStorage.getItem('theme') || 'light';
      var accent = localStorage.getItem('accent') || 'yellow';
      var resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.setAttribute('data-theme-pref', theme);
      document.documentElement.setAttribute('data-accent', accent);
    } catch (e) {}
  }
  applyTheme();
  document.addEventListener('astro:after-swap', applyTheme);
})();
`;

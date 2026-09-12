// Runs before the first paint; the root layout owns these page-lifetime listeners.
export const THEME_SCRIPT = `(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    let preference = null;
    try { preference = localStorage.getItem('truco-theme'); } catch {}
    document.documentElement.classList.toggle(
      'dark', preference === 'dark' || (preference !== 'light' && media.matches)
    );
  };
  update();
  media.addEventListener('change', update);
  window.addEventListener('storage', (event) => {
    if (event.key === 'truco-theme' || event.key === null) update();
  });
})();`;

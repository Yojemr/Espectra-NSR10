(function () {
  'use strict';
  const STORAGE_KEY = 'espectra.theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // Restricted storage must not prevent calculation or theme switching.
  }

  function apply(theme) {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#101b19' : '#f6f5f0';
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
      document.getElementById('theme-label').textContent = dark ? 'Modo claro' : 'Modo oscuro';
    }
    window.dispatchEvent(new CustomEvent('espectra:theme-change', { detail: { theme } }));
  }

  apply(preference || (media.matches ? 'dark' : 'light'));
  media.addEventListener('change', (event) => {
    if (!preference) apply(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    preference = ['light', 'dark'].includes(event.newValue) ? event.newValue : null;
    apply(preference || (media.matches ? 'dark' : 'light'));
  });
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      const button = document.getElementById('theme-toggle');
      if (!button) return;
      apply(root.dataset.theme);
      button.addEventListener('click', () => {
        preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
        try {
          window.localStorage.setItem(STORAGE_KEY, preference);
        } catch {
          // Keep the user's choice for this page when storage is unavailable.
        }
        apply(preference);
      });
    },
    { once: true },
  );
})();

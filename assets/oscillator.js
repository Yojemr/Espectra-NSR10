(function (root) {
  'use strict';
  const TAU = 2 * Math.PI;
  const VISUAL_AMPLITUDE = 14;
  const MIN_VISUAL_PERIOD = 0.4;

  function create({ mass, leftColumn, rightColumn, button, status }) {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let period = 0;
    let phase = 0;
    let wantsMotion = !preference.matches;
    let enabled = true;
    let frameId = null;
    let previousTime = null;

    function pose(displacement) {
      mass.setAttribute('x', 39 + displacement);
      leftColumn.setAttribute('d', `M48 77 C48 45 ${48 + displacement} 47 ${48 + displacement} 22`);
      rightColumn.setAttribute(
        'd',
        `M125 77 C125 45 ${125 + displacement} 47 ${125 + displacement} 22`,
      );
    }
    function canAnimate() {
      return enabled && period > 0 && wantsMotion && !document.hidden;
    }
    function stopFrame() {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      previousTime = null;
    }
    function renderState() {
      button.disabled = !enabled || period === 0;
      button.textContent = wantsMotion && period > 0 ? 'Pausar animación' : 'Reproducir animación';
      if (!enabled) status.textContent = 'Animación detenida: revisa las entradas.';
      else if (period === 0) status.textContent = 'T = 0: límite rígido, sin oscilación.';
      else if (!wantsMotion) status.textContent = 'Animación en pausa.';
      else if (period < MIN_VISUAL_PERIOD)
        status.textContent = 'Oscilación ralentizada para visualizar T < 0,4 s.';
      else status.textContent = 'Oscilación ilustrativa al período seleccionado.';
    }
    function tick(timestamp) {
      frameId = null;
      if (!canAnimate()) return;
      if (previousTime !== null) {
        const elapsed = (timestamp - previousTime) / 1000;
        // Phase is based on elapsed time, independent of the display refresh rate.
        phase = (phase + (TAU * elapsed) / Math.max(period, MIN_VISUAL_PERIOD)) % TAU;
      }
      previousTime = timestamp;
      pose(VISUAL_AMPLITUDE * Math.sin(phase));
      frameId = window.requestAnimationFrame(tick);
    }
    function reconcile() {
      if (!canAnimate()) stopFrame();
      else if (frameId === null) frameId = window.requestAnimationFrame(tick);
      renderState();
    }
    function setPeriod(value) {
      if (!Number.isFinite(value) || value < 0)
        throw new Error('Período inválido para el esquema.');
      if (value !== period) {
        period = value;
        phase = 0;
        previousTime = null;
        pose(0);
      }
      reconcile();
    }
    function setEnabled(value) {
      enabled = Boolean(value);
      reconcile();
    }
    function toggle() {
      wantsMotion = !wantsMotion;
      reconcile();
    }
    function visibilityChanged() {
      // Restart the clock after a hidden tab; never accumulate background time.
      previousTime = null;
      reconcile();
    }
    function motionPreferenceChanged(event) {
      if (event.matches) wantsMotion = false;
      reconcile();
    }
    button.addEventListener('click', toggle);
    document.addEventListener('visibilitychange', visibilityChanged);
    preference.addEventListener('change', motionPreferenceChanged);
    pose(0);
    renderState();
    return Object.freeze({
      setPeriod,
      setEnabled,
      destroy() {
        stopFrame();
        button.removeEventListener('click', toggle);
        document.removeEventListener('visibilitychange', visibilityChanged);
        preference.removeEventListener('change', motionPreferenceChanged);
      },
    });
  }
  root.EspectraOscillator = Object.freeze({ create });
})(globalThis);

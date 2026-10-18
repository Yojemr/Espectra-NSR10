(function (root) {
  'use strict';
  const layouts = new WeakMap();
  const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 });
  const TITLES = { sa: 'Pseudoaceleración', sv: 'Pseudovelocidad', sd: 'Desplazamiento' };
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    );

  function palette() {
    const style = getComputedStyle(document.documentElement);
    const color = (name) => style.getPropertyValue(name).trim();
    return {
      surface: color('--white'),
      grid: color('--chart-grid'),
      axis: color('--chart-axis'),
      transition: color('--chart-transition'),
      sa: color('--sa'),
      sv: color('--sv'),
      sd: color('--sd'),
    };
  }
  function niceTop(value) {
    const power = 10 ** Math.floor(Math.log10(value || 1));
    return [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((step) => step >= value / power) * power;
  }
  function render(element, { key, points, maxT, parameters, siteName, units, onSelect }) {
    const colors = palette();
    const width = Math.max(260, Math.round(element.clientWidth - 18));
    const height = key === 'sa' && width > 600 ? 242 : 218;
    const margin = { left: 51, right: 18, top: 23, bottom: 39 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const yMax = niceTop(
      points.reduce((max, point) => Math.max(max, point[key] * units.factor), 0) * 1.07,
    );
    const x = (time) => margin.left + (plotWidth * time) / maxT;
    const y = (value) => margin.top + plotHeight * (1 - (value * units.factor) / yMax);
    let grid = '',
      labels = '',
      transitions = '';
    for (let index = 0; index <= 4; index++) {
      const yy = margin.top + (plotHeight * index) / 4;
      grid += `<line x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}" stroke="${colors.grid}" stroke-width=".8"/>`;
      labels += `<text x="${margin.left - 10}" y="${yy + 3}" text-anchor="end">${numberFormat.format(yMax * (1 - index / 4))}</text>`;
    }
    const ticks = maxT <= 1 ? 4 : 6;
    for (let index = 0; index <= ticks; index++) {
      const time = (maxT * index) / ticks,
        xx = x(time);
      grid += `<line x1="${xx}" y1="${margin.top}" x2="${xx}" y2="${height - margin.bottom}" stroke="${colors.grid}" stroke-width=".6"/>`;
      labels += `<text x="${xx}" y="${height - margin.bottom + 18}" text-anchor="middle">${numberFormat.format(time)}</text>`;
    }
    const limits = [
      ['0', parameters.t0],
      ['C', parameters.tc],
      ['L', parameters.tl],
    ].filter(([, time]) => time < maxT);
    let previousLabel = -Infinity;
    for (const [label, time] of limits) {
      transitions += `<line x1="${x(time)}" y1="${margin.top}" x2="${x(time)}" y2="${height - margin.bottom}" stroke="${colors.transition}" stroke-width=".8" stroke-dasharray="3 4"/>`;
      const labelY = x(time) - previousLabel < 22 ? 19 : 9;
      labels += `<text x="${x(time)}" y="${labelY}" text-anchor="middle">T<tspan baseline-shift="sub" font-size="6">${label}</tspan></text>`;
      previousLabel = x(time);
    }
    const chartPoints = [...points];
    // Preserve the one-sided values at rounded normative transitions.
    for (const time of [parameters.tc, parameters.tl]) {
      if (time < maxT)
        chartPoints.push(root.NSR.atPeriod(time + Math.max(1e-9, time * 1e-9), parameters));
    }
    chartPoints.sort((a, b) => a.t - b.t);
    const curve = chartPoints
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'}${x(point.t).toFixed(2)},${y(point[key]).toFixed(2)}`,
      )
      .join(' ');
    const area = `${curve} L${x(maxT)},${height - margin.bottom} L${margin.left},${height - margin.bottom} Z`;
    const description = `${TITLES[key]} de ${siteName}, perfil ${parameters.soil}, grupo ${parameters.group}. Período de 0 a ${maxT} s. Unidad: ${units.label}.`;
    element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(description)}"><title>${escape(description)}</title><rect width="${width}" height="${height}" fill="${colors.surface}"/><defs><linearGradient id="fill-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${colors[key]}" stop-opacity=".14"/><stop offset="100%" stop-color="${colors[key]}" stop-opacity=".015"/></linearGradient></defs><g>${grid}</g><path d="${area}" fill="url(#fill-${key})"/><g>${transitions}</g><path d="${curve}" fill="none" stroke="${colors[key]}" stroke-width="2.2" stroke-linejoin="round"/><g style="font:10px 'Segoe UI',Arial,sans-serif;fill:${colors.axis}">${labels}<text x="${margin.left - 10}" y="10" text-anchor="end">${escape(units.label)}</text><text x="${width - margin.right}" y="${height - 5}" text-anchor="end">Período T (s)</text></g><line class="cursor-line" x1="0" y1="${margin.top}" x2="0" y2="${height - margin.bottom}" stroke="${colors[key]}" stroke-width="1" stroke-dasharray="3 3"/><circle class="cursor-dot" r="4" fill="${colors.surface}" stroke="${colors[key]}" stroke-width="2"/><rect class="chart-hit" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="transparent"/></svg>`;
    layouts.set(element, { x, y, width, height });
    const svg = element.querySelector('svg');
    let dragging = false;
    function pick(event) {
      const box = svg.getBoundingClientRect();
      const position = ((event.clientX - box.left) * width) / box.width;
      onSelect(Math.max(0, Math.min(maxT, ((position - margin.left) / plotWidth) * maxT)));
    }
    svg.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragging = true;
      svg.setPointerCapture(event.pointerId);
      pick(event);
    });
    svg.addEventListener('pointermove', (event) => {
      if (dragging) pick(event);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      svg.addEventListener(name, () => {
        dragging = false;
      });
  }
  function setCursor(element, time, value) {
    const layout = layouts.get(element);
    if (!layout) return;
    const line = element.querySelector('.cursor-line');
    line.setAttribute('x1', layout.x(time));
    line.setAttribute('x2', layout.x(time));
    const dot = element.querySelector('.cursor-dot');
    dot.setAttribute('cx', layout.x(time));
    dot.setAttribute('cy', layout.y(value));
  }
  function exportSvg(element) {
    const layout = layouts.get(element);
    if (!layout) throw new Error('Calcula el espectro antes de descargarlo.');
    const svg = element.querySelector('svg').cloneNode(true);
    svg.querySelector('.chart-hit').remove();
    svg.setAttribute('width', layout.width);
    svg.setAttribute('height', layout.height);
    return new XMLSerializer().serializeToString(svg);
  }
  root.EspectraCharts = Object.freeze({ render, setCursor, exportSvg });
})(globalThis);

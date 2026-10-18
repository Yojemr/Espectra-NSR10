(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const catalog = globalThis.NSR_CATALOG;
  const nsr = globalThis.NSR;
  if (!catalog || !nsr || !globalThis.EspectraCharts || !globalThis.EspectraCases) {
    $('app-error').hidden = false;
    $('app-error').textContent =
      'No se pudieron cargar los recursos de la aplicación. Recarga la página.';
    return;
  }
  const charts = globalThis.EspectraCharts;
  const cases = globalThis.EspectraCases;
  const SOURCE = catalog.url;
  const SPECTRA = ['sa', 'sv', 'sd'];
  const TABLE_PAGE_SIZE = 40;
  const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 });
  const fixed = (n, digits = 3) =>
    n.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const normalize = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const records = catalog.records;
  let mode = 'city',
    current = null,
    points = [],
    maxT = 6,
    selectedT = 1,
    tablePage = 0,
    valid = false;
  let lastInput = null,
    example = true,
    toastTimer;

  function city() {
    return records.find((r) => r.code === $('municipality').value);
  }
  function addOptions(element, options) {
    element.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  }
  function municipalities(preferred) {
    const filtered = records.filter(
      (r) =>
        r.department === $('department').value &&
        normalize(`${r.name} ${r.code}`).includes(normalize($('city-search').value)),
    );
    addOptions(
      $('municipality'),
      filtered.length ? filtered.map((r) => [r.code, r.name]) : [['', 'Sin coincidencias']],
    );
    if (filtered.some((r) => r.code === preferred)) $('municipality').value = preferred;
    $('city-count').textContent = `${filtered.length} resultados`;
    loadMunicipality();
  }
  function loadMunicipality() {
    if (mode !== 'city') return;
    const item = city();
    $('aa').value = item ? item.aa.toFixed(2) : '';
    $('av').value = item ? item.av.toFixed(2) : '';
    $('catalog-reference').textContent = item
      ? `Código ${item.code} · NSR-10, ${item.page}`
      : 'Prueba otro nombre o utiliza ingreso manual.';
  }
  function setMode(next) {
    mode = next;
    $('city-fields').hidden = mode !== 'city';
    $('manual-fields').hidden = mode !== 'manual';
    for (const key of ['city', 'manual']) {
      $(`mode-${key}`).classList.toggle('active', key === mode);
      $(`mode-${key}`).setAttribute('aria-pressed', String(key === mode));
    }
    $('aa').readOnly = mode === 'city';
    $('av').readOnly = mode === 'city';
    if (mode === 'city') loadMunicipality();
  }
  function inputs() {
    if (mode === 'city' && !city())
      throw new Error('Selecciona un municipio o utiliza ingreso manual.');
    if (mode === 'manual' && (!$('manual-name').value.trim() || !$('manual-source').value.trim()))
      throw new Error('En ingreso manual, escribe el nombre del sitio y la fuente de Aa y Av.');
    if ($('particular').checked)
      throw new Error(
        'El sitio requiere el espectro de la microzonificación o del estudio particular aplicable (A.2.1.2). Las curvas generales de A.2.6 no sustituyen ese espectro.',
      );
    return {
      aa: Number($('aa').value),
      av: Number($('av').value),
      soil: $('soil').value,
      group: $('group').value,
      higher: $('higher-modes').checked,
    };
  }
  function markInvalid(message) {
    valid = false;
    $('error-box').textContent = message;
    $('error-box').hidden = false;
    $('result-content').hidden = true;
    document.querySelector('.results').classList.add('invalid');
    for (const id of [
      'fa-value',
      'fv-value',
      'importance-value',
      't0-value',
      'tc-value',
      'tl-value',
    ])
      $(id).textContent = '—';
    $('case-tag').textContent = 'REVISAR ENTRADAS';
    $('save-case').disabled = true;
    $('export-csv').disabled = true;
    $('site-summary').textContent = 'Resultados no calculados';
  }
  function update() {
    try {
      lastInput = inputs();
      const p = nsr.parameters(lastInput);
      const newMax = Number($('max-period').value);
      const step = Number($('sample-step').value);
      const newPoints = nsr.sample(p, newMax, step);
      current = p;
      maxT = newMax;
      points = newPoints;
      selectedT = Math.max(0, Math.min(maxT, selectedT));
      tablePage = 0;
      $('save-case').disabled = false;
      $('export-csv').disabled = false;
      valid = true;
      $('error-box').hidden = true;
      $('result-content').hidden = false;
      document.querySelector('.results').classList.remove('invalid');
      $('case-tag').textContent = example ? 'EJEMPLO EDITABLE' : 'CASO PERSONALIZADO';
      const item = city();
      $('site-name').textContent =
        mode === 'city' ? `${item.name}, ${item.department}` : $('manual-name').value.trim();
      const hazard = nsr.hazard(p.aa, p.av);
      $('hazard-badge').textContent = `Amenaza ${hazard.toLowerCase()}`;
      $('hazard-badge').dataset.level = hazard;
      $('site-summary').textContent = `Perfil ${p.soil} · Grupo ${p.group} · ξ = 5 %`;
      $('source-summary').textContent =
        mode === 'city' ? `Apéndice A-4 · ${item.page}` : 'Parámetros manuales';
      $('source-summary').title = mode === 'city' ? SOURCE : $('manual-source').value.trim();
      $('fa-value').textContent = fixed(p.fa, 2);
      $('fv-value').textContent = fixed(p.fv, 2);
      $('importance-value').textContent = fixed(p.importance, 2);
      for (const [id, value] of [
        ['t0', p.t0],
        ['tc', p.tc],
        ['tl', p.tl],
      ])
        $(`${id}-value`).innerHTML = `${fixed(value)} <small>s</small>`;
      $('selected-period').max = String(maxT);
      $('period-slider').max = String(maxT);
      renderCharts();
      selectPeriod(selectedT);
      renderTable();
    } catch (error) {
      markInvalid(error.message);
    }
  }
  function unitInfo(key) {
    if (key === 'sa')
      return $('accel-unit').value === 'g'
        ? { factor: 1, label: 'g' }
        : { factor: nsr.G, label: 'm/s²' };
    if (key === 'sv') return { factor: 1, label: 'm/s' };
    return {
      factor: { m: 1, cm: 100, mm: 1000 }[$('displ-unit').value],
      label: $('displ-unit').value,
    };
  }
  function renderCharts() {
    if (!valid) return;
    for (const key of SPECTRA)
      charts.render($(`chart-${key}`), {
        key,
        points,
        maxT,
        parameters: current,
        siteName: $('site-name').textContent,
        units: unitInfo(key),
        onSelect: selectPeriod,
      });
  }
  function selectPeriod(t, fromInput = false) {
    if (!valid) return;
    if (!Number.isFinite(t) || t < 0 || t > maxT) {
      $('selected-period').setCustomValidity(`Ingresa un período entre 0 y ${maxT} s.`);
      $('selected-period').reportValidity();
      return;
    }
    $('selected-period').setCustomValidity('');
    selectedT = t;
    if (!fromInput) $('selected-period').value = Number(t.toFixed(5));
    $('period-slider').value = t;
    const p = nsr.atPeriod(t, current);
    $('branch-name').textContent = p.branch;
    ['sa', 'sv', 'sd'].forEach((key, i) => {
      const unit = unitInfo(key);
      $(`${key}-readout`).innerHTML =
        `${fixed(p[key] * unit.factor, 4)} <small>${unit.label}</small>`;
      $(`${key}-equation`).textContent = p.equations[i];
      charts.setCursor($(`chart-${key}`), t, p[key]);
    });
    renderSubstitution(p);
    $('model-period').textContent = `T = ${fixed(t)} s`;
    const shift = t === 0 ? 0 : 14;
    $('model-mass').setAttribute('x', 39 + shift);
    $('model-column-left').setAttribute('d', `M48 77 C48 45 ${48 + shift} 47 ${48 + shift} 22`);
    $('model-column-right').setAttribute(
      'd',
      `M125 77 C125 45 ${125 + shift} 47 ${125 + shift} 22`,
    );
  }
  function renderSubstitution(point) {
    const p = current,
      t = point.t;
    const aa = nf.format(p.aa),
      av = nf.format(p.av),
      fa = nf.format(p.fa),
      fv = nf.format(p.fv),
      imp = nf.format(p.importance),
      tt = nf.format(t),
      tl = nf.format(p.tl);
    let formulas;
    if (t <= p.tc) {
      const q = p.higher && t < p.t0 ? ` × (0,4 + 0,6 × ${tt} / ${nf.format(p.t0)})` : '';
      formulas = [
        `2,5 × ${aa} × ${fa} × ${imp}${q}`,
        `3,9 × ${aa} × ${fa} × ${imp} × ${tt}${q}`,
        `0,62 × ${aa} × ${fa} × ${imp} × ${tt}²${q}`,
      ];
    } else if (t <= p.tl)
      formulas = [
        `1,2 × ${av} × ${fv} × ${imp} / ${tt}`,
        `1,87 × ${av} × ${fv} × ${imp}`,
        `0,30 × ${av} × ${fv} × ${imp} × ${tt}`,
      ];
    else
      formulas = [
        `1,2 × ${av} × ${fv} × ${tl} × ${imp} / ${tt}²`,
        `1,87 × ${av} × ${fv} × ${imp} × ${tl} / ${tt}`,
        `0,30 × ${av} × ${fv} × ${imp} × ${tl}`,
      ];
    $('substitution').innerHTML =
      ['sa', 'sv', 'sd']
        .map(
          (key, i) =>
            `<p><strong>S<sub>${['a', 'v', 'd'][i]}</sub></strong> = ${formulas[i]} = <strong>${fixed(point[key], 6)} ${['g', 'm/s', 'm'][i]}</strong> <small>(${point.equations[i]})</small></p>`,
        )
        .join('') +
      '<small>La sustitución se expresa en las unidades originales del reglamento. Se muestra redondeada; los cálculos conservan la precisión numérica.</small>';
  }
  function renderTable() {
    if (!valid) return;
    const size = TABLE_PAGE_SIZE,
      pages = Math.ceil(points.length / size);
    tablePage = Math.max(0, Math.min(pages - 1, tablePage));
    $('spectrum-table').innerHTML = points
      .slice(tablePage * size, (tablePage + 1) * size)
      .map(
        (p) =>
          `<tr><td>${fixed(p.t, 5)}</td><td>${fixed(p.sa, 6)}</td><td>${fixed(p.sv, 6)}</td><td>${fixed(p.sd, 6)}</td><td>${p.branch}</td></tr>`,
      )
      .join('');
    $('sample-count').textContent = `${points.length} períodos`;
    $('table-page').textContent = `${tablePage + 1} / ${pages}`;
    $('table-prev').disabled = tablePage === 0;
    $('table-next').disabled = tablePage === pages - 1;
  }
  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => ($('toast').hidden = true), 4500);
  }
  function exportCsv() {
    if (!valid) return;
    const source =
      mode === 'city'
        ? `${catalog.source}, ${city().page}; ${SOURCE}`
        : $('manual-source').value.trim();
    const header = [
      'T_s',
      'Sa_g',
      'Sv_m_s',
      'Sd_m',
      'Aa',
      'Av',
      'Fa',
      'Fv',
      'I',
      'perfil',
      'grupo',
      'modos_superiores',
      'sitio',
      'fuente',
    ];
    const lines = points.map((p) =>
      [
        p.t,
        p.sa,
        p.sv,
        p.sd,
        current.aa,
        current.av,
        current.fa,
        current.fv,
        current.importance,
        current.soil,
        current.group,
        current.higher,
        $('site-name').textContent,
        source,
      ]
        .map(cases.csvCell)
        .join(';'),
    );
    download(
      '\uFEFF' + header.join(';') + '\r\n' + lines.join('\r\n'),
      'espectros-nsr10.csv',
      'text/csv;charset=utf-8',
    );
    toast('Datos exportados en g, m/s y m. Separador: punto y coma.');
  }
  function caseObject() {
    return {
      schema: cases.SCHEMA,
      version: cases.SCHEMA_VERSION,
      appVersion: '0.2.0',
      mode,
      municipality: mode === 'city' ? city().code : null,
      name: mode === 'manual' ? $('manual-name').value.trim() : '',
      source: mode === 'manual' ? $('manual-source').value.trim() : '',
      input: lastInput,
      maxPeriod: maxT,
      step: Number($('sample-step').value),
      selectedPeriod: selectedT,
      accelUnit: $('accel-unit').value,
      displUnit: $('displ-unit').value,
      catalogSha256: catalog.sourceSha256,
    };
  }
  function saveCase() {
    if (!valid) return;
    download(
      JSON.stringify(caseObject(), null, 2) + '\n',
      'caso-espectra.json',
      'application/json;charset=utf-8',
    );
    toast('Caso guardado. Puedes abrirlo después desde esta aplicación.');
  }
  function loadCase(data) {
    data = cases.validate(data, nsr, catalog);
    const item = records.find((row) => row.code === data.municipality);
    if (item && data.mode === 'city') {
      $('department').value = item.department;
      $('city-search').value = '';
      municipalities(item.code);
    }
    setMode(data.mode);
    $('manual-name').value = data.name || '';
    $('manual-source').value = data.source || '';
    $('aa').value = data.input.aa;
    $('av').value = data.input.av;
    $('soil').value = data.input.soil;
    $('group').value = data.input.group;
    $('higher-modes').checked = data.input.higher;
    $('particular').checked = false;
    $('max-period').value = data.maxPeriod;
    $('sample-step').value = String(data.step);
    $('accel-unit').value = data.accelUnit;
    $('displ-unit').value = data.displUnit;
    selectedT = data.selectedPeriod;
    example = false;
    update();
    toast('Caso abierto. Los resultados se recalcularon con sus entradas.');
  }
  function reset() {
    HTMLFormElement.prototype.reset.call($('parameters-form'));
    $('city-search').value = '';
    $('manual-name').value = '';
    $('manual-source').value = '';
    setMode('city');
    $('department').value = 'Antioquia';
    municipalities('05001');
    $('accel-unit').value = 'g';
    $('displ-unit').value = 'm';
    selectedT = 1;
    example = true;
    update();
  }

  addOptions(
    $('department'),
    [...new Set(records.map((r) => r.department))]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((d) => [d, d]),
  );
  $('catalog-total').textContent = `${catalog.count.toLocaleString('es-CO')} localidades · NSR-10`;
  $('catalog-method').textContent =
    `${catalog.count.toLocaleString('es-CO')} localidades de 32 departamentos y Bogotá, D. C. Fuente: Apéndice A-4, páginas A-153 a A-174 del Título A publicado por el IDRD. Bogotá aparece dos veces con los mismos parámetros y se conserva una sola entrada.`;
  $('department').addEventListener('change', () => {
    example = false;
    $('city-search').value = '';
    municipalities();
    update();
  });
  $('city-search').addEventListener('input', () => {
    example = false;
    const before = $('municipality').value;
    municipalities(before);
    update();
  });
  $('municipality').addEventListener('change', () => {
    example = false;
    loadMunicipality();
    update();
  });
  for (const next of ['city', 'manual'])
    $(`mode-${next}`).addEventListener('click', () => {
      example = false;
      setMode(next);
      update();
    });
  $('parameters-form').addEventListener('submit', (event) => {
    event.preventDefault();
    example = false;
    update();
    if (valid) toast('Espectros actualizados.');
  });
  for (const id of [
    'aa',
    'av',
    'soil',
    'group',
    'particular',
    'max-period',
    'sample-step',
    'higher-modes',
    'manual-name',
    'manual-source',
  ])
    $(id).addEventListener('change', () => {
      example = false;
      update();
    });
  for (const id of ['accel-unit', 'displ-unit'])
    $(id).addEventListener('change', () => {
      renderCharts();
      selectPeriod(selectedT);
    });
  $('selected-period').addEventListener('input', () => {
    if ($('selected-period').value !== '') selectPeriod(Number($('selected-period').value), true);
  });
  $('selected-period').addEventListener('change', () => {
    if ($('selected-period').value === '') $('selected-period').value = selectedT;
  });
  $('period-slider').addEventListener('input', () =>
    selectPeriod(Number($('period-slider').value)),
  );
  $('table-prev').addEventListener('click', () => {
    tablePage--;
    renderTable();
  });
  $('table-next').addEventListener('click', () => {
    tablePage++;
    renderTable();
  });
  $('export-csv').addEventListener('click', exportCsv);
  $('save-case').addEventListener('click', saveCase);
  $('load-case').addEventListener('click', () => $('case-file').click());
  $('case-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > cases.MAX_FILE_BYTES) throw new Error('El archivo de caso supera 50 kB.');
      loadCase(JSON.parse(await file.text()));
    } catch (error) {
      toast(error.message);
    }
    event.target.value = '';
  });
  for (const button of document.querySelectorAll('[data-download]'))
    button.addEventListener('click', () => {
      if (!valid) return;
      const key = button.dataset.download;
      download(
        charts.exportSvg($(`chart-${key}`)),
        `espectro-${key}-nsr10.svg`,
        'image/svg+xml;charset=utf-8',
      );
      toast('Gráfica vectorial guardada.');
    });
  $('reset').addEventListener('click', reset);
  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderCharts();
      if (valid) selectPeriod(selectedT);
    }, 80);
  }).observe(document.querySelector('.results'));
  window.addEventListener('espectra:theme-change', () => {
    renderCharts();
    if (valid) selectPeriod(selectedT);
  });
  reset();
})();

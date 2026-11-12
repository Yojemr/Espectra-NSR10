(function () {
  'use strict';
  const $ = (id) => document.getElementById(id),
    P = globalThis.EspectraProject,
    V = globalThis.EspectraView,
    fmt = V.fmt;
  let project = P.santaMarta(),
    result = null,
    worker = null,
    request = 0,
    plan = false,
    page = 0;
  const controls = new Map();
  let viewerModule = null,
    buildingViewer = null,
    columnViewer = null,
    lastBuilding = '',
    lastColumn = '';
  function loadViewer() {
    if (!viewerModule) viewerModule = import('./structure-3d.js');
    return viewerModule;
  }
  async function building3D() {
    if (plan) {
      $('building-webgl').hidden = true;
      $('building-3d-tools').hidden = true;
      $('building-model').removeAttribute('hidden');
      $('building-3d-status').hidden = true;
      return;
    }
    try {
      const module = await loadViewer();
      if (plan) return;
      $('building-3d-status').hidden = false;
      $('building-webgl').hidden = false;
      if (!buildingViewer)
        buildingViewer = module.create($('building-webgl'), {
          kind: 'building',
          onStatus: (text) => ($('building-3d-status').textContent = text),
          onSelect: ({ column, floor }) => {
            $('column-select').value = column;
            $('floor-select').value = floor;
            calculate();
          },
        });
      const key = JSON.stringify([
        project.x,
        project.y,
        project.omitted,
        project.floors,
        project.storyHeight,
        project.section,
        project.beamB,
        project.beamH,
        project.slabEquivalent,
        project.selectedColumn,
        project.selectedFloor,
      ]);
      if (key !== lastBuilding) {
        buildingViewer.update(project, P.geometry(project));
        lastBuilding = key;
      }
      buildingViewer.configure({ slabs: $('building-slabs').checked });
      buildingViewer.render();
      $('building-model').setAttribute('hidden', '');
      $('building-3d-tools').hidden = false;
    } catch {
      $('building-webgl').hidden = true;
      $('building-model').removeAttribute('hidden');
      $('building-3d-status').hidden = false;
      $('building-3d-status').textContent =
        'El visor interactivo necesita WebGL 2. La vista SVG y el cálculo siguen disponibles.';
    }
  }
  async function column3D() {
    try {
      const module = await loadViewer();
      if (!columnViewer)
        columnViewer = module.create($('column-webgl'), {
          kind: 'column',
          onStatus: (text) => ($('column-3d-status').textContent = text),
        });
      if (!result) return;
      const regime = $('detail-regime').value,
        p = result.project,
        key = JSON.stringify([p.section, p.storyHeight, p.beamH, regime]);
      if (key !== lastColumn) {
        columnViewer.update(p, null, result.regimes[regime].detail, result.steel);
        lastColumn = key;
      }
      columnViewer.configure({
        concrete: $('column-concrete').value,
        bars: $('column-bars').checked,
        ties: $('column-ties').checked,
      });
    } catch {
      $('column-webgl').hidden = true;
      for (const e of document.querySelectorAll(
        '.column-3d-panel button,.column-3d-panel input,.column-3d-panel select',
      ))
        e.disabled = true;
      $('column-3d-status').textContent =
        'El visor interactivo necesita WebGL 2. Los esquemas SVG y las comprobaciones siguen disponibles.';
    }
  }
  const groups = [
    [
      'Proyecto y sitio',
      'Aa y Av: catálogo NSR-10. Perfil de suelo y grupo de uso: entradas del proyecto.',
      [
        ['name', 'Nombre del proyecto', 'text'],
        ['site.code', 'Municipio', 'city'],
        ['site.soil', 'Perfil de suelo', ['A', 'B', 'C', 'D', 'E']],
        ['site.group', 'Grupo de uso', ['I', 'II', 'III', 'IV']],
      ],
    ],
    [
      'Planta y elevación',
      'Coordenadas en metros, separadas por punto y coma, desde 0. Paneles omitidos: vano X:fila Y, contando desde 1; por ejemplo, 1:3. Se aplica una sección uniforme a todas las columnas.',
      [
        ['floors', 'Número de pisos'],
        ['storyHeight', 'Altura de piso (m)'],
        ['x', 'Ejes X (m)', 'coords'],
        ['y', 'Ejes Y (m)', 'coords'],
        ['omitted', 'Paneles omitidos', 'panels'],
      ],
    ],
    [
      'Cargas y vigas',
      'D superficial incluye losa y acabados. Vigas y columnas aportan peso propio adicional; el espesor equivalente evita duplicar concreto de losa en las vigas.',
      [
        ['dead', 'D superficial (kN/m²)'],
        ['live', 'L superficial (kN/m²)'],
        ['seismicLive', 'Fracción de L en W'],
        ['slabEquivalent', 'Losa equivalente (m)'],
        ['beamB', 'Ancho de viga (m)'],
        ['beamH', 'Altura de viga (m)'],
      ],
    ],
    [
      'Materiales y rigidez',
      'Concreto de peso normal y rigideces efectivas editables. La torsión de las barras utiliza el factor de su sección.',
      [
        ['fc', 'f′c (MPa)'],
        ['fy', 'fy longitudinal (MPa)'],
        ['fyt', 'fyt estribos (MPa)'],
        ['es', 'Es (MPa)'],
        ['gamma', 'Peso concreto (kN/m³)'],
        ['poisson', 'Poisson ν'],
        ['columnFactor', 'I efectiva / Ig columna'],
        ['beamFactor', 'I efectiva / Ig viga'],
      ],
    ],
    [
      'Sección y barras',
      'Dimensiones en mm. nx y ny cuentan barras por cara, incluidas las esquinas. Un cerco exterior y ganchos suplementarios: ramas X ≤ ny y ramas Y ≤ nx. Las barras de esquina se ajustan al radio de doblado.',
      [
        ['section.b', 'b, dirección X (mm)'],
        ['section.h', 'h, dirección Y (mm)'],
        ['section.cover', 'Recubrimiento al estribo (mm)'],
        ['section.bar', 'Barra longitudinal', 'bar'],
        ['section.nx', 'Barras por cara X'],
        ['section.ny', 'Barras por cara Y'],
        ['section.tie', 'Barra de estribo', 'tie'],
        ['section.legsX', 'Ramas paralelas X'],
        ['section.legsY', 'Ramas paralelas Y'],
        ['section.sEnd', 's extremos (mm)'],
        ['section.sMid', 's central (mm)'],
      ],
    ],
    [
      'Disipación e irregularidades',
      'Pórticos de concreto resistentes a momento: R0 DMO = 5, R0 DES = 7 y Ω0 = 3. R = φa φp φr R0. Los coeficientes de irregularidad y redundancia son entradas; no se certifican automáticamente.',
      [
        ['phiA', 'φa, irregularidad en altura'],
        ['phiP', 'φp, irregularidad en planta'],
        ['phiR', 'φr, redundancia'],
      ],
    ],
    [
      'Confirmaciones del proyecto',
      'Registro de las hipótesis adoptadas. El cálculo mantiene los apoyos y diafragmas indicados; las casillas no sustituyen verificaciones técnicas.',
      [
        ['assumptions.fixedBase', 'Bases empotradas justificadas', 'checkbox'],
        ['assumptions.rigidDiaphragm', 'Diafragma rígido justificado', 'checkbox'],
        ['assumptions.tributary45', 'Transferencia a 45° aplicable', 'checkbox'],
        ['assumptions.siteConfirmed', 'Suelo y grupo de uso confirmados', 'checkbox'],
      ],
    ],
  ];
  const get = (p, path) => path.split('.').reduce((v, k) => v[k], p);
  function set(p, path, value) {
    const keys = path.split('.'),
      key = keys.pop();
    keys.reduce((v, k) => v[k], p)[key] = value;
  }
  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function field(path, label, type = 'number', parent) {
    const wrap = el('label'),
      id = 'input-' + path.replaceAll('.', '-');
    wrap.htmlFor = id;
    const input = el(
      Array.isArray(type) || ['city', 'bar', 'tie'].includes(type) ? 'select' : 'input',
    );
    input.id = id;
    if (input.tagName === 'SELECT') {
      const entries =
        type === 'city'
          ? NSR_CATALOG.records.map((v) => [v.code, `${v.name} · ${v.department}`])
          : type === 'bar' || type === 'tie'
            ? Object.keys(P.BARS)
                .filter((v) => type === 'bar' || +v <= 8)
                .map((v) => [v, `No. ${v} · ${P.BARS[v][0]} mm`])
            : type.map((v) => [v, v]);
      for (const [value, name] of entries) {
        const o = el('option', name);
        o.value = value;
        input.append(o);
      }
    } else {
      input.type = ['text', 'checkbox'].includes(type)
        ? type
        : type === 'number'
          ? 'number'
          : 'text';
      if (input.type === 'number') {
        input.step = 'any';
        input.inputMode = 'decimal';
      }
      if (input.type === 'text') input.maxLength = path === 'joints.source' ? 200 : 100;
    }
    if (type === 'checkbox') {
      wrap.className = 'checkbox-field wide-field';
      wrap.append(input, el('span', label));
    } else {
      wrap.append(el('span', label), input);
      if (['text', 'city', 'coords', 'panels'].includes(type)) wrap.className = 'wide-field';
    }
    input.dataset.kind = Array.isArray(type)
      ? 'text'
      : type === 'checkbox'
        ? 'checkbox'
        : type === 'text'
          ? 'text'
          : type === 'city'
            ? 'city'
            : type === 'coords'
              ? 'coords'
              : type === 'panels'
                ? 'panels'
                : 'number';
    controls.set(path, input);
    parent.append(wrap);
    return input;
  }
  for (const [i, [title, help, fields]] of groups.entries()) {
    const details = el('details');
    details.open = i < 2;
    details.append(el('summary', title), el('p', help, 'building-help'));
    if (title === 'Materiales y rigidez')
      details.append(el('p', 'Ec = 4700√f′c (MPa)', 'result-formula'));
    if (title === 'Disipación e irregularidades')
      details.append(el('p', 'R = φa · φp · φr · R₀', 'result-formula'));
    const grid = el('div', undefined, 'building-field-grid');
    for (const args of fields) field(...[args[0], args[1], args[2] || 'number', grid]);
    details.append(grid);
    $('building-form').append(details);
  }
  // Joint values share the same validated project schema as the main form.
  for (const axis of ['x', 'y']) {
    const fs = el('fieldset');
    fs.append(el('legend', `Dirección ${axis.toUpperCase()} · Mnb (kN·m)`));
    const grid = el('div', undefined, 'building-field-grid');
    for (const [key, name] of [
      ['leftPositive', 'Izquierda +'],
      ['leftNegative', 'Izquierda −'],
      ['rightPositive', 'Derecha +'],
      ['rightNegative', 'Derecha −'],
    ])
      field(`joints.${axis}.${key}`, name, 'number', grid);
    fs.append(grid);
    $('joint-inputs').append(fs);
  }
  field('joints.source', 'Fuente de las capacidades nominales de viga', 'text', $('joint-inputs'));
  function put(p) {
    for (const [path, input] of controls) {
      const value = get(p, path),
        kind = input.dataset.kind;
      if (kind === 'checkbox') input.checked = value;
      else
        input.value =
          kind === 'coords'
            ? value.join('; ')
            : kind === 'panels'
              ? value.map((v) => `${v[0] + 1}:${v[1] + 1}`).join('; ')
              : value === null
                ? ''
                : value;
    }
    project = structuredClone(p);
    selectors(p);
    drawModel();
  }
  function read() {
    const p = structuredClone(project);
    for (const [path, input] of controls) {
      const text = input.value.trim(),
        kind = input.dataset.kind;
      let value;
      if (kind === 'checkbox') value = input.checked;
      else if (['text', 'city'].includes(kind)) value = text;
      else if (kind === 'coords') value = text.split(';').map((v) => (v.trim() ? Number(v) : NaN));
      else if (kind === 'panels')
        value = text
          ? text.split(';').map((v) => {
              const parts = v.trim().split(':');
              if (parts.length !== 2 || parts.some((a) => !a.trim()))
                throw new Error('Paneles omitidos: usa pares como 1:3 separados por punto y coma.');
              return parts.map((a) => Number(a) - 1);
            })
          : [];
      else value = !text ? (path.startsWith('joints.') ? null : NaN) : Number(text);
      set(p, path, value);
    }
    const city = NSR_CATALOG.records.find((v) => v.code === p.site.code);
    if (!city) throw new Error('Selecciona un municipio del catálogo.');
    p.site.aa = city.aa;
    p.site.av = city.av;
    p.selectedColumn = Number($('column-select').value);
    p.selectedFloor = Number($('floor-select').value);
    const valid = P.validate(p),
      g = P.geometry(valid);
    if (!g.nodes.some((v) => v.id === valid.selectedColumn))
      throw new Error(
        'La columna elegida ya no existe. Selecciona otra columna antes de calcular.',
      );
    return valid;
  }
  function selectors(p) {
    const g = P.geometry(p);
    $('column-select').replaceChildren(
      ...g.nodes.map((n) => {
        const o = el('option', `${n.label} · columna ${n.id}`);
        o.value = n.id;
        return o;
      }),
    );
    $('floor-select').replaceChildren(
      ...Array.from({ length: p.floors }, (_, i) => {
        const o = el('option', `Piso ${i + 1}`);
        o.value = i + 1;
        return o;
      }),
    );
    $('column-select').value = p.selectedColumn;
    $('floor-select').value = p.selectedFloor;
  }
  function status(text, stale = false) {
    $('building-status').textContent = text;
    $('building-status').dataset.stale = String(stale);
  }
  function dirty() {
    request++;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    $('calculate').disabled = false;
    $('calculated-results').classList.add('stale-results');
    $('export-cases').disabled = true;
    status(
      'Hay cambios sin calcular. El modelo y los resultados corresponden al último cálculo; pulsa Calcular edificio para actualizarlos.',
      true,
    );
  }
  function drawModel() {
    const g = P.geometry(project);
    V.model($('building-model'), project, g, plan);
    building3D();
    const city = NSR_CATALOG.records.find((v) => v.code === project.site.code);
    $('model-caption').textContent =
      `${city.name} · Aa ${project.site.aa} · Av ${project.site.av} · ${g.nodes.length} columnas/piso · ${g.beams.length} vigas/piso · ${fmt(g.area, 2)} m²/piso`;
    $('site-spectrum').href =
      `index.html?site=${project.site.code}&soil=${project.site.soil}&group=${project.site.group}`;
  }
  function error(e) {
    $('building-error').hidden = false;
    $('building-error').textContent = e.message || String(e);
    status('No se pudo completar el cálculo. Revisa los datos.', true);
    $('calculate').disabled = false;
  }
  function calculate() {
    $('building-error').hidden = true;
    let p;
    try {
      // Keep a valid selection when the edited geometry removes a former column or story.
      const floor = $('floor-select').value,
        column = $('column-select').value;
      if (Number(controls.get('floors').value) < Number(floor)) $('floor-select').value = '1';
      try {
        p = read();
      } catch (e) {
        $('floor-select').value = floor;
        $('column-select').value = column;
        throw e;
      }
      project = p;
      selectors(p);
      drawModel();
    } catch (e) {
      error(e);
      return;
    }
    const id = ++request;
    if (worker) worker.terminate();
    $('calculate').disabled = true;
    $('export-cases').disabled = true;
    $('calculated-results').hidden = true;
    status('Calculando el pórtico, las combinaciones y la superficie biaxial…');
    try {
      worker = new Worker('assets/structure-worker.js?v=0.5.0');
      worker.onmessage = (event) => {
        if (event.data.id !== request) return;
        worker.terminate();
        worker = null;
        $('calculate').disabled = false;
        if (event.data.error) {
          error(new Error(event.data.error));
          return;
        }
        result = event.data.result;
        page = 0;
        render();
        status(
          `Cálculo actualizado · ${result.regimes.DMO.cases.length * 2} filas DMO/DES · equilibrio gravitacional verificado.`,
        );
      };
      worker.onerror = () => {
        if (id !== request) return;
        worker.terminate();
        worker = null;
        error(
          new Error(
            'No se pudo iniciar el cálculo local. Abre la página desde GitHub Pages o un servidor HTTP local; los navegadores pueden bloquear Workers al abrir archivos directamente.',
          ),
        );
      };
      worker.postMessage({ id, project: p });
    } catch (e) {
      error(e);
    }
  }
  function badge(text, kind) {
    return el('span', text, `check-badge ${kind || ''}`);
  }
  function facts() {
    const maxDrift =
        Math.max(
          ...Object.values(result.storeys)
            .flat()
            .map((v) => v.drift),
        ) * 100,
      maxQ = Math.max(
        ...Object.values(result.storeys)
          .flat()
          .map((v) => v.q),
      );
    const data = [
      [
        'Peso sísmico W',
        fmt(result.weight, 1) + ' kN',
        'No incluye la mitad inferior de columnas de base',
      ],
      [
        'Área por nivel',
        fmt(result.geometry.area, 2) + ' m²',
        `${project.floors} niveles · H ${fmt(project.floors * project.storyHeight, 1)} m`,
      ],
      [
        'Deriva elástica máxima',
        fmt(maxDrift, 2) + ' %',
        'Demanda de primer orden; no se reduce con R',
      ],
      [
        'Q máximo',
        fmt(maxQ, 3),
        maxQ > 0.1 ? 'Requiere evaluación de segundo orden' : 'Diagnóstico de estabilidad global',
      ],
      [
        'T adoptado X / Y',
        fmt(result.used.x, 3) + ' / ' + fmt(result.used.y, 3) + ' s',
        'Estimación Rayleigh limitada por Cu·Ta',
      ],
      ['Ax estimado máximo', fmt(result.maxAx, 2), 'El análisis mostrado usa Ax = 1'],
    ];
    $('building-facts').replaceChildren(
      ...data.map(([label, value, help]) => {
        const d = el('div', undefined, 'building-fact');
        d.append(el('span', label), el('strong', value), el('span', help));
        return d;
      }),
    );
  }
  function cards() {
    $('regime-cards').replaceChildren(
      ...['DMO', 'DES'].map((name) => {
        const r = result.regimes[name],
          c = r.governing,
          d = c.d,
          card = el('article', undefined, 'regime-card');
        card.append(el('h3', name), badge(`R = ${fmt(r.r, 3)}`));
        const dl = el('dl');
        for (const [key, value] of [
          ['Pu', fmt(d[0]) + ' kN'],
          ['Mx', fmt(d[1]) + ' kN·m'],
          ['My', fmt(d[2]) + ' kN·m'],
          ['Pu / φPn máx.', fmt(c.axial, 3)],
          ['Demanda biaxial / cap.', fmt(c.ratio, 3)],
          ['Ve X / Y', r.ve.map((v) => (v === null ? 'Pendiente' : fmt(v))).join(' / ') + ' kN'],
          ['φVs X / Y', r.shearResistance.map((v) => fmt(v)).join(' / ') + ' kN'],
        ])
          dl.append(el('dt', key), el('dd', value));
        card.append(
          dl,
          badge(
            c.ratio <= 1 && c.axial <= 1
              ? 'Sección: comprobación satisfecha'
              : 'Sección: insuficiente',
            '' + (c.ratio <= 1 && c.axial <= 1 ? '' : 'fail'),
          ),
        );
        card.append(
          el(
            'p',
            `${c.family} · ${c.patternName} · extremo ${c.end.toLowerCase()} · ${c.id}`,
            'building-caption',
          ),
        );
        card.append(
          el(
            'p',
            r.ve.some((v) => v === null)
              ? 'Cortante por capacidad pendiente: existen axiales fuera del intervalo resistente.'
              : r.ve.every((v, i) => v <= r.shearResistance[i])
                ? 'Cortante: resistencia conservadora satisfecha.'
                : 'Cortante: resistencia insuficiente.',
            'building-caption',
          ),
        );
        return card;
      }),
    );
  }
  function checkDescription({ label, value }) {
    if (label.startsWith('Cuantía')) return 'ρ = ' + fmt(value * 100, 2) + ' %';
    if (label.includes('Separación en') || label === 'Separación central')
      return 's máx. = ' + fmt(value, 1) + ' mm';
    if (label === 'Proporción de la sección') return 'Relación mínima = ' + fmt(value, 2);
    if (label === 'Diámetro mínimo de estribo') return 'Diámetro mín. = ' + fmt(value, 1) + ' mm';
    return 'Valor = ' + fmt(value, 2) + ' mm';
  }
  function accidental(c, axis) {
    if (!c.sx && !c.sy) return 0;
    return c[axis] ? 0.05 : -0.05;
  }
  function detail() {
    const name = $('detail-regime').value,
      r = result.regimes[name];
    V.section($('column-section'), project, result.steel);
    V.elevation($('column-elevation'), project, r.detail);
    column3D();
    $('section-caption').textContent =
      `As = ${fmt(r.detail.As, 0)} mm² · ρ = ${fmt(r.detail.rho * 100, 2)} % · sección común a todas las columnas.`;
    $('ties-caption').textContent =
      `${name} · lo ≥ ${fmt(r.detail.lo, 0)} mm · ${r.detail.ties.length} niveles de estribos en el tramo libre. Ramas de amarre adicionales según sección.`;
    const body = $('detail-checks').tBodies[0];
    body.replaceChildren();
    const a = result.regimes.DMO.detail.checks,
      b = result.regimes.DES.detail.checks;
    for (const label of new Set([...a, ...b].map((v) => v.label))) {
      const checks = [a.find((v) => v.label === label), b.find((v) => v.label === label)],
        tr = el('tr');
      tr.append(el('td', label));
      for (const c of checks) {
        const td = el('td');
        if (c) {
          td.append(badge(c.pass ? 'Satisface' : 'No satisface', c.pass ? '' : 'fail'));
          td.append(el('small', checkDescription(c)));
        } else td.textContent = 'No aplica';
        tr.append(td);
      }
      tr.append(
        el(
          'td',
          checks
            .filter(Boolean)
            .map((v) => v.ref)
            .join(' / '),
        ),
      );
      body.append(tr);
    }
  }
  function interaction() {
    const name = $('interaction-regime').value,
      available = V.interaction($('interaction-pm'), $('interaction-mm'), result, name);
    $('interaction-caption').textContent = available
      ? `${name} · corte a Pu = ${fmt(result.regimes[name].governing.d[0])} kN. Punto: momentos concurrentes de la combinación gobernante.`
      : `${name} · no hay capacidad biaxial disponible al axial gobernante.`;
  }
  function joints() {
    const table = el('table'),
      caption = el(
        'caption',
        'Nudo superior del tramo seleccionado · relación mínima requerida: 1,00',
      ),
      head = el('thead'),
      row = el('tr');
    ['Disipación / eje', 'ΣMnc (kN·m)', 'ΣMnb (kN·m)', 'Relación', 'Estado'].forEach((v) =>
      row.append(el('th', v)),
    );
    head.append(row);
    table.append(caption, head);
    const body = el('tbody');
    for (const name of ['DMO', 'DES'])
      for (const axis of ['x', 'y']) {
        const j = result.regimes[name].joint[axis],
          tr = el('tr');
        for (const v of [
          `${name} · ${axis.toUpperCase()}`,
          j.columnSum === null ? 'Pendiente' : fmt(j.columnSum),
          j.beamSum === null ? 'Pendiente' : fmt(j.beamSum),
          j.ratio === null ? '—' : fmt(j.ratio, 3),
        ])
          tr.append(el('td', v));
        const td = el('td');
        td.append(
          badge(
            j.ratio === null ? 'Pendiente' : j.ratio >= 1 ? 'Satisface' : 'No satisface',
            j.ratio === null ? 'pending' : j.ratio >= 1 ? '' : 'fail',
          ),
        );
        tr.append(td);
        body.append(tr);
      }
    table.append(body);
    const wrap = el('div', undefined, 'table-scroll');
    wrap.append(table);
    $('joint-results').replaceChildren(wrap);
  }
  function forces() {
    const axis = $('force-axis').value,
      body = $('floor-forces').tBodies[0];
    body.replaceChildren();
    for (const s of [...result.storeys[axis]].reverse()) {
      const tr = el('tr');
      [
        s.floor,
        fmt(s.w),
        fmt(s.force),
        fmt(s.shear),
        fmt(s.drift * 100, 3),
        fmt(s.q, 3),
        fmt(s.ax, 2),
      ].forEach((v) => tr.append(el('td', v)));
      body.append(tr);
    }
    $('period-caption').textContent =
      `Dirección ${axis.toUpperCase()}: T Rayleigh = ${fmt(result.periods[axis], 3)} s; Ta = ${fmt(result.ta, 3)} s; Cu = ${fmt(result.cu, 3)}; T usado = ${fmt(result.used[axis], 3)} s. El período es una estimación estática, no una solución modal.`;
  }
  function cases() {
    const rows = result.regimes[$('cases-regime').value].cases,
      start = page * 20,
      body = $('column-cases').tBodies[0];
    body.replaceChildren();
    for (const c of rows.slice(start, start + 20)) {
      const tr = el('tr'),
        first = el('td', c.family);
      first.append(
        el(
          'small',
          `${c.id} · ${c.patternName} · ${c.sx || c.sy ? `Ex ${c.sx}, Ey ${c.sy}, e de Ex ${c.tx ? '+5%' : '−5%'}, e de Ey ${c.ty ? '+5%' : '−5%'}` : 'Sin componente sísmica'}`,
        ),
      );
      tr.append(first, el('td', c.end));
      c.d.forEach((v) => tr.append(el('td', fmt(v, 2))));
      tr.append(el('td', fmt(c.ratio, 3)));
      body.append(tr);
    }
    $('cases-page').textContent =
      `${start + 1}–${Math.min(start + 20, rows.length)} de ${rows.length}`;
    $('cases-prev').disabled = page === 0;
    $('cases-next').disabled = start + 20 >= rows.length;
  }
  function render() {
    $('calculated-results').hidden = false;
    $('calculated-results').classList.remove('stale-results');
    $('export-cases').disabled = false;
    facts();
    cards();
    detail();
    interaction();
    joints();
    forces();
    cases();
    $('model-issues').replaceChildren(...result.issues.map((v) => el('li', v)));
  }
  function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type })),
      link = el('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  $('calculate').addEventListener('click', calculate);
  for (const [prefix, getViewer] of [
    ['building', () => buildingViewer],
    ['column', () => columnViewer],
  ]) {
    $(prefix + '-fit').addEventListener('click', () => getViewer()?.fit());
    $(prefix + '-turn').addEventListener('click', () => getViewer()?.turn());
    $(prefix + '-zoom-in').addEventListener('click', () => getViewer()?.zoom(0.8));
    $(prefix + '-zoom-out').addEventListener('click', () => getViewer()?.zoom(1.25));
  }
  $('building-slabs').addEventListener('change', () =>
    buildingViewer?.configure({ slabs: $('building-slabs').checked }),
  );
  for (const id of ['column-concrete', 'column-bars', 'column-ties'])
    $(id).addEventListener('change', column3D);
  window.addEventListener('pagehide', () => {
    buildingViewer?.dispose();
    columnViewer?.dispose();
    buildingViewer = null;
    columnViewer = null;
    lastBuilding = '';
    lastColumn = '';
  });
  window.addEventListener('pageshow', () => {
    building3D();
    if (result) column3D();
  });
  $('building-form').addEventListener('submit', (e) => {
    e.preventDefault();
    calculate();
  });
  for (const input of controls.values()) input.addEventListener('input', dirty);
  $('column-select').addEventListener('change', calculate);
  $('floor-select').addEventListener('change', calculate);
  for (const [id, value] of [
    ['view-3d', false],
    ['view-plan', true],
  ])
    $(id).addEventListener('click', () => {
      plan = value;
      $('view-plan').setAttribute('aria-pressed', String(plan));
      $('view-3d').setAttribute('aria-pressed', String(!plan));
      drawModel();
    });
  for (const [id, callback] of [
    ['detail-regime', detail],
    ['interaction-regime', interaction],
    ['force-axis', forces],
    [
      'cases-regime',
      () => {
        page = 0;
        cases();
      },
    ],
  ])
    $(id).addEventListener('change', () => {
      if (result) callback();
    });
  $('cases-prev').addEventListener('click', () => {
    page--;
    cases();
  });
  $('cases-next').addEventListener('click', () => {
    page++;
    cases();
  });
  $('save-project').addEventListener('click', () => {
    try {
      const p = read();
      download(JSON.stringify(p, null, 2) + '\n', 'espectra-edificio.json', 'application/json');
      status('Proyecto descargado. El JSON conserva las entradas y se recalcula al abrirlo.');
    } catch (e) {
      error(e);
    }
  });
  $('open-project').addEventListener('click', () => $('project-file').click());
  $('project-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error('El proyecto supera 100 kB.');
      const p = P.validate(JSON.parse(await file.text()));
      const g = P.geometry(p);
      if (!g.nodes.some((n) => n.id === p.selectedColumn) || p.selectedFloor > p.floors)
        throw new Error('El proyecto contiene una selección de columna o piso inexistente.');
      put(p);
      calculate();
    } catch (err) {
      error(err);
    }
    e.target.value = '';
  });
  $('reset-project').addEventListener('click', () => {
    put(P.santaMarta());
    calculate();
  });
  $('export-cases').addEventListener('click', () => {
    if (!result || $('export-cases').disabled) return;
    const rows = [
      [
        'Proyecto',
        'Columna',
        'Piso',
        'Disipación',
        'R',
        'Caso',
        'Familia',
        'Patrón L',
        'Extremo',
        'fd',
        'fl',
        'Ex',
        'Ey',
        'e accidental Ex / Ly',
        'e accidental Ey / Lx',
        'Pu kN',
        'Mx kN m',
        'My kN m',
        'Vx kN',
        'Vy kN',
        'Demanda biaxial/cap',
        'Pu/cap axial',
      ],
    ];
    for (const name of ['DMO', 'DES'])
      for (const c of result.regimes[name].cases)
        rows.push([
          project.name,
          project.selectedColumn,
          project.selectedFloor,
          name,
          result.regimes[name].r,
          c.id,
          c.family,
          c.patternName,
          c.end,
          c.fd,
          c.fl,
          c.sx,
          c.sy,
          accidental(c, 'tx'),
          accidental(c, 'ty'),
          ...c.d,
          Number.isFinite(c.ratio) ? c.ratio : 'Fuera de capacidad',
          c.axial,
        ]);
    download(
      '\uFEFF' +
        rows
          .map((row) =>
            row
              .map((v) => (typeof v === 'number' ? String(v) : EspectraCases.csvCell(v)))
              .join(';'),
          )
          .join('\r\n'),
      'espectra-combinaciones.csv',
      'text/csv;charset=utf-8',
    );
  });
  put(project);
  calculate();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawModel, 100);
  });
})();

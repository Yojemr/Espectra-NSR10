(function (root) {
  'use strict';
  const BARS = {
    3: [9.5, 71],
    4: [12.7, 129],
    5: [15.9, 199],
    6: [19.1, 284],
    7: [22.2, 387],
    8: [25.4, 510],
    9: [28.7, 645],
    10: [32.3, 819],
    11: [35.8, 1006],
  };
  function santaMarta() {
    return {
      schema: 'espectra-building',
      version: 1,
      name: 'Santa Marta · edificio del proyecto',
      site: { code: '47001', aa: 0.15, av: 0.1, soil: 'C', group: 'I' },
      floors: 12,
      storyHeight: 2.8,
      x: [0, 7, 15, 22, 28],
      y: [0, 7.5, 15, 21.5],
      omitted: [[0, 2]],
      fc: 21,
      fy: 420,
      fyt: 420,
      es: 200000,
      gamma: 24,
      poisson: 0.2,
      dead: 6.328164665523156,
      live: 5,
      seismicLive: 0,
      slabEquivalent: 0.12181818181818181,
      beamB: 0.3,
      beamH: 0.5,
      columnFactor: 0.7,
      beamFactor: 0.35,
      phiA: 1,
      phiP: 0.9,
      phiR: 1,
      r0DMO: 5,
      r0DES: 7,
      omega: 3,
      section: {
        b: 400,
        h: 400,
        cover: 40,
        bar: 6,
        nx: 3,
        ny: 3,
        tie: 3,
        legsX: 3,
        legsY: 3,
        sEnd: 100,
        sMid: 150,
      },
      selectedColumn: 9,
      selectedFloor: 1,
      joints: {
        x: { leftPositive: null, leftNegative: null, rightPositive: null, rightNegative: null },
        y: { leftPositive: null, leftNegative: null, rightPositive: null, rightNegative: null },
        source: '',
      },
      assumptions: {
        fixedBase: false,
        rigidDiaphragm: false,
        tributary45: false,
        siteConfirmed: false,
      },
    };
  }
  function number(x, name, min, max, integer = false) {
    if (
      typeof x !== 'number' ||
      !Number.isFinite(x) ||
      x < min ||
      x > max ||
      (integer && !Number.isInteger(x))
    )
      throw new Error(`${name}: valor fuera del intervalo ${min}–${max}.`);
    return x;
  }
  function validate(p) {
    if (!p || p.schema !== 'espectra-building' || p.version !== 1)
      throw new Error('Formato de proyecto no compatible.');
    const q = santaMarta();
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100)
      throw new Error('Nombre de proyecto inválido.');
    q.name = p.name.trim();
    const fields = {
      floors: [1, 20, true],
      storyHeight: [2, 6],
      fc: [21, 80],
      fy: [280, 550],
      fyt: [280, 420],
      es: [180000, 210000],
      gamma: [15, 28],
      poisson: [0.1, 0.3],
      dead: [0, 30],
      live: [0, 30],
      seismicLive: [0, 1],
      slabEquivalent: [0, 0.5],
      beamB: [0.2, 1.5],
      beamH: [0.25, 2],
      columnFactor: [0.1, 1],
      beamFactor: [0.1, 1],
      phiA: [0.1, 1],
      phiP: [0.1, 1],
      phiR: [0.1, 1],
      r0DMO: [5, 5],
      r0DES: [7, 7],
      omega: [3, 3],
      selectedColumn: [1, 100, true],
      selectedFloor: [1, 20, true],
    };
    for (const [key, bounds] of Object.entries(fields)) q[key] = number(p[key], key, ...bounds);
    if (q.slabEquivalent >= q.beamH)
      throw new Error('La altura de viga debe superar el espesor macizo equivalente.');
    for (const axis of ['x', 'y']) {
      if (!Array.isArray(p[axis]) || p[axis].length < 2 || p[axis].length > 6)
        throw new Error('Cada dirección requiere entre 2 y 6 ejes.');
      q[axis] = p[axis].map((v) => number(v, 'Coordenada', 0, 100));
      if (
        q[axis][0] !== 0 ||
        q[axis].some((v, i, a) => i && (v - a[i - 1] < 2 || v - a[i - 1] > 12))
      )
        throw new Error('Los ejes deben iniciar en cero y definir luces entre 2 y 12 m.');
    }
    if ((q.x.length * q.y.length - 1) * q.floors > 500)
      throw new Error('El modelo supera 500 nudos elevados.');
    if (!Array.isArray(p.omitted) || p.omitted.length > 25)
      throw new Error('Lista de paneles inválida.');
    q.omitted = p.omitted.map((v) => {
      if (!Array.isArray(v) || v.length !== 2) throw new Error('Panel omitido inválido.');
      return [
        number(v[0], 'Panel X', 0, q.x.length - 2, true),
        number(v[1], 'Panel Y', 0, q.y.length - 2, true),
      ];
    });
    const s = p.section;
    if (!s) throw new Error('Falta la sección.');
    const sf = {
      b: [250, 2000],
      h: [250, 2000],
      cover: [25, 100],
      bar: [3, 11, true],
      tie: [3, 8, true],
      nx: [2, 12, true],
      ny: [2, 12, true],
      legsX: [2, 12, true],
      legsY: [2, 12, true],
      sEnd: [40, 300],
      sMid: [40, 500],
    };
    for (const [key, bounds] of Object.entries(sf)) q.section[key] = number(s[key], key, ...bounds);
    if (!BARS[s.bar] || !BARS[s.tie]) throw new Error('Barra no incluida en el catálogo.');
    const offset = s.cover + BARS[s.tie][0] + BARS[s.bar][0] / 2;
    if (2 * offset >= Math.min(s.b, s.h))
      throw new Error('El recubrimiento y las barras no caben en la sección.');
    if (!p.site || typeof p.site.code !== 'string' || !/^\d{5}$/.test(p.site.code))
      throw new Error('Municipio inválido.');
    q.site = {
      code: p.site.code,
      aa: number(p.site.aa, 'Aa', 0.01, 1),
      av: number(p.site.av, 'Av', 0.01, 1),
      soil: p.site.soil,
      group: p.site.group,
    };
    if (root.NSR_CATALOG) {
      const city = root.NSR_CATALOG.records.find((v) => v.code === q.site.code);
      if (!city || city.aa !== q.site.aa || city.av !== q.site.av)
        throw new Error('Los parámetros del sitio no coinciden con el catálogo normativo.');
    }
    if (
      !['A', 'B', 'C', 'D', 'E'].includes(q.site.soil) ||
      !['I', 'II', 'III', 'IV'].includes(q.site.group)
    )
      throw new Error('Suelo o grupo inválido.');
    for (const key of Object.keys(q.assumptions)) {
      if (typeof p.assumptions?.[key] !== 'boolean')
        throw new Error('Confirmación del modelo inválida.');
      q.assumptions[key] = p.assumptions[key];
    }
    for (const axis of ['x', 'y'])
      for (const key of Object.keys(q.joints[axis]))
        q.joints[axis][key] =
          p.joints?.[axis]?.[key] === null
            ? null
            : number(p.joints?.[axis]?.[key], 'Capacidad nominal de viga', 0, 100000);
    if (typeof p.joints?.source !== 'string' || p.joints.source.length > 200)
      throw new Error('Fuente de capacidades inválida.');
    q.joints.source = p.joints.source.trim();
    return q;
  }
  function geometry(p) {
    const panels = [],
      points = new Map(),
      edges = new Map();
    for (let j = 0; j < p.y.length - 1; j++)
      for (let i = 0; i < p.x.length - 1; i++) {
        if (p.omitted.some((v) => v[0] === i && v[1] === j)) continue;
        const keys = [
          [i, j],
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ].map(([a, b]) => `${a}:${b}`);
        const panel = {
          i,
          j,
          x: p.x[i],
          y: p.y[j],
          lx: p.x[i + 1] - p.x[i],
          ly: p.y[j + 1] - p.y[j],
          keys,
        };
        panel.area = panel.lx * panel.ly;
        panels.push(panel);
        for (const key of keys) {
          const [a, b] = key.split(':').map(Number);
          points.set(key, {
            key,
            x: p.x[a],
            y: p.y[b],
            label: `${a + 1}${String.fromCharCode(65 + b)}`,
          });
        }
        keys.forEach((key, k) => {
          const next = keys[(k + 1) % 4],
            id = [key, next].sort().join('|');
          if (!edges.has(id)) edges.set(id, { id, keys: [key, next], panels: [] });
          edges.get(id).panels.push(panel);
        });
      }
    if (!panels.length) throw new Error('El modelo no tiene paneles activos.');
    const nodes = [...points.values()]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((v, i) => ({ ...v, id: i + 1 }));
    const area = panels.reduce((a, v) => a + v.area, 0);
    const center = {
      x: panels.reduce((a, v) => a + v.area * (v.x + v.lx / 2), 0) / area,
      y: panels.reduce((a, v) => a + v.area * (v.y + v.ly / 2), 0) / area,
    };
    const beams = [...edges.values()].map((e) => {
      const a = nodes.find((v) => v.key === e.keys[0]),
        b = nodes.find((v) => v.key === e.keys[1]);
      return { ...e, a, b, length: Math.hypot(a.x - b.x, a.y - b.y) };
    });
    // Connectivity is required; disconnected islands are outside the diaphragm model.
    const seen = new Set([nodes[0].key]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of beams)
        if (e.keys.some((k) => seen.has(k)))
          for (const k of e.keys)
            if (!seen.has(k)) {
              seen.add(k);
              changed = true;
            }
    }
    if (seen.size !== nodes.length) throw new Error('La planta contiene paneles desconectados.');
    return { panels, nodes, beams, area, center, width: p.x.at(-1), depth: p.y.at(-1) };
  }
  const api = Object.freeze({ BARS, santaMarta, validate, geometry });
  root.EspectraProject = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

/* NSR-10: A.2.4-3, A.2.4-4, A.2.5-1 and equations A.2.6-1 through A.2.6-15. */
(function (root) {
  'use strict';
  const FA = { A: [.8,.8,.8,.8,.8], B: [1,1,1,1,1], C: [1.2,1.2,1.1,1,1], D: [1.6,1.4,1.2,1.1,1], E: [2.5,1.7,1.2,.9,.9] };
  const FV = { A: [.8,.8,.8,.8,.8], B: [1,1,1,1,1], C: [1.7,1.6,1.5,1.4,1.3], D: [2.4,2,1.8,1.6,1.5], E: [3.5,3.2,2.8,2.4,2.4] };
  const IMPORTANCE = { I: 1, II: 1.1, III: 1.25, IV: 1.5 };
  const G = 9.80665;
  function positive(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${name}: ingresa un número mayor que cero.`);
    return value;
  }
  function interpolate(value, row) {
    if (value <= .1) return row[0];
    if (value >= .5) return row[4];
    const x = (value - .1) / .1;
    const i = Math.min(3, Math.floor(x));
    return row[i] + (row[i + 1] - row[i]) * (x - i);
  }
  function parameters(input) {
    const aa = positive(input.aa, 'Aa'), av = positive(input.av, 'Av');
    if (!Object.hasOwn(IMPORTANCE, input.group)) throw new Error('Selecciona un grupo de uso.');
    if (!Object.hasOwn(FA, input.soil)) {
      if (input.soil === 'F') throw new Error('El perfil F requiere un estudio particular de sitio (A.2.10). Las tablas Fa y Fv no definen su espectro.');
      throw new Error('Selecciona un perfil de suelo entre A y E.');
    }
    const fa = interpolate(aa, FA[input.soil]);
    const fv = interpolate(av, FV[input.soil]);
    const importance = IMPORTANCE[input.group];
    const t0 = .1 * av * fv / (aa * fa);
    const tc = .48 * av * fv / (aa * fa);
    const tl = 2.4 * fv;
    if (![t0, tc, tl].every(Number.isFinite) || tc >= tl) throw new Error('Los parámetros producen TC ≥ TL o un resultado no finito. Revisa Aa, Av y el perfil.');
    return { aa, av, fa, fv, importance, soil: input.soil, group: input.group, t0, tc, tl, higher: input.higher === true };
  }
  function atPeriod(t, p) {
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) throw new Error('El período T debe ser un número finito mayor o igual a cero.');
    let sa, sv, sd, branch, equations;
    if (p.higher && t < p.t0) {
      const q = .4 + .6 * t / p.t0;
      sa = 2.5 * p.aa * p.fa * p.importance * q;
      sv = 3.9 * p.aa * p.fa * p.importance * t * q;
      sd = .62 * p.aa * p.fa * p.importance * t * t * q;
      branch = 'Tramo inicial · modos superiores'; equations = ['A.2.6-7', 'A.2.6-11', 'A.2.6-15'];
    } else if (t <= p.tc) {
      sa = 2.5 * p.aa * p.fa * p.importance;
      sv = 3.9 * p.aa * p.fa * p.importance * t;
      sd = .62 * p.aa * p.fa * p.importance * t * t;
      branch = 'Aceleración constante'; equations = ['A.2.6-3', 'A.2.6-9', 'A.2.6-13'];
    } else if (t <= p.tl) {
      sa = 1.2 * p.av * p.fv * p.importance / t;
      sv = 1.87 * p.av * p.fv * p.importance;
      sd = .3 * p.av * p.fv * p.importance * t;
      branch = 'Velocidad constante'; equations = ['A.2.6-1', 'A.2.6-8', 'A.2.6-12'];
    } else {
      sa = 1.2 * p.av * p.fv * p.tl * p.importance / (t * t);
      sv = 1.87 * p.av * p.fv * p.importance * p.tl / t;
      sd = .3 * p.av * p.fv * p.importance * p.tl;
      branch = 'Desplazamiento constante'; equations = ['A.2.6-5', 'A.2.6-10', 'A.2.6-14'];
    }
    if (![sa, sv, sd].every(Number.isFinite)) throw new Error('La combinación de datos excede el rango numérico.');
    return { t, sa, sv, sd, branch, equations };
  }
  function sample(p, maxT, step = .01) {
    positive(maxT, 'Período máximo'); positive(step, 'Paso');
    if (maxT > 100 || maxT < .1) throw new Error('El período máximo debe estar entre 0,1 y 100 s.');
    if (Math.ceil(maxT / step) > 20000) throw new Error('La discretización excede 20 000 intervalos.');
    const times = new Set([0, maxT]);
    for (let i = 1; i * step < maxT; i++) times.add(Number((i * step).toPrecision(12)));
    for (const t of [p.t0, p.tc, p.tl]) if (t > 0 && t < maxT) times.add(t);
    return [...times].sort((a, b) => a - b).map(t => atPeriod(t, p));
  }
  function hazard(aa, av) {
    const max = Math.max(positive(aa, 'Aa'), positive(av, 'Av'));
    return max <= .1 ? 'Baja' : max <= .2 ? 'Intermedia' : 'Alta';
  }
  const api = Object.freeze({ G, FA, FV, IMPORTANCE, parameters, atPeriod, sample, hazard, interpolate });
  root.NSR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

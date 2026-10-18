const test = require('node:test');
const assert = require('node:assert/strict');
const nsr = require('../assets/engine.js');
const catalog = require('../data/municipios.js');
const close = (a, b, tol = 1e-12) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const base = () => nsr.parameters({ aa: 0.15, av: 0.2, soil: 'D', group: 'I' });

test('Control manual: Medellín, D, grupo I; las tres zonas', () => {
  const p = base();
  close(p.fa, 1.5);
  close(p.fv, 2);
  close(p.t0, 8 / 45);
  close(p.tc, 64 / 75);
  close(p.tl, 4.8);
  const short = nsr.atPeriod(0.5, p),
    medium = nsr.atPeriod(2, p),
    long = nsr.atPeriod(6, p);
  close(short.sa, 0.5625);
  close(short.sv, 0.43875);
  close(short.sd, 0.034875);
  close(medium.sa, 0.24);
  close(medium.sv, 0.748);
  close(medium.sd, 0.24);
  close(long.sa, 0.064);
  close(long.sv, 0.5984);
  close(long.sd, 0.576);
});
test('T=0 usa límites físicos finitos, sin dividir por el período', () => {
  const p = base(),
    r = nsr.atPeriod(0, p);
  close(r.sa, 0.5625);
  assert.equal(r.sv, 0);
  assert.equal(r.sd, 0);
  p.higher = true;
  close(nsr.atPeriod(0, p).sa, 0.225);
});
test('Interpolación independiente, valores de tabla y extremos', () => {
  const p = nsr.parameters({ aa: 0.25, av: 0.35, soil: 'E', group: 'II' });
  close(p.fa, 1.45);
  close(p.fv, 2.6);
  close(p.importance, 1.1);
  for (const soil of ['A', 'B', 'C', 'D', 'E'])
    for (let j = 0; j < 5; j++) {
      close(nsr.interpolate(0.1 * (j + 1), nsr.FA[soil]), nsr.FA[soil][j]);
      close(nsr.interpolate(0.1 * (j + 1), nsr.FV[soil]), nsr.FV[soil][j]);
    }
  close(nsr.interpolate(0.01, nsr.FA.E), 2.5);
  close(nsr.interpolate(0.7, nsr.FV.E), 2.4);
});
test('Modo superior: factor permitido solo bajo T0; mismo espectro después', () => {
  const p = base(),
    q = { ...p, higher: true };
  for (const [t, expected] of [
    [0, 0.4],
    [p.t0 / 2, 0.7],
    [p.t0, 1],
    [p.tc, 1],
    [2, 1],
    [6, 1],
  ]) {
    const a = nsr.atPeriod(t, p),
      b = nsr.atPeriod(t, q);
    for (const key of ['sa', 'sv', 'sd']) close(b[key], a[key] * expected);
  }
});
test('Relaciones de oscilador: coherencia dimensional con tolerancia de redondeo normativo', () => {
  const p = base();
  for (const t of [0.1, 0.5, 1, 2, 5, 10]) {
    const r = nsr.atPeriod(t, p),
      omega = (2 * Math.PI) / t;
    assert.ok(Math.abs((omega * r.sd) / r.sv - 1) < 0.009);
    assert.ok(Math.abs((omega * omega * r.sd) / (r.sa * nsr.G) - 1) < 0.009);
  }
});
test('Fronteras: conservar saltos normativos y continuidad de Sa', () => {
  const p = base(),
    left = nsr.atPeriod(p.tc, p),
    right = nsr.atPeriod(p.tc + 1e-10, p);
  close(left.sa, right.sa, 1e-9);
  close(left.sv / (p.av * p.fv), 1.872);
  close(right.sv / (p.av * p.fv), 1.87);
  assert.ok(right.sd > left.sd);
  assert.ok(Math.abs(right.sd / left.sd - 1) < 0.009);
  const longLeft = nsr.atPeriod(p.tl, p),
    longRight = nsr.atPeriod(p.tl + 1e-10, p);
  for (const key of ['sa', 'sv', 'sd']) close(longLeft[key], longRight[key], 1e-9);
});
test('Escalamiento por importancia en todas las ramas', () => {
  const p = base(),
    q = nsr.parameters({ aa: 0.15, av: 0.2, soil: 'D', group: 'IV' });
  for (const t of [0, 0.01, 0.5, 1, 4.8, 6, 10]) {
    const a = nsr.atPeriod(t, p),
      b = nsr.atPeriod(t, q);
    for (const key of ['sa', 'sv', 'sd']) close(b[key], 1.5 * a[key]);
  }
});
test('Catálogo: 1117 códigos únicos, 33 territorios y clasificación de amenaza', () => {
  assert.equal(catalog.count, 1117);
  assert.equal(catalog.records.length, catalog.count);
  assert.equal(new Set(catalog.records.map((x) => x.code)).size, catalog.count);
  assert.equal(new Set(catalog.records.map((x) => x.department)).size, 33);
  for (const r of catalog.records) {
    assert.match(r.code, /^\d{5}$/);
    assert.equal(r.hazard, nsr.hazard(r.aa, r.av));
  }
  for (const [code, aa, av] of [
    ['05001', 0.15, 0.2],
    ['11001', 0.15, 0.2],
    ['76001', 0.25, 0.25],
    ['08001', 0.1, 0.1],
    ['99001', 0.05, 0.05],
  ]) {
    const r = catalog.records.find((x) => x.code === code);
    close(r.aa, aa);
    close(r.av, av);
  }
});
test('Todo el catálogo con perfiles A–E y grupos I–IV: espectros finitos y orden de períodos', () => {
  for (const r of catalog.records)
    for (const soil of ['A', 'B', 'C', 'D', 'E'])
      for (const group of ['I', 'II', 'III', 'IV']) {
        const p = nsr.parameters({ aa: r.aa, av: r.av, soil, group });
        assert.ok(0 < p.t0 && p.t0 < p.tc && p.tc < p.tl);
        for (const t of [0, p.t0, p.tc, p.tl, 1.5 * p.tl])
          for (const key of ['sa', 'sv', 'sd']) assert.ok(Number.isFinite(nsr.atPeriod(t, p)[key]));
      }
});
test('Muestreo incluye extremos y períodos de transición sin duplicados', () => {
  const p = base(),
    a = nsr.sample(p, 6, 0.01);
  assert.equal(a[0].t, 0);
  assert.equal(a.at(-1).t, 6);
  for (const t of [p.t0, p.tc, p.tl]) assert.ok(a.some((r) => r.t === t));
  assert.equal(new Set(a.map((r) => r.t)).size, a.length);
  const b = nsr.sample(p, 0.1, 0.1);
  assert.equal(b.at(-1).t, 0.1);
});
test('Rechazo de datos inválidos, perfil F y discretización excesiva', () => {
  for (const value of [0, -1, NaN, Infinity, '0.2', true, null, undefined])
    assert.throws(() => nsr.parameters({ aa: value, av: 0.2, soil: 'D', group: 'I' }));
  assert.throws(() => nsr.parameters({ aa: 0.15, av: 0.2, soil: 'F', group: 'I' }), /particular/);
  assert.throws(() => nsr.parameters({ aa: 0.15, av: 0.2, soil: 'D', group: 'V' }));
  assert.throws(() => nsr.parameters({ aa: 0.00001, av: 10, soil: 'B', group: 'I' }), /TC/);
  for (const value of [-1, NaN, Infinity, '1']) assert.throws(() => nsr.atPeriod(value, base()));
  assert.throws(() => nsr.sample(base(), 100, 0.0001));
  assert.throws(() => nsr.sample(base(), 0, 0.01));
});

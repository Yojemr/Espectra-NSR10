const test = require('node:test');
const assert = require('node:assert/strict');
require('../data/municipios.js');
const N = require('../assets/engine.js');
const P = require('../assets/project.js');
const F = require('../assets/frame.js');
const S = require('../assets/section.js');
const B = require('../assets/building.js');
const near = (a, b, t = 1e-7) =>
  assert.ok(Math.abs(a - b) <= t * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const original = P.santaMarta();
const geometry = P.geometry(original);
const baseline = B.analyze(original);

test('Santa Marta: panel area, nodes and independent rectangle subtraction', () => {
  assert.equal(geometry.nodes.length, 19);
  assert.equal(geometry.beams.length, 29);
  near(geometry.area, 28 * 21.5 - 7 * 6.5);
  near(geometry.area, 556.5);
  assert.equal(geometry.nodes.find((n) => n.id === 9).label, '4B');
  assert.equal(P.validate(original).floors, 12);
});
test('Project imports have a closed shape and validate all numeric prerequisites', () => {
  const p = structuredClone(original);
  p.__extra = 'untrusted';
  assert.equal(P.validate(p).__extra, undefined);
  for (const mutation of [
    (p) => (p.fc = NaN),
    (p) => (p.x = [0, 5, 4]),
    (p) => (p.section.bar = 12),
    (p) => (p.site.aa = 0.4),
    (p) => (p.assumptions.fixedBase = 'yes'),
    (p) => (p.joints.x.leftPositive = -1),
  ]) {
    const p = structuredClone(original);
    mutation(p);
    assert.throws(() => P.validate(p));
  }
  const zero = structuredClone(original);
  zero.live = 0;
  assert.equal(P.validate(zero).live, 0);
});
test('Cholesky agrees with a known two-equation system; singular input is rejected', () => {
  const u = F.solve(F.factor(new Float64Array([4, 1, 1, 3]), 2), [1, 2], 2);
  near(u[0], 1 / 11);
  near(u[1], 7 / 11);
  assert.throws(() => F.factor(new Float64Array([0, 0, 0, 0]), 2));
});
test('3D element reproduces analytical axial, bending and torsion cantilever solutions', () => {
  const E = 2e7,
    G = E / 2.4,
    A = 0.16,
    Iy = 0.003,
    Iz = 0.004,
    J = 0.002,
    L = 3,
    Pload = 10;
  const k = F.stiffness(E, G, A, Iy, Iz, J, L),
    free = new Float64Array(36);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) free[i * 6 + j] = k[i + 6][j + 6];
  const l = F.factor(free, 6);
  for (const [index, expected] of [
    [0, (Pload * L) / (E * A)],
    [1, (Pload * L ** 3) / (3 * E * Iz)],
    [2, (Pload * L ** 3) / (3 * E * Iy)],
    [3, (Pload * L) / (G * J)],
  ]) {
    const f = Array(6).fill(0);
    f[index] = Pload;
    const u = F.solve(l, f, 6);
    near(u[index], expected, 1e-10);
  }
});
test('Consistent distributed load reproduces fixed-end beam equilibrium and moment', () => {
  const L = 5,
    q = -12,
    f = F.transverseLoad(L, () => q);
  near(f[2] + f[8], q * L);
  near(f[4], (-q * L * L) / 12);
  near(f[10], (q * L * L) / 12);
  const lx = 7,
    ly = 7.5;
  const integrate = (a, b) => {
    const v = F.transverseLoad(a, (x) => Math.min(x, a - x, b / 2), [
      0,
      Math.min(a / 2, b / 2),
      Math.max(a / 2, a - b / 2),
      a,
    ]);
    return v[2] + v[8];
  };
  near(2 * integrate(lx, ly) + 2 * integrate(ly, lx), lx * ly);
});
test('Frame reactions independently reconcile all applied dead load', () => {
  near(baseline.checks.gravityBase, baseline.checks.expectedDead, 1e-9);
  assert.ok(baseline.checks.residual < 1e-6);
  const columnWeight = geometry.nodes.length * original.gamma * 0.4 * 0.4 * original.storyHeight;
  near(baseline.weight, baseline.checks.expectedDead - columnWeight / 2);
  for (const axis of ['x', 'y']) {
    const rows = baseline.storeys[axis],
      vs = N.atPeriod(baseline.used[axis], baseline.spectrum).sa * baseline.weight;
    near(
      rows.reduce((a, v) => a + v.force, 0),
      vs,
    );
    near(rows[0].shear, vs);
    near(baseline.used[axis], Math.min(baseline.periods[axis], baseline.cu * baseline.ta));
  }
});
test('Concrete displacement subtracts steel volume and gives independent pure axial capacity', () => {
  const bars = S.bars(original.section, P.BARS),
    As = 8 * 284,
    po = (0.85 * 21 * (400 * 400 - As) + 420 * As) / 1000;
  assert.equal(bars.length, 8);
  near(baseline.interaction.pmax, 0.65 * 0.8 * po);
  near(baseline.interaction.pmax, 1960.236096);
  const v = S.point(original.section, bars, 21, 420, 200000, 1e8, 0);
  near(v.p, po);
  const tension = S.point(original.section, bars, 21, 420, 200000, 1e-8, 0);
  near(tension.p, (-420 * As) / 1000);
  near(tension.phi, 0.9);
});
test('Independent lateral reactions balance shear, vertical force and overturning moment', () => {
  const model = F.build(original, geometry),
    forces = Array.from({ length: original.floors }, (_, i) => 100 * (i + 1));
  const sum = forces.reduce((a, v) => a + v, 0),
    overturn = forces.reduce((a, v, i) => a + v * (i + 1) * original.storyHeight, 0);
  const bases = model.elements.filter((e) => e.kind === 'column' && e.a.floor === 0);
  for (const axis of ['x', 'y']) {
    const lateral = model.lateral(forces, axis, 1);
    const reactions = bases.map((e) => ({ e, d: model.actions(e, lateral.u) }));
    near(
      reactions.reduce((a, { d }) => a + d[axis === 'x' ? 3 : 4], 0),
      -sum,
      1e-8,
    );
    near(
      reactions.reduce((a, { d }) => a + d[0], 0),
      0,
      1e-7,
    );
    near(
      reactions.reduce(
        (a, { e, d }) => a + (axis === 'x' ? d[2] - e.a.x * d[0] : d[1] + e.a.y * d[0]),
        0,
      ),
      axis === 'x' ? -overturn : overturn,
      1e-8,
    );
  }
});
test('Strength factor follows the actual extreme steel strain', () => {
  const s = original.section,
    bars = S.bars(s, P.BARS),
    d = 400 - (40 + 9.5 + 19.1 / 2),
    ey = 420 / 200000;
  near(S.point(s, bars, 21, 420, 200000, d / (1 + ey / 0.003), Math.PI / 2).phi, 0.65);
  near(S.point(s, bars, 21, 420, 200000, d / (1 + 0.005 / 0.003), Math.PI / 2).phi, 0.9);
});
test('Biaxial check rejects a demand that passes both independent uniaxial cuts', () => {
  const contour = S.cut(baseline.sectionSurface, 0),
    cap = S.radius(contour, 1, 0);
  assert.ok(S.utilization(baseline.sectionSurface, [0, 0.8 * cap, 0]).ratio < 1);
  assert.ok(S.utilization(baseline.sectionSurface, [0, 0, 0.8 * cap]).ratio < 1);
  assert.ok(S.utilization(baseline.sectionSurface, [0, 0.8 * cap, 0.8 * cap]).ratio > 1);
});
test('Biaxial contour is symmetric and converges when angular resolution is doubled', () => {
  const s = original.section,
    bars = S.bars(s, P.BARS),
    fine = S.surface(s, bars, 21, 420, 200000, true, 192);
  const a = S.cut(baseline.sectionSurface, 500),
    b = S.cut(fine, 500);
  for (const angle of [0.2, 0.6, 1, 1.4]) {
    const x = Math.cos(angle),
      y = Math.sin(angle),
      r = S.radius(a, x, y);
    near(r, S.radius(a, -x, -y), 1e-6);
    near(r, S.radius(b, x, y), 0.003);
  }
});
test('Each regime preserves gravity and only reduces the elastic seismic response', () => {
  const a = baseline.regimes.DMO,
    b = baseline.regimes.DES;
  near(a.r, 4.5);
  near(b.r, 6.3);
  assert.equal(a.cases.length, 528);
  assert.equal(b.cases.length, 528);
  const c = a.cases.find((c) => c.id.startsWith('E09-') && c.end === 'Inferior'),
    d = b.cases.find((v) => v.id === c.id && v.end === c.end);
  const gravity = a.cases.find((v) => v.id === 'G1' && v.end === c.end).d.map((v) => v / 1.4);
  for (let i = 0; i < 5; i++)
    near((c.d[i] - 0.9 * gravity[i]) * a.r, (d.d[i] - 0.9 * gravity[i]) * b.r);
  for (const c of a.cases.filter((v) => v.family === '1.4D' || v.family === '1.2D+1.6L')) {
    const d = b.cases.find((v) => v.id === c.id && v.end === c.end);
    c.d.forEach((v, i) => near(v, d.d[i]));
  }
});
test('Lateral loads have both signs, both accidental eccentricities, 100/30 and the 0.9D family', () => {
  const cases = baseline.regimes.DMO.cases;
  assert.ok(cases.some((v) => v.sx === 1 && v.sy === 0.3));
  assert.ok(cases.some((v) => v.sx === -0.3 && v.sy === -1));
  assert.ok(cases.some((v) => v.tx === 1 && v.ty === 0));
  assert.ok(cases.some((v) => v.fd === 0.9 && v.fl === 0));
  assert.equal(new Set(cases.map((v) => v.patternName)).size, 7);
});
test('Insufficient section is exposed, and missing beam capacities stay unavailable', () => {
  assert.ok(baseline.regimes.DMO.governing.axial > 4);
  assert.equal(baseline.regimes.DMO.governing.ratio, Infinity);
  assert.equal(baseline.regimes.DES.joint.x.ratio, null);
  assert.equal(baseline.regimes.DES.ve[0], null);
});
test('Regression: No.7 longitudinal bars do not allow a 150 mm central DES spacing', () => {
  const p = structuredClone(original);
  p.section.bar = 7;
  p.section.b = p.section.h = 650;
  p.section.tie = 4;
  const d = S.detailing(p, 'DES', S.bars(p.section, P.BARS));
  near(d.centerLimit, 133.2);
  assert.equal(d.checks.find((v) => v.label === 'Separación central').pass, false);
  near(d.ties[0], 0);
  near(d.ties.at(-1), d.clearLength);
  assert.ok(d.ties.every((v, i, a) => Number.isFinite(v) && (!i || v > a[i - 1])));
});
test('Changing dimensions recomputes weight, stiffness and capacities', () => {
  const p = structuredClone(original);
  p.section.b = p.section.h = 900;
  const result = B.analyze(p);
  assert.ok(result.weight > baseline.weight);
  assert.ok(result.periods.x < baseline.periods.x);
  assert.ok(result.interaction.pmax > baseline.interaction.pmax);
  assert.ok(result.checks.residual < 1e-6);
});
test('Displayed uniaxial reference curves follow the global bending axes', () => {
  const [x, y] = baseline.interaction.curves;
  assert.ok(Math.max(...x.map((v) => Math.abs(v.mx))) > 100);
  assert.ok(Math.max(...y.map((v) => Math.abs(v.my))) > 100);
  assert.ok(Math.max(...x.map((v) => Math.abs(v.my))) < 1e-8);
  assert.ok(Math.max(...y.map((v) => Math.abs(v.mx))) < 1e-8);
});
test('Zero clear column height is rejected and No.11 bars require No.4 ties', () => {
  const p = structuredClone(original);
  p.storyHeight = 2;
  p.beamH = 2;
  assert.throws(() => P.validate(p), /menor/);
  p.storyHeight = 2.8;
  p.beamH = 0.5;
  p.section.bar = 11;
  const check = () =>
    S.detailing(p, 'DES', S.bars(p.section, P.BARS)).checks.find((v) => v.ref === 'C.7.10.5.1');
  assert.equal(check().pass, false);
  p.section.tie = 4;
  assert.equal(check().pass, true);
});

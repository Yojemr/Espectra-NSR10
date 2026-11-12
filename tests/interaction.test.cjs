const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/project.js');
const S = require('../assets/section.js');
const near = (a, b, t = 1e-8) =>
  assert.ok(Math.abs(a - b) <= t * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const base = P.santaMarta();
const steel = S.bars(base.section, P.BARS);
const sf = S.surface(base.section, steel, base.fc, base.fy, base.es);

test('NSR-10 C.10-2: tied-column axial cap is 0.75 phi Po', () => {
  const As = 8 * 284;
  const po = (0.85 * 21 * (400 * 400 - As) + 420 * As) / 1000;
  near(po, 3769.6848);
  near(sf.pmax, 0.75 * 0.65 * po);
  near(sf.pmax, 1837.72134);
  assert.equal(S.cut(sf, sf.pmax + 1), null);
});

test('Strain compatibility agrees with independent rectangular force and moment sums', () => {
  for (const [b, h, fc, fy] of [
    [400, 400, 21, 420],
    [600, 350, 35, 500],
  ]) {
    const section = { ...base.section, b, h },
      bars = S.bars(section, P.BARS),
      es = 200000;
    for (const axis of ['x', 'y'])
      for (const c of [40, 80, 120, 200, 400, 1000]) {
        const width = axis === 'x' ? b : h,
          depth = axis === 'x' ? h : b;
        const beta = Math.max(0.65, 0.85 - (Math.max(0, fc - 28) * 0.05) / 7),
          a = Math.min(depth, beta * c);
        let force = 0.85 * fc * width * a,
          moment = (force * (depth - a)) / 2,
          minStrain = Infinity;
        for (const bar of bars) {
          const coord = axis === 'x' ? bar.y : bar.x,
            d = depth / 2 - coord;
          const strain = 0.003 * (1 - d / c),
            stress = Math.max(-fy, Math.min(fy, es * strain));
          const f = bar.area * (stress - (d <= beta * c ? 0.85 * fc : 0));
          force += f;
          moment += f * coord;
          minStrain = Math.min(minStrain, strain);
        }
        const eps = Math.max(0, -minStrain),
          ey = fy / es;
        const phi =
          eps <= ey ? 0.65 : eps >= 0.005 ? 0.9 : 0.65 + (0.25 * (eps - ey)) / (0.005 - ey);
        const result = S.point(section, bars, fc, fy, es, c, axis === 'x' ? Math.PI / 2 : 0);
        near(result.p, force / 1000);
        near(result[axis === 'x' ? 'mx' : 'my'], moment / 1e6);
        near(result[axis === 'x' ? 'my' : 'mx'], 0);
        near(result.phi, phi);
      }
  }
});

test('P-M diagram closes at exact pure axial endpoints and trims at the cap intersection', () => {
  for (const axis of ['x', 'y']) {
    const diagram = S.diagram(sf, axis),
      last = diagram.design.at(-1),
      cap = diagram.design.at(-2);
    assert.deepEqual(diagram.nominal[0], { p: -954.24, m: 0 });
    near(diagram.nominal.at(-1).p, 3769.6848);
    assert.equal(diagram.nominal.at(-1).m, 0);
    near(diagram.design[0].p, -858.816);
    assert.equal(diagram.design[0].m, 0);
    assert.deepEqual(last, { p: sf.pmax, m: 0 });
    assert.ok(diagram.design.every((v) => v.p <= sf.pmax && Number.isFinite(v.m)));
    const cut = S.cut(sf, sf.pmax),
      value = axis === 'x' ? cut[24].mx : cut[0].my;
    near(cap.m, Math.abs(value));
    assert.ok(cap.m > 0);
  }
});

test('Pure tension slice has zero moment capacity without missing sample endpoints', () => {
  const cut = S.cut(sf, sf.pmin);
  assert.ok(cut.every((v) => Math.abs(v.mx) < 1e-12 && Math.abs(v.my) < 1e-12));
  near(S.utilization(sf, [sf.pmin, 0, 0]).axial, 1);
  assert.equal(S.utilization(sf, [sf.pmin, 1, 0]).ratio, Infinity);
});

test('Graph follows the same first-crossing boundary as the solver when axial samples reverse', () => {
  const section = { ...base.section, b: 250, h: 250, nx: 2, ny: 2, legsX: 2, legsY: 2 };
  const surface = S.surface(section, S.bars(section, P.BARS), 80, 550, 200000);
  const raw = surface.curves[0];
  assert.ok(raw.slice(1).some((v, i) => v.p < raw[i].p - 1e-7 && v.p < surface.pmax));
  for (const axis of ['x', 'y']) {
    const data = S.diagram(surface, axis),
      index = axis === 'x' ? 24 : 0,
      key = axis === 'x' ? 'mx' : 'my';
    data.design.slice(0, -1).forEach((v, i, points) => {
      if (i) assert.ok(v.p > points[i - 1].p);
      near(v.m, Math.abs(S.cut(surface, v.p)[index][key]));
    });
  }
});

test('Rectangular X and Y references use their own neutral-axis state and moment component', () => {
  const section = { ...base.section, b: 600, h: 350, nx: 4, ny: 3 };
  const bars = S.bars(section, P.BARS),
    surface = S.surface(section, bars, 21, 420, 200000);
  const x = S.diagram(surface, 'x'),
    y = S.diagram(surface, 'y');
  assert.ok(
    Math.abs(Math.max(...x.nominal.map((v) => v.m)) - Math.max(...y.nominal.map((v) => v.m))) > 50,
  );
  for (const [axis, diagram, depth] of [
    ['x', x, 350],
    ['y', y, 600],
  ]) {
    const dt = depth / 2 + Math.max(...bars.map((v) => Math.abs(axis === 'x' ? v.y : v.x)));
    const c = dt / (1 + 420 / 200000 / 0.003);
    const expected = S.point(section, bars, 21, 420, 200000, c, axis === 'x' ? Math.PI / 2 : 0);
    const balanced = diagram.states.find((v) => v.label === 'Estado balanceado');
    near(balanced.p, expected.p);
    near(balanced.m, Math.abs(expected[axis === 'x' ? 'mx' : 'my']));
  }
});

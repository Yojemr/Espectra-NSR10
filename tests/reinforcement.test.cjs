const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/project.js');
const R = require('../assets/reinforcement.js');
const S = require('../assets/section.js');
const near = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test('Corner bars fit inside the bend and retain steel area and symmetry', () => {
  const s = P.santaMarta().section;
  const steel = S.bars(s, P.BARS);
  const dt = 9.5,
    db = 19.1,
    radius = (5 * dt) / 2;
  const w = s.b / 2 - s.cover - dt / 2;
  const center = w - radius;
  const expected = center + (radius - (dt + db) / 2) / Math.sqrt(2);
  const corner = steel.find((v) => v.x > 0 && v.y > 0);
  near(corner.x, expected);
  near(corner.y, expected);
  near(Math.hypot(corner.x - center, corner.y - center) + db / 2, radius - dt / 2);
  near(
    steel.reduce((v, b) => v + b.area, 0),
    8 * 284,
  );
  near(
    steel.reduce((v, b) => v + b.x, 0),
    0,
  );
  near(
    steel.reduce((v, b) => v + b.y, 0),
    0,
  );
  const oldPosition = 200 - 40 - dt - db / 2;
  near(oldPosition - corner.x, 2.76784091778712);
});

test('Hook bend radii and extensions meet C.7.1.4 and C.7.2.2 for supported tie sizes', () => {
  for (const tie of [3, 4, 5, 6, 7, 8]) {
    const s = { ...P.santaMarta().section, b: 800, h: 800, tie };
    const assembly = R.layout(s, P.BARS);
    const dt = P.BARS[tie][0],
      minimum = (tie <= 5 ? 4 : 6) * dt;
    assert.ok(2 * assembly.radius - dt >= minimum - 1e-8);
    const points = assembly.paths[0].points;
    near(Math.hypot(...points[0].map((v, i) => v - points[1][i])), Math.max(6 * dt, 75));
    near(Math.hypot(...points.at(-1).map((v, i) => v - points.at(-2)[i])), Math.max(6 * dt, 75));
    const center = [assembly.outerX - assembly.radius, assembly.outerY - assembly.radius];
    const a = points[1].map((v, i) => v - center[i]);
    const b = points[28].map((v, i) => v - center[i]);
    near((a[0] * b[0] + a[1] * b[1]) / assembly.radius ** 2, Math.cos((135 * Math.PI) / 180));
    for (const path of assembly.paths)
      for (const [x, y] of path.points) {
        assert.ok(Math.abs(x) + dt / 2 <= s.b / 2 - s.cover + 1e-8);
        assert.ok(Math.abs(y) + dt / 2 <= s.h / 2 - s.cover + 1e-8);
      }
  }
});

test('Alternate levels preserve the cage and separate crossing carriers in height', () => {
  const s = P.santaMarta().section;
  const a = R.layout(s, P.BARS, 0),
    b = R.layout(s, P.BARS, 1);
  assert.equal(a.paths.length, 3);
  for (let i = 0; i < a.paths.length; i++)
    for (let j = 0; j < a.paths[i].points.length; j++) {
      const p = a.paths[i].points[j],
        q = b.paths[i].points[j];
      near(p[0], -q[0]);
      near(p[1], -q[1]);
      near(p[2], q[2]);
    }
  const carrierLevels = a.paths.slice(1).map((path) => path.points[0][2]);
  assert.ok(Math.abs(carrierLevels[0] - carrierLevels[1]) > a.dt);
  near(a.hx, 179);
});

test('Four-bar section uses shifted corner coordinates for effective shear depth', () => {
  const p = P.santaMarta();
  Object.assign(p.section, { nx: 2, ny: 2, legsX: 2, legsY: 2 });
  const steel = S.bars(p.section, P.BARS),
    d = S.detailing(p, 'DMO', steel);
  near(d.dX, 200 + steel[0].x * -1);
  near(d.dY, 200 + Math.abs(steel[0].y));
  assert.ok(d.dX < 400 - 40 - 9.5 - 19.1 / 2);
});

test('Bending geometry changes flexural response while pure axial capacity is conserved', () => {
  const p = P.santaMarta(),
    steel = S.bars(p.section, P.BARS);
  const legacy = steel.map((v) => ({
    ...v,
    x: v.x && v.y ? Math.sign(v.x) * (200 - 40 - 9.5 - 19.1 / 2) : v.x,
    y: v.x && v.y ? Math.sign(v.y) * (200 - 40 - 9.5 - 19.1 / 2) : v.y,
  }));
  const current = S.point(p.section, steel, p.fc, p.fy, p.es, 200, 0);
  const previous = S.point(p.section, legacy, p.fc, p.fy, p.es, 200, 0);
  assert.ok(current.my < previous.my);
  near(
    S.point(p.section, steel, p.fc, p.fy, p.es, 1e8, 0).p,
    S.point(p.section, legacy, p.fc, p.fy, p.es, 1e8, 0).p,
    1e-5,
  );
});

test('Unsupported branches and hooks outside cover are rejected', () => {
  const s = P.santaMarta().section;
  assert.throws(() => R.layout({ ...s, legsX: 4 }, P.BARS), /ramas X/);
  assert.throws(() => R.layout({ ...s, b: 250, h: 250, cover: 70 }, P.BARS), /extensiones/);
});

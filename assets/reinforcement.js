(function (root) {
  'use strict';
  function parameters(s, catalog) {
    const dt = catalog[s.tie][0],
      db = catalog[s.bar][0],
      q = (dt + db) / 2;
    const insideDiameter = (s.tie <= 5 ? 4 : 6) * dt;
    const radius = Math.max((insideDiameter + dt) / 2, q);
    const outerX = s.b / 2 - s.cover - dt / 2,
      outerY = s.h / 2 - s.cover - dt / 2;
    if (radius >= Math.min(outerX, outerY))
      throw new Error('La sección no aloja el diámetro mínimo de doblado del estribo.');
    return {
      dt,
      db,
      q,
      radius,
      insideDiameter,
      outerX,
      outerY,
      tail: Math.max(6 * dt, 75),
      cornerShift: Math.max(0, radius - q) * (1 - 1 / Math.sqrt(2)),
    };
  }
  function coordinates(s, catalog) {
    const p = parameters(s, catalog),
      x = p.outerX - p.q,
      y = p.outerY - p.q,
      out = [];
    const area = catalog[s.bar][1];
    for (let i = 0; i < s.nx; i++)
      for (const sign of [-1, 1]) {
        const corner = i === 0 || i === s.nx - 1;
        out.push({
          x:
            -x +
            (2 * x * i) / (s.nx - 1) +
            (i === 0 ? p.cornerShift : i === s.nx - 1 ? -p.cornerShift : 0),
          y: sign * (y - (corner ? p.cornerShift : 0)),
          area,
        });
      }
    for (let i = 1; i < s.ny - 1; i++)
      for (const sign of [-1, 1]) out.push({ x: sign * x, y: -y + (2 * y * i) / (s.ny - 1), area });
    return out;
  }
  function arc(cx, cy, r, a, b, z = 0) {
    const n = Math.max(3, Math.ceil(Math.abs(b - a) / 5));
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = ((a + ((b - a) * i) / n) * Math.PI) / 180;
      return [cx + r * Math.cos(t), cy + r * Math.sin(t), z];
    });
  }
  function layout(s, catalog, level = 0) {
    if (s.legsX > s.ny || s.legsY > s.nx)
      throw new Error(
        'Este armado admite ramas X ≤ ny y ramas Y ≤ nx: un cerco y ganchos suplementarios apoyados en barras longitudinales.',
      );
    const p = parameters(s, catalog),
      r = p.radius,
      w = p.outerX,
      h = p.outerY,
      L = p.tail,
      z = p.dt * 1.1,
      cx = w - r,
      cy = h - r,
      diag = Math.SQRT1_2;
    const first = arc(cx, cy, r, -45, 90, z),
      last = arc(cx, cy, r, 0, 135, 0);
    const hoop = [[first[0][0] - L * diag, first[0][1] - L * diag, z], ...first];
    const endX = Math.max(-w + r, cx - Math.max(2 * r, 4 * p.dt));
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      hoop.push([cx + (endX - cx) * t, h, z * (1 - t * t * (3 - 2 * t))]);
    }
    hoop.push(
      ...arc(-w + r, h - r, r, 90, 180),
      ...arc(-w + r, -h + r, r, 180, 270),
      ...arc(w - r, -h + r, r, 270, 360),
      ...last,
      [last.at(-1)[0] - L * diag, last.at(-1)[1] - L * diag, 0],
    );
    const paths = [{ kind: 'hoop', points: hoop }],
      branchesX = [-w, w],
      branchesY = [-h, h];
    const ax = w - p.q,
      ay = h - p.q;
    function cross(anchor, extent, rotate, slot) {
      const c = extent - (r - p.q),
        left = arc(-c, anchor, r, 225, 90, slot),
        right = arc(c, anchor, r, 90, -45, slot);
      const points = [
        [left[0][0] + L * diag, left[0][1] - L * diag, slot],
        ...left,
        ...right,
        [right.at(-1)[0] - L * diag, right.at(-1)[1] - L * diag, slot],
      ];
      return points.map(([x, y, z0]) => (rotate ? [-y, x, z0] : [x, y, z0]));
    }
    for (let i = 1; i < s.legsX - 1; i++) {
      const index = Math.round((i * (s.ny - 1)) / (s.legsX - 1)),
        anchor = -ay + (2 * ay * index) / (s.ny - 1);
      paths.push({ kind: 'crosstie', points: cross(anchor, ax, false, -z) });
      branchesY.push(anchor + r);
    }
    for (let i = 1; i < s.legsY - 1; i++) {
      const index = Math.round((i * (s.nx - 1)) / (s.legsY - 1)),
        anchor = -ax + (2 * ax * index) / (s.nx - 1);
      paths.push({ kind: 'crosstie', points: cross(-anchor, ay, true, -2 * z) });
      branchesX.push(anchor - r);
    }
    if (level % 2)
      for (const path of paths) path.points = path.points.map(([x, y, z0]) => [-x, -y, z0]);
    if (
      paths.some((path) =>
        path.points.some(([x, y]) => Math.abs(x) > w + 1e-7 || Math.abs(y) > h + 1e-7),
      )
    )
      throw new Error(
        'La sección no aloja los ganchos de 135° y sus extensiones dentro del recubrimiento.',
      );
    const gap = (values) => {
      const a = values.sort((a, b) => a - b);
      return Math.max(...a.slice(1).map((v, i) => v - a[i]));
    };
    return { ...p, paths, hx: Math.max(gap(branchesX), gap(branchesY)), hookAngle: 135 };
  }
  const api = Object.freeze({ parameters, coordinates, layout });
  root.EspectraRebar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

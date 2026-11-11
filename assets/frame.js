(function (root) {
  'use strict';
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  function stiffness(E, G, A, Iy, Iz, J, L) {
    const k = Array.from({ length: 12 }, () => new Float64Array(12));
    function block(ids, m, s) {
      ids.forEach((a, i) =>
        ids.forEach((b, j) => {
          k[a][b] += m[i][j] * s;
        }),
      );
    }
    block(
      [0, 6],
      [
        [1, -1],
        [-1, 1],
      ],
      (E * A) / L,
    );
    block(
      [3, 9],
      [
        [1, -1],
        [-1, 1],
      ],
      (G * J) / L,
    );
    block(
      [1, 5, 7, 11],
      [
        [12, 6 * L, -12, 6 * L],
        [6 * L, 4 * L * L, -6 * L, 2 * L * L],
        [-12, -6 * L, 12, -6 * L],
        [6 * L, 2 * L * L, -6 * L, 4 * L * L],
      ],
      (E * Iz) / L ** 3,
    );
    block(
      [2, 4, 8, 10],
      [
        [12, -6 * L, -12, -6 * L],
        [-6 * L, 4 * L * L, 6 * L, 2 * L * L],
        [-12, 6 * L, 12, 6 * L],
        [-6 * L, 2 * L * L, 6 * L, 4 * L * L],
      ],
      (E * Iy) / L ** 3,
    );
    return k;
  }
  function factor(matrix, n) {
    const l = new Float64Array(matrix);
    for (let i = 0; i < n; i++) {
      const row = i * n;
      for (let j = 0; j <= i; j++) {
        let s = l[row + j],
          jr = j * n;
        for (let m = 0; m < j; m++) s -= l[row + m] * l[jr + m];
        if (i === j) {
          if (!(s > 1e-8) || !Number.isFinite(s))
            throw new Error(
              'Matriz de rigidez singular: revisa continuidad, apoyos y dimensiones.',
            );
          l[row + j] = Math.sqrt(s);
        } else l[row + j] = s / l[jr + j];
      }
    }
    return l;
  }
  function solve(l, b, n) {
    const u = new Float64Array(b);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) u[i] -= l[i * n + j] * u[j];
      u[i] /= l[i * n + i];
    }
    for (let i = n - 1; i >= 0; i--) {
      for (let j = i + 1; j < n; j++) u[i] -= l[j * n + i] * u[j];
      u[i] /= l[i * n + i];
    }
    return u;
  }
  const GAUSS = [
    [-0.906179845938664, 0.236926885056189],
    [-0.538469310105683, 0.478628670499366],
    [0, 0.568888888888889],
    [0.538469310105683, 0.478628670499366],
    [0.906179845938664, 0.236926885056189],
  ];
  function transverseLoad(L, load, breaks = [0, L]) {
    const f = new Float64Array(12);
    for (let j = 1; j < breaks.length; j++) {
      const a = breaks[j - 1],
        b = breaks[j];
      if (b - a < 1e-10) continue;
      for (const [t, w] of GAUSS) {
        const x = (a + b) / 2 + (t * (b - a)) / 2,
          z = x / L,
          q = (load(x) * w * (b - a)) / 2;
        f[2] += q * (1 - 3 * z * z + 2 * z ** 3);
        f[4] -= q * L * (z - 2 * z * z + z ** 3);
        f[8] += q * (3 * z * z - 2 * z ** 3);
        f[10] -= q * L * (-z * z + z ** 3);
      }
    }
    return f;
  }
  function build(p, g) {
    const per = 3 + 3 * g.nodes.length,
      n = per * p.floors;
    if (n > 900)
      throw new Error(
        'Este análisis admite hasta 900 grados de libertad reducidos. Reduce pisos o ejes.',
      );
    const K = new Float64Array(n * n),
      vectors = Array.from({ length: 8 }, () => new Float64Array(n));
    const elements = [],
      E = 4700 * Math.sqrt(p.fc) * 1000,
      G = E / (2 * (1 + p.poisson));
    const floorMass = Array.from({ length: p.floors }, () => ({ w: 0, x: 0, y: 0, j: 0 }));
    function map(node, d) {
      if (node.floor === 0) return [];
      const base = (node.floor - 1) * per;
      if (d === 0)
        return [
          [base, 1],
          [base + 2, -(node.y - g.center.y)],
        ];
      if (d === 1)
        return [
          [base + 1, 1],
          [base + 2, node.x - g.center.x],
        ];
      if (d === 5) return [[base + 2, 1]];
      return [[base + 3 + (node.id - 1) * 3 + d - 2, 1]];
    }
    function mass(f, w, x, y, j = 0) {
      if (f < 1) return;
      const m = floorMass[f - 1];
      m.w += w;
      m.x += w * x;
      m.y += w * y;
      m.j += j + w * ((x - g.center.x) ** 2 + (y - g.center.y) ** 2);
    }
    function element(a, b, kind, section) {
      const dx = [b.x - a.x, b.y - a.y, b.z - a.z],
        L = Math.hypot(...dx),
        x = dx.map((v) => v / L);
      const y = kind === 'column' ? [1, 0, 0] : cross([0, 0, 1], x),
        z = cross(x, y),
        R = [x, y, z];
      const bb = section.b,
        hh = section.h,
        large = Math.max(bb, hh),
        small = Math.min(bb, hh);
      const J =
        large *
        small ** 3 *
        (1 / 3 - ((0.21 * small) / large) * (1 - small ** 4 / (12 * large ** 4)));
      const k = stiffness(
        E,
        G,
        bb * hh,
        ((bb * hh ** 3) / 12) * section.factor,
        ((hh * bb ** 3) / 12) * section.factor,
        J * section.factor,
        L,
      );
      const maps = [];
      for (const node of [a, b])
        for (let i = 0; i < 6; i++) {
          const row = [];
          for (let j = 0; j < 3; j++)
            for (const [id, c] of map(node, (i < 3 ? 0 : 3) + j))
              if (Math.abs(R[i % 3][j] * c) > 1e-14) row.push([id, R[i % 3][j] * c]);
          maps.push(row);
        }
      for (let i = 0; i < 12; i++)
        for (let j = 0; j < 12; j++)
          if (k[i][j])
            for (const [ii, ci] of maps[i])
              for (const [jj, cj] of maps[j]) K[ii * n + jj] += ci * cj * k[i][j];
      const e = {
        a,
        b,
        kind,
        L,
        R,
        k,
        maps,
        loads: Array.from({ length: 8 }, () => new Float64Array(12)),
      };
      elements.push(e);
      return e;
    }
    function apply(e, index, fl) {
      for (let i = 0; i < 12; i++) {
        e.loads[index][i] += fl[i];
        for (const [id, c] of e.maps[i]) vectors[index][id] += c * fl[i];
      }
    }
    for (let f = 1; f <= p.floors; f++) {
      for (const v of g.nodes) {
        const a = { ...v, z: (f - 1) * p.storyHeight, floor: f - 1 },
          b = { ...v, z: f * p.storyHeight, floor: f };
        const e = element(a, b, 'column', {
          b: p.section.b / 1000,
          h: p.section.h / 1000,
          factor: p.columnFactor,
        });
        const w = ((p.gamma * p.section.b * p.section.h) / 1e6) * e.L,
          fl = new Float64Array(12);
        fl[0] = fl[6] = -w / 2;
        apply(e, 0, fl);
        mass(f, w / 2, v.x, v.y);
        mass(f - 1, w / 2, v.x, v.y);
      }
      for (const edge of g.beams) {
        const a = { ...edge.a, z: f * p.storyHeight, floor: f },
          b = { ...edge.b, z: f * p.storyHeight, floor: f };
        const e = element(a, b, 'beam', { b: p.beamB, h: p.beamH, factor: p.beamFactor });
        e.edge = edge;
        const w = p.gamma * p.beamB * (p.beamH - p.slabEquivalent);
        apply(
          e,
          0,
          transverseLoad(e.L, () => -w),
        );
        mass(f, w * e.L, (a.x + b.x) / 2, (a.y + b.y) / 2, (w * e.L ** 3) / 12);
        for (const panel of edge.panels) {
          const transverse = Math.abs(a.y - b.y) < 1e-8 ? panel.ly : panel.lx;
          const breaks = [
            0,
            Math.min(e.L / 2, transverse / 2),
            Math.max(e.L / 2, e.L - transverse / 2),
            e.L,
          ].filter((v, i, arr) => i === 0 || v - arr[i - 1] > 1e-9);
          const width = (s) => Math.min(s, e.L - s, transverse / 2);
          apply(
            e,
            0,
            transverseLoad(e.L, (s) => -p.dead * width(s), breaks),
          );
          const active = [
            true,
            panel.i % 2 === 0,
            panel.i % 2 === 1,
            panel.j % 2 === 0,
            panel.j % 2 === 1,
            f % 2 === 0,
            f % 2 === 1,
          ];
          active.forEach((v, i) => {
            if (v)
              apply(
                e,
                i + 1,
                transverseLoad(e.L, (s) => -p.live * width(s), breaks),
              );
          });
        }
      }
      for (const v of g.panels)
        mass(
          f,
          (p.dead + p.seismicLive * p.live) * v.area,
          v.x + v.lx / 2,
          v.y + v.ly / 2,
          ((p.dead + p.seismicLive * p.live) * v.area * (v.lx * v.lx + v.ly * v.ly)) / 12,
        );
    }
    const l = factor(K, n),
      solutions = vectors.map((v) => solve(l, v, n));
    const totalWeight = floorMass.reduce((s, m) => s + m.w, 0);
    floorMass.forEach((m) => {
      m.cx = m.x / m.w;
      m.cy = m.y / m.w;
    });
    function lateral(forces, axis, sign = 1, ax = 1) {
      const f = new Float64Array(n),
        dim = axis === 'x' ? g.depth : g.width;
      floorMass.forEach((m, i) => {
        const o = i * per,
          F = forces[i];
        f[o + (axis === 'x' ? 0 : 1)] = F;
        f[o + 2] =
          F * ((axis === 'x' ? -(m.cy - g.center.y) : m.cx - g.center.x) + sign * 0.05 * dim * ax);
      });
      return { load: f, u: solve(l, f, n) };
    }
    function period(axis) {
      const forces = floorMass.map((m, i) => (m.w * (i + 1)) / p.floors),
        a = lateral(forces, axis, 0, 0);
      let msum = 0;
      floorMass.forEach((m, i) => {
        const k = i * per,
          ux = a.u[k],
          uy = a.u[k + 1],
          r = a.u[k + 2],
          dx = m.cx - g.center.x,
          dy = m.cy - g.center.y;
        msum += (m.w * (ux * ux + uy * uy + 2 * r * (uy * dx - ux * dy)) + m.j * r * r) / 9.80665;
      });
      return 2 * Math.PI * Math.sqrt(msum / dot(a.u, a.load));
    }
    function recover(e, u, loadIndex = -1) {
      const d = e.maps.map((m) => m.reduce((s, [i, c]) => s + c * u[i], 0));
      return e.k.map(
        (row, i) => dot(Array.from(row), d) - (loadIndex >= 0 ? e.loads[loadIndex][i] : 0),
      );
    }
    function actions(e, u, loadIndex = -1, end = 0) {
      const v = recover(e, u, loadIndex),
        off = end * 6;
      const fg = Array.from({ length: 3 }, (_, j) =>
        e.R.reduce((s, row, k) => s + row[j] * v[off + k], 0),
      );
      const mg = Array.from({ length: 3 }, (_, j) =>
        e.R.reduce((s, row, k) => s + row[j] * v[off + 3 + k], 0),
      );
      return [v[off] * (end ? -1 : 1), mg[0], mg[1], fg[0], fg[1]];
    }
    let residual = 0;
    for (let i = 0; i < n; i++) {
      let s = -vectors[0][i];
      for (let j = 0; j < n; j++) s += K[i * n + j] * solutions[0][j];
      residual = Math.max(residual, Math.abs(s));
    }
    const gravityBase = elements
      .filter((e) => e.kind === 'column' && e.a.floor === 0)
      .reduce((s, e) => s + actions(e, solutions[0], 0)[0], 0);
    const expectedDead =
      p.floors *
      (g.area * p.dead +
        g.beams.reduce(
          (s, e) => s + e.length * p.gamma * p.beamB * (p.beamH - p.slabEquivalent),
          0,
        ) +
        ((g.nodes.length * p.gamma * p.section.b * p.section.h) / 1e6) * p.storyHeight);
    return {
      n,
      per,
      elements,
      floorMass,
      totalWeight,
      solutions,
      period,
      lateral,
      actions,
      checks: { residual, gravityBase, expectedDead, gravityError: gravityBase - expectedDead },
    };
  }
  const api = Object.freeze({ stiffness, factor, solve, transverseLoad, build });
  root.EspectraFrame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

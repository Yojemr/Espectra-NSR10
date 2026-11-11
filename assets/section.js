(function (root) {
  'use strict';
  const clip = (x, a, b) => Math.max(a, Math.min(b, x));
  function bars(s, catalog) {
    const db = catalog[s.bar][0],
      area = catalog[s.bar][1],
      offset = s.cover + catalog[s.tie][0] + db / 2;
    const x = s.b / 2 - offset,
      y = s.h / 2 - offset,
      out = [];
    for (let i = 0; i < s.nx; i++)
      for (const yy of [-y, y]) out.push({ x: -x + (2 * x * i) / (s.nx - 1), y: yy, area });
    for (let i = 1; i < s.ny - 1; i++)
      for (const xx of [-x, x]) out.push({ x: xx, y: -y + (2 * y * i) / (s.ny - 1), area });
    return out;
  }
  function polygon(s, nx, ny, threshold) {
    let p = [
        [-s.b / 2, -s.h / 2],
        [s.b / 2, -s.h / 2],
        [s.b / 2, s.h / 2],
        [-s.b / 2, s.h / 2],
      ],
      q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        da = nx * a[0] + ny * a[1] - threshold,
        db = nx * b[0] + ny * b[1] - threshold;
      if (da >= 0) q.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        q.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    if (q.length < 3) return { area: 0, x: 0, y: 0 };
    let area = 0,
      x = 0,
      y = 0;
    for (let i = 0; i < q.length; i++) {
      const a = q[i],
        b = q[(i + 1) % q.length],
        v = a[0] * b[1] - b[0] * a[1];
      area += v;
      x += (a[0] + b[0]) * v;
      y += (a[1] + b[1]) * v;
    }
    return { area: area / 2, x: x / (3 * area), y: y / (3 * area) };
  }
  function point(s, steel, fc, fy, es, c, angle, design = true) {
    const nx = Math.cos(angle),
      ny = Math.sin(angle),
      ext = (Math.abs(nx) * s.b) / 2 + (Math.abs(ny) * s.h) / 2,
      beta = clip(0.85 - (0.05 * (fc - 28)) / 7, 0.65, 0.85),
      a = beta * c;
    const concrete = polygon(s, nx, ny, ext - a);
    let N = 0.85 * fc * concrete.area,
      Mx = N * concrete.y,
      My = N * concrete.x,
      epsMin = Infinity;
    for (const bar of steel) {
      const distance = ext - nx * bar.x - ny * bar.y,
        eps = 0.003 * (1 - distance / c),
        fs = clip(es * eps, -fy, fy);
      const force = bar.area * (fs - (distance <= a ? 0.85 * fc : 0));
      N += force;
      Mx += force * bar.y;
      My += force * bar.x;
      epsMin = Math.min(epsMin, eps);
    }
    const epsT = Math.max(0, -epsMin),
      epsY = fy / es,
      phi = design ? clip(0.65 + (0.25 * (epsT - epsY)) / (0.005 - epsY), 0.65, 0.9) : 1;
    return { p: N / 1000, mx: Mx / 1e6, my: My / 1e6, phi, epsT, c, angle };
  }
  function surface(s, steel, fc, fy, es, design = true, resolution = 96) {
    const As = steel.reduce((a, b) => a + b.area, 0),
      po = (0.85 * fc * (s.b * s.h - As) + fy * As) / 1000,
      pt = (-fy * As) / 1000;
    const curves = [];
    for (let i = 0; i < resolution; i++) {
      const angle = (2 * Math.PI * i) / resolution,
        depth = Math.hypot(s.b, s.h),
        samples = [];
      for (let j = 0; j <= 160; j++) samples.push(depth * 10 ** (-4 + (7 * j) / 160));
      const nx = Math.cos(angle),
        ny = Math.sin(angle),
        ext = (Math.abs(nx) * s.b) / 2 + (Math.abs(ny) * s.h) / 2;
      for (const bar of steel) {
        const d = ext - nx * bar.x - ny * bar.y;
        for (const e of [fy / es, 0.005, 0]) if (d > 0) samples.push(d / (1 + e / 0.003));
        if (fy / es < 0.003 && d > 0) samples.push(d / (1 - fy / es / 0.003));
      }
      samples.sort((a, b) => a - b);
      const curve = samples.map((c) => {
        const v = point(s, steel, fc, fy, es, c, angle, design);
        return {
          p: v.p * v.phi,
          mx: v.mx * v.phi,
          my: v.my * v.phi,
          ...{ nominalP: v.p, nominalMx: v.mx, nominalMy: v.my, phi: v.phi, epsT: v.epsT, c },
        };
      });
      curves.push(curve);
    }
    return {
      curves,
      po,
      pt,
      pmax: design ? 0.8 * 0.65 * po : po,
      pmin: design ? 0.9 * pt : pt,
      design,
    };
  }
  function cut(s, pu) {
    if (pu > s.pmax + 1e-8 || pu < s.pmin - 1e-8) return null;
    return s.curves.map((curve) => {
      // Use the first crossing on the tension-to-compression branch.
      for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1],
          b = curve[i];
        if (a.p <= pu && b.p >= pu) {
          const t = (pu - a.p) / (b.p - a.p || 1);
          return { mx: a.mx + t * (b.mx - a.mx), my: a.my + t * (b.my - a.my) };
        }
      }
      return { mx: 0, my: 0 };
    });
  }
  function radius(contour, mx, my) {
    const magnitude = Math.hypot(mx, my);
    if (magnitude < 1e-10) return Infinity;
    const ux = mx / magnitude,
      uy = my / magnitude;
    let distance = Infinity;
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i],
        b = contour[(i + 1) % contour.length],
        dx = b.mx - a.mx,
        dy = b.my - a.my,
        den = ux * dy - uy * dx;
      if (Math.abs(den) < 1e-10) continue;
      const t = (a.mx * dy - a.my * dx) / den,
        v = (a.mx * uy - a.my * ux) / den;
      if (t >= 0 && v >= -1e-8 && v <= 1 + 1e-8) distance = Math.min(distance, t);
    }
    return Number.isFinite(distance) ? distance : 0;
  }
  function utilization(s, demand) {
    const [pu, mx, my] = demand,
      contour = cut(s, pu);
    if (!contour)
      return { ratio: Infinity, axial: pu >= 0 ? pu / s.pmax : pu / s.pmin, capacity: 0 };
    const cap = radius(contour, mx, my),
      ratio = Math.hypot(mx, my) < 1e-8 ? 0 : Math.hypot(mx, my) / cap;
    return { ratio, axial: pu >= 0 ? pu / s.pmax : pu / s.pmin, capacity: cap };
  }
  function detailing(p, regime, steel) {
    const s = p.section,
      Ag = s.b * s.h,
      As = steel.reduce((a, v) => a + v.area, 0),
      bc = s.b - 2 * s.cover,
      hc = s.h - 2 * s.cover,
      Ach = bc * hc;
    const db = root.EspectraProject.BARS[s.bar][0],
      dt = root.EspectraProject.BARS[s.tie][0],
      at = root.EspectraProject.BARS[s.tie][1],
      fyt = p.fyt || 420;
    const requiredX = Math.max(
      (((regime === 'DES' ? 0.3 : 0.2) * hc * p.fc) / fyt) * (Ag / Ach - 1),
      ((regime === 'DES' ? 0.09 : 0.06) * hc * p.fc) / fyt,
    );
    const requiredY = Math.max(
      (((regime === 'DES' ? 0.3 : 0.2) * bc * p.fc) / fyt) * (Ag / Ach - 1),
      ((regime === 'DES' ? 0.09 : 0.06) * bc * p.fc) / fyt,
    );
    const hx = Math.max((bc - dt) / (s.legsY - 1), (hc - dt) / (s.legsX - 1)),
      so = clip(100 + (350 - hx) / 3, 100, 150);
    const endLimit =
      regime === 'DES'
        ? Math.min(s.b / 4, s.h / 4, 6 * db, so)
        : Math.min(8 * db, 16 * dt, Math.min(s.b, s.h) / 3, 150);
    const byArea = Math.min((s.legsX * at) / requiredX, (s.legsY * at) / requiredY);
    const centerLimit =
      regime === 'DES' ? Math.min(6 * db, 150) : Math.min(2 * s.sEnd, 16 * db, 48 * dt, s.b, s.h);
    const clearLength = (p.storyHeight - p.beamH) * 1000,
      lo = Math.max(s.b, s.h, clearLength / 6, regime === 'DES' ? 450 : 500);
    const gapX = (s.b - 2 * (s.cover + dt + db / 2)) / (s.nx - 1) - db,
      gapY = (s.h - 2 * (s.cover + dt + db / 2)) / (s.ny - 1) - db,
      minGap = Math.max(40, 1.5 * db);
    const zones =
      lo * 2 >= clearLength
        ? [{ a: 0, b: clearLength, s: s.sEnd }]
        : [
            { a: 0, b: lo, s: s.sEnd },
            { a: lo, b: clearLength - lo, s: s.sMid },
            { a: clearLength - lo, b: clearLength, s: s.sEnd },
          ];
    const ties = new Set();
    for (const z of zones) {
      const n = Math.max(1, Math.ceil((z.b - z.a) / z.s));
      for (let i = 0; i <= n; i++) ties.add(Math.round((z.a + ((z.b - z.a) * i) / n) * 1e5) / 1e5);
    }
    const checks = [
      {
        label: 'Cuantía longitudinal 1–4 %',
        pass: As / Ag >= 0.01 && As / Ag <= 0.04,
        value: As / Ag,
        ref: regime === 'DES' ? 'C.21.6.3.1' : 'C.21.3.5.2',
      },
      {
        label: 'Dimensión mínima',
        pass: Math.min(s.b, s.h) >= (regime === 'DES' ? 300 : 250),
        value: Math.min(s.b, s.h),
        ref: regime === 'DES' ? 'C.21.6.1.1' : 'C.21.3.5.1',
      },
      {
        label: 'Separación en extremos',
        pass: s.sEnd <= Math.min(endLimit, byArea),
        value: Math.min(endLimit, byArea),
        ref: regime === 'DES' ? 'C.21.6.4.3–4' : 'C.21.3.5.6–7',
      },
      {
        label: 'Separación central',
        pass: s.sMid <= centerLimit,
        value: centerLimit,
        ref: regime === 'DES' ? 'C.21.6.4.5' : 'C.21.3.5.11',
      },
      {
        label: 'Distancia entre ramas',
        pass: hx <= 350,
        value: hx,
        ref: regime === 'DES' ? 'C.21.6.4.2' : 'C.21.3.5.8',
      },
      {
        label: 'Separación libre de barras',
        pass: Math.min(gapX, gapY) >= minGap,
        value: Math.min(gapX, gapY),
        ref: 'C.7.6.3',
      },
      { label: 'Recubrimiento base interior', pass: s.cover >= 40, value: s.cover, ref: 'C.7.7.1' },
    ];
    if (regime === 'DES') {
      const m = Math.min(s.b, s.h);
      const limit = m <= 300 ? 0.35 : m <= 500 ? 0.25 : 0.2;
      checks.push({
        label: 'Proporción de la sección',
        pass: m / Math.max(s.b, s.h) >= limit,
        value: limit,
        ref: 'C.21.6.1.2 · Decreto 340/2012',
      });
    }
    return {
      As,
      rho: As / Ag,
      requiredX,
      requiredY,
      endLimit,
      byArea,
      centerLimit,
      hx,
      lo,
      clearLength,
      ties: [...ties].sort((a, b) => a - b),
      checks,
      dX: s.b - (s.cover + dt + db / 2),
      dY: s.h - (s.cover + dt + db / 2),
      avX: s.legsX * at,
      avY: s.legsY * at,
    };
  }
  const api = Object.freeze({ bars, point, surface, cut, radius, utilization, detailing });
  root.EspectraSection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

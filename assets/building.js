(function (root) {
  'use strict';
  function analyze(input) {
    const P = root.EspectraProject,
      F = root.EspectraFrame,
      S = root.EspectraSection,
      N = root.NSR;
    const p = P.validate(input),
      g = P.geometry(p);
    if (!g.nodes.some((v) => v.id === p.selectedColumn) || p.selectedFloor > p.floors)
      throw new Error('Selecciona una columna y un piso existentes.');
    const spectrum = N.parameters({ ...p.site, higher: false }),
      model = F.build(p, g),
      steel = S.bars(p.section, P.BARS);
    const design = S.surface(p.section, steel, p.fc, p.fy, p.es),
      nominal = S.surface(p.section, steel, p.fc, p.fy, p.es, false),
      probable = S.surface(p.section, steel, p.fc, 1.25 * p.fy, p.es, false);
    const height = p.floors * p.storyHeight,
      ta = p.floors <= 12 && p.storyHeight <= 3 ? 0.1 * p.floors : 0.047 * height ** 0.9,
      cu = Math.max(1.2, 1.75 - 1.2 * p.site.av * spectrum.fv);
    const periods = { x: model.period('x'), y: model.period('y') },
      used = { x: Math.min(periods.x, cu * ta), y: Math.min(periods.y, cu * ta) };
    const lateral = {},
      storeys = {};
    for (const axis of ['x', 'y']) {
      const sa = N.atPeriod(used[axis], spectrum).sa,
        vs = sa * model.totalWeight,
        k = used[axis] <= 0.5 ? 1 : used[axis] >= 2.5 ? 2 : 0.75 + 0.5 * used[axis];
      const weights = model.floorMass.map((v, i) => v.w * ((i + 1) * p.storyHeight) ** k),
        sum = weights.reduce((a, v) => a + v, 0),
        forces = weights.map((v) => (v / sum) * vs);
      lateral[axis] = [-1, 1].map((sign) => model.lateral(forces, axis, sign));
      let shear = 0,
        above = 0;
      storeys[axis] = Array(p.floors);
      for (let i = p.floors - 1; i >= 0; i--) {
        shear += forces[i];
        above += model.floorMass[i].w;
        let drift = 0,
          cmDrift = 0,
          ax = 1,
          irregularity = 1;
        for (const caseData of lateral[axis]) {
          const o = i * model.per,
            u = caseData.u,
            prev = i ? o - model.per : -1,
            ix = axis === 'x' ? 0 : 1;
          const du = u[o + ix] - (i ? u[prev + ix] : 0),
            dr = u[o + 2] - (i ? u[prev + 2] : 0),
            theta = u[o + 2],
            m = model.floorMass[i];
          const coord = axis === 'x' ? m.cy - g.center.y : m.cx - g.center.x;
          cmDrift = Math.max(cmDrift, Math.abs(du + (axis === 'x' ? -dr : dr) * coord));
          const extrem =
            axis === 'x'
              ? [-g.center.y, g.depth - g.center.y]
              : [-g.center.x, g.width - g.center.x];
          const drifts = extrem.map((v) => Math.abs(du + (axis === 'x' ? -dr : dr) * v));
          drift = Math.max(drift, ...drifts);
          const avg = (drifts[0] + drifts[1]) / 2;
          if (avg > 1e-12) irregularity = Math.max(irregularity, Math.max(...drifts) / avg);
          const disp = extrem.map((v) => Math.abs(u[o + ix] + (axis === 'x' ? -theta : theta) * v)),
            dav = (disp[0] + disp[1]) / 2;
          if (dav > 1e-12) ax = Math.max(ax, Math.min(3, (Math.max(...disp) / (1.2 * dav)) ** 2));
        }
        storeys[axis][i] = {
          floor: i + 1,
          height: (i + 1) * p.storyHeight,
          w: model.floorMass[i].w,
          force: forces[i],
          shear,
          drift: drift / p.storyHeight,
          q: (above * cmDrift) / (shear * p.storyHeight),
          ax,
          irregularity,
        };
      }
    }
    const column = model.elements.find(
        (e) => e.kind === 'column' && e.b.floor === p.selectedFloor && e.b.id === p.selectedColumn,
      ),
      upper = model.elements.find(
        (e) => e.kind === 'column' && e.a.floor === p.selectedFloor && e.a.id === p.selectedColumn,
      );
    function bases(e, end) {
      return {
        gravity: model.solutions.map((u, i) => model.actions(e, u, i, end)),
        ex: lateral.x.map((v) => model.actions(e, v.u, -1, end)),
        ey: lateral.y.map((v) => model.actions(e, v.u, -1, end)),
      };
    }
    const basesEnds = [bases(column, 0), bases(column, 1)],
      upperBase = upper ? bases(upper, 0) : null;
    const patterns = [
      'Uniforme',
      'Paneles X pares',
      'Paneles X impares',
      'Paneles Y pares',
      'Paneles Y impares',
      'Pisos pares',
      'Pisos impares',
    ];
    const schedules = [];
    schedules.push({
      id: 'G1',
      fd: 1.4,
      fl: 0,
      pattern: 0,
      sx: 0,
      sy: 0,
      tx: 0,
      ty: 0,
      family: '1.4D',
    });
    patterns.forEach((name, i) =>
      schedules.push({
        id: `G2-${i}`,
        fd: 1.2,
        fl: 1.6,
        pattern: i,
        sx: 0,
        sy: 0,
        tx: 0,
        ty: 0,
        family: '1.2D+1.6L',
      }),
    );
    for (const major of ['X', 'Y'])
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (let tx = 0; tx < 2; tx++)
            for (let ty = 0; ty < 2; ty++) {
              const a = major === 'X' ? sx : 0.3 * sx,
                b = major === 'Y' ? sy : 0.3 * sy;
              patterns.forEach((name, i) =>
                schedules.push({
                  id: `E-${major}-${sx}-${sy}-${tx}-${ty}-${i}`,
                  fd: 1.2,
                  fl: 1,
                  pattern: i,
                  sx: a,
                  sy: b,
                  tx,
                  ty,
                  family: '1.2D+L+E',
                }),
              );
              schedules.push({
                id: `E09-${major}-${sx}-${sy}-${tx}-${ty}`,
                fd: 0.9,
                fl: 0,
                pattern: 0,
                sx: a,
                sy: b,
                tx,
                ty,
                family: '0.9D+E',
              });
            }
    function vector(base, c, r, omega = 1) {
      const grav = base.gravity[0],
        live = base.gravity[c.pattern + 1];
      return grav.map(
        (v, i) =>
          c.fd * v +
          c.fl * live[i] +
          (omega * (c.sx * base.ex[c.tx][i] + c.sy * base.ey[c.ty][i])) / r,
      );
    }
    function moments(sf, pu) {
      const contour = S.cut(sf, pu);
      return contour ? [S.radius(contour, 1, 0), S.radius(contour, 0, 1)] : null;
    }
    const regimes = {};
    for (const regime of ['DMO', 'DES']) {
      const r = (regime === 'DMO' ? p.r0DMO : p.r0DES) * p.phiA * p.phiP * p.phiR,
        detail = S.detailing(p, regime, steel),
        cases = [];
      let shearByCapacity = [0, 0],
        shearOmega = [0, 0],
        maxShear = [0, 0],
        jointMin = [Infinity, Infinity],
        capacityAvailable = true;
      for (const c of schedules) {
        const ds = basesEnds.map((base) => vector(base, c, r));
        ds.forEach((d, end) => {
          const u = S.utilization(design, d);
          cases.push({
            ...c,
            patternName: patterns[c.pattern],
            end: end ? 'Superior' : 'Inferior',
            d,
            ratio: u.ratio,
            axial: u.axial,
          });
          for (let j = 0; j < 2; j++) {
            maxShear[j] = Math.max(maxShear[j], Math.abs(d[j + 3]));
            shearOmega[j] = Math.max(
              shearOmega[j],
              Math.abs(vector(basesEnds[end], c, r, p.omega)[j + 3]),
            );
          }
        });
        const caps = ds.map((d) => moments(regime === 'DES' ? probable : nominal, d[0]));
        if (caps.every(Boolean))
          for (let j = 0; j < 2; j++) {
            const m = j === 0 ? 1 : 0;
            shearByCapacity[j] = Math.max(
              shearByCapacity[j],
              (caps[0][m] + caps[1][m]) / (detail.clearLength / 1000),
            );
          }
        else capacityAvailable = false;
        const below = moments(nominal, ds[1][0]),
          above = upperBase ? moments(nominal, vector(upperBase, c, r)[0]) : [0, 0];
        if (below && above)
          for (let j = 0; j < 2; j++) jointMin[j] = Math.min(jointMin[j], below[j] + above[j]);
        else jointMin = [NaN, NaN];
      }
      cases.sort((a, b) => {
        const score = (c) =>
          Number.isFinite(c.ratio) ? Math.max(c.ratio, c.axial) : 1e6 + c.axial;
        return score(b) - score(a);
      });
      const ve = capacityAvailable
        ? shearByCapacity.map((v, j) =>
            Math.max(maxShear[j], regime === 'DES' ? v : Math.min(v, shearOmega[j])),
          )
        : [null, null];
      const spacing = Math.max(p.section.sEnd, p.section.sMid);
      const shearResistance = [
        (0.6 * detail.avX * p.fyt * detail.dX) / spacing / 1000,
        (0.6 * detail.avY * p.fyt * detail.dY) / spacing / 1000,
      ];
      const node = g.nodes.find((v) => v.id === p.selectedColumn),
        joint = {};
      for (const [axis, index] of [
        ['x', 1],
        ['y', 0],
      ]) {
        const attached = g.beams
          .filter((e) => e.a.id === node.id || e.b.id === node.id)
          .filter((e) => Math.abs(e.a[axis] - e.b[axis]) > 1e-8);
        const left = attached.some((e) => (e.a.id === node.id ? e.b : e.a)[axis] < node[axis]),
          right = attached.some((e) => (e.a.id === node.id ? e.b : e.a)[axis] > node[axis]);
        const b = p.joints[axis],
          required = [
            ...(left ? ['leftPositive', 'leftNegative'] : []),
            ...(right ? ['rightPositive', 'rightNegative'] : []),
          ];
        const complete = required.every((k) => b[k] !== null) && p.joints.source.length > 0;
        const beamSum = complete
          ? Math.max(
              (left ? b.leftPositive : 0) + (right ? b.rightNegative : 0),
              (left ? b.leftNegative : 0) + (right ? b.rightPositive : 0),
            )
          : null;
        joint[axis] = {
          left,
          right,
          columnSum: Number.isFinite(jointMin[index]) ? jointMin[index] : null,
          beamSum,
          ratio:
            complete && Number.isFinite(jointMin[index]) && beamSum > 0
              ? jointMin[index] / (1.2 * beamSum)
              : null,
        };
      }
      regimes[regime] = {
        r,
        cases,
        governing: cases[0],
        detail,
        ve,
        shearResistance,
        maxShear,
        joint,
      };
    }
    const hazard = N.hazard(p.site.aa, p.site.av),
      irregular = g.panels.length !== (p.x.length - 1) * (p.y.length - 1),
      fheAllowed =
        hazard === 'Baja' ||
        (hazard === 'Intermedia' && p.site.group === 'I') ||
        (!irregular &&
          p.floors <= 20 &&
          height <= 60 &&
          !(
            ['D', 'E'].includes(p.site.soil) && Math.max(...Object.values(used)) > 2 * spectrum.tc
          )) ||
        (p.floors <= 6 && height <= 18);
    const issues = [];
    if (!fheAllowed)
      issues.push(
        'El caso no queda cubierto por la comprobación FHE implementada; requiere revisar el método de análisis de A.3.4.2.',
      );
    if (Object.values(p.assumptions).some((v) => !v))
      issues.push('Hay datos o hipótesis del proyecto pendientes de confirmar.');
    const maxAx = Math.max(
      ...Object.values(storeys)
        .flat()
        .map((v) => v.ax),
    );
    if (maxAx > 1.001)
      issues.push(
        `La evaluación preliminar exige revisar amplificación de torsión accidental Ax (hasta ${maxAx.toFixed(2)}) e irregularidad torsional. Las fuerzas mostradas usan Ax = 1.`,
      );
    issues.push(
      'Análisis de primer orden. Falta cerrar P-Δ, esbeltez, rigidez del diafragma, materiales/exposición, anclajes y resistencia del nudo.',
    );
    if (irregular)
      issues.push(
        'La planta tiene entrantes. La idealización de diafragma rígido requiere justificación para el procedimiento de análisis adoptado.',
      );
    return {
      project: p,
      geometry: g,
      steel,
      periods,
      used,
      ta,
      cu,
      weight: model.totalWeight,
      spectrum,
      storeys,
      regimes,
      checks: model.checks,
      issues,
      fheAllowed,
      maxAx,
      interaction: {
        curves: [design.curves[0], design.curves[24]],
        pmax: design.pmax,
        pmin: design.pmin,
      },
      sectionSurface: design,
    };
  }
  const api = Object.freeze({ analyze });
  root.EspectraBuilding = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

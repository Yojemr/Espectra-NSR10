(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const fmt = (n, d = 1) =>
    Number.isFinite(n)
      ? n.toLocaleString('es-CO', { maximumFractionDigits: d })
      : 'Fuera de capacidad';
  function svg(parent, tag, attrs = {}, content) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (content !== undefined) e.textContent = content;
    parent.append(e);
    return e;
  }
  function line(parent, a, b, cls) {
    return svg(parent, 'line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls });
  }
  function model(target, p, g, plan) {
    target.replaceChildren();
    const height = p.floors * p.storyHeight;
    const viewWidth = target.clientWidth < 500 ? 400 : 720;
    target.setAttribute('viewBox', `0 0 ${viewWidth} 410`);
    const raw = (x, y, z) =>
      plan ? [x, -y] : [0.84 * x - 0.6 * y, 0.28 * x + 0.38 * y - 0.88 * z];
    const corners = [0, g.width].flatMap((x) =>
      [0, g.depth].flatMap((y) => [0, height].map((z) => raw(x, y, z))),
    );
    const minX = Math.min(...corners.map((v) => v[0])),
      maxX = Math.max(...corners.map((v) => v[0])),
      minY = Math.min(...corners.map((v) => v[1])),
      maxY = Math.max(...corners.map((v) => v[1]));
    const scale = Math.min((viewWidth - 100) / (maxX - minX), 310 / (maxY - minY));
    const project = (x, y, z) => {
      const a = raw(x, y, z);
      return [
        viewWidth / 2 + (a[0] - (maxX + minX) / 2) * scale,
        205 + (a[1] - (maxY + minY) / 2) * scale,
      ];
    };
    for (const panel of g.panels) {
      const z = plan ? 0 : height;
      const pts = [
        [panel.x, panel.y],
        [panel.x + panel.lx, panel.y],
        [panel.x + panel.lx, panel.y + panel.ly],
        [panel.x, panel.y + panel.ly],
      ]
        .map((v) => project(...v, z).join(','))
        .join(' ');
      svg(target, 'polygon', { points: pts, class: 'slab' });
    }
    if (!plan)
      for (let f = 0; f <= p.floors; f++) {
        for (const b of g.beams)
          line(
            target,
            project(b.a.x, b.a.y, f * p.storyHeight),
            project(b.b.x, b.b.y, f * p.storyHeight),
            'model-edge',
          );
        if (f)
          for (const n of g.nodes)
            line(
              target,
              project(n.x, n.y, (f - 1) * p.storyHeight),
              project(n.x, n.y, f * p.storyHeight),
              'model-edge',
            );
      }
    for (const n of g.nodes) {
      const selected = n.id === p.selectedColumn,
        a = project(n.x, n.y, plan ? 0 : (p.selectedFloor - 1) * p.storyHeight),
        b = project(n.x, n.y, plan ? 0 : p.selectedFloor * p.storyHeight);
      if (selected && !plan) line(target, a, b, 'selected-edge');
      const point = svg(target, 'circle', {
        cx: b[0],
        cy: b[1],
        r: selected ? 6 : 3,
        class: 'column-node',
      });
      svg(point, 'title', {}, `Columna ${n.label} · ${n.id}`);
      if (plan || selected) svg(target, 'text', { x: b[0] + 8, y: b[1] - 7 }, n.label);
    }
    svg(target, 'text', { x: 20, y: 26 }, plan ? 'PLANTA · X → / Y ↑' : 'VISTA AXONOMÉTRICA');
    svg(
      target,
      'text',
      { x: 20, y: 390 },
      `${fmt(g.width)} × ${fmt(g.depth)} m · H = ${fmt(height)} m`,
    );
  }
  function section(target, p, steel) {
    target.replaceChildren();
    const s = p.section,
      k = Math.min(240 / s.b, 230 / s.h),
      x = 190 - (s.b * k) / 2,
      y = 145 - (s.h * k) / 2;
    svg(target, 'rect', { x, y, width: s.b * k, height: s.h * k, class: 'concrete' });
    const offset = (s.cover + root.EspectraProject.BARS[s.tie][0] / 2) * k;
    svg(target, 'rect', {
      x: x + offset,
      y: y + offset,
      width: s.b * k - 2 * offset,
      height: s.h * k - 2 * offset,
      rx: 6,
      class: 'tie',
    });
    for (let i = 1; i < s.legsX - 1; i++) {
      const yy = y + offset + ((s.h * k - 2 * offset) * i) / (s.legsX - 1);
      line(target, [x + offset, yy], [x + s.b * k - offset, yy], 'tie');
    }
    for (let i = 1; i < s.legsY - 1; i++) {
      const xx = x + offset + ((s.b * k - 2 * offset) * i) / (s.legsY - 1);
      line(target, [xx, y + offset], [xx, y + s.h * k - offset], 'tie');
    }
    for (const b of steel)
      svg(target, 'circle', {
        cx: 190 + b.x * k,
        cy: 145 - b.y * k,
        r: Math.max(3, (root.EspectraProject.BARS[s.bar][0] * k) / 2),
        class: 'bar',
      });
    svg(
      target,
      'text',
      { x: 190, y: 285, 'text-anchor': 'middle' },
      `b (X) = ${fmt(s.b, 0)} mm · h (Y) = ${fmt(s.h, 0)} mm`,
    );
    svg(
      target,
      'text',
      { x: 190, y: 305, 'text-anchor': 'middle' },
      `${steel.length} barras No. ${s.bar} · estribo No. ${s.tie}`,
    );
  }
  function elevation(target, p, detail) {
    target.replaceChildren();
    const k = 245 / detail.clearLength,
      lo = Math.min(detail.lo, detail.clearLength / 2) * k;
    svg(target, 'rect', { x: 75, y: 25, width: 100, height: 245, class: 'concrete' });
    for (const y of [25, 270 - lo])
      svg(target, 'rect', { x: 75, y, width: 100, height: lo, fill: 'var(--surface-accent)' });
    for (const z of detail.ties) line(target, [75, 270 - z * k], [175, 270 - z * k], 'tie');
    line(target, [89, 25], [89, 270], 'curve-x');
    line(target, [161, 25], [161, 270], 'curve-x');
    svg(target, 'text', { x: 185, y: 45 }, `lo ${fmt(detail.lo, 0)} mm`);
    svg(target, 'text', { x: 185, y: 65 }, `s ≤ ${fmt(p.section.sEnd, 0)}`);
    svg(target, 'text', { x: 185, y: 154 }, `s ≤ ${fmt(p.section.sMid, 0)}`);
    svg(
      target,
      'text',
      { x: 150, y: 301, 'text-anchor': 'middle' },
      `L libre = ${fmt(detail.clearLength, 0)} mm`,
    );
  }
  function chart(target, xmin, xmax, ymin, ymax, xlabel, ylabel) {
    target.replaceChildren();
    const x = (v) => 65 + (350 * (v - xmin)) / (xmax - xmin),
      y = (v) => 255 - (210 * (v - ymin)) / (ymax - ymin);
    for (let i = 0; i <= 4; i++) {
      const xv = xmin + ((xmax - xmin) * i) / 4,
        yv = ymin + ((ymax - ymin) * i) / 4;
      line(target, [x(xv), 45], [x(xv), 255], 'grid-line');
      line(target, [65, y(yv)], [415, y(yv)], 'grid-line');
      svg(target, 'text', { x: x(xv), y: 276, 'text-anchor': 'middle' }, fmt(xv, 0));
      svg(target, 'text', { x: 58, y: y(yv) + 4, 'text-anchor': 'end' }, fmt(yv, 0));
    }
    if (xmin <= 0 && xmax >= 0) line(target, [x(0), 45], [x(0), 255], 'axis');
    if (ymin <= 0 && ymax >= 0) line(target, [65, y(0)], [415, y(0)], 'axis');
    svg(target, 'text', { x: 240, y: 301, 'text-anchor': 'middle' }, xlabel);
    svg(target, 'text', { x: 65, y: 23 }, ylabel);
    return { x, y };
  }
  function interaction(pm, mm, r, regime) {
    const demand = r.regimes[regime].governing.d,
      curves = r.interaction.curves;
    const points = curves.flat(),
      maxM =
        Math.max(
          Math.abs(demand[1]),
          Math.abs(demand[2]),
          ...points.map((v) => Math.max(Math.abs(v.mx), Math.abs(v.my))),
        ) * 1.12;
    const maxP = Math.max(demand[0], r.interaction.pmax) * 1.12,
      minP = Math.min(demand[0], r.interaction.pmin) * 1.15;
    const a = chart(pm, -maxM, maxM, minP, maxP, 'φMn / Mu (kN·m)', 'φPn / Pu (kN)');
    curves.forEach((curve, i) => {
      for (const sign of [-1, 1])
        svg(pm, 'polyline', {
          points: curve
            .map((v) =>
              [a.x(sign * (i ? v.my : v.mx)), a.y(Math.min(v.p, r.interaction.pmax))].join(','),
            )
            .join(' '),
          class: i ? 'curve-y' : 'curve-x',
        });
      svg(pm, 'circle', { cx: a.x(demand[i + 1]), cy: a.y(demand[0]), r: 5, class: 'demand' });
    });
    svg(pm, 'text', { x: 300, y: 23 }, 'X continuo · Y trazos');
    const cut = root.EspectraSection.cut(r.sectionSurface, demand[0]);
    if (!cut) {
      mm.replaceChildren();
      svg(
        mm,
        'text',
        { x: 240, y: 135, 'text-anchor': 'middle' },
        'Pu excede el intervalo axial resistente.',
      );
      svg(
        mm,
        'text',
        { x: 240, y: 160, 'text-anchor': 'middle' },
        'No existe un corte biaxial a este axial.',
      );
      return false;
    }
    const extent =
      Math.max(
        ...cut.flatMap((v) => [Math.abs(v.mx), Math.abs(v.my)]),
        Math.abs(demand[1]),
        Math.abs(demand[2]),
      ) * 1.15 || 1;
    const b = chart(mm, -extent, extent, -extent, extent, 'φMnx / Mux (kN·m)', 'φMny / Muy (kN·m)');
    svg(mm, 'polygon', {
      points: cut.map((v) => [b.x(v.mx), b.y(v.my)].join(',')).join(' '),
      class: 'curve-x',
    });
    line(mm, [b.x(0), b.y(0)], [b.x(demand[1]), b.y(demand[2])], 'curve-y');
    svg(mm, 'circle', { cx: b.x(demand[1]), cy: b.y(demand[2]), r: 6, class: 'demand' });
    return true;
  }
  root.EspectraView = Object.freeze({ fmt, model, section, elevation, interaction });
})(globalThis);

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
    if (plan) return floorPlan(target, p, g);
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
  function floorPlan(target, p, g) {
    const width = Math.max(400, Math.min(720, target.parentElement.clientWidth));
    const marker = drawing(target, width, 450, 'PLANTA ESTRUCTURAL', 'm');
    const k = Math.min((width - 170) / g.width, 245 / g.depth);
    const left = (width - g.width * k) / 2 + 12,
      top = 80;
    const right = left + g.width * k,
      bottom = top + g.depth * k;
    const xy = (x, y) => [left + x * k, bottom - y * k];
    for (const panel of g.panels)
      svg(target, 'rect', {
        x: left + panel.x * k,
        y: bottom - (panel.y + panel.ly) * k,
        width: panel.lx * k,
        height: panel.ly * k,
        class: 'slab',
      });
    const bubble = (x, y, label) => {
      svg(target, 'circle', { cx: x, cy: y, r: 12, class: 'grid-bubble' });
      svg(target, 'text', { x, y: y + 5, 'text-anchor': 'middle', class: 'grid-label' }, label);
    };
    p.x.forEach((x, i) => {
      const px = xy(x, 0)[0];
      line(target, [px, top - 12], [px, bottom + 8], 'drawing-axis');
      bubble(px, top - 24, String(i + 1));
      if (i) dimension(target, xy(p.x[i - 1], 0), xy(x, 0), fmt(x - p.x[i - 1], 2), 30, marker);
    });
    p.y.forEach((y, i) => {
      const py = xy(0, y)[1];
      line(target, [left - 12, py], [right + 12, py], 'drawing-axis');
      bubble(right + 28, py, String.fromCharCode(65 + i));
      if (i) dimension(target, xy(0, p.y[i - 1]), xy(0, y), fmt(y - p.y[i - 1], 2), -30, marker);
    });
    for (const beam of g.beams)
      line(target, xy(beam.a.x, beam.a.y), xy(beam.b.x, beam.b.y), 'model-edge');
    for (const node of g.nodes) {
      const at = xy(node.x, node.y),
        selected = node.id === p.selectedColumn;
      const b = Math.max(5, (p.section.b * k) / 1000),
        h = Math.max(5, (p.section.h * k) / 1000);
      const column = svg(target, 'rect', {
        x: at[0] - b / 2,
        y: at[1] - h / 2,
        width: b,
        height: h,
        class: selected ? 'plan-column selected-column' : 'plan-column',
      });
      svg(column, 'title', {}, 'Columna ' + node.label);
      if (selected)
        svg(target, 'text', { x: at[0] + 10, y: at[1] - 9, class: 'selected-label' }, node.label);
    }
    dimension(target, [left, bottom], [right, bottom], fmt(g.width, 2), 61, marker);
    dimension(target, [left, bottom], [left, top], fmt(g.depth, 2), -61, marker);
    svg(
      target,
      'text',
      { x: width / 2, y: 421, 'text-anchor': 'middle', class: 'drawing-subtitle' },
      'X → · Y ↑ · columna seleccionada: ' + g.nodes.find((n) => n.id === p.selectedColumn).label,
    );
  }
  function drawing(target, width, height, title, unit = 'mm') {
    target.replaceChildren();
    target.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    const defs = svg(target, 'defs'),
      id = target.id + '-arrow';
    const marker = svg(defs, 'marker', {
      id,
      viewBox: '0 0 8 8',
      refX: 4,
      refY: 4,
      markerWidth: 5,
      markerHeight: 5,
      orient: 'auto-start-reverse',
    });
    svg(marker, 'path', { d: 'M0 0L8 4L0 8Z', class: 'dimension-fill' });
    svg(target, 'rect', {
      x: 8,
      y: 8,
      width: width - 16,
      height: height - 16,
      rx: 8,
      class: 'drawing-border',
    });
    svg(target, 'text', { x: 24, y: 32, class: 'drawing-title' }, title);
    svg(
      target,
      'text',
      { x: width - 24, y: 32, 'text-anchor': 'end', class: 'drawing-unit' },
      'COTAS EN ' + unit,
    );
    return id;
  }
  function dimension(target, a, b, label, offset, marker) {
    const vertical = Math.abs(a[0] - b[0]) < 1e-8;
    const p = vertical ? [a[0] + offset, a[1]] : [a[0], a[1] + offset];
    const q = vertical ? [b[0] + offset, b[1]] : [b[0], b[1] + offset];
    line(
      target,
      a,
      vertical ? [p[0] + Math.sign(offset) * 6, p[1]] : [p[0], p[1] + Math.sign(offset) * 6],
      'extension-line',
    );
    line(
      target,
      b,
      vertical ? [q[0] + Math.sign(offset) * 6, q[1]] : [q[0], q[1] + Math.sign(offset) * 6],
      'extension-line',
    );
    const ln = line(target, p, q, 'dimension-line');
    ln.setAttribute('marker-start', 'url(#' + marker + ')');
    ln.setAttribute('marker-end', 'url(#' + marker + ')');
    const x = (p[0] + q[0]) / 2,
      y = (p[1] + q[1]) / 2;
    const g = svg(target, 'g', {
      transform: vertical
        ? 'translate(' + (x - 10) + ' ' + y + ') rotate(-90)'
        : 'translate(' + x + ' ' + (y - 10) + ')',
    });
    svg(g, 'rect', {
      x: -label.length * 4.5 - 7,
      y: -14,
      width: label.length * 9 + 14,
      height: 21,
      rx: 3,
      class: 'dimension-label-bg',
    });
    svg(g, 'text', { 'text-anchor': 'middle', class: 'dimension-label' }, label);
  }
  function section(target, p, steel) {
    const marker = drawing(target, 500, 430, 'SECCIÓN C–C');
    const s = p.section,
      k = Math.min(240 / s.b, 240 / s.h),
      cx = 240,
      cy = 194;
    const left = cx - (s.b * k) / 2,
      top = cy - (s.h * k) / 2,
      right = cx + (s.b * k) / 2,
      bottom = cy + (s.h * k) / 2;
    svg(target, 'rect', {
      x: left,
      y: top,
      width: s.b * k,
      height: s.h * k,
      class: 'concrete drawing-outline',
    });
    const assembly = root.EspectraRebar.layout(s, root.EspectraProject.BARS);
    line(target, [left - 23, cy], [right + 31, cy], 'drawing-axis');
    line(target, [cx, bottom + 20], [cx, top - 24], 'drawing-axis');
    svg(target, 'text', { x: right + 36, y: cy + 5, class: 'axis-label' }, 'X');
    svg(target, 'text', { x: cx + 8, y: top - 25, class: 'axis-label' }, 'Y');
    for (const path of assembly.paths) {
      const points = path.points.map(([x, y]) => [cx + x * k, cy - y * k].join(',')).join(' ');
      svg(target, 'polyline', {
        points,
        class: 'tie-underlay',
        'stroke-width': assembly.dt * k + 2,
      });
      svg(target, 'polyline', { points, class: 'tie', 'stroke-width': assembly.dt * k });
    }
    for (const bar of steel)
      svg(target, 'circle', {
        cx: cx + bar.x * k,
        cy: cy - bar.y * k,
        r: (assembly.db * k) / 2,
        class: 'bar',
      });
    dimension(target, [left, bottom], [right, bottom], 'b = ' + fmt(s.b, 0), 38, marker);
    dimension(target, [left, bottom], [left, top], 'h = ' + fmt(s.h, 0), -41, marker);
    dimension(
      target,
      [right - s.cover * k, top],
      [right, top],
      'c = ' + fmt(s.cover, 0),
      -28,
      marker,
    );
    const bar = steel.filter((v) => v.x > 0 && v.y > 0).sort((a, b) => b.x + b.y - a.x - a.y)[0];
    if (bar) {
      const at = [cx + bar.x * k, cy - bar.y * k],
        end = [right + 24, top + 47];
      svg(target, 'polyline', {
        points: [at, [right + 10, top + 47], end].map((v) => v.join(',')).join(' '),
        class: 'leader-line',
      });
      svg(
        target,
        'text',
        { x: end[0] + 4, y: end[1] + 4, class: 'drawing-callout' },
        'No. ' + s.bar,
      );
    }
    svg(
      target,
      'text',
      { x: 240, y: 391, 'text-anchor': 'middle', class: 'drawing-rebar-label' },
      steel.length + ' No. ' + s.bar + ' · estribo No. ' + s.tie + ' · ganchos 135°',
    );
    svg(
      target,
      'text',
      { x: 240, y: 411, 'text-anchor': 'middle', class: 'drawing-subtitle' },
      'c: recubrimiento a la cara exterior del estribo',
    );
  }
  function elevation(target, p, detail) {
    const marker = drawing(target, 360, 430, 'ALZADO DEL TRAMO');
    const s = p.section,
      assembly = root.EspectraRebar.layout(s, root.EspectraProject.BARS);
    const top = 62,
      bottom = 341,
      k = (bottom - top) / detail.clearLength,
      left = 98,
      right = 194,
      cx = (left + right) / 2,
      xScale = (right - left) / s.b;
    const lo = Math.min(detail.lo, detail.clearLength / 2) * k;
    svg(target, 'rect', {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      class: 'concrete drawing-outline',
    });
    for (const y of [top, bottom - lo])
      svg(target, 'rect', {
        x: left,
        y,
        width: right - left,
        height: lo,
        class: 'confinement-zone',
      });
    const positions = [
      ...new Set(root.EspectraSection.bars(s, root.EspectraProject.BARS).map((v) => v.x)),
    ];
    for (const x of positions)
      svg(target, 'line', {
        x1: cx + x * xScale,
        y1: top,
        x2: cx + x * xScale,
        y2: bottom,
        class: 'longitudinal-side',
        'stroke-width': Math.max(2, assembly.db * xScale),
      });
    for (const z of detail.ties) {
      const y = bottom - z * k,
        xx = assembly.outerX * xScale;
      svg(target, 'rect', {
        x: cx - xx,
        y: y - Math.max(1, (assembly.dt * k) / 2),
        width: 2 * xx,
        height: Math.max(2, assembly.dt * k),
        rx: Math.min(3, assembly.radius * xScale),
        class: 'tie-side',
      });
    }
    line(target, [cx, top - 10], [cx, bottom + 12], 'drawing-axis');
    line(target, [left, top + lo], [right, top + lo], 'zone-line');
    line(target, [left, bottom - lo], [right, bottom - lo], 'zone-line');
    dimension(
      target,
      [left, bottom],
      [left, top],
      'L = ' + fmt(detail.clearLength, 0),
      -43,
      marker,
    );
    if (detail.lo * 2 < detail.clearLength) {
      dimension(target, [right, top + lo], [right, top], 'l₀ = ' + fmt(detail.lo, 0), 48, marker);
      dimension(
        target,
        [right, bottom],
        [right, bottom - lo],
        'l₀ = ' + fmt(detail.lo, 0),
        48,
        marker,
      );
    }
    const fullConfinement = detail.lo * 2 >= detail.clearLength;
    const spacingLabel = (x, y, sub, value) => {
      const label = svg(target, 'text', { x, y, class: 'drawing-callout' });
      svg(label, 'tspan', {}, 's');
      svg(label, 'tspan', { 'baseline-shift': 'sub', 'font-size': 10 }, sub);
      svg(label, 'tspan', {}, ' ≤ ' + fmt(value, 0));
    };
    spacingLabel(
      fullConfinement ? 228 : 258,
      fullConfinement ? (top + bottom) / 2 + 5 : top + lo / 2 + 5,
      'e',
      s.sEnd,
    );
    if (!fullConfinement) spacingLabel(228, (top + bottom) / 2 + 5, 'c', s.sMid);
    svg(
      target,
      'text',
      { x: 180, y: 385, 'text-anchor': 'middle', class: 'drawing-rebar-label' },
      detail.ties.length + ' niveles · estribo No. ' + s.tie,
    );
    svg(
      target,
      'text',
      { x: 180, y: 407, 'text-anchor': 'middle', class: 'drawing-subtitle' },
      fullConfinement
        ? 'Confinamiento continuo · ancho amplificado'
        : 'e: extremos · c: centro · ancho amplificado',
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

(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const catalog = globalThis.NSR_CATALOG;
  const nsr = globalThis.NSR;
  const SOURCE = catalog.url;
  const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 });
  const fixed = (n, digits = 3) => n.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const records = catalog.records;
  let mode = 'city', current = null, points = [], maxT = 6, selectedT = 1, tablePage = 0, valid = false;
  let lastInput = null, example = true, toastTimer;
  const colors = { sa:'#367b62', sv:'#bf8b3d', sd:'#6375a4' };
  const titles = { sa:'Pseudoaceleración', sv:'Pseudovelocidad', sd:'Desplazamiento' };

  function city() { return records.find(r => r.code === $('municipality').value); }
  function addOptions(element, options) {
    element.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  }
  function municipalities(preferred) {
    const filtered = records.filter(r => r.department === $('department').value && normalize(`${r.name} ${r.code}`).includes(normalize($('city-search').value)));
    addOptions($('municipality'), filtered.length ? filtered.map(r => [r.code, r.name]) : [['', 'Sin coincidencias']]);
    if (filtered.some(r => r.code === preferred)) $('municipality').value = preferred;
    $('city-count').textContent = `${filtered.length} resultados`;
    loadMunicipality();
  }
  function loadMunicipality() {
    if (mode !== 'city') return;
    const item = city();
    $('aa').value = item ? item.aa.toFixed(2) : '';
    $('av').value = item ? item.av.toFixed(2) : '';
    $('catalog-reference').textContent = item ? `Código ${item.code} · NSR-10, ${item.page}` : 'Prueba otro nombre o utiliza ingreso manual.';
  }
  function setMode(next) {
    mode = next;
    $('city-fields').hidden = mode !== 'city'; $('manual-fields').hidden = mode !== 'manual';
    for (const key of ['city','manual']) {
      $(`mode-${key}`).classList.toggle('active', key === mode);
      $(`mode-${key}`).setAttribute('aria-pressed', String(key === mode));
    }
    $('aa').readOnly = mode === 'city'; $('av').readOnly = mode === 'city';
    if (mode === 'city') loadMunicipality();
  }
  function inputs() {
    if (mode === 'city' && !city()) throw new Error('Selecciona un municipio o utiliza ingreso manual.');
    if (mode === 'manual' && (!$('manual-name').value.trim() || !$('manual-source').value.trim())) throw new Error('En ingreso manual, escribe el nombre del sitio y la fuente de Aa y Av.');
    if ($('particular').checked) throw new Error('El sitio requiere el espectro de la microzonificación o del estudio particular aplicable (A.2.1.2). Las curvas generales de A.2.6 no sustituyen ese espectro.');
    return { aa: Number($('aa').value), av: Number($('av').value), soil: $('soil').value, group: $('group').value, higher: $('higher-modes').checked };
  }
  function markInvalid(message) {
    valid = false;
    $('error-box').textContent = message; $('error-box').hidden = false;
    $('result-content').hidden = true; document.querySelector('.results').classList.add('invalid');
    for (const id of ['fa-value','fv-value','importance-value','t0-value','tc-value','tl-value']) $(id).textContent = '—';
    $('case-tag').textContent = 'REVISAR ENTRADAS';
    $('site-summary').textContent = 'Resultados no calculados';
  }
  function update() {
    try {
      lastInput = inputs();
      const p = nsr.parameters(lastInput);
      const newMax = Number($('max-period').value);
      const step = Number($('sample-step').value);
      const newPoints = nsr.sample(p, newMax, step);
      current = p; maxT = newMax; points = newPoints; selectedT = Math.max(0, Math.min(maxT, selectedT)); tablePage = 0;
      valid = true; $('error-box').hidden = true; $('result-content').hidden = false;
      document.querySelector('.results').classList.remove('invalid');
      $('case-tag').textContent = example ? 'EJEMPLO EDITABLE' : 'CASO PERSONALIZADO';
      const item = city();
      $('site-name').textContent = mode === 'city' ? `${item.name}, ${item.department}` : $('manual-name').value.trim();
      const hazard = nsr.hazard(p.aa, p.av);
      $('hazard-badge').textContent = `Amenaza ${hazard.toLowerCase()}`;
      $('hazard-badge').dataset.level = hazard;
      $('site-summary').textContent = `Perfil ${p.soil} · Grupo ${p.group} · ξ = 5 %`;
      $('source-summary').textContent = mode === 'city' ? `Apéndice A-4 · ${item.page}` : 'Parámetros manuales';
      $('source-summary').title = mode === 'city' ? SOURCE : $('manual-source').value.trim();
      $('fa-value').textContent = fixed(p.fa, 2); $('fv-value').textContent = fixed(p.fv, 2); $('importance-value').textContent = fixed(p.importance, 2);
      for (const [id, value] of [['t0',p.t0],['tc',p.tc],['tl',p.tl]]) $(`${id}-value`).innerHTML = `${fixed(value)} <small>s</small>`;
      $('selected-period').max = String(maxT); $('period-slider').max = String(maxT);
      renderCharts(); selectPeriod(selectedT); renderTable();
    } catch (error) { markInvalid(error.message); }
  }
  function unitInfo(key) {
    if (key === 'sa') return $('accel-unit').value === 'g' ? { factor:1, label:'g' } : { factor:nsr.G, label:'m/s²' };
    if (key === 'sv') return { factor:1, label:'m/s' };
    return { factor:{ m:1, cm:100, mm:1000 }[$('displ-unit').value], label:$('displ-unit').value };
  }
  function niceTop(value) {
    const pow = 10 ** Math.floor(Math.log10(value || 1));
    const frac = value / pow;
    return [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(x => x >= frac) * pow;
  }
  function renderCharts() {
    if (!valid) return;
    for (const key of ['sa','sv','sd']) renderChart(key);
  }
  function renderChart(key) {
    const element = $(`chart-${key}`);
    const width = Math.max(260, Math.round(element.clientWidth - 18));
    const height = key === 'sa' && width > 600 ? 242 : 218;
    const m = { l:51, r:18, t:21, b:39 };
    const pw = width - m.l - m.r, ph = height - m.t - m.b;
    const units = unitInfo(key);
    const yMax = niceTop(Math.max(...points.map(p => p[key] * units.factor)) * 1.07);
    const x = t => m.l + pw * t / maxT;
    const y = v => m.t + ph * (1 - v * units.factor / yMax);
    let grid = '', labels = '', transitions = '';
    for (let i = 0; i <= 4; i++) {
      const yy = m.t + ph * i / 4;
      grid += `<line x1="${m.l}" y1="${yy}" x2="${width-m.r}" y2="${yy}" stroke="#e7ebe0" stroke-width=".8"/>`;
      labels += `<text x="${m.l-10}" y="${yy+3}" text-anchor="end">${nf.format(yMax * (1-i/4))}</text>`;
    }
    const ticks = maxT <= 1 ? 4 : 6;
    for (let i = 0; i <= ticks; i++) {
      const t = maxT * i / ticks, xx = x(t);
      grid += `<line x1="${xx}" y1="${m.t}" x2="${xx}" y2="${height-m.b}" stroke="#eef0e9" stroke-width=".6"/>`;
      labels += `<text x="${xx}" y="${height-m.b+18}" text-anchor="middle">${nf.format(t)}</text>`;
    }
    const visibleTransitions = [['0',current.t0],['C',current.tc],['L',current.tl]].filter(([, t]) => t < maxT);
    let lastLabel = -Infinity;
    for (const [label, t] of visibleTransitions) {
      transitions += `<line x1="${x(t)}" y1="${m.t}" x2="${x(t)}" y2="${height-m.b}" stroke="#afba9d" stroke-width=".8" stroke-dasharray="3 4"/>`;
      const labelY = x(t) - lastLabel < 22 ? 21 : 10;
      labels += `<text x="${x(t)}" y="${labelY}" text-anchor="middle" fill="#879470">T<tspan baseline-shift="sub" font-size="6">${label}</tspan></text>`;
      lastLabel = x(t);
    }
    // Add one-sided samples so the rounded normative jumps are not interpolated away.
    const chartPoints = [...points];
    for (const t of [current.tc, current.tl]) if (t < maxT) chartPoints.push(nsr.atPeriod(t + Math.max(1e-9,t*1e-9),current));
    chartPoints.sort((a,b)=>a.t-b.t);
    const d = chartPoints.map((p,i) => `${i?'L':'M'}${x(p.t).toFixed(2)},${y(p[key]).toFixed(2)}`).join(' ');
    const area = `${d} L${x(maxT)},${height-m.b} L${m.l},${height-m.b} Z`;
    const description = `${titles[key]} de ${$('site-name').textContent}, perfil ${current.soil}, grupo ${current.group}. Período de 0 a ${maxT} s. Unidad: ${units.label}.`;
    element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(description)}"><title>${escape(description)}</title><rect width="${width}" height="${height}" fill="white"/><defs><linearGradient id="fill-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${colors[key]}" stop-opacity=".13"/><stop offset="100%" stop-color="${colors[key]}" stop-opacity=".015"/></linearGradient></defs><g>${grid}</g><path d="${area}" fill="url(#fill-${key})"/><g>${transitions}</g><path d="${d}" fill="none" stroke="${colors[key]}" stroke-width="2.2" stroke-linejoin="round"/><g style="font:9px 'Segoe UI',Arial,sans-serif;fill:#8b957e">${labels}<text x="${m.l-10}" y="11" text-anchor="end">${escape(units.label)}</text><text x="${width-m.r}" y="${height-5}" text-anchor="end">Período T (s)</text></g><line class="cursor-line" x1="0" y1="${m.t}" x2="0" y2="${height-m.b}" stroke="${colors[key]}" stroke-width="1" stroke-dasharray="3 3"/><circle class="cursor-dot" r="4" fill="white" stroke="${colors[key]}" stroke-width="2"/><rect class="chart-hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
    element._plot = { x, y, m, width, height, pw };
    const svg = element.querySelector('svg');
    let dragging = false;
    const pick = event => {
      const rect = svg.getBoundingClientRect();
      const position = (event.clientX - rect.left) * width / rect.width;
      selectPeriod(Math.max(0,Math.min(maxT,(position - m.l) / pw * maxT)));
    };
    svg.addEventListener('pointerdown', event => { if (event.button !== 0) return; dragging = true; svg.setPointerCapture(event.pointerId); pick(event); });
    svg.addEventListener('pointermove', event => { if (dragging) pick(event); });
    svg.addEventListener('pointerup', () => { dragging = false; });
    svg.addEventListener('pointercancel', () => { dragging = false; });
  }
  function selectPeriod(t, fromInput = false) {
    if (!valid) return;
    if (!Number.isFinite(t) || t < 0 || t > maxT) {
      $('selected-period').setCustomValidity(`Ingresa un período entre 0 y ${maxT} s.`);
      $('selected-period').reportValidity(); return;
    }
    $('selected-period').setCustomValidity('');
    selectedT = t;
    if (!fromInput) $('selected-period').value = Number(t.toFixed(5));
    $('period-slider').value = t;
    const p = nsr.atPeriod(t, current);
    $('branch-name').textContent = p.branch;
    ['sa','sv','sd'].forEach((key,i) => {
      const unit = unitInfo(key);
      $(`${key}-readout`).innerHTML = `${fixed(p[key]*unit.factor,4)} <small>${unit.label}</small>`;
      $(`${key}-equation`).textContent = p.equations[i];
      const chart = $(`chart-${key}`), plot = chart._plot;
      if (plot) {
        const line = chart.querySelector('.cursor-line'), dot = chart.querySelector('.cursor-dot');
        line.setAttribute('x1',plot.x(t)); line.setAttribute('x2',plot.x(t));
        dot.setAttribute('cx',plot.x(t)); dot.setAttribute('cy',plot.y(p[key]));
      }
    });
    renderSubstitution(p);
    const shift = t === 0 ? 0 : Math.min(16, 5 + 5 * Math.sin(t));
    $('model-mass').setAttribute('x',39+shift);
    $('model-column-left').setAttribute('d',`M48 77 C48 45 ${48+shift} 47 ${48+shift} 22`);
    $('model-column-right').setAttribute('d',`M125 77 C125 45 ${125+shift} 47 ${125+shift} 22`);
  }
  function renderSubstitution(point) {
    const p = current, t = point.t;
    const aa = nf.format(p.aa), av = nf.format(p.av), fa = nf.format(p.fa), fv = nf.format(p.fv), imp = nf.format(p.importance), tt = nf.format(t), tl = nf.format(p.tl);
    let formulas;
    if (t <= p.tc) {
      const q = p.higher && t < p.t0 ? ` × (0,4 + 0,6 × ${tt} / ${nf.format(p.t0)})` : '';
      formulas = [`2,5 × ${aa} × ${fa} × ${imp}${q}`,`3,9 × ${aa} × ${fa} × ${imp} × ${tt}${q}`,`0,62 × ${aa} × ${fa} × ${imp} × ${tt}²${q}`];
    } else if (t <= p.tl) formulas = [`1,2 × ${av} × ${fv} × ${imp} / ${tt}`,`1,87 × ${av} × ${fv} × ${imp}`,`0,30 × ${av} × ${fv} × ${imp} × ${tt}`];
    else formulas = [`1,2 × ${av} × ${fv} × ${tl} × ${imp} / ${tt}²`,`1,87 × ${av} × ${fv} × ${imp} × ${tl} / ${tt}`,`0,30 × ${av} × ${fv} × ${imp} × ${tl}`];
    $('substitution').innerHTML = ['sa','sv','sd'].map((key,i)=>`<p><strong>S<sub>${['a','v','d'][i]}</sub></strong> = ${formulas[i]} = <strong>${fixed(point[key],6)} ${['g','m/s','m'][i]}</strong> <small>(${point.equations[i]})</small></p>`).join('') + '<small>La sustitución se expresa en las unidades originales del reglamento. Se muestra redondeada; los cálculos conservan la precisión numérica.</small>';
  }
  function renderTable() {
    if (!valid) return;
    const size = 40, pages = Math.ceil(points.length/size);
    tablePage = Math.max(0,Math.min(pages-1,tablePage));
    $('spectrum-table').innerHTML = points.slice(tablePage*size,(tablePage+1)*size).map(p=>`<tr><td>${fixed(p.t,5)}</td><td>${fixed(p.sa,6)}</td><td>${fixed(p.sv,6)}</td><td>${fixed(p.sd,6)}</td><td>${p.branch}</td></tr>`).join('');
    $('sample-count').textContent = `${points.length} períodos`;
    $('table-page').textContent = `${tablePage+1} / ${pages}`;
    $('table-prev').disabled = tablePage === 0; $('table-next').disabled = tablePage === pages-1;
  }
  function download(content, filename, mime) {
    const blob = new Blob([content], {type:mime});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(()=>$('toast').hidden=true,4500);
  }
  function csvCell(value) {
    let s = String(value);
    if (/^[=+@\-\t\r]/.test(s)) s = "'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function exportCsv() {
    if (!valid) return;
    const source = mode === 'city' ? `${catalog.source}, ${city().page}; ${SOURCE}` : $('manual-source').value.trim();
    const header = ['T_s','Sa_g','Sv_m_s','Sd_m','Aa','Av','Fa','Fv','I','perfil','grupo','modos_superiores','sitio','fuente'];
    const lines = points.map(p => [p.t,p.sa,p.sv,p.sd,current.aa,current.av,current.fa,current.fv,current.importance,current.soil,current.group,current.higher,$('site-name').textContent,source].map(csvCell).join(';'));
    download('\uFEFF'+header.join(';')+'\r\n'+lines.join('\r\n'),'espectros-nsr10.csv','text/csv;charset=utf-8'); toast('Datos exportados en g, m/s y m. Separador: punto y coma.');
  }
  function caseObject() {
    return { schema:'espectra-nsr10', version:1, mode, municipality:mode==='city'?city().code:null,
      name:mode==='manual'?$('manual-name').value.trim():'', source:mode==='manual'?$('manual-source').value.trim():'',
      input:lastInput, maxPeriod:maxT, step:Number($('sample-step').value), selectedPeriod:selectedT,
      accelUnit:$('accel-unit').value, displUnit:$('displ-unit').value, catalogSha256:catalog.sourceSha256 };
  }
  function saveCase() {
    if (!valid) return;
    download(JSON.stringify(caseObject(),null,2)+'\n','caso-espectra.json','application/json;charset=utf-8'); toast('Caso guardado. Puedes abrirlo después desde esta aplicación.');
  }
  function loadCase(data) {
    if (!data || data.schema !== 'espectra-nsr10' || data.version !== 1 || !['city','manual'].includes(data.mode)) throw new Error('El archivo no es un caso válido de Espectra.');
    if (!data.input || typeof data.input.higher !== 'boolean') throw new Error('Datos del espectro incompletos.');
    nsr.parameters(data.input); nsr.sample(nsr.parameters(data.input),data.maxPeriod,data.step);
    if (![.01,.02,.05,.1].includes(data.step) || !Number.isFinite(data.selectedPeriod) || data.selectedPeriod < 0 || data.selectedPeriod > data.maxPeriod) throw new Error('Configuración de períodos inválida.');
    if (!['g','ms2'].includes(data.accelUnit) || !['m','cm','mm'].includes(data.displUnit)) throw new Error('Unidades del caso inválidas.');
    const item = records.find(r=>r.code===data.municipality);
    if (data.mode === 'city' && (!item || data.input.aa !== item.aa || data.input.av !== item.av)) throw new Error('Los parámetros no coinciden con el municipio del catálogo. Usa ingreso manual para parámetros de otra fuente.');
    if (data.mode === 'manual' && (typeof data.name !== 'string' || typeof data.source !== 'string' || !data.name.trim() || !data.source.trim() || data.name.length > 100 || data.source.length > 240)) throw new Error('El sitio y la fuente manual deben ser textos válidos.');
    if (item && data.mode==='city') { $('department').value = item.department; $('city-search').value=''; municipalities(item.code); }
    setMode(data.mode);
    $('manual-name').value = data.name || ''; $('manual-source').value = data.source || '';
    $('aa').value = data.input.aa; $('av').value = data.input.av;
    $('soil').value = data.input.soil; $('group').value = data.input.group;
    $('higher-modes').checked = data.input.higher; $('particular').checked = false;
    $('max-period').value = data.maxPeriod; $('sample-step').value = String(data.step);
    $('accel-unit').value = data.accelUnit; $('displ-unit').value = data.displUnit;
    selectedT = data.selectedPeriod; example = false; update();
    toast('Caso abierto. Los resultados se recalcularon con sus entradas.');
  }
  function reset() {
    HTMLFormElement.prototype.reset.call($('parameters-form')); $('city-search').value=''; $('manual-name').value=''; $('manual-source').value='';
    setMode('city'); $('department').value = 'Antioquia'; municipalities('05001');
    $('accel-unit').value='g'; $('displ-unit').value='m'; selectedT=1; example=true; update();
  }

  addOptions($('department'), [...new Set(records.map(r=>r.department))].sort((a,b)=>a.localeCompare(b,'es')).map(d=>[d,d]));
  $('catalog-total').textContent = `${catalog.count.toLocaleString('es-CO')} localidades · NSR-10`;
  $('catalog-method').textContent = `${catalog.count.toLocaleString('es-CO')} localidades de 32 departamentos y Bogotá, D. C. Fuente: Apéndice A-4, páginas A-153 a A-174 del Título A publicado por el IDRD. Bogotá aparece dos veces con los mismos parámetros y se conserva una sola entrada.`;
  $('department').addEventListener('change',()=>{example=false;$('city-search').value='';municipalities();update();});
  $('city-search').addEventListener('input',()=>{example=false;const before=$('municipality').value;municipalities(before);update();});
  $('municipality').addEventListener('change',()=>{example=false;loadMunicipality();update();});
  for (const next of ['city','manual']) $(`mode-${next}`).addEventListener('click',()=>{example=false;setMode(next);update();});
  $('parameters-form').addEventListener('submit',event=>{event.preventDefault();example=false;update();if(valid)toast('Espectros actualizados.');});
  for (const id of ['aa','av','soil','group','particular','max-period','sample-step','higher-modes','manual-name','manual-source']) $(id).addEventListener('change',()=>{example=false;update();});
  for (const id of ['accel-unit','displ-unit']) $(id).addEventListener('change',()=>{renderCharts();selectPeriod(selectedT);});
  $('selected-period').addEventListener('input',()=>{if($('selected-period').value!=='')selectPeriod(Number($('selected-period').value),true);});
  $('selected-period').addEventListener('change',()=>{if($('selected-period').value==='')$('selected-period').value=selectedT;});
  $('period-slider').addEventListener('input',()=>selectPeriod(Number($('period-slider').value)));
  $('table-prev').addEventListener('click',()=>{tablePage--;renderTable();}); $('table-next').addEventListener('click',()=>{tablePage++;renderTable();});
  $('export-csv').addEventListener('click',exportCsv); $('save-case').addEventListener('click',saveCase);
  $('load-case').addEventListener('click',()=>$('case-file').click());
  $('case-file').addEventListener('change',async event=>{ const file=event.target.files[0];if(!file)return;try{if(file.size>50000)throw new Error('El archivo de caso supera 50 kB.');loadCase(JSON.parse(await file.text()));}catch(error){toast(error.message);}event.target.value='';});
  for (const button of document.querySelectorAll('[data-download]')) button.addEventListener('click',()=>{
    if(!valid)return; const key=button.dataset.download;const svg=$(`chart-${key}`).querySelector('svg').cloneNode(true);
    svg.querySelector('.chart-hit').remove();svg.setAttribute('width',$(`chart-${key}`)._plot.width);svg.setAttribute('height',$(`chart-${key}`)._plot.height);
    download(new XMLSerializer().serializeToString(svg),`espectro-${key}-nsr10.svg`,'image/svg+xml;charset=utf-8');toast('Gráfica vectorial guardada.');
  });
  $('reset').addEventListener('click',reset);
  let resizeTimer;
  new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{renderCharts();if(valid)selectPeriod(selectedT);},80);}).observe(document.querySelector('.results'));
  reset();
})();

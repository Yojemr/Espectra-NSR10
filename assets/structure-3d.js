import * as T from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';

function noiseTexture() {
  const size = 128,
    bytes = new Uint8Array(size * size * 4);
  let seed = 2941;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = 220 + (seed >>> 28);
    bytes.set([v, v, v, 255], i * 4);
  }
  const texture = new T.DataTexture(bytes, size, size, T.RGBAFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(4, 8);
  texture.needsUpdate = true;
  return texture;
}
function disposeGroup(group) {
  const geometries = new Set(),
    materials = new Set();
  group.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
      materials.add(m);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  group.clear();
}
function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
function rod(group, a, b, diameter, material) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    length = start.distanceTo(end);
  const m = mesh(group, new T.CylinderGeometry(diameter / 2, diameter / 2, length, 12), material);
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize());
  return m;
}
export function create(host, { kind, onSelect, onStatus } = {}) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = kind === 'column';
  renderer.shadowMap.type = T.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    kind === 'column'
      ? 'Columna 3D interactiva. Usa flechas para girar, más y menos para acercar; inicio para encuadrar.'
      : 'Edificio 3D interactivo. Arrastra para girar, haz clic en una columna para seleccionarla. Usa flechas, más, menos e inicio con el teclado.',
  );
  host.replaceChildren(canvas);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(35, 1, 0.01, 2000),
    group = new T.Group();
  scene.add(group);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.zoomToCursor = true;
  const sky = new T.HemisphereLight(0xffffff, 0x7f867a, 2.8);
  scene.add(sky);
  const key = new T.DirectionalLight(0xfff3db, 3.2);
  key.position.set(12, 30, 18);
  scene.add(key);
  key.castShadow = kind === 'column';
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0002;
  const fill = new T.DirectionalLight(0xe2efff, 1.7);
  fill.position.set(-12, 10, -8);
  scene.add(fill);
  const texture = noiseTexture();
  let frame = 0,
    destroyed = false,
    contextLost = false,
    box = null,
    lastShape = '',
    columns = null,
    picks = [],
    concrete = null,
    slabs = null,
    bars = null,
    ties = null;
  const options = { concrete: 'cut', slabs: true, bars: true, ties: true };
  function render() {
    if (destroyed || contextLost || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!document.hidden && host.clientWidth && host.clientHeight) renderer.render(scene, camera);
    });
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const oldAspect = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (box && Math.abs(oldAspect - camera.aspect) > 0.1) fit();
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener('change', render);
  function theme() {
    scene.background = new T.Color(
      getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
    );
    render();
  }
  window.addEventListener('espectra:theme-change', theme);
  document.addEventListener('visibilitychange', render);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    onStatus?.(
      'Se perdió el contexto gráfico. Recarga la página para recuperar el visor; los resultados numéricos se conservan.',
    );
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    render();
  });
  function fit() {
    if (!box) return;
    const center = box.getCenter(new T.Vector3()),
      size = box.getSize(new T.Vector3());
    const direction = kind === 'column' ? new T.Vector3(1, 0.42, 1.6) : new T.Vector3(1, 0.7, 1.2);
    direction.normalize();
    const right = new T.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    const tangent = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    let distance = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const v = new T.Vector3(x, y, z).sub(center),
            depth = v.dot(direction);
          distance = Math.max(
            distance,
            depth + Math.abs(v.dot(right)) / (tangent * camera.aspect),
            depth + Math.abs(v.dot(up)) / tangent,
          );
        }
    distance *= 1.12;
    const radius = size.length() / 2;
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    controls.target.copy(center);
    controls.minDistance = Math.max(0.06, radius * 0.12);
    controls.maxDistance = distance * 5;
    controls.update();
    render();
  }
  function turn(angle = Math.PI / 6) {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new T.Vector3(0, 1, 0), angle);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target),
      length = T.MathUtils.clamp(
        offset.length() * factor,
        controls.minDistance,
        controls.maxDistance,
      );
    camera.position.copy(controls.target).add(offset.setLength(length));
    controls.update();
    render();
  }
  canvas.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(e.key))
      e.preventDefault();
    if (e.key === 'ArrowLeft') turn(0.12);
    if (e.key === 'ArrowRight') turn(-0.12);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const offset = camera.position.clone().sub(controls.target),
        spherical = new T.Spherical().setFromVector3(offset);
      spherical.phi = T.MathUtils.clamp(
        spherical.phi + (e.key === 'ArrowUp' ? -0.1 : 0.1),
        0.04,
        Math.PI * 0.92,
      );
      camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(spherical));
      controls.update();
      render();
    }
    if (e.key === '+' || e.key === '=') zoom(0.8);
    if (e.key === '-') zoom(1.25);
    if (e.key === 'Home') fit();
  });
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, at: performance.now(), button: e.button };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (
      kind !== 'building' ||
      !columns ||
      !down ||
      down.button !== 0 ||
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 ||
      performance.now() - down.at > 600
    )
      return;
    const rect = canvas.getBoundingClientRect(),
      pointer = new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      ray = new T.Raycaster();
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(columns, false)[0];
    if (hit && picks[hit.instanceId]) onSelect?.(picks[hit.instanceId]);
  });
  function material(color) {
    return new T.MeshStandardMaterial({
      color,
      roughness: 0.93,
      map: texture,
      bumpMap: texture,
      bumpScale: kind === 'column' ? 0.00025 : 0.001,
    });
  }
  function ground(size) {
    const grid = new T.GridHelper(size, 12, 0x89978d, 0xbac4ba);
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    group.add(grid);
    if (kind === 'column') {
      const m = mesh(
        group,
        new T.PlaneGeometry(size, size),
        new T.ShadowMaterial({ opacity: 0.16 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = -0.003;
      m.castShadow = false;
    }
  }
  function instantiate(entries, mat) {
    const inst = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mat, entries.length),
      dummy = new T.Object3D();
    entries.forEach((e, i) => {
      dummy.position.set(...e.position);
      dummy.scale.set(...e.scale);
      dummy.rotation.set(0, e.rotation || 0, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    return inst;
  }
  function building(p, g) {
    const members = [],
      entries = [],
      floorPanels = [];
    picks = [];
    for (let floor = 1; floor <= p.floors; floor++) {
      const top = floor * p.storyHeight;
      for (const n of g.nodes) {
        entries.push({
          position: [n.x, top - p.storyHeight / 2, -n.y],
          scale: [p.section.b / 1000, p.storyHeight, p.section.h / 1000],
        });
        picks.push({ column: n.id, floor });
      }
      for (const b of g.beams)
        members.push({
          position: [(b.a.x + b.b.x) / 2, top - p.beamH / 2, -(b.a.y + b.b.y) / 2],
          scale: [b.length, p.beamH, p.beamB],
          rotation: Math.abs(b.a.x - b.b.x) < 1e-8 ? Math.PI / 2 : 0,
        });
      for (const panel of g.panels)
        floorPanels.push({
          position: [panel.x + panel.lx / 2, top - p.slabEquivalent / 2, -panel.y - panel.ly / 2],
          scale: [panel.lx, Math.max(0.01, p.slabEquivalent), panel.ly],
        });
    }
    columns = instantiate(entries, material(0xb7b7b0));
    entries.forEach((_, i) =>
      columns.setColorAt(
        i,
        new T.Color(
          picks[i].column === p.selectedColumn && picks[i].floor === p.selectedFloor
            ? 0xd99a35
            : 0xffffff,
        ),
      ),
    );
    columns.instanceColor.needsUpdate = true;
    const selected =
      entries[picks.findIndex((v) => v.column === p.selectedColumn && v.floor === p.selectedFloor)];
    if (selected) {
      const edge = new T.LineSegments(
        new T.EdgesGeometry(new T.BoxGeometry(...selected.scale)),
        new T.LineBasicMaterial({ color: 0xe59d29, depthTest: false }),
      );
      edge.position.set(...selected.position);
      edge.renderOrder = 10;
      group.add(edge);
    }
    instantiate(members, material(0xc7c6be));
    slabs = instantiate(
      floorPanels,
      new T.MeshStandardMaterial({
        color: 0xc3c4bb,
        roughness: 1,
        transparent: true,
        opacity: 0.53,
        depthWrite: false,
      }),
    );
    ground(Math.max(g.width, g.depth) * 2);
    const axes = new T.AxesHelper(3);
    axes.position.set(0, 0.04, 0);
    group.add(axes);
    box = new T.Box3(
      new T.Vector3(0, 0, -g.depth),
      new T.Vector3(g.width, p.floors * p.storyHeight, 0),
    );
    onStatus?.(
      'Arrastra para girar; rueda para acercar; botón derecho para desplazar. Un clic selecciona columna y piso. En móvil: un dedo gira, dos acercan o desplazan.',
    );
    host.dataset.columns = String(entries.length);
    host.dataset.selected = `${p.selectedColumn}:${p.selectedFloor}`;
  }
  function column(p, detail, steel) {
    const s = p.section,
      b = s.b / 1000,
      h = s.h / 1000,
      height = detail.clearLength / 1000,
      db = globalThis.EspectraProject.BARS[s.bar][0] / 1000,
      dt = globalThis.EspectraProject.BARS[s.tie][0] / 1000;
    concrete = mesh(group, new T.BoxGeometry(b, height, h), material(0xbab9b2), 0, height / 2, 0);
    concrete.material.side = T.DoubleSide;
    bars = new T.Group();
    ties = new T.Group();
    group.add(bars, ties);
    const longitudinal = new T.MeshStandardMaterial({
      color: 0x5c6b76,
      roughness: 0.4,
      metalness: 0.67,
    });
    const transverse = new T.MeshStandardMaterial({
      color: 0xb28b54,
      roughness: 0.43,
      metalness: 0.55,
    });
    const ribGeometry = new T.TorusGeometry(db * 0.51, db * 0.065, 4, 12),
      ribSpacing = Math.max(db * 0.8, height / 250),
      ribsCount = Math.floor(height / ribSpacing);
    const ribs = new T.InstancedMesh(ribGeometry, longitudinal, steel.length * ribsCount),
      dummy = new T.Object3D();
    let index = 0;
    for (const bar of steel) {
      rod(
        bars,
        [bar.x / 1000, 0, -bar.y / 1000],
        [bar.x / 1000, height, -bar.y / 1000],
        db,
        longitudinal,
      );
      for (let i = 0; i < ribsCount; i++) {
        dummy.position.set(bar.x / 1000, ((i + 0.5) * height) / ribsCount, -bar.y / 1000);
        dummy.rotation.set(Math.PI / 2, 0, 0.25);
        dummy.updateMatrix();
        ribs.setMatrixAt(index++, dummy.matrix);
      }
    }
    ribs.instanceMatrix.needsUpdate = true;
    bars.add(ribs);
    const xx = b / 2 - s.cover / 1000 - dt / 2,
      zz = h / 2 - s.cover / 1000 - dt / 2;
    for (const level of detail.ties) {
      const y = level / 1000;
      for (const z of [-zz, zz]) rod(ties, [-xx, y, z], [xx, y, z], dt, transverse);
      for (const x of [-xx, xx]) rod(ties, [x, y, -zz], [x, y, zz], dt, transverse);
      for (let i = 1; i < s.legsX - 1; i++) {
        const z = -zz + (2 * zz * i) / (s.legsX - 1);
        rod(ties, [-xx, y, z], [xx, y, z], dt, transverse);
      }
      for (let i = 1; i < s.legsY - 1; i++) {
        const x = -xx + (2 * xx * i) / (s.legsY - 1);
        rod(ties, [x, y, -zz], [x, y, zz], dt, transverse);
      }
    }
    ground(Math.max(b, h) * 4);
    key.shadow.camera.left = key.shadow.camera.bottom = -3;
    key.shadow.camera.right = key.shadow.camera.top = 3;
    key.shadow.camera.far = 70;
    key.target.position.set(0, height / 2, 0);
    scene.add(key.target);
    box = new T.Box3(new T.Vector3(-b / 2, 0, -h / 2), new T.Vector3(b / 2, height, h / 2));
    host.dataset.bars = String(steel.length);
    host.dataset.tieLevels = String(detail.ties.length);
    host.dataset.width = String(s.b);
    host.dataset.depth = String(s.h);
    host.dataset.clearHeight = String(detail.clearLength);
    onStatus?.(
      `${steel.length} barras No. ${s.bar} · ${detail.ties.length} niveles de estribos No. ${s.tie} · tramo libre ${detail.clearLength} mm. Corrugado superficial ilustrativo.`,
    );
  }
  function configure(next = {}) {
    Object.assign(options, next);
    if (slabs) slabs.visible = options.slabs;
    if (bars) bars.visible = options.bars;
    if (ties) ties.visible = options.ties;
    if (concrete) {
      concrete.visible = options.concrete !== 'hidden';
      concrete.material.transparent = options.concrete === 'transparent';
      concrete.material.opacity = options.concrete === 'transparent' ? 0.16 : 1;
      concrete.material.depthWrite = options.concrete !== 'transparent';
      concrete.material.clippingPlanes =
        options.concrete === 'cut' ? [new T.Plane(new T.Vector3(0, 0, -1), 0)] : [];
      concrete.material.needsUpdate = true;
    }
    host.dataset.concrete = options.concrete;
    render();
  }
  function update(p, g, detail, steel) {
    disposeGroup(group);
    columns = null;
    picks = [];
    concrete = null;
    slabs = null;
    bars = null;
    ties = null;
    if (kind === 'building') building(p, g);
    else column(p, detail, steel);
    const shape =
      kind === 'building'
        ? JSON.stringify([p.x, p.y, p.floors, p.storyHeight])
        : JSON.stringify([p.section.b, p.section.h, p.storyHeight, p.beamH]);
    resize();
    configure();
    if (lastShape !== shape) {
      lastShape = shape;
      fit();
    }
    render();
  }
  theme();
  resize();
  return Object.freeze({
    update,
    configure,
    fit,
    turn,
    zoom,
    render,
    dispose() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeGroup(group);
      texture.dispose();
      renderer.dispose();
      window.removeEventListener('espectra:theme-change', theme);
      document.removeEventListener('visibilitychange', render);
      host.replaceChildren();
    },
  });
}

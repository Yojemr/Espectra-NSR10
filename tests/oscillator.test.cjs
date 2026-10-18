const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(reducedMotion = false) {
  const element = () => ({
    attributes: {},
    listeners: {},
    setAttribute(key, value) {
      this.attributes[key] = String(value);
    },
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    removeEventListener(type) {
      delete this.listeners[type];
    },
  });
  const frames = new Map();
  let nextId = 0;
  const document = { ...element(), hidden: false };
  const preference = { ...element(), matches: reducedMotion };
  const context = vm.createContext({
    document,
    window: {
      matchMedia: () => preference,
      requestAnimationFrame(callback) {
        frames.set(++nextId, callback);
        return nextId;
      },
      cancelAnimationFrame(id) {
        frames.delete(id);
      },
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../assets/oscillator.js'), 'utf8'),
    context,
  );
  const elements = Object.fromEntries(
    ['mass', 'leftColumn', 'rightColumn', 'button', 'status'].map((key) => [key, element()]),
  );
  const model = context.EspectraOscillator.create(elements);
  return {
    ...elements,
    model,
    document,
    preference,
    frames,
    x: () => Number(elements.mass.attributes.x),
    tick(time) {
      assert.equal(frames.size, 1, 'Exactly one animation loop must be active');
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback(time);
    },
  };
}
const closeTo = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('Oscillation follows the selected period and elapsed time', () => {
  for (const period of [1, 2]) {
    const f = fixture();
    f.model.setPeriod(period);
    f.tick(0);
    f.tick(period * 250);
    closeTo(f.x(), 53);
    assert.match(f.leftColumn.attributes.d, /M48 77 C48 45 62 47 62 22/);
    assert.match(f.rightColumn.attributes.d, /M125 77 C125 45 139 47 139 22/);
    f.tick(period * 750);
    closeTo(f.x(), 25);
    f.tick(period * 1000);
    closeTo(f.x(), 39);
  }
});

test('Pause, resume and unrelated updates preserve the animation phase', () => {
  const f = fixture();
  f.model.setPeriod(1);
  f.tick(0);
  f.tick(250);
  f.model.setPeriod(1);
  closeTo(f.x(), 53);
  assert.equal(f.frames.size, 1);
  f.button.listeners.click();
  assert.equal(f.frames.size, 0);
  closeTo(f.x(), 53);
  f.button.listeners.click();
  f.tick(5000);
  closeTo(f.x(), 53);
  f.tick(5250);
  closeTo(f.x(), 39);
});

test('Rigid limit is centered and short periods are explicitly slowed', () => {
  const f = fixture();
  f.model.setPeriod(0.1);
  assert.match(f.status.textContent, /ralentizada/);
  f.tick(0);
  f.tick(100);
  closeTo(f.x(), 53);
  f.model.setPeriod(0);
  assert.equal(f.frames.size, 0);
  assert.equal(f.button.disabled, true);
  closeTo(f.x(), 39);
  assert.throws(() => f.model.setPeriod(-1));
  assert.throws(() => f.model.setPeriod(NaN));
});

test('Hidden tabs suspend time and invalid inputs stop motion', () => {
  const f = fixture();
  f.model.setPeriod(1);
  f.tick(0);
  f.tick(250);
  f.document.hidden = true;
  f.document.listeners.visibilitychange();
  assert.equal(f.frames.size, 0);
  f.document.hidden = false;
  f.document.listeners.visibilitychange();
  f.tick(100000);
  closeTo(f.x(), 53);
  f.model.setEnabled(false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.button.disabled, true);
  f.model.setEnabled(true);
  assert.equal(f.frames.size, 1);
  f.model.destroy();
  assert.equal(f.frames.size, 0);
  assert.equal(Object.keys(f.document.listeners).length, 0);
});

test('Reduced motion starts paused and permits explicit playback', () => {
  const f = fixture(true);
  f.model.setPeriod(1);
  assert.equal(f.frames.size, 0);
  assert.match(f.button.textContent, /Reproducir/);
  f.button.listeners.click();
  assert.equal(f.frames.size, 1);
  f.preference.listeners.change({ matches: true });
  assert.equal(f.frames.size, 0);
});

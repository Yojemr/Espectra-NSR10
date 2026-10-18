const test = require('node:test');
const assert = require('node:assert/strict');
const cases = require('../assets/cases.js');
const nsr = require('../assets/engine.js');
const catalog = require('../data/municipios.js');
const example = () => ({
  schema: 'espectra-nsr10',
  version: 1,
  mode: 'city',
  municipality: '05001',
  name: '',
  source: '',
  input: { aa: 0.15, av: 0.2, soil: 'D', group: 'I', higher: false },
  maxPeriod: 6,
  step: 0.01,
  selectedPeriod: 1,
  accelUnit: 'g',
  displUnit: 'm',
});
test('Cases from internal version 0.1 remain compatible', () => {
  const input = example();
  const restored = cases.validate(JSON.parse(JSON.stringify(input)), nsr, catalog);
  assert.deepEqual(restored.input, input.input);
  assert.equal(restored.municipality, '05001');
  assert.equal(restored.selectedPeriod, 1);
});
test('Validate manual inputs without importing unknown properties', () => {
  const input = {
    ...example(),
    mode: 'manual',
    municipality: null,
    name: '  Sitio de control  ',
    source: '  Apéndice A-4  ',
    unexpected: { dangerous: true },
  };
  const restored = cases.validate(input, nsr, catalog);
  assert.equal(restored.name, 'Sitio de control');
  assert.equal(restored.source, 'Apéndice A-4');
  assert.equal(Object.hasOwn(restored, 'unexpected'), false);
});
test('Reject mismatched municipality and invalid case configuration', () => {
  for (const change of [
    { version: 2 },
    { mode: 'unknown' },
    { municipality: '99999' },
    { input: { ...example().input, aa: 0.25 } },
    { step: 0 },
    { step: 0.000001 },
    { maxPeriod: Infinity },
    { maxPeriod: 101 },
    { selectedPeriod: -1 },
    { selectedPeriod: 7 },
    { accelUnit: 'invalid' },
    { displUnit: 'invalid' },
    { mode: 'manual', name: 'Sitio', source: '' },
    { input: { ...example().input, higher: 'true' } },
  ])
    assert.throws(() => cases.validate({ ...example(), ...change }, nsr, catalog));
});
test('Case validation is atomic and never mutates imported data', () => {
  const input = example(),
    before = JSON.stringify(input);
  cases.validate(input, nsr, catalog);
  assert.equal(JSON.stringify(input), before);
});
test('CSV cells preserve text and neutralize spreadsheet formula prefixes', () => {
  assert.equal(cases.csvCell('Texto "citado"'), '"Texto ""citado"""');
  for (const input of ['=1+1', ' +SUM(A1:A2)', '@x', '-1+1', '\t=2', '\n=3'])
    assert.ok(cases.csvCell(input).startsWith('"\''));
  assert.equal(cases.csvCell(0.24), '"0.24"');
});

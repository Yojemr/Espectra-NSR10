(function (root) {
  'use strict';
  const SCHEMA = 'espectra-nsr10';
  const SCHEMA_VERSION = 1;
  const MAX_FILE_BYTES = 50000;
  const MAX_NAME_LENGTH = 100;
  const MAX_SOURCE_LENGTH = 240;

  function validate(data, nsr, catalog) {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.schema !== SCHEMA ||
      data.version !== SCHEMA_VERSION ||
      !['city', 'manual'].includes(data.mode)
    ) {
      throw new Error('El archivo no es un caso válido de Espectra.');
    }
    if (!data.input || typeof data.input.higher !== 'boolean')
      throw new Error('Datos del espectro incompletos.');
    nsr.parameters(data.input);
    if (
      ![0.01, 0.02, 0.05, 0.1].includes(data.step) ||
      !Number.isFinite(data.maxPeriod) ||
      data.maxPeriod < 0.1 ||
      data.maxPeriod > 100 ||
      !Number.isFinite(data.selectedPeriod) ||
      data.selectedPeriod < 0 ||
      data.selectedPeriod > data.maxPeriod
    ) {
      throw new Error('Configuración de períodos inválida.');
    }
    if (!['g', 'ms2'].includes(data.accelUnit) || !['m', 'cm', 'mm'].includes(data.displUnit))
      throw new Error('Unidades del caso inválidas.');
    const item = catalog.records.find((row) => row.code === data.municipality);
    if (data.mode === 'city' && (!item || data.input.aa !== item.aa || data.input.av !== item.av)) {
      throw new Error(
        'Los parámetros no coinciden con el municipio del catálogo. Usa ingreso manual para parámetros de otra fuente.',
      );
    }
    if (
      data.mode === 'manual' &&
      (typeof data.name !== 'string' ||
        typeof data.source !== 'string' ||
        !data.name.trim() ||
        !data.source.trim() ||
        data.name.length > MAX_NAME_LENGTH ||
        data.source.length > MAX_SOURCE_LENGTH)
    ) {
      throw new Error('El sitio y la fuente manual deben ser textos válidos.');
    }
    // Return a known shape; imported properties never become application state.
    return {
      schema: SCHEMA,
      version: SCHEMA_VERSION,
      mode: data.mode,
      municipality: data.mode === 'city' ? item.code : null,
      name: data.mode === 'manual' ? data.name.trim() : '',
      source: data.mode === 'manual' ? data.source.trim() : '',
      input: {
        aa: data.input.aa,
        av: data.input.av,
        soil: data.input.soil,
        group: data.input.group,
        higher: data.input.higher,
      },
      maxPeriod: data.maxPeriod,
      step: data.step,
      selectedPeriod: data.selectedPeriod,
      accelUnit: data.accelUnit,
      displUnit: data.displUnit,
      catalogSha256: catalog.sourceSha256,
    };
  }

  function csvCell(value) {
    let text = String(value);
    if (/^\s*[=+@\-\t\r\n]/u.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  const api = Object.freeze({ SCHEMA, SCHEMA_VERSION, MAX_FILE_BYTES, validate, csvCell });
  root.EspectraCases = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

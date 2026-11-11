'use strict';
importScripts(
  '../data/municipios.js',
  'engine.js',
  'project.js',
  'frame.js',
  'section.js',
  'building.js',
);
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, result: EspectraBuilding.analyze(data.project) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};

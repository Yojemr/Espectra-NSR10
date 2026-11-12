'use strict';
importScripts(
  '../data/municipios.js?v=0.5.1',
  'engine.js?v=0.5.1',
  'project.js?v=0.5.1',
  'frame.js?v=0.5.1',
  'reinforcement.js?v=0.5.1',
  'section.js?v=0.5.1',
  'building.js?v=0.5.1',
);
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, result: EspectraBuilding.analyze(data.project) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};

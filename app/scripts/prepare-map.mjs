import { readFileSync, writeFileSync } from 'node:fs';

// Pinned high-resolution NCR geometry; provenance is in THIRD-PARTY-NOTICES.txt.
const { features } = JSON.parse(readFileSync(new URL('./ncr-boundaries.geojson', import.meta.url), 'utf8'));
const normalize = name => name === 'Quezon City' ? name : name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/^City of /, '').replace(/ City$/, '');
const rings = geometry => {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  throw new Error(`Unsupported boundary geometry: ${geometry.type}`);
};
const points = features.flatMap(f => rings(f.geometry).flat());
const xs = points.map(p => p[0]);
const ys = points.map(p => p[1]);
const minX = Math.min(...xs), maxY = Math.max(...ys);
const longitudeScale = Math.cos((maxY + Math.min(...ys)) / 2 * Math.PI / 180);
const width = (Math.max(...xs) - minX) * longitudeScale;
const height = maxY - Math.min(...ys);
const scale = Math.min(430 / width, 510 / height);
const offsetX = (540 - width * scale) / 2;
const offsetY = (565 - height * scale) / 2;
const paths = features.map(f => ({
  name: normalize(f.properties.adm3_en),
  path: rings(f.geometry).map(ring => ring.map(([x, y], i) =>
    `${i ? 'L' : 'M'}${(offsetX + (x - minX) * longitudeScale * scale).toFixed(2)},${(offsetY + (maxY - y) * scale).toFixed(2)}`
  ).join(' ') + ' Z').join(' '),
}));
if (paths.length !== 17 || new Set(paths.map(p => p.name)).size !== 17) {
  throw new Error('Expected exactly 17 unique Metro Manila LGUs.');
}
writeFileSync(new URL('../packages/frontend/src/lib/metro-map.json', import.meta.url),
  JSON.stringify({ minX, maxY, scale, longitudeScale, offsetX, offsetY, paths }));
console.log(`Prepared ${paths.length} high-resolution city boundaries with ${points.length} source vertices.`);

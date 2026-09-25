import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const destinationsRoot = new URL('../destinations/', import.meta.url);
const positionGrid = 25;

const clean = value => Object.is(value, -0) ? 0 : Number(value.toFixed(3));
const snap = (value, grid) => clean(Math.round(value / grid) * grid);
const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];

function gridOffset(points) {
  if (!points?.length) return [];
  const center = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  center[0] /= points.length;
  center[1] /= points.length;
  return [snap(center[0], positionGrid) - center[0], snap(center[1], positionGrid) - center[1]];
}

const movePath = (points, offset) => (points ?? []).map(([x, z]) => [clean(x + offset[0]), clean(z + offset[1])]);

function generalizeBuilding(building) {
  const points = [...(building.p ?? [])];
  if (points.length > 1 && samePoint(points[0], points.at(-1))) points.pop();
  if (points.length < 3) return null;

  const center = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  center[0] /= points.length;
  center[1] /= points.length;

  const publicCenter = [snap(center[0], positionGrid), snap(center[1], positionGrid)];
  const outline = points.map(([x, z]) => [
    clean(publicCenter[0] + (x - center[0])),
    clean(publicCenter[1] + (z - center[1]))
  ]);
  outline.push([...outline[0]]);
  return {...building, p: outline, geometryBasis: 'generalized_position_25m_grid'};
}

function generalizeRoads(roads, offset) {
  return (roads ?? []).map(road => ({...road, p: movePath(road.p, offset)})).filter(road => road.p.length >= 2);
}

function generalizeTransportRoads(roads, offset) {
  return (roads ?? []).map(road => {
    const move = ([x, z]) => [clean(x + offset[0]), clean(z + offset[1])];
    return {
      ...road,
      paths: (road.paths ?? []).map(path => movePath(path, offset)).filter(path => path.length >= 2),
      anchors: (road.anchors ?? []).map(anchor => ({...anchor, point: move(anchor.point), from: move(anchor.from), to: move(anchor.to)}))
    };
  }).filter(road => road.paths.length);
}

for (const entry of await readdir(destinationsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const destinationDir = join(destinationsRoot.pathname, entry.name);
  const mapPath = join(destinationDir, 'map.json');
  const transportPath = join(destinationDir, 'transport.json');

  const map = JSON.parse(await readFile(mapPath, 'utf8'));
  if (map.geometryNote) {
    console.log(`Skipped ${entry.name}: geometry is already generalized.`);
    continue;
  }
  const roadOffset = gridOffset((map.roads ?? []).flatMap(road => road.p ?? []));
  map.buildings = (map.buildings ?? []).map(generalizeBuilding).filter(Boolean);
  map.roads = generalizeRoads(map.roads, roadOffset);
  map.geometryNote = '建筑与道路为旅游示意几何，中心位置已按 25 米网格概化，不用于测绘或导航。';
  await writeFile(mapPath, JSON.stringify(map));

  const transport = JSON.parse(await readFile(transportPath, 'utf8'));
  transport.roads = generalizeTransportRoads(transport.roads, roadOffset);
  await writeFile(transportPath, JSON.stringify(transport));
}

console.log('Generalized public building and road geometry.');

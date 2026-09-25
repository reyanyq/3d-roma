import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const destinationsRoot = new URL('../destinations/', import.meta.url);
const coordinateStep = 0.0003;

function reduceCoordinate(value) {
  return Number((Math.round(value / coordinateStep) * coordinateStep).toFixed(4));
}

async function updateJson(path, transform, serialize = data => JSON.stringify(data)) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  transform(data);
  await writeFile(path, `${serialize(data)}\n`);
}

function serializePlaces(places) {
  return `[\n${places.map(place => `  ${JSON.stringify(place)}`).join(',\n')}\n]`;
}

for (const entry of await readdir(destinationsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const destinationDir = join(destinationsRoot.pathname, entry.name);

  await updateJson(join(destinationDir, 'places.json'), places => {
    for (const place of places) {
      place.lng = reduceCoordinate(place.lng);
      place.lat = reduceCoordinate(place.lat);
    }
  }, serializePlaces);

  await updateJson(join(destinationDir, 'transport.json'), transport => {
    for (const station of transport.stations ?? []) {
      station.lng = reduceCoordinate(station.lng);
      station.lat = reduceCoordinate(station.lat);
    }
  });
}

console.log('Reduced public place and transport coordinates to a 0.0003° grid.');

import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';

const [sourceRoot, targetRoot] = process.argv.slice(2);
if (!sourceRoot || !targetRoot) {
  console.error('用法：node tools/migrate-summer-palace.mjs <旧项目 work 目录> <新项目目录>');
  process.exit(1);
}

const destinationDir = path.join(targetRoot, 'destinations/summer-palace');
const imageDir = path.join(targetRoot, 'public/images/summer-palace');
await mkdir(destinationDir, {recursive: true});
await mkdir(imageDir, {recursive: true});

const photos = JSON.parse(await readFile(path.join(sourceRoot, 'summer-photos-data.json'), 'utf8'));
for (const [id, photo] of Object.entries(photos)) {
  const match = photo.src.match(/^data:image\/(?:jpeg|jpg);base64,(.+)$/);
  if (!match) throw new Error(`${id} 的照片不是可迁移的 JPEG 数据`);
  await writeFile(path.join(imageDir, `${id}.jpg`), Buffer.from(match[1], 'base64'));
  photo.src = `public/images/summer-palace/${id}.jpg`;
}

await writeFile(path.join(destinationDir, 'photos.json'), `${JSON.stringify(photos, null, 2)}\n`);
await copyFile(path.join(sourceRoot, 'summer-locations.json'), path.join(destinationDir, 'places.json'));
await copyFile(path.join(sourceRoot, 'summer-map/map.json'), path.join(destinationDir, 'map.json'));
await copyFile(path.join(sourceRoot, 'summer-map/transport.json'), path.join(destinationDir, 'transport.json'));
await copyFile(path.join(sourceRoot, 'summer-map/land-triangles.json'), path.join(destinationDir, 'land-triangles.json'));

console.log(`已迁移 ${Object.keys(photos).length} 张照片、景点、地图、交通和精细地形数据。`);

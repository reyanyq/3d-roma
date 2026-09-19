import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg) throw new Error('用法：node tools/migrate-westlake.mjs <旧项目 work> <新项目根目录>');
const source = resolve(sourceArg);
const target = resolve(targetArg);
const imageDir = resolve(target, 'public/images/west-lake');
const destinationDir = resolve(target, 'destinations/west-lake');
await mkdir(imageDir, {recursive: true});
await mkdir(destinationDir, {recursive: true});

const photos = JSON.parse(await readFile(resolve(source, 'photos-data.json'), 'utf8'));
for (const [id, photo] of Object.entries(photos)) {
  const match = /^data:image\/jpeg;base64,(.+)$/.exec(photo.src);
  if (!match) throw new Error(`${id} 不是 JPEG data URL`);
  await writeFile(resolve(imageDir, `${id}.jpg`), Buffer.from(match[1], 'base64'));
  photo.src = `public/images/west-lake/${id}.jpg`;
}
await writeFile(resolve(destinationDir, 'photos.json'), `${JSON.stringify(photos, null, 2)}\n`);
await copyFile(resolve(source, 'map-data.json'), resolve(destinationDir, 'map.json'));
await copyFile(resolve(source, 'transport-data.json'), resolve(destinationDir, 'transport.json'));
await copyFile(resolve(source, 'westlake.jpg'), resolve(imageDir, 'overview.jpg'));
console.log(`已迁移 ${Object.keys(photos).length} 张照片、地图和交通数据。`);

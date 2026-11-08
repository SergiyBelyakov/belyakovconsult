// Збірка демо цифрового двійника (паспорта) громади у папку сайту:
//   node community-twin/build.mjs   → site/cases/community-twin/ (+ /en/)
// Спершу оновлюється зріз даних із модулів транспорту і рельєфу (snapshot.mjs), потім спільна збірка
// shared/build-demo.mjs за записом у shared/demos.json.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(HERE, 'snapshot.mjs')], { stdio: 'inherit' });
await buildDemo(MANIFEST.demos.find(d => d.slug === 'community-twin'));

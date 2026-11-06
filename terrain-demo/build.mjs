// Збірка демо 3D-рельєфу громади у папку сайту:
//   node terrain-demo/build.mjs   → site/cases/community-terrain/ (+ /en/)
// Збірка спільна для всіх демо: shared/build-demo.mjs; назви, описи, мови й файли беруться з shared/demos.json.
// three.js береться з site/data-journey/assets/vendor (та сама версія, що в «Шляху даних»).
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'community-terrain'));

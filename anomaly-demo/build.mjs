// Збірка демо виявлення аномалій у папку сайту:
//   node anomaly-demo/build.mjs   → site/cases/anomaly-detection/ (+ /en/)
// Збірка спільна для всіх демо: shared/build-demo.mjs; назви, описи, мови й файли беруться з shared/demos.json.
// three.js береться з site/data-journey/assets/vendor (та сама версія, що в «Шляху даних» і демо рельєфу).
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'anomaly-detection'));

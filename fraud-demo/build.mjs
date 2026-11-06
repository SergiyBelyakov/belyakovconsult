// Збірка демо фрод-аналітики у папку сайту:
//   node fraud-demo/build.mjs   → site/cases/fraud-analytics/ (+ /en/)
// Збірка спільна для всіх демо: shared/build-demo.mjs; назви, описи, мови й файли беруться з shared/demos.json.
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'fraud-analytics'));

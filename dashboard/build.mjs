// Збірка демо дашборду якості даних у папку сайту:
//   node dashboard/build.mjs   → site/cases/data-quality-dashboard/ (+ /en/, /pt/)
// Збірка спільна для всіх демо: shared/build-demo.mjs; назви, описи, мови й файли беруться з shared/demos.json.
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'data-quality-dashboard'));

// Збірка демо панелі керівника у папку сайту:
//   node exec-demo/build.mjs   → site/cases/executive-dashboard/ (+ /en/)
// Збірка спільна для всіх демо: shared/build-demo.mjs; назви, описи, мови й файли беруться з shared/demos.json.
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'executive-dashboard'));

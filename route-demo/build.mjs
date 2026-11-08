// Збірка демо планування маршрутів у папку сайту:
//   node route-demo/build.mjs   → site/cases/route-planning/ (+ /en/)
// Збірка спільна для всіх демо: shared/build-demo.mjs; назви, описи, мови й файли беруться з shared/demos.json.
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'route-planning'));

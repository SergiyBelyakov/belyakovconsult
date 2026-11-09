import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';
await buildDemo(MANIFEST.demos.find(d => d.slug === 'scooter-cat'));

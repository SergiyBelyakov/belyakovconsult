// Збірка демо моніторингу й оцінки програм через спільну збірку Лабораторії (shared/build-demo.mjs).
import { buildDemo, MANIFEST } from '../shared/build-demo.mjs';

await buildDemo(MANIFEST.demos.find(d => d.slug === 'monitoring-evaluation'));

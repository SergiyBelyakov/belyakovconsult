# WebGL lighting update · 2026-10-22

The Ukrainian and English data journeys now share `site/data-journey/studio-lighting.js`.

- Dark studio environment with narrow softboxes replaces the white RoomEnvironment.
- Reinhard tone mapping, exposure 0.85; lower direct lighting and environment reflections.
- Ruby core emission 1.25; ruby glass emission 0.16. Glass transmission and model geometry remain intact.
- Ruby-only HDR bloom now has a higher threshold, bounded extraction and lower strength.
- Devices without floating-point render targets render directly with tone mapping; no clipped 8-bit HDR intermediate.
- Entry HTML and dynamic scripts use the revision ruby-neon-fullscreen-20261022 to refresh cached code.

## Publication

Publish the complete contents of `site/` to the existing static website. Include both data-journey entry pages, bootstrap.mjs and the new studio-lighting.js together. Source generators remain in dev-assets. No production deployment was performed for this archive rebuild.

## Validation limits

Both language pages loaded successfully in the QA browser. All 50 GLBs loaded with the bundled GLTFLoader; calibration was checked across 249 mesh materials including 50 ruby cores. HDR and non-HDR control flow was checked with a renderer double. Six edited scripts passed syntax checks.

WebGL2 is unavailable in the QA browser. GPU shader compilation and the final GPU appearance have NOT been visually verified. Canvas previews are not evidence of live WebGL appearance. Compare the live architecture, BI and quality components after publication on a WebGL2 device; identical pixels to the separately ray-traced thumbnails are not guaranteed.

## Final additions

Ruby glass and its inner core emit red light. Bounded bloom threshold 0.48, cap 1.05, strength 0.38. Dark studio lighting and exposure 0.85 retained.

All 42 pages with contact footers now use the matching UA/EN/PT home footer including the original Formspree action, telephone and social links. The journey uses a scoped copy of home styles so the scene layout stays isolated. The 404 page remains a dedicated error page.

The scene has a Full screen / На весь екран toggle, native Fullscreen API where supported and a viewport fallback. Stage navigation remains in the expanded scene. Exiting preserves the selected stage. Browser QA verified viewport expansion, stage navigation and exit; native fullscreen and GPU rendering were unavailable.

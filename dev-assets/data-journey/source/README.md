# Rebuild icon meshes and previews

Run commands from the project root. The default output is `site/data-journey/`. An optional `BC_JOURNEY_ROOT` environment variable selects a different destination.

Install the packages with `python3 -m pip install -r dev-assets/data-journey/source/requirements.txt`.

Run `python3 dev-assets/data-journey/source/build_ruby_iron.py` to regenerate 50 GLBs. Use `--only 1 2 4` for selected IDs. The compatibility entry points `build_glass.py` and `build_metal_neon.py` invoke this same current generator.

Run `python3 dev-assets/data-journey/source/render_glass.py --force --samples 256` to ray trace the actual GLBs. The optional `--only`, `--width` and `--height` arguments restrict output. Finish with `python3 dev-assets/data-journey/source/refresh_catalog.py` to refresh hashes, the browser registry and `components.webp`.

The existing homepage illustration `services.webp` is retained independently of the model contact sheet. Its animation is defined in `site/journey-preview.css` and `site/journey-preview.js`.

The GLBs use non-emissive iron, transmissive clear and ruby glass, and independent ruby emitters enclosed in accent components. All models contain actual depth and two animation clips. They contain no raster planes or textures. The archived reference.glb is source material and is not used by the website.

These tools and the reference are outside `site/` and are not needed at runtime. Keep that separation when deploying.

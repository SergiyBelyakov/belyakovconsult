# Metal, glass and red neon models

The website contains all 50 ready-to-use GLBs and their rendered WebP previews. No Python dependencies are needed to run it.

For rebuilding, install `python3 -m pip install -r source/requirements.txt` from the data-journey directory. Run `python3 source/build_metal_neon.py` to regenerate all models; `build_glass.py` forwards to the same generator for compatibility. Use `--only 1 2 3` for selected model IDs. A partial rebuild keeps the current catalog intact.

Run `python3 source/render_glass.py --force --samples 256` to regenerate mesh-based previews. Omit `--force` to keep existing previews. This CPU ray-tracing step can take several minutes. Optional `--only`, `--width`, and `--height` select models and resolution.

Run `python3 source/refresh_catalog.py` to refresh model hashes, preview dimensions, the JS registry and the homepage montage.

Materials are defined in build_metal_neon.py. Satin and polished metal are non-emissive. Clear glass, ruby glass and neon glass edges use glTF transmission, volume and IOR; the neon edges use KHR_materials_emissive_strength. No external textures or raster icon planes are used in GLBs. The original reference.glb is retained as design source, not as an active website model.

The browser loads GLBs on demand. Without WebGL 2 it shows the supplied renders. Moving data packets are white spheres with a red accent in both rendering modes.

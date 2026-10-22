/* Shared WebGL lighting profile for both languages. Linear-light studio panels,
 * dark surroundings, bounded ruby emission; independent of Canvas previews. */
'use strict';
window.BCStudioLighting = {
  revision: 'ruby-neon-fullscreen-20261022',
  configureRenderer(renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Reinhard avoids the ACES colour-mixing matrix shifting saturated ruby highlights.
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = .85;
  },
  install(renderer, scene) {
    const T = THREE, studio = new T.Scene();
    studio.background = new T.Color().setRGB(.025, .025, .03);
    const geometry = new T.PlaneGeometry(1, 1);
    const materials = [];
    function panel(position, width, height, radiance) {
      const material = new T.MeshBasicMaterial({
        color: new T.Color().setRGB(...radiance), side:T.DoubleSide, toneMapped:false
      });
      materials.push(material);
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(...position); mesh.scale.set(width, height, 1);
      mesh.lookAt(0, 0, 0); studio.add(mesh);
    }
    // Narrow softboxes create readable bevels without filling every metal face white.
    panel([-4, 5, 3], 2.6, 5, [4, 4, 4]);
    panel([4, 2, 4], 2, 6, [3.4, 3.4, 3.4]);
    panel([-5, 3, -3], 1.3, 3, [4, 4, 4]);
    panel([5, 2, -3], 1, 2.8, [1.2, .006, .025]);
    panel([0, 5, -1], 4, 2, [3, 3, 3]);
    panel([0, 2, 12], 12, 8, [.35, .35, .35]);
    const generator = new T.PMREMGenerator(renderer);
    const environment = generator.fromScene(studio, .02, .1, 100);
    scene.environment = environment.texture;
    scene.environmentIntensity = .65;
    scene.background = new T.Color(0x05070a);
    generator.dispose(); geometry.dispose(); materials.forEach(m => m.dispose());
    const ambient = new T.HemisphereLight(0xe2e5eb, 0x080308, .10);
    const key = new T.DirectionalLight(0xffffff, .65);
    key.position.set(-6, 8, 10);
    const rim = new T.DirectionalLight(0xe5e8ee, .25);
    rim.position.set(7, 2, -7);
    scene.add(ambient, key, rim);
    // Keep the render target alive for the lifetime of its environment texture.
    return () => { scene.environment = null; environment.dispose(); };
  },
  calibrateMaterial(original) {
    const material = original.clone();
    material.envMapIntensity = .8;
    material.toneMapped = true;
    if ((material.name || '').includes('internal ruby')) {
      material.emissive.setRGB(1, .001, .012);
      material.emissiveIntensity = 1.25;
      material.color.setRGB(.32, .001, .008);
    }
    if ((material.name || '').includes('ruby') && material.transmission > 0) {
      material.emissive.setRGB(1, .002, .025);
      material.emissiveIntensity = .16;
    }
    material.needsUpdate = true;
    return material;
  }
};

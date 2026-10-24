/* Shared WebGL lighting profile for both languages. Linear-light studio panels,
 * dark surroundings, bounded ruby emission; independent of Canvas previews. */
'use strict';
window.BCStudioLighting = {
  revision: 'balanced-ruby-lighting-20261024',
  baseExposure: 1.28,
  currentLevel: 1.35,
  _lighting: new WeakMap(),
  setBrightness(level, renderer, scene) {
    const value = Math.min(2.2, Math.max(.55, Number(level) || 1.35));
    this.currentLevel=value;
    if (renderer && !renderer.isCPU) renderer.toneMappingExposure=this.baseExposure * value / 1.35;
    const lights=scene && this._lighting.get(scene);
    if (lights) {
      lights.ambient.intensity=.33 * value / 1.35;
      lights.key.intensity=1.3 * value / 1.35;
      lights.rim.intensity=.65 * value / 1.35;
      lights.fill.intensity=.7 * value / 1.35;
      scene.environmentIntensity=.93 * value / 1.35;
    }
    document.dispatchEvent(new CustomEvent('bc-lighting-updated',{detail:{value}}));
  },
  configureRenderer(renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Reinhard avoids the ACES colour-mixing matrix shifting saturated ruby highlights.
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = this.baseExposure;
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
    scene.environmentIntensity = .93;
    scene.background = new T.Color(0x05070a);
    generator.dispose(); geometry.dispose(); materials.forEach(m => m.dispose());
    const ambient = new T.HemisphereLight(0xf4f6f8, 0x161923, .33);
    const key = new T.DirectionalLight(0xffffff, 1.3);
    key.position.set(-6, 8, 10);
    const rim = new T.DirectionalLight(0xe5e8ee, .65);
    rim.position.set(7, 2, -7);
    const fill = new T.DirectionalLight(0xf1f4ff, .7);
    fill.position.set(2, 3, 9);
    scene.add(ambient, key, rim, fill);
    this._lighting.set(scene,{ambient,key,rim,fill});
    this.setBrightness(this.currentLevel,renderer,scene);
    // Keep the render target alive for the lifetime of its environment texture.
    return () => { scene.environment = null; environment.dispose(); };
  },
  calibrateMaterial(original) {
    const material = original.clone();
    material.envMapIntensity = 1.05;
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

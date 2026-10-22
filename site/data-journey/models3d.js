'use strict';
/* Real volumetric GLB meshes. Preview images are used only without WebGL2. */
window.BCModels = (() => {
  const T = THREE;
  const kindMap = {
    database:11, registry:30, warehouse:33, lakehouse:34, model:32,
    pipeline:12, etl:13, api:14, connectors:36, sync:35, document:16,
    files:16, spreadsheet:16, target:21, strategy:25, roadmap:26,
    quality:4, governance:3, security:20, compliance:19, team:22,
    user:38, dashboard:9, management:6, monitor:24, analysis:50,
    finance:5, kpi:10, forecast:41, segmentation:43, geo:7, map:18,
    industry:8, health:47, social:46, report:15, alert:40, audit:39,
    automation:23, metadata:31, clock:26
  };
  const nodeMap = {
    'svc-architecture':49, 'svc-bi':1, 'svc-strategy':21, 'svc-quality':4,
    'svc-governance':3, 'svc-analysis':50, 'svc-finance':5,
    'svc-management':6, 'svc-geo':7, mdm:29, catalog:31, network:45,
    coverage:18, process:17, budget:27, risk:28, financial:5, owner:38,
    lineage:32, access:37, alert:40, benchmark:42, feedback:35,
    programsource:15, socialsource:46, healthsource:47
  };
  const models = new Map(), previews = new Map();
  let cpu = false, readyCount = 0;

  function assetFor(id, kind) {
    const number = nodeMap[id] || kindMap[kind] || 11;
    const asset = BCGlass[number];
    return {name:asset.file, src:asset.preview, width:asset.width,
      height:asset.height, model:asset, id:number};
  }

  function preview(asset) {
    if (previews.has(asset.id)) return previews.get(asset.id);
    const img = new Image(), entry = {img, loaded:false};
    previews.set(asset.id, entry);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(img,0,0);
      context.globalCompositeOperation = 'destination-in';
      const horizontal = context.createLinearGradient(0,0,canvas.width,0);
      horizontal.addColorStop(0,'transparent');
      horizontal.addColorStop(.07,'white');
      horizontal.addColorStop(.93,'white');
      horizontal.addColorStop(1,'transparent');
      context.fillStyle = horizontal; context.fillRect(0,0,canvas.width,canvas.height);
      const vertical = context.createLinearGradient(0,0,0,canvas.height);
      vertical.addColorStop(0,'transparent'); vertical.addColorStop(.04,'white');
      vertical.addColorStop(.88,'white'); vertical.addColorStop(1,'transparent');
      context.fillStyle = vertical; context.fillRect(0,0,canvas.width,canvas.height);
      entry.img = canvas;
      entry.loaded = true;
      document.dispatchEvent(new Event('bc-art-ready'));
    };
    img.src = asset.src;
    return entry;
  }

  function load(asset) {
    if (!models.has(asset.id)) {
      const promise = new BCGLTFLoader().loadAsync(asset.model.url)
        .catch(error => {models.delete(asset.id); throw error;});
      models.set(asset.id, promise);
    }
    return models.get(asset.id);
  }

  // GLB files own the material palette, including their enclosed light sources.
  function calibrateMaterial(original){
    if(!original) return original;
    const material=original.clone();
    material.envMapIntensity=1.1;
    if((material.name||'').includes('internal ruby')) material.toneMapped=false;
    material.needsUpdate=true;
    return material;
  }

  function create(kind, id) {
    const asset = assetFor(id, kind), group = new T.Group();
    Object.assign(group.userData, {
      kind, glassAsset:asset, artworkHeight:2.15,
      previewEntry:preview(asset),
      previewSize:{width:id?.startsWith('svc-')?3.3:2.8,
        height:id?.startsWith('svc-')?2.475:2.1}
    });
    if (!cpu) {
      load(asset).then(gltf => {
        const model = gltf.scene.clone(true);
        const bounds = new T.Box3().setFromObject(model);
        const size = bounds.getSize(new T.Vector3());
        const center = bounds.getCenter(new T.Vector3());
        const width = id?.startsWith('svc-') ? 3.3 : 2.8;
        const scale = Math.min(width / size.x, 2.15 / size.y,
          2.0 / Math.max(size.z, .01));
        model.position.sub(center);
        model.traverse(object => {object.userData.nodeId = id;if(object.isMesh){object.material=Array.isArray(object.material)?object.material.map(calibrateMaterial):calibrateMaterial(object.material);object.castShadow=false;object.receiveShadow=false;}});
        const fit = new T.Group();
        fit.add(model); fit.scale.setScalar(scale); group.add(fit);
        group.userData.modelReady = true;
        document.getElementById('visual')?.setAttribute('data-models-ready', String(++readyCount));
        document.dispatchEvent(new Event('bc-art-ready'));
      }).catch(error => {
        group.userData.modelFailed = true;
        console.warn('GLB load failed:', asset.name, error.message);
        document.dispatchEvent(new Event('bc-model-error'));
      });
    }
    return group;
  }

  return {create, assetFor, kindMap, nodeMap,
    configure(options){cpu = !!options.cpu;}};
})();

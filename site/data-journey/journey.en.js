'use strict';
(()=>{
const D=window.BCData,T=window.THREE,$=s=>document.getElementById(s);if(!D||!T)return;
Object.entries(D.nodes).forEach(([id,n])=>{n.id=id});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,mobile=()=>innerWidth<=1000;
let stage=-1,profile='enterprise',paused=reduced,tracing=false,errorCase=false,auto=false,tourTimer,overview=false,focusId=null,selectedId=null,spin=0,spinTarget=0,pitch=0,pitchTarget=0,zoom=1,autoSpin=false,ready=false,lastNow=0,time=0,needResize=true,dirty=true,visible=true;
let bloom,renderer,scene,camera,root,orbit,orbitControl,highlight,edges=[],visibleNodes=[],labels=[],mapLabels=[];const cache=new Map(),mouse={x:0,y:0},smoothMouse={x:0,y:0};
const serviceName=id=>D.services.find(s=>s[0]===id)?.[1]||'System component';
function renderStory(){
 $('story').innerHTML=D.scenes.map((s,i)=>{
 const intro=i===0;const p=intro?`<div class="profiles"><span>CHOOSE AN EXAMPLE RECORD</span><div class="profile-options">${Object.entries(D.profiles).map(([k,p])=>`<button data-profile="${k}" aria-pressed="${k===profile}">${p.name}</button>`).join('')}</div></div><a href="#strategy" class="primary">Explore the complete journey </a><div class="scope"><span>13 STAGES</span><span>9 SERVICES</span><span>78 COMPONENTS</span></div><div class="directions">${D.services.map(s=>`<a href="#${s[0]==='geo'?'geospatial':s[0]}">${s[1]}</a>`).join(' · ')}</div>`:`<div class="result"><small>STAGE OUTCOME</small><p>${s.result}</p></div><a href="../${D.services.find(x=>x[0]===s.service)[2]}/" class="service-link">${serviceName(s.service)} </a>${s.id==='quality'?'<button class="error-button" id="errorToggle" aria-pressed="false">Trace a rejected record</button>':''}${s.id==='operations'?'<a class="primary final-cta" href="../#contact">Discuss your data system </a>':''}`;
 return `<section id="${s.id}" data-step="${i}" class="chapter ${intro?'intro':''}"><div class="eyebrow">${intro?'':String(i).padStart(2,'0')+' / '}${s.tag}</div><${intro?'h1':'h2'}>${s.title}</${intro?'h1':'h2'}><p>${s.text}</p>${p}</section>`;
 }).join('');
 $('rail').innerHTML=D.scenes.map((s,i)=>`<a href="#${s.id}" aria-label="${s.tag}"><span>${String(i).padStart(2,'0')}</span></a>`).join('');
 document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{profile=b.dataset.profile;document.querySelectorAll('[data-profile]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));tracing=true;updateTrace();if(ready)buildScene();dirty=true;});
 $('errorToggle').onclick=()=>{errorCase=!errorCase;$('errorToggle').setAttribute('aria-pressed',String(errorCase));$('errorToggle').textContent=errorCase?'Show the validated record':'Trace a rejected record';tracing=true;updateTrace();dirty=true;};
 $('catalogService').innerHTML='<option value="all">All services</option>'+D.services.map(s=>`<option value="${s[0]}">${s[1]}</option>`).join('');
}
function chapterList(){return [...document.querySelectorAll('.chapter')]}
function stopTour(){auto=false;clearTimeout(tourTimer);$('tour').textContent='Guided tour';$('tour').setAttribute('aria-pressed','false')}
function goTo(i){stopTour();if(overview)toggleMap(false);i=Math.max(0,Math.min(D.scenes.length-1,i));chapterList()[i].scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});}
function onScroll(){if(overview)return;const anchor=innerHeight*(mobile()?.69:.48);let i=0;chapterList().forEach((e,n)=>{if(e.getBoundingClientRect().top<=anchor)i=n});if(i!==stage){stage=i;closeDetail();applyStage();}const p=scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);$('progress').style.width=Math.min(100,p*100)+'%';}
function applyStage(){const s=D.scenes[Math.max(0,stage)];$('sceneTitle').textContent=overview?'SYSTEM MAP':focusId?'SYSTEM COMPONENT':s.tag;$('visual').dataset.stage=s.id;$('visual').dataset.view=overview?'map':focusId?'model':'journey';$('sceneIndex').textContent=overview?'SELECT A COMPONENT':String(Math.max(0,stage)).padStart(2,'0')+' / 13';$('stageCounter').textContent=String(Math.max(0,stage)).padStart(2,'0')+' / 13';$('sceneComment').textContent=overview?'From sources to users. The upper layer sets rules across the system. This is a conceptual map; the components depend on the business need.':s.comment;document.querySelectorAll('.rail a').forEach((a,i)=>{a.classList.toggle('active',i===stage);if(i===stage)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')});$('prevStage').disabled=stage<=0;$('nextStage').disabled=stage>=D.scenes.length-1;updateTrace();if(ready)buildScene();}
function updateTrace(){const p=D.profiles[profile],i=Math.max(0,stage);$('trace').hidden=!tracing;$('traceToggle').setAttribute('aria-pressed',String(tracing));$('recordId').textContent=p.id;$('recordTitle').textContent=p.title;$('recordNote').textContent=errorCase&&i===4?'Example error: entity key not found. Assign the exception for correction, then validate it again.':D.traceNotes[i];const lines=[`Source: ${p.source}`,p.fields];
 if(i===1)lines.splice(0,lines.length,'Question: '+p.goal);
 if(i===3)lines.push('Batch: B-017','Ingestion time: 10:00');
 if(i===4)lines.push(errorCase?'Status: correction → validation':'Status: validated');
 if(i===5)lines.push('Keys and history: agreed');
 if(i===6)lines.splice(0,lines.length,'Owner: assigned to the dataset','Access: role-based','Methodology: agreed');
 if(i===7||i===8)lines.push('Measure: '+p.metric);
 if(i===9)lines.splice(0,lines.length,profile==='enterprise'?'12 000 − 9 600 = 2 400 UAH\n2 400 / 12 000 = 20%':'Financial context is added\nwhen the relevant data is available');
 if(i===10)lines.splice(0,lines.length,'Action: '+p.action,'Accountable person: to be agreed');
 if(i===11)lines.splice(0,lines.length,'Territorial context: when needed','Address quality: being checked');
 if(i===12)lines.splice(0,lines.length,'Recipient: '+p.user,'Detail: subject to permissions');
 if(i===13)lines.splice(0,lines.length,'New data: expected','Comparison: before / after','Outcome: requires measurement');
 $('recordFields').textContent=lines.join('\n');}
function openNode(id,forceFocus=false){const n=D.nodes[id];if(!n)return;stopTour();selectedId=id;$('detailTitle').textContent=n.label;$('detailService').textContent=serviceName(n.service).toUpperCase();$('detailAbout').textContent=n.about;$('detailInput').textContent=n.input;$('detailOutput').textContent=n.output;const svc=D.services.find(s=>s[0]===n.service);$('detailLink').href='../'+(svc?svc[2]+'/':'');$('detail').hidden=false;document.body.classList.add('detail-open');needResize=true;if(forceFocus||!visibleNodes.some(g=>g.userData.id===id))focusId=id;$('focusNode').textContent=focusId?'Return to the scene':'Inspect component';$('rotateNode').hidden=!focusId;$('rotateNode').disabled=!!renderer?.isCPU;updateInspectControls();if(ready)buildScene();dirty=true;}
function closeDetail(){selectedId=null;focusId=null;spin=spinTarget=pitch=pitchTarget=0;zoom=1;autoSpin=false;updateInspectControls();$('detail').hidden=true;document.body.classList.remove('detail-open');needResize=true;dirty=true;}
function renderCatalog(){const q=$('catalogSearch').value.trim().toLocaleLowerCase('en'),svc=$('catalogService').value;const entries=Object.values(D.nodes).filter(n=>(svc==='all'||n.service===svc)&&(!q||(n.label+' '+n.about+' '+serviceName(n.service)).toLocaleLowerCase('en').includes(q)));const count=entries.length,last=count%10,teen=count%100;$('catalogCount').textContent=count+' '+(count===1?'component':'components');$('catalogList').innerHTML=entries.map(n=>`<button class="catalog-item" data-component="${n.id}"><img src="${BCModels.assetFor(n.id,n.icon).src}" alt="" loading="lazy" decoding="async" width="140" height="100"><strong>${n.label}</strong><span>${serviceName(n.service)}</span><p>${n.about}</p></button>`).join('')||'<p class="empty">No components match your search.</p>';document.querySelectorAll('[data-component]').forEach(b=>b.onclick=()=>{$('catalog').close();openNode(b.dataset.component,true)});}
function openCatalog(){stopTour();renderCatalog();$('catalog').showModal();$('catalogSearch').focus()}
document.querySelectorAll('[data-journey-lang]').forEach(a=>a.addEventListener('click',()=>{a.href=a.dataset.journeyLang+'#'+D.scenes[Math.max(0,stage)].id}));
$('openCatalog').onclick=$('catalogFooter').onclick=openCatalog;$('closeCatalog').onclick=()=>$('catalog').close();$('catalogSearch').oninput=renderCatalog;$('catalogService').onchange=renderCatalog;$('catalog').addEventListener('click',e=>{if(e.target===$('catalog')){const r=$('catalog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('catalog').close()}});
$('closeDetail').onclick=()=>{closeDetail();buildScene()};$('focusNode').onclick=()=>{focusId=focusId?null:selectedId;$('focusNode').textContent=focusId?'Return to the scene':'Inspect component';$('rotateNode').hidden=!focusId;$('rotateNode').disabled=!!renderer?.isCPU;updateInspectControls();buildScene()};
$('rotateNode').onclick=()=>{orbitControl?.rotate(-Math.PI/2/.007,0);dirty=true};
function updateInspectControls(){
 const panel=$('inspectControls');if(!panel)return;
 panel.hidden=false;
 for(const id of ['zoomIn','zoomOut'])$(id).disabled=false;
 $('autoSpin').disabled=!!renderer?.isCPU;
 $('autoSpin').setAttribute('aria-pressed',String(!!orbitControl?.autoRotate));
}
$('zoomIn').onclick=()=>orbitControl?.zoomStep(-1);
$('zoomOut').onclick=()=>orbitControl?.zoomStep(1);
$('autoSpin').onclick=()=>{orbitControl?.toggleAuto();updateInspectControls();};

$('traceToggle').onclick=()=>{tracing=!tracing;updateTrace();dirty=true};$('closeTrace').onclick=()=>{tracing=false;updateTrace();dirty=true};document.querySelectorAll('[data-open-node]').forEach(b=>b.onclick=()=>openNode(b.dataset.openNode));
$('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'Resume motion':'Pause motion');$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'Resume motion':'Pause motion');dirty=true};
$('reset').onclick=()=>{orbitControl?.reset();mouse.x=mouse.y=0;smoothMouse.x=smoothMouse.y=0;dirty=true};$('prevStage').onclick=()=>goTo(stage-1);$('nextStage').onclick=()=>goTo(stage+1);
$('tour').onclick=()=>{if(auto){stopTour();return}if(overview)toggleMap(false);closeDetail();buildScene();auto=true;$('tour').textContent='Stop ■';$('tour').setAttribute('aria-pressed','true');let i=Math.max(0,stage);function next(){if(!auto)return;if(i>=D.scenes.length-1){stopTour();return}i++;chapterList()[i].scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});tourTimer=setTimeout(next,9500)}next()};
addEventListener('wheel',()=>{if(auto)stopTour()},{passive:true});addEventListener('touchstart',()=>{if(auto)stopTour()},{passive:true});addEventListener('keydown',e=>{if(e.key==='Escape'){if(overview)toggleMap(false);else if(selectedId){closeDetail();buildScene()}stopTour()}if(auto&&['ArrowDown','ArrowUp','PageDown','PageUp'].includes(e.key))stopTour()});
const mapColumns=[['SOURCES',['erp','files','registry','geosource']],['INTEGRATION',['connectors','sync','etl','raw']],['QUALITY',['dq','quarantine','mdm']],['ARCHITECTURE',['curated','warehouse','lakehouse','marts']],['ANALYTICS',['analysis','financial','management','geo']],['PUBLICATION',['semantic','dashboard','report']],['USERS',['executive','opsuser','analyst','app']]];
const mapSpec={ids:[],positions:[],links:[]};mapColumns.forEach(([name,ids],col)=>ids.forEach((id,row)=>{mapSpec.ids.push(id);mapSpec.positions.push([(col-3)*4.35,(ids.length-1)*1.25-row*2.5,0])}));mapSpec.ids.push('owner','access','monitor');mapSpec.positions.push([-5,6.35,0],[0,6.35,0],[5,6.35,0]);
function mi(id){return mapSpec.ids.indexOf(id)}function ml(a,b,kind){mapSpec.links.push([mi(a),mi(b),kind])}
['erp','files','registry','geosource'].forEach(a=>ml(a,'connectors'));ml('connectors','sync');ml('sync','etl');ml('etl','raw');ml('raw','dq');ml('mdm','dq','control');ml('dq','curated','valid');ml('dq','quarantine','error');ml('quarantine','dq','return');ml('curated','warehouse');ml('curated','lakehouse','option');ml('lakehouse','marts','option');ml('warehouse','marts');['analysis','financial','management','geo'].forEach(a=>{ml('marts',a);ml(a,'semantic')});ml('semantic','dashboard');ml('semantic','report');['executive','opsuser','analyst'].forEach(a=>ml('dashboard',a));ml('report','app');['owner','access','monitor'].forEach(a=>ml(a,'warehouse','control'));
function toggleMap(value){stopTour();overview=value;closeDetail();document.body.classList.toggle('map-open',overview);$('closeMap').hidden=!overview;needResize=true;applyStage();if(!overview)$('openMap').focus()}
$('openMap').onclick=()=>toggleMap(true);$('closeMap').onclick=()=>toggleMap(false);
function ensureNode(id){if(cache.has(id))return cache.get(id);const n=D.nodes[id],g=BCModels.create(n.icon,id);g.userData.id=id;g.userData.target=new T.Vector3();g.userData.targetScale=.76;g.userData.lastActive=false;g.position.set(0,0,0);g.scale.setScalar(.001);g.traverse(o=>{o.userData.nodeId=id});root.add(g);const bounds=new T.Box3().setFromObject(g);g.userData.labelHeight=g.userData.artworkHeight/2+.17;const el=document.createElement('button');el.className='label';el.textContent=n.label;el.setAttribute('aria-label',n.label+', details');el.onclick=()=>openNode(id);el.hidden=true;$('labels').appendChild(el);g.userData.label=el;cache.set(id,g);return g;}
function dataPacket(radius=.05){
 const packet=new T.Mesh(new T.SphereGeometry(radius,12,8),new T.MeshBasicMaterial({color:0xffffff}));
 packet.userData.dataPacket=true;
 const ring=new T.Mesh(new T.TorusGeometry(radius*.97,radius*.12,6,20),new T.MeshBasicMaterial({color:0xff1238,toneMapped:false}));
 ring.position.z=radius*.2;packet.add(ring);
 return packet;
}
function edgeColor(kind){return kind==='error'||kind==='return'?0xd90429:kind==='valid'?0xdde8f2:kind==='control'?0x64748b:0xa8b0bc}
function clearEdges(){for(const e of edges){root.remove(e.line,e.arrow,...e.beads);[e.line,e.arrow,...e.beads].forEach(o=>o.traverse(part=>{part.geometry?.dispose();part.material?.dispose()}))}edges=[]}
function buildScene(){if(!ready)return;clearEdges();mapLabels.forEach(e=>e.el.remove());mapLabels=[];const s=D.scenes[Math.max(0,stage)];let ids=overview?mapSpec.ids:s.ids,positions=overview?mapSpec.positions:D.layouts[s.id],links=overview?mapSpec.links:s.links;if(innerWidth<=520&&s.id==='intro'&&!overview){ids=['svc-architecture','svc-quality','svc-bi'];positions=[[0,1.7,.1],[-4.1,1.8,-.35],[4.1,1.8,-.35]];links=[[1,0],[0,2]]}if(s.id==='sources'||overview){ids=ids.slice();const at=ids.indexOf('registry'),replacement={social:'socialsource',health:'healthsource',programs:'programsource'}[profile];if(at>=0&&replacement)ids[at]=replacement}if(focusId){ids=[focusId];positions=[[0,.9,0]];links=[]}
 cache.forEach(g=>{g.visible=false;g.userData.label.hidden=true});visibleNodes=ids.map((id,i)=>{const g=ensureNode(id),wasActive=g.userData.lastActive;g.visible=true;g.userData.label.hidden=false;g.userData.target.set(...positions[i]);g.userData.targetScale=focusId?1.75*zoom:overview?.61:s.id==='intro'&&i===0?(innerWidth<=520?1.45:1):.74;if(!wasActive){g.position.copy(g.userData.target);g.scale.setScalar(reduced?g.userData.targetScale:.02)}g.userData.lastActive=true;return g});cache.forEach(g=>{if(!visibleNodes.includes(g))g.userData.lastActive=false});
 for(const[a,b,kind='data']of links){if(!visibleNodes[a]||!visibleNodes[b])continue;const color=edgeColor(kind),control=kind==='control',optional=kind==='option'||kind==='error'||kind==='return';const line=new T.Line(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(27*3),3)),(control||optional?new T.LineDashedMaterial({color,transparent:true,opacity:control?.3:.3,dashSize:.12,gapSize:.1}):new T.LineBasicMaterial({color,transparent:true,opacity:kind==='valid'?.58:.38})));const arrow=new T.Mesh(new T.ConeGeometry(.045,.14,6),new T.MeshBasicMaterial({color,transparent:true,opacity:control?.25:.7}));arrow.visible=!control;const beads=Array.from({length:control||optional?0:overview?1:3},()=>dataPacket(overview?.05:.065));root.add(line,arrow,...beads);edges.push({a:visibleNodes[a],b:visibleNodes[b],line,arrow,beads,kind})}
 orbit.visible=!focusId&&(stage===0||overview);if(overview&&!focusId){mapColumns.forEach(([name],i)=>{const el=document.createElement('span');el.className='scene-group-label';el.textContent=name;$('groupLabels').appendChild(el);mapLabels.push({el,pos:new T.Vector3((i-3)*4.35,5,0)})})}
 $('visual').dataset.view=focusId?'model':overview?'map':'journey';$('sceneTitle').textContent=focusId?'SYSTEM COMPONENT':overview?'SYSTEM MAP':s.tag;dirty=true;
}
function init(){const canvas=$('scene'),opts={alpha:true,antialias:true,powerPreference:'high-performance'};let gl=null;try{gl=canvas.getContext('webgl2',opts)}catch(e){}if(gl){renderer=new T.WebGLRenderer({canvas,context:gl,...opts});BCStudioLighting.configureRenderer(renderer);$('visual').dataset.renderer='webgl2';$('visual').dataset.lighting=BCStudioLighting.revision}else{renderer=new BCPerspectiveRenderer(canvas,()=>({root,visibleNodes,edges,orbit,highlight}));$('visual').dataset.renderer='canvas3d'}BCModels.configure({cpu:renderer.isCPU});$('renderMode').hidden=!renderer.isCPU;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x05070a,0);scene=new T.Scene();root=new T.Group();scene.add(root);camera=new T.PerspectiveCamera(34,1,.1,600);if(!renderer.isCPU)BCStudioLighting.install(renderer,scene);
 orbit=new T.Group();root.add(orbit);for(let i=0;i<3;i++){const pts=Array.from({length:101},(_,j)=>new T.Vector3(Math.cos(j/100*Math.PI*2)*4.7,Math.sin(j/100*Math.PI*2)*4.7,0));const o=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0x748ba6,transparent:true,opacity:.13}));o.rotation.set(.6+i*.6,i*.5,i*.7);orbit.add(o)}
 highlight=dataPacket(.1);root.add(highlight);
 if(!renderer.isCPU)bloom=new BCNeonBloom(renderer);ready=true;buildScene();resize();const ray=new T.Raycaster(),pointer=new T.Vector2();canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width-.5)*2;mouse.y=((e.clientY-r.top)/r.height-.5)*2});canvas.addEventListener('pointerleave',()=>{mouse.x=mouse.y=0});orbitControl=new BCSceneOrbit(canvas,camera,()=>{dirty=true});
updateInspectControls();
canvas.addEventListener('click',e=>{
 if(orbitControl.clickedAfterDrag())return;
 const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
 ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(visibleNodes,true);
 if(hits.length)openNode(hits[0].object.userData.nodeId);
});
requestAnimationFrame(frame);
}
function resize(){if(!ready)return;const r=$('visual').getBoundingClientRect();renderer.setSize(r.width,r.height,false);if(bloom){const size=renderer.getDrawingBufferSize(new T.Vector2());bloom.setSize(size.x,size.y)}camera.aspect=r.width/r.height;camera.fov=overview?34:mobile()?43:34;camera.updateProjectionMatrix();needResize=false;dirty=true;}
function arc(a,b,t,out){out.lerpVectors(a,b,t);out.z+=Math.sin(t*Math.PI)*.35;out.y+=Math.sin(t*Math.PI)*.13;return out}
function endpoints(e,a,b){a.copy(e.a.position);b.copy(e.b.position);const dir=new T.Vector3().subVectors(b,a).normalize(),dist=a.distanceTo(b),pad=Math.min(dist*.25,overview?.62:.72);a.addScaledVector(dir,pad);b.addScaledVector(dir,-pad)}
const routes=[[1,0,7],[0,1,3],[0],[0,3,5],[0,1,2],[0,1,4,6],[6],[0,1,3],[0,1,2,3,5],[0,1,2],[0,1,4,5],[0,1,2,3,4],[0,2],[4,5,6,0]];
function frame(now){requestAnimationFrame(frame);if(!visible||!ready)return;const fps=renderer.isCPU?22:50;if(lastNow&&now-lastNow<1000/fps)return;const dt=Math.min((now-lastNow||16)/1000,.09);lastNow=now;if(!paused)time+=dt;if(needResize)resize();const ease=reduced?1:1-Math.exp(-dt*5);let moving=false;
 spin+=(spinTarget-spin)*ease;pitch+=(pitchTarget-pitch)*ease;
root.rotation.set(0,0,0);
const box=overview?mapSpec.positions:D.layouts[D.scenes[Math.max(0,stage)].id];
let xs=box.map(p=>p[0]),ys=box.map(p=>p[1]);
const span=Math.max(...xs)-Math.min(...xs),verticalSpan=Math.max(...ys)-Math.min(...ys);
const movement=orbitControl.update(dt,{overview,focus:!!focusId,mobile:mobile(),span:focusId?1.8:span,verticalSpan:focusId?1.8:verticalSpan,viewHeight:$('visual').clientHeight,viewWidth:$('visual').clientWidth,paused});
if(movement)moving=true;
visibleNodes.forEach(g=>{g.rotation.y=0;g.rotation.x=0;g.position.lerp(g.userData.target,ease);const ds=g.userData.targetScale-g.scale.x;g.scale.setScalar(g.scale.x+ds*ease);if(Math.abs(ds)>.001||g.position.distanceTo(g.userData.target)>.003)moving=true});orbit.rotation.y=time*.025;
 const a=new T.Vector3(),b=new T.Vector3(),out=new T.Vector3(),next=new T.Vector3(),up=new T.Vector3(0,1,0);edges.forEach((e,i)=>{endpoints(e,a,b);const buf=e.line.geometry.attributes.position;for(let j=0;j<buf.count;j++){arc(a,b,j/(buf.count-1),out);buf.setXYZ(j,out.x,out.y,out.z)}buf.needsUpdate=true;if(['control','option','error','return'].includes(e.kind))e.line.computeLineDistances();arc(a,b,.73,out);arc(a,b,.75,next);e.arrow.position.copy(out);e.arrow.quaternion.setFromUnitVectors(up,next.sub(out).normalize());e.beads.forEach((p,j)=>arc(a,b,(time*.14+i*.09+j/3)%1,p.position))});
 highlight.visible=tracing&&!focusId&&!overview;let traceNode=null;if(highlight.visible){let path=routes[Math.max(0,stage)];if(stage===2&&profile!=='enterprise')path=[4];if(stage===4&&errorCase)path=[0,1,5,6,1,2];if(stage===12)path=[0,profile==='enterprise'?2:profile==='programs'?6:profile==='health'?1:3];const k=Math.floor(time*.32)%Math.max(1,path.length-1),aa=visibleNodes[path[k]],bb=visibleNodes[path[Math.min(k+1,path.length-1)]];if(aa&&bb){arc(aa.position,bb.position,(time*.32)%1,highlight.position);highlight.position.z+=.55;traceNode=bb.userData.id}else highlight.visible=false}
 scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const rect=$('scene').getBoundingClientRect(),placed=[];visibleNodes.forEach(g=>{const el=g.userData.label,p=new T.Vector3(0,g.userData.labelHeight,0).applyMatrix4(g.matrixWorld).project(camera);const x=(p.x*.5+.5)*rect.width;let y=(-p.y*.5+.5)*rect.height,w=Math.min(overview?115:mobile()?93:145,D.nodes[g.userData.id].label.length*(mobile()?3.5:4.8)+15),h=mobile()?18:23;for(let k=0;k<5;k++){if(placed.some(r=>Math.abs(x-r.x)<(w+r.w)/2+4&&Math.abs(y-r.y)<(h+r.h)/2+2))y-=h*.7;else break}placed.push({x,y,w,h});const show=p.z<1&&x>25&&x<rect.width-25&&y>(mobile()?70:125)&&y<rect.height-(mobile()?70:120);el.style.visibility=show?'visible':'hidden';el.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;el.classList.toggle('selected',selectedId===g.userData.id||traceNode===g.userData.id)});
 for(const m of mapLabels){const p=m.pos.clone().applyMatrix4(root.matrixWorld).project(camera);m.el.style.transform=`translate(${(p.x*.5+.5)*rect.width}px,${(-p.y*.5+.5)*rect.height}px) translate(-50%,-100%)`}
 if(!paused||moving||dirty){if(bloom)bloom.render(scene,camera);else renderer.render(scene,camera);dirty=false}
}
let scrollQueued=false;addEventListener('scroll',()=>{if(!scrollQueued){requestAnimationFrame(()=>{scrollQueued=false;onScroll()});scrollQueued=true}},{passive:true});addEventListener('resize',()=>{needResize=true;onScroll()});document.addEventListener('visibilitychange',()=>{visible=!document.hidden;lastNow=0;dirty=true});$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;$('fallback').hidden=false;$('fallback').textContent='The browser suspended 3D. Reload the page or read the component descriptions in the catalog.'});
function restoreInitialChapter(){
 const id=location.hash.slice(1);
 if(!D.scenes.some(s=>s.id===id))return;
 const chapter=document.getElementById(id);
 if(chapter){chapter.scrollIntoView({behavior:'instant',block:'start'});onScroll();}
}
document.addEventListener('bc-art-ready',()=>{dirty=true});document.addEventListener('bc-model-error',()=>{$('fallback').hidden=false;$('fallback').textContent='The model could not be loaded. Read its description or reload the page.'});renderStory();onScroll();
// Chapters are inserted by JavaScript, after the browser's initial fragment lookup.
requestAnimationFrame(restoreInitialChapter);
try{init()}catch(e){ready=false;$('fallback').hidden=false;console.warn('Scene initialization failed:',e.message)}
})();

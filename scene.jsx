import React,{useEffect,useRef} from 'react';
import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// One bounded material study. No room geometry is used anywhere on the site.
const smooth=(a,b,v)=>T.MathUtils.smoothstep(v,a,b);
function mineralMaps(size=256){
 const height=new Float32Array(size*size);let seed=17439;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)height[y*size+x]=.48+Math.sin(x*.071+Math.sin(y*.027)*3)*.12+Math.sin(y*.13+x*.035)*.07+(rand()-.5)*.19;
 const bump=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),ao=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,k=i*4,h=height[i];const nx=(height[y*size+(x+1)%size]-h)*2,ny=(height[((y+1)%size)*size+x]-h)*2;
  const vec=new T.Vector3(-nx,-ny,1).normalize();const edge=Math.min(x,y,size-1-x,size-1-y)/(size*.08);
  for(let c=0;c<3;c++){bump[k+c]=h*255;rough[k+c]=175+h*65;ao[k+c]=Math.min(1,.82+Math.min(edge,1)*.18)*255}
  normal[k]=(vec.x*.5+.5)*255;normal[k+1]=(vec.y*.5+.5)*255;normal[k+2]=(vec.z*.5+.5)*255;bump[k+3]=normal[k+3]=rough[k+3]=ao[k+3]=255;
 }
 const tex=data=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t};
 return{bump:tex(bump),normal:tex(normal),rough:tex(rough),ao:tex(ao)};
}
function slab(parent,w,h,d,material,z=0,r=.008){const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(r,d*.25)),material);mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}

export default function DetailScene({progress,onReady,onFail}){
 const ref=useRef();
 useEffect(()=>{
  const host=ref.current;let stopped=false,renderer,composer,frame,observer,resizeObserver,environment,pmrem;const resources=[];
  const mobile=matchMedia('(max-width:760px)').matches;const motionQuery=matchMedia('(prefers-reduced-motion:reduce)');let reduced=motionQuery.matches;
  const fail=()=>{if(!stopped)onFail()};
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch{fail();return}
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=T.SRGBColorSpace;host.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#242823');scene.fog=new T.Fog('#242823',15,38);
  const camera=new T.PerspectiveCamera(mobile?39:35,1,.1,50);
  pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.06);room.dispose();scene.environment=environment.texture;scene.environmentIntensity=.35;
  const hemi=new T.HemisphereLight('#f0ede3','#30392e',1.35);scene.add(hemi);
  const key=new T.DirectionalLight('#fff1d8',2.6);key.position.set(-3,7,7);key.castShadow=true;key.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:6,bottom:-6,near:.2,far:25});key.shadow.normalBias=.012;key.shadow.bias=-.00012;key.shadow.radius=6;scene.add(key);
  const fill=new T.DirectionalLight('#dce6ef',.8);fill.position.set(4,1,-1);scene.add(fill);
  RectAreaLightUniformsLib.init();const rim=new T.RectAreaLight('#ffe5bf',3,3,4);rim.position.set(-4,3,-2);rim.lookAt(0,0,0);scene.add(rim);
  const maps=mineralMaps(mobile?128:256);resources.push(...Object.values(maps));
  const make=(color,options={})=>{const m=new T.MeshStandardMaterial({color,roughness:.86,bumpMap:maps.bump,bumpScale:.014,roughnessMap:maps.rough,normalMap:maps.normal,normalScale:new T.Vector2(.15,.15),aoMap:maps.ao,aoMapIntensity:.5,...options});resources.push(m);return m};
  const assembly=new T.Group();scene.add(assembly);
  const groups=Array.from({length:5},()=>{const g=new T.Group();assembly.add(g);return g});
  const stoneMat=make('#cec4ad',{roughness:.52,bumpScale:.006,normalScale:new T.Vector2(.11,.11)});
  const mortarMat=make('#b4ad9d',{bumpScale:.025,roughness:.95});
  const membraneMat=make('#6e766b',{roughness:.92,bumpScale:.012,normalScale:new T.Vector2(.1,.1)});
  const baseMat=make('#99968d',{roughness:.98,bumpScale:.035});
  const blockMat=make('#b7afa0',{roughness:.97,bumpScale:.028});
  const jointMat=make('#777970',{roughness:1,bumpScale:.025});
  // Five recognisable physical materials, ordered from finish to structure.
  const w=2.3,h=3.1;
  slab(groups[0],w,h,.055,stoneMat,0,.012);
  slab(groups[1],w,h,.025,mortarMat);
  // Combed adhesive is actual relief geometry, not a flat grey panel.
  const ribs=new T.InstancedMesh(new T.CylinderGeometry(.013,.013,h-.035,6),mortarMat,70);const matrix=new T.Matrix4();for(let i=0;i<70;i++){matrix.makeTranslation(-w/2+.02+i*(w-.04)/69,0,.026);ribs.setMatrixAt(i,matrix)}ribs.castShadow=true;ribs.receiveShadow=true;groups[1].add(ribs);
  slab(groups[2],w,h,.026,membraneMat);
  slab(groups[3],w,h,.14,baseMat,0,.009);
  slab(groups[4],w,h,.28,jointMat,0,.008);
  for(let row=0;row<6;row++){for(let col=0;col<3;col++){const block=slab(groups[4],w/3-.016,h/6-.013,.34,blockMat,.014,.01);block.position.x=(col-1)*w/3;block.position.y=(row-2.5)*h/6}}
  // A grounded studio surface and soft shadow map keep the section tactile.
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#242823',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.58;floor.receiveShadow=true;scene.add(floor);resources.push(floor.material);
  const baseZ=[.32,.26,.225,.14,-.075];
  let textureLoaded=false;
  const stone=new T.TextureLoader().load('./images/limestone-v3.jpg',()=>{if(stopped)return;stone.colorSpace=T.SRGBColorSpace;stone.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);stoneMat.map=stone;stoneMat.needsUpdate=true;textureLoaded=true;dirty=true;},undefined,fail);resources.push(stone);
  let visible=true,dirty=true,last=-1,ready=false;
  if(!mobile){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const ao=new SSAOPass(scene,camera,1,1,16);ao.kernelRadius=.18;ao.minDistance=.001;ao.maxDistance=.13;composer.addPass(ao);const bokeh=new BokehPass(scene,camera,{focus:8.5,aperture:.000055,maxblur:.0018});composer.addPass(bokeh);composer.addPass(new OutputPass());resources.push(ao,bokeh);}
  const resize=()=>{const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();composer?.setSize(width,height);dirty=true};resize();resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;dirty=true},{rootMargin:'80px'});observer.observe(host);
  const motion=()=>{reduced=motionQuery.matches;dirty=true};motionQuery.addEventListener('change',motion);
  const contextLost=e=>{e.preventDefault();fail()};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const tick=()=>{if(stopped)return;frame=requestAnimationFrame(tick);if(!visible||document.hidden)return;const p=reduced?.66:progress.current.value;if(!dirty&&Math.abs(p-last)<.00001)return;dirty=false;last=p;
   const close=1-smooth(.79,.96,p);
   groups.forEach((group,i)=>{const separation=smooth(.33+i*.052,.44+i*.052,p)*close;group.position.z=baseZ[i]+(4-i)*.63*separation});
   // No spinning: a slow lens movement across the material cross-section.
   const travel=smooth(.29,.76,p);camera.position.set(mobile?5.7:5.3+travel*.35,1.6-travel*.25,mobile?8.5:8.6-travel*.65);camera.lookAt(0,-.04,.9*close*travel);
   try{if(composer)composer.render();else renderer.render(scene,camera);if(textureLoaded&&!ready){ready=true;onReady()}}catch{fail();cancelAnimationFrame(frame)}
  };tick();
  return()=>{stopped=true;cancelAnimationFrame(frame);observer?.disconnect();resizeObserver?.disconnect();motionQuery.removeEventListener('change',motion);scene.traverse(o=>o.geometry?.dispose());resources.forEach(r=>r.dispose?.());composer?.dispose();environment?.dispose();pmrem?.dispose();renderer.dispose();renderer.domElement.remove()};
 },[progress]);
 return <div className="scene-host" ref={ref} role="img" aria-label="Пет слоя на стена: плочка, лепило, хидроизолация, основа и конструкция"/>;
}



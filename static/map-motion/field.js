// Local adaptation of experiment 3's paper reveal and shared-noise dissolve.
// Sources and retained notices: SOURCES.md and vendor/. Geography is never warped.
import * as T from './vendor/three.module.min.js';

const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float valueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=valueNoise(p)*a;p=mat2(.8,.6,-.6,.8)*p*2.03;a*=.5;}return v;}
float paperField(vec2 uv){return .59*fbm(uv*vec2(7.2,6.1))+.24*fbm(uv*21.)+.17*(1.-uv.y);}
`;
const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment = `
varying vec2 vUv;
uniform float uProgress,uMode,uAspect,uAlpha;
uniform vec2 uOrigin;
${noise}
void main(){
 vec2 uv=vUv;float p=uProgress;
 vec3 paper=vec3(.9647,.9608,.9451);
 float grain=(hash(floor(uv*vec2(1417.,1083.)))-.5)*.025;
 paper+=grain;
 if(uMode<1.5){
   float n;
   if(uMode<.5){
     vec2 warp=vec2(fbm(uv*7.+2.),fbm(uv*7.+17.));
     n=length((uv-uOrigin)*vec2(uAspect*.73,.83))+.33*fbm(uv*8.+warp*3.);
   }else n=paperField(uv);
   float threshold=mix(-.15,uMode<.5?1.65:1.1,p);
   float edgeWidth=uMode<.5?.065:.018;
   float cover=smoothstep(threshold-edgeWidth,threshold+edgeWidth,n);
   float edge=1.-smoothstep(.0,uMode<.5?.12:.05,abs(n-threshold));
   vec3 ink=mix(vec3(.13,.26,.23),vec3(.43,.55,.40),fbm(uv*27.));
   vec3 color=mix(paper,ink,edge*(uMode<.5?.64:.48));
   float fiber=pow(.5+.5*sin(fbm(uv*11.)*65.),18.);
   color=mix(color,vec3(.33,.46,.36),edge*fiber*.22);
   gl_FragColor=vec4(color,cover*uAlpha);
 }else{
   float distance=length((uv-uOrigin)*vec2(uAspect,1.));
   float radius=p*.72;
   float ringWidth=mix(.004,.035,p);
   float wrinkle=fbm(uv*18.)*.025*sin(p*3.14159);
   float band=exp(-pow((distance+wrinkle-radius)/ringWidth,2.));
   float echo=exp(-pow((distance-radius*.77)/(ringWidth*.52),2.));
   float center=exp(-distance*distance/.000025)*(1.-p);
   gl_FragColor=vec4(.29,.45,.35,(band*.17+echo*.10+center*.12)*sin(p*3.14159)*uAlpha);
 }
}`;
const dustVertex = `
uniform float uProgress,uAspect,uPixelRatio;
attribute float seed;
varying float vAlpha,vSeed;
${noise}
void main(){
 vec2 uv=position.xy*.5+.5;
 float threshold=mix(-.15,1.1,uProgress);
 float age=(threshold-paperField(uv))/.24;
 vAlpha=(age>0.&&age<1.)?sin(age*3.14159):0.;
 vSeed=seed;float a=clamp(age,0.,1.);
 vec2 drift=vec2(.16+sin(seed*43.+a*3.)*.13,.08+seed*.25)*a;
 drift.x/=uAspect;
 vec2 pos=position.xy+drift;
 gl_Position=vec4(pos,0.,1.);
 gl_PointSize=(1.1+seed*2.)*uPixelRatio;
}`;
const dustFragment = `
varying float vAlpha,vSeed;
void main(){float d=length(gl_PointCoord-.5);if(d>.5||vAlpha<.01)discard;
 gl_FragColor=vec4(mix(vec3(.30,.43,.29),vec3(.71,.70,.48),vSeed),vAlpha*(1.-smoothstep(.12,.5,d))*.62);}`;

export class MapField {
  constructor(host, map, panel) {
    this.host=host;this.map=map;this.panel=panel;
    this.renderer=new T.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setClearColor(0,0);this.renderer.autoClear=false;
    this.canvas=this.renderer.domElement;this.canvas.className='map-motion-canvas';
    this.canvas.style.removeProperty('display');
    this.canvas.setAttribute('aria-hidden','true');host.append(this.canvas);
    this.scene=new T.Scene();this.camera=new T.Camera();
    this.quad=new T.Mesh(new T.PlaneGeometry(2,2));this.quad.frustumCulled=false;this.scene.add(this.quad);
    const uniform=()=>({
      uMode:{value:0},uProgress:{value:1},
      uAspect:{value:1000/730},uAlpha:{value:1},uOrigin:{value:new T.Vector2(.48,.56)}
    });
    this.material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:uniform(),transparent:true,depthTest:false,depthWrite:false});
    this.panelMaterial=this.material.clone();
    const points=[],seeds=[];
    for(let y=0;y<85;y++)for(let x=0;x<110;x++){
      const s=((x*73+y*137)%997)/997;
      points.push((x+.3+s*.4)/110*2-1,(y+.3+s*.4)/85*2-1,0);seeds.push(s);
    }
    this.geometry=new T.BufferGeometry();
    this.geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
    this.geometry.setAttribute('seed',new T.Float32BufferAttribute(seeds,1));
    this.sparks=new T.ShaderMaterial({vertexShader:dustVertex,fragmentShader:dustFragment,uniforms:{
      uProgress:{value:0},uAspect:{value:1.3},uPixelRatio:{value:this.renderer.getPixelRatio()}
    },transparent:true,depthTest:false,depthWrite:false});
    this.particles=new T.Points(this.geometry,this.sparks);this.particles.frustumCulled=false;
    this.dustScene=new T.Scene();this.dustScene.add(this.particles);
    this.resize();this.clear();
  }
  resize(){
    const r=this.host.getBoundingClientRect();
    this.width=r.width;this.height=r.height;
    this.renderer.setSize(r.width,r.height,false);
    const relative=node=>{const b=node.getBoundingClientRect();return {x:b.left-r.left,y:r.height-(b.bottom-r.top),w:b.width,h:b.height}};
    this.mapBox=relative(this.map);this.panelBox=relative(this.panel.querySelector('.panel-body'));
  }
  drawAt(box,material,mode,p,origin,dust=false){
    if(!box.w||!box.h)return;
    const r=this.renderer,u=material.uniforms;
    r.setViewport(box.x,box.y,box.w,box.h);r.setScissor(box.x,box.y,box.w,box.h);r.setScissorTest(true);
    u.uMode.value=mode;u.uProgress.value=p;u.uAspect.value=box.w/box.h;
    u.uOrigin.value.set(origin.x,origin.y);this.quad.material=material;r.render(this.scene,this.camera);
    if(dust&&p>0&&p<1){
      this.sparks.uniforms.uProgress.value=p;this.sparks.uniforms.uAspect.value=box.w/box.h;
      r.render(this.dustScene,this.camera);
    }
  }
  render(s){
    const r=this.renderer;r.setScissorTest(false);r.setRenderTarget(null);r.setViewport(0,0,this.width,this.height);r.clear();
    if(s.mapMode!==null&&s.progress<1)this.drawAt(this.mapBox,this.material,s.mapMode,s.progress,s.origin,s.mapMode===1);
    if(s.panelProgress<1&&!this.panel.hidden)this.drawAt(this.panelBox,this.panelMaterial,1,s.panelProgress,{x:.5,y:.5},true);
    r.setScissorTest(false);
  }
  clear(){this.renderer.setScissorTest(false);this.renderer.setRenderTarget(null);this.renderer.clear();}
  dispose(){
    this.clear();this.material.dispose();this.panelMaterial.dispose();
    this.sparks.dispose();this.geometry.dispose();this.quad.geometry.dispose();this.renderer.dispose();this.canvas.remove();
  }
}

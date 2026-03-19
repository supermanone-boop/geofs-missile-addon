// ==UserScript==
// @name         GeoFS ULTRA REAL Missile + Lock System
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Missile + Lock (no logic change, only integrated)
// @match        https://www.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function(){

/* =========================
   ===== SHARED VIEWER =====
========================= */

let viewer = null;
function getViewer(){
  if(!viewer){
    viewer = (geofs.api && geofs.api.viewer) ? geofs.api.viewer : geofs.viewer;
  }
  return viewer;
}


/* =========================
   ===== LOCK SYSTEM =====
========================= */

// ===== LOCK UI =====
const lockBox = document.createElement("div");
Object.assign(lockBox.style,{
  position:"fixed",
  top:"50%",
  left:"50%",
  width:"120px",
  height:"120px",
  marginLeft:"-60px",
  marginTop:"-60px",
  border:"2px solid lime",
  zIndex:"9999",
  pointerEvents:"none"
});
document.body.appendChild(lockBox);

const lockText = document.createElement("div");
Object.assign(lockText.style,{
  position:"fixed",
  top:"calc(50% + 80px)",
  left:"50%",
  transform:"translateX(-50%)",
  color:"white",
  fontWeight:"bold",
  fontSize:"18px",
  zIndex:"9999"
});
document.body.appendChild(lockText);


// ===== LOCK VAR =====
let currentTarget = null;
let lockTime = 0;
let lostTime = 0;

const LOCK_THRESHOLD = 0.8;
const LOST_THRESHOLD = 0.3;
const MAX_DISTANCE = 5000;


// ===== TIME =====
let lastTime = Date.now();
function getDT(){
  let now = Date.now();
  let dt = (now - lastTime)/1000;
  lastTime = now;
  return dt;
}


// ===== SCREEN =====
function getScreenPos(cartesian){
  let v = getViewer();
  if(!v) return null;

  try{
    return Cesium.SceneTransforms.wgs84ToWindowCoordinates(
      v.scene,
      cartesian
    );
  }catch(e){
    return null;
  }
}


// ===== LOCK LOOP =====
function updateLock(){

  let dt = getDT();
  let v = getViewer();
  if(!v){
    requestAnimationFrame(updateLock);
    return;
  }

  let users = multiplayer.visibleUsers || multiplayer.users;
  if(!users){
    requestAnimationFrame(updateLock);
    return;
  }

  let cx = window.innerWidth/2;
  let cy = window.innerHeight/2;

  let bestTarget = null;
  let bestDist = Infinity;

  let my = Cesium.Cartesian3.fromDegrees(
    geofs.aircraft.instance.llaLocation[1],
    geofs.aircraft.instance.llaLocation[0],
    geofs.aircraft.instance.llaLocation[2]
  );

  Object.values(users).forEach(u=>{
    if(!u.referencePoint) return;

    let t = Cesium.Cartesian3.fromDegrees(
      u.referencePoint.lla[1],
      u.referencePoint.lla[0],
      u.referencePoint.lla[2]
    );

    let dist = Cesium.Cartesian3.distance(my,t);
    if(dist > MAX_DISTANCE) return;

    let screen = getScreenPos(t);
    if(!screen) return;

    let inBox =
      Math.abs(screen.x - cx) < 60 &&
      Math.abs(screen.y - cy) < 60;

    if(inBox){
      if(currentTarget === u){
        bestTarget = u;
        bestDist = dist;
        return;
      }

      if(dist < bestDist){
        bestDist = dist;
        bestTarget = u;
      }
    }
  });

  if(bestTarget){
    if(currentTarget === bestTarget){
      lockTime += dt;
      lostTime = 0;
    }else{
      currentTarget = bestTarget;
      lockTime = 0;
      lostTime = 0;
    }
  }else{
    lostTime += dt;

    if(lostTime > LOST_THRESHOLD){
      currentTarget = null;
      lockTime = 0;
    }
  }

  if(currentTarget){
    if(lockTime >= LOCK_THRESHOLD){
      lockText.innerHTML = "🔒 LOCKED";
      lockText.style.color = "red";
      lockBox.style.border = "2px solid red";
    }else{
      lockText.innerHTML = "TRACK...";
      lockText.style.color = "lime";
      lockBox.style.border = "2px solid lime";
    }
  }else{
    lockText.innerHTML = "SEARCH";
    lockText.style.color = "white";
    lockBox.style.border = "2px solid white";
  }

  requestAnimationFrame(updateLock);
}
updateLock();


/* =========================
   ===== MISSILE SYSTEM =====
========================= */

/* ===== CONFIG ===== */

const MODEL = "https://raw.githubusercontent.com/supermanone-boop/geofs-missile-addon/main/textured.glb";

const MAX_SPEED = 1000;
const BOOST_ACCEL = 220;
const SUSTAIN_ACCEL = 80;

const BOOST_TIME = 2.5;
const SUSTAIN_TIME = 5;

const NAV_CONST = 4.5;
const MAX_G = 30;

const PROX = 15;
const LIFE = 18;

const LEAD = 1.5;

/* ===== UI ===== */

const btn=document.createElement("button");
btn.innerHTML="🚀 FOX THREE";

Object.assign(btn.style,{
position:"fixed",
top:"200px",
left:"20px",
zIndex:"9999",
padding:"14px",
background:"#e74c3c",
color:"#fff",
border:"none",
borderRadius:"10px",
fontWeight:"bold"
});

document.body.appendChild(btn);


/* ===== EXPLOSION ===== */

function explode(pos){

let boom=new Cesium.ParticleSystem({
image:"fire",
startScale:25,
endScale:60,
emissionRate:800,
minimumSpeed:20,
maximumSpeed:70,
emitter:new Cesium.SphereEmitter(12),
modelMatrix:Cesium.Transforms.eastNorthUpToFixedFrame(pos)
});

getViewer().scene.primitives.add(boom);

setTimeout(()=>{
getViewer().scene.primitives.remove(boom);
},1500);

}


/* ===== FIRE ===== */

btn.onclick=function(){

if(!currentTarget || lockTime < LOCK_THRESHOLD){
alert("ロック未完了");
return;
}

let target=currentTarget;

let viewer=getViewer();

let ac=geofs.aircraft.instance;

let start=[...ac.llaLocation];
start[2]+=40;

let pos=Cesium.Cartesian3.fromDegrees(start[1],start[0],start[2]);

let missile=viewer.entities.add({
position:new Cesium.ConstantPositionProperty(pos),
model:{uri:MODEL,scale:40}
});


let smoke=new Cesium.ParticleSystem({
image:"whiteSmoke",
startScale:6,endScale:25,
emissionRate:80,
minimumParticleLife:1,
maximumParticleLife:2,
emitter:new Cesium.ConeEmitter(Cesium.Math.toRadians(10)),
modelMatrix:Cesium.Transforms.eastNorthUpToFixedFrame(pos)
});
viewer.scene.primitives.add(smoke);

let flame=new Cesium.ParticleSystem({
image:"fire",
startScale:3,endScale:8,
emissionRate:100,
minimumParticleLife:0.2,
maximumParticleLife:0.4,
emitter:new Cesium.ConeEmitter(Cesium.Math.toRadians(25)),
modelMatrix:Cesium.Transforms.eastNorthUpToFixedFrame(pos)
});
viewer.scene.primitives.add(flame);


let vel=new Cesium.Cartesian3(0,0,0);
let speed=0;

let t0=Date.now();

let prevTarget=null;

function loop(){

if(!target.referencePoint) return;

let time=(Date.now()-t0)/1000;

if(time>LIFE){
explode(pos);
cleanup();
return;
}

let t=target.referencePoint.lla;

let targetPos=Cesium.Cartesian3.fromDegrees(t[1],t[0],t[2]);

let targetVel=new Cesium.Cartesian3(0,0,0);

if(prevTarget){
targetVel=Cesium.Cartesian3.subtract(targetPos,prevTarget,new Cesium.Cartesian3());
}
prevTarget=targetPos;

let leadVec=Cesium.Cartesian3.multiplyByScalar(targetVel,LEAD,new Cesium.Cartesian3());
let predicted=Cesium.Cartesian3.add(targetPos,leadVec,new Cesium.Cartesian3());

let dir=Cesium.Cartesian3.subtract(predicted,pos,new Cesium.Cartesian3());
let dist=Cesium.Cartesian3.magnitude(dir);
Cesium.Cartesian3.normalize(dir,dir);

if(time<BOOST_TIME){
speed+=BOOST_ACCEL*0.016;
}else if(time<BOOST_TIME+SUSTAIN_TIME){
speed+=SUSTAIN_ACCEL*0.016;
}

if(speed>MAX_SPEED) speed=MAX_SPEED;

let desired=Cesium.Cartesian3.multiplyByScalar(dir,speed,new Cesium.Cartesian3());

let diff=Cesium.Cartesian3.subtract(desired,vel,new Cesium.Cartesian3());
let turn=Cesium.Cartesian3.magnitude(diff);

let maxTurn=MAX_G*9.8*0.016;

if(turn>maxTurn){
Cesium.Cartesian3.normalize(diff,diff);
diff=Cesium.Cartesian3.multiplyByScalar(diff,maxTurn,new Cesium.Cartesian3());
}

vel=Cesium.Cartesian3.add(vel,diff,new Cesium.Cartesian3());

pos=Cesium.Cartesian3.add(pos,vel,new Cesium.Cartesian3());
missile.position.setValue(pos);

smoke.modelMatrix=Cesium.Transforms.eastNorthUpToFixedFrame(pos);
flame.modelMatrix=Cesium.Transforms.eastNorthUpToFixedFrame(pos);

if(dist<PROX){
explode(pos);
cleanup();
return;
}

requestAnimationFrame(loop);
}

function cleanup(){
viewer.entities.remove(missile);
viewer.scene.primitives.remove(smoke);
viewer.scene.primitives.remove(flame);
}

loop();

};

})();
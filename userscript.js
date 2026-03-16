// ==UserScript==
// @name         GeoFS Smooth Missile (Distance Ratio)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Smooth missile with distance-based tracking, no warp or stop issues
// @author       You
// @match        https://www.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';

    const MISSILE_MODEL_URL="https://raw.githubusercontent.com/supermanone-boop/geofs-missile-addon/main/textured.glb";
    const DROP_DISTANCE=50; // 初期落下距離
    const MOVE_RATIO=0.05; // 1フレームあたりターゲットまでの距離の割合（調整可能）

    const btn=document.createElement('button');
    btn.innerHTML='🚀 FOX ONE (SMOOTH)';
    Object.assign(btn.style,{
        position:'fixed', top:'180px', left:'20px',
        zIndex:'10000', padding:'12px', backgroundColor:'#c0392b',
        color:'white', border:'none', borderRadius:'8px',
        cursor:'pointer', fontWeight:'bold'
    });
    document.body.appendChild(btn);

    function getNearestPlayer(){
        let nearest=null, minDistance=Infinity;
        let users=multiplayer.visibleUsers||multiplayer.users;
        if(!users) return null;

        Object.values(users).forEach(user=>{
            if(!user.referencePoint) return;
            let dist=Cesium.Cartesian3.distance(
                Cesium.Cartesian3.fromDegrees(
                    geofs.aircraft.instance.llaLocation[1],
                    geofs.aircraft.instance.llaLocation[0],
                    geofs.aircraft.instance.llaLocation[2]
                ),
                Cesium.Cartesian3.fromDegrees(
                    user.referencePoint.lla[1],
                    user.referencePoint.lla[0],
                    user.referencePoint.lla[2]
                )
            );
            if(dist<minDistance){ minDistance=dist; nearest=user; }
        });
        return nearest;
    }

    btn.onclick=function(){
        let target=getNearestPlayer();
        if(!target){ console.log("No target found!"); return; }

        let ac=geofs.aircraft.instance;
        let startLla=[...ac.llaLocation];
        startLla[2]+=50; // 少し上に出す

        let viewer=(geofs.api && geofs.api.viewer) ? geofs.api.viewer : geofs.viewer;

        // Cartesian3 に変換
        let missilePos = Cesium.Cartesian3.fromDegrees(startLla[1], startLla[0], startLla[2]);
        let missile=viewer.entities.add({
            name:"AdvancedMissile",
            position:new Cesium.ConstantPositionProperty(missilePos),
            model:{ uri:MISSILE_MODEL_URL, scale:50, minimumPixelSize:128 }
        });

        let phase="DROP";
        let startTime=Date.now();

        function animate(){
            let elapsed=(Date.now()-startTime)/1000;

            if(phase==="DROP"){
                let currentAlt = startLla[2] - Math.min(DROP_DISTANCE*2*elapsed, DROP_DISTANCE);
                missilePos = Cesium.Cartesian3.fromDegrees(startLla[1], startLla[0], currentAlt);
                missile.position.setValue(missilePos);
                if(elapsed>0.5){ phase="TRACK"; console.log("Ignition!"); }
            } else {
                if(!target.referencePoint){ requestAnimationFrame(animate); return; }

                let targetPos = Cesium.Cartesian3.fromDegrees(
                    target.referencePoint.lla[1],
                    target.referencePoint.lla[0],
                    target.referencePoint.lla[2]
                );

                // 距離割合方式で滑らか追尾
                let direction = Cesium.Cartesian3.subtract(targetPos, missilePos, new Cesium.Cartesian3());
                let distance = Cesium.Cartesian3.magnitude(direction);
                Cesium.Cartesian3.normalize(direction, direction);

                let moveDist = distance * MOVE_RATIO; // 距離の割合だけ進む
                let delta = Cesium.Cartesian3.multiplyByScalar(direction, moveDist, new Cesium.Cartesian3());
                missilePos = Cesium.Cartesian3.add(missilePos, delta, new Cesium.Cartesian3());

                missile.position.setValue(missilePos);
            }

            requestAnimationFrame(animate);
        }

        animate();

        setTimeout(()=>{
            viewer.entities.remove(missile);
            console.log("Missile removed.");
        }, 8000);
    };
})();

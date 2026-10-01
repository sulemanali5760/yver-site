// Pieces in orbit: the chapter's jackets ride a stitched ring as sculpted tiles (glass, satin ceramic,
// brushed aluminium). Drag turns the ring with inertia; a tile or the dock brings a piece into focus,
// where the rest of the ring is rendered to a target, blurred, and drawn behind the focused tile.
// Loaded on demand by index.html; three.js r149 comes from the page's import map.
import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";

const TW = 1.5, TH = 1.65, TD = .34;                 // tile size in world units
const REST_EL = .2;                                  // camera elevation at rest (radians)
const AUTO = .11;                                    // idle spin, radians per second

// svg string → CanvasTexture, drawn at 2.5× so the stitching stays sharp up close
function svgTexture(svg, renderer){
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 500; c.height = 550;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      ok(t);
    };
    img.onerror = fail;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
function canvasTexture(w, h, paint){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function material(kind, tint){
  const c = new THREE.Color(tint).convertSRGBToLinear();          // r149 runs in legacy colour mode: hex is taken as linear
  if (kind === "glass") return new THREE.MeshPhysicalMaterial({
    color: c.clone().lerp(new THREE.Color(1, 1, 1), .55), transmission: 1, thickness: .9, ior: 1.42,
    roughness: .16, attenuationColor: c, attenuationDistance: 1.6, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1,
  });
  if (kind === "metal") return new THREE.MeshPhysicalMaterial({
    color: c, metalness: 1, roughness: .38, clearcoat: .3, clearcoatRoughness: .4, envMapIntensity: .55,
  });
  return new THREE.MeshPhysicalMaterial({                        // satin ceramic
    color: c, roughness: .5, clearcoat: .7, clearcoatRoughness: .25, envMapIntensity: .35,
  });
}

const FULL_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
// 9-tap separable gaussian; `dir` carries the step in texels, scaled by focus
const BLUR_FS = `uniform sampler2D tMap; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tMap, vUv) * .2270270;
  c += (texture2D(tMap, vUv + dir * 1.3846) + texture2D(tMap, vUv - dir * 1.3846)) * .3162162;
  c += (texture2D(tMap, vUv + dir * 3.2308) + texture2D(tMap, vUv - dir * 3.2308)) * .0702703;
  gl_FragColor = c;
}`;
// the target already holds tone-mapped linear colour (r149), so only the output encoding is left
const COMP_FS = `uniform sampler2D tMap; uniform float dim; varying vec2 vUv;
void main(){ gl_FragColor = vec4(texture2D(tMap, vUv).rgb * dim, 1.);
#include <encodings_fragment>
}`;

export async function createOrbit({canvas, pieces, svgFor, calm = false, onFocus = () => {}, onOpen = () => {}}){
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: "high-performance"});
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const N = pieces.length, STEP = Math.PI * 2 / N;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();
  // same warm stage light as the opening scene, drawn into the background so the blur carries it
  const backdrop = canvasTexture(512, 512, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h * .74, 0, w / 2, h * .74, w * .75);
    r.addColorStop(0, "#3B3238"); r.addColorStop(.38, "#221B1D"); r.addColorStop(.72, "#0E0A08"); r.addColorStop(1, "#0B0806");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  scene.background = backdrop;

  const key = new THREE.DirectionalLight("#FFE9CF", 1.6); key.position.set(3, 6, 5); scene.add(key);
  const rim = new THREE.PointLight("#F08A3C", 5, 14, 2); rim.position.set(-4, 1.5, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight("#F1E6D6", "#120D0A", .35));

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const world = new THREE.Group(); scene.add(world);

  // floor: soft contact shadow and the orbit drawn as a running stitch
  const shadowTex = canvasTexture(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(0,0,0,.55)"); r.addColorStop(.6, "rgba(0,0,0,.25)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
  floor.rotation.x = -Math.PI / 2; world.add(floor);
  const pathPts = Array.from({length: 181}, (_, i) => { const a = i / 180 * Math.PI * 2; return new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); });
  const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathPts),
    new THREE.LineDashedMaterial({color: "#F1E6D6", dashSize: .09, gapSize: .06, transparent: true, opacity: .28, toneMapped: false}));
  world.add(path);

  // tiles
  const body = new RoundedBoxGeometry(TW, TH, TD, 5, .2);
  const faceGeo = new THREE.PlaneGeometry(TW * .82, TW * .82 * 1.1);
  const textures = await Promise.all(pieces.map(p => svgTexture(svgFor(p), renderer)));
  const tiles = pieces.map((p, i) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(body, material(p.tile, p.tileTint));
    const f = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({map: textures[i], transparent: true, alphaTest: .02, toneMapped: false}));
    f.position.z = TD / 2 + .006;
    b.userData.i = f.userData.i = i;
    g.add(b, f); world.add(g);
    return {g, b, f, hover: 0, tilt: new THREE.Vector2(), tiltNow: new THREE.Vector2(), focus: 0};
  });
  const pickables = tiles.flatMap(t => [t.b, t.f]);

  // blur targets: half resolution, half float so the dark gradient doesn't band
  const rtOpts = {type: THREE.HalfFloatType, depthBuffer: true};
  const rtA = new THREE.WebGLRenderTarget(2, 2, rtOpts), rtB = new THREE.WebGLRenderTarget(2, 2, {...rtOpts, depthBuffer: false});
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurMat = new THREE.ShaderMaterial({vertexShader: FULL_VS, fragmentShader: BLUR_FS, uniforms: {tMap: {value: null}, dir: {value: new THREE.Vector2()}}, depthTest: false, depthWrite: false});
  const compMat = new THREE.ShaderMaterial({vertexShader: FULL_VS, fragmentShader: COMP_FS, uniforms: {tMap: {value: null}, dim: {value: 1}}, depthTest: false, depthWrite: false, toneMapped: false});
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat); quad.frustumCulled = false; quadScene.add(quad);

  // state
  let W = 1, H = 1, R = 3.4, dist = 10, portrait = false;
  let spin = 0, vel = 0, snap = null, el = REST_EL, elVel = 0, idleAt = 0;
  let focused = null, fAmt = 0, hover = null, drag = null, inside = null, visible = true, last = performance.now();
  const pointer = new THREE.Vector2(), par = new THREE.Vector2(), parNow = new THREE.Vector2();
  const ray = new THREE.Raycaster();

  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    W = w; H = h;
    const dpr = Math.min(2, devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    rtA.setSize(Math.ceil(w * dpr / 2), Math.ceil(h * dpr / 2));
    rtB.setSize(Math.ceil(w * dpr / 2), Math.ceil(h * dpr / 2));
    camera.aspect = w / h;
    portrait = camera.aspect < .9;
    R = portrait ? 2.9 : 3.4;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // far enough that the front tile fills about a third of the height; phones let the sides run off
    dist = THREE.MathUtils.clamp(Math.max(R + 9, (R + TW / 2) * 1.15 / (half * camera.aspect)), 11.5, portrait ? 13 : 17);
    camera.updateProjectionMatrix();
    floor.scale.set(R * 2.9, R * 2.9, 1);
    path.scale.set(R, 1, R); path.computeLineDistances();
  }

  const nearest = (from, to) => to + Math.round((from - to) / (Math.PI * 2)) * Math.PI * 2;
  function focus(i){
    if (i === focused) return;
    focused = i;
    snap = i === null ? null : nearest(spin, -i * STEP);
    vel = 0; idleAt = performance.now();
    onFocus(i);
  }

  function pick(e){
    const r = canvas.getBoundingClientRect();
    pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(pickables, false)[0] || null;
  }
  canvas.addEventListener("pointerdown", e => {
    drag = {x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false, id: e.pointerId, mouse: e.pointerType === "mouse"};
  });
  canvas.addEventListener("pointermove", e => {
    inside = e.pointerType === "mouse" ? e : null;
    const r = canvas.getBoundingClientRect();
    par.set((e.clientX - r.left) / r.width - .5, (e.clientY - r.top) / r.height - .5);
    if (drag) {
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly, now = performance.now(), dt = Math.max(8, now - drag.t);
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
        drag.moved = true; canvas.setPointerCapture(drag.id); snap = null;
        if (focused !== null) focus(null);                         // grabbing the ring lets go of the focus
      }
      if (drag.moved) {
        const k = 2.4 / Math.max(W, 1);
        spin += dx * k * 2.2;
        vel = THREE.MathUtils.clamp(dx * k * 2.2 / dt * 1000, -4, 4);   // radians per second, carried on release
        if (drag.mouse) { el = THREE.MathUtils.clamp(el + dy * .004, .02, .55); elVel = dy * .004 / dt * 1000; }
      }
      drag.lx = e.clientX; drag.ly = e.clientY; drag.t = now;
      idleAt = now;
    }
    hoverAt(e);
  });
  // also re-run every frame, so a tile gliding under a still cursor lights up and slows the ring
  function hoverAt(e){
    const h = drag?.moved ? null : pick(e);
    hover = h ? h.object.userData.i : null;
    if (h && h.uv) tiles[hover].tilt.set(h.uv.x - .5, h.uv.y - .5);
    canvas.style.cursor = drag?.moved ? "grabbing" : hover !== null ? "pointer" : "grab";
  }
  const release = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved) { idleAt = performance.now(); return; }
    const h = pick(e);
    if (!h) return focus(null);
    const i = h.object.userData.i;
    i === focused ? onOpen(i) : focus(i);                            // the focused tile opens its piece
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", () => { drag = null; });
  canvas.addEventListener("pointerleave", () => { hover = null; inside = null; par.set(0, 0); });

  const q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), camRight = new THREE.Vector3(), dir3 = new THREE.Vector3();
  const lookAt = new THREE.Vector3(0, -.45, 0), ZERO2 = new THREE.Vector2();
  function frame(now = performance.now()){
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const lerp = k => calm ? 1 : 1 - Math.exp(-dt * k);

    // ring motion: snap to a focused piece, else inertia settling into the idle spin
    if (snap !== null) {
      spin += (snap - spin) * lerp(6);
      if (Math.abs(snap - spin) < 1e-3) { spin = snap; snap = null; vel = 0; idleAt = now; }   // arrived: hand back to the idle spin
    }
    else if (!drag?.moved) {
      spin += vel * dt;
      const idle = !calm && focused === null && hover === null && now - idleAt > 2500;
      vel += ((idle ? AUTO : 0) - vel) * (1 - Math.exp(-dt * (Math.abs(vel) > AUTO ? 2.2 : .8)));
    }
    if (!drag?.moved) { el += elVel * dt; elVel *= Math.exp(-dt * 5); el += (REST_EL - el) * lerp(1.6); }
    fAmt += ((focused !== null ? 1 : 0) - fAmt) * lerp(5);

    // camera on a sphere around the ring, nudged by the pointer
    parNow.lerp(par, lerp(3));
    camera.position.set(Math.sin(parNow.x * -.12) * dist, Math.sin(el) * dist + parNow.y * .35, Math.cos(parNow.x * -.12) * Math.cos(el) * dist);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camera.getWorldDirection(dir3);
    floor.position.y = path.position.y = -TH / 2 - .32;

    tiles.forEach((t, i) => {
      const a = spin + i * STEP, depth = (Math.cos(a) + 1) / 2;       // 1 front → 0 back
      const bob = calm ? 0 : Math.sin(now / 1100 + i * 1.7) * .07;
      const ringPos = v3.set(Math.sin(a) * R, bob, Math.cos(a) * R);
      t.hover += ((hover === i && focused === null ? 1 : 0) - t.hover) * lerp(10);
      t.focus += ((focused === i ? 1 : 0) - t.focus) * lerp(5);
      t.tiltNow.lerp(hover === i ? t.tilt : ZERO2, lerp(8));
      // focused tile leaves the ring and comes toward the camera; on wide screens it sits right of the card
      const fp = camera.position.clone().addScaledVector(dir3, dist * .6).addScaledVector(camRight, portrait ? 0 : 1);
      if (portrait) fp.y -= .35;
      fp.y += calm ? 0 : Math.sin(now / 900) * .04;
      t.g.position.lerpVectors(ringPos, fp, ease(t.focus));
      // face the camera, turned a little with the ring so the thickness shows at the sides
      const face = Math.atan2(camera.position.x - t.g.position.x, camera.position.z - t.g.position.z);
      const turn = -Math.sin(a) * .35 * (1 - t.focus);
      const spinIdle = calm ? 0 : Math.sin(now / 1400) * .18 * t.focus;
      e3.set(-el * (.6 + .4 * t.focus) - t.tiltNow.y * .45, face + turn + t.tiltNow.x * .5 + spinIdle, 0, "YXZ");
      q.setFromEuler(e3);
      t.g.quaternion.slerp(q, lerp(12));
      t.g.scale.setScalar((1 + t.hover * .07) * (1 - (1 - depth) * .22) * (1 + t.focus * .18));
      t.f.material.color.setScalar(THREE.MathUtils.lerp(.42 + .58 * depth, 1, t.focus));
      t.g.renderOrder = focused === i ? 2 : 0;
    });
    if (inside && !drag) hoverAt(inside);
    render();
  }
  const ease = f => f * f * (3 - 2 * f);

  function render(){
    if (fAmt < .01) {
      tiles.forEach(t => t.g.visible = true);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    // 1. everything but the focused tile, into the half-size target
    // the tile in front is the focused one, or the one still flying back to the ring
    const ft = tiles.reduce((m, t) => t.focus > (m ? m.focus : .02) ? t : m, null);
    tiles.forEach(t => t.g.visible = t !== ft);
    renderer.setRenderTarget(rtA); renderer.render(scene, camera);
    // 2. blur it (three separable passes, each wider, so the taps don't leave ghost copies; radius grows with the focus)
    const rad = fAmt * 1.6;
    for (let k = 0; k < 3; k++) {
      quad.material = blurMat;
      blurMat.uniforms.tMap.value = rtA.texture; blurMat.uniforms.dir.value.set(rad * (k + 1) / rtA.width, 0);
      renderer.setRenderTarget(rtB); renderer.render(quadScene, quadCam);
      blurMat.uniforms.tMap.value = rtB.texture; blurMat.uniforms.dir.value.set(0, rad * (k + 1) / rtA.height);
      renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
    }
    // 3. composite to the screen, dimmed, then the focused tile on top, sharp
    quad.material = compMat;
    compMat.uniforms.tMap.value = rtA.texture; compMat.uniforms.dim.value = 1 - .38 * fAmt;
    renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    if (ft) {
      const bg = scene.background; scene.background = null;
      tiles.forEach(t => t.g.visible = t === ft);
      floor.visible = path.visible = false;
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true;
      scene.background = bg; floor.visible = path.visible = true;
      tiles.forEach(t => t.g.visible = true);
    }
  }

  const ro = new ResizeObserver(() => { resize(); if (calm || !visible) frame(); });
  ro.observe(canvas);
  resize();

  return {
    frame,
    focus: i => { focus(i); if (calm) frame(); },
    turn: d => { focus(null); snap = nearest(spin, Math.round(spin / STEP) * STEP - d * STEP); if (calm) frame(); },
    setVisible: v => { visible = v; if (v) last = performance.now(); },
    get focused(){ return focused; },
    dispose(){
      ro.disconnect();
      [body, faceGeo, floor.geometry, path.geometry, quad.geometry].forEach(g => g.dispose());
      tiles.forEach(t => { t.b.material.dispose(); t.f.material.dispose(); });
      textures.forEach(t => t.dispose());
      [backdrop, shadowTex, scene.environment].forEach(t => t.dispose());
      [rtA, rtB, blurMat, compMat, floor.material, path.material].forEach(x => x.dispose());
      renderer.dispose();
    },
  };
}

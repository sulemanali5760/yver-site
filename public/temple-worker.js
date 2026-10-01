// Runs Temple Night (vendor/temple-night.js) off the main thread. Building its world is seconds of
// JavaScript on an ordinary laptop; on the page itself that would freeze scrolling and the page transition.
// index.html hands over an OffscreenCanvas and forwards size, pointer, whether the scene is on screen,
// and a frame-rate cap (it lowers the cap when the page itself starts dropping frames; 0 holds a still frame).
// The renderer expects a few window things; they are stood in for here.
let r = null, c = null, on = false, frame = 0, gap = 1000 / 30, drawn = -Infinity;
const raf = self.requestAnimationFrame ? f => self.requestAnimationFrame(f) : f => setTimeout(() => f(performance.now()), 16);
const caf = id => self.cancelAnimationFrame ? self.cancelAnimationFrame(id) : clearTimeout(id);
const tick = t => {
  frame = 0;
  if (!on || !r) return;
  if (t - drawn >= gap - 4) { drawn = t; r.render(t); }
  if (!r.reducedMotion && gap !== Infinity) frame = raf(tick);
};
const loop = () => { if (on && r && !frame) frame = raf(tick); };
const size = m => { c.clientWidth = m.w; c.clientHeight = m.h; self.devicePixelRatio = m.dpr; };

self.onmessage = async ({data: m}) => {
  if (m.type === "init") {
    c = m.canvas;
    c.style = {};                                    // three writes the css size here; nothing reads it
    size(m);
    self.matchMedia = q => ({matches: q.includes("reduced-motion") ? m.calm : q.includes("hover") ? m.touch : false});
    self.document = {createElement: () => new OffscreenCanvas(1, 1)};   // its procedural textures
    try {
      const {createTempleNightRenderer} = await import("./vendor/temple-night.js");
      r = createTempleNightRenderer(c);
      if (!r) throw new Error("WebGL unavailable");
      r.resize(); r.render(performance.now());
      postMessage({type: "ready"});
      loop();
    } catch (e) {
      postMessage({type: "failed", error: String(e && e.message || e)});
    }
    return;
  }
  if (m.type === "run") {
    on = m.on;
    if (on) loop(); else if (frame) { caf(frame); frame = 0; }
    return;
  }
  if (m.type === "fps") { gap = m.fps ? 1000 / m.fps : Infinity; loop(); return; }
  if (m.type === "size" && c) size(m);
  if (!r) return;
  if (m.type === "size") { r.resize(); r.render(performance.now()); }
  if (m.type === "pointer") { r.setPointer(m.x, m.y, m.inside); if (r.reducedMotion) r.render(performance.now()); }
};

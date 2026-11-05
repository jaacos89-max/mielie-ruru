/* Mielie & Ruru – fx.js: a tiny motion kit (no deps).
 * Easing + tweens, squash/stretch poses, white hit-flash tinting, screen-space
 * sparkles/rings, soft button-press scale and pretty scenery helpers.
 * Loaded before game.js; everything here is only called at draw/update time. */
const Ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
  elastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
};
const FX = { tweens: [], ui: [], rings: [], press: {}, last: 0 };

/** tween(obj, 'key', to, seconds, ease?, done?) – generic numeric tween */
function tween(obj, key, to, dur, ease, done) {
  FX.tweens = FX.tweens.filter(t => !(t.o === obj && t.k === key));
  FX.tweens.push({ o: obj, k: key, a: obj[key] || 0, b: to, t: 0, d: Math.max(0.01, dur), e: ease || Ease.out, done });
}
function fxUpdate(dt) {
  for (let i = FX.tweens.length - 1; i >= 0; i--) { const w = FX.tweens[i]; w.t += dt / w.d; const k = Math.min(1, w.t); w.o[w.k] = w.a + (w.b - w.a) * w.e(k); if (k >= 1) { FX.tweens.splice(i, 1); w.done && w.done(); } }
  for (const id in FX.press) { FX.press[id] -= dt * 3.2; if (FX.press[id] <= 0) delete FX.press[id]; }
  for (let i = FX.ui.length - 1; i >= 0; i--) { const p = FX.ui[i]; p.life -= dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt; if (p.life <= 0) FX.ui.splice(i, 1); }
  for (let i = FX.rings.length - 1; i >= 0; i--) { const r = FX.rings[i]; r.t += dt / r.d; if (r.t >= 1) FX.rings.splice(i, 1); }
}

/* ---- buttons: squish on press, springy overshoot on release ---- */
function fxPress(id) { if (id) FX.press[id] = 1; }
function pressScale(id) {
  const p = FX.press[id]; if (!p) return 1;
  const t = 1 - p;                                   // 0 → 1 over ~0.3s
  return t < 0.25 ? 1 - 0.14 * Ease.out(t / 0.25) : 0.86 + 0.14 * Ease.elastic((t - 0.25) / 0.75);
}

/* ---- hero / creature poses ---- */
/** idle breathe (squash-stretch) + attack lunge with recoil + hurt wobble → transform numbers */
function fxPose(h, phase) {
  const br = Math.sin(now * 3.1 + (phase || 0));
  let sx = 1 - br * 0.018, sy = 1 + br * 0.03, dx = 0, dy = 0, rot = 0;
  if (h.lunge) {                                     // 1 → 0: dash in fast, pop back past rest (recoil), settle
    const t = 1 - h.lunge, f = h.lungeDir || h.facing || 1;
    let o;
    if (t < 0.2) o = Ease.out(t / 0.2);
    else { const u = (t - 0.2) / 0.8; o = Math.cos(u * Math.PI * 1.5) * (1 - u); }
    dx = f * o * T * 0.32; rot = f * o * 0.14;
    const st = Math.max(0, o); sx *= 1 + st * 0.14; sy *= 1 - st * 0.1;
    if (o < 0) { sx *= 1 + o * 0.06; sy *= 1 - o * 0.08; }
  }
  if (h.flash) dx += Math.sin(now * 70) * T * 0.03 * h.flash;
  return { sx, sy, dx, dy, rot, flash: h.flash || 0 };
}

/* ---- white / colour hit-flash: cached tinted silhouette of a sprite ---- */
const _tint = new WeakMap();
function tinted(img, col) {
  if (!img) return null;
  let m = _tint.get(img); if (!m) { m = {}; _tint.set(img, m); }
  if (m[col]) return m[col];
  const c = document.createElement('canvas'); c.width = img.width || img.naturalWidth; c.height = img.height || img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  c.dw = img.dw; c.dh = img.dh; m[col] = c; return c;
}
/** draw a sprite at (x,y,w,h) with an optional flash overlay (0..1) */
function drawFlashSprite(img, x, y, w, h, flash, col) {
  ctx.drawImage(img, x, y, w, h);
  if (flash > 0) { const t = tinted(img, col || '#ffffff'); ctx.globalAlpha = Math.min(1, flash) * 0.85; ctx.drawImage(t, x, y, w, h); ctx.globalAlpha = 1; }
}

/* ---- screen-space sparkles & rings (title, map, forge, supers) ---- */
function uiSparkle(x, y, n, cols, spread, up) {
  cols = cols || ['#fff6a0', '#ffd23f', '#ff8fc4', '#b06bff', '#7fe0ff', '#fff'];
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = (40 + Math.random() * 220) * (spread || 1);
    FX.ui.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (up || 80), g: 260, life: 0.5 + Math.random() * 0.6, max: 1.1, r: 3 + Math.random() * 6, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, k: i % 3 }); }
}
function uiRing(x, y, col, R, dur, w) { FX.rings.push({ x, y, c: col || '#fff', R: R || 120, d: dur || 0.5, t: 0, w: w || 8, world: false }); }
/** world-space ring (tile units) – shockwaves on hits & supers */
function fxRing(tx, ty, col, R, dur, w) { FX.rings.push({ x: tx, y: ty, c: col || '#fff', R: R || 1.2, d: dur || 0.45, t: 0, w: w || 6, world: true }); }
function drawFxRings(world) {
  for (const r of FX.rings) { if (!!r.world !== world) continue;
    const e = Ease.out(r.t), p = world ? w2s(r.x, r.y) : r, R = r.R * (world ? T : 1) * (0.15 + e * 0.85);
    ctx.save(); ctx.translate(p.x, p.y); if (world) ctx.scale(1, 0.6);
    ctx.globalAlpha = 1 - r.t; ctx.strokeStyle = r.c; ctx.lineWidth = Math.max(1, r.w * (1 - r.t)); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = (1 - r.t) * 0.35; ctx.lineWidth = Math.max(1, r.w * 2.4 * (1 - r.t)); ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.stroke();
    ctx.restore(); }
  ctx.globalAlpha = 1;
}
function drawUiFx() {
  for (const p of FX.ui) { ctx.globalAlpha = Math.min(1, p.life * 2.2);
    if (p.k === 0) star(p.x, p.y, p.r * 1.3, p.c, 4, 0.38);
    else if (p.k === 1) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.45, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.45, 0); ctx.fill(); ctx.restore(); }
    else circ(p.x, p.y, p.r * 0.6, p.c); }
  ctx.globalAlpha = 1; drawFxRings(false);
}

/* ---- scenery helpers ---- */
/** softly twinkling 4-point sparkle */
function twinkle(x, y, r, a, col) { ctx.globalAlpha = a; star(x, y, r, col || '#fff', 4, 0.3); circ(x, y, r * 0.35, col || '#fff'); ctx.globalAlpha = 1; }
/** rolling hill band across the screen: base y, amplitude, wavelength, colour, parallax offset */
function hillBand(y, amp, wl, col, off, hi) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, H + 10);
  for (let x = -10; x <= W + 20; x += 14) ctx.lineTo(x, y - Math.sin((x + off) / wl) * amp - Math.sin((x + off) / (wl * 0.43) + 1.3) * amp * 0.35);
  ctx.lineTo(W + 20, H + 10); ctx.closePath(); ctx.fill();
  if (hi) { ctx.save(); ctx.clip(); const g = ctx.createLinearGradient(0, y - amp * 1.4, 0, y + amp); g.addColorStop(0, hi); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-10, y - amp * 2, W + 30, amp * 3); ctx.restore(); }
}
/** puffy shaded cloud */
function puffCloud(x, y, s, a) {
  ctx.globalAlpha = a === undefined ? 1 : a;
  circ(x + s * 0.1, y + s * 0.18, s * 0.55, 'rgba(160,150,220,0.25)');
  circ(x - s * 0.55, y + s * 0.1, s * 0.38, '#fff'); circ(x, y - s * 0.12, s * 0.55, '#fff'); circ(x + s * 0.6, y + s * 0.08, s * 0.4, '#fff');
  ctx.fillStyle = '#fff'; rr(x - s * 0.9, y + s * 0.02, s * 1.85, s * 0.42, s * 0.21); ctx.fill();
  ell(x - s * 0.12, y + s * 0.34, s * 0.75, s * 0.1, 'rgba(190,180,240,0.35)');
  ctx.globalAlpha = 1;
}
/** layered modern sky: mood 'day' | 'dusk' | 'night' */
function fancySky(mood, par) {
  par = par || 0;
  const pal = mood === 'night' ? ['#1a1145', '#3d2a7a', '#7b4fa8', '#e58fc0'] : mood === 'dusk' ? ['#6a7bff', '#c89aff', '#ffb3d1', '#ffd6a5'] : ['#5ec8ff', '#a6e1ff', '#ffe6f3', '#ffe0b0'];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal[0]); g.addColorStop(0.35, pal[1]); g.addColorStop(0.7, pal[2]); g.addColorStop(1, pal[3]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sx = W * 0.82, sy = H * 0.12, sr = Math.min(W, H) * 0.08;
  if (mood === 'night') {
    for (let k = 0; k < 60; k++) { const x = hash(k, 3) * W, y = hash(3, k) * H * 0.55, tw = 0.5 + 0.5 * Math.sin(now * (1.5 + hash(k, k)) + k); twinkle(x, y, 1.5 + tw * 2.5 * hash(k, 7), 0.35 + tw * 0.6, k % 5 ? '#fff' : '#ffe6a0'); }
    const mg = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3); mg.addColorStop(0, 'rgba(255,240,200,0.5)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = mg; ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
    circ(sx, sy, sr, '#fff4d0'); circ(sx + sr * 0.35, sy - sr * 0.15, sr * 0.85, pal[0]);
  } else {
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4); sg.addColorStop(0, 'rgba(255,248,190,0.85)'); sg.addColorStop(1, 'rgba(255,248,190,0)'); ctx.fillStyle = sg; ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(now * 0.15); ctx.fillStyle = 'rgba(255,250,210,0.28)';
    for (let k = 0; k < 10; k++) { ctx.rotate(Math.PI / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sr * 3.2, -sr * 0.28); ctx.lineTo(sr * 3.2, sr * 0.28); ctx.fill(); }
    ctx.restore(); circ(sx, sy, sr, '#fff6b0'); circ(sx - sr * 0.3, sy - sr * 0.3, sr * 0.35, 'rgba(255,255,255,0.6)');
  }
  for (let k = 0; k < 4; k++) { const s = Math.min(W, H) * (0.07 + 0.025 * (k % 2)), x = ((now * (8 + k * 3) + k * W * 0.37 - par * 0.2) % (W + s * 4)) - s * 2, y = H * (0.07 + k * 0.065); puffCloud(x, y, s, mood === 'night' ? 0.25 : 0.95); }
}
/** three parallax hill layers + optional far castle silhouette */
function parallaxHills(baseY, mood, par) {
  par = par || 0; const n = mood === 'night';
  hillBand(baseY - H * 0.1, H * 0.035, W * 0.22, n ? '#4b3a8f' : '#a6d8b8', par * 0.2 + now * 4, n ? null : 'rgba(255,255,255,0.35)');
  hillBand(baseY - H * 0.04, H * 0.04, W * 0.17, n ? '#3a6a6a' : '#7ccf6a', par * 0.45 + 120, n ? null : 'rgba(255,255,220,0.45)');
  // little trees on the middle band
  for (let k = 0; k < 7; k++) { const x = ((k * W * 0.19 + 40 - par * 0.45) % (W + 60) + W + 60) % (W + 60) - 30, y = baseY - H * 0.04 - Math.sin((x + par * 0.45 + 120) / (W * 0.17)) * H * 0.04 - Math.sin((x + par * 0.45 + 120) / (W * 0.17 * 0.43) + 1.3) * H * 0.014;
    const s = Math.min(W, H) * 0.028; ctx.fillStyle = n ? '#2b4a4a' : '#5a3a1e'; ctx.fillRect(x - s * 0.12, y - s * 0.4, s * 0.24, s * 0.6); circ(x, y - s * 0.9, s * 0.7, n ? '#2e5a52' : '#3fae4c'); circ(x - s * 0.2, y - s * 1.1, s * 0.25, 'rgba(255,255,255,0.25)'); }
  hillBand(baseY + H * 0.02, H * 0.03, W * 0.3, n ? '#2f5a3a' : '#5cbf3a', par * 0.8 + 260, n ? null : 'rgba(220,255,160,0.5)');
}
/** floating sparkles drifting up (title / map) */
function floatingSparkles(n, a) {
  for (let k = 0; k < n; k++) { const sp = 18 + hash(k, 2) * 30, x = hash(k, 11) * W + Math.sin(now * 0.8 + k) * 20, y = H - ((now * sp + hash(11, k) * H) % (H + 40)), tw = 0.5 + 0.5 * Math.sin(now * 3 + k * 1.7);
    twinkle(x, y, 2 + tw * 4, (a || 0.8) * (0.3 + tw * 0.7), ['#fff', '#fff6a0', '#ffc2e6', '#c9b3ff'][k % 4]); }
}
/** soft vignette for mood */
function vignette(col, a) {
  const g = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col.replace('A', a)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

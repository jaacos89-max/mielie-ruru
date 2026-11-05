/* Mielie & Ruru - POWER BOOST: a meter that fills from hits, defeats and pickups, and each hero's super move.
 * Ruru: Shield Quake (ground-slam shockwave). Mielie: Star Storm (huge sparkle blast).
 * Lillie-Bee: Arrow Rain - she swoops in from off-screen (even when someone else is playing) with a cinematic
 * zoom + slow-mo and turns every minion into sparkle dust. Supers never one-shot a villain, and her summon is
 * locked while she is under the spell. Numbers live in DATA.power / DATA.supers (levels.js). */
'use strict';
function powerMax() { return (DATA.power && DATA.power.max) || 100; }
function powerFull() { return !!S && (S.power || 0) >= powerMax(); }
function addPower(kind, n) {
  if (!S || cine) return;
  const was = S.power || 0, g = n !== undefined ? n : ((DATA.power && DATA.power.gain && DATA.power.gain[kind]) || 0);
  S.power = Math.min(powerMax(), was + g);
  if (S.power >= powerMax() && was < powerMax()) { Snd.magic(); later(0.2, () => Snd.fanfare()); UI.powerPop = 1; }
}
function superDef(n) { return (DATA.supers || {})[n] || { name: 'Super', radius: 3, color: '#ffd23f' }; }
function enemiesNear(x, y, r) { return L.objs.filter(o => o.type === 'zombie' && !o.gone && !o.bonk && !o.poof && (Math.abs(o.x - x) + Math.abs(o.y - y)) <= r * 1.2 && Math.hypot(o.x - x, o.y - y) <= r); }
function superDust(o, col) {
  if (o.gone || o.bonk || o.poof) return;
  o.poof = 0.001; S.zombiesBonked = (S.zombiesBonked || 0) + 1;
  later(0.15, () => { o.gone = true; dustCloud(o.x + 0.5, o.y + 0.45, 26); burst(o.x + 0.5, o.y + 0.4, 'star', 10, 1.5); Snd.poof(); persist(); });
}
function superBoss(o, n) {
  if (!o || o.gone || o.beaten || o.type !== 'boss') return;
  o.hurt = 1; o.shake = 1; shakeAmt = Math.max(shakeAmt, 10);
  if (!o.cleared) return;                                    // minions first: the super clears them instead
  const d = bossDef(o);
  let cand = null;
  if (!armorOff(o)) { if (n === d.armor) cand = n; }      // only Ruru's quake can pop the bubble shield
  else { const need = bossNeed(o); cand = need.includes(n) ? n : need[0]; }
  if (cand && bossNeed(o).length <= 1) cand = null;          // never the finishing blow
  if (cand) bossHit(heroes[cand] || activeHero(), o, true);
  else later(0.3, () => tempBubble(o, [{ text: pickLine(d.hurt) }].concat(bossNeed(o).map(h => ({ head: h }))), 2));
}
function lockedSummon() {
  Snd.nope(); const a = activeHero(); if (a) tempBubble(a, [{ icon: 'queen' }, { icon: 'mirror' }, { text: '!' }], 2);
  const q = L && lvlObjs('queen')[0]; if (q) { q.shake = 1; tempBubble(q, [{ text: 'Nope! Hee hee!' }], 1.6); }
}
function doSuper(n, summon) {
  if (cine || !powerFull() || !L || scene !== 'play') return;
  if (n === ARCHER && !heroes[ARCHER]) { lockedSummon(); return; }
  const h = heroes[n]; if (!h) return;
  const sp = superDef(n); S.power = 0; questCard = null; persist();
  cine = { kind: n, t: 0, rdt: 0, ev: {}, slow: 1, flash: 0, fcol: '#fff', arrows: [], trail: [], summon: !!summon, name: sp.name, col: sp.color || '#ffd23f', r: sp.radius || 3, hx: h.x, hy: h.y, ring: 0, dur: n === ARCHER ? 2.6 : 1.4 };
  h.path = []; h.action = null; h.cast = 1; h.squash = 1; Snd.magic();
  if (n === ARCHER) { cine.hide = ARCHER; burst(h.x + 0.5, h.y, 'glitter', 20, 1.4); }
  hintCache.t = -1;
}
function cineEv(k, at) { if (cine.t >= at && !cine.ev[k]) { cine.ev[k] = 1; return true; } return false; }
function updateCine(dt) {
  if (!cine || !L) return;
  const c = cine, rdt = c.rdt || dt, h = heroes[c.kind];
  c.flash = Math.max(0, c.flash - rdt * 2.2);
  if (c.ring) c.ring = Math.min(1, c.ring + rdt * 1.8);
  if (c.kind === 'ruru') {
    if (cineEv('slam', 0.3)) {
      Snd.boom(); Snd.bonk(); later(0.05, () => Snd.rock()); shakeAmt = 16; c.flash = 0.7; c.fcol = '#cfe6ff'; c.ring = 0.001;
      burst(c.hx + 0.5, c.hy + 0.8, 'dust', 30, 2.5); burst(c.hx + 0.5, c.hy + 0.6, 'star', 20, 2.2);
      fxRing(c.hx + 0.5, c.hy + 0.8, '#ffffff', c.r + 1, 0.55, 12); later(0.12, () => fxRing(c.hx + 0.5, c.hy + 0.8, '#8fd0ff', c.r + 1.6, 0.7, 9)); later(0.24, () => fxRing(c.hx + 0.5, c.hy + 0.8, '#ffd23f', c.r * 0.7, 0.5, 6));
      if (h) { h.lunge = 0; h.squash = 1; }
      enemiesNear(c.hx, c.hy, c.r).forEach(z => { const dd = Math.hypot(z.x - c.hx, z.y - c.hy); later(dd * 0.07, () => { if (h) { z.bdir = z.x >= c.hx ? 1 : -1; if (!z.bonk && !z.poof) { z.bonk = 0.001; Snd.bonk(); burst(z.x + 0.5, z.y + 0.3, 'star', 10, 1.3); later(0.7, () => bonkDust(z)); later(0.9, () => { z.gone = true; persist(); }); } } }); });
      const b = areaBoss(); if (b && Math.hypot(b.x - c.hx, b.y - c.hy) <= c.r + 1) later(0.2, () => superBoss(b, 'ruru'));
    }
  } else if (c.kind === 'mielie') {
    if (h && c.t < 0.35) h.feisty = 1;
    if (cineEv('boom', 0.35)) {
      Snd.zap(); Snd.poof(); later(0.08, () => Snd.magic()); shakeAmt = 12; c.flash = 0.8; c.fcol = '#ffd6ec'; c.ring = 0.001;
      for (const k of ['star', 'glitter', 'confetti', 'spark']) burst(c.hx + 0.5, c.hy + 0.2, k, 45, 3.2);
      fxRing(c.hx + 0.5, c.hy + 0.6, '#fff6a0', c.r + 1.2, 0.6, 12); later(0.1, () => fxRing(c.hx + 0.5, c.hy + 0.6, '#ff8fc4', c.r + 0.6, 0.6, 9)); later(0.2, () => fxRing(c.hx + 0.5, c.hy + 0.6, '#b06bff', c.r * 0.6, 0.5, 6));
      { const p = w2s(c.hx + 0.5, c.hy + 0.2); uiSparkle(p.x, p.y, 40, null, 1.8, 120); }
      enemiesNear(c.hx, c.hy, c.r).forEach(z => { const dd = Math.hypot(z.x - c.hx, z.y - c.hy); later(0.05 + dd * 0.06, () => superDust(z)); });
      const b = areaBoss(); if (b && Math.hypot(b.x - c.hx, b.y - c.hy) <= c.r + 1) later(0.25, () => superBoss(b, 'mielie'));
      if (h) later(0.3, () => { Snd.hmph(); tempBubble(h, [{ text: 'Hmph!' }], 1.2); });
    }
  } else {
    // Arrow Rain: Lillie-Bee swoops across the sky, time slows and golden arrows fill the screen
    c.slow = c.t > 0.35 && c.t < 1.9 ? 0.35 : 1;
    if (cineEv('whoosh', 0.2)) { Snd.swap(); Snd.magic(); }
    const sw = swoopPos(c.t); if (sw) for (let k = 0; k < 2; k++) c.trail.push({ x: sw.x + rnd(-10, 10), y: sw.y + rnd(-10, 10), life: 0.6, r: rnd(3, 7) });
    if (c.t > 0.45 && c.t < 1.75) { c.spawn = (c.spawn || 0) + rdt * 70; while (c.spawn > 1) { c.spawn--; c.arrows.push({ x: rnd(-0.25 * W, 1.05 * W), y: rnd(-80, -10), v: rnd(0.9, 1.3), land: rnd(H * 0.3, H * 0.95) }); } }
    if (cineEv('tw', 0.6)) Snd.thunk();
    if (cineEv('rain', 0.85)) {
      shakeAmt = 10; c.flash = 0.45; c.fcol = '#fff3b0'; uiRing(W / 2, H * 0.5, '#fff3b0', Math.max(W, H) * 0.7, 0.7, 14);
      const zs = L.objs.filter(o => o.type === 'zombie' && !o.gone && !o.bonk && !o.poof);
      zs.forEach((z, k) => later(0.05 + k * 0.08, () => { superDust(z); burst(z.x + 0.5, z.y + 0.3, 'glitter', 20, 1.8); Snd.thunk(); }));
      const b = areaBoss(); if (b) later(0.4, () => superBoss(b, ARCHER));
    }
    if (cineEv('land', 2.05) && h) { h.squash = 1; h.cast = 1; c.hide = null; burst(h.x + 0.5, h.y + 0.2, 'glitter', 26, 1.8); burst(h.x + 0.5, h.y + 0.6, 'dust', 10, 1.2); fxRing(h.x + 0.5, h.y + 0.8, '#fff6a0', 1.4, 0.45, 7); Snd.pop(); tempBubble(h, [{ text: 'Ta-da!' }], 1.3); }
  }
  for (const a of c.arrows) { a.y += rdt * H * 1.5 * a.v; a.x += rdt * W * 0.32 * a.v; if (a.y > a.land && !a.hit) { a.hit = 1; a.t = 0; if (Math.random() < 0.35) uiSparkle(a.x, a.y, 3, ['#fff6a0', '#ffd23f', '#fff'], 0.35, 60); } if (a.hit) a.t += rdt; }
  c.arrows = c.arrows.filter(a => !a.hit || a.t < 0.35);
  for (const p of c.trail) p.life -= rdt; c.trail = c.trail.filter(p => p.life > 0);
  if (c.t >= c.dur) { if (c.hide && h) c.hide = null; cine = null; hintCache.t = -1; persist(); }
}
function swoopPos(t) {
  const k = (t - 0.2) / 1.5; if (k < 0 || k > 1) return null;
  return { x: -0.3 * W + k * 1.6 * W, y: H * 0.2 + Math.sin(k * Math.PI) * H * 0.12, k };
}
function cineZoom() {
  if (!cine || cine.kind !== ARCHER) return 1;
  const t = cine.t, e = t < 0.4 ? t / 0.4 : t > 1.9 ? Math.max(0, 1 - (t - 1.9) / 0.5) : 1;
  return 1 + 0.12 * easeOut(Math.min(1, e));
}
function drawCineOverlay() {
  if (!cine) return; const c = cine, t = c.t;
  if (c.ring && c.ring < 1 && c.kind === 'ruru') {
    const p = w2s(c.hx + 0.5, c.hy + 0.75), R = c.ring * (c.r + 0.5) * T, a = 1 - c.ring;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.55);
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = k ? 'rgba(108,184,255,' + a * 0.8 + ')' : 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = (14 - k * 4) * a + 2; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, R - k * 18), 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(90,60,30,' + a + ')'; ctx.lineWidth = 4;
    for (let k = 0; k < 8; k++) { const an = k / 8 * TAU + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 20, Math.sin(an) * 20); ctx.lineTo(Math.cos(an + 0.1) * R * 0.5, Math.sin(an + 0.1) * R * 0.5); ctx.lineTo(Math.cos(an - 0.05) * R * 0.8, Math.sin(an - 0.05) * R * 0.8); ctx.stroke(); }
    ctx.restore();
  }
  if (c.kind === 'mielie' && t > 0.3) {
    const p = w2s(c.hx + 0.5, c.hy + 0.2), k = Math.min(1, (t - 0.3) / 0.9), a = 1 - k, R = (0.3 + k) * c.r * T;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 2);
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillStyle = i % 2 ? 'rgba(255,143,196,' + a * 0.7 + ')' : 'rgba(255,210,63,' + a * 0.7 + ')'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, -R * 0.08); ctx.lineTo(R, R * 0.08); ctx.fill(); }
    ctx.restore();
    star(p.x, p.y, T * (0.5 + k * 1.2), 'rgba(255,255,255,' + a + ')', 8, 0.4);
  }
  if (c.kind === ARCHER) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75), va = c.slow < 1 ? 0.45 : 0.15;
    vg.addColorStop(0, 'rgba(40,20,80,0)'); vg.addColorStop(1, 'rgba(40,20,80,' + va + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    for (const p of c.trail) star(p.x, p.y, p.r * p.life * 1.6, 'rgba(255,220,90,' + p.life * 1.5 + ')', 4);
    for (const a of c.arrows) {
      const an = Math.atan2(1.5 * H, 0.32 * W);
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(an); ctx.globalAlpha = a.hit ? Math.max(0, 1 - a.t / 0.35) : 1;
      ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 10; ctx.strokeStyle = '#ffcf33'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(6, -6); ctx.lineTo(6, 6); ctx.fill();
      ctx.fillStyle = '#ff8fc4'; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-42, -6); ctx.lineTo(-28, 0); ctx.lineTo(-42, 6); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore(); ctx.globalAlpha = 1;
      if (a.hit) star(a.x, a.y, 6 + a.t * 30, 'rgba(255,240,150,' + Math.max(0, 1 - a.t / 0.35) + ')', 4);
    }
    const sw = swoopPos(t);
    if (sw) {
      const im = heroSprite(ARCHER, Math.min(W, H) * 0.42);
      const g = ctx.createRadialGradient(sw.x, sw.y, 4, sw.x, sw.y, 120); g.addColorStop(0, 'rgba(255,230,120,0.75)'); g.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = g; ctx.fillRect(sw.x - 120, sw.y - 120, 240, 240);
      if (im) { ctx.save(); ctx.translate(sw.x, sw.y); ctx.rotate(-0.18 + Math.sin(sw.k * 6) * 0.05); ctx.drawImage(im, -im.dw / 2, -im.dh / 2, im.dw, im.dh); ctx.restore(); }
    }
  }
  if (c.flash > 0) { ctx.globalAlpha = Math.min(1, c.flash); ctx.fillStyle = c.fcol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  // big name pop
  const nt = c.kind === ARCHER ? t - 0.4 : t - 0.2;
  if (nt > 0 && nt < (c.kind === ARCHER ? 1.9 : 1.1)) {
    const sc = nt < 0.2 ? easeOut(nt / 0.2) * 1.2 : 1 + Math.sin(now * 8) * 0.03;
    ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(sc, sc); ctx.shadowColor = c.col; ctx.shadowBlur = 24; txt(c.name + '!', 0, 0, 44, '#fff', c.kind === 'ruru' ? '#1f5fa8' : c.kind === 'mielie' ? '#c2185b' : '#b07800'); ctx.shadowBlur = 0; ctx.restore();
  }
}
function drawPowerHUD() {
  if (!S || !UI.meter) return;
  const m = UI.meter, v = Math.min(1, (S.power || 0) / powerMax()), full = v >= 1;
  ctx.fillStyle = 'rgba(59,42,107,0.55)'; rr(m.x, m.y, m.w, m.h, m.h / 2); ctx.fill();
  if (v > 0) { const g = ctx.createLinearGradient(m.x, 0, m.x + m.w, 0); g.addColorStop(0, '#ffd23f'); g.addColorStop(1, '#ff6fb1'); ctx.fillStyle = g; rr(m.x + 2, m.y + 2, Math.max(m.h - 4, (m.w - 4) * v), m.h - 4, (m.h - 4) / 2); ctx.fill(); }
  if (full) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(now * 8)) + ')'; ctx.lineWidth = 3; rr(m.x, m.y, m.w, m.h, m.h / 2); ctx.stroke(); }
  circ(m.x + 4, m.y + m.h / 2, 16, '#ffd23f', '#fff', 3); bolt(m.x + 4, m.y + m.h / 2, 14);
  if (!full || cine || popup) return;
  UI.powerPop = Math.max(0, (UI.powerPop || 0) - 0.02);
  const a = activeHero(); if (!a) return;
  superBtn('super', UI.power.x, UI.power.y, UI.power.r, a.name, () => doSuper(a.name));
  if (ARCHER && a.name !== ARCHER) {
    const locked = !heroes[ARCHER];
    superBtn('summon', UI.summon.x, UI.summon.y, UI.summon.r, locked ? 'queen' : ARCHER, () => locked ? lockedSummon() : doSuper(ARCHER, true), locked);
  }
}
function bolt(x, y, s) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + s * 0.15, y - s * 0.55); ctx.lineTo(x - s * 0.3, y + s * 0.08); ctx.lineTo(x - s * 0.02, y + s * 0.08); ctx.lineTo(x - s * 0.15, y + s * 0.55); ctx.lineTo(x + s * 0.3, y - s * 0.08); ctx.lineTo(x + s * 0.02, y - s * 0.08); ctx.closePath(); ctx.fill(); }
function superBtn(id, x, y, r, who, fn, locked) {
  const col = locked ? '#5b1f86' : (superDef(who).color || '#ffd23f'), p = 1 + Math.sin(now * 6) * 0.08 + (UI.powerPop || 0) * 0.4;
  ctx.save(); ctx.translate(x, y);
  if (!locked) {
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.9); g.addColorStop(0, col + 'cc'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.save(); ctx.rotate(now * 1.5); for (let k = 0; k < 10; k++) { ctx.rotate(TAU / 10); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(r * 0.9, -r * 0.08); ctx.lineTo(r * 1.45, 0); ctx.lineTo(r * 0.9, r * 0.08); ctx.fill(); } ctx.restore();
  }
  ctx.scale(p, p);
  circ(0, 5, r, 'rgba(0,0,0,0.25)'); circ(0, 0, r, col, '#fff', 5);
  const im = sprite(who === 'queen' ? 'queenHead' : who + 'Head', r * 1.7);
  if (im) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, TAU); ctx.clip(); if (locked) ctx.globalAlpha = 0.6; ctx.drawImage(im, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7); ctx.restore(); ctx.globalAlpha = 1; }
  if (locked) { circ(r * 0.62, r * 0.55, r * 0.36, '#fff', '#5b1f86', 3); drawIcon('lock', r * 0.62, r * 0.58, r * 0.5); }
  else { circ(r * 0.66, -r * 0.62, r * 0.34, '#ffd23f', '#fff', 3); bolt(r * 0.66, -r * 0.62, r * 0.42); }
  ctx.restore();
  btn(id, x, y, r + 6, fn);
}

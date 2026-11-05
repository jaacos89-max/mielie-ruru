/* Mielie & Ruru - gear, upgrades and the Forge screen.
 * Loaded after game.js (shares its globals). All item data lives in js/gear.js (window.MR_GEAR).
 */
'use strict';
const GEAR = window.MR_GEAR;
const GEAR_ITEMS = Object.keys(GEAR.items);
function freshGear() { const g = {}; GEAR_ITEMS.forEach(k => g[k] = 0); return g; }
function fixGear(g) { const f = freshGear(); for (const k in (g || {})) f[k] = g[k]; GEAR_ITEMS.forEach(k => f[k] = clamp(f[k] | 0, 0, GEAR.items[k].tiers.length - 1)); return f; }
function tierIdx(item) { return S && S.gear ? (S.gear[item] | 0) : 0; }
function gearTier(item, i) { const t = GEAR.items[item].tiers; return t[clamp(i === undefined ? tierIdx(item) : i, 0, t.length - 1)]; }
/** best value of a stat over a hero's equipped gear (or every item when hero is omitted) */
function gearStat(stat, hero) {
  let v = null;
  for (const k of GEAR_ITEMS) { if (hero && GEAR.items[k].hero !== hero) continue; const s = gearTier(k).stats || {}; if (s[stat] !== undefined) v = v === null ? s[stat] : Math.max(v, s[stat]); }
  return v === null ? 0 : v;
}
function needTier(item, stat, val) { return GEAR.items[item].tiers.findIndex(t => (t.stats[stat] || 0) >= val); }
function gemCount() { return S ? ['r', 'b', 'y'].filter(c => S.gems[c]).length : 0; }
function canAfford(item, i) {
  const t = gearTier(item, i); if (!t) return false;
  for (const r in (t.cost || {})) if ((S.inv[r] || 0) < t.cost[r]) return false;
  return gemCount() >= (t.gems || 0);
}
function anyAffordable() { return GEAR_ITEMS.some(k => tierIdx(k) + 1 < GEAR.items[k].tiers.length && canAfford(k, tierIdx(k) + 1)); }
/** shown when something needs better gear: [needed item icon] [anvil] */
function gearBubble(o, item, tier) { Snd.nope(); o.shake = 1; tempBubble(o, [{ gear: item, tier }, { icon: 'arrow' }, { icon: 'anvil' }], 2.2); forgeNudge = 3; }
let forgeNudge = 0;

/* ---------- hints: if a reachable thing needs gear, point at what is missing ---------- */
function gearBlocker() {
  for (const o of L.objs) {
    if (o.gone) continue;
    if (o.type === 'thorn' && (o.power || 1) > gearStat('power', 'ruru') && reachable(o)) return { o, item: 'sword', tier: needTier('sword', 'power', o.power) };
    if (o.type === 'lantern' && !o.lit && (o.magic || 1) > gearStat('magic', 'mielie') && reachable(o)) return { o, item: 'wand', tier: needTier('wand', 'magic', o.magic) };
  }
  return null;
}
function gearHint() {
  const b = gearBlocker(); if (!b) return null;
  // first finish any plain thing that does not need gear
  const plain = L.objs.find(o => !o.gone && ((o.type === 'thorn' && (o.power || 1) <= gearStat('power', 'ruru')) || (o.type === 'lantern' && !o.lit && (o.magic || 1) <= gearStat('magic', 'mielie'))) && reachable(o));
  if (plain) return plain;
  for (let i = tierIdx(b.item) + 1; i <= b.tier; i++) {
    if (canAfford(b.item, i)) return { ui: 'forge' };
    const t = gearTier(b.item, i);
    for (const r in (t.cost || {})) if ((S.inv[r] || 0) < t.cost[r]) {
      const src = { wood: 'tree', stone: 'rock', mielie: 'corn', flower: 'bud' }[r];
      const c = nearest(avail(src).filter(reachable)); if (c) return c;
    }
    break;
  }
  return b.o;
}

/* ---------- sprites: recolour the hero cut-out for the equipped gear ---------- */
function gearKey(hero) { return GEAR.heroes[hero].map(k => tierIdx(k)).join('.'); }
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
function paintImage(src, ops) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  if (!ops.length) return c;
  const W0 = c.width, H0 = c.height, im = g.getImageData(0, 0, W0, H0), d = im.data;
  for (const op of ops) {
    const x0 = Math.round(op.rect[0] * W0), y0 = Math.round(op.rect[1] * H0), x1 = Math.round(op.rect[2] * W0), y1 = Math.round(op.rect[3] * H0);
    const [lo, hi] = op.hue, smin = op.smin !== undefined ? op.smin : 0.15, lmin = op.lmin || 0.05, lmax = op.lmax || 0.97, t = op.to;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W0 + x) * 4; if (d[i + 3] < 20) continue;
      let [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
      const inh = lo <= hi ? (h >= lo && h <= hi) : (h >= lo || h <= hi);
      if (!inh || s < smin || l < lmin || l > lmax) continue;
      if (t.h !== undefined) h = t.h + (h - (lo + hi) / 2) * 0.3;
      s = clamp(s * (t.s !== undefined ? t.s : 1), 0, 1); l = clamp(l * (t.lm || 1) + (t.l || 0), 0, 1);
      const [r, gg, b] = hsl2rgb(h, s, l); d[i] = r; d[i + 1] = gg; d[i + 2] = b;
    }
  }
  g.putImageData(im, 0, 0); return c;
}
function heroSprite(hero, h) {
  const key = hero + '|' + gearKey(hero);
  if (!IMG[key] && IMG[hero]) {
    const ops = []; GEAR.heroes[hero].forEach(k => (gearTier(k).paint || []).forEach(p => ops.push(p)));
    try { IMG[key] = paintImage(IMG[hero], ops); } catch (e) { IMG[key] = IMG[hero]; }
  }
  return sprite(IMG[key] ? key : hero, h);
}
/** little extras drawn on top of the sprite; (ox, oy) = top-left of the image, (w, h) = its size */
function drawGearOverlay(hero, ox, oy, w, h) {
  const P = (fx, fy) => [ox + fx * w, oy + fy * h], tw = Math.sin(now * 6);
  for (const k of GEAR.heroes[hero]) for (const ov of (gearTier(k).overlay || [])) {
    if (ov === 'shine') { [[0.1, 0.38], [0.04, 0.47], [0.18, 0.55]].forEach(([a, b], n) => { const [x, y] = P(a, b); star(x, y, w * 0.05 * (1 + 0.4 * Math.sin(now * 7 + n * 2)), '#fffbe0'); }); }
    if (ov === 'wings') { [[0.3, 0.86, -1], [0.7, 0.88, 1]].forEach(([a, b, dir]) => { const [x, y] = P(a, b); ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(-0.3 + tw * 0.25); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7fc8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-w * 0.28, -w * 0.18, -w * 0.3, w * 0.02); ctx.quadraticCurveTo(-w * 0.16, -w * 0.02, -w * 0.18, w * 0.08); ctx.quadraticCurveTo(-w * 0.08, w * 0.02, 0, w * 0.04); ctx.fill(); ctx.stroke(); ctx.restore(); }); }
    if (ov === 'rainbow') { const [x, y] = P(0.86, 0.3); ['#ff4d6d', '#ff9f1c', '#ffd23f', '#7bd85a', '#3fa9ff', '#b06bff'].forEach((c, n) => { const a = now * 3 + n * TAU / 6; star(x + Math.cos(a) * w * 0.17, y + Math.sin(a) * w * 0.17, w * 0.035, c); }); }
    if (ov === 'starcape') { [[0.13, 0.62], [0.2, 0.74], [0.08, 0.72], [0.86, 0.64], [0.8, 0.74]].forEach(([a, b], n) => { const [x, y] = P(a, b); star(x, y, w * 0.035 * (1 + 0.3 * Math.sin(now * 5 + n)), '#fff6a0'); }); }
    if (ov === 'goldbow') { [[0.9, 0.26], [0.96, 0.42], [0.86, 0.6], [0.55, 0.74]].forEach(([a, b], n) => { const [x, y] = P(a, b); star(x, y, w * 0.035 * (1 + 0.5 * Math.sin(now * 6 + n * 1.7)), '#fff3a0'); }); }
    if (ov === 'starbow') { const [x, y] = P(0.9, 0.42); ['#8fd6ff', '#fff6a0', '#ff9ed2', '#b9f3ff'].forEach((c, n) => { const a = now * 2.5 + n * TAU / 4; star(x + Math.cos(a) * w * 0.14, y + Math.sin(a) * h * 0.12, w * 0.04, c); }); }
    if (ov === 'startiara') { const [x, y] = P(0.5, 0.02); star(x, y - h * 0.02, w * 0.08 * (1 + 0.12 * tw), '#ffd23f'); circ(x, y - h * 0.02, w * 0.025, '#fff'); }
  }
}

/* ---------- icons ---------- */
function drawGearIcon(item, i, cx, cy, s) {
  const t = gearTier(item, i), c = t.color;
  ctx.save(); ctx.translate(cx, cy);
  switch (item) {
    case 'sword':
      ctx.rotate(0.7); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.12); ctx.lineTo(-s * 0.08, -s * 0.36); ctx.lineTo(0, -s * 0.5); ctx.lineTo(s * 0.08, -s * 0.36); ctx.lineTo(s * 0.08, s * 0.12); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-s * 0.02, -s * 0.36, s * 0.03, s * 0.44);
      ctx.fillStyle = '#8a5a2b'; rr(-s * 0.24, s * 0.1, s * 0.48, s * 0.09, s * 0.04); ctx.fill(); ctx.fillRect(-s * 0.05, s * 0.18, s * 0.1, s * 0.24); circ(0, s * 0.44, s * 0.06, '#ffd23f');
      if (t.id === 'gold') { star(s * 0.12, -s * 0.3, s * 0.1, '#fff'); star(-s * 0.1, -s * 0.05, s * 0.07, '#fff'); }
      break;
    case 'shield':
      circ(0, 0, s * 0.42, t.id === 'iron' ? '#8fa3bd' : '#9a8f7f', c, s * 0.08);
      if (t.id === 'iron') for (let k = 0; k < 6; k++) circ(Math.cos(k * 1.047) * s * 0.33, Math.sin(k * 1.047) * s * 0.33, s * 0.035, '#e8eef7');
      ctx.save(); ctx.scale(0.55, 0.55); drawIcon('mielie', 0, 0, s); ctx.restore(); break;
    case 'boots':
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.38); ctx.lineTo(s * 0.08, -s * 0.38); ctx.lineTo(s * 0.08, s * 0.08); ctx.lineTo(s * 0.4, s * 0.16); ctx.quadraticCurveTo(s * 0.44, s * 0.36, s * 0.3, s * 0.36); ctx.lineTo(-s * 0.22, s * 0.36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-s * 0.22, s * 0.28, s * 0.62, s * 0.08); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-s * 0.2, -s * 0.38, s * 0.28, s * 0.09);
      if (t.id === 'winged') { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7fc8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.2); ctx.quadraticCurveTo(-s * 0.55, -s * 0.45, -s * 0.5, -s * 0.05); ctx.quadraticCurveTo(-s * 0.35, -s * 0.1, -s * 0.2, 0); ctx.fill(); ctx.stroke(); }
      if (t.id === 'speedy') { ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.48, -s * 0.2 + k * s * 0.15); ctx.lineTo(-s * 0.3, -s * 0.2 + k * s * 0.15); ctx.stroke(); } }
      break;
    case 'wand':
      ctx.rotate(0.5); ctx.fillStyle = '#c98a4b'; rr(-s * 0.04, -s * 0.1, s * 0.08, s * 0.55, s * 0.03); ctx.fill();
      if (t.id === 'rainbow') { ['#ff4d6d', '#ffd23f', '#7bd85a', '#3fa9ff', '#b06bff'].forEach((cc, k) => star(0, -s * 0.22, s * (0.3 - k * 0.05), cc)); }
      else if (t.id === 'crystal') { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.17, -s * 0.24); ctx.lineTo(0, -s * 0.04); ctx.lineTo(-s * 0.17, -s * 0.24); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(0, -s * 0.46); ctx.lineTo(s * 0.06, -s * 0.26); ctx.lineTo(0, -s * 0.1); ctx.fill(); }
      else { star(0, -s * 0.22, s * 0.26, c); circ(0, -s * 0.22, s * 0.08, '#fff8c4'); }
      break;
    case 'cape':
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.38); ctx.lineTo(s * 0.16, -s * 0.38); ctx.quadraticCurveTo(s * 0.45, s * 0.1, s * 0.38, s * 0.42); ctx.quadraticCurveTo(0, s * 0.32, -s * 0.38, s * 0.42); ctx.quadraticCurveTo(-s * 0.45, s * 0.1, -s * 0.16, -s * 0.38); ctx.fill();
      circ(0, -s * 0.36, s * 0.08, '#ffd23f');
      if (t.id === 'starry') { star(-s * 0.15, 0, s * 0.07, '#fff6a0'); star(s * 0.14, s * 0.12, s * 0.06, '#fff6a0'); star(s * 0.02, s * 0.25, s * 0.05, '#fff6a0'); }
      break;
    case 'bow': drawBow(s, t); break;
    case 'tiara':
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.2); ctx.lineTo(-s * 0.4, -s * 0.05); ctx.lineTo(-s * 0.2, s * 0.05); ctx.lineTo(0, -s * 0.25); ctx.lineTo(s * 0.2, s * 0.05); ctx.lineTo(s * 0.4, -s * 0.05); ctx.lineTo(s * 0.4, s * 0.2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c99700'; ctx.lineWidth = 2; ctx.stroke();
      { const gc = t.id === 'gold' ? '#b06bff' : t.id === 'pink' ? '#ff6fae' : '#ffd23f'; ctx.fillStyle = gc; ctx.beginPath(); ctx.moveTo(0, -s * 0.12); ctx.lineTo(s * 0.08, s * 0.02); ctx.lineTo(0, s * 0.14); ctx.lineTo(-s * 0.08, s * 0.02); ctx.fill(); }
      if (t.id === 'star') star(0, -s * 0.36, s * 0.14, '#fff6a0');
      break;
  }
  ctx.restore();
}
/* Lillie-Bee's bow (tier t = { id, color }): arc, string and a glowing golden arrow */
function drawBow(s, t) {
  const c = (t && t.color) || '#a0662f', id = t && t.id;
  ctx.save(); ctx.rotate(-0.6);
  if (id !== 'wood') { const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s * 0.5); g.addColorStop(0, id === 'star' ? 'rgba(143,214,255,0.5)' : 'rgba(255,220,90,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-s * 0.5, -s * 0.5, s, s); }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-s * 0.18, 0, s * 0.42, -1.15, 1.15); ctx.stroke();
  ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.arc(-s * 0.18, 0, s * 0.42, -1.15, 1.15); ctx.stroke();
  const ex = -s * 0.18 + Math.cos(1.15) * s * 0.42, ey = Math.sin(1.15) * s * 0.42;
  ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = Math.max(1.5, s * 0.025); ctx.beginPath(); ctx.moveTo(ex, -ey); ctx.lineTo(-s * 0.08, 0); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(2, s * 0.04); ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.36, 0); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(s * 0.48, 0); ctx.lineTo(s * 0.33, -s * 0.08); ctx.lineTo(s * 0.33, s * 0.08); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(-s * 0.2, -s * 0.07); ctx.lineTo(-s * 0.03, 0); ctx.lineTo(-s * 0.2, s * 0.07); ctx.fill();
  if (id === 'golden') { star(ex, -ey, s * 0.08, '#fff6a0'); star(ex, ey, s * 0.08, '#fff6a0'); }
  if (id === 'star') { star(ex, -ey, s * 0.11, '#fff6a0'); star(ex, ey, s * 0.11, '#fff6a0'); star(s * 0.48, 0, s * 0.09, '#bfe9ff'); }
  ctx.restore();
}
function drawAnvil(s) {
  ctx.fillStyle = '#4a4f63'; ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.12); ctx.lineTo(s * 0.3, -s * 0.12); ctx.quadraticCurveTo(s * 0.46, -s * 0.12, s * 0.46, -s * 0.02); ctx.lineTo(s * 0.18, s * 0.04); ctx.lineTo(s * 0.12, s * 0.16); ctx.lineTo(s * 0.26, s * 0.3); ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s * 0.16, s * 0.16); ctx.lineTo(-s * 0.22, s * 0.04); ctx.quadraticCurveTo(-s * 0.42, s * 0.02, -s * 0.42, -s * 0.12); ctx.fill();
  ctx.fillStyle = '#7d859e'; ctx.fillRect(-s * 0.36, -s * 0.12, s * 0.66, s * 0.06);
  ctx.save(); ctx.rotate(-0.7 + Math.sin(now * 4) * 0.08); ctx.fillStyle = '#c98a4b'; rr(-s * 0.03, -s * 0.5, s * 0.07, s * 0.36, s * 0.03); ctx.fill(); ctx.fillStyle = '#b9c2d3'; rr(-s * 0.13, -s * 0.56, s * 0.27, s * 0.12, s * 0.03); ctx.fill(); ctx.restore();
}
function drawStatIcon(stat, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy);
  switch (stat) {
    case 'power': circ(-s * 0.12, s * 0.05, s * 0.22, '#2e6b3a'); circ(s * 0.14, s * 0.05, s * 0.22, '#2e6b3a'); circ(0, -s * 0.12, s * 0.24, '#357a42'); ctx.fillStyle = '#b06bff'; for (let k = 0; k < 5; k++) { const a = k * 1.25; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28); ctx.lineTo(Math.cos(a) * s * 0.44, Math.sin(a) * s * 0.44); ctx.lineTo(Math.cos(a + 0.3) * s * 0.3, Math.sin(a + 0.3) * s * 0.3); ctx.fill(); } break;
    case 'reach': for (let k = 3; k >= 1; k--) circ(0, 0, s * 0.14 * k, null, k === 3 ? '#ff6fd8' : k === 2 ? '#ffd23f' : '#fff', s * 0.07); star(0, 0, s * 0.12, '#ffd23f'); break;
    case 'guard': circ(0, 0, s * 0.3, '#c0c7d6', '#7d869c', s * 0.06); for (let k = 0; k < 4; k++) star(Math.cos(k * 1.57 + 0.78) * s * 0.4, Math.sin(k * 1.57 + 0.78) * s * 0.4, s * 0.09, '#ffd23f'); break;
    case 'speed': ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.4 + k * s * 0.08, -s * 0.2 + k * s * 0.2); ctx.lineTo(s * 0.35, -s * 0.2 + k * s * 0.2); ctx.stroke(); } break;
    case 'bloom': drawIcon('flower', -s * 0.12, 0, s * 0.6); drawIcon('flower', s * 0.18, s * 0.1, s * 0.45); break;
    case 'style': heart(0, 0, s * 0.42, '#ff4d6d'); break;
    case 'range': drawTargetBoard(s * 0.12, 0, s * 0.3, false); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.46, 0); ctx.lineTo(-s * 0.08, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.14, -s * 0.08); ctx.lineTo(-s * 0.14, s * 0.08); ctx.fill(); break;
  }
  ctx.restore();
}

/* ---------- Forge screen ---------- */
let forgeHero = 'ruru', forgeFrom = 'play', forgeFx = [], forgeShake = {};
function openForge() { forgeFrom = scene; forgeHero = S.active || 'ruru'; scene = 'forge'; forgeFx = []; Snd.clang(0.5); idle = 0; }
function closeForge() { scene = forgeFrom === 'forge' ? 'play' : forgeFrom; Snd.tap(); persist(); hintCache.t = -1; }
let forgePopT = -9, forgePv = null;
function buyGear(item, rowX, rowY) {
  const nx = tierIdx(item) + 1, t = gearTier(item, nx);
  if (nx >= GEAR.items[item].tiers.length) return;
  if (!canAfford(item, nx)) { Snd.nope(); forgeShake[item] = 1; return; }
  for (const r in (t.cost || {})) { S.inv[r] -= t.cost[r]; pillBounce[r] = 1; }
  S.gear[item] = nx; Snd.clang(1); later(0.15, () => Snd.magic());
  for (let k = 0; k < 30; k++) { const a = rnd(0, TAU), sp = rnd(80, 320); forgeFx.push({ x: rowX, y: rowY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: rnd(0.5, 1), c: [t.color, '#ffd23f', '#fff', '#ff9f1c'][k % 4], r: rnd(4, 9) }); }
  forgeFx.push({ ring: true, x: rowX, y: rowY, life: 0.6, c: t.color });
  // craft sparkles: a burst at the row, a shower over the preview hero and a glowing ring
  uiSparkle(rowX, rowY, 18, [t.color, '#fff6a0', '#fff', '#ff8fc4'], 1, 120); uiRing(rowX, rowY, '#fff6a0', 90, 0.5, 8); forgePopT = now;
  if (forgePv) { const p = forgePv; uiRing(p.x, p.y - p.h * 0.5, t.color, p.h * 0.7, 0.6, 10); for (let k = 0; k < 4; k++) later(k * 0.08, () => uiSparkle(p.x + rnd(-p.h * 0.3, p.h * 0.3), p.y - p.h * rnd(0.3, 0.95), 8, [t.color, '#fff6a0', '#fff'], 0.6, 140)); }
  heroes[forgeHero] && (heroes[forgeHero].squash = 1);
  persist();
}
function drawResPills() {
  for (const p of UI.pills) {
    if (p.res === 'pick') continue;
    const b = pillBounce[p.res] || 0, sc = 1 + Math.sin(b * Math.PI) * 0.18;
    ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.scale(sc, sc); ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
    ctx.fillStyle = 'rgba(255,255,255,0.94)'; rr(p.x, p.y, p.w, p.h, p.h / 2); ctx.fill();
    if (p.res === 'gems') drawIcon('gems', p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w * 0.95, 70));
    else { const is = Math.min(p.h * 0.72, p.w * 0.45); drawIcon(p.res, p.x + is * 0.62, p.y + p.h / 2, is); txt(String(S.inv[p.res]), p.x + p.w - Math.min(p.w * 0.27, 24), p.y + p.h / 2 + 1, Math.round(Math.min(28, p.w * 0.34)), '#3b2a6b', null); }
    ctx.restore();
  }
}
function pips(x, y, n, of, col, r) { for (let k = 0; k < of; k++) circ(x + (k - (of - 1) / 2) * r * 2.6, y, r, k < n ? col : 'rgba(255,255,255,0.25)', '#fff', 2); }
let forgeLast = 0;
function drawForge() {
  const dt = clamp(now - forgeLast, 0, 0.05); forgeLast = now;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5b2a1e'); g.addColorStop(1, '#a8532a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 14; k++) { const x = hash(k, 3) * W, y = H - ((now * 40 * (0.5 + hash(3, k)) + hash(k, 9) * H) % H); circ(x, y, 2 + hash(k, k) * 3, 'rgba(255,190,90,0.6)'); }
  drawResPills();
  const land = W > H * 1.1, top = UI.top + 64;
  // hero tabs
  const tabY = top + 44, tabs = ['ruru', 'mielie'].concat(HERO_ORDER.filter(n => n !== 'ruru' && n !== 'mielie'));
  tabs.forEach((n, k) => {
    const x = land ? 50 + k * 84 + 20 : W / 2 + (k - (tabs.length - 1) / 2) * 108, sel = n === forgeHero, r = sel ? 40 : 34;
    circ(x, tabY + 4, r, 'rgba(0,0,0,0.25)'); circ(x, tabY, r, (HERO[n] || {}).color || '#ff8fc4', sel ? '#ffd23f' : '#fff', sel ? 6 : 3);
    const im = sprite(n + 'Head', r * 2); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x, tabY, r - 3, 0, TAU); ctx.clip(); ctx.drawImage(im, x - r, tabY - r, r * 2, r * 2); ctx.restore(); }
    btn('forgeTab_' + n, x, tabY, 40, () => { if (forgeHero !== n) { forgeHero = n; Snd.swap(); } });
  });
  // big preview of the hero with gear
  const pv = land ? { x: 175, y: H - 22, h: Math.min(H - tabY - 60, 260) } : { x: W / 2, y: tabY + 60 + Math.min(H * 0.3, 260), h: Math.min(H * 0.3, 260) };
  forgePv = pv;
  const im = heroSprite(forgeHero, pv.h), hop = Math.abs(Math.sin(now * 3)), hb = hop * 6, br = Math.sin(now * 3.1);
  const pt = now - forgePopT, pop = pt < 0.6 ? Math.sin(pt / 0.6 * Math.PI * 2) * (1 - pt / 0.6) : 0;
  const sx = (1 - br * 0.015 + Math.max(0, 0.2 - hop) * 0.3) * (1 - pop * 0.12), sy = (1 + br * 0.025 - Math.max(0, 0.2 - hop) * 0.35) * (1 + pop * 0.15);
  { const gl = ctx.createRadialGradient(pv.x, pv.y - pv.h * 0.5, pv.h * 0.1, pv.x, pv.y - pv.h * 0.5, pv.h * 0.75); gl.addColorStop(0, `rgba(255,240,170,${0.28 + Math.max(0, pop) * 0.4})`); gl.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = gl; ctx.fillRect(pv.x - pv.h, pv.y - pv.h * 1.3, pv.h * 2, pv.h * 1.4); }
  ell(pv.x, pv.y, pv.h * 0.22 * (1 - hop * 0.15), pv.h * 0.05, 'rgba(0,0,0,0.3)');
  if (im) { ctx.save(); ctx.translate(pv.x, pv.y - hb); ctx.scale(sx, sy); ctx.drawImage(im, -im.dw / 2, -im.dh, im.dw, im.dh); drawGearOverlay(forgeHero, -im.dw / 2, -im.dh, im.dw, im.dh);
    if (pt < 0.35) { ctx.globalAlpha = (1 - pt / 0.35) * 0.6; ctx.drawImage(tinted(im, '#fffbe0'), -im.dw / 2, -im.dh, im.dw, im.dh); ctx.globalAlpha = 1; } ctx.restore(); }
  for (let k = 0; k < 5; k++) { const a = now * 0.9 + k * TAU / 5, tw = 0.5 + 0.5 * Math.sin(now * 4 + k); twinkle(pv.x + Math.cos(a) * pv.h * 0.38, pv.y - pv.h * 0.5 + Math.sin(a) * pv.h * 0.42, 3 + tw * 4, 0.35 + tw * 0.5, k % 2 ? '#fff' : '#fff6a0'); }
  // anvil next to the hero
  if (!land) { ctx.save(); ctx.translate(pv.x - pv.h * 0.55, pv.y - 30); drawAnvil(64); ctx.restore(); }
  // rows of gear
  const slots = GEAR.heroes[forgeHero];
  const rx0 = land ? 290 : 12, rx1 = W - 12, ry0 = land ? top + 4 : pv.y + 16, ry1 = H - 92;
  const rh = Math.min(118, (ry1 - ry0) / slots.length - 8);
  slots.forEach((item, k) => {
    const y = ry0 + k * (rh + 8), cy = y + rh / 2, cur = tierIdx(item), n = GEAR.items[item].tiers.length, nx = cur + 1, max = nx >= n;
    const sh = forgeShake[item] ? Math.sin(now * 60) * 8 * forgeShake[item] : 0;
    ctx.save(); ctx.translate(sh, 0);
    ctx.fillStyle = 'rgba(255,240,215,0.95)'; rr(rx0, y, rx1 - rx0, rh, 22); ctx.fill(); ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = 4; ctx.stroke();
    const is = Math.min(rh * 0.62, 68), x1 = rx0 + 12 + is / 2;
    circ(x1, cy - 8, is / 2 + 4, '#fff', gearTier(item).color, 4); drawGearIcon(item, cur, x1, cy - 8, is * 0.9);
    pips(x1, cy + is / 2 + 6, cur + 1, n, gearTier(item).color, 5);
    drawStatIcon(GEAR.items[item].stat, x1 + is / 2 + 26, cy - 14, 34);
    { const st = GEAR.items[item].stat, v = Math.max(0, cur + (st === 'speed' || st === 'style' || st === 'power' || st === 'range' ? 1 : 0)); pips(x1 + is / 2 + 26, cy + 16, v, Math.max(n, v), '#ffd23f', 4); }
    const bx = rx1 - 46;
    if (max) { star(bx - 4, cy, 30 + Math.sin(now * 4) * 2, '#ffd23f'); drawIcon('check', bx - 4, cy + 2, 34); }
    else {
      const t = gearTier(item, nx), ok = canAfford(item, nx), ax = x1 + is / 2 + 58;
      drawIcon('arrow', ax, cy - 8, 30);
      const nxX = ax + 34; circ(nxX, cy - 8, is * 0.42, 'rgba(255,255,255,0.7)', t.color, 3); drawGearIcon(item, nx, nxX, cy - 8, is * 0.75);
      // cost
      const costs = Object.entries(t.cost || {}); if (t.gems) costs.push(['gems', t.gems]);
      const cx0 = nxX - is * 0.35, cyc = cy + rh * 0.32, cw = Math.min(56, (bx - 40 - cx0) / Math.max(1, costs.length));
      costs.forEach(([r, v], j) => {
        const have = r === 'gems' ? gemCount() : S.inv[r] || 0, x = cx0 + j * cw;
        if (r === 'gems') { star(x + 8, cyc, 10, '#ff6fd8'); } else drawIcon(r, x + 8, cyc, 22);
        txt(String(v), x + 30, cyc + 1, 20, have >= v ? '#2fb84f' : '#ff4d6d', null);
      });
      const pulse = ok ? 1 + Math.sin(now * 5) * 0.06 : 1;
      roundBtn('buy_' + item, bx, cy - 4, 34, ok ? '#2fb84f' : '#b8ab98', null, () => buyGear(item, bx, cy), pulse);
      ctx.save(); ctx.translate(bx, cy - 4); ctx.scale(pulse, pulse); ctx.rotate(-0.5); ctx.fillStyle = '#8a5a2b'; rr(-4, -6, 8, 30, 3); ctx.fill(); ctx.fillStyle = '#e8eef7'; rr(-16, -18, 32, 14, 4); ctx.fill(); ctx.restore();
      if (!ok) { ctx.globalAlpha = 0.9; drawIcon('lock', bx + 22, cy - 26, 22); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  });
  for (const k in forgeShake) forgeShake[k] = Math.max(0, forgeShake[k] - dt * 3);
  // sparkle bursts
  for (let i = forgeFx.length - 1; i >= 0; i--) { const p = forgeFx[i]; p.life -= dt;
    if (p.ring) { circ(p.x, p.y, (0.6 - p.life) * 160, null, p.c, 6 * Math.max(0, p.life)); }
    else { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = clamp(p.life * 2, 0, 1); star(p.x, p.y, p.r, p.c); ctx.globalAlpha = 1; }
    if (p.life <= 0) forgeFx.splice(i, 1); }
  roundBtn('forgeBack', 48, H - 48, 34, '#7b5cff', 'back', closeForge);
}
/* the anvil button (HUD + map), with a pulsing dot when something can be made */
function forgeButton(id, x, y) {
  const can = anyAffordable(), s = forgeNudge > 0 ? 1 + Math.abs(Math.sin(now * 8)) * 0.15 : 1;
  roundBtn(id, x, y, 34, '#ff9f1c', 'anvil', openForge, s);
  if (can) { circ(x + 24, y - 24, 11 + Math.sin(now * 6) * 1.5, '#2fb84f', '#fff', 3); ctx.fillStyle = '#fff'; ctx.fillRect(x + 19, y - 25.5, 10, 3); ctx.fillRect(x + 22.5, y - 29, 3, 10); }
}
Snd.clang = function (v = 1) { this.tone(1250, 0.35, 'triangle', 0.18 * v, 1180); this.tone(2490, 0.25, 'sine', 0.08 * v, null, 0.01); this.noise(0.08, 0.35 * v, 4000); this.tone(1250, 0.3, 'triangle', 0.1 * v, 1150, 0.22); };

/* thick thorn bush: needs the stone sword (badge shows it) */
function drawThickThorn(o, cx, by) {
  shadow(cx, by, T * 0.46);
  const wob = Math.sin(now * 2 + o.x) * T * 0.01;
  circ(cx - T * 0.24, by - T * 0.3, T * 0.27, '#1d4a2a'); circ(cx + T * 0.24, by - T * 0.3, T * 0.27, '#1d4a2a'); circ(cx, by - T * 0.56 + wob, T * 0.32, '#245a31');
  circ(cx - T * 0.1, by - T * 0.42, T * 0.2, '#2b6638');
  ctx.fillStyle = '#7a2fd0';
  for (let k = 0; k < 14; k++) { const a = k * 0.45 + 0.2, r = T * 0.36; const x0 = cx + Math.cos(a) * r, y0 = by - T * 0.42 + Math.sin(a) * r * 0.8; ctx.beginPath(); ctx.moveTo(x0 - Math.sin(a) * T * 0.05, y0 + Math.cos(a) * T * 0.05); ctx.lineTo(x0 + Math.cos(a) * T * 0.17, y0 + Math.sin(a) * T * 0.17); ctx.lineTo(x0 + Math.sin(a) * T * 0.05, y0 - Math.cos(a) * T * 0.05); ctx.fill(); }
  // grey stone-hard knots
  circ(cx + T * 0.08, by - T * 0.6, T * 0.05, '#8a8f9e'); circ(cx - T * 0.18, by - T * 0.34, T * 0.04, '#8a8f9e');
  const bx = cx + T * 0.34, byy = by - T * 0.86, ok = gearStat('power', 'ruru') >= (o.power || 2);
  circ(bx, byy, T * 0.19, ok ? '#2fb84f' : '#fff', ok ? '#fff' : '#c98a4b', 3); drawGearIcon('sword', needTier('sword', 'power', o.power || 2), bx, byy, T * 0.3);
}
/* magic lantern: needs the crystal wand */
function drawMagicBase(o, cx, by) {
  for (let k = 0; k < 3; k++) { const x = cx + (k - 1) * T * 0.2, h = T * (0.22 + (k % 2) * 0.1); ctx.fillStyle = ['#7fe0ff', '#b06bff', '#7fe0ff'][k]; ctx.beginPath(); ctx.moveTo(x - T * 0.06, by); ctx.lineTo(x, by - h); ctx.lineTo(x + T * 0.06, by); ctx.fill(); }
  if (!o.lit) { const bx = cx - T * 0.34, byy = by - T * 1.0, ok = gearStat('magic', 'mielie') >= (o.magic || 2);
    circ(bx, byy, T * 0.19, ok ? '#2fb84f' : '#fff', ok ? '#fff' : '#b06bff', 3); drawGearIcon('wand', needTier('wand', 'magic', o.magic || 2), bx, byy, T * 0.3); }
}

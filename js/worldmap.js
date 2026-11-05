/* Mielie & Ruru - the WORLD MAP: a tall island in a dark, cloudy, magical sea. The Star-Elder Wand is a giant staff
 * up the middle (the path) with a golden ribbon spiralling round it; its crystal head holds the Evil Queen's
 * crystal castle. Villain lands are puzzle-piece regions on both sides (DATA.worldMap.lands, bottom -> top).
 * Playable lands light up; locked / coming-soon lands are dark and foggy. Found wand pieces glow on the staff.
 * Portrait, scrolls vertically (drag). Everything is drawn in code. */
'use strict';
let mapScroll = 0, mapVel = 0, mapSeenT = -9, mapPtr = null;
const MAPG = { lw: 0, lh: 250, step: 150, top: 600, bottom: 70 };
function mapLands() { return (DATA.worldMap && DATA.worldMap.lands) || LEVELS.map(a => ({ area: a.id, boss: a.boss && a.boss.id, theme: 'sea', color: '#46b85e' })); }
function mapWorldH() { const n = mapLands().length; return MAPG.bottom + MAPG.lh + (n - 1) * MAPG.step + MAPG.top; }
function landBox(k) {
  const lw = Math.min(W / 2 - 18, 230), side = k % 2 ? 1 : -1, x = side < 0 ? W / 2 - 8 - lw : W / 2 + 8;
  const y = mapWorldH() - MAPG.bottom - MAPG.lh - k * MAPG.step - mapScroll;
  return { x, y, w: lw, h: MAPG.lh, side };
}
function landOfArea(i) { return mapLands().findIndex(l => l.area === LEVELS[i].id); }
function mapNode(i) { const k = landOfArea(i), b = landBox(Math.max(0, k)); return { x: b.x + 54, y: b.y + 132 }; }
function mapClamp() { mapScroll = clamp(mapScroll, 0, Math.max(0, mapWorldH() - H)); }
function mapFocus(i) { const k = Math.max(0, landOfArea(i)); mapScroll = 0; const b = landBox(k); mapScroll = b.y + b.h / 2 - H * 0.55; mapVel = 0; mapClamp(); }
/* drag to scroll; buttons fire on release when the finger did not move */
function mapDown(x, y, b) { mapPtr = { y0: y, y: y, s0: mapScroll, b, moved: false, t: now }; mapVel = 0; }
function mapMove(x, y) { if (!mapPtr) return; const dy = y - mapPtr.y0; if (Math.abs(dy) > 12) mapPtr.moved = true; if (mapPtr.moved) { mapVel = (mapPtr.y - y) * 60; mapPtr.y = y; mapScroll = mapPtr.s0 - dy; mapClamp(); } }
function mapUp(x, y) { const p = mapPtr; mapPtr = null; if (!p) return; if (!p.moved && p.b) p.b.fn(); }
function landName(l) { return l.name || (l.boss && DATA.bosses[l.boss] && DATA.bosses[l.boss].name) || (l.area && DATA.areas[l.area].name) || '?'; }
function drawMap() {
  if (now - mapSeenT > 0.25) mapFocus(Math.min(S.level || 0, LEVELS.length - 1));
  mapSeenT = now;
  if (!mapPtr && Math.abs(mapVel) > 5) { mapScroll += mapVel / 60; mapVel *= 0.92; mapClamp(); }
  drawMapSea();
  drawIsland();
  const lands = mapLands();
  lands.forEach((l, k) => { const b = landBox(k); if (b.y > H + 40 || b.y + b.h < -40) return; drawLand(l, k, b); });
  drawStaff();
  drawCrystalHead();
  lands.forEach((l, k) => { const b = landBox(k); if (b.y > H + 40 || b.y + b.h < -40) return; drawLandUI(l, k, b); });
  drawMapHUD();
}
function drawMapSea() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d1240'); g.addColorStop(0.5, '#2b1a5c'); g.addColorStop(1, '#3a1f66'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const par = mapScroll * 0.4;
  // soft nebula glows drifting with parallax
  for (let k = 0; k < 5; k++) { const x = W * hash(k, 41), y = ((hash(41, k) * 1400 - par * 0.3) % 1400 + 1400) % 1400 - 200, r = 160 + 90 * hash(k, 43), c = ['255,120,200', '120,150,255', '190,110,255', '110,220,255', '255,190,120'][k];
    const ng = ctx.createRadialGradient(x, y, 0, x, y, r); ng.addColorStop(0, `rgba(${c},0.22)`); ng.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = ng; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let k = 0; k < 26; k++) { const x = hash(k, 5) * W, y = ((hash(5, k) * 1600 - par) % 1600 + 1600) % 1600 - 100; ctx.strokeStyle = 'rgba(160,120,255,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.quadraticCurveTo(x - 10, y - 6, x, y); ctx.quadraticCurveTo(x + 10, y + 6, x + 20, y); ctx.stroke(); }
  for (let k = 0; k < 30; k++) { const x = hash(k, 9) * W, y = ((hash(9, k) * 1800 - par * 0.6) % 1800 + 1800) % 1800 - 100, tw = 0.5 + 0.5 * Math.sin(now * 2 + k); twinkle(x, y, 2 + tw * 3, 0.3 + tw * 0.55, k % 4 ? '#fff4d0' : '#ffc2e6'); }
  floatingSparkles(14, 0.6);
  // soft purple clouds drifting at the edges
  for (let k = 0; k < 14; k++) {
    const side = k % 2 ? 1 : -1, y = ((k * 170 - mapScroll * 0.7) % 2400 + 2400) % 2400 - 200, x = side < 0 ? -30 + Math.sin(now * 0.3 + k) * 12 : W + 30 + Math.sin(now * 0.3 + k) * 12;
    for (let j = 0; j < 4; j++) circ(x - side * j * 28, y + (j % 2) * 22, 60 - j * 8, 'rgba(70,40,120,0.55)');
    circ(x - side * 10, y - 18, 40, 'rgba(120,90,190,0.25)');
  }
}
function drawIsland() {
  const top = landBox(mapLands().length - 1).y - 40, bot = landBox(0).y + MAPG.lh + 30;
  ctx.save(); ctx.shadowColor = '#b46cff'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#3a2a4a'; rr(4, top, W - 8, bot - top, 60); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#4a3a2a'; rr(10, bot - 40, W - 20, 50, 30); ctx.fill();
}
function landPath(b) {
  // a puzzle-piece shape: rounded box with a tab on the top edge and on the inner (staff) side
  const { x, y, w, h, side } = b, r = 26, tab = 16;
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.lineTo(x + w * 0.42, y); ctx.arc(x + w * 0.5, y + 2, tab, Math.PI, 0, false); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  if (side < 0) { ctx.lineTo(x + w, y + h * 0.42); ctx.arc(x + w - 2, y + h * 0.5, tab, -Math.PI / 2, Math.PI / 2, false); }
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + w * 0.58, y + h); ctx.arc(x + w * 0.5, y + h + 2, tab, 0, Math.PI, true);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  if (side > 0) { ctx.lineTo(x, y + h * 0.58); ctx.arc(x + 2, y + h * 0.5, tab, Math.PI / 2, -Math.PI / 2, true); }
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function landState(l) { if (!l.area) return 'soon'; const i = LEVELS.findIndex(a => a.id === l.area); return i < 0 ? 'soon' : i < S.unlocked ? 'open' : 'locked'; }
function drawLand(l, k, b) {
  const st = landState(l);
  // soft drop shadow under the card, plus a breathing glow on open lands
  ctx.save(); ctx.translate(0, 10); landPath(b); ctx.shadowColor = 'rgba(8,2,24,0.55)'; ctx.shadowBlur = 26; ctx.fillStyle = 'rgba(10,4,30,0.45)'; ctx.fill(); ctx.restore();
  ctx.save(); landPath(b);
  if (st === 'open') { ctx.shadowColor = `rgba(230,160,255,${0.65 + 0.3 * Math.sin(now * 2 + k)})`; ctx.shadowBlur = 22 + 8 * Math.sin(now * 2 + k); }
  if (st === 'open') { ctx.shadowColor = '#d58cff'; ctx.shadowBlur = 18; }
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, shade(l.color, 0.25)); g.addColorStop(1, l.color); ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0; ctx.clip();
  drawScenery(l.theme, b);
  { const sh = ctx.createLinearGradient(0, b.y, 0, b.y + b.h * 0.35); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(b.x, b.y, b.w, b.h * 0.35);
    const sweep = ((now * 0.25 + k * 0.37) % 1.6) - 0.3; if (st === 'open' && sweep < 1.1) { ctx.save(); ctx.translate(b.x + b.w * sweep, b.y); ctx.rotate(0.35); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-18, -40, 36, b.h + 80); ctx.restore(); } }
  if (st !== 'open') {
    ctx.fillStyle = st === 'soon' ? 'rgba(25,12,50,0.66)' : 'rgba(25,12,50,0.5)'; ctx.fillRect(b.x - 30, b.y - 30, b.w + 60, b.h + 60);
    for (let j = 0; j < 7; j++) { const fx = b.x + ((hash(k, j) * b.w + now * 10 * (j % 2 ? 1 : -1)) % b.w + b.w) % b.w, fy = b.y + 40 + hash(j, k) * (b.h - 60); ell(fx, fy, 50, 20, 'rgba(210,200,240,0.16)'); }
  }
  ctx.restore();
  landPath(b); ctx.strokeStyle = st === 'open' ? '#e4b8ff' : 'rgba(150,110,210,0.7)'; ctx.lineWidth = st === 'open' ? 4 : 3; ctx.stroke();
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = v => Math.round(v + (255 - v) * k); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function drawScenery(theme, b) {
  const { x, y, w, h } = b, gy = y + h * 0.78;
  const hill = (c, yy, amp) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 10, y + h + 10); ctx.lineTo(x - 10, yy); for (let i = 0; i <= 8; i++) ctx.lineTo(x + i * w / 8, yy + Math.sin(i * 1.7 + x) * amp); ctx.lineTo(x + w + 10, y + h + 10); ctx.fill(); };
  switch (theme) {
    case 'sea':
      hill('#2a8fb0', gy - 10, 8);
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); for (let j = 0; j <= 10; j++) ctx.lineTo(x + j * w / 10, gy + 10 + i * 18 + Math.sin(j + now * 2 + i) * 4); ctx.stroke(); }
      ctx.save(); ctx.translate(x + w * 0.5, gy - 4); ctx.fillStyle = '#ffb3c7'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(0, -30, 18, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      for (let i = 0; i < 4; i++) circ(x + 20 + i * 30, y + h * 0.6 - ((now * 20 + i * 30) % 60), 4, 'rgba(255,255,255,0.5)');
      break;
    case 'thorn':
      hill('#2d7a3e', gy, 10);
      ctx.strokeStyle = '#1f4d2a'; ctx.lineWidth = 6; for (let i = 0; i < 3; i++) { ctx.beginPath(); const sx = x + 20 + i * w * 0.35; ctx.moveTo(sx, y + h); ctx.bezierCurveTo(sx - 20, gy - 40, sx + 30, gy - 70, sx + 5, gy - 90); ctx.stroke(); for (let t = 0; t < 4; t++) circ(sx + (t % 2 ? 8 : -8), gy - t * 22, 4, '#0f3018'); }
      for (let i = 0; i < 5; i++) star(x + hash(i, 3) * w, y + 60 + hash(3, i) * 90, 4 + Math.sin(now * 3 + i) * 2, 'rgba(120,255,150,0.8)', 4);
      break;
    case 'savanna':
      hill('#c9792a', gy, 6);
      ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.moveTo(x + w * 0.45, gy); ctx.lineTo(x + w * 0.55, gy - 60); ctx.lineTo(x + w * 0.95, gy - 70); ctx.lineTo(x + w * 0.92, gy - 55); ctx.lineTo(x + w, gy); ctx.fill();
      ctx.fillStyle = '#5a3a18'; rr(x + 26, gy - 50, 6, 50, 3); ctx.fill(); ell(x + 29, gy - 54, 34, 10, '#3d6b2a');
      circ(x + w * 0.8, y + 70, 22, 'rgba(255,220,120,0.7)');
      break;
    case 'snow':
      hill('#ffffff', gy, 10);
      ctx.fillStyle = '#bfe9ff'; for (let i = 0; i < 4; i++) { const sx = x + 20 + i * w * 0.27; ctx.beginPath(); ctx.moveTo(sx - 12, gy); ctx.lineTo(sx, gy - 50 - (i % 2) * 20); ctx.lineTo(sx + 12, gy); ctx.fill(); }
      for (let i = 0; i < 8; i++) circ(x + hash(i, 7) * w, y + ((hash(7, i) * h + now * 20) % h), 2.5, 'rgba(255,255,255,0.9)');
      break;
    case 'flame':
      hill('#6b2a1a', gy, 6);
      ctx.fillStyle = '#4a1d12'; ctx.beginPath(); ctx.moveTo(x + w * 0.2, gy + 10); ctx.lineTo(x + w * 0.42, gy - 70); ctx.lineTo(x + w * 0.58, gy - 70); ctx.lineTo(x + w * 0.8, gy + 10); ctx.fill();
      ell(x + w * 0.5, gy - 70, w * 0.09, 6, '#ffb000');
      for (let i = 0; i < 5; i++) circ(x + w * 0.5 + Math.sin(now + i) * 20, gy - 80 - ((now * 30 + i * 20) % 80), 3, '#ffcf33');
      break;
    case 'cards':
      hill('#7a2238', gy, 4);
      for (let i = 0; i < 3; i++) { const sx = x + 24 + i * w * 0.3; ctx.fillStyle = i % 2 ? '#fff' : '#ffd6de'; rr(sx, gy - 60 - i * 8, 26, 60 + i * 8, 4); ctx.fill(); heart(sx + 13, gy - 70 - i * 8, 10, '#e8506a'); }
      break;
    case 'pirate':
      hill('#2a5a9a', gy - 6, 6);
      ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.moveTo(x + w * 0.2, gy - 10); ctx.lineTo(x + w * 0.8, gy - 10); ctx.lineTo(x + w * 0.7, gy + 12); ctx.lineTo(x + w * 0.3, gy + 12); ctx.fill();
      ctx.fillStyle = '#5a3a18'; rr(x + w * 0.49, gy - 80, 5, 70, 2); ctx.fill(); ctx.fillStyle = '#f5ead0'; ctx.beginPath(); ctx.moveTo(x + w * 0.52, gy - 76); ctx.quadraticCurveTo(x + w * 0.72, gy - 50, x + w * 0.52, gy - 20); ctx.fill();
      break;
    case 'fiesta':
      hill('#d96b2a', gy, 6);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.quadraticCurveTo(x + w / 2, y + 90, x + w, y + 60); ctx.stroke();
      ['#ff4d6d', '#ffd23f', '#4fc3a1', '#7b5cff', '#3fa9ff'].forEach((c, i) => { const fx = x + 20 + i * (w - 40) / 4; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(fx - 10, y + 68 + Math.sin(i) * 4); ctx.lineTo(fx + 10, y + 68 + Math.sin(i) * 4); ctx.lineTo(fx, y + 88); ctx.fill(); });
      for (let i = 0; i < 6; i++) circ(x + 16 + i * (w - 30) / 5, gy + 8, 7, '#ffb000');
      break;
    case 'desert':
      hill('#d9a84a', gy, 12);
      ctx.fillStyle = '#f5d27a'; rr(x + w * 0.55, gy - 46, 50, 46, 4); ctx.fill(); circ(x + w * 0.55 + 25, gy - 50, 18, '#ffcf33');
      break;
    case 'wolf':
      hill('#3a3270', gy, 8); circ(x + w * 0.75, y + 70, 18, '#fff6c2');
      ctx.fillStyle = '#1f2a4a'; for (let i = 0; i < 4; i++) { const sx = x + 16 + i * w * 0.22; ctx.beginPath(); ctx.moveTo(sx - 16, gy + 6); ctx.lineTo(sx, gy - 60); ctx.lineTo(sx + 16, gy + 6); ctx.fill(); }
      break;
    case 'robot':
      hill('#2d6b66', gy, 2);
      for (let i = 0; i < 4; i++) { const sx = x + 14 + i * w * 0.23, hh = 40 + (i % 3) * 22; ctx.fillStyle = '#1f3d4a'; rr(sx, gy - hh, 30, hh, 3); ctx.fill(); for (let j = 0; j < 3; j++) circ(sx + 15, gy - hh + 10 + j * 12, 3, Math.sin(now * 3 + i + j) > 0 ? '#7fffd4' : '#3a6b7a'); }
      break;
    case 'gloom':
      hill('#2a2a5a', gy, 10);
      for (let i = 0; i < 3; i++) { const fx = x + 30 + i * w * 0.32, fl = Math.sin(now * 6 + i) * 3; ctx.fillStyle = '#6fb8ff'; ctx.beginPath(); ctx.moveTo(fx - 8, gy - 10); ctx.quadraticCurveTo(fx, gy - 40 - fl, fx + 8, gy - 10); ctx.fill(); }
      break;
    default: hill(shade(b.color || '#46b85e', 0.1), gy, 8);
  }
}
function drawStaff() {
  const x = W / 2, yTop = landBox(mapLands().length - 1).y - 60, yBot = landBox(0).y + MAPG.lh + 6;
  const ribbon = front => { ctx.strokeStyle = front ? '#ffd23f' : '#b8860b'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    let on = false; ctx.beginPath();
    for (let y = yBot; y >= yTop; y -= 4) { const wy = y + mapScroll, ph = wy * 0.022, fx = Math.cos(ph) > 0; if (fx === front) { const px = x + Math.sin(ph) * 26; if (!on) { ctx.moveTo(px, y); on = true; } else ctx.lineTo(px, y); } else on = false; }
    ctx.stroke(); };
  const vis0 = Math.max(yTop, -20), vis1 = Math.min(yBot, H + 20);
  if (vis1 > vis0) {
    ribbon(false);
    const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0); g.addColorStop(0, '#5a3a1e'); g.addColorStop(0.5, '#a8743f'); g.addColorStop(1, '#5a3a1e');
    ctx.fillStyle = g; rr(x - 14, yTop, 28, yBot - yTop, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 5, yTop + 10); ctx.lineTo(x - 5, yBot - 10); ctx.stroke();
    ribbon(true);
  }
  // wand pieces: a glowing piece on the staff beside each land (dim socket until found)
  mapLands().forEach((l, k) => {
    const b = landBox(k), py = b.y + b.h * 0.5; if (py < -40 || py > H + 40) return;
    const d = l.boss && DATA.bosses[l.boss], p = d && d.piece, got = p && S.pieces && S.pieces[p] && l.area;
    if (got) { const gg = ctx.createRadialGradient(x, py, 4, x, py, 50); gg.addColorStop(0, 'rgba(255,240,150,0.95)'); gg.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = gg; ctx.fillRect(x - 50, py - 50, 100, 100); }
    circ(x, py, 18, got ? '#fff6c2' : 'rgba(40,20,70,0.85)', got ? '#ffd23f' : 'rgba(180,140,255,0.6)', 3);
    if (p && l.area) { ctx.save(); ctx.translate(x, py); ctx.globalAlpha = got ? 1 : 0.3; drawWandPiece(p, 30); ctx.restore(); ctx.globalAlpha = 1; }
    else star(x, py, 7, 'rgba(180,140,255,0.5)', 5);
  });
}
function drawCrystalHead() {
  const cx = W / 2, cy = landBox(mapLands().length - 1).y - 170; if (cy > H + 260 || cy < -300) return;
  const freed = S.done;
  // the Evil Queen's looming (but goofy) silhouette behind the crystal - she is Lillie-Bee under the spell
  if (!freed) {
    const sw = Math.sin(now * 1.2) * 4;
    ctx.save(); ctx.translate(cx, cy - 130 + sw); ctx.scale(1.25, 1.25); ctx.fillStyle = 'rgba(40,10,60,0.9)';
    ctx.beginPath(); ctx.moveTo(-150, 120); ctx.quadraticCurveTo(-120, -10, -70, -40); ctx.lineTo(-90, -110); ctx.lineTo(-40, -60); ctx.lineTo(40, -60); ctx.lineTo(90, -110); ctx.lineTo(70, -40); ctx.quadraticCurveTo(120, -10, 150, 120); ctx.closePath(); ctx.fill();
    circ(0, -78, 34, 'rgba(40,10,60,0.95)');
    ctx.fillStyle = '#ffcf33'; ctx.beginPath(); ctx.moveTo(-24, -104); ctx.lineTo(-18, -130); ctx.lineTo(-8, -112); ctx.lineTo(0, -136); ctx.lineTo(8, -112); ctx.lineTo(18, -130); ctx.lineTo(24, -104); ctx.closePath(); ctx.fill();
    const blink = (now % 4) < 0.15 ? 0.2 : 1;
    ell(-12, -80, 7, 5 * blink, '#e9a8ff'); ell(12, -80, 7, 5 * blink, '#e9a8ff');
    ctx.strokeStyle = '#e9a8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -66, 9, 0.2, Math.PI - 0.2); ctx.stroke();
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 120, 20); circ(0, 0, 14, 'rgba(200,120,255,' + (0.4 + 0.3 * Math.sin(now * 3)) + ')'); ctx.restore(); }
    ctx.restore();
  }
  // crystal head of the Star-Elder Wand
  const R = Math.min(W * 0.36, 150);
  ctx.save(); ctx.translate(cx, cy);
  ctx.shadowColor = freed ? '#ffd23f' : '#c15cff'; ctx.shadowBlur = 40;
  const g = ctx.createLinearGradient(0, -R, 0, R); g.addColorStop(0, freed ? '#fff2b0' : '#e0a8ff'); g.addColorStop(0.5, freed ? '#ffcf55' : '#9b3fe0'); g.addColorStop(1, freed ? '#d49a00' : '#4a1680');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -R * 0.75); ctx.lineTo(R, -R * 0.2); ctx.lineTo(R * 0.6, R * 0.6); ctx.lineTo(0, R * 0.9); ctx.lineTo(-R * 0.6, R * 0.6); ctx.lineTo(-R, -R * 0.2); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-R, -R * 0.2); ctx.lineTo(R, -R * 0.2); ctx.moveTo(0, -R * 0.75); ctx.lineTo(-R * 0.4, -R * 0.2); ctx.lineTo(0, R * 0.9); ctx.lineTo(R * 0.4, -R * 0.2); ctx.closePath(); ctx.stroke();
  // castle inside
  ctx.fillStyle = freed ? 'rgba(255,255,255,0.85)' : 'rgba(60,20,100,0.85)';
  rr(-R * 0.38, -R * 0.05, R * 0.76, R * 0.5, 4); ctx.fill();
  for (const [tx, th] of [[-0.38, 0.42], [-0.12, 0.6], [0.12, 0.6], [0.3, 0.42]]) { rr(R * tx, -R * th + R * 0.1, R * 0.1, R * th, 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(R * tx - 4, -R * th + R * 0.1); ctx.lineTo(R * tx + R * 0.05, -R * th - R * 0.08); ctx.lineTo(R * tx + R * 0.1 + 4, -R * th + R * 0.1); ctx.fill(); }
  ctx.fillStyle = freed ? '#ffd23f' : '#e9a8ff'; for (let k = 0; k < 4; k++) circ(-R * 0.22 + k * R * 0.15, R * 0.15, 4, null); for (let k = 0; k < 4; k++) { ctx.fillRect(-R * 0.24 + k * R * 0.15, R * 0.1, 6, 9); }
  for (let k = 0; k < 6; k++) { const a = now * 0.8 + k; star(Math.cos(a) * R * 0.9, Math.sin(a * 1.3) * R * 0.6, 4, 'rgba(255,255,255,0.8)', 4); }
  ctx.restore();
  // banner
  drawBanner2(cx, cy + R * 0.95 + 4, freed ? 'Crystal Castle' : 'Evil Queen', 150, freed);
}
function drawBanner2(x, y, label, w, lit) {
  const h = 34;
  ctx.fillStyle = lit === false ? '#a89a80' : '#c9a26b'; ctx.beginPath(); ctx.moveTo(x - w / 2 - 14, y - h / 2 + 4); ctx.lineTo(x - w / 2, y - h / 2 + 4); ctx.lineTo(x - w / 2, y + h / 2 + 4); ctx.lineTo(x - w / 2 - 14, y + h / 2 + 4); ctx.lineTo(x - w / 2 - 6, y + 4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w / 2 + 14, y - h / 2 + 4); ctx.lineTo(x + w / 2, y - h / 2 + 4); ctx.lineTo(x + w / 2, y + h / 2 + 4); ctx.lineTo(x + w / 2 + 14, y + h / 2 + 4); ctx.lineTo(x + w / 2 + 6, y + 4); ctx.fill();
  ctx.fillStyle = lit === false ? '#d8ccb4' : '#f5e3bd'; rr(x - w / 2, y - h / 2, w, h, 6); ctx.fill(); ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3; ctx.stroke();
  const fs = label.length > 13 ? 15 : 17; txt(label, x, y + 1, fs, '#4a2a10', null);
}
function drawLandUI(l, k, b) {
  const st = landState(l), name = landName(l), i = l.area ? LEVELS.findIndex(a => a.id === l.area) : -1;
  drawBanner2(b.x + b.w / 2, b.y + 26, name, Math.min(b.w - 40, 150), st === 'open');
  if (st === 'soon') {
    const cx = b.x + b.w / 2, cy = b.y + b.h * 0.55;
    circ(cx, cy, 38, 'rgba(255,255,255,0.18)', 'rgba(220,200,255,0.6)', 3);
    ctx.save(); ctx.globalAlpha = 0.55; if (l.boss && DATA.bosses[l.boss]) drawIcon('boss_' + l.boss, cx, cy, 56); else star(cx, cy, 22, '#cdb8ff', 5); ctx.restore(); ctx.globalAlpha = 1;
    circ(cx + 26, cy + 24, 17, '#fff', '#7b5cff', 3); drawIcon('lock', cx + 26, cy + 27, 26);
    ctx.fillStyle = 'rgba(123,92,255,0.9)'; rr(cx - 34, cy + 50, 68, 26, 13); ctx.fill(); txt('Soon', cx, cy + 63, 16, '#fff', null);
    return;
  }
  const n = mapNode(i), open = st === 'open', done = i < S.unlocked - 1 || (i === LEVELS.length - 1 && S.done), cur = i === S.level;
  const sc = (cur ? 1 + Math.sin(now * 4) * 0.06 : 1) * pressScale('area' + i);
  if (cur) for (let q = 0; q < 3; q++) { const t = (now * 0.7 + q / 3) % 1; ctx.globalAlpha = (1 - t) * 0.7; circ(n.x, n.y, 44 + t * 46, null, q % 2 ? '#ffd23f' : '#fff6a0', 5 * (1 - t) + 1); } ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(n.x, n.y); ctx.scale(sc, sc);
  if (cur) { const gg = ctx.createRadialGradient(0, 0, 20, 0, 0, 70); gg.addColorStop(0, 'rgba(255,230,120,0.6)'); gg.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = gg; ctx.fillRect(-70, -70, 140, 140); }
  ell(0, 40, 34, 9, 'rgba(10,4,30,0.35)'); circ(0, 6, 42, 'rgba(20,8,50,0.35)'); circ(0, 0, 42, open ? '#fff' : '#9d93b5', cur ? '#ffd23f' : '#7b5cff', 6); ell(-12, -24, 18, 7, 'rgba(255,255,255,0.5)');
  if (cur) for (let q = 0; q < 4; q++) { const a = now * 1.4 + q * TAU / 4; twinkle(Math.cos(a) * 54, Math.sin(a) * 54, 4 + 2 * Math.sin(now * 5 + q), 0.9, '#fff6a0'); }
  if (l.boss && DATA.bosses[l.boss]) { const beaten = S.pieces && S.pieces[DATA.bosses[l.boss].piece]; ctx.globalAlpha = open ? 1 : 0.5; drawIcon('boss_' + l.boss, 0, 0, 62); ctx.globalAlpha = 1; if (beaten) { circ(28, 28, 15, '#2fd36a', '#fff', 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(21, 28); ctx.lineTo(27, 34); ctx.lineTo(36, 22); ctx.stroke(); } }
  else drawIcon(LEVELS[i].icon, 0, 0, 52);
  if (!open) { circ(0, 0, 40, 'rgba(30,15,60,0.45)'); drawIcon('lock', 0, 4, 44); }
  circ(-32, -32, 16, '#ffd23f', '#fff', 3); txt(String(i + 1), -32, -31, 18, '#3b2a6b', null);
  if (done) star(32, -32, 17, '#ffd23f');
  ctx.restore();
  if (cur) { const ho = HERO_ORDER.filter(heroAvail); ho.forEach((h, q) => { const im = sprite(h + 'Head', 40); const hx = n.x + (q - (ho.length - 1) / 2) * 34, hy = n.y + 66 + Math.abs(Math.sin(now * 5 + q)) * -5; circ(hx, hy, 19, '#fff'); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 17, 0, TAU); ctx.clip(); ctx.drawImage(im, hx - 20, hy - 20, 40, 40); ctx.restore(); } }); }
  if (n.y > 140 && n.y < H - 90) btn('area' + i, n.x, n.y, 48, () => { if (!open) { Snd.nope(); return; } Snd.build(); const resume = i === S.level && S.heroes; enterLevel(i, !!resume); scene = 'play'; });
  // mini-game nodes down the outer column of the land
  const lv = LEVELS[i]; if (!open || !lv.minis) return;
  lv.minis.forEach((id, q) => {
    const def = DATA.minigames[id]; if (!def) return;
    const x = b.x + b.w - 40, y = b.y + 84 + q * 64, r = 30, pul = (1 + Math.sin(now * 3 + q) * 0.04) * pressScale('mini_' + i + '_' + id);
    ctx.save(); ctx.translate(x, y); ctx.scale(pul, pul); circ(0, 4, r, 'rgba(0,0,0,0.3)'); circ(0, 0, r, '#ffb347', '#fff', 4); drawIcon(def.icon, 0, -4, r * 1.05); ctx.restore();
    const best = (S.minis[id] && S.minis[id].best) || 0;
    for (let s = 0; s < 3; s++) star(x - 14 + s * 14, y + r - 8, 7, s < best ? '#ffd23f' : 'rgba(255,255,255,0.7)', 5);
    if (y > 140 && y < H - 90) btn('mini_' + i + '_' + id, x, y, 34, () => { Snd.tap(); startMini(id, i); });
  });
}
function drawMapHUD() {
  const ch = DATA.chapters[S.chapter || 0];
  ctx.fillStyle = 'rgba(30,15,60,0.55)'; ctx.fillRect(0, 0, W, 136);
  ctx.fillStyle = '#7b5cff'; rr(W / 2 - 130, 14, 260, 58, 29); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
  drawCrown(W / 2 - 92, 43, 30); txt(ch.name, W / 2 + 16, 44, 26);
  const inv = ['wood', 'stone', 'mielie', 'flower'], pw = Math.min(W - 24, 360), px = (W - pw) / 2, py = 82;
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; rr(px, py, pw, 44, 22); ctx.fill();
  inv.forEach((r, k) => { const x = px + 26 + k * (pw - 30) / inv.length; drawIcon(r, x, py + 22, 30); txt(String(S.inv[r] || 0), x + 30, py + 23, 22, '#3b2a6b', null); });
  // scroll hints
  const maxS = Math.max(0, mapWorldH() - H), bob = Math.sin(now * 4) * 4;
  if (mapScroll > 8) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(W / 2 - 16, 150 + bob); ctx.lineTo(W / 2 + 16, 150 + bob); ctx.lineTo(W / 2, 136 + bob); ctx.fill(); }
  if (mapScroll < maxS - 8) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(W / 2 - 16, H - 104 - bob); ctx.lineTo(W / 2 + 16, H - 104 - bob); ctx.lineTo(W / 2, H - 90 - bob); ctx.fill(); }
  roundBtn('mapHome', 48, H - 48, 34, '#7b5cff', 'home', () => { scene = 'title'; Snd.tap(); });
  forgeButton('mapForge', W - 48, H - 48);
}

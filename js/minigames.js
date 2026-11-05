/* Mielie & Ruru - resource mini-games (30-60 s, star-scored, replayable) launched from the area's map nodes.
 * Data: DATA.minigames (levels.js) {kind, name, icon, res, time, stars[3], reward[3]}; areas list them in `minis`.
 * Kinds: chop (timing bar), mine (whack-a-rock), catch (basket), pairs (memory cards). Every hero can play every
 * game; the chosen hero acts it out on screen. 0 stars still gives 1 of the resource - nobody leaves empty-handed. */
'use strict';
const MINI_BG = { chop: ['#bff0a0', '#5fbf5a'], mine: ['#d9cfc2', '#8f7f6f'], catch: ['#bfe8ff', '#7fd07a'], pairs: ['#ffe0f0', '#c6a2ff'] };
const MINI_ACT = { mielie: 'Zap!', ruru: 'Bonk!', lillie: 'Twang!' };
function miniDef(id) { const d = (DATA.minigames || {})[id]; return d ? Object.assign({ kind: id, time: 30, stars: [3, 6, 9], reward: [1, 2, 3] }, d) : null; }
function startMini(id, area) {
  const def = miniDef(id); if (!def) return;
  const pick = heroAvail(S.active) ? S.active : miniHeroes()[0];
  MG = { id, def, kind: def.kind, area, phase: 'pick', t: 0, hero: pick || 'mielie', score: 0, fx: [], hop: 0 };
  scene = 'mini'; S.minis = S.minis || {};
}
function miniHeroes() { return HERO_ORDER.filter(n => heroAvail(n)); }
function miniBegin() {
  const m = MG; m.phase = 'count'; m.t = 0; m.score = 0; m.fx = []; m.left = m.def.time; m.spawn = 0;
  const k = m.kind;
  if (k === 'chop') { m.bar = 0; m.dir = 1; m.speed = 0.7; m.zone = 0.5; m.zw = 0.24; m.log = 0; }
  if (k === 'mine') { m.holes = Array.from({ length: 9 }, () => ({ up: 0, life: 0, gem: false, hit: 0 })); }
  if (k === 'catch') { m.bx = W / 2; m.drops = []; }
  if (k === 'pairs') {
    const icons = ['wood', 'stone', 'mielie', 'flower', 'gems', 'heart'], deck = icons.concat(icons);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    m.cards = deck.map(icon => ({ icon, up: false, done: false, flip: 0 })); m.open = []; m.wait = 0;
  }
}
function miniEnd() {
  const m = MG; if (m.phase === 'done') return;
  m.phase = 'done'; m.t = 0;
  const st = m.def.stars.filter(s => m.score >= s).length;
  m.stars = st; m.reward = st ? m.def.reward[st - 1] : 1;
  S.inv[m.def.res] = (S.inv[m.def.res] || 0) + m.reward;
  const rec = S.minis[m.id] = S.minis[m.id] || { best: 0, plays: 0 }; rec.plays = (rec.plays || 0) + 1; m.newBest = st > rec.best; rec.best = Math.max(rec.best, st);
  if (st) { const P = DATA.power || {}; S.power = Math.min(powerMax(), (S.power || 0) + st * ((P.gain && P.gain.collect) || 3) * 3); }
  persist(); Snd.fanfare(); for (let k = 0; k < st; k++) later(0.35 + k * 0.3, () => Snd.pop());
}
function miniFx(x, y, kind, n, col) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(80, 320); MG.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: rnd(0.5, 0.9), kind, col: col || '#ffd23f', r: rnd(4, 9) }); } }
function miniScore(n, x, y) {
  const m = MG; m.score += n; m.hop = 1; Snd.collect(); miniFx(x, y, 'star', 10 + n * 4);
  m.fx.push({ x, y: y - 20, vx: 0, vy: -90, life: 0.9, kind: 'num', n });
}
function updateMini(dt) {
  const m = MG; if (!m) return; m.t += dt; m.hop = Math.max(0, m.hop - dt * 3);
  for (const p of m.fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind !== 'num') p.vy += 500 * dt; }
  m.fx = m.fx.filter(p => p.life > 0);
  if (m.phase === 'count' && m.t >= 2.1) { m.phase = 'play'; m.t = 0; Snd.fanfare(); }
  if (m.phase !== 'play') return;
  m.left = Math.max(0, m.def.time - m.t);
  if (m.left <= 0) { miniEnd(); return; }
  if (m.kind === 'chop') {
    m.bar += m.dir * m.speed * dt; if (m.bar > 1) { m.bar = 1; m.dir = -1; } if (m.bar < 0) { m.bar = 0; m.dir = 1; }
    m.log = Math.max(0, m.log - dt * 3);
  } else if (m.kind === 'mine') {
    m.spawn -= dt;
    const upN = m.holes.filter(h => h.up > 0).length;
    if (m.spawn <= 0 && upN < 3) {
      const free = m.holes.map((h, i) => i).filter(i => m.holes[i].up <= 0 && m.holes[i].hit <= 0);
      if (free.length) { const h = m.holes[free[Math.floor(Math.random() * free.length)]]; h.up = 0.001; h.life = rnd(1.3, 1.9); h.gem = Math.random() < 0.15; Snd.boing(); }
      m.spawn = rnd(0.45, 0.85);
    }
    for (const h of m.holes) { if (h.up > 0) { h.up += dt; if (h.up > h.life) h.up = 0; } h.hit = Math.max(0, h.hit - dt); }
  } else if (m.kind === 'catch') {
    m.spawn -= dt;
    if (m.spawn <= 0) { m.drops.push({ x: rnd(50, W - 50), y: -40, v: rnd(220, 320) + m.t * 4, gold: Math.random() < 0.15, rot: rnd(0, TAU) }); m.spawn = rnd(0.45, 0.8); }
    const by = H * 0.78;
    for (const d of m.drops) {
      d.y += d.v * dt; d.rot += dt * 2;
      if (!d.got && d.y >= by - 20 && d.y <= by + 30 && Math.abs(d.x - m.bx) < 72) { d.got = true; miniScore(d.gold ? 2 : 1, d.x, by - 30); }
    }
    m.drops = m.drops.filter(d => !d.got && d.y < H + 50);
  } else if (m.kind === 'pairs') {
    for (const c of m.cards) c.flip += ((c.up || c.done ? 1 : 0) - c.flip) * Math.min(1, dt * 12);
    if (m.wait > 0) { m.wait -= dt; if (m.wait <= 0) { m.open.forEach(i => m.cards[i].up = false); m.open = []; } }
    if (m.cards.every(c => c.done) && !m.allT) { m.allT = 1; later(0.6, miniEnd); }
  }
}
/* ---- layout helpers (also used by the test hooks) ---- */
function mineHole(i) { const s = Math.min(W * 0.3, 128), c = i % 3, r = Math.floor(i / 3); return { x: W / 2 + (c - 1) * s, y: H * 0.36 + r * s * 1.02, r: s * 0.4 }; }
function pairCard(i) { const cw = Math.min((W - 40) / 3 - 12, 120), ch = Math.min((H * 0.62) / 4 - 12, 140), c = i % 3, r = Math.floor(i / 3); return { x: W / 2 + (c - 1) * (cw + 12), y: H * 0.24 + ch / 2 + r * (ch + 12), w: cw, h: ch }; }
function miniTap(x, y) {
  const m = MG; if (!m) return;
  if (m.phase !== 'play') return;
  if (m.kind === 'chop') {
    const inZone = Math.abs(m.bar - m.zone) <= m.zw / 2;
    if (inZone) { Snd.chop(); m.log = 1; miniScore(1, W / 2, H * 0.42); m.zone = rnd(0.2, 0.8); m.speed = Math.min(1.6, m.speed + 0.06); m.zw = Math.max(0.16, m.zw - 0.005); }
    else { Snd.boing(); m.miss = 0.3; }
  } else if (m.kind === 'mine') {
    m.holes.forEach((h, i) => { const p = mineHole(i); if (h.up > 0 && Math.hypot(x - p.x, y - p.y) < p.r * 1.25) { h.up = 0; h.hit = 0.4; Snd.rock(); miniScore(h.gem ? 2 : 1, p.x, p.y - 20); if (h.gem) miniFx(p.x, p.y, 'gem', 8, '#3fa9ff'); } });
  } else if (m.kind === 'catch') { miniMove(x, y); }
  else if (m.kind === 'pairs') {
    if (m.wait > 0 || m.open.length >= 2) return;
    m.cards.forEach((c, i) => {
      const p = pairCard(i); if (c.up || c.done || Math.abs(x - p.x) > p.w / 2 || Math.abs(y - p.y) > p.h / 2) return;
      c.up = true; m.open.push(i); Snd.page();
      if (m.open.length === 2) {
        const [a, b] = m.open.map(k => m.cards[k]);
        if (a.icon === b.icon) { a.done = b.done = true; m.open = []; later(0.2, () => miniScore(1, p.x, p.y)); }
        else { m.wait = 0.9; later(0.3, () => Snd.hmph()); }
      }
    });
  }
}
function miniMove(x, y) { if (MG && MG.kind === 'catch' && MG.phase === 'play') MG.bx = clamp(x, 60, W - 60); }
function miniView() {
  const m = MG; if (!m || scene !== 'mini') return null;
  const v = { id: m.id, kind: m.kind, phase: m.phase, score: m.score, hero: m.hero, left: m.left, stars: m.stars, reward: m.reward, targets: [] };
  if (m.phase === 'play') {
    if (m.kind === 'chop') v.inZone = Math.abs(m.bar - m.zone) <= m.zw / 2;
    if (m.kind === 'mine') v.targets = m.holes.map((h, i) => h.up > 0 ? mineHole(i) : null).filter(Boolean);
    if (m.kind === 'catch') v.targets = m.drops.map(d => ({ x: d.x, y: d.y }));
    if (m.kind === 'pairs') { const by = {}; m.cards.forEach((c, i) => { if (!c.done) (by[c.icon] = by[c.icon] || []).push(pairCard(i)); }); v.pairs = Object.values(by); }
  }
  return v;
}
/* ---- drawing ---- */
function drawMini() {
  const m = MG; if (!m) { scene = 'map'; return; }
  const bg = MINI_BG[m.kind] || ['#ffe9b8', '#ffd08a'], g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 14; k++) circ(hash(k, 3) * W, hash(3, k) * H, 18 + hash(k, 7) * 30, 'rgba(255,255,255,0.18)');
  if (m.phase === 'pick') drawMiniPick();
  else {
    if (m.kind === 'chop') drawChop(); else if (m.kind === 'mine') drawMine(); else if (m.kind === 'catch') drawCatch(); else drawPairs();
    drawMiniHero();
    drawMiniTop();
    if (m.phase === 'count') { const n = 3 - Math.floor(m.t / 0.6), s = 1.4 - (m.t % 0.6); ctx.fillStyle = 'rgba(30,20,60,0.35)'; ctx.fillRect(0, 0, W, H); txt(n > 0 ? String(n) : 'Go!', W / 2, H * 0.45, Math.round(110 * s), '#fff', '#7b5cff'); }
    if (m.phase === 'done') drawMiniDone();
  }
  for (const p of m.fx) {
    if (p.kind === 'num') { ctx.globalAlpha = Math.min(1, p.life * 2); txt('+' + p.n, p.x, p.y, 34, '#fff', '#2a8f6f'); ctx.globalAlpha = 1; }
    else if (p.kind === 'gem') star(p.x, p.y, p.r, p.col, 4);
    else star(p.x, p.y, p.r * Math.min(1, p.life * 2), p.col, 5);
  }
  if (m.phase !== 'done') { roundBtnX('mclose', W - 44, m.phase === 'pick' ? 52 : 132, 30, () => { Snd.tap(); persist(); MG = null; scene = 'map'; }); }
}
function roundBtnX(id, x, y, r, fn) { circ(x, y + 4, r, 'rgba(0,0,0,0.2)'); circ(x, y, r, '#ff6b6b', '#fff', 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 0.35, y - r * 0.35); ctx.lineTo(x + r * 0.35, y + r * 0.35); ctx.moveTo(x + r * 0.35, y - r * 0.35); ctx.lineTo(x - r * 0.35, y + r * 0.35); ctx.stroke(); btn(id, x, y, Math.max(r, 34), fn); }
function drawMiniPick() {
  const m = MG, d = m.def, bob = Math.sin(now * 3) * 6;
  circ(W / 2, H * 0.2 + bob, 74, '#fff', '#7b5cff', 6); drawIcon(d.icon, W / 2, H * 0.2 + bob, 96);
  txt(d.name, W / 2, H * 0.2 + 108, 40, '#fff', '#3b2a6b');
  const best = (S.minis[m.id] && S.minis[m.id].best) || 0;
  for (let k = 0; k < 3; k++) star(W / 2 + (k - 1) * 44, H * 0.2 + 158, 18, k < best ? '#ffd23f' : 'rgba(255,255,255,0.55)', 5);
  const hs = miniHeroes(), gap = Math.min(118, (W - 40) / Math.max(1, hs.length));
  hs.forEach((n, k) => {
    const x = W / 2 + (k - (hs.length - 1) / 2) * gap, y = H * 0.55, on = n === m.hero, r = on ? 50 : 42;
    if (on) { const gg = ctx.createRadialGradient(x, y, 20, x, y, 90); gg.addColorStop(0, 'rgba(255,255,255,0.9)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gg; ctx.fillRect(x - 90, y - 90, 180, 180); }
    circ(x, y + 5, r, 'rgba(0,0,0,0.2)'); circ(x, y, r, HERO[n].color);
    const im = sprite(n + 'Head', r * 2); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 4, 0, TAU); ctx.clip(); ctx.drawImage(im, x - r, y - r, r * 2, r * 2); ctx.restore(); }
    circ(x, y, r, null, on ? '#ffd23f' : '#fff', on ? 7 : 4);
    if (on) { circ(x + r * 0.7, y - r * 0.7, 16, '#2fd36a', '#fff', 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + r * 0.7 - 7, y - r * 0.7); ctx.lineTo(x + r * 0.7 - 1, y - r * 0.7 + 6); ctx.lineTo(x + r * 0.7 + 8, y - r * 0.7 - 6); ctx.stroke(); }
    btn('mhero_' + n, x, y, Math.max(r, 40), () => { m.hero = n; Snd.swap(); });
  });
  const pb = 1 + Math.sin(now * 5) * 0.04;
  ctx.save(); ctx.translate(W / 2, H * 0.74); ctx.scale(pb, pb); ctx.translate(-W / 2, -H * 0.74);
  pillBtn('mplay', W / 2, H * 0.74, 220, 84, '#2fd36a', 'Play', d.icon, () => { Snd.tap(); miniBegin(); });
  ctx.restore();
  txt('+' + d.reward[2], W / 2 + 26, H * 0.74 + 74, 26, '#fff', '#3b2a6b'); drawIcon(d.res, W / 2 - 22, H * 0.74 + 74, 34);
}
function drawMiniTop() {
  const m = MG, d = m.def, k = m.phase === 'play' ? m.left / d.time : 1;
  // timer pie + score pill
  circ(54, 132, 34, '#fff', '#7b5cff', 4);
  ctx.fillStyle = k < 0.2 ? '#ff6b6b' : '#ffd23f'; ctx.beginPath(); ctx.moveTo(54, 132); ctx.arc(54, 132, 28, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(59,42,107,0.6)'; rr(W / 2 - 80, 100, 160, 64, 32); ctx.fill();
  drawIcon(d.icon, W / 2 - 42, 132, 44); txt(String(m.score), W / 2 + 26, 133, 40, '#fff', null);
  for (let s = 0; s < 3; s++) star(W / 2 - 40 + s * 40, 186, 14, m.score >= d.stars[s] ? '#ffd23f' : 'rgba(255,255,255,0.5)', 5);
}
function drawMiniHero() {
  const m = MG, pairs = m.kind === 'pairs', im = heroSprite(m.hero, pairs ? H * 0.12 : H * 0.2); if (!im) return;
  const x = m.kind === 'catch' ? W * 0.12 : W * 0.15, y = pairs ? H - 4 : H * 0.93, hop = Math.sin(m.hop * Math.PI) * 30;
  ctx.save(); ctx.translate(x, y - hop); if (m.hop > 0) ctx.rotate(Math.sin(m.hop * 12) * 0.1); ctx.drawImage(im, -im.dw / 2, -im.dh, im.dw, im.dh); ctx.restore();
  if (m.hop > 0.5) txt(MINI_ACT[m.hero] || 'Yay!', x + 40, y - im.dh - 10, 26, '#fff', HERO[m.hero].color);
}
function drawChop() {
  const m = MG, cx = W / 2, cy = H * 0.5, s = 1 + m.log * 0.1;
  // the log
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(m.log * 20) * 0.06 * m.log); ctx.scale(s, s);
  ctx.fillStyle = '#9b5a2a'; rr(-120, -50, 240, 100, 40); ctx.fill(); ell(120, 0, 38, 50, '#e8b57a'); ctx.strokeStyle = '#b87a45'; ctx.lineWidth = 4; for (let r = 10; r < 40; r += 10) { ctx.beginPath(); ctx.ellipse(120, 0, r * 0.76, r, 0, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = '#7b4420'; ctx.lineWidth = 5; for (let k = -2; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 40, -40); ctx.lineTo(k * 40 + 20, 40); ctx.stroke(); }
  circ(-40, -6, 7, '#fff'); circ(10, -6, 7, '#fff'); circ(-40, -6, 3, '#222'); circ(10, -6, 3, '#222');
  ctx.restore();
  // the timing bar
  const bx = 30, bw = W - 60, by = H * 0.63, bh = 54;
  ctx.fillStyle = '#fff'; rr(bx, by, bw, bh, 27); ctx.fill(); ctx.strokeStyle = '#7b5cff'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#2fd36a'; rr(bx + bw * (m.zone - m.zw / 2), by + 5, bw * m.zw, bh - 10, 20); ctx.fill(); drawIcon('wood', bx + bw * m.zone, by + bh / 2, 32);
  const mx = bx + bw * m.bar; ctx.fillStyle = m.miss > 0 ? '#ff6b6b' : '#3b2a6b'; ctx.beginPath(); ctx.moveTo(mx, by - 6); ctx.lineTo(mx - 16, by - 30); ctx.lineTo(mx + 16, by - 30); ctx.fill(); rr(mx - 5, by - 6, 10, bh + 12, 5); ctx.fill();
  if (m.miss > 0) m.miss -= 1 / 60;
  if (m.phase === 'play' && m.t < 3) { const hb = Math.sin(now * 6) * 8; drawHand(W / 2 + 30, H * 0.82 + hb); }
}
function drawHand(x, y) { ctx.save(); ctx.translate(x, y); circ(0, 0, 22, '#ffd9b3', '#c98a4b', 3); ctx.fillStyle = '#ffd9b3'; rr(-7, -42, 14, 34, 7); ctx.fill(); ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
function drawMine() {
  const m = MG;
  m.holes.forEach((h, i) => {
    const p = mineHole(i);
    ell(p.x, p.y + p.r * 0.45, p.r * 1.05, p.r * 0.42, '#4a3b30'); ell(p.x, p.y + p.r * 0.45, p.r * 0.85, p.r * 0.3, '#2a201a');
    if (h.up > 0) {
      const k = Math.min(1, h.up / 0.2, (h.life - h.up) / 0.2), yy = p.y + p.r * 0.45 - k * p.r * 0.7;
      ctx.save(); ctx.beginPath(); ctx.rect(p.x - p.r * 1.2, p.y - p.r * 1.6, p.r * 2.4, p.r * 2.05); ctx.clip();
      ell(p.x, yy, p.r * 0.75, p.r * 0.62, h.gem ? '#9fd8ff' : '#a39a90'); ell(p.x - p.r * 0.2, yy - p.r * 0.25, p.r * 0.25, p.r * 0.12, 'rgba(255,255,255,0.5)');
      if (h.gem) { star(p.x, yy - p.r * 0.05, p.r * 0.3, '#3fa9ff', 4); }
      circ(p.x - p.r * 0.22, yy + p.r * 0.05, p.r * 0.13, '#fff'); circ(p.x + p.r * 0.22, yy + p.r * 0.05, p.r * 0.13, '#fff');
      circ(p.x - p.r * 0.2, yy + p.r * 0.08, p.r * 0.06, '#222'); circ(p.x + p.r * 0.24, yy + p.r * 0.08, p.r * 0.06, '#222');
      ctx.restore();
    }
    if (h.hit > 0) { for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + now; circ(p.x + Math.cos(a) * p.r * (1.4 - h.hit), p.y + Math.sin(a) * p.r * 0.5 * (1.4 - h.hit), 6, '#a39a90'); } }
  });
}
function drawCatch() {
  const m = MG, by = H * 0.78;
  for (const d of m.drops) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(Math.sin(d.rot) * 0.4); if (d.gold) { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 40); g.addColorStop(0, 'rgba(255,230,90,0.8)'); g.addColorStop(1, 'rgba(255,230,90,0)'); ctx.fillStyle = g; ctx.fillRect(-40, -40, 80, 80); } drawIcon('mielie', 0, 0, d.gold ? 62 : 54); ctx.restore(); }
  // basket
  const x = m.bx; ctx.fillStyle = '#c98a4b'; ctx.beginPath(); ctx.moveTo(x - 70, by - 18); ctx.lineTo(x + 70, by - 18); ctx.lineTo(x + 52, by + 40); ctx.lineTo(x - 52, by + 40); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 4; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 26, by - 18); ctx.lineTo(x + k * 20, by + 40); ctx.stroke(); }
  ctx.fillStyle = '#e0a868'; rr(x - 76, by - 26, 152, 16, 8); ctx.fill();
  if (m.phase === 'play' && m.t < 3) { txt('< >', x, by + 70, 30, '#fff', '#3b2a6b'); }
}
function drawPairs() {
  const m = MG;
  m.cards.forEach((c, i) => {
    const p = pairCard(i), f = c.flip, sx = Math.abs(Math.cos(f * Math.PI)), face = f > 0.5;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.max(0.05, sx), 1);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; rr(-p.w / 2, -p.h / 2 + 5, p.w, p.h, 18); ctx.fill();
    ctx.fillStyle = face ? (c.done ? '#eafff0' : '#fff') : '#7b5cff'; rr(-p.w / 2, -p.h / 2, p.w, p.h, 18); ctx.fill(); ctx.strokeStyle = c.done ? '#2fd36a' : '#fff'; ctx.lineWidth = 5; ctx.stroke();
    if (face) drawIcon(c.icon, 0, 0, Math.min(p.w, p.h) * 0.62); else { star(0, 0, p.w * 0.22, '#ffd23f', 5); }
    ctx.restore();
  });
}
function drawMiniDone() {
  const m = MG, a = easeOut(Math.min(1, m.t * 3));
  ctx.fillStyle = `rgba(30,20,60,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W - 32, 380), ph = 420, x0 = (W - pw) / 2, y0 = (H - ph) / 2;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(a, a); ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = '#ffe9b8'; rr(x0, y0, pw, ph, 30); ctx.fill(); ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = 8; ctx.stroke();
  for (let k = 0; k < 3; k++) { const on = k < m.stars, sk = on ? easeOut(clamp((m.t - 0.35 - k * 0.3) * 4, 0, 1)) : 1; star(W / 2 + (k - 1) * 92, y0 + 80 - (k === 1 ? 16 : 0), 40 * (on ? sk : 1), on ? '#ffd23f' : '#d9c7a0', 5); }
  const im = sprite(m.hero + 'Head', 110); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y0 + 190, 52, 0, TAU); ctx.clip(); ctx.drawImage(im, W / 2 - 55, y0 + 135, 110, 110); ctx.restore(); circ(W / 2, y0 + 190, 52, null, '#fff', 5); }
  drawIcon(m.def.res, W / 2 - 34, y0 + 286, 60); txt('+' + m.reward, W / 2 + 36, y0 + 288, 46, '#2a8f6f', '#fff');
  ctx.restore();
  if (m.t > 0.5) {
    roundBtn('magain', W / 2 - 74, y0 + ph - 62, 40, '#ff9f1c', 'reset', () => { Snd.tap(); miniBegin(); });
    roundBtn('mback', W / 2 + 74, y0 + ph - 62, 40, '#2fd36a', 'home', () => { Snd.tap(); MG = null; scene = 'map'; });
  }
}

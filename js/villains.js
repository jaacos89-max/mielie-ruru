/* Mielie & Ruru - villains: area bosses guarding pieces of the Star-Elder Wand, waves of goofy minions,
 * and the chapter twist (Lillie-Bee under the Zombie King's spell as the Evil Queen; break the mirrors to free her).
 * All characters here are original, goofy designs. Loaded after game.js and shares its globals. */
'use strict';

/* ---------------- data helpers ---------------- */
function bossDef(o) { return (DATA.bosses || {})[o.boss] || { name: '?', needs: HERO_ORDER, piece: 'tip', say: ['!'], hurt: ['!'], lose: '!' }; }
function wandPieces() { return (DATA.wand && DATA.wand.pieces) || []; }
function heroAvail(n) { return !(n === ARCHER && S && S.twist === 'queen'); }
function areaBoss() { return L ? L.objs.find(o => o.type === 'boss' && !o.gone && !o.beaten) : null; }
function armorOff(o) { const d = bossDef(o); return !d.armor || (o.hits || []).includes(d.armor) || !heroes[d.armor]; }
function bossNeed(o) { return (bossDef(o).needs || []).filter(n => heroes[n] && !(o.hits || []).includes(n)); }
function chapterOf(i) { const id = LEVELS[i] && LEVELS[i].id; return (DATA.chapters || []).find(c => c.areas.includes(id)) || (DATA.chapters || [])[0]; }
function twistDef() { const c = chapterOf(L ? L.i : (S ? S.level : 0)); return c && c.twist; }
function chapterPieces(c) { return c.areas.map(a => { const ar = LEVELS.find(l => l.id === a); return ar && ar.boss && DATA.bosses[ar.boss.id]; }).filter(Boolean).map(b => b.piece); }
function allPieces(c) { const ps = chapterPieces(c); return ps.length > 0 && ps.every(p => S.pieces[p]); }
function pickLine(a) { return a && a.length ? a[(Math.random() * a.length) | 0] : '!'; }
const MINION_KINDS = {
  blob: { say: 'Blorp!', step: 1.4 }, raven: { say: 'Caw!', step: 0.95 }, imp: { say: 'Hee hee!', step: 1.2 },
  jackal: { say: 'Yip yip!', step: 1.0 }, snowball: { say: 'Brrr!', step: 1.3 }, ember: { say: 'Fizz!', step: 1.1 }
};

/* ---------------- minion fights ---------------- */
function maxHearts() { return 3 + 2 * (gearStat('guard', 'ruru') || 0); }
function startFight(o) {
  if (fight || !o || o.cleared || o.gone || o.beaten || now < (o.rest || 0)) return;
  const d = bossDef(o), w = (d.minions && d.minions.waves) || [];
  if (!w.length) { o.cleared = true; return; }
  fight = { boss: o, wave: -1, hearts: maxHearts(), max: maxHearts(), next: 0.7, flash: 0 };
  Snd.roar(); o.shake = 1; shakeAmt = 5; tempBubble(o, [{ text: d.say[0] }], 1.8); hintCache.t = -1;
}
function fightUpdate(dt) {
  if (!fight || !L) return;
  const f = fight; decay(f, 'flash', dt, 2);
  if (f.boss.gone || f.boss.beaten || !L.objs.includes(f.boss)) { fight = null; return; }
  if (L.objs.some(z => z.minion && !z.gone)) return;
  f.next -= dt * SPEED; if (f.next > 0) return;
  const d = bossDef(f.boss), waves = d.minions.waves;
  if (f.wave + 1 < waves.length) { f.wave++; spawnWave(f.boss, d, waves[f.wave], f.wave); f.next = 0.8; return; }
  // every wave is dust: the villain is open for the heroes
  const b = f.boss; b.cleared = true; fight = null; Snd.build(); b.shake = 1; burst(b.x + 0.5, b.y + 0.2, 'spark', 24, 1.5);
  tempBubble(b, armorOff(b) ? bossNeed(b).map(n => ({ head: n })) : [{ head: d.armor }, { icon: 'sword' }, { icon: 'armor' }], 2.6);
  hintCache.t = -1; persist();
}
function spawnTiles(b) {
  const a = activeHero(), out = [];
  if (!a) return out;
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const d = Math.abs(x - b.x) + Math.abs(y - b.y); if (d < 1 || d > 4) continue;
    if (!walkable(x, y) || objAt(x, y)) continue;
    if (Object.values(heroes).some(h => Math.abs(h.x - x) + Math.abs(h.y - y) < 2)) continue;
    if (!findPath(a, [{ x, y }])) continue;
    out.push({ x, y, k: d + Math.random() * 1.5 });
  }
  return out.sort((p, q) => p.k - q.k);
}
function spawnWave(b, d, n, wi) {
  const tiles = spawnTiles(b), kinds = d.minions.kinds || ['plain'];
  for (let k = 0; k < n && k < tiles.length; k++) {
    const t = tiles[k], z = makeObj('zombie', t.x, t.y);
    z.kind = kinds[(wi + k) % kinds.length]; z.minion = true; z.wait = 1.0 + k * 0.35; z.facing = -1; z.pop = 1;
    L.objs.push(z); burst(t.x + 0.5, t.y + 0.5, 'puff', 10, 1);
  }
  Snd.groan(0.6); b.shake = 1; b.cast = 1; tempBubble(b, [{ text: pickLine(d.say) }], 1.5);
}
function minionStep(z) {
  if (!fight) { if (!z.poof) { z.poof = 0.001; later(0.2, () => { z.gone = true; }); } return; }
  const step = (MINION_KINDS[z.kind] || {}).step || 1.4;
  if (z.mt < step) return;
  const hs = Object.values(heroes); if (!hs.length) return;
  let bp = null;
  for (const h of hs) { const p = findPath(z, nbrs(h).concat([{ x: h.x, y: h.y }])); if (p && (!bp || p.length < bp.length)) bp = p; }
  if (!bp || !bp.length) { // next to a hero already: bump them
    const h = hs.find(h => Math.abs(h.x - z.x) + Math.abs(h.y - z.y) === 1 && !h.path.length);
    if (h && Math.random() < 0.5) { z.facing = h.x >= z.x ? 1 : -1; z.chomp = 1; bumpHero(h, z); }
    z.mt = step * 0.4; return;
  }
  const t = bp[0];
  const hit = hs.find(h => (h.x === t.x && h.y === t.y) || (h.path[0] && h.path[0].x === t.x && h.path[0].y === t.y));
  if (hit) { bumpHero(hit, z); z.mt = 0; return; }
  if (!walkable(t.x, t.y)) { z.mt = step * 0.5; return; }
  z.px = z.x; z.py = z.y; z.x = t.x; z.y = t.y; z.mt = 0; if (t.x !== z.px) z.facing = t.x > z.px ? 1 : -1;
  if (Math.random() < 0.07 && !bubbles.some(b => b.o === z)) tempBubble(z, [{ text: (MINION_KINDS[z.kind] || { say: 'Braaains...' }).say }], 1.1);
}
function loseHeart(h) {
  if (!fight) return;
  fight.hearts--; fight.flash = 1; h.flash = 1; Snd.nope(); burst(h.x + 0.5, h.y, 'heart', 5, 0.8); hintCache.t = -1;
  if (fight.hearts <= 0) fightLost();
}
function fightLost() {
  // no game over: the minions go poof, the villain giggles, and the heroes simply try again (resources kept)
  const b = fight.boss; fight = null; clearMinions(true);
  b.rest = now + 3; b.shake = 1; Snd.groan(0.8); tempBubble(b, [{ text: 'Hee hee! Again?' }], 2.4);
  for (const h of Object.values(heroes)) burst(h.x + 0.5, h.y + 0.2, 'heart', 6, 1);
  later(0.4, () => { const a = activeHero(); if (a) tempBubble(a, [{ text: 'Again!' }, { icon: 'heart' }], 2); });
  hintCache.t = -1; persist();
}
function clearMinions(fx) { if (!L) return; for (const z of L.objs) if (z.minion && !z.gone) { z.gone = true; if (fx) burst(z.x + 0.5, z.y + 0.5, 'puff', 8, 1); } }

/* Ruru's charge: tap a zombie 2-3 tiles away in a straight line and he dashes in for a bonk */
function ruruCharge(h, o) {
  if (h.path.length) return false;
  const dx = o.x - h.x, dy = o.y - h.y, d = Math.abs(dx) + Math.abs(dy);
  if ((dx && dy) || d < 2 || d > 3) return false;
  const sx = Math.sign(dx), sy = Math.sign(dy), p = [];
  for (let k = 1; k < d; k++) { const t = { x: h.x + sx * k, y: h.y + sy * k }; if (!walkable(t.x, t.y)) return false; p.push(t); }
  h.path = p; h.action = o; h.dash = 1; if (sx) h.facing = sx; Snd.swap(); Snd.slash();
  tempBubble(h, [{ text: 'Charge!' }], 1); burst(h.x + 0.5, h.y + 0.8, 'dust', 8, 0.8); return true;
}

/* ---------------- the villain boss ---------------- */
function bossCanHit(h, o) {
  if (o.gone || o.beaten) return false;
  const d = bossDef(o); o.hits = o.hits || [];
  if (!o.cleared) { if (!fight) startFight(o); Snd.nope(); o.shake = 1; tempBubble(o, [{ icon: 'minion_' + ((d.minions && d.minions.kinds[0]) || 'plain') }, { text: 'first!' }], 1.6); return false; }
  if (!(d.needs || []).includes(h.name)) { wrongHero(o, bossNeed(o)[0] || HERO_ORDER[0]); return false; }
  if (o.hits.includes(h.name)) { Snd.nope(); o.shake = 1; switchPulse = 2.5; tempBubble(o, bossNeed(o).map(n => ({ head: n }))); return false; }
  if (!armorOff(o) && h.name !== d.armor) { Snd.nope(); o.shake = 1; switchPulse = 2.5; tempBubble(o, [{ head: d.armor }, { icon: 'sword' }, { icon: 'armor' }], 2); return false; }
  return true;
}
function bossHit(h, o, sup) {
  const d = bossDef(o), wasArmor = !armorOff(o);
  o.hits = (o.hits || []).concat(h.name); o.hurt = 1; o.shake = 1; h.cast = 1; if (!sup) { h.lunge = 1; h.lungeDir = o.x === h.x ? (h.facing || 1) : (o.x > h.x ? 1 : -1); } fxRing(o.x + 0.5, o.y + 0.8, '#fff6a0', 1.6, 0.45, 8); fxRing(o.x + 0.5, o.y + 0.8, '#ff9ed2', 1.1, 0.35, 5); shakeAmt = sup ? 10 : 6; addPower('boss');
  if (h.name === 'ruru') {
    Snd.bonk(); burst(o.x + 0.5, o.y + 0.1, 'star', 14, 1.4);
    if (wasArmor) { Snd.boom(); o.shieldPop = 1; burst(o.x + 0.5, o.y - 0.3, 'glitter', 30, 2); }
    if (!sup) later(0.1, () => tempBubble(h, [{ text: 'Bonk!' }], 1.1));
  } else if (h.name === ARCHER) { Snd.thunk(); burst(o.x + 0.5, o.y, 'star', 14, 1.4); if (!sup) later(0.1, () => tempBubble(h, [{ text: 'Ping!' }], 1.1)); }
  else { if (!sup) zapFx(h, o, true); burst(o.x + 0.5, o.y, 'glitter', 20, 1.6); }
  hintCache.t = -1;
  if (bossNeed(o).length) later(0.5, () => tempBubble(o, [{ text: pickLine(d.hurt) }].concat(bossNeed(o).map(n => ({ head: n }))), 2));
  else bossBeaten(o);
  persist();
}
function bossBeaten(o) {
  const d = bossDef(o); o.beaten = true; o.beatT = 0; fight = null; clearMinions(true);
  later(0.4, () => tempBubble(o, [{ text: d.lose }], 1.4));
  later(1.6, () => {
    o.gone = true; Snd.poof(); Snd.fanfare(); dustCloud(o.x + 0.5, o.y + 0.4, 40); burst(o.x + 0.5, o.y + 0.5, 'confetti', 40, 1.8); shakeAmt = 8;
    S.pieces[d.piece] = true; pend.wand = (pend.wand || 0) + 1;
    floaters.push({ icon: 'piece_' + d.piece, from: w2s(o.x + 0.5, o.y), to: pillPos('wand'), t: 0, dur: 1.1, big: true,
      done: () => { pend.wand--; pillBounce.wand = 1; Snd.magic(); checkTwist(); } });
    hintCache.t = -1; persist();
  });
}
function exitLocked(ex) {
  const b = areaBoss(); if (!b) return;
  Snd.nope(); b.shake = 1; tempBubble(ex || b, [{ icon: 'boss_' + b.boss }, { icon: 'piece_' + bossDef(b).piece }], 2); hintCache.t = -1;
  if (!b.cleared && !fight) later(0.6, () => startFight(b));
}
function bossHint() {
  const b = areaBoss(); if (!b || fight) return null;
  if (!b.cleared) return b;
  const d = bossDef(b), want = !armorOff(b) ? [d.armor] : bossNeed(b);
  if (want.length && !want.includes(S.active)) switchPulse = Math.max(switchPulse, 0.6);
  return b;
}
function villainHint() {
  if (S.twist !== 'queen' || !L) return null;
  const ms = lvlObjs('mirror'); if (!ms.length) return null;
  const mine = ms.filter(m => m.who === S.active && reachable(m));
  if (!mine.length) switchPulse = Math.max(switchPulse, 0.6);
  return nearest(mine.length ? mine : ms);
}
function updateVillain(o, dt) {
  decay(o, 'shieldPop', dt, 1.2); decay(o, 'cast', dt, 2);
  if (o.beaten) { o.beatT = (o.beatT || 0) + dt * SPEED; return; }
  if (o.unspell) { o.unspell += dt * SPEED; return; }
  if (o.talkT === undefined) o.talkT = rnd(4, 7);
  o.talkT -= dt;
  if (o.talkT <= 0) {
    o.talkT = rnd(7, 11);
    if (!bubbles.some(b => b.o === o)) tempBubble(o, [{ text: pickLine(o.type === 'queen' ? ['Mirror, mirror!', 'Hee hee!', 'Mine, all mine!', 'Nyah nyah!'] : bossDef(o).say) }], 1.6);
  }
  if (o.type === 'boss' && !fight && !o.cleared && now > (o.rest || 0) && !trans &&
      Object.values(heroes).some(h => Math.abs(h.x - o.x) + Math.abs(h.y - o.y) <= 2)) startFight(o);
}

/* ---------------- the twist: Evil Queen and the mirrors ---------------- */
function checkTwist() {
  if (!L || S.twist) return; const c = chapterOf(L.i), tw = c && c.twist;
  if (!tw || L.id !== tw.area || !allPieces(c)) return;
  later(1.0, startTwist);
}
function twistOnEnter() {
  const tw = twistDef(); if (!tw || L.id !== tw.area) return;
  if (S.twist === 'queen') {
    const q = lvlObjs('queen')[0];
    if (q && !lvlObjs('mirror').length) breakSpell(q); else if (!q) setupQueen(); else questCard = { area: twistQuestArea(), t: 0 };
  } else if (!S.twist && allPieces(chapterOf(L.i))) later(1.0, startTwist);
}
function startTwist() {
  if (S.twist || !L || scene !== 'play') return; const tw = twistDef(); if (!tw) return;
  S.twist = 'queen'; cine = null; fight = null; questCard = null;
  if (S.active === ARCHER) S.active = HERO_ORDER.find(n => n !== ARCHER && heroes[n]);
  delete heroes[ARCHER]; persist(); Snd.magic();
  startStory(tw.panels, () => { scene = 'play'; setupQueen(); });
}
function freeNear(x0, y0, taken) {
  const ok = (x, y) => inBounds(x, y) && WALK[L.grid[y][x]] && !L.objs.some(o => !o.gone && o.x === x && o.y === y) &&
    !Object.values(heroes).some(h => h.x === x && h.y === y) && !taken.some(t => t.x === x && t.y === y);
  for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) !== r) continue; if (ok(x0 + dx, y0 + dy)) return { x: x0 + dx, y: y0 + dy };
  }
  return null;
}
function setupQueen() {
  const tw = twistDef(); if (!tw || S.twist !== 'queen' || !L || L.id !== tw.area || lvlObjs('queen').length) return;
  const taken = [], qp = freeNear(tw.queenAt[0], tw.queenAt[1], taken); if (!qp) return; taken.push(qp);
  const q = makeObj('queen', qp.x, qp.y); q.pop = 1; L.objs.push(q);
  for (const [x, y, who] of tw.mirrors) { const p = freeNear(x, y, taken); if (!p) continue; taken.push(p); const m = makeObj('mirror', p.x, p.y); m.who = heroes[who] ? who : partyNames()[0]; m.pop = 1; L.objs.push(m); }
  Snd.magic(); shakeAmt = 6; burst(q.x + 0.5, q.y + 0.3, 'glitter', 30, 1.8);
  later(0.6, () => tempBubble(q, [{ text: 'Mirror, mirror!' }], 2));
  questCard = { area: twistQuestArea(), t: 0 }; hintCache.t = -1; persist();
}
function twistQuestArea() { const tw = L && twistDef(); return tw && S.twist === 'queen' && L.id === tw.area && tw.quest ? { id: 'twist', quest: tw.quest } : null; }
function hitMirror(h, o) {
  if (o.crack) return;
  if (h.name !== o.who) { wrongHero(o, o.who); return; }
  o.crack = 0.001; h.cast = 1; addPower('mirror');
  if (h.name === 'mielie') zapFx(h, o);
  else { Snd.slash(); Snd.bonk(); burst(o.x + 0.5, o.y + 0.1, 'star', 12, 1.3); later(0.1, () => tempBubble(h, [{ text: 'Bonk!' }], 1)); }
  later(0.45, () => {
    o.gone = true; Snd.poof(); burst(o.x + 0.5, o.y + 0.2, 'glitter', 26, 1.8); burst(o.x + 0.5, o.y + 0.2, 'spark', 14, 1.4); shakeAmt = 4;
    const q = lvlObjs('queen')[0], left = lvlObjs('mirror').filter(m => !m.crack).length;
    if (q) { q.shake = 1; q.hurt = 1; if (!lvlObjs('mirror').length) breakSpell(q); else tempBubble(q, [{ text: ['Hey!', 'My mirror!', 'Nooo!'][left % 3] }], 1.4); }
    hintCache.t = -1; persist();
  });
}
function queenTalk(h, q) {
  Snd.nope(); q.shake = 1;
  const ms = lvlObjs('mirror'), mine = ms.filter(m => m.who === h.name);
  const who = mine.length ? h.name : (ms[0] ? ms[0].who : h.name);
  if (!mine.length) switchPulse = 2.5;
  tempBubble(q, [{ text: pickLine(['Hee hee!', 'Nyah nyah!', 'Mine!']) }, { head: who }, { icon: 'mirror_' + who }], 2);
}
function breakSpell(q) {
  if (q.unspell) return; q.unspell = 0.001; Snd.magic(); later(0.4, () => Snd.fanfare()); shakeAmt = 8; questCard = null;
  later(1.6, () => {
    q.gone = true; S.twist = 'done';
    const h = makeHero(ARCHER, { x: q.x, y: q.y }); heroes[ARCHER] = h; h.cast = 1; h.squash = 1;
    burst(q.x + 0.5, q.y + 0.3, 'heart', 16, 1.6); burst(q.x + 0.5, q.y + 0.3, 'confetti', 30, 1.8); dustCloud(q.x + 0.5, q.y + 0.4, 20);
    tempBubble(h, [{ text: 'Oops! Sorry!' }, { icon: 'heart' }], 2.2);
    later(2.4, () => { if (heroes[ARCHER]) tempBubble(heroes[ARCHER], [{ head: 'ruru' }, { head: 'mielie' }, { head: ARCHER }, { icon: 'king' }], 2.6); });
    hintCache.t = -1; persist();
  });
}

/* ---------------- drawing: villain bosses ---------------- */
function goofyEyes(x, y, r, look, lid) {
  circ(x - r * 1.1, y, r, '#fff', '#3b2a6b', 2); circ(x + r * 1.1, y - r * 0.1, r * 0.85, '#fff', '#3b2a6b', 2);
  circ(x - r * 1.1 + Math.cos(look) * r * 0.4, y + Math.sin(look) * r * 0.3, r * 0.45, '#222');
  circ(x + r * 1.1 + Math.sin(look * 1.3) * r * 0.35, y - r * 0.1 + Math.cos(look) * r * 0.25, r * 0.4, '#222');
  if (lid) { ctx.fillStyle = lid; ctx.beginPath(); ctx.ellipse(x - r * 1.1, y - r * 0.35, r * 1.08, r * 0.7, 0, Math.PI, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + r * 1.1, y - r * 0.4, r * 0.95, r * 0.6, 0, Math.PI, TAU); ctx.fill(); }
}
function drawNote(x, y, r, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, r * 0.25);
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r * 0.4, -0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + r * 0.48, y - r * 0.1); ctx.lineTo(x + r * 0.48, y - r * 1.4); ctx.quadraticCurveTo(x + r * 1.1, y - r * 1.1, x + r * 0.9, y - r * 0.6); ctx.stroke();
}
const BOSS_LOOKS = {
  // Madame Inkla: lilac sea witch with wiggly tentacles and a glowing shell full of stolen voices
  seawitch(o, s) {
    const w = now * 3 + (o.id || 0);
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const a = -1 + k * 0.4, x0 = Math.sin(a) * s * 0.22, x1 = Math.sin(a) * s * 0.55;
      ctx.strokeStyle = k % 2 ? '#3c1257' : '#5a1f80'; ctx.lineWidth = s * 0.11;
      ctx.beginPath(); ctx.moveTo(x0, -s * 0.3); ctx.quadraticCurveTo(x1 * 0.8 + Math.sin(w + k) * s * 0.08, -s * 0.12, x1 + Math.sin(w * 1.3 + k) * s * 0.1, -s * 0.02 + Math.cos(w + k) * s * 0.04); ctx.stroke();
      circ(x1 * 0.75 + Math.sin(w + k) * s * 0.05, -s * 0.12, s * 0.025, '#d9b3f0');
    }
    ell(0, -s * 0.42, s * 0.3, s * 0.22, '#2a0f3d'); ell(0, -s * 0.5, s * 0.26, s * 0.16, '#6a2c91');
    ctx.strokeStyle = '#b98fd6'; ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.58); ctx.quadraticCurveTo(-s * 0.42, -s * 0.66 + Math.sin(w) * s * 0.06, -s * 0.48, -s * 0.82); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.58); ctx.quadraticCurveTo(s * 0.4, -s * 0.55, s * 0.42, -s * 0.66); ctx.stroke();
    // shell necklace glowing with notes (the voices she pinched)
    const g = ctx.createRadialGradient(0, -s * 0.62, 1, 0, -s * 0.62, s * 0.22); g.addColorStop(0, 'rgba(255,230,140,0.9)'); g.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = g; ctx.fillRect(-s * 0.25, -s * 0.85, s * 0.5, s * 0.45);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(0, -s * 0.56); ctx.arc(0, -s * 0.62, s * 0.08, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 3; k++) { const t = (now * 0.5 + k / 3) % 1; ctx.globalAlpha = 1 - t; drawNote(s * (0.12 + 0.12 * Math.sin(t * 6 + k)), -s * (0.7 + t * 0.6), s * 0.06, ['#ff8fc4', '#7bd8ff', '#ffd23f'][k]); } ctx.globalAlpha = 1;
    const hy = -s * 0.86;
    ell(0, hy - s * 0.12, s * 0.3, s * 0.22, '#f4f0ff'); ell(-s * 0.2, hy - s * 0.25, s * 0.16, s * 0.14, '#ffffff'); ell(s * 0.24, hy - s * 0.02, s * 0.1, s * 0.16, '#e8e2fa');
    circ(0, hy, s * 0.19, '#b98fd6');
    goofyEyes(-s * 0.01, hy - s * 0.02, s * 0.055, now * 2, '#7a3fb0');
    ctx.fillStyle = '#c2185b'; ctx.beginPath(); ctx.ellipse(0, hy + s * 0.1, s * 0.09, s * 0.04 + (o.hurt ? s * 0.03 : 0), 0, 0, Math.PI); ctx.fill();
    circ(s * 0.1, hy + s * 0.06, s * 0.012, '#3b2a6b');
  },
  // Thornessa: horned dark fairy in black with a green-orb staff and her pet raven Pip
  darkfairy(o, s) {
    const w = now * 2 + (o.id || 0);
    ctx.fillStyle = '#5b2a86'; ctx.beginPath(); ctx.moveTo(-s * 0.36, 0); ctx.lineTo(-s * 0.14, -s * 0.72); ctx.lineTo(s * 0.14, -s * 0.72); ctx.lineTo(s * 0.36, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#17121f'; ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(-s * 0.13, -s * 0.72); ctx.lineTo(s * 0.13, -s * 0.72); ctx.lineTo(s * 0.3, 0); ctx.closePath(); ctx.fill();
    // spiky high collar
    ctx.fillStyle = '#2a1d38'; ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.7); ctx.lineTo(-s * 0.34, -s * 1.0); ctx.lineTo(-s * 0.2, -s * 0.92); ctx.lineTo(-s * 0.12, -s * 1.08); ctx.lineTo(0, -s * 0.84); ctx.lineTo(s * 0.12, -s * 1.08); ctx.lineTo(s * 0.2, -s * 0.92); ctx.lineTo(s * 0.34, -s * 1.0); ctx.lineTo(s * 0.15, -s * 0.7); ctx.fill();
    // staff with glowing green orb
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = s * 0.045; ctx.beginPath(); ctx.moveTo(s * 0.36, -s * 0.02); ctx.lineTo(s * 0.4, -s * 1.02); ctx.stroke();
    const oy = -s * 1.1, gg = ctx.createRadialGradient(s * 0.4, oy, 1, s * 0.4, oy, s * 0.22); gg.addColorStop(0, 'rgba(120,255,150,0.95)'); gg.addColorStop(1, 'rgba(47,211,106,0)'); ctx.fillStyle = gg; ctx.fillRect(s * 0.15, oy - s * 0.25, s * 0.5, s * 0.5);
    circ(s * 0.4, oy, s * 0.08, '#2fd36a', '#cfffe0', 2);
    for (let k = 0; k < 3; k++) { const a = w * 2 + k * 2.1; star(s * 0.4 + Math.cos(a) * s * 0.16, oy + Math.sin(a) * s * 0.12, s * 0.03, '#b8ffcf', 4); }
    ctx.strokeStyle = '#cfeedd'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.6); ctx.lineTo(s * 0.36, -s * 0.62); ctx.stroke();
    const hy = -s * 0.86;
    circ(0, hy, s * 0.17, '#cfeedd');
    // curly horns wrapped in a black hood
    ctx.fillStyle = '#17121f'; ctx.beginPath(); ctx.arc(0, hy - s * 0.02, s * 0.2, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.strokeStyle = '#17121f'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * s * 0.1, hy - s * 0.16); ctx.quadraticCurveTo(d * s * 0.32, hy - s * 0.32, d * s * 0.24, hy - s * 0.48); ctx.quadraticCurveTo(d * s * 0.18, hy - s * 0.54, d * s * 0.14, hy - s * 0.48); ctx.stroke(); }
    goofyEyes(0, hy + s * 0.01, s * 0.05, w, '#2fa35a');
    ctx.strokeStyle = '#7a1f4f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(s * 0.02, hy + s * 0.07, s * 0.06, 0.2, Math.PI - 0.6); ctx.stroke();
    circ(-s * 0.1, hy + s * 0.07, s * 0.025, 'rgba(255,120,160,0.5)'); circ(s * 0.11, hy + s * 0.06, s * 0.025, 'rgba(255,120,160,0.5)');
    // Pip the raven on her shoulder
    const rx = -s * 0.3, ry = -s * 0.78 + Math.sin(w * 3) * s * 0.01;
    ell(rx, ry, s * 0.1, s * 0.08, '#1b1b2a'); circ(rx - s * 0.06, ry - s * 0.08, s * 0.06, '#1b1b2a');
    ctx.fillStyle = '#ff9a1a'; ctx.beginPath(); ctx.moveTo(rx - s * 0.11, ry - s * 0.09); ctx.lineTo(rx - s * 0.19, ry - s * 0.07); ctx.lineTo(rx - s * 0.11, ry - s * 0.05); ctx.fill();
    circ(rx - s * 0.06, ry - s * 0.1, s * 0.03, '#fff'); circ(rx - s * 0.065 + Math.cos(w * 4) * s * 0.01, ry - s * 0.1, s * 0.014, '#222');
    ctx.fillStyle = '#2b2b40'; ctx.save(); ctx.translate(rx + s * 0.04, ry - s * 0.02); ctx.rotate(-0.4 + Math.sin(w * 6) * 0.3); ell(s * 0.05, 0, s * 0.08, s * 0.035, '#2b2b40'); ctx.restore();
  },
  // Scarbo: a scruffy, scratched lion with a dark mane and a wonky paper crown (he really wants the throne)
  lion(o, s) {
    const w = now * 2 + (o.id || 0);
    ctx.strokeStyle = '#c98a45'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.22, -s * 0.12); ctx.quadraticCurveTo(s * 0.5, -s * 0.1, s * 0.48 + Math.sin(w * 2) * s * 0.05, -s * 0.42); ctx.stroke();
    circ(s * 0.48 + Math.sin(w * 2) * s * 0.05, -s * 0.44, s * 0.06, '#3a1f14');
    ell(0, -s * 0.34, s * 0.27, s * 0.3, '#d89a52'); ell(0, -s * 0.3, s * 0.15, s * 0.2, '#f0c487');
    ell(-s * 0.15, -s * 0.04, s * 0.1, s * 0.06, '#c98a45'); ell(s * 0.15, -s * 0.04, s * 0.1, s * 0.06, '#c98a45');
    const hy = -s * 0.82;
    ctx.fillStyle = '#3a1f14'; ctx.beginPath();
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, r = s * (k % 2 ? 0.27 : 0.36) + Math.sin(w + k) * s * 0.01; ctx.lineTo(Math.cos(a) * r, hy + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    circ(-s * 0.16, hy - s * 0.15, s * 0.06, '#d89a52'); circ(s * 0.16, hy - s * 0.15, s * 0.06, '#d89a52');
    circ(0, hy, s * 0.2, '#d89a52'); ell(0, hy + s * 0.08, s * 0.12, s * 0.08, '#f0c487');
    goofyEyes(0, hy - s * 0.04, s * 0.05, w, '#b5652a');
    ctx.strokeStyle = '#e25a7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s * 0.13, hy - s * 0.14); ctx.lineTo(-s * 0.04, hy + s * 0.04); ctx.moveTo(-s * 0.09, hy - s * 0.12); ctx.lineTo(-s * 0.15, hy - s * 0.06); ctx.stroke();
    ctx.fillStyle = '#5a2d1a'; ctx.beginPath(); ctx.moveTo(-s * 0.04, hy + s * 0.04); ctx.lineTo(s * 0.04, hy + s * 0.04); ctx.lineTo(0, hy + s * 0.08); ctx.fill();
    ctx.strokeStyle = '#5a2d1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-s * 0.03, hy + s * 0.1, s * 0.03, 0, Math.PI); ctx.arc(s * 0.03, hy + s * 0.1, s * 0.03, Math.PI, 0, true); ctx.stroke();
    // wonky paper crown, held on with tape
    ctx.save(); ctx.translate(s * 0.05, hy - s * 0.24); ctx.rotate(0.25 + Math.sin(w) * 0.05);
    ctx.fillStyle = '#ffe37a'; ctx.beginPath(); ctx.moveTo(-s * 0.14, 0); ctx.lineTo(-s * 0.14, -s * 0.12); ctx.lineTo(-s * 0.07, -s * 0.05); ctx.lineTo(0, -s * 0.14); ctx.lineTo(s * 0.07, -s * 0.05); ctx.lineTo(s * 0.14, -s * 0.12); ctx.lineTo(s * 0.14, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-s * 0.04, -s * 0.03, s * 0.08, s * 0.03); ctx.restore();
  },
  // Frostine (future area): icy snow queen
  snowqueen(o, s) {
    const w = now * 2 + (o.id || 0);
    ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.moveTo(-s * 0.38, 0); ctx.lineTo(-s * 0.12, -s * 0.7); ctx.lineTo(s * 0.12, -s * 0.7); ctx.lineTo(s * 0.38, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e6f6ff'; ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.7); ctx.lineTo(0, 0); ctx.lineTo(s * 0.08, -s * 0.7); ctx.fill();
    const hy = -s * 0.86; circ(0, hy, s * 0.17, '#eef7ff'); ell(0, hy - s * 0.18, s * 0.16, s * 0.1, '#f8fbff');
    for (let k = -2; k <= 2; k++) { ctx.fillStyle = '#bfe9ff'; ctx.beginPath(); ctx.moveTo(k * s * 0.06 - s * 0.03, hy - s * 0.22); ctx.lineTo(k * s * 0.06, hy - s * (0.36 - Math.abs(k) * 0.04)); ctx.lineTo(k * s * 0.06 + s * 0.03, hy - s * 0.22); ctx.fill(); }
    goofyEyes(0, hy, s * 0.05, w, '#7fb8e6');
    for (let k = 0; k < 4; k++) { const a = w + k * 1.6; star(Math.cos(a) * s * 0.45, -s * 0.6 + Math.sin(a) * s * 0.3, s * 0.035, '#fff', 6, 0.5); }
  },
  // Blazio (future area): grumpy underworld lord with flame hair
  flamelord(o, s) {
    const w = now * 4 + (o.id || 0);
    ctx.fillStyle = '#3d3f6b'; ctx.beginPath(); ctx.moveTo(-s * 0.34, 0); ctx.lineTo(-s * 0.18, -s * 0.7); ctx.lineTo(s * 0.18, -s * 0.7); ctx.lineTo(s * 0.34, 0); ctx.closePath(); ctx.fill();
    const hy = -s * 0.86, hot = o.hurt ? '#ff5a3a' : '#4fb8ff';
    ctx.fillStyle = hot; ctx.beginPath(); ctx.moveTo(-s * 0.18, hy - s * 0.05);
    for (let k = 0; k <= 6; k++) { const x = -s * 0.18 + k * s * 0.06; ctx.lineTo(x, hy - s * (0.32 + 0.1 * Math.sin(w + k))); ctx.lineTo(x + s * 0.03, hy - s * 0.15); }
    ctx.lineTo(s * 0.18, hy - s * 0.05); ctx.fill();
    circ(0, hy, s * 0.17, '#a7b0c8'); goofyEyes(0, hy - s * 0.01, s * 0.05, w, '#7b84a0');
    ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.07, hy + s * 0.07, s * 0.14, s * 0.04);
  }
};
function drawBoss(o, cx, by, s) {
  const d = bossDef(o), look = BOSS_LOOKS[d.look] || BOSS_LOOKS.seawitch;
  ctx.save(); ctx.translate(cx, by);
  let a = 1;
  if (o.beaten) { const t = Math.min(1, (o.beatT || 0) / 1.6); ctx.rotate(Math.sin(now * 18) * 0.18 * (1 - t)); ctx.scale(1 - t * 0.4, 1 - t * 0.4); a = 1 - t * 0.3; }
  if (o.hurt) ctx.translate(Math.sin(now * 60) * s * 0.05, 0);
  if (o.shake) ctx.translate(Math.sin(now * 50) * s * 0.03 * o.shake, 0);
  ctx.globalAlpha = a; shadow(0, 0, s * 0.42);
  ctx.translate(0, -Math.abs(Math.sin(now * 2 + (o.id || 0))) * s * 0.02);
  look(o, s, d);
  ctx.restore(); ctx.globalAlpha = 1;
  // magic bubble shield: only Ruru's bonk can pop it
  if (!armorOff(o) && !o.beaten) {
    const r = s * 0.66, yy = by - s * 0.58, p = 0.5 + 0.5 * Math.sin(now * 3);
    const g = ctx.createRadialGradient(cx - r * 0.3, yy - r * 0.3, r * 0.1, cx, yy, r); g.addColorStop(0, 'rgba(255,255,255,0.15)'); g.addColorStop(0.8, (d.color || '#7b5cff') + '33'); g.addColorStop(1, (d.color || '#7b5cff') + '99');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, yy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + 0.3 * p) + ')'; ctx.lineWidth = o.cleared ? 3 : 5; ctx.stroke();
    ell(cx - r * 0.4, yy - r * 0.45, r * 0.22, r * 0.1, 'rgba(255,255,255,0.6)');
    if (o.cleared && heroes[d.armor]) archerBadgeHead(cx + r * 0.75, yy - r * 0.7, T * 0.2, d.armor);
  }
  if (o.shieldPop) { const t = 1 - o.shieldPop; ctx.strokeStyle = 'rgba(255,255,255,' + o.shieldPop + ')'; ctx.lineWidth = 6 * o.shieldPop; ctx.beginPath(); ctx.arc(cx, by - s * 0.58, s * (0.66 + t * 0.8), 0, TAU); ctx.stroke(); }
  if (o.beaten) for (let k = 0; k < 4; k++) { const an = now * 5 + k * TAU / 4; star(cx + Math.cos(an) * s * 0.3, by - s * 1.15 + Math.sin(an) * s * 0.08, s * 0.06, '#ffd23f'); }
}
function archerBadgeHead(x, y, r, n) {
  circ(x, y, r, HERO[n].color, '#fff', 3); const im = sprite(n + 'Head', r * 2);
  if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 2, 0, TAU); ctx.clip(); ctx.drawImage(im, x - r, y - r, r * 2, r * 2); ctx.restore(); }
}

/* ---------------- drawing: minions ---------------- */
function drawMinion(z, cx, by, s) {
  const w = now * 5 + z.id, f = z.facing || -1;
  ctx.save(); ctx.translate(cx, by);
  if (z.bonk) { const t = z.bonk; ctx.translate((z.bdir || 1) * t * T * 3, -Math.sin(Math.min(t, 1) * Math.PI) * T * 1.6 - t * T); ctx.rotate(t * 12 * (z.bdir || 1)); ctx.globalAlpha = Math.max(0, 1 - t * 0.9); }
  if (z.poof) ctx.globalAlpha = 0.6;
  if (z.shake) ctx.translate(Math.sin(now * 60) * s * 0.05, 0);
  if (z.pop) { const k = 1 - z.pop * 0.6; ctx.scale(k, k); }
  shadow(0, 0, s * 0.32);
  const k = z.kind, hop = Math.abs(Math.sin(w * 0.8)) * s * 0.06;
  if (k === 'blob') {
    ctx.strokeStyle = '#7a3fb0'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.15, -s * 0.1); ctx.quadraticCurveTo(i * s * 0.25, s * 0.02, i * s * 0.3 + Math.sin(w + i) * s * 0.06, -s * 0.02); ctx.stroke(); }
    ctx.fillStyle = '#a05cd6'; ctx.beginPath(); ctx.ellipse(0, -s * 0.25, s * 0.3, s * 0.28 * (1 + Math.sin(w) * 0.05), 0, Math.PI, 0); ctx.lineTo(s * 0.3, -s * 0.12); ctx.quadraticCurveTo(0, -s * 0.05, -s * 0.3, -s * 0.12); ctx.fill();
    ell(-s * 0.1, -s * 0.42, s * 0.08, s * 0.05, 'rgba(255,255,255,0.35)');
    goofyEyes(f * s * 0.03, -s * 0.3, s * 0.06, w);
    ell(f * s * 0.04, -s * 0.16, s * 0.06, s * 0.03, '#ff7eb6');
  } else if (k === 'raven') {
    ctx.translate(0, -hop * 2);
    ell(0, -s * 0.3, s * 0.22, s * 0.18, '#1f1f33'); circ(f * s * 0.16, -s * 0.48, s * 0.13, '#1f1f33');
    ctx.save(); ctx.translate(-f * s * 0.05, -s * 0.34); ctx.rotate(-f * (0.3 + Math.sin(w * 3) * 0.5)); ell(-f * s * 0.14, 0, s * 0.16, s * 0.06, '#34345a'); ctx.restore();
    ctx.fillStyle = '#ff9a1a'; ctx.beginPath(); ctx.moveTo(f * s * 0.26, -s * 0.5); ctx.lineTo(f * s * 0.4, -s * 0.45); ctx.lineTo(f * s * 0.26, -s * 0.42); ctx.fill();
    ctx.strokeStyle = '#ff9a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.14); ctx.lineTo(-s * 0.05, -s * 0.02); ctx.moveTo(s * 0.06, -s * 0.14); ctx.lineTo(s * 0.06, -s * 0.02); ctx.stroke();
    circ(f * s * 0.18, -s * 0.52, s * 0.06, '#fff'); circ(f * s * 0.19 + Math.cos(w) * s * 0.02, -s * 0.52, s * 0.03, '#222');
  } else if (k === 'imp') {
    ctx.translate(0, -hop);
    ctx.fillStyle = '#2e8b3a';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.25) * s * 0.22, -s * 0.3 + Math.sin(a - 0.25) * s * 0.22); ctx.lineTo(Math.cos(a) * s * 0.34, -s * 0.3 + Math.sin(a) * s * 0.34); ctx.lineTo(Math.cos(a + 0.25) * s * 0.22, -s * 0.3 + Math.sin(a + 0.25) * s * 0.22); ctx.fill(); }
    circ(0, -s * 0.3, s * 0.24, '#5ccf5a'); ell(0, -s * 0.55, s * 0.12, s * 0.05, '#9be36a');
    goofyEyes(f * s * 0.02, -s * 0.34, s * 0.06, w);
    ctx.strokeStyle = '#1d5a25'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f * s * 0.02, -s * 0.24, s * 0.08, 0.2, Math.PI - 0.2); ctx.stroke();
  } else if (k === 'jackal') {
    ctx.translate(0, -hop);
    ell(0, -s * 0.25, s * 0.26, s * 0.16, '#9a8c7a'); circ(-s * 0.1, -s * 0.28, s * 0.04, '#6e6252'); circ(s * 0.08, -s * 0.22, s * 0.035, '#6e6252');
    ctx.strokeStyle = '#9a8c7a'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-f * s * 0.24, -s * 0.3); ctx.lineTo(-f * s * 0.36, -s * 0.45 + Math.sin(w * 3) * s * 0.05); ctx.stroke();
    ctx.beginPath(); for (const x of [-0.15, -0.05, 0.08, 0.17]) { ctx.moveTo(x * s, -s * 0.14); ctx.lineTo(x * s, -s * 0.01); } ctx.stroke();
    const hx = f * s * 0.2, hy = -s * 0.42; circ(hx, hy, s * 0.15, '#a89a86');
    ctx.fillStyle = '#a89a86'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + d * s * 0.04, hy - s * 0.1); ctx.lineTo(hx + d * s * 0.13, hy - s * 0.32); ctx.lineTo(hx + d * s * 0.14, hy - s * 0.06); ctx.fill(); }
    ell(hx + f * s * 0.1, hy + s * 0.04, s * 0.08, s * 0.05, '#c8bba6'); circ(hx + f * s * 0.17, hy + s * 0.02, s * 0.025, '#333');
    goofyEyes(hx - f * s * 0.01, hy - s * 0.03, s * 0.045, w); ell(hx + f * s * 0.1, hy + s * 0.11, s * 0.03, s * 0.05, '#ff7eb6');
  } else if (k === 'snowball') {
    circ(0, -s * 0.28, s * 0.27, '#f4fbff', '#bfe0f5', 2); goofyEyes(0, -s * 0.32, s * 0.06, w); ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.moveTo(0, -s * 0.24); ctx.lineTo(f * s * 0.16, -s * 0.22); ctx.lineTo(0, -s * 0.2); ctx.fill();
  } else { // ember
    ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.1); ctx.quadraticCurveTo(-s * 0.25, -s * 0.45, 0, -s * (0.62 + Math.sin(w * 2) * 0.05)); ctx.quadraticCurveTo(s * 0.25, -s * 0.45, s * 0.2, -s * 0.1); ctx.closePath(); ctx.fill();
    ell(0, -s * 0.2, s * 0.13, s * 0.1, '#ffd23f'); goofyEyes(0, -s * 0.3, s * 0.05, w);
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

/* ---------------- drawing: Evil Queen and the mirrors ---------------- */
function drawMagicMirror(x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  ctx.fillStyle = '#d4a017'; ctx.fillRect(-r * 0.12, r * 0.9, r * 0.24, r * 0.8);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.78, r, 0, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#9b7bff'); g.addColorStop(1, '#2a0f3d');
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 0.8, 0, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ell(-r * 0.2, -r * 0.4, r * 0.15, r * 0.08, 'rgba(255,255,255,0.6)');
  for (let k = 0; k < 4; k++) star(Math.cos(k * 1.6) * r * 0.9, Math.sin(k * 1.6) * r * 1.1, r * 0.12, '#ffe37a', 4);
  ctx.restore();
}
function drawQueenObj(o, cx, by) {
  const im = sprite('queen', T * 1.8), lil = heroSprite(ARCHER, T * 1.58), u = o.unspell ? Math.min(1, o.unspell / 1.6) : 0;
  const fl = Math.sin(now * 2.5) * T * 0.05;
  const g = ctx.createRadialGradient(cx, by - T * 0.8, T * 0.1, cx, by - T * 0.8, T * 1.1); g.addColorStop(0, 'rgba(176,107,255,' + (0.55 + 0.15 * Math.sin(now * 3)) * (1 - u) + ')'); g.addColorStop(1, 'rgba(90,30,140,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - T * 1.2, by - T * 2, T * 2.4, T * 2.4);
  shadow(cx, by, T * 0.34);
  ctx.save(); ctx.translate(cx + (o.hurt ? Math.sin(now * 60) * T * 0.05 : 0) + (o.shake ? Math.sin(now * 50) * T * 0.04 : 0), by - T * 0.1 + fl);
  if (im) { ctx.globalAlpha = 1 - u; ctx.drawImage(im, -im.dw / 2, -im.dh, im.dw, im.dh); }
  if (u > 0 && lil) { ctx.globalAlpha = u; ctx.drawImage(lil, -lil.dw / 2, -lil.dh, lil.dw, lil.dh); }
  ctx.restore(); ctx.globalAlpha = 1;
  if (!u) drawMagicMirror(cx + T * 0.62, by - T * 1.05 + Math.sin(now * 2) * T * 0.08, T * 0.2, Math.sin(now * 1.5) * 0.2);
  for (let k = 0; k < 4; k++) { const a = now * 1.5 + k * TAU / 4; star(cx + Math.cos(a) * T * 0.55, by - T * 0.9 + Math.sin(a) * T * 0.45, T * 0.05, u ? '#fff' : '#d9a8ff', 4); }
  if (u > 0) { const fa = Math.sin(u * Math.PI); ctx.fillStyle = 'rgba(255,255,255,' + fa * 0.85 + ')'; ctx.beginPath(); ctx.arc(cx, by - T * 0.7, T * (0.4 + u * 1.2), 0, TAU); ctx.fill(); }
}
function drawMirror(o, cx, by, s) {
  if (o.crack) o.crack += 1 / 60;
  const sh = o.crack ? Math.sin(now * 70) * s * 0.04 : (o.shake ? Math.sin(now * 50) * s * 0.04 : 0), col = (HERO[o.who] || {}).color || '#fff';
  ctx.save(); ctx.translate(cx + sh, by);
  if (o.pop) { const k = 1 - o.pop * 0.6; ctx.scale(k, k); }
  shadow(0, 0, s * 0.3);
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(-s * 0.05, -s * 0.35, s * 0.1, s * 0.35); ctx.fillRect(-s * 0.22, -s * 0.06, s * 0.44, s * 0.07);
  const yy = -s * 0.72, g = ctx.createRadialGradient(0, yy, 1, 0, yy, s * 0.55); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
  ctx.fillStyle = g; ctx.fillRect(-s * 0.6, yy - s * 0.6, s * 1.2, s * 1.2);
  ctx.beginPath(); ctx.ellipse(0, yy, s * 0.3, s * 0.4, 0, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, yy, s * 0.23, s * 0.32, 0, 0, TAU); const gg = ctx.createLinearGradient(0, yy - s * 0.3, 0, yy + s * 0.3); gg.addColorStop(0, '#8a5cff'); gg.addColorStop(1, '#2a0f3d'); ctx.fillStyle = gg; ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(217,168,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let a = 0; a < 12; a += 0.3) { const r = a * s * 0.022; ctx.lineTo(Math.cos(a + now * 3) * r, yy + Math.sin(a + now * 3) * r); } ctx.stroke();
  // a goofy face peeks out of the glass
  circ(-s * 0.07, yy - s * 0.05, s * 0.035, '#fff'); circ(s * 0.07, yy - s * 0.05, s * 0.035, '#fff'); ell(0, yy + s * 0.1, s * 0.05, s * 0.03 + Math.abs(Math.sin(now * 3)) * s * 0.02, '#fff');
  if (o.crack) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-s * 0.2, yy - s * 0.25); ctx.lineTo(0, yy); ctx.lineTo(s * 0.18, yy - s * 0.1); ctx.moveTo(0, yy); ctx.lineTo(-s * 0.05, yy + s * 0.3); ctx.moveTo(0, yy); ctx.lineTo(s * 0.15, yy + s * 0.25); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
  archerBadgeHead(cx + s * 0.32, by - s * 1.1, s * 0.17, o.who);
}

/* ---------------- icons ---------------- */
function drawWandPiece(p, s, c) {
  ctx.save(); ctx.rotate(-0.7);
  if (p === 'tip') { star(0, 0, s * 0.42, '#ffd23f'); star(0, 0, s * 0.2, '#fff6c2'); circ(0, 0, s * 0.08, '#ff6fb1'); }
  else if (p === 'stem') { ctx.fillStyle = '#7b5cff'; rr(-s * 0.4, -s * 0.07, s * 0.8, s * 0.14, s * 0.07); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-s * 0.2, -s * 0.08, s * 0.06, s * 0.16); ctx.fillRect(s * 0.14, -s * 0.08, s * 0.06, s * 0.16); star(0, -s * 0.18, s * 0.06, '#fff', 4); }
  else if (p === 'handle') { ctx.fillStyle = '#ff8fc4'; rr(-s * 0.3, -s * 0.1, s * 0.5, s * 0.2, s * 0.08); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.fillRect(s * 0.16, -s * 0.13, s * 0.08, s * 0.26); circ(-s * 0.34, 0, s * 0.11, '#3fa9ff', '#ffd23f', 3); }
  else { circ(0, 0, s * 0.25, '#bfe9ff', '#fff', 3); star(0, 0, s * 0.12, '#fff', 4); }
  ctx.restore();
}
function drawStarWand(s, glow) {
  if (glow) { const g = ctx.createRadialGradient(s * 0.25, -s * 0.25, 1, s * 0.25, -s * 0.25, s * 0.6); g.addColorStop(0, 'rgba(255,240,150,0.9)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; ctx.fillRect(-s * 0.4, -s * 0.9, s * 1.3, s * 1.3); }
  ctx.save(); ctx.rotate(0.7);
  ctx.fillStyle = '#ff8fc4'; rr(-s * 0.06, s * 0.15, s * 0.12, s * 0.3, s * 0.05); ctx.fill(); circ(0, s * 0.48, s * 0.06, '#3fa9ff');
  ctx.fillStyle = '#7b5cff'; ctx.fillRect(-s * 0.04, -s * 0.25, s * 0.08, s * 0.42); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-s * 0.06, s * 0.12, s * 0.12, s * 0.04);
  star(0, -s * 0.34, s * 0.2, '#ffd23f'); star(0, -s * 0.34, s * 0.09, '#fff6c2');
  ctx.restore();
}
function drawVillainIcon(name, s) {
  if (name.startsWith('boss_')) { const d = DATA.bosses[name.slice(5)]; if (!d) return; ctx.save(); ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.fillStyle = d.color + '55'; ctx.fill(); ctx.clip(); ctx.translate(0, s * 0.95); (BOSS_LOOKS[d.look] || BOSS_LOOKS.seawitch)({ id: 3 }, s * 1.05, d); ctx.restore(); return; }
  if (name.startsWith('piece_')) { drawWandPiece(name.slice(6), s); return; }
  if (name.startsWith('minion_')) { const k = name.slice(7); if (MINION_KINDS[k]) drawMinion({ id: 2, kind: k, facing: 1 }, 0, s * 0.42, s * 1.1); else drawZombie({ id: 5, kind: k, facing: 1 }, 0, s * 0.46, s * 0.78, false); return; }
  if (name.startsWith('mirror')) { const who = name.split('_')[1]; drawMagicMirror(0, -s * 0.05, s * 0.32, 0); if (who && HERO[who]) { ctx.strokeStyle = HERO[who].color; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.28, s * 0.36, 0, 0, TAU); ctx.stroke(); } return; }
  switch (name) {
    case 'starwand': drawStarWand(s, true); break;
    case 'armor': { ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, TAU); ctx.fillStyle = 'rgba(160,200,255,0.45)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = '#3b2a6b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.3); ctx.lineTo(0, -s * 0.05); ctx.lineTo(-s * 0.08, s * 0.1); ctx.lineTo(s * 0.06, s * 0.32); ctx.stroke(); ell(-s * 0.15, -s * 0.18, s * 0.1, s * 0.05, 'rgba(255,255,255,0.7)'); break; }
    case 'queen': { const im = sprite('queenHead', s); circ(0, 0, s * 0.48, '#5b1f86'); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, s * 0.46, 0, TAU); ctx.clip(); ctx.drawImage(im, -s / 2, -s / 2, s, s); ctx.restore(); } break; }
    case 'note': drawNote(0, s * 0.15, s * 0.3, '#7b5cff'); break;
    case 'power': star(0, 0, s * 0.45, '#ffd23f', 8, 0.5); break;
  }
}

/* ---------------- HUD: wand pieces and fight hearts ---------------- */
function drawWandBar(x, y, w, h) {
  const ps = wandPieces(); if (!ps.length || !S) return;
  const b = pillBounce.wand || 0, sc = 1 + Math.sin(b * Math.PI) * 0.18, all = ps.every(p => S.pieces[p]);
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
  if (all) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16; }
  ctx.fillStyle = 'rgba(59,42,107,0.25)'; rr(x, y + 4, w, h, h / 2); ctx.fill();
  ctx.fillStyle = S.twist === 'queen' ? 'rgba(232,214,255,0.95)' : 'rgba(255,255,255,0.94)'; rr(x, y, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
  let pendLeft = pend.wand || 0;
  ps.forEach((p, i) => {
    const cx = x + 30 + i * 40, cy = y + h / 2; let have = !!S.pieces[p];
    circ(cx, cy, 17, have ? '#fff6c2' : '#ece6fb');
    if (have && pendLeft > 0 && i === ps.length - 1 - (ps.length - 1 - ps.map(q => !!S.pieces[q]).lastIndexOf(true))) { have = false; pendLeft--; }
    ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = have ? 1 : 0.22; drawWandPiece(p, 34); ctx.restore(); ctx.globalAlpha = 1;
  });
  ctx.restore();
}
function drawFightHUD() {
  const f = fight, y = UI.wand.y + UI.wand.h + 26;
  for (let k = 0; k < f.max; k++) { const x = 26 + k * 30; ctx.save(); if (k === f.hearts && f.flash) { ctx.translate(x, y); ctx.scale(1 + f.flash * 0.6, 1 + f.flash * 0.6); ctx.translate(-x, -y); } heart(x, y, 24, k < f.hearts ? '#ff4d6d' : 'rgba(255,255,255,0.55)'); ctx.restore(); }
  const d = bossDef(f.boss), n = d.minions.waves.length, x0 = 26 + f.max * 30 + 18;
  ctx.fillStyle = 'rgba(59,42,107,0.55)'; rr(x0 - 8, y - 18, 22 + n * 22, 36, 18); ctx.fill();
  for (let k = 0; k < n; k++) circ(x0 + 8 + k * 22, y, 7, k < f.wave ? '#7bd85a' : k === f.wave ? '#ffd23f' : 'rgba(255,255,255,0.5)');
}

/* ---------------- map extras: mini-game nodes, wand pieces, inventory ---------------- */


/* ---------------- story panels for the twist ---------------- */
function drawStoryScene(id, x0, y0, w, h) {
  const cx = x0 + w / 2, t = introT;
  if (id === 'wand') {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#1d1550'); g.addColorStop(1, '#5a3a9a'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    for (let k = 0; k < 20; k++) star(x0 + (k * 97) % w, y0 + (k * 53) % (h * 0.7), 3 + (k % 3), 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(now * 2 + k)) + ')', 4);
    const k = Math.min(1, t / 1.2), ps = wandPieces();
    if (k < 1) ps.forEach((p, i) => { const a = i / ps.length * TAU + now; ctx.save(); ctx.translate(cx + Math.cos(a) * w * 0.3 * (1 - k), y0 + h * 0.38 + Math.sin(a) * h * 0.2 * (1 - k)); drawWandPiece(p, 60); ctx.restore(); });
    else { ctx.save(); ctx.translate(cx, y0 + h * 0.38); const sc = 1 + Math.sin(now * 4) * 0.05; ctx.scale(sc, sc); drawStarWand(150, true); ctx.restore(); }
    const im = heroSprite(ARCHER, h * 0.42); if (im) ctx.drawImage(im, x0 + w * 0.12, y0 + h - im.dh, im.dw, im.dh);
    return true;
  }
  if (id === 'spell') {
    const g = ctx.createRadialGradient(cx, y0 + h * 0.5, 10, cx, y0 + h * 0.5, w); g.addColorStop(0, '#7b3fbf'); g.addColorStop(1, '#1a0b2e'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(217,168,255,0.7)'; ctx.lineWidth = 6; ctx.beginPath(); for (let a = 0; a < 30; a += 0.2) { const r = a * w * 0.016; ctx.lineTo(cx + Math.cos(a - now * 3) * r, y0 + h * 0.5 + Math.sin(a - now * 3) * r * 0.8); } ctx.stroke();
    const im = heroSprite(ARCHER, h * 0.5); if (im) { ctx.save(); ctx.translate(cx, y0 + h * 0.95); ctx.rotate(Math.sin(now * 3) * 0.08); ctx.drawImage(im, -im.dw / 2, -im.dh, im.dw, im.dh); ctx.restore(); }
    ctx.save(); ctx.translate(x0 + w * 0.82, y0 + h * 0.45); ctx.rotate(-0.2); drawZombie({ id: 7, facing: -1, hp: 1, chomp: Math.abs(Math.sin(now * 6)) }, 0, 0, h * 0.3, true); ctx.restore();
    txt('Hee hee!', x0 + w * 0.78, y0 + h * 0.1, 26, '#fff', '#5b1f86');
    return true;
  }
  if (id === 'queen') {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#2a0f3d'); g.addColorStop(1, '#6a2c91'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    const gl = ctx.createRadialGradient(cx, y0 + h * 0.5, 10, cx, y0 + h * 0.5, h * 0.5); gl.addColorStop(0, 'rgba(200,140,255,0.6)'); gl.addColorStop(1, 'rgba(200,140,255,0)'); ctx.fillStyle = gl; ctx.fillRect(x0, y0, w, h);
    const im = sprite('queen', h * 0.85); if (im) ctx.drawImage(im, cx - im.dw / 2 - w * 0.08, y0 + h - im.dh + Math.sin(now * 2) * 4, im.dw, im.dh);
    drawMagicMirror(x0 + w * 0.8, y0 + h * 0.42 + Math.sin(now * 2) * 8, h * 0.12, Math.sin(now) * 0.2);
    for (let k = 0; k < 8; k++) { const a = now + k * TAU / 8; star(cx + Math.cos(a) * w * 0.4, y0 + h * 0.5 + Math.sin(a) * h * 0.35, 6, '#d9a8ff', 4); }
    return true;
  }
  if (id === 'mirrors') {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#ffe7c2'); g.addColorStop(1, '#c9a0e8'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    const ms = [[0.2, 0.32, 'mielie'], [0.8, 0.32, 'ruru'], [0.2, 0.72, 'ruru'], [0.8, 0.72, 'mielie']];
    ms.forEach(([mx, my, who], k) => { ctx.save(); ctx.translate(x0 + w * mx, y0 + h * my); const cr = (t * 1.5 - k * 0.3) > 0.5; if (cr) ctx.rotate(Math.sin(now * 40) * 0.05); drawMagicMirror(0, 0, h * 0.1, 0); ctx.restore(); archerBadgeHead(x0 + w * mx + h * 0.1, y0 + h * my - h * 0.12, 18, who); });
    const im = sprite('queen', h * 0.45); if (im) ctx.drawImage(im, cx - im.dw / 2, y0 + h * 0.3, im.dw, im.dh);
    heart(cx, y0 + h * 0.18, 50 + Math.sin(now * 5) * 6, '#ff4d6d');
    return true;
  }
  return false;
}
